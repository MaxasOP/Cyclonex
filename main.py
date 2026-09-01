from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from building_service import fetch_buildings
from ocean_service import get_ocean_node
from ibtracs_service import parse_ibtracs_csv
from ml_registry import (
    BEST_TRACK_LABELS,
    OBSERVATIONS,
    SAMPLES,
    register_best_track_labels,
    register_observation,
    register_sample,
)
from ml_schema import IBTracsCsvImport, SatelliteObservation, TrainingSample
from risk_service import ScenarioInput, new_scenario_record

app = FastAPI(
    title="CYCLONEX Ocean Data Service",
    description="Fetches subsurface ocean TB/VF data for a picked map coordinate.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allowed_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "CYCLONEX Ocean Data Service",
        "status": "online",
        "endpoints": {
            "ocean_node": "/api/ocean-node?lat={lat}&lon={lon}",
            "health": "/health",
            "docs": "/docs",
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


# Replace this with PostGIS-backed storage before production multi-instance use.
# Keeping it explicit prevents an in-memory demo from being mistaken for durable data.
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


@app.post("/api/v3/training-samples", status_code=201)
def create_training_sample(sample: TrainingSample):
    """Register a labelled ML sample after all referenced observations exist."""
    try:
        stored = register_sample(sample)
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return stored


@app.post("/api/v3/best-tracks/ibtracs", status_code=201)
def import_ibtracs_labels(import_request: IBTracsCsvImport):
    """Import a bounded North Indian IBTrACS CSV extract as supervised labels."""
    labels = parse_ibtracs_csv(import_request)
    return {
        "imported_labels": register_best_track_labels(labels),
        "authority": "IBTRACS",
        "note": "Lifecycle labels remain unset until an approved IMD/JTWC label rule is added.",
    }


@app.get("/api/v3/dataset-summary")
def dataset_summary():
    """Expose dataset counts without claiming a trained model exists."""
    return {
        "observations": len(OBSERVATIONS),
        "best_track_labels": len(BEST_TRACK_LABELS),
        "training_samples": len(SAMPLES),
        "model_status": "NOT_TRAINED",
        "next_requirement": "Ingest labelled, storm-split historical observations before training.",
    }
