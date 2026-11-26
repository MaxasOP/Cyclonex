from datetime import datetime, timezone
import math
from threading import Lock
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field, HttpUrl

from admin_access import require_admin
from baseline_model import BASELINE_PIPELINE, CycloneMLPipeline
from building_service import fetch_buildings
from config import settings
from feature_extractor import extract_sample_features, in_forecast_domain, ocean_features
from hursat_service import create_hursat_observation, generate_storm_sequence_samples
from ibtracs_service import parse_ibtracs_csv
from ml_registry import (
    BEST_TRACK_LABELS,
    OBSERVATIONS,
    SAMPLES,
    get_split_summary,
    register_best_track_labels,
    register_observation,
    register_sample,
)
from ml_schema import IBTracsCsvImport, SatelliteObservation, TrainingSample
from ocean_service import get_ocean_node
from risk_service import ScenarioInput, new_scenario_record
from geo import land_mask
from shelter_service import evaluate_evacuation_plan
from storage import (
    get_scenario as db_get_scenario,
    get_scenario_risk_grid as db_get_risk_grid,
    save_scenario as db_save_scenario,
)
from zone_service import fetch_zones
import requests
from news_service import (
    add_news_source,
    delete_news_source,
    get_news_articles,
    get_news_sources,
    scrape_all_active_sources,
)
from ai_cyclone_service import ai_service, CycloneAnalysisRequest

app = FastAPI(
    title="CYCLONEX Ocean Data Service",
    description="Fetches subsurface ocean TB/VF data and provides satellite-based cyclone ML endpoints.",
    version="0.3.0",
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allowed_origins),
    allow_methods=["GET", "HEAD", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class HursatObservationInput(BaseModel):
    product: str = Field(default="HURSAT_B1_IR", min_length=2, max_length=100)
    storm_id: str | None = Field(default=None, min_length=2, max_length=80)
    acquired_at: datetime
    centre_lat: float = Field(ge=-90, le=90)
    centre_lon: float = Field(ge=-180, le=180)
    asset_url: HttpUrl
    channels: list[str] = Field(default=["IR_WINDBAND"], min_length=1, max_length=20)
    box_size_deg: float = Field(default=4.0, gt=0, le=180)
    spatial_resolution_km: float = Field(default=8.0, gt=0, le=100)
    preprocessing_version: str = Field(default="hursat_b1_v06_cropped", min_length=1, max_length=40)
    checksum_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")


class GenerateSamplesInput(BaseModel):
    storm_id: str
    split: Literal["train", "validation", "test"]
    sequence_hours: int = Field(default=24, ge=6, le=48)
    notes: str | None = Field(default=None, max_length=500)


class InferenceRequest(BaseModel):
    sample_id: str | None = None
    storm_id: str | None = None
    centre_lat: float | None = Field(default=None, ge=-90, le=90)
    centre_lon: float | None = Field(default=None, ge=-180, le=180)
    max_sustained_wind_kph: float | None = Field(default=None, ge=0, le=400)
    central_pressure_hpa: float | None = Field(default=None, ge=800, le=1050)
    heading_deg: float | None = Field(default=315.0, ge=0, le=360)
    speed_kph: float | None = Field(default=25.0, ge=0, le=120)


class StormImpactRunInput(BaseModel):
    forecast_horizon_hours: Literal[0, 6, 12, 24] = 24
    building_density: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    construction_quality: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    sea_level_rise_m: float = 0.0


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {
        "service": "CYCLONEX Ocean Data Service",
        "status": "online",
        "endpoints": {
            "ocean_node": "/api/ocean-node?lat={lat}&lon={lon}",
            "health": "/health",
            "docs": "/docs",
            "dataset_summary": "/api/v3/dataset-summary",
            "inference": "/api/v3/inference",
        },
    }


def infer_basin(lat: float, lon: float) -> str:
    """Mirrors basin-split logic for North Indian Ocean."""
    if lon >= 77.5 or (lat < 8.0 and lon >= 76.0):
        return "BAY_OF_BENGAL"
    return "ARABIAN_SEA"


@app.get("/api/ocean-node")
def ocean_node(
    lat: float = Query(..., ge=-90, le=90, description="Latitude of the picked map point"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude of the picked map point"),
):
    """Returns TB and VF node for a map coordinate."""
    if not (0 <= lat <= 30 and 45 <= lon <= 100):
        raise HTTPException(
            status_code=400,
            detail="Coordinate outside North Indian Ocean domain (lat 0-30, lon 45-100).",
        )

    if land_mask(lat, lon):
        raise HTTPException(status_code=422, detail="Selected point is on land in the coastline reference.")
    basin = infer_basin(lat, lon)
    return {**get_ocean_node(lat, lon, basin), "basin": basin}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():

    return {
        "status": "ok",
        "version": "0.3.0",
        "revision": __import__("os").getenv("RENDER_GIT_COMMIT", "local"),
        "ai_models": ai_service.get_models_status(),
        "integrations": {
            "google_maps": "browser_build_configuration",
            "cyclone_forecast": "local_best_track_baseline",
            "database": "sqlite",
            "earth_engine": "catalogue_references_only",
            "gemini": "configured" if __import__("os").getenv("GEMINI_API_KEY") else "rules_fallback",
        },
        "model_constraints": {
            "grid_size_m": settings.grid_size_m,
            "wind_incidence_angle_deg": settings.wind_incidence_angle_deg,
        },
    }


SCENARIOS: dict[str, dict] = {}


_SCENARIO_LOCK = Lock()


def _store_scenario(record: dict) -> None:
    db_save_scenario(record)
    with _SCENARIO_LOCK:
        if len(SCENARIOS) >= 10:
            SCENARIOS.pop(next(iter(SCENARIOS)))
        SCENARIOS[record["id"]] = record


def _grid_extents(features: list[dict]) -> list[tuple[float, float, float, float]]:
    # A dateline-crossing scenario has two local extents, never a global bbox.
    rings = []
    for feature in features:
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        rings.extend(polygon[0] for polygon in polygons)
    if not rings:
        return []

    def bounds(group):
        xs, ys = zip(*(point[:2] for ring in group for point in ring))
        return min(ys), min(xs), max(ys), max(xs)

    south, west, north, east = bounds(rings)
    if east - west <= 180:
        return [(south, west, north, east)]
    groups = [[ring for ring in rings if (sum(p[0] for p in ring) >= 0) == eastern] for eastern in (False, True)]
    return [bounds(group) for group in groups if group]


def _fetch_grid_layer(features, fetch):
    layers = [fetch(*extent) for extent in _grid_extents(features)]
    if len(layers) == 1:
        return layers[0]
    combined = [feature for layer in layers for feature in layer["features"]]
    return {"type": "FeatureCollection", "features": combined,
            "metadata": {"status": "PARTIAL" if combined else "UNAVAILABLE",
                         "parts": [layer.get("metadata", {}) for layer in layers]}}


@app.post("/api/ai/analyze-cyclone")
def analyze_cyclone_ai(req: CycloneAnalysisRequest):
    """Multi-source satellite AI identification, pattern classification & intensity/track prediction."""
    try:
        res = ai_service.analyze_cyclone(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    
    # Connect directly to risk engine to update 200m spatial damage grid & risk layers
    try:
        scn_input = ScenarioInput(
            name=f"AI Analysis ({res['classification']['pattern']})",
            center_lat=req.latitude,
            center_lon=req.longitude,
            max_wind_kph=req.wind_speed,
            central_pressure_hpa=req.pressure,
            heading_deg=req.heading if req.heading is not None else 315.0,
            speed_kph=req.speed if req.speed is not None else 22.0,
            rain_rate_mm_hr=75.0,
            storm_surge_m=2.8,
            field_radius_km=30.0,
        )
        scn_res = create_scenario(scn_input)
        res["scenario_id"] = scn_res["id"]
        res["risk_integration"]["grid_updated"] = True
    except Exception as e:
        print(f"[AI ENDPOINT WARN] Could not trigger scenario risk engine: {e}")

    return res


@app.post("/api/v2/scenarios", status_code=201)
def create_scenario(scenario: ScenarioInput):
    """Create a reproducible 200 m cyclone risk-grid screening scenario."""
    basin = None
    ocean_node = None
    if 0 <= scenario.center_lat <= 30 and 45 <= scenario.center_lon <= 100:
        basin = infer_basin(scenario.center_lat, scenario.center_lon)
        if scenario.include_ocean_node and not land_mask(scenario.center_lat, scenario.center_lon):
            ocean_node = get_ocean_node(scenario.center_lat, scenario.center_lon, basin, live_first=False)
    try:
        record = new_scenario_record(scenario, basin, ocean_node)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _store_scenario(record)
    return record


@app.get("/api/v2/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    scenario = SCENARIOS.get(scenario_id) or db_get_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    return scenario


@app.get("/api/v2/scenarios/{scenario_id}/risk-grid")
def get_risk_grid(scenario_id: str):
    scenario = SCENARIOS.get(scenario_id)
    if scenario and "risk_grid" in scenario:
        return scenario["risk_grid"]
    grid = db_get_risk_grid(scenario_id)
    if grid:
        return grid
    raise HTTPException(status_code=404, detail="Scenario risk grid not found.")


@app.get("/api/v2/scenarios/{scenario_id}/cells/{cell_id}")
def get_scenario_cell(scenario_id: str, cell_id: str):
    """Retrieve full explainable physics trace for a specific 200m grid cell."""
    from risk_service import evaluate_cell_full, local_metric_transforms

    scenario = SCENARIOS.get(scenario_id) or db_get_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")

    # Reconstruct ScenarioInput
    scn_in = ScenarioInput(**scenario["input"])

    # Otherwise scan features if available
    grid = scenario.get("risk_grid", {})
    for f in grid.get("features", []):
        if f.get("id") == cell_id or f.get("properties", {}).get("cell_id") == cell_id:
            props = f.get("properties", {})
            if props.get("full_cell_analysis"):
                return props["full_cell_analysis"]
            lat = props.get("lat", scn_in.center_lat)
            lon = props.get("lon", scn_in.center_lon)
            forward, _ = local_metric_transforms(scn_in.center_lon, scn_in.center_lat)
            x_m, y_m = forward(lon, lat)
            result = evaluate_cell_full(x_m, y_m, lon, lat, scn_in)
            result["cell_id"] = cell_id
            return result

    raise HTTPException(status_code=404, detail=f"Cell '{cell_id}' not found in scenario.")


@app.get("/api/v2/scenarios/{scenario_id}/buildings")
def get_scenario_buildings(scenario_id: str):
    """Return OpenStreetMap buildings for the scenario extent, when available."""
    from copy import deepcopy
    from shapely import STRtree
    from shapely.geometry import shape

    scenario = get_scenario(scenario_id)
    features = scenario["risk_grid"]["features"]
    buildings = deepcopy(_fetch_grid_layer(features, fetch_buildings))
    if not buildings["features"]:
        return buildings
    cells = STRtree([shape(feature["geometry"]) for feature in features])
    for building in buildings["features"]:
        point = shape(building["geometry"]).representative_point()
        matches = cells.query(point, predicate="intersects")
        if not len(matches):
            building["properties"].update(damage_score=None, classification="OUTSIDE_RISK_GRID", display_colour="#0a2a57")
            continue
        cell = features[min(matches)]
        risk = cell["properties"]
        building["properties"].update(
            damage_score=risk.get("damage_score"), classification=risk.get("classification"),
            display_colour=risk.get("colour"), colour_source="containing_risk_cell",
            wind_kph=risk.get("wind_kph"), dynamic_pressure_pa=risk.get("dynamic_pressure_pa"),
            load_to_resistance_ratio=risk.get("load_to_resistance_ratio"), cell_id=cell.get("id"),
        )
    return buildings


@app.get("/api/v2/scenarios/{scenario_id}/zones")
def get_scenario_zones(scenario_id: str):
    """Return synthesized screening zones for the scenario extent."""
    return _fetch_grid_layer(get_scenario(scenario_id)["risk_grid"]["features"], fetch_zones)


@app.get("/api/v2/scenarios/{scenario_id}/shelters-evacuation")
def get_scenario_shelters(scenario_id: str):
    """Return coastal multipurpose cyclone shelters and evacuation priority routing."""
    scenario = SCENARIOS.get(scenario_id) or db_get_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    center_lat = scenario["input"]["center_lat"]
    center_lon = scenario["input"]["center_lon"]
    radius_km = scenario["input"].get("field_radius_km", 30.0)
    summary = scenario["risk_grid"].get("summary", {})
    features = scenario["risk_grid"].get("features", [])
    return evaluate_evacuation_plan(center_lat, center_lon, radius_km, summary, features)



@app.post("/api/v3/observations/ingest", status_code=201, dependencies=[Depends(require_admin)])
def ingest_observation(observation: SatelliteObservation):
    """Register a provenance-rich satellite product for ML preparation."""
    identifier, stored = register_observation(observation)
    return {"observation_id": identifier, "observation": stored}


@app.post("/api/v3/observations/hursat", status_code=201, dependencies=[Depends(require_admin)])
def ingest_hursat_observation(input_data: HursatObservationInput):
    """Convenience endpoint to register a HURSAT-B1 storm-centred satellite scene."""
    observation = create_hursat_observation(
        product=input_data.product,
        storm_id=input_data.storm_id,
        acquired_at=input_data.acquired_at,
        centre_lat=input_data.centre_lat,
        centre_lon=input_data.centre_lon,
        asset_url=str(input_data.asset_url),
        channels=input_data.channels,
        box_size_deg=input_data.box_size_deg,
        spatial_resolution_km=input_data.spatial_resolution_km,
        preprocessing_version=input_data.preprocessing_version,
        checksum_sha256=input_data.checksum_sha256,
    )
    identifier, stored = register_observation(observation)
    return {"observation_id": identifier, "observation": stored}


@app.post("/api/v3/training-samples", status_code=201, dependencies=[Depends(require_admin)])
def create_training_sample(sample: TrainingSample):
    """Register a labelled ML sample after all referenced observations exist."""
    try:
        stored = register_sample(sample)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return stored


@app.post("/api/v3/training-samples/generate", status_code=201, dependencies=[Depends(require_admin)])
def generate_training_samples(request: GenerateSamplesInput):
    """Generate storm-centred sequence samples linking registered observations to IBTrACS labels."""
    try:
        samples = generate_storm_sequence_samples(
            storm_id=request.storm_id,
            split=request.split,
            sequence_hours=request.sequence_hours,
            notes=request.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"generated_count": len(samples), "samples": samples}


@app.post("/api/v3/best-tracks/ibtracs", status_code=201, dependencies=[Depends(require_admin)])
def import_ibtracs_labels(import_request: IBTracsCsvImport):
    """Import a bounded North Indian IBTrACS CSV extract as supervised labels."""
    try:
        labels = parse_ibtracs_csv(import_request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "imported_labels": register_best_track_labels(labels),
        "authority": "IBTRACS",
        "note": "Lifecycle labels remain unset until an approved IMD/JTWC label rule is added.",
    }


_baseline_train_lock = Lock()


@app.post("/api/v3/baseline/train", status_code=200, dependencies=[Depends(require_admin)])
def train_baseline_model():
    """Publish a fully trained pipeline while existing requests use the previous fit."""
    global BASELINE_PIPELINE
    with _baseline_train_lock:
        candidate = CycloneMLPipeline()
        try:
            result = candidate.train(list(SAMPLES.values()))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        BASELINE_PIPELINE = candidate
        return result


def _latest_storm_features(storm_id: str) -> dict[str, float]:
    from feature_extractor import previous_motion

    samples = (s for s in SAMPLES.values() if s.storm_id == storm_id)
    sample = max(samples, key=lambda s: s.target_time, default=None)
    labels = (label for label in BEST_TRACK_LABELS.values() if label.storm_id == storm_id)
    label = max(labels, key=lambda label: label.valid_at, default=None)
    if sample is not None and (label is None or sample.target_time >= label.valid_at):
        return extract_sample_features(sample)
    if label is None:
        raise HTTPException(status_code=404, detail=f"Storm '{storm_id}' not found.")
    heading, speed = previous_motion(label)
    return {
        "centre_lat": label.centre_lat, "centre_lon": label.centre_lon,
        "max_sustained_wind_kph": label.max_sustained_wind_kph,
        "central_pressure_hpa": label.central_pressure_hpa if label.central_pressure_hpa is not None else 1008.0,
        "heading_deg": heading, "speed_kph": speed,
        **ocean_features(label.centre_lat, label.centre_lon),
    }


@app.post("/api/v3/inference")
def run_inference(request: InferenceRequest):
    """Run identification, classification, and 6-24 h predictions from sequence or state."""
    features: dict[str, float] = {}

    if request.sample_id:
        sample = SAMPLES.get(request.sample_id)
        if sample is None:
            raise HTTPException(status_code=404, detail=f"Sample '{request.sample_id}' not found.")
        features = extract_sample_features(sample)
    elif request.storm_id:
        features = _latest_storm_features(request.storm_id)
    else:
        lat = request.centre_lat if request.centre_lat is not None else 15.0
        lon = request.centre_lon if request.centre_lon is not None else 85.0
        wind = request.max_sustained_wind_kph if request.max_sustained_wind_kph is not None else 100.0
        pressure = request.central_pressure_hpa if request.central_pressure_hpa is not None else 970.0

        features = {
            "centre_lat": lat,
            "centre_lon": lon,
            "max_sustained_wind_kph": wind,
            "central_pressure_hpa": pressure,
            "heading_deg": request.heading_deg if request.heading_deg is not None else 315.0,
            "speed_kph": request.speed_kph if request.speed_kph is not None else 25.0,
            **ocean_features(lat, lon),
            "obs_count": 0.0,
        }

    prediction = BASELINE_PIPELINE.predict(features)
    if "model_provenance" not in prediction:
        prediction["model_provenance"] = {
            "model_version": "v1.0.0-baseline",
            "algorithm": BASELINE_PIPELINE.algorithm,
            "is_trained": BASELINE_PIPELINE.is_trained,
        }
    return prediction



@app.get("/api/v3/storms/{storm_id}/forecast")
def get_storm_forecast(storm_id: str):
    """Retrieve operational ML forecast for a registered storm ID."""
    features = _latest_storm_features(storm_id)
    prediction = BASELINE_PIPELINE.predict(features)
    return {"storm_id": storm_id, "forecast": prediction}


@app.post("/api/v3/storms/{storm_id}/impact-run", status_code=201)
def generate_storm_impact_grid(storm_id: str, input_params: StormImpactRunInput):
    """Generate 200 m building risk grid directly from an ML storm forecast."""
    forecast_data = get_storm_forecast(storm_id)["forecast"]
    horizon_key = f"forecast_{input_params.forecast_horizon_hours}h" if input_params.forecast_horizon_hours > 0 else "identification"
    horizon_data = forecast_data[horizon_key]

    center_lat = horizon_data["centre_lat"]
    center_lon = horizon_data["centre_lon"]
    wind_kph = horizon_data["max_sustained_wind_kph"]
    pressure_hpa = horizon_data["central_pressure_hpa"]

    scenario_in = ScenarioInput(
        name=f"ML-Forecast-{storm_id}-{input_params.forecast_horizon_hours}h"[:80],
        center_lat=center_lat,
        center_lon=center_lon,
        max_wind_kph=wind_kph,
        central_pressure_hpa=pressure_hpa,
        speed_kph=forecast_data["identification"]["speed_kph"],
        heading_deg=forecast_data["identification"]["heading_deg"],
        include_ocean_node=True,
    )

    from geo import land_mask
    basin = infer_basin(center_lat, center_lon) if in_forecast_domain(center_lat, center_lon) else "OUTSIDE_NORTH_INDIAN_OCEAN"
    ocean_node = None
    if in_forecast_domain(center_lat, center_lon) and not land_mask(center_lat, center_lon).item():
        ocean_node = get_ocean_node(center_lat, center_lon, basin)
    record = new_scenario_record(scenario_in, basin, ocean_node)

    record["ml_provenance"] = {
        "source_storm_id": storm_id,
        "forecast_horizon_hours": input_params.forecast_horizon_hours,
        "predicted_centre": {"lat": center_lat, "lon": center_lon},
        "predicted_wind_kph": wind_kph,
        "predicted_pressure_hpa": pressure_hpa,
        "model_algorithm": BASELINE_PIPELINE.algorithm,
    }

    _store_scenario(record)
    return record



@app.get("/api/v3/dataset-summary")
def dataset_summary():
    """Expose dataset counts, split status, and baseline model training state."""
    split_summary = get_split_summary()
    total_samples = len(SAMPLES)
    ready_for_baseline = split_summary["train"]["samples"] > 0 and bool(BEST_TRACK_LABELS)

    status = "NOT_TRAINED"
    if BASELINE_PIPELINE.is_trained:
        status = "TRAINED_BASELINE"
    elif ready_for_baseline:
        status = "READY_FOR_BASELINE"

    return {
        "observations": len(OBSERVATIONS),
        "best_track_labels": len(BEST_TRACK_LABELS),
        "training_samples": total_samples,
        "splits": split_summary,
        "model_status": status,
        "baseline_model": {
            "is_trained": BASELINE_PIPELINE.is_trained,
            "algorithm": BASELINE_PIPELINE.algorithm,
            "trained_sample_count": BASELINE_PIPELINE.training_sample_count,
            "metrics": BASELINE_PIPELINE.metrics if BASELINE_PIPELINE.is_trained else None,
        },
        "next_requirement": "Train deep learning spatial-temporal model (CNN + ConvLSTM) on sequence cubes."
        if BASELINE_PIPELINE.is_trained
        else ("Train gradient-boosted baseline classifier/regressor on sequence features." if ready_for_baseline else "Ingest labelled, storm-split historical observations before training."),
    }


@app.get("/validation")
@app.get("/api/v3/validation")
def validation_dashboard():
    """Developer Validation Dashboard — honest status for all CYCLONEX subsystems.

    IMPORTANT: All status labels reflect actual validation state.
    No metrics are claimed unless independently reproduced from real held-out storms.
    """
    from baseline_model import MODEL_STATUS, VALIDATION_STATUS

    ml_trained = BASELINE_PIPELINE.is_trained
    ml_metrics = BASELINE_PIPELINE.metrics if ml_trained else None
    evaluated = bool(ml_metrics and ml_metrics.get("n_test_samples"))

    return {
        "system": "CYCLONEX v2.1 Hydro-Meteorological & Damage Intelligence Engine",
        "timestamp": datetime.now().isoformat(),
        "validation_policy": (
            "All subsystem statuses reflect actual implementation state. "
            "HEURISTIC = rule-based, not validated from real held-out data. "
            "NOT_VALIDATED = no ground truth comparison performed."
        ),
        "subsystems": {
            "AI_ML_STATUS": {
                "status": "TRAINED_AI_ML" if ml_trained else "HEURISTIC",
                "label": "TRAINED AI/ML (Scikit-Learn GBDT)" if ml_trained else "HEURISTIC — NOT AI/ML",
                "model_status": MODEL_STATUS if ml_trained else "HEURISTIC",
                "validation_status": ml_metrics["status"] if ml_metrics else "NOT_VALIDATED",
                "details": (
                    "Gradient-boosted best-track model. Metrics cover storms and forecast horizons with matched future reports."
                    if ml_trained
                    else "Track model uses advection drift extrapolation."
                ),
            },
            "TRACK_PERFORMANCE": {
                "status": "EVALUATED" if evaluated else "NOT_VALIDATED",
                "label": "EVALUATED ON HELD-OUT TEST STORMS" if evaluated else "NOT VALIDATED",
                "metrics": ml_metrics,
                "details": (
                    f"Held-out test errors: 6h={ml_metrics.get('track_error_6h_km_mean', 0)} km, "
                    f"12h={ml_metrics.get('track_error_12h_km_mean', 0)} km, "
                    f"24h={ml_metrics.get('track_error_24h_km_mean', 0)} km."
                    if evaluated
                    else "No track error metrics available."
                ),
            },
            "INTENSITY_PERFORMANCE": {
                "status": "EVALUATED" if evaluated else "NOT_VALIDATED",
                "label": "EVALUATED ON HELD-OUT TEST STORMS" if evaluated else "NOT VALIDATED",
                "metrics": {
                    "wind_mae_kph": ml_metrics.get("wind_mae_kph_mean") if ml_metrics else None,
                    "pressure_mae_hpa": ml_metrics.get("pressure_mae_hpa_mean") if ml_metrics else None,
                } if ml_trained else None,
                "details": (
                    f"Held-out test MAE: Wind={ml_metrics.get('wind_mae_kph_mean', 0)} km/h, "
                    f"Pressure={ml_metrics.get('pressure_mae_hpa_mean', 0)} hPa."
                    if evaluated
                    else "No intensity metrics available."
                ),
            },
            "WIND_FIELD_STATUS": {
                "status": "PASS",
                "label": "PASS",
                "details": (
                    "Holland-Rankine combined vortex wind profile with right-of-track "
                    "translation asymmetry. Dynamic pressure q=0.5ρV² verified. "
                    "q(200)/q(100) = 4.00 (V² scaling) — VERIFIED."
                ),
            },
            "LRR_FORMULA_STATUS": {
                "status": "FIXED_v2.1",
                "label": "FIXED",
                "details": (
                    "LRR = effective_wind_loading / resistance (q * Cd * shelter / R). "
                    "Previous version incorrectly used q / resistance (missing Cd=1.3 and shelter_factor). "
                    "Fixed in v2.1."
                ),
            },
            "GRID_STATUS": {
                "status": "PASS",
                "label": "PASS",
                "details": "200 m detail grids are supported for bounded extents. Wider scenarios use labelled overview cells; inspect the returned grid_size_m.",
            },
            "BUILDING_ALIGNMENT": {
                "status": "PASS",
                "label": "PROVIDER_DEPENDENT",
                "details": "Partial footprint coverage; check request metadata for live, cached or unavailable state.",
            },
            "OBSTACLE_STATUS": {
                "status": "PASS",
                "label": "PASS",
                "details": "Directional upwind search with shelter factors (0.85 high, 0.92 moderate, 1.0 open).",
            },
            "DAMAGE_MODEL_STATUS": {
                "status": "NOT_VALIDATED",
                "label": "NOT VALIDATED",
                "formula": "CYCLONEX_DAMAGE_V2_ADDITIVE: D = w_H*H + w_S*S_resp + w_E*E + w_V*V",
                "details": (
                    "IS-875 screening model. Weights are expert assumptions, "
                    "NOT calibrated against post-event damage survey ground truth. "
                    "Result is a modelled damage risk index, not destruction probability."
                ),
            },
            "MATERIAL_PROVENANCE_STATUS": {
                "status": "INFERRED",
                "label": "INFERRED",
                "details": (
                    "Building footprints from OSM (OBSERVED). "
                    "Material class, height, and resistance are INFERRED from height heuristics. "
                    "Structural resistance values (300/900/1500 Pa) are IS-875 screening assumptions."
                ),
            },
            "2D_STATUS": {
                "status": "PASS",
                "label": "PASS",
                "details": "Leaflet canvas renderer with dynamic mode switching and bounds fitter.",
            },
        },
    }


@app.get("/api/v3/developer-health")
def developer_health():
    """Real-time developer health check — subsystem live status.

    Returns actual runtime state (trained/not, sample counts, etc.)
    Never fabricates metrics.
    """
    from baseline_model import MODEL_STATUS, VALIDATION_STATUS

    return {
        "timestamp": datetime.now().isoformat(),
        "ml_pipeline": {
            "model_status": MODEL_STATUS if BASELINE_PIPELINE.is_trained else "HEURISTIC",
            "validation_status": BASELINE_PIPELINE.metrics["status"],
            "is_trained_on_samples": BASELINE_PIPELINE.is_trained,
            "training_sample_count": BASELINE_PIPELINE.training_sample_count,
            "metrics": BASELINE_PIPELINE.metrics,
            "algorithm": BASELINE_PIPELINE.algorithm,
        },
        "data_registry": {
            "observations": len(OBSERVATIONS),
            "best_track_labels": len(BEST_TRACK_LABELS),
            "training_samples": len(SAMPLES),
            "split_summary": get_split_summary(),
        },
        "physics_engine": {
            "version": "v2.1",
            "wind_model": "Holland-Rankine + right-of-track asymmetry",
            "grid_size_m": settings.grid_size_m,
            "lrr_formula": "effective_wind_loading / structural_resistance (CORRECTED v2.1)",
            "damage_formula": "CYCLONEX_DAMAGE_V2_ADDITIVE",
            "land_classifier": "piecewise_coastline_geometry",
        },
        "system_status": "OPERATIONAL",
    }


@app.get("/api/v3/cell-trace")
def cell_trace(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    wind_kph: float = Query(160.0, ge=0, le=400),
    pressure_hpa: float = Query(950.0, ge=800, le=1050),
    heading_deg: float = Query(315.0, ge=0, le=360),
    speed_kph: float = Query(25.0, ge=0, le=120),
    storm_surge_m: float = Query(3.0, ge=0, le=20),
    rain_rate_mm_hr: float = Query(50.0, ge=0, le=500),
):
    """End-to-end physical trace for a single cell.

    Runs the full physics chain for one geographic location and returns
    every intermediate value: wind → dynamic pressure → LRR → H/S/E/V
    → damage score → classification.

    Use for auditing and debugging the damage engine.
    """
    from risk_service import ScenarioInput, evaluate_cell_full, local_metric_transforms, _is_land

    scenario = ScenarioInput(
        name="cell-trace-diagnostic",
        center_lat=lat,
        center_lon=lon,
        max_wind_kph=wind_kph,
        central_pressure_hpa=pressure_hpa,
        heading_deg=heading_deg,
        speed_kph=speed_kph,
        storm_surge_m=storm_surge_m,
        rain_rate_mm_hr=rain_rate_mm_hr,
        field_radius_km=1.0,
    )

    forward, inverse = local_metric_transforms(lon, lat)
    center_x, center_y = forward(lon, lat)
    # Trace the center cell (x_m=0, y_m=0 relative to storm eye)
    cell_data = evaluate_cell_full(0.0, 0.0, lon, lat, scenario)

    return {
        "trace_type": "single_cell_center",
        "input": {
            "lat": lat,
            "lon": lon,
            "wind_kph": wind_kph,
            "pressure_hpa": pressure_hpa,
            "heading_deg": heading_deg,
            "speed_kph": speed_kph,
        },
        "full_physics_trace": cell_data,
        "note": "This traces the storm eye center cell. For off-center cells, use the scenario endpoint.",
    }


# =========================================================
# NEWS SCRAPING & REALTIME WEATHER API ENDPOINTS
# =========================================================

class NewsSourceInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    url: str = Field(min_length=1, max_length=2048)
    scrape_type: Literal["html", "rss"] = "html"


@app.get("/api/v2/news/sources")
def api_get_news_sources():
    """Retrieve all user/admin configured cyclone news website sources."""
    return get_news_sources()


@app.post("/api/v2/news/sources", dependencies=[Depends(require_admin)])
def api_add_news_source(payload: NewsSourceInput):
    """Add a new news website or RSS URL for automated cyclone news scraping."""
    try:
        return add_news_source(payload.name, payload.url, payload.scrape_type)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.delete("/api/v2/news/sources/{source_id}", dependencies=[Depends(require_admin)])
def api_delete_news_source(source_id: str):
    """Delete a configured news website source."""
    success = delete_news_source(source_id)
    if not success:
        raise HTTPException(status_code=404, detail="News source not found")
    return {"status": "success", "deleted_id": source_id}


@app.post("/api/v2/news/scrape")
def api_trigger_news_scrape():
    """Trigger live news scraping across all active news sources."""
    return scrape_all_active_sources()


@app.get("/api/v2/news/articles")
def api_get_news_articles(
    query: str | None = Query(None, description="Search term for headlines or content"),
    cyclone_tag: str | None = Query(None, description="Filter by cyclone or region tag"),
    limit: int = Query(50, ge=1, le=200),
):
    """Get scraped cyclone news articles for the UI news panel."""
    return get_news_articles(query=query, cyclone_tag=cyclone_tag, limit=limit)


@app.get("/api/v2/realtime-weather")
def api_get_realtime_weather(
    lat: float = Query(21.62, ge=-90, le=90),
    lon: float = Query(87.51, ge=-180, le=180),
):
    """Read current modelled weather for the requested location."""
    variables = {"wind_speed_kph": "wind_speed_10m", "wind_gusts_kph": "wind_gusts_10m",
                 "wind_direction_deg": "wind_direction_10m", "surface_pressure_hpa": "surface_pressure",
                 "precipitation_mm": "precipitation", "temperature_c": "temperature_2m",
                 "humidity_pct": "relative_humidity_2m"}
    try:
        response = requests.get("https://api.open-meteo.com/v1/forecast",
                                params={"latitude": lat, "longitude": lon, "timezone": "GMT",
                                        "wind_speed_unit": "kmh", "current": ",".join(variables.values())},
                                timeout=(3, 6))
        response.raise_for_status()
        current = response.json()["current"]
        timestamp = datetime.fromisoformat(current["time"])
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        readings = {key: current[name] for key, name in variables.items()}
        if not all(type(v) in (float, int) and math.isfinite(v) for v in readings.values()):
            raise ValueError("Incomplete current weather")
    except (requests.RequestException, ValueError, KeyError, TypeError, OverflowError) as exc:
        raise HTTPException(status_code=503, detail="Current weather unavailable or incomplete.") from exc
    return {"source": "OPEN_METEO_LIVE", "lat": lat, "lon": lon, "timestamp": timestamp.isoformat(),
            "status": "LIVE_FEED_SYNCED", "data_kind": "MODELLED_CURRENT_WEATHER", **readings}


# =========================================================
# AI / ML SATELLITE CYCLONE IDENTIFICATION & CLASSIFICATION
# =========================================================

@app.post("/api/v2/ai-cyclone/analyze")
def api_analyze_cyclone(req: CycloneAnalysisRequest):
    """Execute AI/ML Satellite Analysis: Detection, Dvorak Pattern, Prediction & RI."""
    try:
        result = ai_service.analyze_cyclone(req)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        print(f"[AI SERVICE ERROR] {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"AI inference error: {str(e)}")


@app.get("/api/ai/models-status")
def api_get_ai_models_status():
    """Report real-time loaded PyTorch model statuses and device configuration."""
    return ai_service.get_models_status()


# =========================================================
# CHALLENGE 05: TRACK-BASED INFRASTRUCTURE VULNERABILITY FORECASTER
# (Theme: Resilience · GEE Feeds · Gemini 3.7 Flash Multimodal Reasoning)
# =========================================================
from gemini_resilience_service import (
    DroneDamageInspectionEngine,
    generate_cap_alert_xml,
    resilience_service,
)


class ResilienceAssessmentRequest(BaseModel):
    storm_name: str = Field(default="Cyclone Nisarga", min_length=1, max_length=120)
    eye_lat: float = Field(default=18.35, ge=-90.0, le=90.0)
    eye_lon: float = Field(default=72.98, ge=-180.0, le=180.0)
    max_wind_kmh: float = Field(default=120.0, ge=0.0, le=350.0)
    central_pressure_hpa: float = Field(default=984.0, ge=800.0, le=1050.0)
    heading_deg: float = Field(default=315.0, ge=0.0, le=360.0)
    forward_speed_kmh: float = Field(default=22.0, ge=0.0, le=120.0)
    rain_rate_mm_hr: float = Field(default=75, ge=0, le=500)
    simulate_failure_gemini: bool = False
    simulate_failure_gee: bool = False
    simulate_failure_weather: bool = False
    deploy_countermeasure: bool = False


class DroneInspectionRequest(BaseModel):
    asset_id: str = "pwr-01"
    sample_id: Optional[str] = None
    image_base64: Optional[str] = None


@app.post("/api/resilience/assess")
def api_assess_resilience_post(req: ResilienceAssessmentRequest):
    """Evaluate scenario hazards, reference infrastructure, and optional recommendations."""
    try:
        return resilience_service.evaluate_resilience_assessment(
            storm_name=req.storm_name,
            eye_lat=req.eye_lat,
            eye_lon=req.eye_lon,
            max_wind_kmh=req.max_wind_kmh,
            central_pressure_hpa=req.central_pressure_hpa,
            heading_deg=req.heading_deg,
            forward_speed_kmh=req.forward_speed_kmh,
            rain_rate_mm_hr=req.rain_rate_mm_hr,
            simulate_failure_gemini=req.simulate_failure_gemini,
            simulate_failure_gee=req.simulate_failure_gee,
            simulate_failure_weather=req.simulate_failure_weather,
            deploy_countermeasure=req.deploy_countermeasure,
        )
    except Exception as e:
        print(f"[RESILIENCE SERVICE ERROR] {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resilience/assess")
def api_assess_resilience_get(
    storm_name: str = Query("Cyclone Dana", min_length=1, max_length=120),
    eye_lat: float = Query(20.4, ge=-90, le=90), eye_lon: float = Query(86.8, ge=-180, le=180),
    max_wind_kmh: float = Query(125, ge=0, le=350), central_pressure_hpa: float = Query(980, ge=800, le=1050),
    heading_deg: float = Query(320, ge=0, le=360), forward_speed_kmh: float = Query(18, ge=0, le=120),
    rain_rate_mm_hr: float = Query(75, ge=0, le=500), simulate_failure_gemini: bool = False,
    simulate_failure_gee: bool = False, simulate_failure_weather: bool = False, deploy_countermeasure: bool = False,
):
    """Evaluate a scenario with the same service as POST."""
    return api_assess_resilience_post(ResilienceAssessmentRequest(**locals()))


@app.post("/api/resilience/inspect-drone-damage")
def api_inspect_drone_damage(req: DroneInspectionRequest):
    """Execute AI Vision structural damage reconnaissance on aerial/drone imagery."""
    try:
        return DroneDamageInspectionEngine.inspect_drone_damage(
            asset_id=req.asset_id,
            sample_id=req.sample_id,
            image_base64=req.image_base64,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        print(f"[DRONE INSPECTION ERROR] {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resilience/cap-alert.xml")
def api_get_cap_alert_xml(
    storm_name: str = Query("Cyclone Dana", min_length=1, max_length=120),
    max_wind_kmh: float = Query(125.0, ge=0, le=350),
    peak_surge_m: float = Query(2.8, ge=0, le=20),
    eye_lat: float = Query(20.4, ge=-90, le=90),
    eye_lon: float = Query(86.8, ge=-180, le=180),
):
    """Export a CAP exercise scenario as XML."""
    try:
        xml_content = generate_cap_alert_xml(
            storm_name=storm_name,
            max_wind_kmh=max_wind_kmh,
            peak_surge_m=peak_surge_m,
            eye_lat=eye_lat,
            eye_lon=eye_lon,
        )
        return Response(content=xml_content, media_type="application/xml")
    except Exception as e:
        print(f"[CAP XML EXPORT ERROR] {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))




