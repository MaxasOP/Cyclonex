# CYCLONEX

Cyclone scenario screening, baseline forecasting, and experimental image analysis.

- Frontend: https://cyclonex.vercel.app
- Backend: https://cyclonex.onrender.com
- API documentation: `/docs`; runtime diagnostics: `/health`, `/validation`, `/api/v3/developer-health`.

## Implemented behavior

- Scenarios produce a deterministic wind/loading and damage **screening index**. Terrain, exposure and resistance are approximate assumptions, not building-level engineering certification.
- **200 m detail** is available with `grid_resolution_m: 200` for bounded extents. The UI provides a 6 km radius detail run. Wider views automatically use a coarser overview grid, with actual resolution in `risk_grid.metadata.grid_size_m`. Explicit grids above 12,000 cells return HTTP 422.
- The radius of maximum winds defaults to an assumed 25 km and is independent of the displayed area. Cell inspection returns the exact calculation used by the rendered grid.
- Baseline forecasting uses the small bundled reference storm dataset. It is separate from the experimental satellite CNNs. Historical page tracks are schematic reference presets, not a verified hindcast report.
- Satellite analysis accepts base64 PNG/JPEG channels (`infrared`, `water_vapor`, `microwave`, `visible`). Uploaded pixels enter the model input in training channel order. Missing channels use explicitly labelled synthetic scene data. Ordinary images have no radiometric calibration, so no measured Dvorak CI is claimed from an upload.
- CNN checkpoints were trained on synthetic scenes and are **not validated on observed satellite storms**. The API reports `LOADED_EXPERIMENTAL` or `HEURISTIC_FALLBACK` per component. No calibrated confidence is claimed. Satellite lab diagrams are illustrations.
- Buildings use bundled reference footprints or a bounded live Overpass query. Missing footprints are never replaced with invented buildings. Metadata distinguishes cached/unverified footprints, partial live coverage and unavailable providers. Heights and materials may be unknown or inferred.
- Land-use partitions are synthesized screening zones, not observed land-use measurements.
- Shelter inventories are reference data. OSRM computes road-network routes to nearby reference shelters where possible. Live occupancy, flood clearance, safest-route optimization and capacity allocation are **not available**; no route is certified safe.
- GDACS/BBC RSS and IMD source links provide actual headlines. RSS publication dates are retained; unknown dates stay unknown. Legacy demo articles are excluded. Scrape results report individual provider failures.
- Open-Meteo weather returns live data when available, otherwise HTTP 503. It never substitutes synthetic readings.
- Ocean profiles are attempted from HYCOM; failures use `ESTIMATED_CLIMATOLOGY`, with depth/provenance and expiring caches. The fallback is not current telemetry.
- Resilience calculations are scenarios with reference infrastructure. GEE entries are catalogue references, not authenticated observations. Gemini recommendations are optional and correctly fall back to rules after a provider failure. Health labels reflect that result, not the presence of an API key.
- Drone samples require an explicit sample ID and are labelled demonstrations. Actual image uploads are validated and sent to Gemini only when configured; errors never return a canned damage assessment. Telemetry and calibrated failure probabilities are not inferred from images.
- Report export opens browser printing (choose Save as PDF). Reports are scenario drafts, not NDMA-issued, certified or tamper-proof documents. CAP XML uses `Exercise` and `Possible`, escapes text, and dispatches nothing. Financial payouts and countermeasures are simulations.

## Local setup

Python 3.11+ and Node 20.19+:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m uvicorn main:app --port 8000
```

In `frontend`, run `npm ci` then `npm run dev`. `VITE_API_BASE_URL` can override the backend origin. Production otherwise uses `/api` through the Vercel rewrite to the existing Render backend; development defaults to `http://127.0.0.1:8000`.

```powershell
.\.venv\Scripts\python -m unittest -v test_functionality test_resilience_pipeline
```

Run `npm run build` in `frontend` for TypeScript and production build verification.

## Optional integrations and deployment

The core requirements intentionally omit PyTorch to fit the existing Render free service. For experimental CNN inference, install `requirements-ml.txt` on a machine with sufficient memory. The core service transparently uses heuristics when torch is absent. Loading checkpoints does not establish scientific validity.

Configure `GEMINI_API_KEY` on the backend for actual image reviews and text recommendations; `GEMINI_MODEL` defaults to `gemini-2.5-flash`. `OSRM_BASE_URL` can point to a dedicated routing provider. `HYCOM_ERDDAP_URL` can override the ocean dataset endpoint. Never commit credentials.

Both deployments are linked to the repository. Render builds `pip install -r requirements.txt` and runs `uvicorn main:app --host 0.0.0.0 --port $PORT`. Vercel builds the `frontend` directory. `frontend/vercel.json` supplies the API rewrite.

SQLite stores local scenarios and news. On Render free instances that filesystem is ephemeral across restarts/redeploys; permanent multi-instance storage requires a separately configured persistent database. No paid resources are provisioned by this repository.

The older presentation/design documents describe proposed capabilities. This README and runtime provenance describe the implementation; those documents are not evidence of deployed feature completeness.
