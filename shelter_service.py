"""Multipurpose Cyclone Shelter (MPCS) Inventory & Evacuation Intelligence.

Provides coastal shelter assets, evacuation priority tiers, population-at-risk
estimation, and optimal shelter matching for CYCLONEX scenarios.
"""

from __future__ import annotations

from geo import distance_km as _haversine_km
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
        "id": "mpcs-mh-shrivardhan-03",
        "name": "Shrivardhan Coastal High School Evacuation Shelter",
        "lat": 18.045,
        "lon": 73.015,
        "capacity": 1800,
        "district": "Raigad",
        "state": "Maharashtra",
        "facility_type": "High School Fortified Cyclone Refuge",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-mh-ratnagiri-04",
        "name": "Ratnagiri Mirya Bay Cyclone Safe Haven",
        "lat": 17.012,
        "lon": 73.285,
        "capacity": 2200,
        "district": "Ratnagiri",
        "state": "Maharashtra",
        "facility_type": "Coastal Multi-Purpose Shelter",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-mh-palghar-05",
        "name": "Dahanu-Palghar North Coast MPCS",
        "lat": 19.980,
        "lon": 72.730,
        "capacity": 2000,
        "district": "Palghar",
        "state": "Maharashtra",
        "facility_type": "Elevated Marine Community Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-mh-mumbai-06",
        "name": "Colaba-Worli Marine Disaster Center",
        "lat": 18.922,
        "lon": 72.834,
        "capacity": 5000,
        "district": "Mumbai City",
        "state": "Maharashtra",
        "facility_type": "Metropolitan Disaster Relief Complex",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-gj-dwarka-03",
        "name": "Dwarka Okha Marine Safety Citadel",
        "lat": 22.240,
        "lon": 68.968,
        "capacity": 2600,
        "district": "Devbhumi Dwarka",
        "state": "Gujarat",
        "facility_type": "GSDMA Coastal Disaster Citadel",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-gj-mandvi-04",
        "name": "Mandvi Gulf of Kutch Evacuation Hub",
        "lat": 22.825,
        "lon": 69.355,
        "capacity": 2400,
        "district": "Kutch",
        "state": "Gujarat",
        "facility_type": "Elevated Cyclone Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-gj-jakhau-05",
        "name": "Jakhau Port Strategic Border Cyclone Shelter",
        "lat": 23.238,
        "lon": 68.625,
        "capacity": 3000,
        "district": "Kutch",
        "state": "Gujarat",
        "facility_type": "Fortified Border Area MPCS",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-gj-surat-06",
        "name": "Hazira Port Industrial Safety Haven",
        "lat": 21.115,
        "lon": 72.645,
        "capacity": 3500,
        "district": "Surat",
        "state": "Gujarat",
        "facility_type": "High-Capacity Industrial Evacuation Center",
        "backup_generator": True,
        "helipad": True,
    },
    # Tamil Nadu Coast
    {
        "id": "mpcs-tn-chennai-01",
        "name": "Chennai Marina Coastal Haven (MPCS-TN01)",
        "lat": 13.055,
        "lon": 80.285,
        "capacity": 4500,
        "district": "Chennai",
        "state": "Tamil Nadu",
        "facility_type": "Urban Disaster Relief Hub",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-tn-cuddalore-02",
        "name": "Cuddalore Old Town Cyclone Shelter",
        "lat": 11.748,
        "lon": 79.775,
        "capacity": 2800,
        "district": "Cuddalore",
        "state": "Tamil Nadu",
        "facility_type": "TNSDMA Multipurpose Cyclone Shelter",
        "backup_generator": True,
        "helipad": False,
    },
    {
        "id": "mpcs-tn-nagapattinam-03",
        "name": "Nagapattinam Harbor Marine Citadel",
        "lat": 10.765,
        "lon": 79.845,
        "capacity": 3800,
        "district": "Nagapattinam",
        "state": "Tamil Nadu",
        "facility_type": "Fortified Tsunami & Cyclone Complex",
        "backup_generator": True,
        "helipad": True,
    },
    {
        "id": "mpcs-tn-rameswaram-04",
        "name": "Rameswaram Island Relief Safehouse",
        "lat": 9.288,
        "lon": 79.312,
        "capacity": 2200,
        "district": "Ramanathapuram",
        "state": "Tamil Nadu",
        "facility_type": "Island Disaster Refuge Hub",
        "backup_generator": True,
        "helipad": False,
    },
]


def evaluate_evacuation_plan(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    risk_summary: dict[str, Any] | None = None,
    features: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return reference locations and modeled hotspots within the scenario region."""
    search_radius_km = min(200.0, max(radius_km * 1.8, 120.0))
    nearby = []
    for shelter in COASTAL_SHELTERS:
        distance = _haversine_km(center_lat, center_lon, shelter["lat"], shelter["lon"])
        if distance <= search_radius_km:
            nearby.append({**shelter, "distance_km": round(distance, 1), "status": "REFERENCE_UNVERIFIED"})
    nearby.sort(key=lambda item: item["distance_km"])

    # Pick the highest-scoring mapped land cell in each quadrant. These are
    # screening sectors, not administrative wards or evacuation orders.
    hotspots = {}
    for feature in features or []:
        props = feature.get("properties", {})
        if props.get("land_type") == "OCEAN" or props.get("classification") not in {"MODERATE_DAMAGE", "TOTAL_DESTRUCTION_RISK"}:
            continue
        if props.get("lat") is None or props.get("lon") is None:
            continue
        direction = ("N" if props["lat"] >= center_lat else "S") + ("E" if (props["lon"] - center_lon + 180) % 360 - 180 >= 0 else "W")
        if direction not in hotspots or props["damage_score"] > hotspots[direction]["damage_score"]:
            hotspots[direction] = props

    priorities = []
    for direction, props in sorted(hotspots.items()):
        lat, lon = props["lat"], props["lon"]
        nearest = min(nearby, key=lambda s: _haversine_km(lat, lon, s["lat"], s["lon"]), default=None)
        priorities.append({
            "ward_id": f"sector-{direction}", "name": f"{direction} modeled hotspot", "lat": lat, "lon": lon,
            "risk_level": "HIGH" if props["classification"] == "TOTAL_DESTRUCTION_RISK" else "MODERATE",
            "color": props.get("colour"), "action": "Review the modeled impact with local authorities.",
            "nearest_shelter": nearest["name"] if nearest else None,
            "distance_km": round(_haversine_km(lat, lon, nearest["lat"], nearest["lon"]), 1) if nearest else None,
        })
    return {
        "total_shelters_active": len(nearby), "total_capacity": sum(s["capacity"] for s in nearby),
        "estimated_population_at_risk": None, "immediate_evacuation_count": None,
        "shelters": nearby, "ward_priorities": priorities, "search_radius_km": search_radius_km,
        "source": "REFERENCE_INVENTORY", "notice": "Counts and nominal capacity refer to listed sites. Opening status, occupancy and at-risk population are unknown.",
    }
