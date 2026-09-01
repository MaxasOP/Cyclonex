from datetime import datetime
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl

from baseline_model import BASELINE_PIPELINE
from building_service import fetch_buildings
from config import settings
from feature_extractor import extract_sample_features
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

app = FastAPI(
    title="CYCLONEX Ocean Data Service",
    description="Fetches subsurface ocean TB/VF data and provides satellite-based cyclone ML endpoints.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allowed_origins) if settings.cors_allowed_origins else ["*"],
    allow_credentials=True if "*" not in settings.cors_allowed_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)



class HursatObservationInput(BaseModel):
    product: str = "HURSAT_B1_IR"
    acquired_at: datetime
    centre_lat: float
    centre_lon: float
    asset_url: HttpUrl
    channels: list[str] = ["IR_WINDBAND"]
    box_size_deg: float = 4.0
    spatial_resolution_km: float = 8.0
    preprocessing_version: str = "hursat_b1_v06_cropped"
    checksum_sha256: str | None = None


class GenerateSamplesInput(BaseModel):
    storm_id: str
    split: Literal["train", "validation", "test"]
    sequence_hours: int = 24
    notes: str | None = None


class InferenceRequest(BaseModel):
    sample_id: str | None = None
    storm_id: str | None = None
    centre_lat: float | None = Field(default=None, ge=-90, le=90)
    centre_lon: float | None = Field(default=None, ge=-180, le=180)
    max_sustained_wind_kph: float | None = Field(default=None, ge=0, le=400)
    central_pressure_hpa: float | None = Field(default=None, ge=800, le=1050)


class StormImpactRunInput(BaseModel):
    forecast_horizon_hours: Literal[0, 6, 12, 24] = 24
    building_density: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    construction_quality: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    sea_level_rise_m: float = 0.0


@app.get("/")
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

    basin = infer_basin(lat, lon)
    result = get_ocean_node(lat, lon, basin)
    result["basin"] = basin
    return result


@app.get("/health")
def health():
    return {
        "status": "ok",
        "integrations": {
            "google_maps": "configured"
            if settings.google_maps_browser_api_key
            else "not_configured",
            "cyclone_forecast": "configured"
            if settings.cyclone_forecast_api_key
            else "not_configured",
            "database": "configured" if settings.database_url else "not_configured",
        },
        "model_constraints": {
            "grid_size_m": settings.grid_size_m,
            "wind_incidence_angle_deg": settings.wind_incidence_angle_deg,
        },
    }


SCENARIOS: dict[str, dict] = {}


def _building_centroid(feature: dict) -> tuple[float, float]:
    ring = feature["geometry"]["coordinates"][0][:-1]
    return (
        sum(point[0] for point in ring) / len(ring),
        sum(point[1] for point in ring) / len(ring),
    )


def _containing_risk_cell(point: tuple[float, float], features: list[dict]) -> dict | None:
    lon, lat = point
    for feature in features:
        ring = feature["geometry"]["coordinates"][0]
        west, east = min(p[0] for p in ring), max(p[0] for p in ring)
        south, north = min(p[1] for p in ring), max(p[1] for p in ring)
        if west <= lon <= east and south <= lat <= north:
            return feature
    return None


@app.post("/api/v2/scenarios", status_code=201)
def create_scenario(scenario: ScenarioInput):
    """Create a reproducible 200 m cyclone risk-grid screening scenario."""
    basin = None
    ocean_node = None
    in_ocean_domain = 0 <= scenario.center_lat <= 30 and 45 <= scenario.center_lon <= 100
    if in_ocean_domain:
        basin = infer_basin(scenario.center_lat, scenario.center_lon)
        if scenario.include_ocean_node:
            ocean_node = get_ocean_node(scenario.center_lat, scenario.center_lon, basin)

    record = new_scenario_record(scenario, basin, ocean_node)
    SCENARIOS[record["id"]] = record
    return record


@app.get("/api/v2/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    scenario = SCENARIOS.get(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found or service was restarted.")
    return scenario


@app.get("/api/v2/scenarios/{scenario_id}/risk-grid")
def get_risk_grid(scenario_id: str):
    scenario = SCENARIOS.get(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found or service was restarted.")
    return scenario["risk_grid"]


@app.get("/api/v2/scenarios/{scenario_id}/buildings")
def get_scenario_buildings(scenario_id: str):
    """Return OpenStreetMap buildings for the scenario extent, when available."""
    scenario = SCENARIOS.get(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found or service was restarted.")
    features = scenario["risk_grid"]["features"]
    if not features:
        return {"type": "FeatureCollection", "features": [], "metadata": {}}
    points = [point for feature in features for point in feature["geometry"]["coordinates"][0]]
    west = min(point[0] for point in points)
    east = max(point[0] for point in points)
    south = min(point[1] for point in points)
    north = max(point[1] for point in points)
    try:
        buildings = fetch_buildings(south, west, north, east)
        for building in buildings["features"]:
            cell = _containing_risk_cell(_building_centroid(building), features)
            if cell is None:
                building["properties"].update(
                    {
                        "damage_score": None,
                        "classification": "OUTSIDE_RISK_GRID",
                        "display_colour": "#0a2a57",
                    }
                )
                continue
            risk = cell["properties"]
            building["properties"].update(
                {
                    "damage_score": risk["damage_score"],
                    "classification": risk["classification"],
                    "display_colour": risk["colour"],
                    "colour_source": "containing_200m_risk_cell",
                }
            )
        return buildings
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Building provider is unavailable. Try again later; no building geometry was substituted.",
        ) from exc


@app.post("/api/v3/observations/ingest", status_code=201)
def ingest_observation(observation: SatelliteObservation):
    """Register a provenance-rich satellite product for ML preparation."""
    identifier, stored = register_observation(observation)
    return {"observation_id": identifier, "observation": stored}


@app.post("/api/v3/observations/hursat", status_code=201)
def ingest_hursat_observation(input_data: HursatObservationInput):
    """Convenience endpoint to register a HURSAT-B1 storm-centred satellite scene."""
    observation = create_hursat_observation(
        product=input_data.product,
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


@app.post("/api/v3/training-samples", status_code=201)
def create_training_sample(sample: TrainingSample):
    """Register a labelled ML sample after all referenced observations exist."""
    try:
        stored = register_sample(sample)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return stored


@app.post("/api/v3/training-samples/generate", status_code=201)
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


@app.post("/api/v3/best-tracks/ibtracs", status_code=201)
def import_ibtracs_labels(import_request: IBTracsCsvImport):
    """Import a bounded North Indian IBTrACS CSV extract as supervised labels."""
    labels = parse_ibtracs_csv(import_request)
    return {
        "imported_labels": register_best_track_labels(labels),
        "authority": "IBTRACS",
        "note": "Lifecycle labels remain unset until an approved IMD/JTWC label rule is added.",
    }


@app.post("/api/v3/baseline/train", status_code=200)
def train_baseline_model():
    """Train gradient-boosted baseline ML classifier & regressor on registered samples."""
    samples = list(SAMPLES.values())
    if not samples:
        raise HTTPException(
            status_code=400,
            detail="No training samples registered. Ingest HURSAT observations and generate samples first.",
        )
    result = BASELINE_PIPELINE.train(samples)
    return result


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
        storm_samples = [s for s in SAMPLES.values() if s.storm_id == request.storm_id]
        if not storm_samples:
            raise HTTPException(status_code=404, detail=f"No samples found for storm '{request.storm_id}'.")
        features = extract_sample_features(storm_samples[-1])
    else:
        lat = request.centre_lat if request.centre_lat is not None else 15.0
        lon = request.centre_lon if request.centre_lon is not None else 85.0
        wind = request.max_sustained_wind_kph if request.max_sustained_wind_kph is not None else 100.0
        pressure = request.central_pressure_hpa if request.central_pressure_hpa is not None else 970.0

        basin = infer_basin(lat, lon)
        ocean = get_ocean_node(lat, lon, basin)

        features = {
            "centre_lat": lat,
            "centre_lon": lon,
            "max_sustained_wind_kph": wind,
            "central_pressure_hpa": pressure,
            "tb_deg_c": float(ocean.get("tb_deg_c", 27.5)),
            "vf_m": float(ocean.get("vf_m", 45.0)),
            "obs_count": 4.0,
            "avg_spatial_resolution_km": 8.0,
            "avg_box_width_deg": 4.0,
            "avg_box_height_deg": 4.0,
            "sequence_duration_hours": 24.0,
        }

    prediction = BASELINE_PIPELINE.predict(features)
    prediction["model_provenance"] = {
        "model_version": "v1.0.0-baseline",
        "algorithm": BASELINE_PIPELINE.algorithm,
        "is_trained": BASELINE_PIPELINE.is_trained,
    }
    return prediction


@app.get("/api/v3/storms/{storm_id}/forecast")
def get_storm_forecast(storm_id: str):
    """Retrieve operational ML forecast for a registered storm ID."""
    storm_samples = [s for s in SAMPLES.values() if s.storm_id == storm_id]
    if not storm_samples:
        labels = [l for l in BEST_TRACK_LABELS.values() if l.storm_id == storm_id]
        if not labels:
            raise HTTPException(status_code=404, detail=f"Storm '{storm_id}' not found.")
        latest_label = sorted(labels, key=lambda l: l.valid_at)[-1]
        lat, lon, wind, pressure = latest_label.centre_lat, latest_label.centre_lon, latest_label.max_sustained_wind_kph, latest_label.central_pressure_hpa or 980.0
        features = {
            "centre_lat": lat,
            "centre_lon": lon,
            "max_sustained_wind_kph": wind,
            "central_pressure_hpa": pressure,
            "tb_deg_c": 27.5,
            "vf_m": 45.0,
        }
    else:
        features = extract_sample_features(storm_samples[-1])

    prediction = BASELINE_PIPELINE.predict(features)
    return {"storm_id": storm_id, "forecast": prediction}


@app.post("/api/v3/storms/{storm_id}/impact-run", status_code=201)
def generate_storm_impact_grid(storm_id: str, input_params: StormImpactRunInput):
    """Generate 200 m building risk grid directly from an ML storm forecast."""
    forecast_data = get_storm_forecast(storm_id)["forecast"]
    horizon_key = f"forecast_{input_params.forecast_horizon_hours}h" if input_params.forecast_horizon_hours > 0 else "identification"
    horizon_data = forecast_data.get(horizon_key, forecast_data["identification"])

    center_lat = horizon_data.get("centre_lat", 15.0)
    center_lon = horizon_data.get("centre_lon", 85.0)
    wind_kph = horizon_data.get("max_sustained_wind_kph", 120.0)
    pressure_hpa = horizon_data.get("central_pressure_hpa", 960.0)

    scenario_in = ScenarioInput(
        name=f"ML-Forecast-{storm_id}-{input_params.forecast_horizon_hours}h"[:80],
        center_lat=center_lat,
        center_lon=center_lon,
        max_wind_kph=wind_kph,
        central_pressure_hpa=pressure_hpa,
        include_ocean_node=True,
    )

    basin = infer_basin(center_lat, center_lon)
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

    SCENARIOS[record["id"]] = record
    return record



@app.get("/api/v3/dataset-summary")
def dataset_summary():
    """Expose dataset counts, split status, and baseline model training state."""
    split_summary = get_split_summary()
    total_samples = len(SAMPLES)
    ready_for_baseline = total_samples > 0 and len(OBSERVATIONS) > 0 and len(BEST_TRACK_LABELS) > 0

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
