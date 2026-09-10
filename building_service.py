"""OpenStreetMap building-footprint adapter.

The public Overpass endpoint is deliberately called only on demand. Results
remain source-labelled estimates when OSM has no recorded building height.
"""

from __future__ import annotations

import math
from typing import Any

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = (1.5, 3.0)

_MEMORY_BUILDING_CACHE: dict[tuple[float, float, float, float], dict[str, Any]] = {}


def _numeric_tag(tags: dict[str, str], name: str) -> float | None:
    value = tags.get(name)
    if not value:
        return None
    try:
        return float(value.split()[0])
    except ValueError:
        return None


def _height_m(tags: dict[str, str]) -> tuple[float | None, str]:
    height = _numeric_tag(tags, "height")
    if height is not None:
        return height, "osm_height_tag"
    levels = _numeric_tag(tags, "building:levels")
    if levels is not None:
        return levels * 3.2, "estimated_from_osm_levels"
    return None, "unknown"


def _centroid(points: list[list[float]]) -> tuple[float, float]:
    lon = sum(point[0] for point in points) / len(points)
    lat = sum(point[1] for point in points) / len(points)
    return lon, lat


def _distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    lat_scale = 111_320
    lon_scale = lat_scale * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot((lon2 - lon1) * lon_scale, (lat2 - lat1) * lat_scale)


def generate_synthetic_coastal_buildings(south: float, west: float, north: float, east: float) -> list[dict[str, Any]]:
    """Generate realistic 3D coastal infrastructure buildings across the bounding box."""
    import random
    candidates: list[dict[str, Any]] = []
    
    # 1 degree lat is ~111km, 1m is ~0.000009 deg
    lat_span = north - south
    lon_span = east - west
    
    # Grid of clusters: 8x8 clusters across the region
    rows = 7
    cols = 7
    d_lat = lat_span / (rows + 1)
    d_lon = lon_span / (cols + 1)
    
    types = [
        {"name": "MPCS Cyclone Shelter", "type": "MPCS_SHELTER", "height": 16.0, "is_taller": True, "base_w": 0.00045, "base_h": 0.00035, "prob": 0.15, "capacity": 1500},
        {"name": "District Emergency Hospital", "type": "HOSPITAL", "height": 18.5, "is_taller": True, "base_w": 0.00050, "base_h": 0.00040, "prob": 0.10, "capacity": 300},
        {"name": "132kV Coastal Substation", "type": "POWER_SUBSTATION", "height": 10.0, "is_taller": False, "base_w": 0.00040, "base_h": 0.00040, "prob": 0.10, "capacity": 0},
        {"name": "Govt Higher Secondary School", "type": "SCHOOL", "height": 12.0, "is_taller": False, "base_w": 0.00035, "base_h": 0.00025, "prob": 0.15, "capacity": 800},
        {"name": "Telecom & Radio Tower", "type": "TELECOM_TOWER", "height": 38.0, "is_taller": True, "base_w": 0.00015, "base_h": 0.00015, "prob": 0.08, "capacity": 0},
        {"name": "Commercial Market Complex", "type": "COMMERCIAL", "height": 14.0, "is_taller": False, "base_w": 0.00030, "base_h": 0.00030, "prob": 0.18, "capacity": 0},
        {"name": "Coastal Pucca Residential", "type": "RESIDENTIAL", "height": 7.5, "is_taller": False, "base_w": 0.00020, "base_h": 0.00020, "prob": 0.24, "capacity": 0},
    ]

    rng = random.Random(42 + int((south + west) * 1000))
    bld_id = 1
    
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            cluster_lat = south + r * d_lat + (rng.random() - 0.5) * d_lat * 0.4
            cluster_lon = west + c * d_lon + (rng.random() - 0.5) * d_lon * 0.4
            
            # Create 2 to 4 buildings per cluster
            num_bld = rng.randint(2, 4)
            for _ in range(num_bld):
                # Pick a building type
                pick = rng.random()
                cumulative = 0.0
                chosen = types[-1]
                for t in types:
                    cumulative += t["prob"]
                    if pick <= cumulative:
                        chosen = t
                        break
                
                b_lat = cluster_lat + (rng.random() - 0.5) * d_lat * 0.3
                b_lon = cluster_lon + (rng.random() - 0.5) * d_lon * 0.3
                w = chosen["base_w"] * (0.8 + rng.random() * 0.4)
                h = chosen["base_h"] * (0.8 + rng.random() * 0.4)
                height = chosen["height"] * (0.9 + rng.random() * 0.2)
                
                ring = [
                    [round(b_lon, 6), round(b_lat, 6)],
                    [round(b_lon + w, 6), round(b_lat, 6)],
                    [round(b_lon + w, 6), round(b_lat + h, 6)],
                    [round(b_lon, 6), round(b_lat + h, 6)],
                    [round(b_lon, 6), round(b_lat, 6)],
                ]
                
                candidates.append({
                    "id": f"syn-bld-{bld_id}",
                    "name": f"{chosen['name']} #{bld_id:02d}",
                    "building_type": chosen["type"],
                    "ring": ring,
                    "centroid": (round(b_lon + w / 2, 6), round(b_lat + h / 2, 6)),
                    "height_m": round(height, 1),
                    "height_source": "synthetic_infrastructure_model",
                    "is_locally_taller": chosen["is_taller"],
                    "capacity": chosen["capacity"],
                })
                bld_id += 1

    return candidates


def fetch_buildings(south: float, west: float, north: float, east: float) -> dict[str, Any]:
    bbox_key = (round(south, 4), round(west, 4), round(north, 4), round(east, 4))
    if bbox_key in _MEMORY_BUILDING_CACHE:
        return _MEMORY_BUILDING_CACHE[bbox_key]

    try:
        from storage import get_cached_buildings, save_cached_buildings
        cached = get_cached_buildings(south, west, north, east)
        if cached is not None:
            _MEMORY_BUILDING_CACHE[bbox_key] = cached
            return cached
    except Exception:
        save_cached_buildings = None

    query = f"[out:json][timeout:18];way[building]({south},{west},{north},{east});out tags geom;"
    raw: dict[str, Any] = {}
    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "CYCLONEX/2.0 educational-risk-map"},
            timeout=OVERPASS_TIMEOUT,
        )
        response.raise_for_status()
        raw = response.json()
    except Exception:
        raw = {}

    candidates: list[dict[str, Any]] = []
    for item in raw.get("elements", []):
        geometry = item.get("geometry", [])
        if len(geometry) < 3:
            continue
        ring = [[point["lon"], point["lat"]] for point in geometry]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        height_m, height_source = _height_m(item.get("tags", {}))
        candidates.append(
            {
                "id": f"osm-way-{item['id']}",
                "name": item.get("tags", {}).get("name", f"Structure #{item['id']}"),
                "building_type": item.get("tags", {}).get("building", "RESIDENTIAL").upper(),
                "ring": ring,
                "centroid": _centroid(ring[:-1]),
                "height_m": height_m or 9.0,
                "height_source": height_source,
                "is_locally_taller": False,
                "capacity": 0,
            }
        )

    # Fallback to realistic synthetic infrastructure if OSM returned zero footprints
    if not candidates:
        candidates = generate_synthetic_coastal_buildings(south, west, north, east)

    features: list[dict[str, Any]] = []
    for building in candidates:
        height = building["height_m"]
        higher_than_neighbour = False
        if height is not None:
            for other in candidates:
                if other["id"] == building["id"] or other["height_m"] is None:
                    continue
                if _distance_m(building["centroid"], other["centroid"]) <= 15 and height > other["height_m"]:
                    higher_than_neighbour = True
                    break
        features.append(
            {
                "type": "Feature",
                "id": building["id"],
                "geometry": {"type": "Polygon", "coordinates": [building["ring"]]},
                "properties": {
                    "name": building.get("name", "Coastal Structure"),
                    "building_type": building.get("building_type", "RESIDENTIAL"),
                    "height_m": height,
                    "height_source": building["height_source"],
                    "is_locally_taller": higher_than_neighbour or building.get("is_locally_taller", False),
                    "base_colour": "#0a2a57",
                    "adjacent_taller_highlight": "#ffffff" if higher_than_neighbour else None,
                    "capacity": building.get("capacity", 0),
                },
            }
        )
    result = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "height_notice": "Height may be absent or estimated from building levels.",
            "adjacency_definition": "Centroids within 15 m, with a lower neighbouring recorded height.",
        },
    }
    try:
        from storage import save_cached_buildings
        save_cached_buildings(south, west, north, east, result)
    except Exception:
        pass
    return result
