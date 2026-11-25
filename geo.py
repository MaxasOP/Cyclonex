"""Spherical geometry and a local coastline reference for scenario screening."""
from functools import lru_cache
import gzip
import math
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Point

EARTH_RADIUS_KM = 6371.0088
LAND_SOURCE = "Natural Earth 1:50m land polygons (generalized coastline)"
# Source: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_land.geojson


def destination(lat: float, lon: float, heading_deg: float, distance_km: float) -> tuple[float, float]:
    phi, lam, bearing = map(math.radians, (lat, lon, heading_deg))
    arc = distance_km / EARTH_RADIUS_KM
    # Resolve the final position in the start point's radial, east and north basis.
    horizontal = math.cos(phi) * math.cos(arc) - math.sin(phi) * math.sin(arc) * math.cos(bearing)
    east = math.sin(arc) * math.sin(bearing)
    vertical = math.sin(phi) * math.cos(arc) + math.cos(phi) * math.sin(arc) * math.cos(bearing)
    new_lat = math.degrees(math.atan2(vertical, math.hypot(horizontal, east)))
    new_lon = math.degrees(lam + math.atan2(east, horizontal))
    return new_lat, (new_lon + 180.0) % 360.0 - 180.0


def projected_landfall(lat: float, lon: float, heading: float, speed_kmh: float, hours: int = 48):
    """First sampled sea-to-land crossing of a constant-motion path over a generalized coast."""
    if speed_kmh <= 0:
        return None
    steps = max(1, math.ceil(speed_kmh * hours / 5))
    positions = [destination(lat, lon, heading, speed_kmh * hours * i / steps) for i in range(steps + 1)]
    mask = land_mask(*zip(*positions))
    if mask[0] or not mask.any():
        return None
    index = int(np.argmax(mask))
    lower, upper = hours * (index - 1) / steps, hours * index / steps
    for _ in range(10):
        mid = (lower + upper) / 2
        cross_lat, cross_lon = destination(lat, lon, heading, speed_kmh * mid)
        if land_mask(cross_lat, cross_lon):
            upper = mid
        else:
            lower = mid
    cross_lat, cross_lon = destination(lat, lon, heading, speed_kmh * upper)
    return {"eta_hours": round(upper, 2), "lat": round(cross_lat, 4), "lon": round(cross_lon, 4),
            "location_name": "Projected crossing of generalized coastline",
            "confidence_interval": "Uncalibrated constant-motion scenario"}


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = map(math.radians, (lat1, lat2))
    a = math.sin((phi2 - phi1) / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(max(0.0, min(a, 1.0))))


@lru_cache(maxsize=1)
def _land_reference():
    path = Path(__file__).parent / "config" / "ne_50m_land.geojson.gz"
    with gzip.open(path, "rt", encoding="utf-8") as source:
        land = shapely.from_geojson(source.read())
    polygons = shapely.get_parts(land)
    shapely.prepare(polygons)
    return shapely.STRtree(polygons)


def land_mask(lat, lon):
    """Classify one or many coordinate pairs against the same global land polygons."""
    latitudes, longitudes = np.broadcast_arrays(lat, lon)
    points = shapely.points(longitudes.ravel(), latitudes.ravel())
    result = np.zeros(points.size, dtype=bool)
    indices, _ = _land_reference().query(points, predicate="intersects")
    result[indices] = True
    return result.reshape(latitudes.shape)


def is_land(lat: float, lon: float) -> bool:
    return bool(land_mask(lat, lon))


def coast_distance_within(lat: float, lon: float, limit_km: float) -> float | None:
    """Approximate local point-to-shore distance, returning None outside the search radius.

    Projects candidate coastline segments into the local tangent plane before
    measuring their distance, sufficient for short regional screening thresholds.
    """
    lat_span = math.degrees(limit_km / EARTH_RADIUS_KM)
    lon_scale = max(1e-8, math.cos(math.radians(lat)))
    lon_span = min(180.0, lat_span / max(1e-8, math.cos(math.radians(min(90, abs(lat) + lat_span)))))
    tree = _land_reference()
    min_dist = float("inf")
    for offset in (-360, 0, 360):
        center = lon + offset
        bbox = shapely.box(center - lon_span, lat - lat_span, center + lon_span, lat + lat_span)
        for idx in tree.query(bbox):
            boundary = tree.geometries[idx].boundary.intersection(bbox)
            if boundary.is_empty:
                continue
            local = shapely.transform(boundary, lambda xy: (xy - [center, lat]) * [lon_scale, 1.0])
            min_dist = min(min_dist, math.radians(local.distance(Point(0, 0))) * EARTH_RADIUS_KM)
    return min_dist if min_dist <= limit_km else None
