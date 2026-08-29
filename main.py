from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ocean_service import get_ocean_node

app = FastAPI(
    title="CYCLONEX Ocean Data Service",
    description="Fetches subsurface ocean TB/VF data for a picked map coordinate.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {"status": "ok"}
