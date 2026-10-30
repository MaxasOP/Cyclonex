"""Spherical advection shared by scenario forecast adapters."""
import math


def destination(lat: float, lon: float, heading_deg: float, distance_km: float) -> tuple[float, float]:
    phi, lam, bearing = map(math.radians, (lat, lon, heading_deg))
    arc = distance_km / 6371.0088
    new_phi = math.asin(max(-1.0, min(1.0, math.sin(phi) * math.cos(arc) + math.cos(phi) * math.sin(arc) * math.cos(bearing))))
    new_lam = lam + math.atan2(math.sin(bearing) * math.sin(arc) * math.cos(phi), math.cos(arc) - math.sin(phi) * math.sin(new_phi))
    return math.degrees(new_phi), (math.degrees(new_lam) + 180.0) % 360.0 - 180.0
