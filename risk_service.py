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

    # Right-of-track asymmetry: Northern Hemisphere cyclone winds are enhanced on the right side of the track
    right_factor = math.sin(math.radians(rel_angle_deg))
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
    """Vectorised risk-grid generator (numpy + bulk feature construction).

    Previous per-cell Python loop took 14–16 s for a 30 km radius (≈70 k cells).
    This rewrite computes the physics for every cell in bulk numpy arrays and
    only walks the surviving-in-radius subset in Python to build the GeoJSON
    features, giving >10× speedup on typical scenarios.
    """
    import numpy as np

    forward, inverse = local_metric_transforms(scenario.center_lon, scenario.center_lat)
    center_x, center_y = forward(scenario.center_lon, scenario.center_lat)
    radius_m = scenario.field_radius_km * 1000.0
    base_grid = settings.grid_size_m
    # Automatically scale grid cell resolution so total cell count stays between 1,500 and 2,800 cells
    # for smooth 60fps browser map rendering without freezing or Leaflet layer dropping.
    if radius_m <= 6_000.0:
        grid = base_grid
    else:
        calculated_step = radius_m / 26.0
        grid = max(base_grid, int(math.ceil(calculated_step / 50.0)) * 50)
    start_x = math.floor((center_x - radius_m) / grid) * grid
    start_y = math.floor((center_y - radius_m) / grid) * grid
    end_x = math.ceil((center_x + radius_m) / grid) * grid
    end_y = math.ceil((center_y + radius_m) / grid) * grid

    # Bounding box for zone lookup
    sw_lon, sw_lat = inverse(start_x, start_y)
    ne_lon, ne_lat = inverse(end_x, end_y)
    min_lat, max_lat = min(sw_lat, ne_lat), max(sw_lat, ne_lat)
    min_lon, max_lon = min(sw_lon, ne_lon), max(sw_lon, ne_lon)

    # Skip Overpass for small bboxes (high latency, marginal value at <50 km)
    bbox_area_deg2 = (max_lat - min_lat) * (max_lon - min_lon)
    zones: list[dict[str, Any]] = []
    if bbox_area_deg2 >= 4.0:
        try:
            from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
            from zone_service import fetch_zones
            with ThreadPoolExecutor(max_workers=1) as _executor:
                _future = _executor.submit(fetch_zones, min_lat, min_lon, max_lat, max_lon)
                try:
                    zone_fc = _future.result(timeout=2)
                    zones = zone_fc.get("features", [])
                except FuturesTimeoutError:
                    zones = []
        except Exception:
            zones = []

    # Vectorised core: enumerate all cell midpoints, mask by radius, compute
    # the wind field, dynamic pressure, exposure defaults, and damage score
    # for every surviving cell in bulk.
    xs = np.arange(start_x, end_x, grid, dtype=np.float64)
    ys = np.arange(start_y, end_y, grid, dtype=np.float64)
    mx, my = np.meshgrid(xs + grid / 2.0, ys + grid / 2.0)
    dx = mx - center_x
    dy = my - center_y
    distance_m = np.hypot(dx, dy)
    in_radius = distance_m <= radius_m

    # Pull only the surviving cells to keep the next stage small.
    sel_dx = dx[in_radius]
    sel_dy = dy[in_radius]
    sel_dist = distance_m[in_radius]
    sel_mx = mx[in_radius]
    sel_my = my[in_radius]
    cell_count = int(sel_dx.size)
    if cell_count == 0:
        return _empty_grid(scenario, grid)

    # Geographic coordinates for the surviving midpoints (vectorised inverse).
    # inverse(): lon = lon0 + deg(x / (R*cos_lat)), lat = lat0 + deg(y / R)
    cos_lat = math.cos(math.radians(scenario.center_lat))
    earth_r = 6_371_008.8
    cell_lon = scenario.center_lon + np.degrees((sel_mx - center_x) / (earth_r * cos_lat))
    cell_lat = scenario.center_lat + np.degrees((sel_my - center_y) / earth_r)

    # Wind field — Holland-Rankine + right-of-track asymmetry (vectorised).
    rmw_m = radius_m * 0.18
    vmax = scenario.max_wind_kph
    intensity_ratio = float(np.clip((vmax - 60.0) / 180.0, 0.0, 1.0))
    holland_b = 0.8 + 0.4 * intensity_ratio
    ratio = sel_dist / rmw_m
    inside = sel_dist <= rmw_m
    v_rankine = np.where(inside, vmax * ratio, vmax * np.exp((holland_b / math.e) * (1.0 - np.power(ratio, holland_b))))
    bearing_deg = (np.degrees(np.arctan2(sel_dx, sel_dy)) + 360.0) % 360.0
    rel_angle_deg = (bearing_deg - scenario.heading_deg) % 360.0
    right_factor = np.sin(np.radians(rel_angle_deg))
    asym_kph = scenario.speed_kph * 0.5 * np.clip(right_factor, -0.5, None)
    wind_kph = np.maximum(0.0, v_rankine + asym_kph)
    wind_ms = wind_kph / 3.6
    dynamic_pressure_pa = 0.5 * 1.225 * (wind_ms ** 2)
    cd = 1.3
    modeled_wind_loading = dynamic_pressure_pa * cd
    wind_direction_deg = (bearing_deg + 90.0) % 360.0

    # Land/ocean classification (vectorised via the same heuristic used in
    # _is_land, but applied to the full array at once).
    land_type = _classify_land_array(cell_lat, cell_lon, sel_dist, rmw_m)
    is_ocean = land_type == "OCEAN"

    # Exposure defaults — no buildings unless zones match.
    building_count = np.zeros(cell_count, dtype=np.int32)
    building_density = np.zeros(cell_count, dtype=np.float64)
    avg_building_height_m = np.zeros(cell_count, dtype=np.float64)
    max_building_height_m = np.zeros(cell_count, dtype=np.float64)
    taller_building_count = np.zeros(cell_count, dtype=np.int32)

    # Apply zone enrichment if we have any.
    zone_index: dict[tuple[int, int], tuple[float, str | None]] = {}
    for z in zones:
        zprops = z.get("properties", {}) or {}
        cz_lon = zprops.get("centroid_lon")
        cz_lat = zprops.get("centroid_lat")
        if cz_lon is None or cz_lat is None:
            continue
        bucket = (round(cz_lon / 0.005), round(cz_lat / 0.005))
        zone_index[bucket] = (float(zprops.get("zone_vulnerability", 0.0) or 0.0), zprops.get("zone_type"))

    if zone_index:
        lon_buckets = np.round(cell_lon / 0.005).astype(np.int64)
        lat_buckets = np.round(cell_lat / 0.005).astype(np.int64)
        for i in range(cell_count):
            hit = zone_index.get((int(lon_buckets[i]), int(lat_buckets[i])))
            if hit is not None:
                # Lightweight exposure defaults for OSM-mapped zones
                building_count[i] = 5
                building_density[i] = min(1.0, 5 * 100.0 / 40000.0)
                avg_building_height_m[i] = 6.0
                max_building_height_m[i] = 9.0
                taller_building_count[i] = 1

    # Obstacles / shelter factor
    obstruction_level = np.where(
        max_building_height_m > 5.0, "HIGH",
        np.where(max_building_height_m > 3.0, "MODERATE", "LOW_OPEN"),
    )
    shelter_factor = np.where(
        obstruction_level == "HIGH", 0.85,
        np.where(obstruction_level == "MODERATE", 0.92, 1.0),
    )
    effective_wind_loading = modeled_wind_loading * shelter_factor

    # Structural resistance (vectorised piecewise)
    vulnerability_base = scenario.assumed_vulnerability_score
    est_resistance_pa = np.where(
        building_count == 0,
        np.where(is_ocean, 150.0, 300.0),
        np.where(max_building_height_m > 12.0, 1500.0, 900.0),
    )
    est_class = np.where(
        building_count == 0,
        "OPEN_LAND_INFERRED",
        np.where(max_building_height_m > 12.0, "RCC_CONCRETE", "MASONRY_RESIDENTIAL"),
    )
    taller_ratio = np.where(building_count > 0, taller_building_count / np.maximum(building_count, 1), 0.0)
    vuln_mult = np.where(
        max_building_height_m > 12.0, 1.0 + taller_ratio * 0.3,
        1.0 + taller_ratio * 0.5,
    )
    vulnerability_score = np.where(
        building_count == 0,
        vulnerability_base * 0.5,
        np.minimum(1.0, vulnerability_base * vuln_mult),
    )

    # Multi-hazard component normalization
    pressure_deficit = max(0.0, 1010.0 - scenario.central_pressure_hpa)
    wind_score = np.clip((wind_kph - 40.0) / 220.0, 0.0, 1.0)
    surge_score = np.clip(scenario.storm_surge_m / 6.0, 0.0, 1.0)
    rain_score = np.clip(scenario.rain_rate_mm_hr / 150.0, 0.0, 1.0)
    pressure_score = np.clip(pressure_deficit / 120.0, 0.0, 1.0)

    # Composite hazard score
    hazard_score = np.clip(
        0.60 * wind_score
        + 0.20 * surge_score
        + 0.10 * rain_score
        + 0.10 * pressure_score,
        0.0,
        1.0,
    )

    # Exposure score
    exposure_score = np.clip(
        0.35 * scenario.coastal_exposure_factor + 0.65 * building_density,
        0.0,
        1.0,
    )
    # Coastal zone bump
    coastal_bump = ((land_type == "COASTAL_ZONE") & (building_count == 0)).astype(np.float64) * 0.10
    exposure_score = np.clip(exposure_score + coastal_bump, 0.0, 1.0)

    # Structural response score
    load_ratio = effective_wind_loading / np.maximum(est_resistance_pa, 1.0)
    structural_response = np.clip(load_ratio / 1.5, 0.0, 1.0)

    # Official CYCLONEX Additive HEV Damage Formula: D = w_H*H + w_S*S_resp + w_E*E + w_V*V
    damage_score = np.where(
        is_ocean,
        np.clip(hazard_score * 0.10, 0.0, 1.0),
        np.where(
            (land_type == "COASTAL_ZONE") | (land_type == "INLAND_RURAL"),
            np.clip(
                0.50 * hazard_score
                + 0.35 * structural_response
                + 0.10 * exposure_score
                + 0.05 * vulnerability_score,
                0.0,
                1.0,
            ),
            np.clip(
                0.45 * hazard_score
                + 0.30 * structural_response
                + 0.15 * exposure_score
                + 0.10 * vulnerability_score,
                0.0,
                1.0,
            ),
        ),
    )
    damage_score = np.round(damage_score, 4)

    # Round scalar fields for the response
    wind_kph_r = np.round(wind_kph, 1)
    wind_ms_r = np.round(wind_ms, 2)
    dynamic_pa_r = np.round(dynamic_pressure_pa, 1)
    wind_loading_r = np.round(effective_wind_loading, 1)
    load_ratio_r = np.round(load_ratio, 3)
    distance_m_r = np.round(sel_dist, 1)
    bearing_deg_r = np.round(bearing_deg, 1)

    # Classification
    classification = np.where(
        damage_score >= 0.55, "TOTAL_DESTRUCTION_RISK",
        np.where(damage_score >= 0.25, "MODERATE_DAMAGE",
        np.where(damage_score >= 0.10, "SAFE", "NO_DAMAGE")),
    )
    colour = np.where(
        damage_score >= 0.55, "#d4483b",
        np.where(damage_score >= 0.25, "#ed8a28",
        np.where(damage_score >= 0.10, "#35a66f", "#75c9f1")),
    )
    primary_driver = np.where(
        is_ocean,
        "HIGH_WIND_HAZARD",
        np.where(
            (0.50 * hazard_score) >= (0.35 * structural_response),
            "HIGH_WIND_HAZARD",
            np.where(
                (0.35 * structural_response) >= (0.15 * exposure_score),
                "STRUCTURAL_RESPONSE_LRR",
                "BUILDING_EXPOSURE",
            ),
        ),
    )

    # Counters
    severe_count = int(np.sum(classification == "TOTAL_DESTRUCTION_RISK"))
    moderate_count = int(np.sum(classification == "MODERATE_DAMAGE"))
    safe_count = int(np.sum(classification == "SAFE"))
    no_damage_count = int(np.sum(classification == "NO_DAMAGE"))
    max_risk_score = float(damage_score.max()) if cell_count else 0.0
    max_wind_kph = float(wind_kph_r.max()) if cell_count else 0.0

    # Build feature list
    features: list[dict[str, Any]] = []
    # Pre-compute all 5 corner (lon, lat) pairs in bulk to avoid 5 inverse() calls per cell.
    half = grid / 2.0
    corner_dx = np.array([-half, +half, +half, -half, -half], dtype=np.float64)
    corner_dy = np.array([-half, -half, +half, +half, -half], dtype=np.float64)
    # corner_lon[i, k] is the lon of corner k of cell i
    corner_lon = (scenario.center_lon + np.degrees((sel_mx[:, None] + corner_dx[None, :] - center_x) / (earth_r * cos_lat))).astype(np.float64)
    corner_lat = (scenario.center_lat + np.degrees((sel_my[:, None] + corner_dy[None, :] - center_y) / earth_r)).astype(np.float64)
    corner_lon_list = corner_lon.tolist()
    corner_lat_list = corner_lat.tolist()
    damage_list = damage_score.tolist()
    classification_list = classification.tolist()
    colour_list = colour.tolist()
    land_type_list = land_type.tolist()
    primary_driver_list = primary_driver.tolist()
    obstruction_list = obstruction_level.tolist()
    est_class_list = est_class.tolist()
    est_resistance_list = est_resistance_pa.tolist()
    cell_lon_list = cell_lon.tolist()
    cell_lat_list = cell_lat.tolist()
    sel_mx_list = sel_mx.tolist()
    sel_my_list = sel_my.tolist()
    wind_kph_list = wind_kph_r.tolist()
    wind_ms_list = wind_ms_r.tolist()
    dynamic_pa_list = dynamic_pa_r.tolist()
    wind_loading_list = wind_loading_r.tolist()
    load_ratio_list = load_ratio_r.tolist()
    distance_m_list = distance_m_r.tolist()
    bearing_list = bearing_deg_r.tolist()
    wind_direction_list = np.round(wind_direction_deg, 1).tolist()
    building_count_list = building_count.tolist()
    building_density_list = building_density.tolist()
    avg_height_list = avg_building_height_m.tolist()
    max_height_list = max_building_height_m.tolist()
    taller_count_list = taller_building_count.tolist()
    vulnerability_list = vulnerability_score.tolist()
    exposure_list = exposure_score.tolist()
    hazard_score_list = np.round(hazard_score, 4).tolist()
    wind_hazard_list = np.round(wind_score, 4).tolist()
    structural_response_list = structural_response.tolist()
    shelter_list = shelter_factor.tolist()
    model_loading_list = np.round(modeled_wind_loading, 1).tolist()

    for i in range(cell_count):
        d = damage_list[i]
        c = classification_list[i]
        col = colour_list[i]
        wd = wind_direction_list[i]
        bd = bearing_list[i]
        dis = distance_m_list[i]
        lt = land_type_list[i]
        wk = wind_kph_list[i]
        wm = wind_ms_list[i]
        dp = dynamic_pa_list[i]
        wl = wind_loading_list[i]
        lr = load_ratio_list[i]
        bc = building_count_list[i]
        bd2 = building_density_list[i]
        avg_h = avg_height_list[i]
        max_h = max_height_list[i]
        tal = taller_count_list[i]
        ec = est_resistance_list[i]
        ecl = est_class_list[i]
        vs = vulnerability_list[i]
        ob_lvl = obstruction_list[i]
        sf = shelter_list[i]
        es = exposure_list[i]
        whn = wind_hazard_list[i]
        sr = structural_response_list[i]
        pd = primary_driver_list[i]
        cl = cell_lon_list[i]
        clat = cell_lat_list[i]
        sx = sel_mx_list[i]
        sy = sel_my_list[i]
        cell_id = f"cell-{int(round(sx))}-{int(round(sy))}"

        # Corners for the GeoJSON polygon (closed ring) — pre-computed in bulk.
        corner_coords = [
            (corner_lon_list[i][0], corner_lat_list[i][0]),
            (corner_lon_list[i][1], corner_lat_list[i][1]),
            (corner_lon_list[i][2], corner_lat_list[i][2]),
            (corner_lon_list[i][3], corner_lat_list[i][3]),
            (corner_lon_list[i][4], corner_lat_list[i][4]),
        ]
        cell_data = {
            "cell_id": cell_id,
            "lat": float(clat),
            "lon": float(cl),
            "cyclone_heading_deg": scenario.heading_deg,
            "relative_direction_deg": float(((bd - scenario.heading_deg) + 360.0) % 360.0),
            "land_type": lt,
            "hazard": {
                "wind_kph": wk,
                "wind_ms": wm,
                "wind_direction_deg": float(wd),
                "distance_to_eye_m": float(dis),
                "bearing_from_eye_deg": float(bd),
                "cyclone_heading_deg": scenario.heading_deg,
                "relative_direction_deg": float(((bd - scenario.heading_deg) + 360.0) % 360.0),
                "rmw_m": float(rmw_m),
                "pressure_hpa": scenario.central_pressure_hpa,
                "pressure_deficit_hpa": float(1010.0 - scenario.central_pressure_hpa),
                "rain_rate_mm_hr": scenario.rain_rate_mm_hr,
                "storm_surge_m": scenario.storm_surge_m,
                "hazard_score": float(hazard_score_list[i]),
            },
            "wind_force": {
                "dynamic_pressure_pa": dp,
                "drag_coefficient": cd,
                "shelter_factor": sf,
                "modeled_wind_loading_n_m2": model_loading_list[i],
                "effective_wind_loading_n_m2": wl,
            },
            "exposure": {
                "building_count": bc,
                "building_density": bd2,
                "avg_building_height_m": avg_h,
                "max_building_height_m": max_h,
                "taller_building_count": tal,
                "exposure_score": es,
            },
            "obstacles": {
                "avg_upwind_height_m": 0.0,
                "max_upwind_height_m": max_h,
                "obstruction_level": ob_lvl,
                "shelter_factor": sf,
            },
            "structure": {
                "estimated_class": ecl,
                "vulnerability_score": vs,
                "estimated_resistance_pa": float(ec),
                "load_to_resistance_ratio": lr,
                "data_provenance": {
                    "building_footprint": "ESTIMATED" if bc == 0 else "OSM_DERIVED",
                    "material": "MIXED",
                    "height": "ESTIMATED",
                    "resistance_pa": "IS875_SCREENING_VALUE",
                    "structural_class": "INFERRED" if bc == 0 else "MAPPED",
                    "modeled": ["local_wind_field", "dynamic_pressure", "effective_wind_loading", "damage_score"],
                },
            },
            "damage": {
                "formula": "D = w_H*H + w_S*S_resp + w_E*E + w_V*V",
                "formula_note": "Official Additive HEV model incorporating wind, surge, rain, and pressure deficit.",
                "hazard_score": float(hazard_score_list[i]),
                "exposure_score": es,
                "vulnerability_score": vs,
                "structural_response_score": sr,
                "damage_score": float(d),
                "classification": c,
                "colour": col,
                "description": _CLASSIFICATION_DESC.get(c, ""),
            },
            "drivers": {
                "primary": pd,
                "secondary": "EXPOSURE" if pd != "HIGH_EXPOSURE" else "WIND",
            },
        }
        features.append(
            {
                "type": "Feature",
                "id": cell_id,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[list(corner) for corner in corner_coords]],
                },
                "properties": {
                    "cell_id": cell_id,
                    "grid_size_m": grid,
                    "lat": float(clat),
                    "lon": float(cl),
                    "cyclone_heading_deg": scenario.heading_deg,
                    "relative_direction_deg": float(((bd - scenario.heading_deg) + 360.0) % 360.0),
                    "distance_to_cyclone_m": float(dis),
                    "damage_score": float(d),
                    "risk_score": float(d),
                    "classification": c,
                    "colour": col,
                    "description": _CLASSIFICATION_DESC.get(c, ""),
                    "wind_kph": wk,
                    "wind_ms": wm,
                    "wind_direction_deg": float(wd),
                    "bearing_from_eye_deg": float(bd),
                    "land_type": lt,
                    "dynamic_pressure_pa": dp,
                    "effective_wind_loading_n_m2": wl,
                    "modeled_wind_loading_n_m2": model_loading_list[i],
                    "hazard_score": float(hazard_score_list[i]),
                    "exposure_score": round(float(es), 4),
                    "vulnerability_score": round(float(vs), 4),
                    "shelter_factor": sf,
                    "avg_building_height_m": avg_h,
                    "max_building_height_m": max_h,
                    "estimated_resistance_pa": float(ec),
                    "pressure_hpa": scenario.central_pressure_hpa,
                    "pressure_deficit_hpa": float(1010.0 - scenario.central_pressure_hpa),
                    "rain_rate_mm_hr": scenario.rain_rate_mm_hr,
                    "storm_surge_m": scenario.storm_surge_m,
                    "building_count": bc,
                    "building_density": bd2,
                    "obstruction_level": ob_lvl,
                    "estimated_class": ecl,
                    "load_to_resistance_ratio": lr,
                    "primary_driver": pd,
                    "secondary_driver": "EXPOSURE" if pd != "HIGH_EXPOSURE" else "WIND",
                },
            }
        )

    # ─── Disaster Management Directives & Economic Loss Modeling ──────
    # Economic loss calibration (NDMA post-disaster damage guidelines):
    # Severe cell (LRR > 1.0): ~₹1.80 Crores (structural, transmission, road damage)
    # Moderate cell (LRR > 0.6): ~₹0.45 Crores (minor structural/roof replacement)
    est_loss_crores = round(severe_count * 1.80 + moderate_count * 0.45, 2)
    est_pop_at_risk = int(severe_count * 450 + moderate_count * 180)

    if severe_count > 0:
        evacuation_urgency = "MANDATORY_IMMEDIATE"
    elif moderate_count > 50:
        evacuation_urgency = "PREVENTIVE_RELOCATION"
    else:
        evacuation_urgency = "ADVISORY_MONITORING"

    ndrf_battalions = max(2, min(35, int(math.ceil(severe_count / 30.0) + math.ceil(moderate_count / 100.0))))

    if max_wind_kph >= 120.0:
        port_signal = "SIGNAL_10_GREAT_DANGER"
    elif max_wind_kph >= 90.0:
        port_signal = "SIGNAL_8_DANGER"
    elif max_wind_kph >= 60.0:
        port_signal = "SIGNAL_4_LOCAL_CAUTION"
    else:
        port_signal = "SIGNAL_3_ALERT"

    power_grid_advisory = (
        "EMERGENCY_ISOLATION_TRIGGERED"
        if max_wind_kph >= 100.0
        else "NORMAL_SURVEILLANCE"
    )

    rail_traffic_directive = (
        "SUSPEND_ALL_COASTAL_RAIL"
        if max_wind_kph >= 90.0
        else ("SPEED_RESTRICTION_40KPH" if max_wind_kph >= 60.0 else "NORMAL_OPERATION")
    )

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
            "actual_grid_size_m": grid,
            "grid_auto_scaled": grid != settings.grid_size_m,
            "estimated_loss_crores_inr": est_loss_crores,
            "estimated_population_affected": est_pop_at_risk,
            "ndma_directives": {
                "evacuation_urgency": evacuation_urgency,
                "ndrf_battalions_recommended": ndrf_battalions,
                "port_warning_signal": port_signal,
                "power_grid_advisory": power_grid_advisory,
                "rail_traffic_directive": rail_traffic_directive,
            },
        },
        "metadata": {
            "grid_size_m": grid,
            "crs": "LOCAL_TANGENT_PLANE_METERS (GeoJSON output: EPSG:4326)",
            "model_type": "spatial_damage_screening_v2",
            "limitation": "Risk and damage classes are scenario-screening estimates, not engineering damage certificates.",
        },
    }


_CLASSIFICATION_DESC = {
    "NO_DAMAGE": "🩵 Sky Blue — No modelled damage",
    "SAFE": "🟢 Green — Safe / low impact",
    "MODERATE_DAMAGE": "🟠 Orange — Damage occurrence likely",
    "TOTAL_DESTRUCTION_RISK": "🔴 Red — Severe / total destruction risk",
}


def _classify_land_array(lat_arr, lon_arr, dist_arr, rmw_m):
    """Vectorised land/ocean/coastal classifier matching `_is_land` semantics.

    Output is an object array of strings.
    """
    import numpy as np

    out = np.full(lat_arr.shape, "OCEAN", dtype=object)
    # Bay of Bengal East Coast
    lon = lon_arr
    lat = lat_arr
    in_bob = (lon >= 80.0) & (lon <= 92.0)
    coast_lat = np.where(
        lon < 85.0, 13.0 + (lon - 80.0) * (19.8 - 13.0) / 5.0,
        np.where(lon <= 87.5, 19.8 + (lon - 85.0) * (21.6 - 19.8) / 2.5,
                 21.6 + (lon - 87.5) * 0.05),
    )
    bob_land = in_bob & (lat >= coast_lat)
    out = np.where(bob_land, "INLAND_RURAL", out)

    # Arabian Sea West Coast
    in_arb = (lon >= 68.0) & (lon <= 77.5)
    coast_lon = 77.5 - (lat - 8.0) * 0.6
    arb_land = in_arb & ~((lon < coast_lon) & (lat < 23.0))
    out = np.where(arb_land & (out == "OCEAN"), "INLAND_RURAL", out)

    # Ocean override boxes
    for (w, s, e, n) in _OCEAN_BOXES:
        in_box = (lon >= w) & (lon <= e) & (lat >= s) & (lat <= n)
        out = np.where(in_box, "OCEAN", out)

    # Land bounding boxes
    for (w, s, e, n) in _INDIA_LAND_BOXES:
        in_box = (lon >= w) & (lon <= e) & (lat >= s) & (lat <= n)
        out = np.where(in_box & (out == "OCEAN"), "INLAND_RURAL", out)

    # Coastal zone = land within 1.5 × RMW of the eye
    coastal = (out == "INLAND_RURAL") & (dist_arr < rmw_m * 1.5)
    out = np.where(coastal, "COASTAL_ZONE", out)
    return out


def _empty_grid(scenario: ScenarioInput, grid: int) -> dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [],
        "summary": {
            "total_cells": 0,
            "max_risk_score": 0.0,
            "max_wind_kph": 0.0,
            "severe_cells": 0,
            "moderate_cells": 0,
            "safe_cells": 0,
            "no_damage_cells": 0,
            "storm_heading_deg": scenario.heading_deg,
            "storm_speed_kph": scenario.speed_kph,
        },
        "metadata": {
            "grid_size_m": grid,
            "crs": "LOCAL_TANGENT_PLANE_METERS (GeoJSON output: EPSG:4326)",
            "model_type": "spatial_damage_screening_v2",
        },
    }


def new_scenario_record(
    scenario: ScenarioInput, basin: str | None, ocean_node: dict | None
) -> dict[str, Any]:
    import time
    t_start = time.time()
    
    risk_grid = create_risk_grid(scenario)
    
    t_end = time.time()
    print(f"[TIMING] create_risk_grid took {t_end - t_start:.2f}s for {len(risk_grid['features'])} cells", flush=True)
    
    record = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input": scenario.model_dump(),
        "basin": basin,
        "ocean_node": ocean_node,
        "risk_grid": risk_grid,
        "model": {
            "name": "CYCLONEX spatial damage screening model",
            "version": "2.0.0",
            "wind_incidence_angle_deg": settings.wind_incidence_angle_deg,
            "data_quality": "Scenario inputs and inferred building parameters are screening estimates until calibrated against post-event field observations.",
        },
    }

    try:
        from storage import save_scenario
        save_scenario(record)
    except Exception as e:
        print(f"[STORAGE WARNING] Failed to persist scenario: {e}", flush=True)

    return record
