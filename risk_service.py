"""Deterministic, explainable spatial CYCLONE DAMAGE & LAND IMPACT SCREENING ENGINE for CYCLONEX v2.0.

This is a scenario hazard-screening model, not an engineering damage certification.
Every output clearly distinguishes OBSERVED, INFERRED, and MODELED data provenance.
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
    field_radius_km: float = Field(default=15.0, ge=0.2, le=50.0)
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
    distance_m = math.hypot(x_m, y_m)

    # Bearing from storm eye to cell (in degrees: 0=N, 90=E, 180=S, 270=W)
    bearing_rad = math.atan2(x_m, y_m)
    bearing_deg = (math.degrees(bearing_rad)) % 360.0

    # Relative angle between storm heading and cell bearing
    heading = scenario.heading_deg % 360.0
    rel_angle_deg = (bearing_deg - heading) % 360.0

    # Tangential wind direction in Northern Hemisphere (counter-clockwise eye rotation)
    wind_direction_deg = (bearing_deg + 90.0) % 360.0

    # Exponential radial wind drop-off with right-forward translation asymmetry
    v_base_kph = scenario.max_wind_kph * math.exp(-distance_m / max(radius_m, 1.0))
    asym_boost_kph = scenario.speed_kph * math.cos(math.radians(rel_angle_deg - 45.0))
    wind_kph = round(max(0.0, v_base_kph + max(0.0, asym_boost_kph)), 1)
    wind_ms = round(wind_kph / 3.6, 2)

    # Dynamic pressure q = 0.5 * rho * V^2 (rho = 1.225 kg/m^3)
    rho = 1.225
    dynamic_pressure_pa = round(0.5 * rho * (wind_ms**2), 1)

    # Modeled Wind Loading (Drag coefficient Cd ~ 1.2 for screening)
    cd = 1.2
    modeled_wind_loading_n_m2 = round(dynamic_pressure_pa * cd, 1)

    # Land vs Ocean classification heuristic
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

    if building_count > 0:
        land_type = "RESIDENTIAL_URBAN" if building_count > 10 else "URBAN_COASTAL"
    elif distance_m < radius_m * 0.65:
        land_type = "COASTAL_ZONE"
    else:
        land_type = "OCEAN"

    # Upwind obstacle sheltering factor
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

    # Structural Vulnerability & Resistance Ratio
    base_resistance_pa = 500.0
    est_resistance_pa = base_resistance_pa * (1.0 + min(1.0, max_building_height_m / 20.0))
    lrr = round(dynamic_pressure_pa / est_resistance_pa, 3)

    if building_count > 0:
        estimated_struct_class = (
            "RCC_CONCRETE" if max_building_height_m > 12.0 else "MASONRY_RESIDENTIAL"
        )
        vulnerability_score = min(
            1.0,
            round(
                scenario.assumed_vulnerability_score
                * (1.0 + (taller_bldg_count / max(1, building_count))),
                2,
            ),
        )
    else:
        estimated_struct_class = "OPEN_LAND_INFERRED"
        vulnerability_score = round(scenario.assumed_vulnerability_score * 0.4, 2)

    # Hazard Score
    pressure_deficit_hpa = max(0.0, 1010.0 - scenario.central_pressure_hpa)
    wind_score = clamp((wind_kph - 40.0) / 210.0)
    surge_score = clamp(scenario.storm_surge_m / 6.0)
    rain_score = clamp(scenario.rain_rate_mm_hr / 150.0)
    pressure_score = clamp(pressure_deficit_hpa / 100.0)

    hazard_score = clamp(
        0.55 * wind_score + 0.20 * surge_score + 0.15 * rain_score + 0.10 * pressure_score
    )

    exposure_score = clamp(0.35 * scenario.coastal_exposure_factor + 0.65 * building_density)
    structural_response_score = clamp(lrr / 1.5)

    # Final Damage Score calculation
    if land_type == "OCEAN":
        damage_score = round(clamp(hazard_score * 0.20), 4)
    else:
        damage_score = round(
            clamp(
                0.40 * hazard_score
                + 0.30 * structural_response_score
                + 0.20 * exposure_score
                + 0.10 * vulnerability_score
            ),
            4,
        )

    classification, colour, description = classify_risk(damage_score)

    driver_scores = [
        ("HIGH_WIND_LOADING", wind_score),
        ("STRUCTURAL_RESPONSE", structural_response_score),
        ("BUILDING_EXPOSURE", building_density),
        ("STORM_SURGE_EXPOSURE", surge_score),
        ("UNSHIELDED_COASTAL_EXPOSURE", 1.0 - shelter_factor),
    ]
    driver_scores.sort(key=lambda item: item[1], reverse=True)
    primary_driver = driver_scores[0][0]
    secondary_driver = driver_scores[1][0]

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
            "pressure_hpa": scenario.central_pressure_hpa,
            "pressure_deficit_hpa": round(pressure_deficit_hpa, 1),
            "rain_rate_mm_hr": scenario.rain_rate_mm_hr,
            "storm_surge_m": scenario.storm_surge_m,
            "hazard_score": round(hazard_score, 4),
        },
        "wind_force": {
            "dynamic_pressure_pa": dynamic_pressure_pa,
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
                "observed": ["building_count", "building_levels_tag"] if building_count > 0 else [],
                "inferred": ["estimated_building_height", "estimated_struct_class"],
                "modeled": ["local_wind_field", "dynamic_pressure", "effective_wind_loading", "damage_score"],
            },
        },
        "damage": {
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
        },
    }


def create_risk_grid(scenario: ScenarioInput) -> dict[str, Any]:
    forward, inverse = local_metric_transforms(scenario.center_lon, scenario.center_lat)
    center_x, center_y = forward(scenario.center_lon, scenario.center_lat)
    radius_m = scenario.field_radius_km * 1000.0
    grid = settings.grid_size_m
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
