# CYCLONEX: AI-Powered Tropical Cyclone Intelligence & Multi-Scale Impact Platform
## Master Technical Specification & Complete System Architecture

---

### Executive Summary & Academic Objective

**CYCLONEX** is an end-to-end, physics-informed AI disaster intelligence platform specifically engineered for the North Indian Ocean basin (Bay of Bengal and Arabian Sea). It unifies multi-source satellite remote sensing, deep learning pattern recognition, gradient-boosted ensemble trajectory forecasting, aerodynamic wind-structure physics, 200-meter hyper-local risk assessment, and real-time 3D planetary and urban digital twins.

The system bridges the critical operational gap between raw meteorological telemetry and district-level disaster evacuation logistics according to National Disaster Management Authority (**NDMA**) and India Meteorological Department (**IMD**) standard operating procedures.

---

```
                                    CYCLONEX ARCHITECTURE FLOW
                                    
   [ Multi-Source Satellite Feeds ]   [ Ocean Dynamic Nodes ]   [ Supervised Best Tracks ]
     INSAT-3DR / NOAA HURSAT-B1           HYCOM (TB & VF)         IMD / IBTrACS Archives
                │                                │                           │
                └───────────────────────┬────────┴───────────────────────────┘
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │   Satellite Data Preprocessing & Fusion   │
                  │   (4-Channel Tensor: VIS, IR, WV, MW)     │
                  └─────────────────────┬─────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
┌─────────────────────────────┐                       ┌─────────────────────────────┐
│    Deep Learning Vision     │                       │     Ensemble ML Engine      │
│  PyTorchPatternClassifier   │                       │  GradientBoostedRegressor   │
│ (Curved Band -> Mature Eye) │                       │  (+6h, +12h, +24h Forecast) │
└────────────┬────────────────┘                       └──────────────┬──────────────┘
             │                                                       │
             └──────────────────────────┬────────────────────────────┘
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │    Physics-Informed Atmospheric Engine    │
                  │  Holland Wind Profile + Dynamic Pressure  │
                  └─────────────────────┬─────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
┌─────────────────────────────┐                       ┌─────────────────────────────┐
│   200m Impact Grid Engine   │                       │  Evacuation & Shelter Engine│
│ Structural Damage Index (S) │                       │ Dijkstra Route Optimization │
└────────────┬────────────────┘                       └──────────────┬──────────────┘
             │                                                       │
             └──────────────────────────┬────────────────────────────┘
                                        ▼
                  ┌───────────────────────────────────────────┐
                  │   Unified Visualization & Command Deck   │
                  │  • Three.js Planetary 3D Atmosphere       │
                  │  • MapLibre GL 3D Extruded City Twin      │
                  │  • NDMA Standard Formatted SITREP Export  │
                  └───────────────────────────────────────────┘
```

---

## 1. System Technology Stack & Library Ecosystem

### 1.1 Backend Stack (Python 3.10+)

| Package / Library | Version / Scope | Primary Operational Role in CYCLONEX |
|---|---|---|
| `fastapi` | `>=0.109.0` | Asynchronous RESTful API gateway handling telemetry ingestion, inference routing, and real-time GeoJSON serialization. |
| `uvicorn` | `>=0.27.0` | Lightning-fast ASGI web server hosting the FastAPI application on standard loopback/production interfaces. |
| `torch` / `torchvision` | `>=2.1.0` | PyTorch Deep Learning framework executing convolutional neural networks for cyclone pattern classification and intensity estimation. |
| `scikit-learn` | `>=1.4.0` | Machine Learning ensemble library hosting `GradientBoostingRegressor`, `MultiOutputRegressor`, and `RandomForestClassifier`. |
| `numpy` | `>=1.26.0` | High-performance vectorized numerical operations for Holland wind calculations, haversine distances, and coordinate matrices. |
| `pydantic` | `>=2.6.0` | Strict type validation, telemetry schema enforcement, and API request/response serialization. |
| `pillow` (`PIL`) | `>=10.2.0` | Decoding, resizing, normalization, and tensor transformation of satellite channel imagery. |
| `sqlite3` | Built-in | ACID-compliant relational metadata store for active storm records, IBTrACS historical tracks, and cached training samples. |
| `requests` | `>=2.31.0` | Synchronous HTTP client for fetching live meteorological bulletins, remote satellite feeds, and GIS payloads. |

### 1.2 Frontend Stack (TypeScript / React)

| Package / Library | Version / Scope | Primary Operational Role in CYCLONEX |
|---|---|---|
| `react` & `react-dom` | `^18.3.1` | Component lifecycle management, state reactivity, and UI hierarchy. |
| `vite` | `^5.4.2` | Next-generation frontend build tool and hot module replacement (HMR) development server. |
| `typescript` | `^5.5.3` | Compile-time type safety across meteorological data structures and MapLibre layers. |
| `three` | `^0.160.0` | WebGL 3D Planetary Simulation engine rendering the Earth sphere, rotating vortex particles, and atmospheric fresnel glow. |
| `@types/three` | `^0.160.0` | TypeScript definitions for Three.js scene graphs, meshes, geometries, and materials. |
| `maplibre-gl` | `^4.0.0` | High-performance WebGL vector tile map renderer for 3D building extrusions, 200m damage heatmaps, and GIS contours. |
| `leaflet` & `react-leaflet`| `^1.9.4` | Fallback lightweight 2D interactive mapping engine for low-bandwidth field deployments. |
| `lucide-react` | `^0.344.0` | Standardized icon library for tactical NDMA dashboards and weather telemetry indicators. |
| `tailwindcss` | `^3.4.1` | Utility-first CSS framework for mission-critical dark-mode operational user interfaces. |

---

## 2. Artificial Intelligence & Machine Learning Architecture

CYCLONEX combines **Deep Convolutional Computer Vision** with **Multi-Output Gradient-Boosted Decision Trees** to achieve both visual pattern identification and high-precision trajectory extrapolation.

```
                    SATELLITE MULTI-CHANNEL TENSOR FUSION
                    
[ Visible (0.65µm) ]   [ IR (10.8µm) ]   [ Water Vapor (6.7µm) ]   [ Microwave (89GHz) ]
       │                      │                      │                       │
       └──────────────────────┴──────────┬───────────┴───────────────────────┘
                                         ▼
                             Normalized 4-Channel Tensor
                                (Shape: 1 × 4 × 224 × 224)
                                         │
             ┌───────────────────────────┴───────────────────────────┐
             ▼                                                       ▼
  PyTorchPatternClassifier                               PyTorchIntensityRegressor
┌─────────────────────────────┐                        ┌─────────────────────────────┐
│ Conv2D(4 -> 16, k=3, s=2)   │                        │ Conv2D(4 -> 16, k=3, s=2)   │
│ BatchNorm2d + ReLU          │                        │ AdaptiveAvgPool2d(2, 2)     │
│ Conv2D(16 -> 32, k=3, s=2)  │                        │ Flatten (64 features)       │
│ BatchNorm2d + ReLU          │                        │                             │
│ Conv2D(32 -> 64, k=3, s=2)  │                        │ Concat: [64-feat + Telemetry│
│ BatchNorm2d + ReLU          │                        │ (Lat, Lon, Wind, Press)]    │
│ AdaptiveAvgPool2d(4, 4)     │                        │                             │
│ Linear(1024 -> 6 classes)   │                        │ Linear(68 -> 6) [Intensity] │
└──────────────┬──────────────┘                        │ Linear(68 -> 6) [Track]     │
               ▼                                       └──────────────┬──────────────┘
     Pattern Classification                                           ▼
 (e.g., "mature_eye", 94.2%)                         (+6h, +12h, +24h Coordinates & Wind)
```

### 2.1 Multi-Channel Satellite Tensor Preprocessing
Raw geostationary and polar-orbiting satellite feeds are ingested, cropped to storm-centered bounding boxes, and normalized to float tensors:
$$\mathbf{X} \in \mathbb{R}^{1 \times 4 \times 224 \times 224}$$
- **Channel 0 (Visible - 0.65 µm)**: High-resolution cloud top texture, convective banding, and low-level circulation centers during daylight.
- **Channel 1 (Thermal Infrared - 10.8 µm)**: Continuous 24/7 cloud-top brightness temperature ($T_B$) indicating deep convective towers.
- **Channel 2 (Water Vapor - 6.7 µm)**: Mid-to-upper tropospheric moisture, dry air intrusions, and environmental vertical wind shear.
- **Channel 3 (Passive Microwave - 89 GHz)**: Rainband structure penetrating cirrus canopies, eye formation, and eyewall replacement cycles.

### 2.2 Deep Learning Pattern Classifier (`PyTorchPatternClassifier`)
- **Backbone**: Multi-stage 2D Convolutional Neural Network with Batch Normalization and adaptive average pooling.
- **Target Dvorak / Structural Classes**:
  1. `curved_band` (Initial spiral organization, wind $<65\text{ km/h}$)
  2. `central_dense_overcast` (Intense uniform cold convection, wind $65-90\text{ km/h}$)
  3. `eye_formation` (Developing warm core anomaly, wind $90-130\text{ km/h}$)
  4. `mature_eye` (Symmetric circular eyewall, wind $>130\text{ km/h}$)
  5. `sheared_system` (Convection displaced from circulation center by upper-level winds)
  6. `weakening_system` (Decaying post-landfall or dry-air entrainment)

### 2.3 Ensemble Forecast Pipeline (`GradientBoostedMultiOutputEnsemble`)
- **Model**: `MultiOutputRegressor(GradientBoostingRegressor(n_estimators=150, max_depth=5, learning_rate=0.08))`
- **Input Feature Vector $\mathbf{v} \in \mathbb{R}^9$**:
  $$\mathbf{v} = \begin{bmatrix} \text{lat}, & \text{lon}, & V_{\text{max}}, & P_{\text{central}}, & \theta_{\text{heading}}, & V_{\text{forward}}, & T_B, & V_F, & \Delta P \end{bmatrix}$$
  where $\Delta P = 1013.25\text{ hPa} - P_{\text{central}}$, $T_B$ is ocean thermal barrier index, and $V_F$ is ocean vertical flow anomaly.
- **Output Vector $\mathbf{y} \in \mathbb{R}^{12}$**:
  Predicts continuous trajectory coordinates and intensity parameters across 3 discrete forecast horizons:
  $$\mathbf{y} = \left[ (\Delta \text{lat}_{6}, \Delta \text{lon}_{6}, V_{6}, P_{6}), (\Delta \text{lat}_{12}, \Delta \text{lon}_{12}, V_{12}, P_{12}), (\Delta \text{lat}_{24}, \Delta \text{lon}_{24}, V_{24}, P_{24}) \right]$$

---

## 3. Physics-Informed Atmospheric & Structural Damage Equations

CYCLONEX integrates physical meteorological laws to compute radial wind distribution, boundary-layer degradation, and aerodynamic building forces.

### 3.1 Holland (1980) Radial Wind Profile
Calculates the gradient wind velocity $V(r)$ at radial distance $r$ from the storm eye:
$$V(r) = \sqrt{ V_{\text{max}}^2 \cdot \left(\frac{R_{\text{max}}}{r}\right)^B \cdot \exp\left(1 - \left(\frac{R_{\text{max}}}{r}\right)^B\right) + \left(\frac{r \cdot f}{2}\right)^2 } - \frac{r \cdot f}{2}$$

Where:
- $V_{\text{max}}$: Maximum sustained 10-meter wind speed ($\text{m/s}$ or $\text{km/h}$).
- $R_{\text{max}}$: Radius of Maximum Winds ($\approx 25-45\text{ km}$).
- $B$: Holland shape parameter ($1.0 \le B \le 2.5$), dynamically computed as:
  $$B = 1.5 + \frac{1013.25 - P_{\text{central}}}{100}$$
- $f = 2\Omega \sin(\phi)$: Coriolis parameter at storm latitude $\phi$ ($\Omega = 7.2921 \times 10^{-5}\text{ rad/s}$).

### 3.2 Atmospheric Boundary Layer Friction & Roughness
Wind degrades as the cyclone transitions from open sea to coastal land using the logarithmic boundary layer law:
$$V_{\text{surface}}(z) = V_{\text{gradient}} \cdot \frac{\ln\left(\frac{z}{z_0}\right)}{\ln\left(\frac{z_{\text{gradient}}}{z_0}\right)}$$

- Ocean aerodynamic roughness: $z_{0,\text{ocean}} = 0.0002\text{ m}$
- Urban / coastal terrain roughness: $z_{0,\text{urban}} = 0.85\text{ m}$

### 3.3 Aerodynamic Velocity Pressure on Structures
Converts wind velocity into localized kinetic pressure $q$ ($\text{N/m}^2$ / $\text{Pa}$):
$$q = \frac{1}{2} \cdot \rho_{\text{air}} \cdot V(r)^2 \cdot C_p \cdot C_g$$

- $\rho_{\text{air}} \approx 1.225\text{ kg/m}^3$ (Standard sea-level air density).
- $C_p$: Aerodynamic building shape factor ($0.8$ for windward vertical walls).
- $C_g$: Gust factor ($1.35$ for convective squall bursts).

### 3.4 200-Meter Spatial Grid Compound Damage Index
The damage score $S_{\text{damage}} \in [0.0, 1.0]$ for each 200m cell is formulated as:
$$S_{\text{damage}} = w_1 \cdot \min\left(1.0, \frac{q}{q_{\text{crit}}}\right) + w_2 \cdot \frac{H_{\text{surge}}}{H_{\text{max}}} + w_3 \cdot \left(\rho_{\text{density}} \cdot \mathcal{V}_{\text{structural}}\right)$$

Where weights $w_1 = 0.45$, $w_2 = 0.35$, $w_3 = 0.20$, $q_{\text{crit}} = 2500\text{ Pa}$, and $\mathcal{V}_{\text{structural}}$ is masonry/concrete vulnerability.

---

## 4. Geospatial Datasets & Ingestion Pipelines

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        DATASET INGESTION MATRIX                            │
├───────────────────┬──────────────────────────────┬─────────────────────────┤
│ Dataset Name      │ Source Agency / Protocol     │ System Application      │
├───────────────────┼──────────────────────────────┼─────────────────────────┤
│ NOAA IBTrACS v04  │ NOAA NCEI (Global Archive)   │ Supervised track/wind   │
│ NOAA HURSAT-B1    │ NOAA NESDIS (8km IR Grids)   │ Image sequence training │
│ INSAT-3D / 3DR    │ ISRO MOSDAC (Geo-HDF5)       │ Real-time NIO telemetry │
│ GPM IMERG         │ NASA Earthdata (0.1° grid)   │ Rain rate & flood risk  │
│ Sentinel-1 SAR    │ ESA Copernicus (C-band)      │ Surface water mapping   │
│ HYCOM Ocean Model │ NCODA Ocean Profile (0.08°)  │ TB & VF energy indices  │
│ OpenStreetMap GIS │ Overpass API / Vector GeoJSON│ 3D City & Road Network  │
└───────────────────┴──────────────────────────────┴─────────────────────────┘
```

1. **NOAA IBTrACS v04**: Worldwide tropical cyclone best-track historical archive. Filtered specifically for North Indian Ocean basins (`NI` / `BB` / `AS`) for supervised machine learning training.
2. **NOAA HURSAT-B1**: Storm-centered geostationary infrared observations sampled at 3-hour intervals with 8 km spatial resolution.
3. **INSAT-3D / INSAT-3DR**: ISRO's operational weather satellites stationed at $74^\circ\text{E}$ and $82^\circ\text{E}$, delivering 15-minute multi-spectral scans over the Bay of Bengal and Arabian Sea.
4. **HYCOM (Hybrid Coordinate Ocean Model)**: Provides subsurface ocean thermal barrier ($T_B$) and vertical current flow ($V_F$) data to model ocean heat content (OHC) fueling cyclone intensification.
5. **OpenStreetMap 3D Extrusion**: Vector building footprints, road geometries, and designated emergency cyclone shelters for coastal districts.

---

## 5. 3D Planetary Simulation & 3D Urban Digital Twin

### 5.1 Planetary 3D Atmosphere (`Globe3DView.tsx`)
- **Technology**: Three.js WebGL canvas running custom orbital cameras and scene graph nodes.
- **Continuous Interpolation**: Uses `lerpVectors()` and `slerpQuaternions()` to compute smooth intermediate coordinates between discrete 6-hour forecast steps.
- **Vortex Simulation**: Dynamically instantiates 600+ rotating particle sprites orbiting the dynamic storm center with logarithmic spiral angular velocities.
- **Atmospheric Shader**: Fresnel-based glow shader computing scattering color gradients from teal-cyan ($100\text{ km/h}$) to intense violet-crimson ($>220\text{ km/h}$).

### 5.2 3D City Digital Twin (`RealWorld3DView.tsx`)
- **Technology**: MapLibre GL Vector Tile engine with high-pitch perspective rendering ($60^\circ$ pitch, $20^\circ$ bearing).
- **3D Building Extrusions**: Custom `fill-extrusion` layers dynamically colored by structural risk formulas:
  - **Green (Low Risk)**: Intact masonry/RCC structures outside the surge zone.
  - **Yellow (Moderate Risk)**: Partial wind loading ($70-120\text{ km/h}$).
  - **Red (Severe Risk)**: Direct eyewall exposure ($>130\text{ km/h}$) or low-elevation flood inundation.
- **Evacuation Routing**: Integrated Dijkstra / A* pathfinder finding the shortest safe road network path from hazardous coastal zones to elevated cyclone shelters.

---

## 6. NDMA Formatted SITREP Export Specification

The Situation Report (**SITREP**) export module generates standardized, printable A4 documents formatted to NDMA operational guidelines.

### SITREP Output Structure:
1. **Header Banner**: Official National Disaster Management Authority insignia, classified operational status (`EXECUTIVE SUMMARY`), report timestamp, and unique incident ID.
2. **Meteorological Telemetry Grid**: Current coordinates, forward motion vector, central pressure deficit ($\text{hPa}$), and maximum sustained surface wind ($\text{km/h}$).
3. **Multi-Horizon Trajectory Table**: Systematic 6h, 12h, and 24h predictions including estimated latitude/longitude, IMD classification, wind speed, and empirical uncertainty radius.
4. **Impact Assessment**: Estimated population at risk, vulnerable building count, inundation area, and designated active shelters.
5. **Emergency Sector Directives**: Structured operational instructions for:
   - **Fisheries & Maritime Port Operations**: Immediate harbor recall and coastal vessel suspension.
   - **Infrastructure, Power & Telecom**: Pre-positioning mobile DG sets and bucket-trucks for restoration.
   - **Evacuation & Shelter Logistics**: Mandatory evacuation timelines for vulnerable low-lying residents.
6. **Authentication Verification Seal**: System hash verification and electronic authorization signature block.

---

## 7. RESTful API Endpoint Reference

```
+------------------------------------------------------------------------------------------+
|                                CYCLONEX REST API MATRIX                                  |
+--------+------------------------------------+--------------------------------------------+
| Method | Endpoint Route                     | Primary Function                           |
+--------+------------------------------------+--------------------------------------------+
| GET    | /api/v3/dataset-summary            | Returns ML training & validation readiness |
| POST   | /api/v3/inference                  | Multi-source AI identification & forecast  |
| GET    | /api/v3/storms/{storm_id}/forecast | Specific storm forecast with uncertainties |
| POST   | /api/v3/storms/{id}/impact-run     | 200m damage grid calculation               |
| POST   | /api/v3/observations/ingest        | Ingests raw satellite channel scenes       |
| POST   | /api/v3/best-tracks/ibtracs        | Ingests supervised best-track labels       |
| GET    | /api/buildings                     | Returns 3D GeoJSON building footprints     |
| GET    | /api/shelters                      | Returns designated emergency shelter hubs  |
| POST   | /api/routes/evacuate               | Computes safe optimal evacuation path      |
+--------+------------------------------------+--------------------------------------------+
```

### Example `/api/v3/inference` Request & Response:

#### Request Payload:
```json
{
  "latitude": 18.2,
  "longitude": 72.8,
  "wind_speed": 140.0,
  "pressure": 965.0,
  "satellite_images": {
    "visible": "data:image/png;base64,iVBORw0KGgo...",
    "infrared": "data:image/png;base64,iVBORw0KGgo...",
    "water_vapor": "data:image/png;base64,iVBORw0KGgo...",
    "microwave": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

#### Response Payload:
```json
{
  "status": "SUCCESS",
  "identification": {
    "is_cyclone": true,
    "confidence": 0.945,
    "status": "READY"
  },
  "pattern_classification": {
    "pattern_class": "mature_eye",
    "confidence": 0.912,
    "status": "READY"
  },
  "forecast": {
    "hours_6": {
      "predicted_lat": 18.65,
      "predicted_lon": 72.95,
      "predicted_wind_kph": 148.2,
      "predicted_pressure_hpa": 960.5,
      "uncertainty_km": 9.6
    },
    "hours_12": {
      "predicted_lat": 19.10,
      "predicted_lon": 73.08,
      "predicted_wind_kph": 155.0,
      "predicted_pressure_hpa": 955.0,
      "uncertainty_km": 19.2
    },
    "hours_24": {
      "predicted_lat": 20.05,
      "predicted_lon": 73.30,
      "predicted_wind_kph": 130.0,
      "predicted_pressure_hpa": 972.0,
      "uncertainty_km": 38.5
    }
  },
  "pipeline_provenance": "GradientBoostedMultiOutputEnsemble + PyTorchPatternClassifier"
}
```

---

## 8. Installation, Deployment & Operational Run Guide

### Prerequisites
- Python 3.10 or higher
- Node.js 18.x or higher & npm

### Starting the Backend Services
```bash
# In repository root
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Starting the Frontend Tactical Command Interface
```bash
# In frontend directory
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Access the unified tactical command deck at `http://localhost:5173`.
All services communicate over REST endpoints with automatic hot-reloading and WebGL acceleration.

---
*CYCLONEX Technical Architecture Specification • Compliant with NDMA & IMD Disaster Management Standards.*
