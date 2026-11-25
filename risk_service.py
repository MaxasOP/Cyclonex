"""Deterministic, uncalibrated cyclone scenario screening on a local metric grid."""
from __future__ import annotations

import math
import uuid
from collections import Counter, defaultdict
from geo import destination, distance_km, LAND_SOURCE, land_mask, is_land as _is_land
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
    radius_max_winds_km: float = Field(default=25.0, ge=1.0, le=100.0)
    include_ocean_node: bool = True
    grid_resolution_m: int | None = Field(default=None, ge=200, le=20000)

    @field_validator("grid_resolution_m")
    @classmethod
    def supported_grid_resolution(cls, value):
        if value is not None and value % 200:
            raise ValueError("Grid resolution must be a multiple of 200 metres.")
        return value

    @field_validator("center_lat", "center_lon")
    @classmethod
    def finite_coordinate(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("Coordinates must be finite values.")
        return value


RISK_BANDS = (
    (0.10, "NO_DAMAGE", "#75c9f1", "Minimal modeled impact"),
    (0.25, "SAFE", "#35a66f", "Low modeled impact"),
    (0.55, "MODERATE_DAMAGE", "#ed8a28", "Moderate modeled impact"),
    (float("inf"), "TOTAL_DESTRUCTION_RISK", "#d4483b", "High modeled impact"),
)


# ---------------------------------------------------------------------------
def _classify_land_array(lat_arr, lon_arr, dist_arr, rmw_m):
    import numpy as np
    return np.where(land_mask(lat_arr, lon_arr), "LAND_UNCLASSIFIED", "OCEAN")


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
    """Spherical azimuthal equidistant coordinates, centred on the storm eye."""
    origin_phi = math.radians(lat)

    def forward(point_lon: float, point_lat: float) -> tuple[float, float]:
        phi = math.radians(point_lat)
        delta = math.radians(point_lon - lon)
        bearing = math.atan2(math.sin(delta) * math.cos(phi),
                             math.cos(origin_phi) * math.sin(phi) - math.sin(origin_phi) * math.cos(phi) * math.cos(delta))
        radius = distance_km(lat, lon, point_lat, point_lon) * 1000
        return radius * math.sin(bearing), radius * math.cos(bearing)

    def inverse(x: float, y: float) -> tuple[float, float]:
        if x == y == 0:
            return lon, lat
        point_lat, point_lon = destination(lat, lon, math.degrees(math.atan2(x, y)), math.hypot(x, y) / 1000)
        return point_lon, point_lat

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
    grid_size_m: float = 200.0,
    cell_is_land: bool | None = None,
) -> dict[str, Any]:
    rmw_m = scenario.radius_max_winds_km * 1000.0

    distance_m = math.hypot(x_m, y_m)

    # Bearing from storm eye to cell (0=N, 90=E, 180=S, 270=W)
    bearing_rad = math.atan2(x_m, y_m)
    bearing_deg = math.degrees(bearing_rad) % 360.0

    # Relative angle between storm heading and cell bearing
    heading = scenario.heading_deg % 360.0
    rel_angle_deg = (bearing_deg - heading) % 360.0

    # Tangential cyclonic wind direction (Northern Hemisphere: counter-clockwise)
    hemisphere = 1 if scenario.center_lat >= 0 else -1
    # Meteorological direction (where the wind comes from).
    wind_direction_deg = (bearing_deg + hemisphere * 90.0) % 360.0

    # -----------------------------------------------------------------------
    # Holland-Rankine vortex wind + right-of-track translation asymmetry
    # -----------------------------------------------------------------------
    vmax = scenario.max_wind_kph
    intensity_ratio = clamp((vmax - 60.0) / 180.0)
    holland_b = 0.8 + 0.4 * intensity_ratio

    v_rankine = _rankine_wind_kph(distance_m, rmw_m, vmax, holland_b)

    # Right-of-track asymmetry: Northern Hemisphere cyclone winds are enhanced on the right side of the track
    right_factor = hemisphere * math.sin(math.radians(rel_angle_deg))
    # The supplied peak is the maximum on the stronger side of the storm.
    asymmetry = min(1.0, scenario.speed_kph / max(vmax, 1.0))
    wind_kph = round(v_rankine * (1.0 - 0.5 * asymmetry * (1.0 - right_factor)), 1)
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
    building_area_m2 = sum(b.get("area_m2", 0.0) for b in (buildings_in_cell or []))
    building_density = min(1.0, round(building_area_m2 / grid_size_m ** 2, 3))

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

    if cell_is_land is None:
        cell_is_land = _is_land(cell_lat, cell_lon)

    if building_count > 0:
        land_type = "RESIDENTIAL_URBAN" if building_count > 10 else "URBAN_COASTAL"
    elif cell_is_land:
        land_type = "LAND_UNCLASSIFIED"
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
        estimated_struct_class = "TALL_BUILDING_ASSUMED"
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
        estimated_struct_class = "LOW_RISE_ASSUMED"
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
    # The contribution list is also used to explain the score in the API trace.
    if land_type == "OCEAN":
        weighted_terms = [
            ("COMPOSITE_HAZARD", 0.10 * hazard_score),
        ]
    elif land_type == "LAND_UNCLASSIFIED":
        weighted_terms = [
            ("COMPOSITE_HAZARD",         0.50 * hazard_score),
            ("STRUCTURAL_RESPONSE_LRR",  0.35 * structural_response_score),
            ("BUILDING_EXPOSURE",        0.10 * exposure_score),
            ("STRUCTURAL_VULNERABILITY", 0.05 * vulnerability_score),
        ]
    else:
        weighted_terms = [
            ("COMPOSITE_HAZARD",         0.45 * hazard_score),
            ("STRUCTURAL_RESPONSE_LRR",  0.30 * structural_response_score),
            ("BUILDING_EXPOSURE",        0.15 * exposure_score),
            ("STRUCTURAL_VULNERABILITY", 0.10 * vulnerability_score),
        ]

    if hazard_score == 0 and effective_wind_loading_n_m2 == 0:
        weighted_terms = [("NO_MODELED_HAZARD", 0.0)]
    damage_score = round(clamp(sum(term for _, term in weighted_terms)), 4)
    classification, colour, description = classify_risk(damage_score)
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
            "avg_upwind_height_m": None,
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
                "building_footprint": "BUNDLED_FOOTPRINT_UNVERIFIED" if building_count > 0 else "NOT_AVAILABLE",
                "material": material_provenance,
                "height": height_provenance,
                "resistance_pa": "ASSUMED_SCREENING_VALUE",
                "structural_class": "INFERRED",
                "modeled": ["local_wind_field", "dynamic_pressure", "effective_wind_loading", "damage_score"],
                "note": (
                    "Resistance is a scenario assumption. Footprint height alone cannot establish construction material."
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



def _grid_geometry(ring):
    # Most cells fit a single polygon. Cut crossing rings at the antimeridian
    # so renderers never draw a cell across the middle of the world map.
    if all(abs(b[0] - a[0]) <= 180 for a, b in zip(ring, ring[1:])):
        return {"type": "Polygon", "coordinates": [ring]}
    from shapely.affinity import translate
    from shapely.geometry import Polygon, box, mapping
    from shapely.ops import unary_union
    unwrapped = [ring[0]]
    for longitude, latitude in ring[1:]:
        last = unwrapped[-1][0]
        unwrapped.append((last + (longitude - last + 180) % 360 - 180, latitude))
    if abs(unwrapped[-1][0] - unwrapped[0][0]) > 180:
        pole = 90 if unwrapped[0][1] > 0 else -90
        unwrapped.extend([(unwrapped[-1][0], pole), (unwrapped[0][0], pole)])
    shape = Polygon(unwrapped)
    pieces = []
    for offset in (-360, 0, 360):
        clipped = shape.intersection(box(offset - 180, -90, offset + 180, 90))
        if clipped.geom_type == "Polygon" and clipped.area:
            pieces.append(translate(clipped, xoff=-offset))
    return mapping(unary_union(pieces))


def create_risk_grid(scenario: ScenarioInput) -> dict[str, Any]:
    from building_service import _get_bundled_buildings
    from zone_service import _ring_area_approx

    radius = scenario.field_radius_km * 1000
    grid = scenario.grid_resolution_m or settings.grid_size_m
    if scenario.grid_resolution_m is None and radius > 6000:
        grid = max(grid, math.ceil(radius / 26 / 50) * 50)
    if scenario.grid_resolution_m and math.pi * (radius / grid) ** 2 > 12000:
        raise ValueError("Requested grid exceeds 12,000 cells. Reduce the radius or select overview resolution.")

    forward, inverse = local_metric_transforms(scenario.center_lon, scenario.center_lat)
    half = grid / 2
    n = math.floor(radius / grid)
    cells = [(ix * grid, iy * grid) for iy in range(-n, n + 1) for ix in range(-n, n + 1)
             if math.hypot(ix, iy) * grid <= radius]
    if len(cells) > 12000:
        raise ValueError("Requested grid exceeds 12,000 cells. Reduce the radius or select overview resolution.")
    centers = [inverse(x, y) for x, y in cells]
    mask = land_mask([lat for _, lat in centers], [lon for lon, _ in centers])

    buildings = defaultdict(list)
    for item in _get_bundled_buildings(scenario.center_lat, scenario.center_lon):
        bx, by = forward(*item["centroid"])
        key = (math.floor((bx + half) / grid) * grid, math.floor((by + half) / grid) * grid)
        buildings[key].append({**item, "area_m2": _ring_area_approx(item["ring"])})
    heights = {key: max((b["height_m"] or 0 for b in group), default=0) for key, group in buildings.items()}

    counts = Counter()
    features = []
    corners = {}
    for (x, y), (lon, lat), land in zip(cells, centers, mask):
        from_direction = math.atan2(x, y) + math.copysign(math.pi / 2, scenario.center_lat)
        neighbour = (x + round(math.sin(from_direction)) * grid, y + round(math.cos(from_direction)) * grid)
        trace = evaluate_cell_full(x, y, lon, lat, scenario, buildings.get((x, y)),
                                   heights.get(neighbour, 0), grid, bool(land))
        hazard, force, exposure = trace["hazard"], trace["wind_force"], trace["exposure"]
        structure, damage, drivers = trace["structure"], trace["damage"], trace["drivers"]
        props = {
            "full_cell_analysis": trace, "grid_size_m": grid, "cell_id": trace["cell_id"], "lat": lat, "lon": lon,
            "land_type": trace["land_type"], "cyclone_heading_deg": scenario.heading_deg,
            "relative_direction_deg": trace["relative_direction_deg"], "distance_to_cyclone_m": hazard["distance_to_eye_m"],
            "risk_score": damage["damage_score"], "damage_score": damage["damage_score"], "classification": damage["classification"],
            "colour": damage["colour"], "description": damage["description"], "wind_speed": hazard["wind_kph"],
            "pressure": hazard["pressure_hpa"], "cyclone_pattern": None, "ai_confidence": None,
            "estimated_class": structure["estimated_class"], "vulnerability_score": structure["vulnerability_score"],
            "estimated_resistance_pa": structure["estimated_resistance_pa"], "load_to_resistance_ratio": structure["load_to_resistance_ratio"],
            "obstruction_level": trace["obstacles"]["obstruction_level"], "primary_driver": drivers["primary"],
            "secondary_driver": drivers["secondary"], **hazard, **force, **exposure,
        }
        ring = []
        for corner in ((x-half,y-half), (x+half,y-half), (x+half,y+half), (x-half,y+half)):
            if corner not in corners:
                corners[corner] = inverse(*corner)
            ring.append(corners[corner])
        counts[damage["classification"]] += 1
        features.append({"type":"Feature", "id":trace["cell_id"], "geometry":_grid_geometry(ring + [ring[0]]), "properties":props})

    mode = "DETAIL_200M" if grid == 200 else "OVERVIEW"
    return {
        "type": "FeatureCollection", "features": features,
        "summary": {
            "total_cells": len(features), "max_risk_score": max(f["properties"]["damage_score"] for f in features),
            "max_wind_kph": max(f["properties"]["wind_kph"] for f in features), "severe_cells": counts["TOTAL_DESTRUCTION_RISK"],
            "moderate_cells": counts["MODERATE_DAMAGE"], "safe_cells": counts["SAFE"], "no_damage_cells": counts["NO_DAMAGE"],
            "storm_heading_deg": scenario.heading_deg, "storm_speed_kph": scenario.speed_kph,
            "actual_grid_size_m": grid, "grid_auto_scaled": scenario.grid_resolution_m is None and grid != settings.grid_size_m,
            "resolution_mode": mode,
        },
        "metadata": {
            "grid_size_m": grid, "resolution_mode": mode, "requested_grid_size_m": scenario.grid_resolution_m,
            "crs": "Local spherical azimuthal equidistant grid, EPSG:4326 output", "model_type": "spatial_damage_screening_v2",
            "land_source": LAND_SOURCE, "building_source": "Bundled reference footprints, partial coverage; counts include mapped buildings only.",
            "limitation": "Uncalibrated relative screening index. Population, monetary losses and emergency directives require independent data.",
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

    return record
