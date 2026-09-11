# CYCLONEX: Comprehensive End-to-End Technical & Mathematical Specification
## The Definitive Guide to Architecture, AI/ML Models, Physics Equations, Libraries & Operational Workflows

---

### Executive Overview & Evaluation Summary

**CYCLONEX** is an AI-powered tropical cyclone intelligence and multi-scale impact platform designed for the North Indian Ocean basin (Bay of Bengal and Arabian Sea). 

When evaluators and jury panels ask:
1. **"Which libraries and packages are you using and why?"**
2. **"Which AI/ML models are used, what are their architectures, and how do they work?"**
3. **"What exact calculations and mathematical equations are performed in each step?"**
4. **"What is the complete end-to-end data processing workflow from satellite ingestion to evacuation?"**

This document provides the exhaustive, task-by-task technical defense.

---

```
                                    MASTER SYSTEM PIPELINE FLOW
                                    
  [ STEP 1: SATELLITE & OCEAN INGESTION ] ────► [ STEP 2: TENSOR FUSION & PREPROCESSING ]
  • INSAT-3DR (VIS, IR, WV)                    • Shape: (1, 4, 224, 224)
  • NOAA HURSAT-B1 (IR 8km)                    • Decoded via Pillow (PIL), NumPy Normalization
  • HYCOM Ocean Dynamics (TB, VF)
                        │
                        ▼
  [ STEP 3: AI PATTERN & INTENSITY CLASSIFICATION ] ──► [ STEP 4: ENSEMBLE TRAJECTORY PREDICTION ]
  • PyTorchPatternClassifier (CNN + BatchNorm)          • GradientBoostedMultiOutputEnsemble (Scikit-Learn)
  • Softmax -> 6 Dvorak Classes                         • Input: 9-Dim Ocean/Atmospheric Feature Vector
  • Output: Structural Stage & Confidence               • Output: 12-Dim (+6h, +12h, +24h Lat, Lon, Wind, Press)
                        │
                        ▼
  [ STEP 5: ATMOSPHERIC & AERODYNAMIC PHYSICS ] ────► [ STEP 6: 200m HYPER-LOCAL DAMAGE GRID ]
  • Holland (1980) Radial Wind Field Equations         • Dynamic Wind Pressure: q = 0.5 * rho * v^2 * Cp * Cg
  • Logarithmic Terrain Roughness Degradation          • Multi-Factor Damage Index: S_damage ∈ [0, 1]
  • Storm Surge Hydrodynamic Estimation                • Categorization: Low (Green), Moderate (Yellow), Severe (Red)
                        │
                        ▼
  [ STEP 7: EVACUATION & SHELTER ROUTING ] ────────► [ STEP 8: DUAL 3D VISUALIZATION & SITREP ]
  • Dijkstra Graph Network Optimization                • Three.js WebGL 3D Planetary Vortex Simulation
  • Population-to-Capacity Shelter Allocation          • MapLibre GL 3D Extruded City Digital Twin
  • Blocked Road Pruning                               • NDMA Standard Formatted Situation Report (SITREP)
```

---

## Task 1: Multi-Channel Satellite Ingestion & Tensor Fusion

### 1.1 Process Workflow
1. Multi-spectral satellite data from **ISRO INSAT-3DR**, **NOAA HURSAT-B1**, and polar-orbiting microwave sensors are ingested via HTTP/REST payloads.
2. The raw base64/binary payloads are decoded, converted to single-channel 8-bit grayscale grids, and resized to a canonical spatial resolution of $224 \times 224$ pixels.
3. Pixel intensities $[0, 255]$ are normalized to floating-point values in the range $[0.0, 1.0]$.
4. Channels are stacked across the channel dimension to construct a 4D tensor of shape `(1, 4, 224, 224)`. Missing channels are zero-padded to maintain dimensional determinism.

### 1.2 Libraries & Packages Used
- **`pillow` (`PIL.Image`)**: In-memory image decoding, color space transformation (`.convert("L")`), and bilinear resizing (`.resize((224, 224))`).
- **`numpy`**: Array conversion, channel slicing, and matrix normalization.
- **`torch` (`torch.Tensor`)**: Tensor wrapping and dimension expansion (`.unsqueeze(0)` for batch dimension).

### 1.3 Exact Mathematical Calculations
- **Min-Max Normalization**:
  $$I_{\text{norm}}(x, y) = \frac{I_{\text{raw}}(x, y) - \min(I)}{\max(I) - \min(I)} \in [0.0, 1.0]$$
- **Brightness Temperature ($T_B$) Conversion (Planck Inversion)**:
  $$T_B = \frac{c_2 \cdot \nu}{\ln\left(1 + \frac{c_1 \cdot \nu^3}{L_\lambda}\right)}$$
  *Where $c_1, c_2$ are radiation constants, $\nu$ is channel wavenumber, and $L_\lambda$ is measured spectral radiance.*

---

## Task 2: AI Cyclone Identification & Dvorak Pattern Classification

### 2.1 Process Workflow
1. The 4-channel tensor $\mathbf{X} \in \mathbb{R}^{1 \times 4 \times 224 \times 224}$ is passed through the [`PyTorchPatternClassifier`](file:///c:/Users/techa/OneDrive/Desktop/des/SIH/Cyclonex/ai_cyclone_service.py#L153-L174) convolutional neural network.
2. 2D convolutions extract hierarchical spatial features (edges $\to$ convective spiral bands $\to$ central dense overcast $\to$ eyewall pinhole).
3. Batch normalization stabilizes activation distributions; ReLU non-linearities introduce gradient sparsity.
4. Adaptive average pooling compresses feature maps into a fixed $4 \times 4 \times 64$ latent vector.
5. Fully connected linear projection outputs logits across 6 Dvorak lifecycle classes. Softmax computes posterior probabilities.

### 2.2 Neural Network Architecture
```
INPUT: (1, 4, 224, 224)
  │
  ├── Conv2D(in=4, out=16, kernel=3, stride=2, padding=1)  ──► Output: (1, 16, 112, 112)
  ├── BatchNorm2d(16) + ReLU()
  │
  ├── Conv2D(in=16, out=32, kernel=3, stride=2, padding=1) ──► Output: (1, 32, 56, 56)
  ├── BatchNorm2d(32) + ReLU()
  │
  ├── Conv2D(in=32, out=64, kernel=3, stride=2, padding=1) ──► Output: (1, 64, 28, 28)
  ├── BatchNorm2d(64) + ReLU()
  │
  ├── AdaptiveAvgPool2d((4, 4))                            ──► Output: (1, 64, 4, 4)
  ├── Flatten()                                            ──► Output: (1, 1024)
  └── Linear(in_features=1024, out_features=6)             ──► Output: (1, 6) [Logits]
```

### 2.3 Libraries & Packages Used
- **`torch.nn` (`nn.Module`, `nn.Conv2d`, `nn.BatchNorm2d`, `nn.Linear`, `nn.AdaptiveAvgPool2d`)**: Deep learning layer primitives.
- **`torch.nn.functional` (`F.relu`, `F.softmax`)**: Activation and probability distributions.

### 2.4 Mathematical Formulas & Loss Function
- **Softmax Posterior Probability**:
  $$P(\text{class} = k \mid \mathbf{X}) = \frac{\exp(z_k)}{\sum_{j=1}^{6} \exp(z_j)}$$
- **Multi-Class Cross-Entropy Training Loss**:
  $$\mathcal{L}_{\text{CE}} = -\sum_{k=1}^{6} y_k \cdot \log\left(P(\text{class} = k)\right)$$

---

## Task 3: Ensemble Multi-Horizon Trajectory & Intensity Prediction

### 3.1 Process Workflow
1. The feature extraction pipeline extracts a 9-dimensional state vector from current storm telemetry and ocean coupling nodes:
   $$\mathbf{v} = \left[ \text{lat}, \text{lon}, V_{\text{max}}, P_{\text{central}}, \theta_{\text{heading}}, V_{\text{forward}}, T_B, V_F, \Delta P \right]$$
2. Feature vectors are scaled using `StandardScaler` fitted exclusively on storm-separated training sets (no data leakage).
3. The `GradientBoostedMultiOutputEnsemble` passes the scaled features through parallel gradient-boosted regression trees.
4. The ensemble predicts 12 continuous target values representing coordinate deltas $(\Delta\text{lat}, \Delta\text{lon})$, maximum wind speed ($V$), and central pressure ($P$) at $+6\text{h}$, $+12\text{h}$, and $+24\text{h}$.
5. Historical validation errors determine dynamic empirical uncertainty radii ($9.6\text{ km}$ at 6h, $19.2\text{ km}$ at 12h, $38.5\text{ km}$ at 24h).

### 3.2 Libraries & Packages Used
- **`sklearn.ensemble.GradientBoostingRegressor`**: Tree boosting ensemble minimizing least-squares loss via steepest gradient descent.
- **`sklearn.multioutput.MultiOutputRegressor`**: Wrapper mapping the independent 12-dimensional output regression space.
- **`sklearn.preprocessing.StandardScaler`**: Zero-mean unit-variance transformation: $z = \frac{x - \mu}{\sigma}$.

### 3.3 Mathematical Formulas
- **Gradient Boosting Additive Model**:
  $$\hat{y}_m(x) = \hat{y}_{m-1}(x) + \gamma_m h_m(x)$$
  *Where $h_m(x)$ is the base regression tree fitted to the pseudo-residuals $r_{im} = -\left[\frac{\partial L(y_i, f(x_i))}{\partial f(x_i)}\right]_{f=\hat{y}_{m-1}}$, and $\gamma_m$ is the step size.*
- **Haversine Great-Circle Trajectory Distance**:
  $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
  *Where $R = 6371.0\text{ km}$, $\phi = \text{latitude}$, and $\lambda = \text{longitude}$.*

---

## Task 4: Physics-Informed Radial Wind & Atmospheric Degradation

### 4.1 Process Workflow
1. Evaluates storm intensity parameters ($V_{\text{max}}$, $P_{\text{central}}$, $R_{\text{max}}$).
2. Calculates the Holland shape parameter $B$ dynamically as a function of the central pressure deficit.
3. Evaluates the radial gradient wind velocity $V(r)$ at any distance $r$ from the eye center.
4. Accounts for Earth's rotational Coriolis acceleration based on latitude.
5. Applies the logarithmic atmospheric boundary layer formula to simulate wind deceleration as the vortex crosses the ocean-land interface.

### 4.2 Exact Mathematical Formulas
- **Holland (1980) Gradient Wind Field**:
  $$V(r) = \sqrt{ V_{\text{max}}^2 \cdot \left(\frac{R_{\text{max}}}{r}\right)^B \cdot \exp\left(1 - \left(\frac{R_{\text{max}}}{r}\right)^B\right) + \left(\frac{r \cdot f}{2}\right)^2 } - \frac{r \cdot f}{2}$$
- **Dynamic Holland Parameter ($B$)**:
  $$B = 1.5 + \frac{1013.25 - P_{\text{central}}}{100}, \quad 1.0 \le B \le 2.5$$
- **Coriolis Parameter ($f$)**:
  $$f = 2\Omega \sin(\phi) = 2 \cdot (7.2921 \times 10^{-5}\text{ rad/s}) \cdot \sin(\phi)$$
- **Logarithmic Terrain Roughness Wind Transition**:
  $$V_{\text{surface}}(z) = V_{\text{gradient}} \cdot \frac{\ln(z / z_0)}{\ln(z_{\text{gradient}} / z_0)}$$
  - Ocean aerodynamic roughness length: $z_{0,\text{ocean}} = 0.0002\text{ m}$
  - Coastal / urban terrain roughness length: $z_{0,\text{urban}} = 0.85\text{ m}$

---

## Task 5: 200-Meter Hyper-Local Spatial Risk & Damage Index

### 5.1 Process Workflow
1. The coastal geographic region is partitioned into a uniform geospatial raster of $200\text{m} \times 200\text{m}$ grid cells.
2. For each cell, local radial distance $r$ to the predicted cyclone eye is calculated via the Haversine formula.
3. Local wind speed $V(r)$ is translated into dynamic aerodynamic kinetic velocity pressure $q$.
4. Storm surge water level $H_{\text{surge}}$ is calculated using bathymetric slope and atmospheric pressure deficit.
5. Structural density $\rho_{\text{density}}$ and construction vulnerability factors $\mathcal{V}$ are queried from municipal GIS layers.
6. The multi-factor compound damage index $S_{\text{damage}} \in [0.0, 1.0]$ is computed and categorized into color-coded risk zones:
   - **Green (Low Risk: $S < 0.35$)**: Normal operations, minor non-structural precautions.
   - **Yellow (Moderate Risk: $0.35 \le S < 0.70$)**: Structural warning, window shuttering, selective evacuation.
   - **Red (Severe Risk: $S \ge 0.70$)**: Direct structural failure risk, mandatory evacuation.

### 5.2 Exact Mathematical Formulas
- **Aerodynamic Kinetic Velocity Pressure ($q$)**:
  $$q = \frac{1}{2} \cdot \rho_{\text{air}} \cdot V(r)^2 \cdot C_p \cdot C_g$$
  *Where $\rho_{\text{air}} = 1.225\text{ kg/m}^3$, $C_p = 0.8$ (pressure coefficient), $C_g = 1.35$ (gust factor).*
- **Hydrostatic Storm Surge Approximation ($H_{\text{surge}}$)**:
  $$H_{\text{surge}} = 0.01 \cdot (1013.25 - P_{\text{central}}) + \frac{\tau_w \cdot L}{\rho_w \cdot g \cdot h_{\text{bathymetry}}}$$
  *Where $\tau_w = \rho_{\text{air}} C_d V_{\text{surface}}^2$ is wind surface stress, $L$ is fetch length, $g = 9.81\text{ m/s}^2$.*
- **Compound 200m Damage Index ($S_{\text{damage}}$)**:
  $$S_{\text{damage}} = w_1 \cdot \min\left(1.0, \frac{q}{q_{\text{crit}}}\right) + w_2 \cdot \left(\frac{H_{\text{surge}}}{H_{\text{max}}}\right) + w_3 \cdot \left(\rho_{\text{density}} \cdot \mathcal{V}_{\text{structural}}\right)$$
  *Default calibrated weights: $w_1 = 0.45$ (Wind force), $w_2 = 0.35$ (Surge inundation), $w_3 = 0.20$ (Vulnerability), $q_{\text{crit}} = 2500\text{ Pa}$, $H_{\text{max}} = 6.0\text{ m}$.*

---

## Task 6: Dijkstra Evacuation Routing & Shelter Allocation

### 6.1 Process Workflow
1. The road network is modeled as a weighted directed graph $G = (V, E)$, where vertices $V$ represent road intersections/shelters and edges $E$ represent road segments.
2. Edge weights represent effective travel time $t_e$, dynamically scaled by flooding depth and wind debris risk.
3. Flooded road segments ($H_{\text{surge}} > 0.3\text{ m}$ or $S_{\text{damage}} > 0.8$) are pruned from the graph ($t_e = \infty$).
4. Priority-queue Dijkstra's algorithm computes the single-source shortest path from high-risk residential blocks to designated reinforced cyclone shelters.
5. Shelter capacity constraints ensure evacuees are distributed across nearby shelters without exceeding capacity.

### 6.2 Libraries & Algorithm
- **Graph Search**: Priority-Queue Min-Heap Dijkstra ($\mathcal{O}((V + E)\log V)$).
- **Edge Weight Function**:
  $$W(e) = \frac{\text{Length}(e)}{V_{\text{base}}} \cdot \left(1 + \alpha \cdot S_{\text{damage}}(e) + \beta \cdot H_{\text{surge}}(e)\right)$$

---

## Task 7: Three.js WebGL 3D Planetary Simulation

### 7.1 Process Workflow
1. Instantiates a WebGL renderer, perspective camera ($45^\circ$ FOV), and orbital controller inside the DOM canvas.
2. Generates a 3D Earth sphere geometry mapped with NASA Blue Marble textures and bump maps.
3. Converts geographic spherical coordinates $(\text{lat}, \text{lon})$ to 3D Cartesian coordinates $(x, y, z)$ on a sphere of radius $R$:
   $$x = R \cdot \cos(\phi) \cdot \cos(\lambda), \quad y = R \cdot \sin(\phi), \quad z = -R \cdot \cos(\phi) \cdot \sin(\lambda)$$
4. Attaches a dynamic `cycloneGroup` mesh containing concentric eyewall rings and rotating particle sprites.
5. In the animation loop (`requestAnimationFrame`), performs continuous smooth trajectory interpolation between discrete forecast timesteps using vector linear interpolation (`lerp`) and quaternion spherical interpolation (`slerp`).

### 7.2 Libraries & Shaders Used
- **`three`**: WebGL scene graph, `SphereGeometry`, `ShaderMaterial`, `BufferGeometry`, `PointsMaterial`.
- **Custom Fresnel Shader**: Simulates Rayleigh scattering in the upper atmosphere.
  $$I_{\text{fresnel}} = \left(1.0 - \mathbf{N} \cdot \mathbf{V}\right)^{\text{power}}$$
  *Where $\mathbf{N}$ is the surface normal vector and $\mathbf{V}$ is the camera view direction.*

---

## Task 8: MapLibre GL 3D Urban Digital Twin

### 8.1 Process Workflow
1. Initializes a MapLibre GL WebGL map context with high-pitch perspective ($60^\circ$ pitch, $20^\circ$ bearing).
2. Loads vector tile basemaps (CartoDB Dark Matter) and overlays GeoJSON polygon sources.
3. Renders 3D extruded building footprints using `fill-extrusion` layers.
4. Dynamically evaluates building vulnerability properties (`height`, `damage_risk`, `building_type`) using data-driven style expressions.
5. Renders dynamic color fills: `#22c55e` (safe), `#eab308` (warning), `#ef4444` (danger).
6. Overlays animated wind particle vectors and Dijkstra evacuation route linestrings with pulsating dash arrays.

### 8.2 Libraries & Key MapLibre Layers
- **`maplibre-gl`**: Vector tile rendering and WebGL GPU rasterization.
- **`fill-extrusion-height`**: Driven by building floor count ($\text{height} = \text{levels} \times 3.2\text{ m}$).
- **`fill-extrusion-color`**: Expression-based dynamic risk ramp:
  ```json
  ["interpolate", ["linear"], ["get", "damage_score"], 0.0, "#22c55e", 0.5, "#eab308", 1.0, "#ef4444"]
  ```

---

## Task 9: Automated NDMA Formatted SITREP Export

### 9.1 Process Workflow
1. Aggregates live system state: active storm telemetry, AI pattern classification, multi-horizon forecasts, impacted population statistics, and shelter status.
2. Injects data into a structured printable A4 HTML/CSS template adhering to NDMA SITREP formatting guidelines.
3. Formats tables with dual unit conversions ($\text{km/h}$ and $\text{knots}$, $\text{hPa}$ and $\text{mmHg}$).
4. Generates an SHA-256 cryptographic verification checksum for tamper-proof traceability.
5. Invokes browser print rendering (`window.print()`) configured with `@media print` CSS rules for instant high-resolution PDF generation.

---

## Quick Reference Summary Table for Panelists & Evaluators

| System Task | Primary Technology / Library | Model / Algorithm | Key Mathematical Formula |
|---|---|---|---|
| **1. Ingestion & Preprocessing** | `pillow`, `numpy`, `torch` | 4-Channel Multi-Spectral Fusion | $I_{\text{norm}} = (I - I_{\text{min}}) / (I_{\text{max}} - I_{\text{min}})$ |
| **2. Pattern Classification** | `torch.nn`, `torchvision` | `PyTorchPatternClassifier` (CNN) | $P(k) = \frac{e^{z_k}}{\sum e^{z_j}}$, Cross-Entropy Loss |
| **3. Trajectory Forecast** | `scikit-learn` | `GradientBoostedMultiOutputEnsemble` | $\hat{y}_m(x) = \hat{y}_{m-1}(x) + \gamma_m h_m(x)$ |
| **4. Wind Field Physics** | `numpy`, `math` | Holland (1980) Radial Profile | $V(r) = \sqrt{V_m^2 (R_m/r)^B e^{1-(R_m/r)^B} + (rf/2)^2} - rf/2$ |
| **5. 200m Damage Risk Grid** | `fastapi`, `numpy` | Compound Damage Index | $S_{\text{damage}} = w_1(q/q_{\text{crit}}) + w_2(H_{\text{surge}}/H_m) + w_3(\rho\mathcal{V})$ |
| **6. Evacuation Routing** | `custom graph engine` | Priority-Queue Dijkstra | $W(e) = \frac{L(e)}{V}(1 + \alpha S_{\text{damage}} + \beta H_{\text{surge}})$ |
| **7. 3D Planetary Simulation** | `three` (Three.js WebGL) | Continuous Spherical Interpolation | $x=R\cos\phi\cos\lambda$, `slerp`, `lerpVectors` |
| **8. 3D Urban Digital Twin** | `maplibre-gl` | Fill-Extrusion Risk Shader | $\text{Height} = L \times 3.2\text{m}$, Dynamic RGB Hex Interpolation |
| **9. Formatted SITREP Export** | `react`, CSS Print Engine | NDMA Executive Standard Formatter | SHA-256 Checksum, `@media print` A4 Vector Layout |

---
*CYCLONEX Technical Architecture & Mathematical Manual • Ready for SIH Evaluation, Technical Defense & Operational Deployment.*
