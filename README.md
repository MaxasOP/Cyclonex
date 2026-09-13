# CYCLONEX: Multi-Scale Tropical Cyclone Intelligence & 200m Hazard Screening Platform

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-009688.svg)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19.1.1-61DAFB.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.186.0-black.svg)](https://threejs.org/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-6.9.0-396afc.svg)](https://maplibre.org/)
[![Standards](https://img.shields.io/badge/Standard-IS_875_(Part_3)-orange.svg)](https://bis.gov.in)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Smart India Hackathon (SIH) — Problem Statement 1736**  
> *Development of an AI/ML-Based System for Identification, Classification, and Prediction of Tropical Cyclone Patterns Using Multi-Source Satellite Data & High-Resolution Physics-Based Hazard Screening.*

---

## 📌 Table of Contents
- [Executive Overview](#-executive-overview)
- [System Architecture](#-system-architecture)
- [Core Capabilities & Subsystems](#-core-capabilities--subsystems)
  - [1. Multi-Source Satellite AI/ML Vision Engine](#1-multi-source-satellite-aiml-vision-engine)
  - [2. Subsurface Ocean Hydrodynamics (PacIOOS / HYCOM)](#2-subsurface-ocean-hydrodynamics-pacioos--hycom)
  - [3. Hyper-Local 200m Physics-Based Spatial Damage Grid](#3-hyper-local-200m-physics-based-spatial-damage-grid)
  - [4. Multi-Fidelity 3D Digital Twins & Tactical Map](#4-multi-fidelity-3d-digital-twins--tactical-map)
  - [5. NDMA Automated SITREP & Civil Defense Evacuation Matrix](#5-ndma-automated-sitrep--civil-defense-evacuation-matrix)
  - [6. Automated Live News Scraping & Real-Time Weather Sync](#6-automated-live-news-scraping--real-time-weather-sync)
  - [7. Scientific Transparency & Developer Health Dashboard](#7-scientific-transparency--developer-health-dashboard)
- [Mathematical & Physical Formulations](#-mathematical--physical-formulations)
- [Repository Structure](#-repository-structure)
- [Technology Stack](#-technology-stack)
- [Local Setup & Installation](#-local-setup--installation)
  - [Backend Setup](#backend-setup-fastapi)
  - [Frontend Setup](#frontend-setup-react--vite)
- [Environment Configuration](#-environment-configuration)
- [Comprehensive RESTful API Reference](#-comprehensive-restful-api-reference)
- [Deployment Guide (Render & Vercel)](#-deployment-guide-render--vercel)
- [Scientific Limitations & Disclaimer](#-scientific-limitations--disclaimer)

---

## 🌟 Executive Overview

Traditional Numerical Weather Prediction (NWP) models (e.g., WRF, GFS) are computationally prohibitive for real-time edge execution and yield coarse spatial resolutions ($9\text{ km}$ to $25\text{ km}$). Disaster management authorities and municipal administrators require **instantaneous, building-level hazard assessments ($<200\text{ m}$)** and automated actionable decision support within seconds of satellite telemetry receipt.

**CYCLONEX** bridges this gap by unifying:
1. **Satellite Remote Sensing Vision AI**: 4 deep convolutional neural networks processing multi-spectral satellite imagery (INSAT-3DR, NOAA HURSAT-B1) for presence detection, sub-pixel eye regression, Dvorak 6-stage pattern classification, Rapid Intensification (RI) alerting, and trajectory forecasting.
2. **Subsurface Ocean Thermodynamics**: 700 m water-column profiling coupling Sea Surface Temperature ($SST > 26.5^\circ\text{C}$), Tropical Cyclone Heat Potential / Ocean Heat Content ($OHC\text{ in }\text{kJ/cm}^2$), and $26^\circ\text{C}$ isotherm depth ($D_{26}$).
3. **Physics-Informed Micro-Scale Risk Mesh**: Translating storm dynamics into parcel-level structural vulnerability via Holland-Rankine vortex wind profiles, aerodynamic boundary-layer roughness, and Indian Standard **IS 875 (Part 3: 2015)** wind loading.
4. **Civil Defense Operations Deck**: Real-time allocation of National Multi-Purpose Cyclone Shelters (MPCS), elevation-weighted shortest evacuation routing, asset loss estimation (₹ Crores), and automated NDMA-compliant Situational Reports (SITREPs).
5. **Multi-Fidelity Visualization Suite**: High-performance 2D Leaflet Tactical Map, interactive 3D WebGL Planetary Globe with NASA Blue Marble textures and animated cloud dynamics, CSS 3D Tactical Perspective with atmospheric limb glow, and 3D Vector Building Extrusions.

---

## 🏗️ System Architecture

```
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                         CYCLONEX MASTER PIPELINE
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

   MULTI-SOURCE INGESTION             FEATURE & TENSOR ENGINE                  AI / ML MODEL SUITE
 ┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────────────┐
 │ INSAT-3DR (VIS/IR/WV)     │ ───► │ 4-Channel Tensor Fusion   │ ───► │ PyTorch Pattern Classifier (CNN)  │
 │ NOAA HURSAT-B1 (IR 8km)   │      │ Shape: (1, 4, 224, 224)   │      │ 6 Dvorak Structural Stages + XAI  │
 └───────────────────────────┘      └───────────────────────────┘      └─────────────────┬─────────────────┘
 ┌───────────────────────────┐      ┌───────────────────────────┐                        │
 │ PacIOOS ERDDAP / HYCOM    │ ───► │ 9-Dim State Vector Extr.  │                        │
 │ (TB, VF, SST, OHC, MLD)   │      │ [Lat, Lon, V, P, θ, ...]  │ ──┐                    ▼
 └───────────────────────────┘      └───────────────────────────┘   │  ┌───────────────────────────────────┐
 ┌───────────────────────────┐                                      ├─►│ Gradient Boosted / Neural Ensemble│
 │ NOAA IBTrACS Best Tracks  │ ───► [ Storm-Separated Split ]       │  │ (+6h, +12h, +24h Trajectory/Wind) │
 │ (1980-2024 NIO Database)  │      [ Train / Test Sets     ] ──────┘  └─────────────────┬─────────────────┘
 └───────────────────────────┘                                                           │
                                                                                         ▼
   NDMA OPERATIONAL DISPATCH             HYPER-LOCAL IMPACT PHYSICS            PHYSICS COUPLING ENGINE
 ┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────────────┐
 │ Standard Formatted SITREP │ ◄─── │ 200m Raster Damage Grid   │ ◄─── │ Holland (1980) Wind Profile       │
 │ A4 Printable PDF Export   │      │ Structural Damage (D ∈[0,1])│      │ Boundary Layer Roughness (z0)     │
 └───────────────────────────┘      └─────────────┬─────────────┘      │ Kinetic Dynamic Pressure (q)      │
 ┌───────────────────────────┐                    │                    └───────────────────────────────────┘
 │ Shortest Evacuation Path  │ ◄──────────────────┤
 │ MPCS Shelter Allocation   │                    ▼
 └───────────────────────────┘      ┌───────────────────────────┐
 ┌───────────────────────────┐      │ 3D Urban Digital Twin     │
 │ Three.js 3D Earth Globe   │ ◄─── │ MapLibre GL 3D Extrusions │
 │ Continuous Track Playback │      │ Risk: Green / Amber / Red │
 └───────────────────────────┘      └───────────────────────────┘
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
```

---

## ⚡ Core Capabilities & Subsystems

### 1. Multi-Source Satellite AI/ML Vision Engine
- **PyTorch Deep Convolutional Pipeline**: Ingests multi-spectral channels (Visible $0.65\ \mu\text{m}$, Thermal IR $10.8\ \mu\text{m}$, Water Vapor $6.7\ \mu\text{m}$, Microwave $89\text{ GHz}$) fused into a $(1, 4, 224, 224)$ tensor.
- **Multi-Task Joint Learning**: Jointly predicts cyclone presence probability and sub-pixel continuous storm-center coordinates $(lat, lon)$ using a dual-headed CNN backbone.
- **Dvorak Structural Classification (6 Stages)**:
  - `sheared` (T1.5 – T2.5): Exposed low-level circulation center.
  - `curved_band` (T3.0 – T3.5): Spiral convective banding wrapping towards center.
  - `central_dense_overcast` (T4.0 – T4.5): Uniform dense cirrus shield overcast.
  - `banding_eye` (T4.5 – T5.0): Developing ragged or ragged-irregular eye.
  - `mature_eye` (T5.5 – T6.5): Well-defined, warm circular eye surrounded by cold ring.
  - `annular` (T6.5 – T7.5): Symmetric, ring-like core with minimized outer banding.
- **Explainable AI (XAI)**: Grad-CAM (Gradient-weighted Class Activation Mapping) backpropagation captures gradients from the terminal convolutional layers, generating visual saliency heatmaps that highlight cloud eyewall convection.
- **Rapid Intensification (RI) Predictor**: Multi-modal late fusion combining spatial convolutional embeddings with in-situ thermodynamic vectors to forecast sudden wind increases ($\ge 30\text{ knots / }24\text{ hours}$).
- **Multi-Horizon Ensemble Forecasting**: Predicts $+6\text{h}$, $+12\text{h}$, $+24\text{h}$, and $+48\text{h}$ storm coordinates, central pressures, and peak sustained wind velocities.

### 2. Subsurface Ocean Hydrodynamics (PacIOOS / HYCOM)
- **Live 700m Water-Column Integration**: Connects to the PacIOOS ERDDAP HYCOM Global Ocean Forecast System.
- **Thermal Barrier (TB)**: Temperature layers sampled at $0\text{ m}$, $10\text{ m}$, $50\text{ m}$, $100\text{ m}$, and $200\text{ m}$.
- **Vertical Features (VF)**:
  - Vertical temperature and salinity gradients ($\Delta T / \Delta z$, $\Delta S / \Delta z$).
  - Ocean Heat Content ($OHC\text{ in }\text{kJ/cm}^2$) integrated down to the $26^\circ\text{C}$ isotherm.
  - Mixed Layer Depth ($MLD$) and Depth of $26^\circ\text{C}$ Isotherm ($D_{26}$).
- **Climatological Fallback**: If live satellite or telemetry feeds fail, the service activates basin-specific NIO thermocline fallbacks, clearly tagged with provenance indicators (`meta.source = "ESTIMATED_CLIMATOLOGY"`).

### 3. Hyper-Local 200m Physics-Based Spatial Damage Grid
- **Modified Rankine Vortex Kinematics**: Calculates continuous radial wind profiles $V(r)$ over a $440\text{ km}$ storm envelope, incorporating forward translation asymmetry (right-of-track amplification).
- **Aerodynamic Boundary Layer (IS 875 Part 3: 2015)**: Adjusts free-stream velocities for terrain roughness categories (Category 1: open sea/coastal strips to Category 4: dense urban obstruction).
- **Kinetic Dynamic Pressure**: $q = \frac{1}{2}\rho V^2$, converted into effective building facade loading with drag coefficient $C_d = 1.3$ and upwind directional obstacle shielding factors ($0.85$ to $1.0$).
- **Load-to-Resistance Ratio (LRR)**:
  $$\text{LRR} = \frac{q \cdot C_d \cdot \text{shelter\_factor}}{R_{\text{structural}}}$$
  where $R_{\text{structural}}$ is derived from building material classes ($300\text{ Pa}$ for unreinforced/kutcha, $900\text{ Pa}$ for semi-pucca, $1500\text{ Pa}$ for engineered RCC pucca).
- **Deterministic 4-Tier Color Coding**:
  - 🔵 **Sky Blue (`#38bdf8`)**: Safe / No modelled damage ($\text{Damage} < 0.20$)
  - 🟢 **Green (`#22c55e`)**: Low impact / Superficial facade stress ($0.20 \le \text{Damage} < 0.45$)
  - 🟠 **Amber (`#f97316`)**: Moderate damage likely / Roof & cladding risk ($0.45 \le \text{Damage} < 0.70$)
  - 🔴 **Red (`#ef4444`)**: Severe structural destruction / Failure risk ($\text{Damage} \ge 0.70$)

### 4. Multi-Fidelity 3D Digital Twins & Tactical Map
- **3D Planetary Earth Globe (`Globe3DView.tsx`)**:
  - Three.js WebGL spherical canvas with calibrated NASA Blue Marble 2048×1024 satellite imagery.
  - Translucent, animated secondary cloud deck rotating counter-clockwise at realistic atmospheric speeds.
  - Cyan limb atmospheric scattering shader with smooth `OrbitControls` inertial damping.
  - Interactive 3D storm vortex disc with dynamic hurricane ($R_{64}$) and gale ($R_{34}$) warning rings and elevated 3D Catmull-Rom forecast trajectory splines.
- **3D Tactical Perspective Mode (`RiskMap.tsx`)**:
  - Interactive pitch slider ($15^\circ$ to $60^\circ$) with synoptic tropospheric horizon glow overlay.
  - Multi-tiered 3D Troposphere Eyewall Cylinder with surface rotation, mid-level shear ring ($5\text{ km}$), and upper cirrus outflow ring ($12\text{ km}$).
- **3D Urban Digital Twin (`RealWorld3DView.tsx`)**:
  - High-performance MapLibre GL 3D vector building extrusions colored dynamically by structural vulnerability.
- **2D Tactical Map**:
  - Leaflet canvas rendering thousands of 200m polygons with instant cell inspector, OSM building footprints, land-use polygons, and shelter pins.

### 5. NDMA Automated SITREP & Civil Defense Evacuation Matrix
- **Shelter Allocation Engine**: Integrates geo-located Multi-Purpose Cyclone Shelters (MPCS), calculates available capacities, and computes elevation-weighted shortest evacuation routing.
- **Damage & Economic Loss Estimation**: Real-time estimation of population at risk, vulnerable households, and infrastructure replacement costs (₹ Crores).
- **Executive Operational Directives**: Real-time triggering of NDRF battalion mobilizations, Port Warning Signals (Signal 8 to 11), and 33/11 kV electrical power grid isolations.
- **A4 Printable SITREP**: One-click generation of tamper-proof, NDMA-standard Situation Reports ready for operational civil defense dispatches.

### 6. Automated Live News Scraping & Real-Time Weather Sync
- **Automated News Scraper (`news_service.py`)**: Built-in scraper targeting official disaster portals and weather bureaus (IMD, NDMA, regional agencies) with keyword filtering and article search.
- **Live Weather Integration**: Direct connection to Open-Meteo REST API for real-time wind speed, gusts, barometric pressure, precipitation, and temperature telemetry at the storm coordinates.

### 7. Scientific Transparency & Developer Health Dashboard
- Accessible at `/validation` and `/api/v3/developer-health`.
- Explicitly distinguishes between empirically validated machine learning components (`TRAINED_AI_ML` on held-out historical storms) and screening physics models (`HEURISTIC`).
- Single-cell physics audit endpoint (`/api/v3/cell-trace`) returns the exact step-by-step mathematical trace for any arbitrary coordinate.

---

## 📐 Mathematical & Physical Formulations

### 1. Modified Rankine Vortex Wind Profile
For radial distance $r$ from the cyclone center and radius of maximum winds $R_{\max}$:
$$V(r) = \begin{cases} 
V_{\max} \cdot \left(\frac{r}{R_{\max}}\right), & r \le R_{\max} \\ 
V_{\max} \cdot \left(\frac{R_{\max}}{r}\right)^\alpha, & r > R_{\max} 
\end{cases}$$
*(where $\alpha = 0.65$ represents the empirical decay exponent for the North Indian Ocean).*

### 2. Kinetic Dynamic Wind Pressure (IS 875 Part 3: 2015)
$$q = \frac{1}{2} \cdot \rho_{\text{air}} \cdot V(r)^2$$
*(with standard air density $\rho_{\text{air}} = 1.225\text{ kg/m}^3$).*

### 3. Additive Structural Damage Metric ($D \in [0, 1]$)
$$D = w_H \cdot H + w_S \cdot S_{\text{resp}} + w_E \cdot E + w_V \cdot V_{\text{vuln}}$$
- $H$: Normalised wind hazard score ($H = \min(1.0, \text{LRR})$)
- $S_{\text{resp}}$: Hydrodynamic surge inundation response
- $E$: Coastal proximity and topographic elevation exposure
- $V_{\text{vuln}}$: Inferred structural vulnerability factor

### 4. Ocean Heat Content ($OHC$) Integral
$$OHC = \rho_w \cdot C_p \int_{0}^{D_{26}} (T(z) - 26)\, dz$$
*(where $\rho_w = 1025\text{ kg/m}^3$, $C_p = 3993\text{ J/(kg}\cdot\text{K)}$, and $D_{26}$ is the depth of the $26^\circ\text{C}$ isotherm).*

---

## 📁 Repository Structure

```
Cyclonex/
├── ai_cyclone_service.py          # PyTorch Multi-Task CNN & Inference Pipeline
├── baseline_model.py              # Gradient-Boosted Trajectory & Intensity Baseline
├── building_service.py            # OpenStreetMap Vector Footprint Extraction & Join
├── config.py                      # Application Configuration & Environment Settings
├── feature_extractor.py           # 9-Dim Spatio-Temporal Feature Engineering
├── hursat_service.py              # NOAA HURSAT-B1 Satellite Observation Processor
├── ibtracs_service.py             # NOAA IBTrACS Best Track Parsing & Splitter
├── main.py                        # FastAPI Application & REST Route Definitions
├── ml_registry.py                 # In-Memory Machine Learning Registry & Splits
├── ml_schema.py                   # Pydantic Schemas for Satellite Observations
├── models/                        # Pre-Trained Deep Learning Model Weights
├── news_service.py                # Automated Web Scraper for Cyclone Bulletins
├── ocean_service.py               # PacIOOS ERDDAP / HYCOM Water Column Adapter
├── real_buildings_bundle.json     # Cached High-Density Building Footprints (Odisha)
├── requirements.txt               # Backend Python Dependencies
├── risk_service.py                # 200m Spatial Mesh & IS 875 Physics Engine
├── shelter_service.py             # Multi-Purpose Cyclone Shelter & Evacuation Engine
├── zone_service.py                # Land-Use & Vulnerability Zoning Service
│
├── frontend/                      # React 19 + TypeScript + Vite Application
│   ├── public/
│   │   ├── earth-blue-marble.jpg  # NASA High-Resolution Earth Sphere Texture
│   │   └── earth-clouds.png       # Translucent Rotating Atmospheric Cloud Deck
│   ├── src/
│   │   ├── components/            # UI Components (SITREP, Metrics, News, Inspectors)
│   │   ├── AICyclonePanel.tsx     # AI/ML Satellite Model Control Panel & XAI Display
│   │   ├── App.tsx                # Master Mission Command Console & View Switcher
│   │   ├── Globe3DView.tsx        # Three.js 3D Interactive Planetary Earth Engine
│   │   ├── RealWorld3DView.tsx    # MapLibre GL 3D Extruded Building Twin
│   │   ├── RiskMap.tsx            # 2D/3D Tactical Canvas & Eyewall Tower Perspective
│   │   ├── NewsPanel.tsx          # Real-Time Scraped News & Feed Manager
│   │   ├── api.ts                 # Typed REST Client for Backend Endpoints
│   │   └── styles.css             # Glassmorphic Mission Console Design System
│   ├── package.json
│   └── vite.config.ts
│
├── Dockerfile                     # Production Backend Container Definition
├── render.yaml                    # Render Cloud Deployment Blueprint
├── CYCLONEX_MASTER_SYSTEM_DOCUMENTATION.md   # Complete 500-line Scientific Manual
└── README.md                      # Primary Repository Documentation
```

---

## 💻 Technology Stack

### Backend
- **Core Framework**: Python 3.11+, FastAPI, Uvicorn
- **Machine Learning & Vision**: PyTorch (CNN, Grad-CAM), Scikit-Learn (Gradient Boosting), NumPy
- **Spatial & Numerical Processing**: Pydantic v2, Requests, GeoJSON, Local Tangent-Plane Geodesy
- **Data Ingestion**: PacIOOS ERDDAP / HYCOM, NOAA HURSAT-B1, NOAA IBTrACS, Open-Meteo, OpenStreetMap Overpass

### Frontend
- **Core Framework**: React 19, TypeScript, Vite
- **3D Planetary Engine**: Three.js (WebGL, OrbitControls, Custom Atmosphere Shaders, Catmull-Rom Splines)
- **3D Urban Digital Twin**: MapLibre GL (Vector Building Height Extrusion)
- **Tactical Cartography**: Leaflet, React-Leaflet (Canvas Vector Rendering)
- **Icons & Design**: Lucide React, Glassmorphic Vanilla CSS Design Tokens

---

## 🚀 Local Setup & Installation

### Prerequisites
- **Python**: Version 3.10 or higher
- **Node.js**: Version 18.0 or higher (with `npm`)

---

### Backend Setup (FastAPI)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/MaxasOP/Cyclonex.git
   cd Cyclonex
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the FastAPI backend server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

5. **Verify backend status**:
   - Interactive Swagger API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
   - Developer Health Dashboard: [http://127.0.0.1:8000/validation](http://127.0.0.1:8000/validation)

---

### Frontend Setup (React + Vite)

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   *(Ensure `VITE_API_BASE_URL=http://localhost:8000` is set in `.env`)*

4. **Launch the development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   Navigate to [http://localhost:5173](http://localhost:5173) to access the CYCLONEX Mission Console.

---

## ⚙️ Environment Configuration

### Backend (`.env`)
```bash
# Comma-separated CORS allowed origins
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app

# Model Configuration
GRID_SIZE_M=200
WIND_INCIDENCE_ANGLE_DEG=90

# Optional Cloud Integrations
DATABASE_URL=
GOOGLE_MAPS_BROWSER_API_KEY=
GOOGLE_MAPS_SERVER_API_KEY=
CYCLONE_FORECAST_API_KEY=
```

### Frontend (`frontend/.env`)
```bash
# Backend API Base URL
VITE_API_BASE_URL=http://localhost:8000

# Optional Google Maps 3D Tiles API Key
VITE_GOOGLE_MAPS_API_KEY=
```

---

## 📡 Comprehensive RESTful API Reference

### 1. Artificial Intelligence & Satellite Vision
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ai/analyze-cyclone` | Run multi-spectral CNN inference, Dvorak classification, Grad-CAM XAI & trajectory |
| `GET` | `/api/ai/models-status` | Inspect currently loaded PyTorch models, device configuration, and tensor shapes |

#### Example AI Inference Request:
```bash
curl -X POST "http://127.0.0.1:8000/api/ai/analyze-cyclone" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 21.62,
    "longitude": 87.51,
    "wind_speed": 165.0,
    "pressure": 948.0,
    "satellite_source": "INSAT-3DR",
    "spectral_band": "Thermal_IR_10.8um"
  }'
```

---

### 2. Ocean Subsurface Thermodynamics
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/ocean-node?lat={lat}&lon={lon}` | Retrieve 700m water-column thermal profile (TB) and vertical features (VF) |

#### Example Ocean Node Request:
```bash
curl "http://127.0.0.1:8000/api/ocean-node?lat=18.5&lon=88.2"
```

---

### 3. High-Resolution 200m Spatial Scenarios & Building Footprints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v2/scenarios` | Create a 200m spatial risk grid scenario from meteorological parameters |
| `GET` | `/api/v2/scenarios/{id}` | Fetch scenario metadata and parameter specifications |
| `GET` | `/api/v2/scenarios/{id}/risk-grid` | Retrieve 200m GeoJSON risk polygon feature collection |
| `GET` | `/api/v2/scenarios/{id}/buildings` | Fetch enriched OpenStreetMap building polygons with structural damage scores |
| `GET` | `/api/v2/scenarios/{id}/zones` | Fetch land-use zoning polygons with vulnerability classifications |
| `GET` | `/api/v2/scenarios/{id}/shelters-evacuation`| Fetch MPCS shelter capacity matrix and prioritized evacuation routes |
| `GET` | `/api/v2/scenarios/{id}/cells/{cell_id}` | Retrieve full explainable physics chain for a single 200m cell |

#### Example Scenario Creation Request:
```bash
curl -X POST "http://127.0.0.1:8000/api/v2/scenarios" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bay of Bengal High Impact Test",
    "center_lat": 21.62,
    "center_lon": 87.51,
    "max_wind_kph": 175.0,
    "central_pressure_hpa": 945.0,
    "rain_rate_mm_hr": 80.0,
    "storm_surge_m": 3.2,
    "include_ocean_node": true
  }'
```

---

### 4. Real-Time Telemetry & Disaster News
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v2/realtime-weather?lat={lat}&lon={lon}` | Fetch live Open-Meteo weather telemetry for coordinates |
| `GET` | `/api/v2/news/articles` | Retrieve scraped cyclone news bulletins with optional text/tag search |
| `POST` | `/api/v2/news/scrape` | Trigger active web scrape across configured news sources |
| `GET` | `/api/v2/news/sources` | List all active news bulletin sources and RSS feeds |

---

### 5. Diagnostics, Provenance & Validation
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/validation` | Subsystem validation dashboard with honest validation statuses |
| `GET` | `/api/v3/developer-health` | Real-time runtime health check and dataset registry metrics |
| `GET` | `/api/v3/cell-trace` | End-to-end physics trace for arbitrary coordinate |

---

## 🌐 Deployment Guide (Render & Vercel)

### 1. Backend Deployment on Render
1. Create a **New Web Service** pointing to this repository.
2. Select **Docker** environment (using the included [`Dockerfile`](file:///c:/Users/hp/Desktop/Cyclonex/Dockerfile)) or Python 3.11 Native.
3. Set start command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Set Environment Variables:
   - `CORS_ALLOWED_ORIGINS`: `https://your-app.vercel.app,http://localhost:5173`
   - `GRID_SIZE_M`: `200`
   - `WIND_INCIDENCE_ANGLE_DEG`: `90`

### 2. Frontend Deployment on Vercel
1. Import the repository into Vercel and set the **Root Directory** to `frontend`.
2. Configure Environment Variables in Vercel Project Settings:
   - `VITE_API_BASE_URL`: `https://your-cyclonex-backend.onrender.com`
3. Deploy. The project automatically builds via `tsc -b && vite build`.

---

## ⚠️ Scientific Limitations & Disclaimer

> [!IMPORTANT]
> **Operational Screening Notice**:
> CYCLONEX is an operational screening and civil defense decision-support model. It does not replace certified structural engineering inspections.
> - **Building Footprints**: OpenStreetMap building footprint geometry, heights, and material types are crowd-sourced and may be partially estimated or incomplete in rural coastal areas.
> - **Model Calibration**: Structural vulnerability weight factors are calibrated to the empirical guidance of IS 875 (Part 3: 2015) and should be interpreted as a comparative structural risk index rather than an absolute probability of building collapse.
> - **Data Provenance**: Always verify the `meta.source` field in API responses (`LIVE` vs `ESTIMATED_CLIMATOLOGY`) prior to operational emergency actions.

---

## 📄 License & Attribution
Distributed under the **MIT License**. Developed for the **Smart India Hackathon (SIH 2024)**, Problem Statement **1736**.
- Remote sensing satellite data courtesy of **NOAA** and **ISRO/IMD**.
- Ocean data courtesy of **PacIOOS ERDDAP / HYCOM Consortium**.
- Cartography courtesy of **OpenStreetMap contributors** and **NASA Visible Earth**.
