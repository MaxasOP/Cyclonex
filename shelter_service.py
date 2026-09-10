"""Multipurpose Cyclone Shelter (MPCS) Inventory & Evacuation Intelligence.

Provides coastal shelter assets, evacuation priority tiers, population-at-risk
estimation, and optimal shelter matching for CYCLONEX scenarios.
"""

from __future__ import annotations

import math
from typing import Any

# Representative inventory of official coastal multipurpose cyclone shelters (MPCS)
# across high-vulnerability coastal districts of the North Indian Ocean.
COASTAL_SHELTERS: list[dict[str, Any]] = [
    # West Bengal - East Medinipur & South 24 Parganas
    {
        "id": "mpcs-wb-digha-01",
        "name": "Digha Coastal Multipurpose Shelter-1",
        "lat": 21.628,
        "lon": 87.521,
        "capacity": 2500,
        "district": "Purba Medinipur",
        "state": "West Bengal",
        "facility_type": "RCC Stilted 3-Story Cyclone Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-wb-shankarpur-02",
        "name": "Shankarpur Fishing Harbour Shelter",
        "lat": 21.637,
        "lon": 87.568,
        "capacity": 1800,
        "district": "Purba Medinipur",
        "state": "West Bengal",
        "facility_type": "Elevated Community Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-wb-mandarmani-03",
        "name": "Mandarmani Coastal Community Shelter",
        "lat": 21.668,
        "lon": 87.712,
        "capacity": 2000,
        "district": "Purba Medinipur",
        "state": "West Bengal",
        "facility_type": "RCC Stilted 3-Story Cyclone Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-wb-sagar-04",
        "name": "Sagar Island Central Cyclone Shelter",
        "lat": 21.650,
        "lon": 88.080,
        "capacity": 3200,
        "district": "South 24 Parganas",
        "state": "West Bengal",
        "facility_type": "Fortified High-Capacity Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-wb-bakkhali-05",
        "name": "Bakkhali South Coast Shelter",
        "lat": 21.564,
        "lon": 88.257,
        "capacity": 1500,
        "district": "South 24 Parganas",
        "state": "West Bengal",
        "facility_type": "RCC Stilted Community Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    # Odisha - Balasore, Bhadrak, Kendrapara, Jagatsinghpur, Puri, Ganjam
    {
        "id": "mpcs-od-chandipur-01",
        "name": "Chandipur Defense-Adjacent MPCS",
        "lat": 21.469,
        "lon": 87.014,
        "capacity": 2200,
        "district": "Balasore",
        "state": "Odisha",
        "facility_type": "ODRRA Standard Cyclone Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-od-dhamra-02",
        "name": "Dhamra Port Coastal Cyclone Shelter",
        "lat": 20.803,
        "lon": 86.965,
        "capacity": 2800,
        "district": "Bhadrak",
        "state": "Odisha",
        "facility_type": "ODRRA Fortified Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-od-paradip-03",
        "name": "Paradip Port Central Cyclone Shelter",
        "lat": 20.298,
        "lon": 86.674,
        "capacity": 3500,
        "district": "Jagatsinghpur",
        "state": "Odisha",
        "facility_type": "Industrial Grade Multi-Purpose Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-od-puri-04",
        "name": "Puri Coastal Pilgrim & Fishery MPCS",
        "lat": 19.800,
        "lon": 85.819,
        "capacity": 3000,
        "district": "Puri",
        "state": "Odisha",
        "facility_type": "ODRRA Standard Cyclone Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-od-gopalpur-05",
        "name": "Gopalpur Port Sea-Front Shelter",
        "lat": 19.262,
        "lon": 84.899,
        "capacity": 2400,
        "district": "Ganjam",
        "state": "Odisha",
        "facility_type": "RCC Stilted 3-Story Cyclone Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    # Andhra Pradesh - Srikakulam, Visakhapatnam, Kakinada, Machilipatnam
    {
        "id": "mpcs-ap-bheemunipatnam-01",
        "name": "Bhimili Coastal Cyclone Shelter",
        "lat": 17.892,
        "lon": 83.454,
        "capacity": 2000,
        "district": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "facility_type": "APSDMA Cyclone Evacuation Center",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-ap-vizag-02",
        "name": "Visakhapatnam Harbour Marine Shelter",
        "lat": 17.686,
        "lon": 83.218,
        "capacity": 4000,
        "district": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "facility_type": "High-Capacity Urban Disaster Complex",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-ap-kakinada-03",
        "name": "Kakinada Hope Island Evacuation Hub",
        "lat": 16.989,
        "lon": 82.247,
        "capacity": 2600,
        "district": "Kakinada",
        "state": "Andhra Pradesh",
        "facility_type": "APSDMA Cyclone Evacuation Center",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-ap-machilipatnam-04",
        "name": "Machilipatnam Coastal Mangrove Shelter",
        "lat": 16.180,
        "lon": 81.139,
        "capacity": 2200,
        "district": "Krishna",
        "state": "Andhra Pradesh",
        "facility_type": "Elevated Community Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    # Arabian Sea Coast - Maharashtra & Gujarat
    {
        "id": "mpcs-mh-alibaug-01",
        "name": "Alibaug Coastal Disaster Shelter",
        "lat": 18.641,
        "lon": 72.872,
        "capacity": 2500,
        "district": "Raigad",
        "state": "Maharashtra",
        "facility_type": "Coastal Multi-Purpose Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-mh-murud-02",
        "name": "Murud Fishermen Cyclone Center",
        "lat": 18.326,
        "lon": 72.961,
        "capacity": 1600,
        "district": "Raigad",
        "state": "Maharashtra",
        "facility_type": "Elevated RCC Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-gj-veraval-01",
        "name": "Veraval Somnath Coastal MPCS",
        "lat": 20.900,
        "lon": 70.366,
        "capacity": 2800,
        "district": "Gir Somnath",
        "state": "Gujarat",
        "facility_type": "GSDMA Cyclone Evacuation Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-gj-porbandar-02",
        "name": "Porbandar Marine Cyclone Shelter",
        "lat": 21.642,
        "lon": 69.609,
        "capacity": 3200,
        "district": "Porbandar",
        "state": "Gujarat",
        "facility_type": "GSDMA Cyclone Evacuation Shelter",
        "backup_generator": True,
        "helipad": True,
    },
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def evaluate_evacuation_plan(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    risk_summary: dict[str, Any] | None = None,
    features: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Calculate proximity shelters, evacuation priority, and population at risk."""
    search_radius_km = max(radius_km * 1.8, 120.0)

    active_shelters: list[dict[str, Any]] = []
    for s in COASTAL_SHELTERS:
        dist = round(_haversine_km(center_lat, center_lon, s["lat"], s["lon"]), 1)
        if dist <= search_radius_km:
            shelter_copy = dict(s)
            shelter_copy["distance_km"] = dist
            if dist <= radius_km * 0.7:
                shelter_copy["evacuation_priority"] = "IMMEDIATE"
            elif dist <= radius_km * 1.2:
                shelter_copy["evacuation_priority"] = "ADVISORY"
            else:
                shelter_copy["evacuation_priority"] = "STANDBY"
            active_shelters.append(shelter_copy)

    # Sort nearest first
    active_shelters.sort(key=lambda s: s["distance_km"])

    # If no real shelter is within radius (e.g. custom open ocean point), generate the closest regional hub
    if not active_shelters:
        closest = min(
            COASTAL_SHELTERS,
            key=lambda s: _haversine_km(center_lat, center_lon, s["lat"], s["lon"]),
        )
        dist = round(_haversine_km(center_lat, center_lon, closest["lat"], closest["lon"]), 1)
        copy_c = dict(closest)
        copy_c["distance_km"] = dist
        copy_c["evacuation_priority"] = "STANDBY"
        active_shelters.append(copy_c)

    total_capacity = sum(s["capacity"] for s in active_shelters)

    # Estimate population at risk from features
    severe_count = risk_summary.get("severe_cells", 0) if risk_summary else 0
    moderate_count = risk_summary.get("moderate_cells", 0) if risk_summary else 0

    # Assume average Indian coastal cell density: ~25 persons/cell in severe zones, ~10 in moderate
    est_pop_severe = severe_count * 35
    est_pop_moderate = moderate_count * 12
    total_pop_at_risk = est_pop_severe + est_pop_moderate

    # Generate ward-level priority sectors
    ward_priorities = []
    directions = [
        ("NW Sector (Primary Landfall Surge Front)", 315, 0.4, "#d4483b", "MANDATORY EVACUATION: Surge & violent wind loading risk"),
        ("NE Sector (Right-of-Track Wind Peak)", 45, 0.5, "#d4483b", "MANDATORY EVACUATION: Maximum dynamic pressure zone"),
        ("SW Sector (Trailing Rainfall Band)", 225, 0.35, "#ed8a28", "PRECAUTIONARY RELOCATION: Severe waterlogging expected"),
        ("SE Sector (Peripheral Gale Zone)", 135, 0.6, "#35a66f", "SHELTER IN PLACE: Reinforce non-structural elements"),
    ]

    for name, angle_deg, dist_ratio, color, action in directions:
        rad = math.radians((90 - angle_deg) % 360)
        dist_km = radius_km * dist_ratio
        w_lat = round(center_lat + (dist_km * math.sin(rad)) / 111.0, 4)
        cos_lat = max(0.2, math.cos(math.radians(center_lat)))
        w_lon = round(center_lon + (dist_km * math.cos(rad)) / (111.0 * cos_lat), 4)

        nearest_s = active_shelters[0]["name"] if active_shelters else "Regional MPCS Hub"
        nearest_d = active_shelters[0]["distance_km"] if active_shelters else 0.0

        ward_priorities.append(
            {
                "ward_id": f"sector-{angle_deg}",
                "name": name,
                "lat": w_lat,
                "lon": w_lon,
                "risk_level": "CRITICAL" if color == "#d4483b" else ("MODERATE" if color == "#ed8a28" else "SAFE"),
                "color": color,
                "action": action,
                "nearest_shelter": nearest_s,
                "distance_km": nearest_d,
            }
        )

    return {
        "total_shelters_active": len(active_shelters),
        "total_capacity": total_capacity,
        "estimated_population_at_risk": total_pop_at_risk,
        "immediate_evacuation_count": est_pop_severe,
        "shelters": active_shelters,
        "ward_priorities": ward_priorities,
    }
