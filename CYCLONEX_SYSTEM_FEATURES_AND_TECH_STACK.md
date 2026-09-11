# CYCLONEX: System Features, Machine Learning Engine, Training, Output Mapping & Technology Stack Architecture

**Smart India Hackathon (SIH 2024)**  
**Problem Statement ID:** 1736  
**Project Title:** Development of an AI/ML-Based System for Identification, Classification, and Prediction of Tropical Cyclone Patterns Using Multi-Source Satellite Data & High-Resolution Physics-Based Hazard Screening.

---

## 1. Executive Summary & Problem Statement Fulfillment

CYCLONEX is an operational meteorological intelligence and civil defense decision-support platform designed to address **SIH Problem Statement 1736**. It bridges deep-space multi-spectral satellite observations, deep learning computer vision, atmospheric thermodynamics, and micro-scale structural engineering:
1. **Multi-Source Satellite AI/ML Pipeline**: 4 dedicated PyTorch deep convolutional neural networks ingesting INSAT-3DR, ScatSat, and NOAA HURSAT-B1 multi-spectral data for real-time cyclone presence identification, Dvorak pattern classification, Rapid Intensification (RI) alerting, and trajectory/intensity forecasting (+6h, +12h, +24h, +48h).
2. **Subsurface Ocean Hydrodynamics**: Coupling 700m thermocline depth, Sea Surface Temperature ($SST > 26.5^\circ\text{C}$), and Tropical Cyclone Heat Potential / Ocean Heat Content ($OHC \text{ in } \text{kJ/cm}^2$) for storm intensification energetics.
3. **200m Physics-Based Spatial Risk Grid**: Micro-scale structural screening implementing the Modified Rankine Vortex kinematic field, IS 875 (Part 3: 2015) wind loading standards, and aerodynamic boundary layer sheltering.
4. **Civil Defense Evacuation & Shelter Matrix**: Real-time allocation of National Multi-Purpose Cyclone Shelters (MPCS), elevation-weighted shortest evacuation routing, and structural asset loss estimation in ₹ Crores.
5. **Multi-Fidelity Visualization Engine**: 2D Leaflet Tactical Map, interactive 3D WebGL Globe with atmospheric raymarching, and 3D Digital Twin City building extrusion powered by MapLibre GL.

---

## 2. Advanced AI/ML Strategies & Machine Learning Philosophy

To achieve operational viability in life-critical disaster mitigation, CYCLONEX avoids monolithic "black-box" models. Instead, it employs seven distinct AI/ML engineering strategies:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CYCLONEX AI/ML STRATEGIES                          │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ 1. Multi-Task Learning        │ Joint presence identification & eye sub-    │
│                               │ pixel center regression                     │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 2. Multi-Modal Late Fusion    │ Spatial 2D CNN feature maps fused with      │
│                               │ tabular 1D ocean-atmosphere thermodynamic   │
│                               │ telemetry                                   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 3. Explainable AI (XAI)       │ Grad-CAM saliency backpropagation for       │
│                               │ meteorological pattern transparency         │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 4. Decoupled Regularization   │ AdamW optimizer with strict weight decay to │
│                               │ prevent overfitting on extreme storm events │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 5. Physics-Guided AI (PGAI)   │ Rankine vortex boundary equations &         │
│                               │ hydrostatic laws enforce physical limits    │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 6. Synthetic Radiative        │ Atmospheric transfer modeling creates       │
│    Augmentation               │ realistic multi-spectral satellite channels │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 7. Deterministic Fallback     │ Graceful degradation to IS 875 wind physics │
│                               │ if neural weights or inputs are unavailable │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### Strategy 1: Multi-Task Joint Learning
- **Problem**: Training separate models for presence detection and eye localization results in redundant feature extraction and excessive inference latency.
- **Strategy**: Model 1 uses a single deep convolutional backbone that branches into dual linear heads: a binary presence classifier ($\sigma(z)$) and a hyperbolic tangent $(\tanh)$ continuous coordinate regressor. The joint loss function balances presence classification with spatial localization:
  $$\mathcal{L}_{\text{Model 1}} = \mathcal{L}_{\text{BCE}}(p, y) + 3.0 \times \mathcal{L}_{\text{MSE}}(\mathbf{c}_{pred}, \mathbf{c}_{true})$$

### Strategy 2: Multi-Modal Late Fusion (Spatial + Tabular)
- **Problem**: Satellite images capture atmospheric cloud morphology but cannot measure subsurface heat energy or ambient vertical shear that dictate storm intensification.
- **Strategy**: Models 3 (RI) and 4 (Intensity & Track) implement late fusion. The 4-channel satellite tensor passes through 2D convolutional layers to yield a 256-dimensional spatial embedding ($\mathbf{h}_{image}$). Simultaneously, environmental scalar sensors feed an in-situ thermodynamic vector ($T_{ocean} \in \mathbb{R}^4$ or $T_{full} \in \mathbb{R}^8$):
  $$\mathbf{h}_{fused} = [\mathbf{h}_{image} \,\|\, T_{ocean}] \in \mathbb{R}^{260}$$
  The fused vector is passed into fully connected dense layers, allowing the network to cross-correlate deep convective cloud towers with ocean heat reservoir depth.

### Strategy 3: Explainable AI (XAI) via Grad-CAM Saliency
- **Problem**: Meteorologists and civil defense commanders will not trust unexplainable neural predictions during evacuations.
- **Strategy**: CYCLONEX incorporates Gradient-weighted Class Activation Mapping (Grad-CAM). Hooks registered on `layer4` convolutional feature maps capture gradients $\frac{\partial y^c}{\partial A^k}$. The resulting importance weights $\alpha_k^c$ generate a spatial saliency heatmap demonstrating whether the model focused on the cold central eyewall, spiral rainbands, or sheared peripheral clouds.

### Strategy 4: Decoupled Adaptive Weight Regularization (AdamW)
- **Problem**: Standard Adam $L_2$ regularization couples weight decay with gradient updates, leading to sub-optimal generalization on sparse, highly skewed meteorological datasets (where super-cyclones are rare compared to depressions).
- **Strategy**: CYCLONEX trains all models using `AdamW` with decoupled weight decay ($\lambda = 10^{-4}$), ensuring model weights are shrunk independently of moving average gradient moments.

### Strategy 5: Physics-Guided Fallback & Boundary Enforcement
- **Problem**: Deep neural networks can hallucinate physically impossible storm conditions (e.g., negative central pressures, wind speeds exceeding theoretical Carnot thermodynamic limits, or backwards erratic jumps).
- **Strategy**: Every neural prediction is bounded by empirical thermodynamic laws:
  - Minimum central pressure is clamped to $[870\text{ hPa}, 1015\text{ hPa}]$.
  - Maximum sustained wind speed is clamped to $[25\text{ km/h}, 320\text{ km/h}]$.
  - Track displacement cones are constrained by maximum forward propagation velocity ($v_{fwd} \le 80\text{ km/h}$).
  - If model weights are missing, the system gracefully falls back to classical Rankine vortex and Atkinson-Holliday wind-pressure relationships without generating synthetic hallucinations.

---

## 3. How the ML Output is Mapped: From Neural Latent Space to 200m Parcel Reality

A major innovation of CYCLONEX is how abstract neural network tensor outputs are mapped directly into micro-scale, parcel-level structural damage on coastal land:

```
   NEURAL PREDICTIONS
   ├── Eye Coordinates: (18.35°N, 72.98°E)
   ├── Peak Wind: 120 km/h (33.3 m/s)
   ├── Central Pressure: 984 hPa
   └── Multi-Horizon Track: (+6h, +12h, +24h)
                      │
                      ▼
   KINEMATIC VELOCITY FIELD (MODIFIED RANKINE VORTEX)
   Computes radial wind velocity V(r) across 440 km storm envelope
   Inside eyewall (r <= Rmax): V(r) = Vmax * (r / Rmax)
   Outside eyewall (r > Rmax): V(r) = Vmax * (Rmax / r)^0.65
                      │
                      ▼
   200m GEOSPATIAL MESH DISCRETIZATION
   Bounding box partitioned into thousands of 200m GeoJSON polygons
   Each cell assigned centroid coordinates (lat_c, lon_c)
                      │
                      ▼
   AERODYNAMIC BOUNDARY LAYER & IS 875 (PART 3) WIND CODE
   For each cell:
   1. Terrain Roughness Factor (k2 = 1.05 for Coastal Plain)
   2. Cyclonic Consequence Factor (k4 = 1.15 within 15 km of coast)
   3. Design Wind Speed: Vz = V(r) * k1 * k2 * k3 * k4
   4. Dynamic Velocity Pressure: q = 0.613 * (Vz)^2 (Pascals)
   5. Upwind Obstacle Shielding: q_eff = q * (Shelter_Factor)^2
                      │
                      ▼
   STRUCTURAL LOSS RATIO (LRR) & BUILDING ARCHETYPES
   LRR = (q_eff * Cd) / R_structural
   ├── Class A (Engineered RCC): R = 3200 Pa -> Low LRR (Safe)
   ├── Class B (Masonry): R = 1600 Pa -> Moderate LRR
   ├── Class C (Industrial Steel): R = 1100 Pa -> Severe LRR
   └── Class D (Semi-Pucca / Kutcha): R = 500 Pa -> Collapse
                      │
                      ▼
   COLOR-CODED GEOSPATIAL RENDER & CIVIL DEFENSE LOGISTICS
   ├── Cells with LRR < 0.35  -> Green (#10b981) -> SAFE
   ├── Cells with LRR >= 0.35 -> Amber (#f59e0b) -> MODERATE DAMAGE
   ├── Cells with LRR >= 0.70 -> Red (#ef4444)   -> SEVERE (MANDATORY EVACUATION)
   └── Cells with LRR >= 1.10 -> Dark Red/Purple -> CATASTROPHIC COLLAPSE
                      │
                      ▼
   DIJKSTRA EVACUATION ROUTING & MPCS SHELTERS
   Vulnerable wards (LRR >= 0.70) routed along elevation-weighted
   paths avoiding surge inundation to nearest Multi-Purpose Shelter
```

---

## 4. Granular Feature Walkthrough: From Smallest Micro-Feature to Biggest Macro-Feature

To provide an exhaustive reference, every feature in CYCLONEX is documented below, organized from small interactive controls to large architectural modules:

### 4.1 Micro-Features (Controls, Indicators, Chips, Badges)

| Micro-Feature | Location | Technical Function & Behavior |
| :--- | :--- | :--- |
| **SIH 2024 Finalist Badge** | Top App Header | Displays `SIH 2024 · Problem Statement ID: 1736` indicating student research provenance. |
| **Satellite Stream Status Pill** | Top App Header | Live pulse indicator reading `● INSAT-3D Online` (green) showing active meteorological ingestion. |
| **Theme Toggle Button** | Top App Header | Instant toggle switching entire application between Tactical Dark (`[data-theme="dark"]`) and Minimal Light (`[data-theme="light"]`) modes. |
| **Export SITREP Button** | Top App Header | Generates and exports an operational Disaster Situation Report (SITREP) in structured format. |
| **Coastal Target Search Bar** | Top App Header | Quick-find search input (`Search coastal targets... ⌘K`) focusing map on vulnerable ports (Paradip, Digha, Mandvi, Alibaug). |
| **Cyclone Preset Dropdown** | Simulation Left Dock | Selects historical or active cyclones (Nisarga, Amphan, Tauktae, Biparjoy, Fani) and initializes parameters. |
| **Peak Wind Speed Input** | Simulation Left Dock | Number input & slider controlling $V_{max}$ in km/h; immediately recalibrates dynamic pressure across the grid. |
| **Central Pressure Input** | Simulation Left Dock | Number input controlling central barometric pressure in hPa; recalibrates hydrostatic surge inundation. |
| **Eye Coordinate Controls** | Simulation Left Dock | Two precision number inputs for Eye Latitude ($^\circ\text{N}$) and Eye Longitude ($^\circ\text{E}$). |
| **Storm Heading Input** | Simulation Left Dock | Controls storm vector azimuth ($0^\circ - 360^\circ$); rotates trajectory cone and inflow spiral streamlines. |
| **Forward Speed Input** | Simulation Left Dock | Controls storm translation speed ($8 - 80\text{ km/h}$); governs multi-horizon $+6\text{h}/+12\text{h}/+24\text{h}$ track step distance. |
| **"Update Hazard Screening" Button**| Simulation Left Dock | Primary royal blue action button triggering full spatial physics and ML re-screening. |
| **Hazard Mode Tabs** | Left Dock & Right Panel | 5 tab buttons (`DAMAGE`, `WIND`, `EXPOSURE`, `OBSTACLES`, `HIT`) toggling specialized map layers and right-panel engineering dossiers. |
| **Shelters Toggle Checkbox** | Left Dock Layers | Checkbox toggling nationwide MPCS shelter badges and dashed evacuation corridor lines. |
| **Land-Use Zones Checkbox** | Left Dock Layers | Checkbox toggling coastal ward boundary polygons and zoning outlines. |
| **200m Physics Mesh Checkbox** | Left Dock Layers | Checkbox toggling high-resolution 200m spatial calculation cells. |
| **Map View Dock Buttons** | Top Center Floating Dock | 3 toggle buttons (`Map`, `3D View`, `Globe`) switching between Leaflet 2D, MapLibre 3D City, and Three.js 3D Globe. |
| **Zoom In / Zoom Out Buttons** | Top Center Floating Dock | Precision zoom level controllers for geospatial map navigation. |
| **Basemap Theme Selector** | Top Center Floating Dock | 3 basemap tilesets: `Dark Radar`, `Satellite` (Esri World Imagery), and `Light Map` (Esri Light Canvas). |
| **Grid Opacity Slider** | Top Center Floating Dock | Range slider adjusting the alpha opacity ($10\% - 100\%$) of the 200m GeoJSON risk layer overlay. |
| **Timeline Player Play/Pause** | Bottom Map Bar | Animated scrubbing through storm landfall sequence. |
| **Time-Step Pills** | Bottom Map Bar | Direct time jump buttons: `0h Live Eye`, `+6h`, `+12h`, `+24h` updating forecast eye position and track cones. |
| **Live Telemetry Ticker** | Bottom Screen Bar | Real-time status tape displaying active TIR-1 band, risk tier, affected sector count, exposed population headcount, ₹ Cr economic loss, NDMA urgency directive, and IMD port warning signal. |
| **MPCS Shelter Badge Pin** | Map Canvas | High-visibility Leaflet `divIcon` badge (`createShelterIcon`) showing shelter glyph `🏠`, intake bed capacity pill (`2.5k`), status-colored ring (crimson/amber/green), and active pulse radar ring. |
| **Shelter Dossier Popup** | Map Canvas (OnClick) | Rich Leaflet modal detailing shelter name, capacity, occupancy progress bar, standby diesel generator fuel, potable water duration (days), and SDMA contact officer. |
| **Evacuation Corridor Flow Lines** | Map Canvas | High-contrast dashed lines (cyan `#38bdf8` and gold `#f59e0b`) showing Dijkstra safe corridors from vulnerable wards to MPCS refuges. |
| **Cyclonic Wind Streamlines** | Map Canvas (WIND Mode) | Curvilinear vector arrows spiraling counter-clockwise at a 22° inward inflow angle representing Rankine vortex air parcel velocities. |

---

### 4.2 Macro-Features (Complete Pages & Major Architectural Subsystems)

#### Macro-Feature 1: 2D Tactical Geospatial Hazard Map (`#app`)
The primary command center for meteorological hazard screening. Features a 2D Leaflet canvas rendering thousands of 200m spatial cells color-coded by Structural Loss Ratio ($LRR$). Features interactive parcel picking: clicking any 200m cell instantly displays a deep engineering dossier on the right sidebar with aerodynamic pressure, structural failure mechanics, upwind shelter factors, and life-safety directives.

#### Macro-Feature 2: Multi-Source Satellite AI Laboratory (`#ai-lab`)
The dedicated deep learning research hub. Displays 4 simultaneous multi-spectral satellite channels (TIR-1, Water Vapor, Microwave 89GHz, Visible Albedo). Allows engineers to inspect PyTorch model loading states, GPU/CPU allocations, parameter counts, run one-click multi-model benchmarks, and inspect Grad-CAM attention saliency heatmaps.

#### Macro-Feature 3: Civil Defense Evacuation & Shelter Matrix (`#evacuation`)
A dedicated logistics page for disaster response commanders. Features dynamic regional adaptation (Odisha, West Bengal, Gujarat, Maharashtra), a live operational telemetry strip (Risk Population, Total Capacity, Utilization, Vacancy, ₹ Cr Loss), an interactive geospatial evacuation canvas, and a ranked ward evacuation roster prioritizing communities by storm surge inundation depth.

#### Macro-Feature 4: 3D Digital Twin City Building Inspection (`#city-3d`)
A micro-scale 3D urban inspection environment powered by MapLibre GL. Features vector tile rendering with `fill-extrusion` layers displaying authentic 3D building parcels. Evaluates aerodynamic wake turbulence, upwind obstruction sheltering, and parcel failure modes (roof cladding suction, window missile breach).

#### Macro-Feature 5: 3D Interactive WebGL Earth Globe (`#app` -> Globe Mode)
A global orbital visualization powered by Three.js. Features an interactive Earth sphere with custom GLSL atmospheric glow raymarching shaders, dynamic cloud rotation, and 3D pinned cyclone eye coordinates and trajectory paths.

#### Macro-Feature 6: Real-Time Meteorological Station (`#realtime-weather`)
A live meteorological monitoring page providing live station observations from coastal IMD automatic weather stations (AWS), Doppler Weather Radars (DWR), barometric traces, dew-point depressions, and wind gust spectra.

#### Macro-Feature 7: Automated Disaster Intelligence Hub (`#news-bulletins`)
An automated news and bulletin aggregator that ingests official IMD National Cyclone Bulletins, RSMC New Delhi advisories, and disaster RSS feeds with automated severity classification.

#### Macro-Feature 8: Dataset & Model Registry (`#dataset`)
A comprehensive scientific registry inspecting NOAA HURSAT-B1 and IBTrACS historical datasets, displaying training, validation, and test partitions, sample counts, and historical cyclone records.

---

## 5. Machine Learning Architectures: Detailed Model Specifications

```
                     MODEL SPECIFICATIONS TABLE
┌─────────────────────────────┬───────────────────────────────────────────────┐
│ Model Checkpoint            │ cyclone_detection_model.pt                    │
│ Parameter Count             │ ~78,400 parameters                           │
│ Input Dimensions            │ (Batch, 4, 224, 224)                          │
│ Input Channels              │ [TIR-1, Water Vapor, Microwave, Visible]      │
│ Feature Backbone            │ 4-Stage ConvBlock (16 -> 32 -> 64 -> 128)     │
│ Pooling                     │ AdaptiveAvgPool2d((2, 2)) -> Flatten (512-dim)│
│ Output Heads                │ 1. Linear(512, 1) -> Sigmoid (Presence)       │
│                             │ 2. Linear(512, 2) -> Tanh (Center Offset dx,dy)│
│ Loss Function               │ BCEWithLogitsLoss + 3.0 * MSELoss            │
├─────────────────────────────┼───────────────────────────────────────────────┤
│ Model Checkpoint            │ cyclone_pattern_model.pt                      │
│ Parameter Count             │ ~142,600 parameters                          │
│ Input Dimensions            │ (Batch, 4, 224, 224)                          │
│ Feature Backbone            │ 4-Stage ConvBlock (24 -> 48 -> 96 -> 160)     │
│ Pooling & Regularization    │ AdaptiveAvgPool2d((1, 1)) -> Dropout(0.25)    │
│ Output Head                 │ Linear(160, 6) -> Softmax (6 Dvorak Classes)  │
│ Explainability Hook         │ Backward hook on layer4 for Grad-CAM saliency │
│ Loss Function               │ CrossEntropyLoss                              │
├─────────────────────────────┼───────────────────────────────────────────────┤
│ Model Checkpoint            │ cyclone_ri_model.pt                           │
│ Parameter Count             │ ~48,200 parameters                           │
│ Input Dimensions            │ Image: (B, 4, 224, 224) | Ocean: (B, 4)       │
│ Image Backbone              │ 3-Stage ConvBlock (16 -> 32 -> 64) -> 256-dim │
│ Fusion Layer                │ Concatenation [Image (256) || Ocean (4)] = 260│
│ Classification Head         │ Linear(260, 64) -> ReLU -> Dropout -> Linear(1)│
│ Output                      │ Sigmoid probability of RI (ΔV >= 30 kt / 24h) │
│ Loss Function               │ BCEWithLogitsLoss                             │
├─────────────────────────────┼───────────────────────────────────────────────┤
│ Model Checkpoint            │ cyclone_intensity_model.pt                    │
│ Parameter Count             │ ~96,800 parameters                           │
│ Input Dimensions            │ Image: (B, 4, 224, 224) | Telemetry: (B, 8)   │
│ Image Backbone              │ 3-Stage ConvBlock (16 -> 32 -> 64) -> 256-dim │
│ Fusion Layer                │ Concatenation [Image (256) || Telemetry (8)]  │
│ Dual Regression Heads       │ 1. Intensity Head: Linear(264, 128) -> Linear(8)│
│                             │    Outputs: (+6h, +12h, +24h, +48h ΔV & ΔP)   │
│                             │ 2. Track Head: Linear(264, 128) -> Linear(8)   │
│                             │    Outputs: (+6h, +12h, +24h, +48h Δlat & Δlon)│
│ Loss Function               │ MSELoss(intensity) + 15.0 * MSELoss(track)    │
└─────────────────────────────┴───────────────────────────────────────────────┘
```

---

## 6. Complete Technology Stack & Comprehensive Resource Inventory

### 6.1 Frontend Architecture

| Resource / Package | Version | Purpose & Technical Function |
| :--- | :--- | :--- |
| **React** | `^19.1.1` | Component lifecycle, virtual DOM reconciliation, stateful UI hooks |
| **TypeScript** | `^5.9.2` | Static typing, compile-time strictness, interface schema verification |
| **Vite** | `^7.1.4` | Modern ESM build toolchain, lightning-fast HMR and optimized minified rollup |
| **Leaflet** | `^1.9.4` | 2D interactive mapping, GeoJSON polygon grid canvas, custom `divIcon` pins |
| **React-Leaflet** | `^5.0.0` | React wrapper bindings for Leaflet map context and layers |
| **Three.js** | `^0.186.0` | 3D WebGL interactive Earth globe, orbital controls, atmospheric shaders |
| **MapLibre GL** | `^6.9.0` | Vector tile rendering, 3D building parcel extrusion (`fill-extrusion`), camera pitch/bearing |
| **Lucide React** | `^1.45.0` | Clean institutional iconography across tactical panels and control strips |
| **CSS3 Design System** | Native | Human-engineered, de-AI-ified institutional palette with full Dark/Light theme support |

### 6.2 Backend Architecture

| Resource / Package | Version | Purpose & Technical Function |
| :--- | :--- | :--- |
| **Python** | `3.11+` | Core programming language for data engineering, physics simulation, and AI |
| **FastAPI** | `0.115.0` | High-performance asynchronous REST API framework, automatic OpenAPI documentation |
| **Uvicorn** | `0.30.6` | Lightning-fast ASGI web server with standard worker loop |
| **Pydantic** | `v2` | Data validation, request/response schema parsing, typing contracts |
| **Requests** | `2.32.3` | HTTP client for external meteorological scraping, RSS ingestion, and live satellite polling |
| **SQLite3** | Native (WAL) | Embedded persistent database storing scenarios, risk grids, news feeds, and datasets |

### 6.3 Artificial Intelligence & Machine Learning Stack

| Resource / Library | Purpose & Technical Implementation |
| :--- | :--- |
| **PyTorch (`torch`, `torch.nn`)** | Neural network definition, forward passes, tensor algebra, GPU/CPU execution |
| **NumPy (`numpy`)** | Multi-dimensional array operations, synthetic satellite channel synthesis, tensor conversions |
| **Scikit-Learn (`sklearn`)** | Baseline statistical regressors, train/validation dataset splitting, performance metrics |
| **Grad-CAM** | Saliency gradient backpropagation for explainable visual attention maps |

### 6.4 Multi-Source Satellite & Environmental Data Sources

| Source / Feed | Sensor / Agency | Parameters Ingested |
| :--- | :--- | :--- |
| **INSAT-3DR** | IMD / ISRO | Thermal Infrared 1 ($10.8\,\mu\text{m}$), Water Vapor ($6.7\,\mu\text{m}$), Visible ($0.65\,\mu\text{m}$) |
| **ScatSat-1 / Oceansat** | ISRO / EUMETSAT | Ocean surface wind vectors, circulation center, storm gale radii |
| **NOAA HURSAT-B1** | NOAA NCEI | 8 km geostationary global tropical cyclone IR brightness temperatures |
| **IBTrACS v04** | NOAA / WMO | Official best-track database (storm coordinates, central pressure, maximum sustained wind) |
| **Open-Meteo / IMD AWS** | Global / IMD | Live station pressure, gust velocities, ambient temperature, radar reflectivity |
| **ESRI World Imagery** | Esri / Maxar | High-resolution satellite basemap imagery for 2D tactical and 3D city views |
| **OpenStreetMap** | OSM Foundation | Building footprint polygons, coastal road networks, and land-use classifications |

---

## 7. Complete API Endpoints Reference

| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ai/analyze-cyclone` | Runs 4 PyTorch models on 4-band satellite inputs for identification, classification & intensity |
| `GET` | `/api/ai/models-status` | Reports PyTorch model files status, parameters, hardware accelerator, and readiness |
| `POST` | `/api/v2/scenarios` | Runs 200m spatial risk simulation applying Rankine Vortex + IS 875 wind loading code |
| `GET` | `/api/v2/scenarios/{id}/risk-grid` | Returns complete GeoJSON FeatureCollection of 200m risk parcels with $LRR$ metrics |
| `GET` | `/api/v2/scenarios/{id}/cells/{cid}` | Returns micro-scale structural inspection dossier for a specific picked grid cell |
| `GET` | `/api/v2/scenarios/{id}/shelters-evacuation` | Computes NDMA MPCS shelter allocation, bed utilization, and shortest evacuation paths |
| `GET` | `/api/v2/scenarios/{id}/buildings` | Returns 3D building footprint GeoJSON with heights, structural classes, and loss ratios |
| `GET` | `/api/v2/scenarios/{id}/zones` | Returns coastal ward boundaries and parcel land-use polygons |
| `GET` | `/api/ocean-node?lat={lat}&lon={lon}` | Queries subsurface Ocean Heat Content ($OHC$), thermocline depth, and $SST$ |
| `GET` | `/api/v2/realtime-weather` | Fetches live coastal automatic weather station (AWS) observations and barometric data |
| `GET` | `/api/v2/news/articles` | Ingests real-time IMD cyclone bulletins, RSMC New Delhi warnings, and RSS feeds |
| `POST` | `/api/v2/news/scrape` | Triggers active scraping of official disaster intelligence channels |
| `POST` | `/api/v3/observations/ingest` | Ingests new satellite imagery patches into the ML repository |
| `POST` | `/api/v3/best-tracks/ibtracs` | Parses and registers official NOAA IBTrACS historical storm CSV archives |
| `GET` | `/api/v3/dataset-summary` | Summarizes ML dataset partitions (Train, Validation, Test sample counts) |
| `GET` | `/health` | System health check reporting integration status and physics constraints |

---

## 8. Operational Provenance & Verification

- **Production Build Status**: Verified with `tsc -b && vite build` with **0 errors**.
- **Backend API Status**: FastAPI operational on port `8000` with CORS middleware and options routing.
- **Frontend Server**: Vite development server running on port `5173`.
- **SIH 2024 Alignment**: Engineered by student researchers to fulfill Problem Statement 1736, replacing black-box AI estimations with an integrated pipeline of deep multi-source satellite networks, classical atmospheric physics, and Indian Standard civil engineering codes.
