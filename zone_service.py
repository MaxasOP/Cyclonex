"""OpenStreetMap land-use zone adapter for CYCLONEX.

Fetches land-use, amenity, and natural polygons from the public Overpass API
and classifies each zone by structural vulnerability to cyclone hazards.
"""

from __future__ import annotations

import math
import time
from copy import deepcopy
from shapely.geometry import LineString, Polygon, mapping
from shapely.ops import polygonize, unary_union
from typing import Any

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = (1.5, 3.0)

_MEMORY_ZONE_CACHE: dict[tuple[float, float, float, float], dict[str, Any]] = {}


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


def _zone_polygons(item):
    def line(points):
        return LineString([(p["lon"], p["lat"]) for p in points])

    if item.get("type") == "relation":
        by_role = {"outer": [], "inner": []}
        for member in item.get("members", []):
            role = member.get("role") or "outer"
            if role in by_role and len(member.get("geometry", [])) >= 2:
                by_role[role].append(line(member["geometry"]))
        shells = list(polygonize(by_role["outer"]))
        holes = unary_union(list(polygonize(by_role["inner"])))
        for shell in shells:
            poly = shell.difference(holes)
            if poly.geom_type == "Polygon" and poly.is_valid and poly.area > 0:
                yield poly
    elif len(item.get("geometry", [])) >= 4:
        boundary = line(item["geometry"])
        if boundary.is_ring:
            yield Polygon(boundary)


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
    from storage import get_cached_zones, save_cached_zones
    bbox_key = (south, west, north, east)
    cached = _MEMORY_ZONE_CACHE.get(bbox_key)
    if cached is None:
        try:
            cached = get_cached_zones(*bbox_key)
        except Exception:
            cached = None
    # Historical synthetic entries and old geometries lack this version marker.
    if cached and cached.get("metadata", {}).get("geometry_version") != 2:
        cached = None
    if cached and time.time() - cached["metadata"]["fetched_at"] <= 900:
        result = deepcopy(cached)
        result["metadata"]["status"] = "CACHED" if result["features"] else "NO_DATA"
        return result

    bbox = f"{south},{west},{north},{east}"
    query = (f'[out:json][timeout:5];(way[landuse]({bbox});relation[landuse]({bbox});'
             f'way["natural"~"water|wetland|wood|scrub|heath"]({bbox});'
             f'way["amenity"~"hospital|school|university|college|clinic"]({bbox}););out geom 200;')
    try:
        response = requests.post(OVERPASS_URL, data={"data": query}, headers={"User-Agent": "CYCLONEX/2.2"}, timeout=OVERPASS_TIMEOUT)
        response.raise_for_status()
        raw = response.json()
        if not isinstance(raw, dict) or not isinstance(raw.get("elements"), list) or raw.get("remark"):
            raise ValueError("Incomplete Overpass response")
    except (requests.RequestException, ValueError):
        if cached:
            result = deepcopy(cached)
            result["metadata"].update(status="STALE_CACHE", notice="Overpass is unavailable. Showing the last successful query.")
            return result
        return {"type": "FeatureCollection", "features": [], "metadata": {
            "source": "OpenStreetMap via Overpass API", "status": "UNAVAILABLE", "notice": "Zone provider unavailable."}}

    features = []
    for item in raw["elements"]:
        try:
            polygons = list(_zone_polygons(item))
        except (KeyError, TypeError, ValueError):
            continue
        tags = item.get("tags", {})
        zone_type, label, vulnerability, colour = _classify_zone(tags)
        for index, poly in enumerate(polygons):
            center = poly.representative_point()
            area = _ring_area_approx(poly.exterior.coords) - sum(_ring_area_approx(r.coords) for r in poly.interiors)
            zone_id = f"zone-{item.get('type', 'way')}-{item['id']}"
            features.append({
                "type": "Feature", "id": zone_id if len(polygons) == 1 else f"{zone_id}-{index}",
                "geometry": mapping(poly), "properties": {
                    "zone_type": zone_type, "zone_label": label, "zone_vulnerability": vulnerability, "zone_colour": colour,
                    "area_m2": round(max(0, area), 1), "centroid_lon": round(center.x, 6), "centroid_lat": round(center.y, 6),
                    "osm_name": tags.get("name", ""), "combined_damage_score": None,
                },
            })
    result = {"type": "FeatureCollection", "features": features, "metadata": {
        "source": "OpenStreetMap via Overpass API", "geometry_version": 2, "fetched_at": time.time(),
        "status": "LIVE" if features else "NO_DATA",
        "note": "Up to 200 mapped elements. Vulnerability scores are assumptions based on land-use type.",
    }}
    _MEMORY_ZONE_CACHE[bbox_key] = deepcopy(result)
    if len(_MEMORY_ZONE_CACHE) > 32:
        _MEMORY_ZONE_CACHE.pop(next(iter(_MEMORY_ZONE_CACHE)), None)
    try:
        save_cached_zones(*bbox_key, result)
    except Exception:
        pass
    return result


fetch_zones_in_bbox = fetch_zones
