"""Deterministic, explainable cyclone screening model for CYCLONEX v2.

This is a hazard-screening model, not an engineering damage certification.
Every output contains its assumptions so a later calibrated model can replace
the formula without changing the API contract.
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
    rain_rate_mm_hr: float = Field(default=0, ge=0, le=500)
    storm_surge_m: float = Field(default=0, ge=0, le=20)
    field_radius_km: float = Field(default=2, ge=0.2, le=15)
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
    (0.10, "NO_DAMAGE", "#75c9f1", "No modelled damage"),
    (0.25, "SAFE", "#35a66f", "Low impact / safe"),
    (0.55, "MODERATE_DAMAGE", "#ed8a28", "Damage occurrence likely"),
    (float("inf"), "TOTAL_DESTRUCTION_RISK", "#d4483b", "Severe damage risk"),
)


def local_metric_transforms(lon: float, lat: float):
    """Return a local tangent-plane transform centred on the scenario.

    Scenarios are capped at 15 km radius, where this metric transform keeps
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


def clamp(value: float, low: float = 0, high: float = 1) -> float:
    return max(low, min(value, high))


def classify_risk(score: float) -> tuple[str, str, str]:
    for threshold, label, colour, description in RISK_BANDS:
        if score < threshold:
            return label, colour, description
    raise AssertionError("Risk bands must cover all scores")


def evaluate_cell(
    distance_m: float, scenario: ScenarioInput
) -> tuple[dict[str, float], float, str, str, str]:
    radius_m = scenario.field_radius_km * 1000
    wind_kph = scenario.max_wind_kph * math.exp(-distance_m / max(radius_m, 1))
    pressure_deficit_hpa = max(0, 1010 - scenario.central_pressure_hpa)
    wind_score = clamp((wind_kph - 40) / 210)
    surge_score = clamp(scenario.storm_surge_m / 6)
    rain_score = clamp(scenario.rain_rate_mm_hr / 150)
    pressure_score = clamp(pressure_deficit_hpa / 100)
    hazard_score = clamp(
        0.60 * wind_score + 0.20 * surge_score + 0.10 * rain_score + 0.10 * pressure_score
    )
    exposure_score = clamp(0.55 + 0.45 * scenario.coastal_exposure_factor)
    damage_score = round(
        clamp(hazard_score * exposure_score * scenario.assumed_vulnerability_score), 4
    )
    classification, colour, description = classify_risk(damage_score)
    return (
        {
            "wind_kph": round(wind_kph, 1),
            "pressure_deficit_hpa": round(pressure_deficit_hpa, 1),
            "rain_rate_mm_hr": scenario.rain_rate_mm_hr,
            "storm_surge_m": scenario.storm_surge_m,
            "hazard_score": round(hazard_score, 4),
            "exposure_score": round(exposure_score, 4),
            "vulnerability_score": scenario.assumed_vulnerability_score,
        },
        damage_score,
        classification,
        colour,
        description,
    )


def create_risk_grid(scenario: ScenarioInput) -> dict[str, Any]:
    forward, inverse = local_metric_transforms(scenario.center_lon, scenario.center_lat)
    center_x, center_y = forward(scenario.center_lon, scenario.center_lat)
    radius_m = scenario.field_radius_km * 1000
    grid = settings.grid_size_m
    start_x = math.floor((center_x - radius_m) / grid) * grid
    start_y = math.floor((center_y - radius_m) / grid) * grid
    end_x = math.ceil((center_x + radius_m) / grid) * grid
    end_y = math.ceil((center_y + radius_m) / grid) * grid

    features: list[dict[str, Any]] = []
    y = start_y
    while y < end_y:
        x = start_x
        while x < end_x:
            midpoint_x, midpoint_y = x + grid / 2, y + grid / 2
            distance_m = math.hypot(midpoint_x - center_x, midpoint_y - center_y)
            if distance_m <= radius_m:
                hazard, damage_score, classification, colour, description = evaluate_cell(
                    distance_m, scenario
                )
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
                        "id": f"cell-{int(x)}-{int(y)}",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[list(corner) for corner in corners]],
                        },
                        "properties": {
                            "grid_size_m": grid,
                            "distance_to_cyclone_m": round(distance_m, 1),
                            "damage_score": damage_score,
                            "classification": classification,
                            "colour": colour,
                            "description": description,
                            "wind_incidence_angle_deg": settings.wind_incidence_angle_deg,
                            **hazard,
                        },
                    }
                )
            x += grid
        y += grid

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "grid_size_m": grid,
            "crs": "LOCAL_TANGENT_PLANE_METERS (GeoJSON output: EPSG:4326)",
            "model_type": "screening_v1",
            "limitation": "Risk classes are scenario-screening estimates, not engineering damage certificates.",
        },
    }


def new_scenario_record(scenario: ScenarioInput, basin: str | None, ocean_node: dict | None) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input": scenario.model_dump(),
        "basin": basin,
        "ocean_node": ocean_node,
        "risk_grid": create_risk_grid(scenario),
        "model": {
            "name": "CYCLONEX screening model",
            "version": "2.0.0",
            "wind_incidence_angle_deg": settings.wind_incidence_angle_deg,
            "data_quality": "Scenario inputs and unknown building vulnerability are assumptions until calibrated against observed damage.",
        },
    }
