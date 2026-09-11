import { useState } from "react";
import {
  BookOpen,
  Layers,
  Cpu,
  ShieldCheck,
  Code2,
  ChevronRight,
  ExternalLink,
  Sigma,
  Building2,
  Waves,
  Wind,
} from "lucide-react";

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<"physics" | "ndma" | "architecture">("physics");

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-tag">
            <BookOpen size={14} className="text-cyan-400" />
            <span>SCIENTIFIC & OPERATIONAL METHODOLOGY</span>
          </div>
          <h1 className="page-title">Technical Documentation & Methodology</h1>
          <p className="page-subtitle">
            Mathematical formulations, Holland radial wind-pressure equations, NDMA standard operating disaster protocols, and CycloneX system architecture.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("physics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "physics"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sigma size={14} />
            <span>Physics & Formulas</span>
          </button>
          <button
            onClick={() => setActiveTab("ndma")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "ndma"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck size={14} />
            <span>NDMA 4-Stage SOPs</span>
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "architecture"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu size={14} />
            <span>System Architecture</span>
          </button>
        </div>
      </div>

      {/* Physics & Formulas Tab */}
      {activeTab === "physics" && (
        <div className="space-y-6">
          {/* Holland Wind Field Equation */}
          <div className="analytics-card">
            <div className="flex items-center gap-2.5 mb-3 text-cyan-400">
              <Wind size={20} />
              <h2 className="text-base font-bold text-white">1. Holland (1980) Wind-Pressure Radial Profile</h2>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Calculates the gradient wind speed V(r) at any radial distance r from the cyclone center as a function of the Holland shape parameter B, radius of maximum wind R_max, central pressure P_c, ambient background pressure P_env, and Coriolis parameter f:
            </p>

            <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 font-mono text-cyan-300 text-xs sm:text-sm overflow-x-auto text-center mb-4">
              V(r) = √[ (B / ρ_a) · (R_max / r)^B · (P_env - P_c) · exp(-(R_max / r)^B) + (r · f / 2)² ] - (r · f / 2)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">ρ_a (Air Density)</span>
                <span className="text-white font-semibold">1.15 kg/m³ (tropical standard)</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">B (Holland Exponent)</span>
                <span className="text-white font-semibold">1.25 – 1.85 (dynamic calibration)</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">R_max (Radius to Max Wind)</span>
                <span className="text-white font-semibold">18.0 km – 35.0 km</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">f (Coriolis Parameter)</span>
                <span className="text-white font-semibold">2 · Ω · sin(φ)</span>
              </div>
            </div>
          </div>

          {/* Dynamic Wind Pressure on Facades */}
          <div className="analytics-card">
            <div className="flex items-center gap-2.5 mb-3 text-cyan-400">
              <Building2 size={20} />
              <h2 className="text-base font-bold text-white">2. Dynamic Wind Pressure on Structural Facades (IS 875 Part 3)</h2>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Building facade shear stress and roof uplift pressures are computed using the Indian Standard IS:875 velocity coefficients modified for topography and cyclone terrain roughness:
            </p>

            <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 font-mono text-cyan-300 text-xs sm:text-sm overflow-x-auto text-center mb-4">
              q_z = 0.613 · K_1 · K_2(z) · K_3 · K_4 · V_b²   [N/m²]
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">K_1 (Risk Factor)</span>
                <span className="text-white font-semibold">1.08 (50-yr post-disaster life)</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">K_2(z) (Height/Terrain)</span>
                <span className="text-white font-semibold">0.95 + 0.015 · z (coastal open)</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">K_3 (Topography Factor)</span>
                <span className="text-white font-semibold">1.00 (coastal plains)</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 block font-mono">K_4 (Cyclonic Factor)</span>
                <span className="text-white font-semibold">1.15 (NIO East Coast Belt)</span>
              </div>
            </div>
          </div>

          {/* Storm Surge Hydrodynamic Runup */}
          <div className="analytics-card">
            <div className="flex items-center gap-2.5 mb-3 text-cyan-400">
              <Waves size={20} />
              <h2 className="text-base font-bold text-white">3. Storm Surge & Inundation Runup Model (IIT-D Surge Formulation)</h2>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Total coastal water level elevation &eta; (surge) accounts for the inverted barometer effect, wind stress drag over shallow bathymetry, and astronomical tide superposition:
            </p>

            <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 font-mono text-cyan-300 text-xs sm:text-sm overflow-x-auto text-center mb-4">
              η_total = (P_env - P_c) · 0.0101 + (C_d · ρ_a · V² · L) / (ρ_w · g · h_avg) + η_tide + R_wave
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p>• <strong>Inverted Barometer:</strong> ~1 cm sea level rise per 1 hPa atmospheric pressure drop below ambient.</p>
              <p>• <strong>Wind Stress Term:</strong> Drag coefficient C_d = (0.8 + 0.065 · V) × 10⁻³ acting over continental shelf width L.</p>
              <p>• <strong>Wave Setup (R_wave):</strong> Breaking wave radiation stress contributing +0.6m to +1.4m onshore runup.</p>
            </div>
          </div>
        </div>
      )}

      {/* NDMA 4-Stage SOPs Tab */}
      {activeTab === "ndma" && (
        <div className="space-y-6">
          <div className="analytics-card">
            <h2 className="text-base font-bold text-white mb-2">IMD / NDMA Standard Cyclone Alert Stages</h2>
            <p className="text-xs text-slate-300 mb-6">
              Official operational protocol mandated by the National Disaster Management Authority (NDMA) and the India Meteorological Department (IMD) for maritime and coastal state administrations.
            </p>

            <div className="space-y-4">
              {/* Stage 1 */}
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      STAGE 1 (T - 72h)
                    </span>
                    <h3 className="text-sm font-semibold text-white">Pre-Cyclone Watch</h3>
                  </div>
                  <span className="text-xs font-mono text-blue-300">Issued by DG IMD</span>
                </div>
                <p className="text-xs text-slate-300 mb-2">
                  Issued at least 72 hours prior to the commencement of adverse weather over coastal areas when a cyclonic disturbance is located in the high seas.
                </p>
                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg">
                  <strong>Standard Actions:</strong> Coastal district collectors notified, NDRF / SDRF units placed on preliminary standby, fishermen advised not to venture into deep sea.
                </div>
              </div>

              {/* Stage 2 */}
              <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
                      STAGE 2 (T - 48h)
                    </span>
                    <h3 className="text-sm font-semibold text-white">Cyclone Alert (Yellow Message)</h3>
                  </div>
                  <span className="text-xs font-mono text-yellow-300">ACWC / CWC Issued</span>
                </div>
                <p className="text-xs text-slate-300 mb-2">
                  Issued at least 48 hours in advance of expected adverse weather onset along the coastline.
                </p>
                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg">
                  <strong>Standard Actions:</strong> Port signal warning 2/3 hoisted, Multipurpose Cyclone Shelters (MPCS) unlocked and stocked with dry rations/generators, low-lying coastal ward evacuation lists validated.
                </div>
              </div>

              {/* Stage 3 */}
              <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                      STAGE 3 (T - 24h)
                    </span>
                    <h3 className="text-sm font-semibold text-white">Cyclone Warning (Orange Message)</h3>
                  </div>
                  <span className="text-xs font-mono text-orange-300">Targeted Coastal Districts</span>
                </div>
                <p className="text-xs text-slate-300 mb-2">
                  Issued at least 24 hours in advance specifying exact landfall point, anticipated storm surge height, and wind intensity envelope.
                </p>
                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg">
                  <strong>Standard Actions:</strong> Mandatory evacuation of red-tier wards within 5 km of coast, port operations suspended, rail/road transport diversion routes triggered.
                </div>
              </div>

              {/* Stage 4 */}
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40">
                      STAGE 4 (T - 12h & Landfall)
                    </span>
                    <h3 className="text-sm font-semibold text-white">Post-Landfall Outlook (Red Message)</h3>
                  </div>
                  <span className="text-xs font-mono text-red-300">Continuous Hourly GTS</span>
                </div>
                <p className="text-xs text-slate-300 mb-2">
                  Issued at least 12 hours prior to landfall and sustained throughout overland track dissipation to guide interior state disaster authorities.
                </p>
                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg">
                  <strong>Standard Actions:</strong> Complete curfew in landfall zone, live radar tracking active, emergency medical teams prepositioned, post-cyclone clearance taskforces deployed.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Architecture Tab */}
      {activeTab === "architecture" && (
        <div className="space-y-6">
          <div className="analytics-card">
            <h2 className="text-base font-bold text-white mb-2">End-to-End CycloneX Technology Stack</h2>
            <p className="text-xs text-slate-300 mb-6">
              Modern distributed geospatial pipeline combining GPU-accelerated computer vision, real-time WebGL/Three.js rendering, and asynchronous Python REST microservices.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center gap-2 mb-3 text-cyan-400">
                  <Layers size={18} />
                  <h3 className="text-sm font-bold text-white">Frontend Geospatial UI</h3>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li>• <strong>React 19 & TypeScript:</strong> Type-safe reactive component tree.</li>
                  <li>• <strong>MapLibre GL JS:</strong> 3D vector tiles with pitch & building extrusions.</li>
                  <li>• <strong>Leaflet & Turf.js:</strong> 200m spatial damage grid & polygon operations.</li>
                  <li>• <strong>Three.js & WebGL:</strong> Interactive 3D orbital planetary storm globe.</li>
                  <li>• <strong>Tailwind CSS & Lucide:</strong> High-density tactical dark theme.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                  <Cpu size={18} />
                  <h3 className="text-sm font-bold text-white">AI / ML Core Engine</h3>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li>• <strong>PyTorch Deep Learning:</strong> Dual-stream CNN & Vision Transformer.</li>
                  <li>• <strong>Automated Dvorak:</strong> Objective eye-to-cloud-top thermal gradient.</li>
                  <li>• <strong>Holland 1980 Solver:</strong> Asymmetric parametric wind field synthesis.</li>
                  <li>• <strong>Trajectory Forecaster:</strong> RK4 integration with beta-drift physics.</li>
                  <li>• <strong>IIT-D Surge Model:</strong> Hydrodynamic coastal inundation grid.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center gap-2 mb-3 text-purple-400">
                  <Code2 size={18} />
                  <h3 className="text-sm font-bold text-white">Backend Microservices</h3>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li>• <strong>FastAPI Async Server:</strong> Sub-50ms REST API response times.</li>
                  <li>• <strong>GeoPandas & Shapely:</strong> Rapid spatial intersection calculations.</li>
                  <li>• <strong>Overpass API Ingest:</strong> Live OSM road and building queries.</li>
                  <li>• <strong>Uvicorn ASGI:</strong> Multi-worker high-concurrency event loop.</li>
                  <li>• <strong>Pydantic v2:</strong> Strict validation of sensor & telemetry payloads.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
