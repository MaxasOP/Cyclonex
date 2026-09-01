# CYCLONEX - Ocean Data Backend

A FastAPI service that returns subsurface-ocean nodes and creates transparent
200 m cyclone risk-grid scenarios.

```
Water Column
├── TB (Temperature-Based layers): 0m, 10m, 50m, 100m, 200m
├── VF (Vertical Features): temp gradient, salinity gradient, OHC, MLD
└── Nodes: one record per (lat, lon)
```

## API versions

`/api/ocean-node` is the stable water-column endpoint. It preserves the
faculty-mentor model:

`/api/v2/scenarios` creates a cyclone screening scenario with a 200 m GeoJSON
risk grid. It incorporates wind, central-pressure deficit, rain, surge,
coastal exposure, assumed vulnerability, a fixed 90-degree wind-incidence
constraint, and an optional TB/VF ocean-node snapshot.

Risk colours are deterministic:

- Sky blue: no modelled damage
- Green: low impact / safe
- Orange: damage occurrence likely
- Red: severe damage risk

`/api/v2/scenarios/{id}/buildings` imports available OpenStreetMap building
footprints on demand. Dark blue is the default building state; a cell risk
colour overrides it. A white outline marks a building recorded as taller than
at least one neighbour within 15 m.

## Important limitation

This is an explainable screening model, not a structural engineering damage
certificate. Building height can be absent or estimated in OpenStreetMap, and
the model's vulnerability factor must be calibrated against historical damage
before operational use.

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

## Scenario request

```bash
curl -X POST "http://127.0.0.1:8000/api/v2/scenarios" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bay of Bengal run","center_lat":15.2,"center_lon":87.4,"max_wind_kph":180,"central_pressure_hpa":940,"rain_rate_mm_hr":70,"storm_surge_m":2.5}'
```

## Deploying with Vercel and Render

1. Deploy this backend to Render.
2. Deploy `frontend/` as a separate Vercel project.
3. In Vercel, set `VITE_API_BASE_URL` to the Render service URL and add the
   browser-restricted `VITE_GOOGLE_MAPS_API_KEY`.
4. In Render, set `CORS_ALLOWED_ORIGINS` to the Vercel production URL plus
   `http://localhost:5173` for development.
5. Do not add the browser Maps key to Render. A separate server key is needed
   only if a future backend adapter calls a Google server-side API.

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
