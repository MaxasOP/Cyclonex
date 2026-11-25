"""OpenStreetMap building-footprint adapter.

The public Overpass endpoint is deliberately called only on demand. Results
remain source-labelled estimates when OSM has no recorded building height.
"""

from __future__ import annotations

import math
import json
import os
import re
from typing import Any

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = (3.0, 10.0)

_MEMORY_BUILDING_CACHE: dict[tuple[float, float, float, float], dict[str, Any]] = {}

_BUNDLED_CACHE: dict[str, Any] | None = None

def _load_bundled_dataset() -> dict[str, Any]:
    global _BUNDLED_CACHE
    if _BUNDLED_CACHE is not None:
        return _BUNDLED_CACHE
    bundle_path = os.path.join(os.path.dirname(__file__), "real_buildings_bundle.json")
    if os.path.exists(bundle_path):
        try:
            with open(bundle_path, "r", encoding="utf-8") as f:
                _BUNDLED_CACHE = json.load(f)
                return _BUNDLED_CACHE
        except Exception:
            _BUNDLED_CACHE = {}
            return {}
    _BUNDLED_CACHE = {}
    return {}

def _get_bundled_buildings(lat: float, lon: float) -> list[dict[str, Any]]:
    bundle = _load_bundled_dataset()
    if not bundle:
        return []
    target_city = None
    if abs(lat - 21.62) < 0.2 and abs(lon - 87.51) < 0.2:
        target_city = bundle.get("digha")
    elif abs(lat - 19.81) < 0.2 and abs(lon - 85.83) < 0.2:
        target_city = bundle.get("puri")
    elif abs(lat - 17.71) < 0.25 and abs(lon - 83.31) < 0.25:
        target_city = bundle.get("vizag")

    if not target_city:
        return []

    candidates: list[dict[str, Any]] = []
    for b in target_city.get("buildings", []):
        ring = b["ring"]
        candidates.append({
            "id": b["id"],
            "name": b["name"],
            "building_type": b["type"],
            "ring": ring,
            "centroid": _centroid(ring[:-1]),
            "height_m": b["height_m"],
            "height_source": "bundled_height_unverified",
            "is_locally_taller": False,
            "capacity": None,
        })
    return candidates


def _numeric_tag(tags: dict[str, str], name: str) -> float | None:
    value = tags.get(name)
    if not value:
        return None
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)\s*(m|ft|feet|')?", str(value).strip().lower())
    if not match or name != "height" and match[2]:
        return None
    height = float(match[1]) * (0.3048 if match[2] in {"ft", "feet", "'"} else 1.0)
    return height if math.isfinite(height) and height > 0 else None


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


def fetch_buildings(south: float, west: float, north: float, east: float) -> dict[str, Any]:
    from copy import deepcopy
    from time import monotonic
    bbox_key = (round(south, 4), round(west, 4), round(north, 4), round(east, 4))
    entry = _MEMORY_BUILDING_CACHE.get(bbox_key)
    if entry and monotonic() - entry["cached_at"] < 900:
        return deepcopy(entry["result"])

    c_lat, c_lon = (south + north) / 2, (west + east) / 2
    # Use known local footprints first. Never fabricate emergency infrastructure.
    candidates = [b for b in _get_bundled_buildings(c_lat, c_lon)
                  if west <= b["centroid"][0] <= east and south <= b["centroid"][1] <= north]
    source = "BUNDLED_FOOTPRINTS_UNVERIFIED" if candidates else "OPENSTREETMAP_LIVE"
    status = "CACHED" if candidates else "LIVE"
    error = None
    q_s, q_n = max(south, c_lat - .016), min(north, c_lat + .016)
    q_w, q_e = max(west, c_lon - .016), min(east, c_lon + .016)
    if not candidates:
        query = f'[out:json][timeout:8];way["building"]({q_s:.5f},{q_w:.5f},{q_n:.5f},{q_e:.5f});out tags geom 200;'
        raw = {}
        try:
            response = requests.post(OVERPASS_URL, data={"data": query},
                                     headers={"User-Agent": "CYCLONEX/2.2"}, timeout=(2, 8))
            response.raise_for_status()
            raw = response.json()
            if not isinstance(raw, dict) or not isinstance(raw.get("elements"), list) or raw.get("remark"):
                raise ValueError("Incomplete Overpass response")
        except (requests.RequestException, ValueError):
            raw = {}
            error, status = "Building provider unavailable; no footprints were invented.", "UNAVAILABLE"
        for item in raw.get("elements", []):
            if not isinstance(item, dict):
                continue
            geometry = item.get("geometry") or []
            if "id" not in item or len(geometry) < 4:
                continue
            try:
                ring = [[float(point["lon"]), float(point["lat"])] for point in geometry]
            except (TypeError, ValueError, KeyError):
                continue
            if ring[0] != ring[-1] or not all(math.isfinite(v) for point in ring for v in point):
                continue
            tags = item.get("tags", {})
            height_m, height_source = _height_m(tags)
            candidates.append({"id": f"osm-way-{item['id']}", "name": tags.get("name", f"OSM building {item['id']}"),
                               "building_type": tags.get("building", "yes").upper(), "ring": ring,
                               "centroid": _centroid(ring[:-1]), "height_m": height_m,
                               "height_source": height_source, "is_locally_taller": False, "capacity": None})
        if not candidates and status == "LIVE":
            status = "NO_DATA"

    if source == "BUNDLED_FOOTPRINTS_UNVERIFIED":
        q_s, q_w, q_n, q_e = south, west, north, east
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
                    "capacity": building.get("capacity"),
                },
            }
        )
    result = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": source,
            "status": status,
            "notice": error,
            "query_extent": {"south": q_s, "west": q_w, "north": q_n, "east": q_e},
            "coverage": "Partial footprint coverage; not a complete scenario inventory.",
            "height_notice": "Height may be absent or estimated from building levels.",
            "adjacency_definition": "Centroids within 15 m, with a lower neighbouring recorded height.",
        },
    }
    if candidates:
        _MEMORY_BUILDING_CACHE[bbox_key] = {"cached_at": monotonic(), "result": deepcopy(result)}
        if len(_MEMORY_BUILDING_CACHE) > 32:
            _MEMORY_BUILDING_CACHE.pop(next(iter(_MEMORY_BUILDING_CACHE)), None)
    return result
