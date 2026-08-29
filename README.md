# CYCLONEX — Ocean Data Backend (Trial)

A small FastAPI service that takes a **map-picked lat/lon** and returns
real subsurface ocean data, structured exactly per your faculty
mentor's diagram:

```
Water Column
├── TB (Temperature-Based layers): 0m, 10m, 50m, 100m, 200m
├── VF (Vertical Features): temp gradient, salinity gradient, OHC, MLD
└── Nodes: one record per (lat, lon)
```

## Why this exists

The current CYCLONEX frontend (`predictionEngine.ts`) fakes ocean
conditions with hand-tuned formulas — there's no real subsurface data
behind it. This backend is step one of replacing that: given a
coordinate, it fetches an actual gridded ocean reanalysis (HYCOM, via
a free public server) and computes the derived vertical features from
it, instead of guessing.

## Data source

**PacIOOS ERDDAP → HYCOM Global Ocean Forecast System**
`https://pae-paha.pacioos.hawaii.edu/erddap/griddap/hycom_global`


## What happens if live data fails

Every response includes `meta.source`:
- `"LIVE"` — real HYCOM numbers for that exact point/day
- `"ESTIMATED_CLIMATOLOGY"` — a physically-motivated fallback (basin-typical
  thermocline profile), used only if the live fetch fails. **Never
  silently presented as real** — always check this field before you
  trust a demo run.

## Setup

```bash
cd cyclonex-backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` for interactive Swagger UI, or call directly:

```bash
curl "http://127.0.0.1:8000/api/ocean-node?lat=15.2&lon=87.4"
```

## Example response

```json
{
  "node": { "lat": 15.2, "lon": 87.4 },
  "TB": { "0": 29.6, "10": 29.43, "50": 27.81, "100": 24.17, "200": 18.27 },
  "VF": {
    "temperature_gradient_c_per_m": {
      "by_layer": { "0-10m": -0.017, "10-50m": -0.0405, "50-100m": -0.0728, "100-200m": -0.059 },
      "overall_0_to_200m": -0.0567
    },
    "salinity_gradient_psu_per_m": 0.0075,
    "ocean_heat_content_kj_cm2": 64.11,
    "depth_of_26c_isotherm_m": 74.9,
    "mixed_layer_depth_m": 22.3
  },
  "meta": {
    "source": "ESTIMATED_CLIMATOLOGY",
    "provider": "Basin climatology fallback (not live telemetry)",
    "fetched_at": "2026-08-28T18:02:50Z",
    "salinity_psu": { "0": 33.5, "10": 33.58, "50": 33.88, "100": 34.25, "200": 35.0 }
  },
  "basin": "BAY_OF_BENGAL"
}
```
