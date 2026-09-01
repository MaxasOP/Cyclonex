"""OpenStreetMap building-footprint adapter.

The public Overpass endpoint is deliberately called only on demand. Results
remain source-labelled estimates when OSM has no recorded building height.
"""

from __future__ import annotations

import math
from typing import Any

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_TIMEOUT = (3, 20)


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


def fetch_buildings(south: float, west: float, north: float, east: float) -> dict[str, Any]:
    query = f"[out:json][timeout:18];way[building]({south},{west},{north},{east});out tags geom;"
    response = requests.post(
        OVERPASS_URL,
        data={"data": query},
        headers={"User-Agent": "CYCLONEX/2.0 educational-risk-map"},
        timeout=OVERPASS_TIMEOUT,
    )
    response.raise_for_status()
    raw = response.json()
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
                "ring": ring,
                "centroid": _centroid(ring[:-1]),
                "height_m": height_m,
                "height_source": height_source,
            }
        )

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
                    "height_m": height,
                    "height_source": building["height_source"],
                    "is_locally_taller": higher_than_neighbour,
                    "base_colour": "#0a2a57",
                    "adjacent_taller_highlight": "#ffffff" if higher_than_neighbour else None,
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "OpenStreetMap via Overpass API",
            "height_notice": "Height may be absent or estimated from building levels.",
            "adjacency_definition": "Centroids within 15 m, with a lower neighbouring recorded height.",
        },
    }
