"""Road routing to reference shelters; flood clearance is never inferred."""
from concurrent.futures import ThreadPoolExecutor
import os
import time
import requests
from shelter_service import COASTAL_SHELTERS, _haversine_km

_CACHE: dict = {}


def road_routes(lat: float, lon: float) -> dict:
    key = (round(lat, 4), round(lon, 4))
    if key in _CACHE and time.monotonic() - _CACHE[key][0] < 300:
        return _CACHE[key][1]
    shelters = sorted(COASTAL_SHELTERS, key=lambda s: _haversine_km(lat, lon, s["lat"], s["lon"]))[:3]
    base = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")

    def route(shelter):
        if _haversine_km(lat, lon, shelter["lat"], shelter["lon"]) > 200:
            return None
        try:
            response = requests.get(f"{base}/route/v1/driving/{lon},{lat};{shelter['lon']},{shelter['lat']}",
                                    params={"overview": "simplified", "geometries": "geojson"}, timeout=(2, 5))
            response.raise_for_status()
            data = response.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                return None
            # Reject origins over water or distant from a routable road.
            if any(w.get("distance", float("inf")) > 2000 for w in data.get("waypoints", [])):
                return None
            item = data["routes"][0]
            return {"route_id": shelter["id"], "name": "Road route to " + shelter["name"],
                    "distance_km": round(item["distance"] / 1000, 2),
                    "travel_time_minutes": max(1, round(item["duration"] / 60)),
                    "flood_risk_level": "UNKNOWN", "passability": "UNVERIFIED: no live road closure or flood data",
                    "route_type": "Fastest", "trade_off_explanation": "OSRM road-network route from the selected coordinate. Shelter inventory is a reference; capacity, occupancy and flood clearance require local verification.",
                    "geometry": item["geometry"], "shelter_id": shelter["id"], "nominal_capacity": shelter["capacity"]}
        except (requests.RequestException, ValueError, KeyError, TypeError):
            return None

    with ThreadPoolExecutor(max_workers=3) as pool:
        routes = [r for r in pool.map(route, shelters) if r is not None]
    routes.sort(key=lambda r: r["travel_time_minutes"])
    result = {"status": "AVAILABLE" if routes else "UNAVAILABLE", "source": "OSRM_ROAD_NETWORK",
              "routes": routes, "notice": "Road travel estimates exclude storm closures and flooding. No route is certified safe. No shelter allocation has been made."}
    _CACHE[key] = (time.monotonic(), result)
    if len(_CACHE) > 64:
        _CACHE.pop(next(iter(_CACHE)))
    return result
