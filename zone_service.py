"""OpenStreetMap land-use zone adapter for CYCLONEX.

Fetches land-use, amenity, and natural polygons from the public Overpass API
and classifies each zone by structural vulnerability to cyclone hazards.
"""

from __future__ import annotations

import math
from typing import Any

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = (3, 25)

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

    Returns a GeoJSON FeatureCollection where each feature has properties
    describing its zone type, vulnerability score, and display colour.
    """
    query = (
        f"[out:json][timeout:20];"
        f"("
        f"  way[landuse]({south},{west},{north},{east});"
        f"  relation[landuse]({south},{west},{north},{east});"
        f"  way[natural~'water|wetland|wood|scrub|heath']({south},{west},{north},{east});"
        f"  way[amenity~'hospital|school|university|college|clinic']({south},{west},{north},{east});"
        f");"
        f"out tags geom;"
    )
    response = requests.post(
        OVERPASS_URL,
        data={"data": query},
        headers={"User-Agent": "CYCLONEX/2.0 zone-vulnerability-map"},
        timeout=OVERPASS_TIMEOUT,
    )
    response.raise_for_status()
    raw = response.json()

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

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "classification": "CYCLONEX zone vulnerability model v1",
            "note": "Vulnerability scores are screening-level estimates based on land-use type.",
        },
    }
