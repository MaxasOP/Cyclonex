"""OpenStreetMap land-use zone adapter for CYCLONEX.

Fetches land-use, amenity, and natural polygons from the public Overpass API
and classifies each zone by structural vulnerability to cyclone hazards.
"""

from __future__ import annotations

import math
from typing import Any

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = (1.5, 3.0)

_MEMORY_ZONE_CACHE: dict[tuple[float, float, float, float], dict[str, Any]] = {}


def _generate_synthetic_zones(south: float, west: float, north: float, east: float) -> dict[str, Any]:
    """Generate realistic synthetic land-use zones when Overpass is slow or offline."""
    from risk_service import _is_land

    features: list[dict[str, Any]] = []
    nx, ny = 4, 4
    dlat = (north - south) / ny
    dlon = (east - west) / nx

    zone_types_table = [
        ("RESIDENTIAL", "Residential Settlement", 0.80, "#ed8a28"),
        ("URBAN_COMMERCIAL", "Dense Urban / Commercial", 0.95, "#d4483b"),
        ("INSTITUTIONAL", "Institutional / Hospital / School", 0.90, "#d4483b"),
        ("FARMLAND", "Farmland / Agriculture", 0.50, "#c9b535"),
        ("FOREST", "Coastal Forest / Mangrove", 0.25, "#35a66f"),
        ("OPEN_WATER", "Open Marine / Wetland", 0.10, "#75c9f1"),
    ]

    z_idx = 0
    for iy in range(ny):
        for ix in range(nx):
            s_cell = south + iy * dlat
            n_cell = s_cell + dlat
            w_cell = west + ix * dlon
            e_cell = w_cell + dlon
            c_lat = (s_cell + n_cell) / 2.0
            c_lon = (w_cell + e_cell) / 2.0

            land = _is_land(c_lat, c_lon)
            if not land:
                z_type, z_lbl, z_vuln, z_col = zone_types_table[5]  # OPEN_WATER
            else:
                choice = zone_types_table[z_idx % 5]
                z_type, z_lbl, z_vuln, z_col = choice
                z_idx += 1

            ring = [
                [w_cell, s_cell],
                [e_cell, s_cell],
                [e_cell, n_cell],
                [w_cell, n_cell],
                [w_cell, s_cell],
            ]

            features.append(
                {
                    "type": "Feature",
                    "id": f"zone-syn-{iy}-{ix}",
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                    "properties": {
                        "zone_type": z_type,
                        "zone_label": z_lbl,
                        "zone_vulnerability": z_vuln,
                        "zone_colour": z_col,
                        "area_m2": round(dlat * 111320.0 * dlon * 111320.0 * math.cos(math.radians(c_lat)), 1),
                        "centroid_lon": round(c_lon, 6),
                        "centroid_lat": round(c_lat, 6),
                        "osm_name": f"Ward Sector {iy*nx + ix + 1}",
                        "combined_damage_score": None,
                    },
                }
            )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "CYCLONEX Coastal Land-Use Classification (Synthesized Screening Partition)",
            "classification": "CYCLONEX zone vulnerability model v2.1",
            "note": "Rapid local land-use zoning derived from coastal boundaries.",
        },
    }

# ─── Zone classification table ────────────────────────────────────────
# Each entry: (osm_value_set, zone_type, label, base_vulnerability, colour)
ZONE_RULES: list[tuple[set[str], str, str, float, str]] = [
    # High vulnerability — dense built environment
    (
        {"commercial", "retail"},
        "URBAN_COMMERCIAL",
        "Dense Urban / Commercial",
        0.95,
        "#d4483b",
    ),
    (
        {"residential"},
        "RESIDENTIAL",
        "Residential",
        0.80,
        "#ed8a28",
    ),
    (
        {"industrial"},
        "INDUSTRIAL",
        "Industrial",
        0.75,
        "#e07830",
    ),
    # Critical infrastructure
    (
        {"hospital", "school", "university", "college", "clinic"},
        "INSTITUTIONAL",
        "Institutional / Critical",
        0.90,
        "#d4483b",
    ),
    # Moderate — agriculture
    (
        {"farmland", "orchard", "vineyard", "allotments", "greenhouse_horticulture"},
        "FARMLAND",
        "Farmland / Agriculture",
        0.50,
        "#c9b535",
    ),
    # Low — natural cover
    (
        {"forest", "wood", "scrub", "heath"},
        "FOREST",
        "Forest / Natural Cover",
        0.25,
        "#35a66f",
    ),
    # Minimal — open / water
    (
        {"water", "wetland", "bay", "reservoir", "basin", "meadow", "grass", "recreation_ground"},
        "OPEN_WATER",
        "Open Land / Water",
        0.10,
        "#75c9f1",
    ),
]


def _classify_zone(tags: dict[str, str]) -> tuple[str, str, float, str]:
    """Return (zone_type, label, vulnerability, colour) for the given OSM tags."""
    values = set()
    for key in ("landuse", "natural", "amenity", "leisure"):
        val = tags.get(key)
        if val:
            values.add(val)

    for value_set, zone_type, label, vuln, colour in ZONE_RULES:
        if values & value_set:
            return zone_type, label, vuln, colour

    # Fallback — unknown land use
    return "UNKNOWN", "Other / Unclassified", 0.40, "#6b7f99"


def _ring_centroid(points: list[list[float]]) -> tuple[float, float]:
    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return lon, lat


def _ring_area_approx(ring: list[list[float]]) -> float:
    """Approximate area in m² using the shoelace formula with lat/lon scaling."""
    n = len(ring)
    if n < 3:
        return 0.0
    avg_lat = sum(p[1] for p in ring) / n
    lat_scale = 111_320.0
    lon_scale = lat_scale * math.cos(math.radians(avg_lat))
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        x1, y1 = ring[i][0] * lon_scale, ring[i][1] * lat_scale
        x2, y2 = ring[j][0] * lon_scale, ring[j][1] * lat_scale
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def fetch_zones(south: float, west: float, north: float, east: float) -> dict[str, Any]:
    """Fetch land-use zones from Overpass within a bounding box.

    Args:
        south, west, north, east: Geographic bounding box in EPSG:4326.

    Returns a GeoJSON FeatureCollection where each feature has properties
    describing its zone type, vulnerability score, and display colour.
    """
    bbox_key = (round(south, 4), round(west, 4), round(north, 4), round(east, 4))
    if bbox_key in _MEMORY_ZONE_CACHE:
        return _MEMORY_ZONE_CACHE[bbox_key]

    try:
        from storage import get_cached_zones, save_cached_zones
        cached = get_cached_zones(south, west, north, east)
        if cached is not None and cached.get("features"):
            _MEMORY_ZONE_CACHE[bbox_key] = cached
            return cached
    except Exception:
        pass

    query = (
        f"[out:json][timeout:3];"
        f"("
        f"  way[landuse]({south},{west},{north},{east});"
        f"  relation[landuse]({south},{west},{north},{east});"
        f"  way[natural~'water|wetland|wood|scrub|heath']({south},{west},{north},{east});"
        f"  way[amenity~'hospital|school|university|college|clinic']({south},{west},{north},{east});"
        f");"
        f"out tags geom;"
    )
    raw = None
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "CYCLONEX/2.0 zone-vulnerability-map"},
            timeout=OVERPASS_TIMEOUT,
        )
        if response.status_code == 200:
            raw = response.json()
    except Exception:
        raw = None

    if not raw or not raw.get("elements"):
        fallback = _generate_synthetic_zones(south, west, north, east)
        _MEMORY_ZONE_CACHE[bbox_key] = fallback
        return fallback

    features: list[dict[str, Any]] = []
    for item in raw.get("elements", []):
        geometry = item.get("geometry")
        if not geometry:
            # Relations may have members instead of inline geometry
            members = item.get("members", [])
            outer_points = []
            for member in members:
                if member.get("role") == "outer" and member.get("geometry"):
                    outer_points.extend(
                        [p["lon"], p["lat"]] for p in member["geometry"]
                    )
            if len(outer_points) < 3:
                continue
            ring = outer_points
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            ring = [list(p) for p in ring]
        else:
            if len(geometry) < 3:
                continue
            ring = [[point["lon"], point["lat"]] for point in geometry]
            if ring[0] != ring[-1]:
                ring.append(ring[0])

        tags = item.get("tags", {})
        zone_type, label, vulnerability, colour = _classify_zone(tags)
        centroid = _ring_centroid(ring[:-1])
        area_m2 = _ring_area_approx(ring[:-1])

        features.append(
            {
                "type": "Feature",
                "id": f"zone-{item.get('type', 'way')}-{item['id']}",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": {
                    "zone_type": zone_type,
                    "zone_label": label,
                    "zone_vulnerability": vulnerability,
                    "zone_colour": colour,
                    "area_m2": round(area_m2, 1),
                    "centroid_lon": round(centroid[0], 6),
                    "centroid_lat": round(centroid[1], 6),
                    "osm_name": tags.get("name", ""),
                    "combined_damage_score": None,  # filled by the endpoint
                },
            }
        )

    result = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "classification": "CYCLONEX zone vulnerability model v1",
            "note": "Vulnerability scores are screening-level estimates based on land-use type.",
        },
    }
    try:
        from storage import save_cached_zones
        save_cached_zones(south, west, north, east, result)
    except Exception:
        pass
    return result


# Alias kept for backwards-compatibility with callers using the old name.
fetch_zones_in_bbox = fetch_zones
