"""
main.py
-------
FastAPI backend for CYCLONEX's map-picker-driven ocean data trial.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Then open http://127.0.0.1:8000/docs for interactive testing, or call:
    GET /api/ocean-node?lat=15.2&lon=87.4

This is designed to be called from the existing React map picker:
when the user clicks a coordinate on CycloneMap.tsx, the frontend
hits this endpoint and gets back real (or clearly-labeled fallback)
TB/VF data to feed into the prediction engine, instead of the
currently-hardcoded synthetic ocean parameters.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ocean_service import get_ocean_node

app = FastAPI(
    title="CYCLONEX Ocean Data Service",
    description="Fetches subsurface ocean TB/VF data for a picked map coordinate.",
    version="0.1.0-trial",
)

# Tighten allow_origins before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def infer_basin(lat: float, lon: float) -> str:
    """Mirrors the basin-split logic already used in the frontend's realtimeMetFeed.ts."""
    if lon >= 77.5 or (lat < 8.0 and lon >= 76.0):
        return "BAY_OF_BENGAL"
    return "ARABIAN_SEA"


@app.get("/api/ocean-node")
def ocean_node(
    lat: float = Query(..., ge=-90, le=90, description="Latitude of the picked map point"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude of the picked map point"),
):
    """
    Returns the TB (temperature-based layers) and VF (vertical
    features) node for a single map-picked coordinate.
    """
    # Sanity-guard: keep this trial scoped to the North Indian Ocean
    if not (0 <= lat <= 30 and 45 <= lon <= 100):
        raise HTTPException(
            status_code=400,
            detail="Coordinate is outside the North Indian Ocean domain this trial covers "
                   "(lat 0-30, lon 45-100). Pick a point within the Bay of Bengal / Arabian Sea.",
        )

    basin = infer_basin(lat, lon)
    result = get_ocean_node(lat, lon, basin)
    result["basin"] = basin
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
