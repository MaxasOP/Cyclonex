"""Deterministic, explainable spatial CYCLONE DAMAGE & LAND IMPACT SCREENING ENGINE for CYCLONEX v2.1.

This is a scenario hazard-screening model, not an engineering damage certification.
Every output clearly distinguishes OBSERVED, INFERRED, and MODELED data provenance.

Physics upgrades (v2.1):
- Holland-Rankine combined vortex wind profile (replaces broken exponential)
- Geographic land/ocean classifier for North Indian Ocean (replaces distance heuristic)
- IS-875 Part 3 calibrated structural resistance values for Indian coastal construction
- Right-of-track asymmetry from storm translation speed
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator
from config import settings


class ScenarioInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    center_lat: float = Field(ge=-90, le=90)
    center_lon: float = Field(ge=-180, le=180)
    max_wind_kph: float = Field(ge=0, le=400)
    central_pressure_hpa: float = Field(ge=800, le=1050)
    heading_deg: float = Field(default=315.0, ge=0, le=360)
    speed_kph: float = Field(default=25.0, ge=0, le=120)
    rain_rate_mm_hr: float = Field(default=0, ge=0, le=500)
    storm_surge_m: float = Field(default=0, ge=0, le=20)
    field_radius_km: float = Field(default=25.0, ge=0.2, le=500.0)
    coastal_exposure_factor: float = Field(default=0.7, ge=0, le=1)
    assumed_vulnerability_score: float = Field(default=0.8, ge=0, le=1)
    include_ocean_node: bool = True

    @field_validator("center_lat", "center_lon")
    @classmethod
    def finite_coordinate(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("Coordinates must be finite values.")
        return value


RISK_BANDS = (
    (0.10, "NO_DAMAGE", "#75c9f1", "🩵 Sky Blue — No modelled damage"),
    (0.25, "SAFE", "#35a66f", "🟢 Green — Safe / low impact"),
    (0.55, "MODERATE_DAMAGE", "#ed8a28", "🟠 Orange — Damage occurrence likely"),
    (float("inf"), "TOTAL_DESTRUCTION_RISK", "#d4483b", "🔴 Red — Severe / total destruction risk"),
)


# ---------------------------------------------------------------------------
# Geographic land/ocean classifier for North Indian Ocean
# ---------------------------------------------------------------------------
# Bounding boxes: (lon_west, lat_south, lon_east, lat_north)
# These classify cells without needing a GIS shapefile dependency.

_INDIA_LAND_BOXES: list[tuple[float, float, float, float]] = [
    (68.0,  6.0,  97.5, 37.0),   # Mainland India
    (79.5,  5.8,  82.0,  9.9),   # Sri Lanka
    (88.0, 20.5,  92.7, 26.6),   # Bangladesh
    (92.0, 15.5,  98.5, 28.0),   # Myanmar coast
    (92.0,  6.0,  94.5, 14.0),   # Andaman & Nicobar
    (71.5,  8.0,  74.0, 12.5),   # Lakshadweep
]

_OCEAN_BOXES: list[tuple[float, float, float, float]] = [
    (55.0,  5.0,  72.0, 25.0),   # Arabian Sea core
    (82.0,  5.0,  95.0, 17.0),   # Bay of Bengal core
    (43.0, 10.0,  55.0, 15.0),   # Gulf of Aden
]


def _is_land(lat: float, lon: float) -> bool:
    """Return True if (lat, lon) is over land using spatial coastline boundary geometry."""
    # 1. Bay of Bengal East Coast coastline boundary (lon 80°E to 92°E)
    if 80.0 <= lon <= 92.0:
        if lon < 85.0:
            coast_lat = 13.0 + (lon - 80.0) * (19.8 - 13.0) / 5.0
        elif lon <= 87.5:
            coast_lat = 19.8 + (lon - 85.0) * (21.6 - 19.8) / 2.5
        else:
            coast_lat = 21.6 + (lon - 87.5) * 0.05
        if lat < coast_lat:
            return False  # South of coastline -> Marine Ocean

    # 2. Arabian Sea West Coast coastline boundary (lon 68°E to 77.5°E)
    if 68.0 <= lon <= 77.5:
        coast_lon = 77.5 - (lat - 8.0) * 0.6
        if lon < coast_lon and lat < 23.0:
            return False  # West of coastline -> Marine Ocean

    # 3. Ocean override boxes
    for (w, s, e, n) in _OCEAN_BOXES:
        if w <= lon <= e and s <= lat <= n:
            return False

    # 4. Land bounding boxes
    for (w, s, e, n) in _INDIA_LAND_BOXES:
        if w <= lon <= e and s <= lat <= n:
            return True

    return False


# ---------------------------------------------------------------------------
# Holland-Rankine combined vortex wind model
# ---------------------------------------------------------------------------
def _rankine_wind_kph(
    distance_m: float,
    rmw_m: float,
    max_wind_kph: float,
    holland_b: float = 0.9,
) -> float:
    """Holland-Rankine vortex: linear inside RMW, Holland exponential outside.

    Inside RMW: wind increases linearly from calm eye to max at RMW.
    Outside RMW: V = Vmax * exp((B/e) * (1 - (r/rmw)^B))
    Bay of Bengal: Holland B ≈ 0.8–1.2 depending on intensity.
    """
    if distance_m <= 0:
        return 0.0  # Calm at eye centre
    if distance_m <= rmw_m:
        return max_wind_kph * (distance_m / rmw_m)
    else:
        return max_wind_kph * math.exp(
            (holland_b / math.e) * (1.0 - (distance_m / rmw_m) ** holland_b)
        )


def local_metric_transforms(lon: float, lat: float):
    """Return a local tangent-plane transform centred on the scenario.

    Scenarios are capped at 50 km radius, where this metric transform keeps
    200 m cells stable without requiring native GIS dependencies.
    """
    earth_radius_m = 6_371_008.8
    cos_lat = math.cos(math.radians(lat))

    def forward(point_lon: float, point_lat: float) -> tuple[float, float]:
        return (
            earth_radius_m * math.radians(point_lon - lon) * cos_lat,
            earth_radius_m * math.radians(point_lat - lat),
        )

    def inverse(x: float, y: float) -> tuple[float, float]:
        return (
            lon + math.degrees(x / (earth_radius_m * cos_lat)),
            lat + math.degrees(y / earth_radius_m),
        )

    return forward, inverse


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(value, high))


def classify_risk(score: float) -> tuple[str, str, str]:
    for threshold, label, colour, description in RISK_BANDS:
        if score < threshold:
            return label, colour, description
    raise AssertionError("Risk bands must cover all scores")


def evaluate_cell_full(
    x_m: float,
    y_m: float,
    cell_lon: float,
    cell_lat: float,
    scenario: ScenarioInput,
    buildings_in_cell: list[dict] | None = None,
    upwind_max_height_m: float = 0.0,
) -> dict[str, Any]:
    radius_m = scenario.field_radius_km * 1000.0
    rmw_m = radius_m * 0.18

    distance_m = math.hypot(x_m, y_m)

    # Bearing from storm eye to cell (0=N, 90=E, 180=S, 270=W)
    bearing_rad = math.atan2(x_m, y_m)
    bearing_deg = math.degrees(bearing_rad) % 360.0

    # Relative angle between storm heading and cell bearing
    heading = scenario.heading_deg % 360.0
    rel_angle_deg = (bearing_deg - heading) % 360.0

    # Tangential cyclonic wind direction (Northern Hemisphere: counter-clockwise)
    wind_direction_deg = (bearing_deg + 90.0) % 360.0

    # -----------------------------------------------------------------------
    # Holland-Rankine vortex wind + right-of-track translation asymmetry
    # -----------------------------------------------------------------------
    vmax = scenario.max_wind_kph
    intensity_ratio = clamp((vmax - 60.0) / 180.0)
    holland_b = 0.8 + 0.4 * intensity_ratio

    v_rankine = _rankine_wind_kph(distance_m, rmw_m, vmax, holland_b)

    # Right-of-track asymmetry: add storm speed on right
    right_factor = math.cos(math.radians(rel_angle_deg))
    asym_kph = scenario.speed_kph * 0.5 * max(-0.5, right_factor)
    wind_kph = round(max(0.0, v_rankine + asym_kph), 1)
    wind_ms = round(wind_kph / 3.6, 2)

    # Dynamic pressure q = 0.5 * rho * V^2 (rho = 1.225 kg/m^3)
    rho = 1.225
    dynamic_pressure_pa = round(0.5 * rho * (wind_ms ** 2), 1)

    # Drag coefficient Cd = 1.3 (IS-875 Part 3 screening value)
    cd = 1.3
    modeled_wind_loading_n_m2 = round(dynamic_pressure_pa * cd, 1)

    # -----------------------------------------------------------------------
    # Geographic land/ocean classification
    # -----------------------------------------------------------------------
    building_count = len(buildings_in_cell) if buildings_in_cell else 0
    building_area_m2 = sum(b.get("area_m2", 100.0) for b in (buildings_in_cell or []))
    building_density = min(1.0, round(building_area_m2 / 40000.0, 3))

    building_heights = [
        b.get("height_m") for b in (buildings_in_cell or []) if b.get("height_m") is not None
    ]
    avg_building_height_m = (
        round(sum(building_heights) / len(building_heights), 1) if building_heights else 0.0
    )
    max_building_height_m = max(building_heights) if building_heights else 0.0
    taller_bldg_count = sum(
        1 for b in (buildings_in_cell or []) if b.get("is_locally_taller", False)
    )

    cell_is_land = _is_land(cell_lat, cell_lon)

    if building_count > 0:
        land_type = "RESIDENTIAL_URBAN" if building_count > 10 else "URBAN_COASTAL"
    elif cell_is_land:
        if distance_m < rmw_m * 1.5:
            land_type = "COASTAL_ZONE"
        else:
            land_type = "INLAND_RURAL"
    else:
        land_type = "OCEAN"

    # -----------------------------------------------------------------------
    # Upwind obstacle sheltering factor
    # -----------------------------------------------------------------------
    if upwind_max_height_m > max_building_height_m and upwind_max_height_m > 5.0:
        obstruction_level = "HIGH"
        shelter_factor = 0.85
    elif upwind_max_height_m > 3.0:
        obstruction_level = "MODERATE"
        shelter_factor = 0.92
    else:
        obstruction_level = "LOW_OPEN"
        shelter_factor = 1.0

    effective_wind_loading_n_m2 = round(modeled_wind_loading_n_m2 * shelter_factor, 1)

    # -----------------------------------------------------------------------
    # Structural Resistance — IS-875 Part 3 screening values for Indian coastal zones
    # PROVENANCE: ASSUMED_SCREENING_VALUE — not experimentally validated collapse limits
    # -----------------------------------------------------------------------
    if building_count == 0:
        if land_type == "OCEAN":
            est_resistance_pa = 150.0
        else:
            est_resistance_pa = 300.0
        estimated_struct_class = "OPEN_LAND_INFERRED"
        vulnerability_score = round(scenario.assumed_vulnerability_score * 0.5, 2)
    elif max_building_height_m > 12.0:
        est_resistance_pa = 1500.0
        estimated_struct_class = "RCC_CONCRETE"
        vulnerability_score = min(
            1.0,
            round(
                scenario.assumed_vulnerability_score
                * (1.0 + (taller_bldg_count / max(1, building_count)) * 0.3),
                2,
            ),
        )
    else:
        est_resistance_pa = 900.0
        estimated_struct_class = "MASONRY_RESIDENTIAL"
        vulnerability_score = min(
            1.0,
            round(
                scenario.assumed_vulnerability_score
                * (1.0 + (taller_bldg_count / max(1, building_count)) * 0.5),
                2,
            ),
        )

    # Material provenance: OSM buildings provide footprint geometry (OBSERVED),
    # but material, height and structural class are INFERRED from heuristics.
    # Never silently claim observed structural properties when unavailable.
    if building_count > 0:
        material_provenance = "INFERRED"
        height_provenance = "INFERRED" if building_heights else "UNKNOWN"
    else:
        material_provenance = "UNKNOWN"
        height_provenance = "UNKNOWN"

    # -----------------------------------------------------------------------
    # LRR — CORRECTED FORMULA: LRR = effective_wind_loading / structural_resistance
    #
    # Previous bug: used dynamic_pressure_pa / resistance (missing Cd and shelter_factor)
    # Correct physics: effective_wind_loading = q * Cd * shelter_factor
    #                  LRR = effective_wind_loading / resistance
    # The corrected LRR is ~Cd=1.3x larger than the old formula.
    # -----------------------------------------------------------------------
    lrr = round(effective_wind_loading_n_m2 / max(est_resistance_pa, 1.0), 3)

    # -----------------------------------------------------------------------
    # Hazard Score (weighted composite)
    # -----------------------------------------------------------------------
    pressure_deficit_hpa = max(0.0, 1010.0 - scenario.central_pressure_hpa)
    wind_score = clamp((wind_kph - 40.0) / 220.0)
    surge_score = clamp(scenario.storm_surge_m / 6.0)
    rain_score = clamp(scenario.rain_rate_mm_hr / 150.0)
    pressure_score = clamp(pressure_deficit_hpa / 120.0)

    hazard_score = clamp(
        0.60 * wind_score
        + 0.20 * surge_score
        + 0.10 * rain_score
        + 0.10 * pressure_score
    )

    exposure_score = clamp(0.35 * scenario.coastal_exposure_factor + 0.65 * building_density)
    structural_response_score = clamp(lrr / 1.5)

    # -----------------------------------------------------------------------
    # Official CYCLONEX Damage Formula — CYCLONEX_DAMAGE_V2 Additive HEV Model
    #
    # D = w_H * H  +  w_S * S_resp  +  w_E * E  +  w_V * V
    #
    # Variables:
    #   H      = hazard_score       (wind 60% + surge 20% + rain 10% + pressure 10%)
    #   S_resp = structural_response_score  (LRR / 1.5, capped at 1.0)
    #   E      = exposure_score     (0.35 * coastal_factor + 0.65 * building_density)
    #   V      = vulnerability_score (structural class heuristic)
    #
    # Weights (land):        Weights (coastal/rural):
    #   w_H = 0.45              w_H = 0.50
    #   w_S = 0.30              w_S = 0.35
    #   w_E = 0.15              w_E = 0.10
    #   w_V = 0.10              w_V = 0.05
    #
    # Ocean: D = H * 0.10 (no structural exposure)
    #
    # LIMITATION: Weights are expert screening assumptions.
    # NOT calibrated against post-event damage ground truth.
    # Result is a MODELLED DAMAGE RISK INDEX, not destruction probability.
    # -----------------------------------------------------------------------
    if land_type == "OCEAN":
        damage_score = round(clamp(hazard_score * 0.10), 4)
    elif land_type in ("COASTAL_ZONE", "INLAND_RURAL"):
        damage_score = round(
            clamp(
                0.50 * hazard_score
                + 0.35 * structural_response_score
                + 0.10 * exposure_score
                + 0.05 * vulnerability_score
            ),
            4,
        )
    else:
        damage_score = round(
            clamp(
                0.45 * hazard_score
                + 0.30 * structural_response_score
                + 0.15 * exposure_score
                + 0.10 * vulnerability_score
            ),
            4,
        )

    classification, colour, description = classify_risk(damage_score)

    # -----------------------------------------------------------------------
    # Primary driver — calculated from ACTUAL formula term contributions
    # Driver = which weighted term contributes the most to the final damage score
    # -----------------------------------------------------------------------
    if land_type == "OCEAN":
        weighted_terms = [
            ("HIGH_WIND_HAZARD", 1.00 * hazard_score),
        ]
    elif land_type in ("COASTAL_ZONE", "INLAND_RURAL"):
        weighted_terms = [
            ("HIGH_WIND_HAZARD",         0.50 * hazard_score),
            ("STRUCTURAL_RESPONSE_LRR",  0.35 * structural_response_score),
            ("BUILDING_EXPOSURE",        0.10 * exposure_score),
            ("STRUCTURAL_VULNERABILITY", 0.05 * vulnerability_score),
        ]
    else:
        weighted_terms = [
            ("HIGH_WIND_HAZARD",         0.45 * hazard_score),
            ("STRUCTURAL_RESPONSE_LRR",  0.30 * structural_response_score),
            ("BUILDING_EXPOSURE",        0.15 * exposure_score),
            ("STRUCTURAL_VULNERABILITY", 0.10 * vulnerability_score),
        ]

    weighted_terms.sort(key=lambda item: item[1], reverse=True)
    primary_driver = weighted_terms[0][0]
    secondary_driver = weighted_terms[1][0] if len(weighted_terms) > 1 else "N/A"

    return {
        "cell_id": f"cell-{int(x_m)}-{int(y_m)}",
        "lat": round(cell_lat, 5),
        "lon": round(cell_lon, 5),
        "cyclone_heading_deg": round(heading, 1),
        "relative_direction_deg": round(rel_angle_deg, 1),
        "land_type": land_type,
        "hazard": {
            "wind_kph": wind_kph,
            "wind_ms": wind_ms,
            "wind_direction_deg": round(wind_direction_deg, 1),
            "distance_to_eye_m": round(distance_m, 1),
            "bearing_from_eye_deg": round(bearing_deg, 1),
            "cyclone_heading_deg": round(heading, 1),
            "relative_direction_deg": round(rel_angle_deg, 1),
            "rmw_m": round(rmw_m, 1),
            "pressure_hpa": scenario.central_pressure_hpa,
            "pressure_deficit_hpa": round(pressure_deficit_hpa, 1),
            "rain_rate_mm_hr": scenario.rain_rate_mm_hr,
            "storm_surge_m": scenario.storm_surge_m,
            "hazard_score": round(hazard_score, 4),
        },
        "wind_force": {
            "dynamic_pressure_pa": dynamic_pressure_pa,
            "drag_coefficient": cd,
            "shelter_factor": shelter_factor,
            "modeled_wind_loading_n_m2": modeled_wind_loading_n_m2,
            "effective_wind_loading_n_m2": effective_wind_loading_n_m2,
        },
        "exposure": {
            "building_count": building_count,
            "building_density": building_density,
            "avg_building_height_m": avg_building_height_m,
            "max_building_height_m": max_building_height_m,
            "taller_building_count": taller_bldg_count,
            "exposure_score": round(exposure_score, 4),
        },
        "obstacles": {
            "avg_upwind_height_m": round(upwind_max_height_m * 0.7, 1),
            "max_upwind_height_m": upwind_max_height_m,
            "obstruction_level": obstruction_level,
            "shelter_factor": shelter_factor,
        },
        "structure": {
            "estimated_class": estimated_struct_class,
            "vulnerability_score": vulnerability_score,
            "estimated_resistance_pa": est_resistance_pa,
            "load_to_resistance_ratio": lrr,
            "data_provenance": {
                "building_footprint": "OBSERVED (OSM)" if building_count > 0 else "NOT_AVAILABLE",
                "material": material_provenance,
                "height": height_provenance,
                "resistance_pa": "ASSUMED_SCREENING_VALUE",
                "structural_class": "INFERRED",
                "modeled": ["local_wind_field", "dynamic_pressure", "effective_wind_loading", "damage_score"],
                "note": (
                    "Structural resistance values (300/900/1500 Pa) are IS-875 Part 3 screening "
                    "assumptions. They are NOT experimentally validated collapse limits."
                ),
            },
        },
        "damage": {
            "formula": "CYCLONEX_DAMAGE_V2_ADDITIVE: D = w_H*H + w_S*S_resp + w_E*E + w_V*V",
            "formula_note": "SCREENING_MODEL — not calibrated against post-event damage ground truth",
            "hazard_score": round(hazard_score, 4),
            "exposure_score": round(exposure_score, 4),
            "vulnerability_score": vulnerability_score,
            "structural_response_score": round(structural_response_score, 4),
            "damage_score": damage_score,
            "classification": classification,
            "colour": colour,
            "description": description,
        },
        "drivers": {
            "primary": primary_driver,
            "secondary": secondary_driver,
            "term_contributions": {t[0]: round(t[1], 4) for t in weighted_terms},
        },
    }



def create_risk_grid(scenario: ScenarioInput) -> dict[str, Any]:
    forward, inverse = local_metric_transforms(scenario.center_lon, scenario.center_lat)
    center_x, center_y = forward(scenario.center_lon, scenario.center_lat)
    radius_m = scenario.field_radius_km * 1000.0
    base_grid = settings.grid_size_m
    if radius_m > 25_000.0:
        calculated_step = int((radius_m / 25_000.0) * base_grid)
        grid = max(base_grid, (calculated_step // 50) * 50)
    else:
        grid = base_grid
    start_x = math.floor((center_x - radius_m) / grid) * grid
    start_y = math.floor((center_y - radius_m) / grid) * grid
    end_x = math.ceil((center_x + radius_m) / grid) * grid
    end_y = math.ceil((center_y + radius_m) / grid) * grid

    features: list[dict[str, Any]] = []
    severe_count = 0
    moderate_count = 0
    safe_count = 0
    no_damage_count = 0
    max_risk_score = 0.0
    max_wind_kph = 0.0
    total_buildings = 0

    y = start_y
    while y < end_y:
        x = start_x
        while x < end_x:
            midpoint_x, midpoint_y = x + grid / 2.0, y + grid / 2.0
            distance_m = math.hypot(midpoint_x - center_x, midpoint_y - center_y)
            if distance_m <= radius_m:
                cell_lon, cell_lat = inverse(midpoint_x, midpoint_y)
                cell_data = evaluate_cell_full(
                    midpoint_x - center_x,
                    midpoint_y - center_y,
                    cell_lon,
                    cell_lat,
                    scenario,
                )

                damage_score = cell_data["damage"]["damage_score"]
                classification = cell_data["damage"]["classification"]
                colour = cell_data["damage"]["colour"]
                description = cell_data["damage"]["description"]

                if damage_score > max_risk_score:
                    max_risk_score = damage_score

                if cell_data["hazard"]["wind_kph"] > max_wind_kph:
                    max_wind_kph = cell_data["hazard"]["wind_kph"]

                if classification == "TOTAL_DESTRUCTION_RISK":
                    severe_count += 1
                elif classification == "MODERATE_DAMAGE":
                    moderate_count += 1
                elif classification == "SAFE":
                    safe_count += 1
                else:
                    no_damage_count += 1

                corners = [
                    inverse(x, y),
                    inverse(x + grid, y),
                    inverse(x + grid, y + grid),
                    inverse(x, y + grid),
                    inverse(x, y),
                ]
                features.append(
                    {
                        "type": "Feature",
                        "id": cell_data["cell_id"],
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[list(corner) for corner in corners]],
                        },
                        "properties": {
                            "grid_size_m": grid,
                            "lat": cell_data["lat"],
                            "lon": cell_data["lon"],
                            "cyclone_heading_deg": cell_data["cyclone_heading_deg"],
                            "relative_direction_deg": cell_data["relative_direction_deg"],
                            "distance_to_cyclone_m": round(distance_m, 1),
                            "damage_score": damage_score,
                            "risk_score": damage_score,
                            "classification": classification,
                            "colour": colour,
                            "description": description,
                            "wind_kph": cell_data["hazard"]["wind_kph"],
                            "wind_ms": cell_data["hazard"]["wind_ms"],
                            "wind_direction_deg": cell_data["hazard"]["wind_direction_deg"],
                            "bearing_from_eye_deg": cell_data["hazard"]["bearing_from_eye_deg"],
                            "land_type": cell_data["land_type"],
                            "dynamic_pressure_pa": cell_data["wind_force"]["dynamic_pressure_pa"],
                            "effective_wind_loading_n_m2": cell_data["wind_force"]["effective_wind_loading_n_m2"],
                            "building_count": cell_data["exposure"]["building_count"],
                            "building_density": cell_data["exposure"]["building_density"],
                            "obstruction_level": cell_data["obstacles"]["obstruction_level"],
                            "estimated_class": cell_data["structure"]["estimated_class"],
                            "load_to_resistance_ratio": cell_data["structure"]["load_to_resistance_ratio"],
                            "primary_driver": cell_data["drivers"]["primary"],
                            "secondary_driver": cell_data["drivers"]["secondary"],
                            "full_cell_analysis": cell_data,
                        },
                    }
                )
            x += grid
        y += grid

    return {
        "type": "FeatureCollection",
        "features": features,
        "summary": {
            "total_cells": len(features),
            "max_risk_score": round(max_risk_score, 4),
            "max_wind_kph": max_wind_kph,
            "severe_cells": severe_count,
            "moderate_cells": moderate_count,
            "safe_cells": safe_count,
            "no_damage_cells": no_damage_count,
            "storm_heading_deg": scenario.heading_deg,
            "storm_speed_kph": scenario.speed_kph,
        },
        "metadata": {
            "grid_size_m": grid,
            "crs": "LOCAL_TANGENT_PLANE_METERS (GeoJSON output: EPSG:4326)",
            "model_type": "spatial_damage_screening_v2",
            "limitation": "Risk and damage classes are scenario-screening estimates, not engineering damage certificates.",
        },
    }


def new_scenario_record(
    scenario: ScenarioInput, basin: str | None, ocean_node: dict | None
) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input": scenario.model_dump(),
        "basin": basin,
        "ocean_node": ocean_node,
        "risk_grid": create_risk_grid(scenario),
        "model": {
            "name": "CYCLONEX spatial damage screening model",
            "version": "2.0.0",
            "wind_incidence_angle_deg": settings.wind_incidence_angle_deg,
            "data_quality": "Scenario inputs and inferred building parameters are screening estimates until calibrated against post-event field observations.",
        },
    }
