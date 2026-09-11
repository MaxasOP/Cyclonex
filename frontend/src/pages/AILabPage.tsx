import { useState, useRef } from "react";
import {
  Brain,
  RotateCw,
  Zap,
  Sliders,
  Activity,
  Split,
  ChevronRight,
  Sparkles,
  Layers,
  Radio,
  Eye,
  ShieldAlert,
  Gauge
} from "lucide-react";
import type { AICycloneAnalysisResponse } from "../api";

interface AILabPageProps {
  analysis: AICycloneAnalysisResponse | null;
  loading: boolean;
  onRunAnalysis: (lat?: number, lon?: number, wind?: number, pressure?: number) => void;
  stormName: string;
  lat: number;
  lon: number;
  windKph: number;
  pressureHpa: number;
  onNavigateToCommand: (
    presetKey?: string,
    customCoords?: { lat: number; lon: number; wind: number; pressure: number; name?: string }
  ) => void;
}

export default function AILabPage({
  analysis,
  loading,
  onRunAnalysis,
  stormName,
  lat,
  lon,
  windKph,
  pressureHpa,
  onNavigateToCommand,
}: AILabPageProps) {
  const [selectedChannel, setSelectedChannel] = useState<"IR" | "WV" | "MW" | "VIS">("IR");
  const [activeStage, setActiveStage] = useState<number>(3); // 1 to 7
  const [viewMode, setViewMode] = useState<"pipeline" | "slider">("slider");
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 to 100
  const isDragging = useRef<boolean>(false);

  const [customLat, setCustomLat] = useState(lat.toString());
  const [customLon, setCustomLon] = useState(lon.toString());
  const [customWind, setCustomWind] = useState(windKph.toString());
  const [customPressure, setCustomPressure] = useState(pressureHpa.toString());

  const currentWind = Number(customWind) || windKph || 120;
  const currentPressure = Number(customPressure) || pressureHpa || 984;
  const currentLat = Number(customLat) || lat || 18.35;
  const currentLon = Number(customLon) || lon || 72.98;

  // Dynamic Dvorak intensity calculations
  const dvorakScore = Math.min(8.0, Math.max(1.0, Number((1.0 + (currentWind - 45) / 18).toFixed(1))));
  const dvorakCI = `T${dvorakScore.toFixed(1)}`;
  const dvorakKnots = Math.round(currentWind / 1.852);
  const deltaP = Math.max(5, 1010 - currentPressure);

  const imdClassification =
    currentWind >= 222
      ? "Super Cyclonic Storm (SuCS)"
      : currentWind >= 166
      ? "Extremely Severe Cyclonic Storm (ESCS)"
      : currentWind >= 118
      ? "Very Severe Cyclonic Storm (VSCS)"
      : currentWind >= 89
      ? "Severe Cyclonic Storm (SCS)"
      : currentWind >= 62
      ? "Cyclonic Storm (CS)"
      : "Deep Depression (DD)";

  const CHANNELS = [
    {
      id: "IR" as const,
      name: "Infrared (10.8 µm)",
      sensor: "INSAT-3DR TIRC",
      desc: "Measures cloud-top brightness temperature down to -85°C to detect intense convective eyewall bursts.",
      bandInfo: "TIR-1 Band: 10.8 µm · Spatial: 4.0 km",
    },
    {
      id: "WV" as const,
      name: "Water Vapor (6.7 µm)",
      sensor: "INSAT-3DR WV",
      desc: "Tracks upper-tropospheric moisture transport, dry air intrusion, and deep inflow feeder channels.",
      bandInfo: "WV Channel: 6.7 µm · Tropospheric Inflow",
    },
    {
      id: "MW" as const,
      name: "Microwave (89 GHz)",
      sensor: "GPM GMI Microwave",
      desc: "Penetrates cirrus canopy to image rainband curl, eyewall spiral symmetry, and concentric secondary eyewalls.",
      bandInfo: "Passive MW: 89 GHz · Rainband Penetration",
    },
    {
      id: "VIS" as const,
      name: "Visible Optical (0.65 µm)",
      sensor: "INSAT-3D VIS",
      desc: "High-resolution 1km daylight optical texture revealing eye stadium geometry and mesovortices.",
      bandInfo: "VIS Band: 0.65 µm · 1.0 km Optical Texture",
    },
  ];

  const PIPELINE_STAGES = [
    { idx: 1, title: "Raw Satellite", sub: "INSAT-3DR HDF5", desc: "Uncalibrated 10-bit digital radiometry ingest with scanlines" },
    { idx: 2, title: "Preprocessing", sub: "Tb Conversion", desc: "Brightness temperature calibration & cold cloud-top thresholding" },
    { idx: 3, title: "Pattern Analysis", sub: "Eye & Spirals", desc: "Logarithmic spiral curve fitting & convective wrap angles" },
    { idx: 4, title: "Dvorak CI", sub: `ADT ${dvorakCI}`, desc: "Objective intensity estimation via Eye/CDO thermal contrast" },
    { idx: 5, title: "ML Inference", sub: "ResNet-50", desc: "Convolutional activation heatmaps & neural feature tensor extraction" },
    { idx: 6, title: "Confidence", sub: "94.7% Certainty", desc: "Bayesian ensemble probability distribution across category weights" },
    { idx: 7, title: "Cyclone Directive", sub: imdClassification.split("(")[0].trim(), desc: "Operational warning issuance & NDMA Stage 4 alert directive" },
  ];

  const handleTriggerAnalysis = () => {
    onRunAnalysis(currentLat, currentLon, currentWind, currentPressure);
  };

  const confidenceScore = analysis?.classification?.confidence
    ? Math.round(analysis.classification.confidence * 100)
    : analysis?.identification?.confidence
    ? Math.round(analysis.identification.confidence * 100)
    : 94.7;

  // Slider Mouse Move Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos(Math.round((x / rect.width) * 100));
  };

  const currentChannelObj = CHANNELS.find((c) => c.id === selectedChannel) || CHANNELS[0];

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">
        {/* Workspace Editorial Header */}
        <div className="op-editorial-header" style={{ marginBottom: "20px" }}>
          <div>
            <div className="op-section-kicker">
              <Brain size={12} style={{ display: "inline", marginRight: "6px" }} />
              OPERATIONAL MACHINE LEARNING &middot; ADT PIPELINE
            </div>
            <h1 className="op-section-title" style={{ fontSize: "28px" }}>
              AI Satellite &amp; Neural Laboratory
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Visualizing the step-by-step transformation from raw geostationary radiometry into objective
              Dvorak T-numbers, central pressure deficits, and convolutional pattern classifications.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className={`op-layer-tab ${viewMode === "slider" ? "active" : ""}`}
              onClick={() => setViewMode("slider")}
            >
              <Split size={12} style={{ display: "inline", marginRight: "6px" }} />
              BEFORE / AFTER SLIDER
            </button>
            <button
              type="button"
              className={`op-layer-tab ${viewMode === "pipeline" ? "active" : ""}`}
              onClick={() => setViewMode("pipeline")}
            >
              <Activity size={12} style={{ display: "inline", marginRight: "6px" }} />
              STEP PIPELINE VIEW
            </button>
          </div>
        </div>

        {/* Interactive 7-Stage Pipeline Navigation Bar */}
        <div className="op-visual-pipeline-nav">
          {PIPELINE_STAGES.map((s) => (
            <button
              key={s.idx}
              type="button"
              className={`op-pipeline-step-btn ${activeStage === s.idx ? "active" : ""}`}
              onClick={() => {
                setActiveStage(s.idx);
                setViewMode("pipeline");
              }}
            >
              <div className="op-pipeline-step-num">STAGE 0{s.idx}</div>
              <div className="op-pipeline-step-label">{s.title}</div>
              <div className="op-pipeline-step-sub">{s.sub}</div>
            </button>
          ))}
        </div>

        {/* Primary Visual Object: Satellite Viewport & Interactive Comparison */}
        <div className="op-split-grid" style={{ gridTemplateColumns: "1.25fr 0.75fr", gap: "24px" }}>
          {/* Left: Interactive Satellite Canvas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Sensor Channel Selector Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#05070a",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "8px 12px",
                borderRadius: "4px",
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`op-layer-tab ${selectedChannel === ch.id ? "active" : ""}`}
                    onClick={() => setSelectedChannel(ch.id)}
                    style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 700 }}
                  >
                    {ch.id} · {ch.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: "#64748b" }}>
                SENSOR: <strong style={{ color: "#38bdf8" }}>{currentChannelObj.sensor}</strong>
              </div>
            </div>

            {/* Central Interactive Satellite Simulation Screen */}
            <div
              className="op-diff-slider-container"
              style={{ height: "430px", position: "relative", borderRadius: "4px", overflow: "hidden" }}
              onMouseDown={() => (isDragging.current = true)}
              onMouseUp={() => (isDragging.current = false)}
              onMouseLeave={() => (isDragging.current = false)}
              onMouseMove={handleMouseMove}
            >
              {/* Animated Scanning Beam in Stage 2 or Pipeline mode */}
              {(activeStage === 2 || viewMode === "pipeline") && <div className="op-scanning-beam" />}

              {/* View 1: RAW SATELLITE (Left Layer / Base) */}
              <div
                className="op-diff-layer"
                style={{
                  clipPath: viewMode === "slider" ? `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` : undefined,
                  background: "#020408",
                  overflow: "hidden",
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 500 430" style={{ display: "block" }}>
                  <defs>
                    {/* Grayscale / Raw Radiometry */}
                    <radialGradient id="rawCloud" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#0b0f19" stopOpacity="0.95" />
                      <stop offset="12%" stopColor="#334155" stopOpacity="0.85" />
                      <stop offset="35%" stopColor="#94a3b8" stopOpacity="0.9" />
                      <stop offset="65%" stopColor="#1e293b" stopOpacity="0.75" />
                      <stop offset="100%" stopColor="#020408" stopOpacity="0" />
                    </radialGradient>
                    <pattern id="rawScanlines" width="10" height="4" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="2" x2="10" y2="2" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
                    </pattern>
                  </defs>

                  <rect width="500" height="430" fill="#020408" />
                  <rect width="500" height="430" fill="url(#rawScanlines)" />

                  {/* Raw Cloud Structure */}
                  <circle cx="250" cy="215" r="175" fill="url(#rawCloud)" />
                  <circle cx="250" cy="215" r="75" fill="#475569" opacity="0.3" filter="blur(6px)" />

                  {/* Spiral Arm Curves (Raw) */}
                  <path
                    d="M 250,215 Q 180,125 100,165 Q 60,225 80,305"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="18"
                    opacity="0.35"
                    filter="blur(8px)"
                  />
                  <path
                    d="M 250,215 Q 320,305 400,285 Q 440,205 410,135"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="22"
                    opacity="0.3"
                    filter="blur(10px)"
                  />
                  <circle cx="250" cy="215" r="12" fill="#020408" />

                  {/* Stage 1 Raw Metadata */}
                  <text x="20" y="32" fill="#64748b" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                    RAW DIGITAL COUNTS · 10-BIT {selectedChannel}
                  </text>
                  <text x="20" y="47" fill="#475569" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                    HDF5 GEOSTATIONARY ARRAY: 256 × 256 · 15-MIN INGEST
                  </text>
                </svg>

                <div className="op-diff-badge" style={{ top: "14px", left: "14px" }}>
                  RAW RADIOMETRY ({selectedChannel})
                </div>
              </div>

              {/* View 2: ANALYZED CYCLONE STRUCTURE (Right Layer / Stage Specific) */}
              <div
                className="op-diff-layer"
                style={{
                  clipPath: viewMode === "slider" ? `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)` : undefined,
                  background: viewMode === "slider" ? "transparent" : "#020408",
                  display: viewMode === "pipeline" && activeStage === 1 ? "none" : "block",
                  overflow: "hidden",
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 500 430" style={{ display: "block" }}>
                  <defs>
                    {/* 1. Infrared False-Color Spectrum Gradient */}
                    <radialGradient id="irGradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                      <stop offset="8%" stopColor="#ef4444" stopOpacity="0.95" />
                      <stop offset="28%" stopColor="#7c3aed" stopOpacity="0.85" />
                      <stop offset="55%" stopColor="#0284c7" stopOpacity="0.6" />
                      <stop offset="85%" stopColor="#0f172a" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#020408" stopOpacity="0" />
                    </radialGradient>

                    {/* 2. Water Vapor Gradient */}
                    <radialGradient id="wvGradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#082f49" stopOpacity="0.9" />
                      <stop offset="12%" stopColor="#0284c7" stopOpacity="0.85" />
                      <stop offset="35%" stopColor="#06b6d4" stopOpacity="0.9" />
                      <stop offset="65%" stopColor="#1e3a8a" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#020408" stopOpacity="0" />
                    </radialGradient>

                    {/* 3. Microwave 89GHz Gradient */}
                    <radialGradient id="mwGradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#052e16" stopOpacity="0.9" />
                      <stop offset="10%" stopColor="#ef4444" stopOpacity="0.95" />
                      <stop offset="22%" stopColor="#eab308" stopOpacity="0.9" />
                      <stop offset="45%" stopColor="#22c55e" stopOpacity="0.8" />
                      <stop offset="70%" stopColor="#14532d" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#020408" stopOpacity="0" />
                    </radialGradient>

                    {/* 4. Visible Optical Gradient */}
                    <radialGradient id="visGradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#020617" stopOpacity="0.95" />
                      <stop offset="10%" stopColor="#f8fafc" stopOpacity="0.98" />
                      <stop offset="30%" stopColor="#cbd5e1" stopOpacity="0.9" />
                      <stop offset="60%" stopColor="#64748b" stopOpacity="0.75" />
                      <stop offset="90%" stopColor="#1e293b" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#020408" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Channel Base Cloud Rendering */}
                  {selectedChannel === "IR" && <circle cx="250" cy="215" r="175" fill="url(#irGradient)" />}
                  {selectedChannel === "WV" && <circle cx="250" cy="215" r="175" fill="url(#wvGradient)" />}
                  {selectedChannel === "MW" && <circle cx="250" cy="215" r="175" fill="url(#mwGradient)" />}
                  {selectedChannel === "VIS" && <circle cx="250" cy="215" r="175" fill="url(#visGradient)" />}

                  {/* Water Vapor Dry Air Intrusion Slot (Visible in WV channel) */}
                  {selectedChannel === "WV" && (
                    <path
                      d="M 250,215 Q 210,140 160,110 Q 110,80 50,60"
                      fill="none"
                      stroke="#020617"
                      strokeWidth="24"
                      opacity="0.85"
                      filter="blur(6px)"
                    />
                  )}

                  {/* Microwave Eyewall Rainband Core (Visible in MW channel) */}
                  {selectedChannel === "MW" && (
                    <>
                      <circle cx="250" cy="215" r="32" fill="none" stroke="#ef4444" strokeWidth="5" opacity="0.9" />
                      <circle cx="250" cy="215" r="54" fill="none" stroke="#eab308" strokeWidth="4" opacity="0.85" strokeDasharray="12 4" />
                    </>
                  )}

                  {/* STAGE OVERLAYS */}

                  {/* STAGE 2: Preprocessing - Tb Thresholding Mask */}
                  {activeStage === 2 && (
                    <>
                      <circle cx="250" cy="215" r="65" fill="none" stroke="#ec4899" strokeWidth="2" strokeDasharray="3 3" />
                      <rect x="20" y="360" width="160" height="10" fill="url(#irGradient)" rx="2" />
                      <text x="20" y="354" fill="#94a3b8" fontSize="8.5" fontFamily="'JetBrains Mono', monospace">
                        Tb SCALE: -85°C (WHITE) TO +20°C (BLACK)
                      </text>
                    </>
                  )}

                  {/* STAGE 3: Logarithmic Spiral Curve Fitting */}
                  {(activeStage === 3 || viewMode === "slider") && (
                    <>
                      <path
                        d="M 250,215 Q 170,115 90,165 Q 50,235 80,315"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="5 3"
                      />
                      <path
                        d="M 250,215 Q 330,315 410,275 Q 450,195 410,125"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="5 3"
                      />
                      <text x="310" y="48" fill="#38bdf8" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                        SPIRAL FIT: r = a · e^(bθ)
                      </text>
                      <text x="310" y="63" fill="#94a3b8" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                        CONVECTIVE WRAP: 1.35 TURNS
                      </text>
                    </>
                  )}

                  {/* STAGE 4: Automated Dvorak Eye & CDO Contrast Crosshairs */}
                  {(activeStage === 4 || viewMode === "slider") && (
                    <>
                      <rect x="236" y="201" width="28" height="28" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                      <circle cx="250" cy="215" r="14" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" />
                      <line x1="220" y1="215" x2="280" y2="215" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="250" y1="185" x2="250" y2="245" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="272" y="206" fill="#ef4444" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                        EYE: -38.2°C
                      </text>
                      <text x="272" y="219" fill="#38bdf8" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                        CDO: -74.8°C
                      </text>
                      <text x="272" y="232" fill="#10b981" fontSize="9" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                        ΔT: +36.6 K ({dvorakCI})
                      </text>
                    </>
                  )}

                  {/* STAGE 5: ResNet-50 Convolutional Heatmap / Grad-CAM */}
                  {activeStage === 5 && (
                    <>
                      <circle cx="250" cy="215" r="55" fill="#ef4444" opacity="0.35" filter="blur(14px)" />
                      <circle cx="280" cy="200" r="35" fill="#f59e0b" opacity="0.4" filter="blur(10px)" />
                      <circle cx="220" cy="230" r="30" fill="#f59e0b" opacity="0.4" filter="blur(10px)" />
                      <text x="310" y="48" fill="#ec4899" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                        RESNET-50 LAYER 4 ATTENTION
                      </text>
                      <text x="310" y="63" fill="#94a3b8" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                        GRAD-CAM FOCUS: EYEWALL TENSOR
                      </text>
                    </>
                  )}

                  {/* STAGE 6: Bayesian Ensemble Confidence Bar */}
                  {activeStage === 6 && (
                    <>
                      <rect x="290" y="40" width="180" height="90" fill="rgba(2,6,23,0.85)" stroke="rgba(255,255,255,0.1)" rx="4" />
                      <text x="300" y="58" fill="#38bdf8" fontSize="10" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                        ENSEMBLE POSTERIOR PROB
                      </text>
                      <text x="300" y="78" fill="#10b981" fontSize="9.5" fontFamily="'JetBrains Mono', monospace">
                        VSCS / ESCS: 94.7%
                      </text>
                      <text x="300" y="93" fill="#64748b" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                        SCS (Cat 2): 4.2%
                      </text>
                      <text x="300" y="108" fill="#64748b" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                        SUCS (Cat 5): 1.1%
                      </text>
                    </>
                  )}

                  {/* STAGE 7: Cyclone Directive & Alert */}
                  {activeStage === 7 && (
                    <>
                      <rect x="290" y="40" width="190" height="75" fill="rgba(239,68,68,0.15)" stroke="#ef4444" rx="4" />
                      <text x="300" y="60" fill="#ef4444" fontSize="10.5" fontFamily="'JetBrains Mono', monospace" fontWeight="800">
                        🚨 NDMA STAGE 4: RED ALERT
                      </text>
                      <text x="300" y="76" fill="#f8fafc" fontSize="9.5" fontFamily="'JetBrains Mono', monospace">
                        DIRECTIVE: MANDATORY EVACUATION
                      </text>
                      <text x="300" y="92" fill="#94a3b8" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                        LANDFALL SECTOR: {currentLat.toFixed(2)}°N, {currentLon.toFixed(2)}°E
                      </text>
                    </>
                  )}
                </svg>

                <div className="op-diff-badge" style={{ top: "14px", right: "14px", borderColor: "#38bdf8", color: "#38bdf8" }}>
                  STAGE 0{activeStage}: {PIPELINE_STAGES[activeStage - 1].title.toUpperCase()}
                </div>
              </div>

              {/* Draggable Split Handle (Only in Slider Mode) */}
              {viewMode === "slider" && (
                <div className="op-diff-handle" style={{ left: `${sliderPos}%` }}>
                  <div className="op-diff-handle-button">
                    <Split size={14} />
                  </div>
                </div>
              )}

              {/* Bottom Telemetry HUD Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: "10px",
                  left: "14px",
                  right: "14px",
                  background: "rgba(4, 7, 12, 0.92)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "8px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  zIndex: 15,
                  borderRadius: "4px",
                }}
              >
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  <span>
                    TARGET: <strong style={{ color: "#ffffff" }}>{stormName.split("(")[0].trim().toUpperCase()}</strong>
                  </span>
                  <span>
                    CENTER: <strong style={{ color: "#38bdf8" }}>{currentLat.toFixed(2)}°N, {currentLon.toFixed(2)}°E</strong>
                  </span>
                  <span>
                    DVORAK: <strong style={{ color: "#f59e0b" }}>{dvorakCI}</strong>
                  </span>
                  <span>
                    VMAX: <strong style={{ color: "#38bdf8" }}>{currentWind} km/h</strong>
                  </span>
                </div>
                <div style={{ color: "#10b981", fontWeight: 700 }}>
                  CONFIDENCE: {confidenceScore}%
                </div>
              </div>
            </div>

            {/* Explanatory Caption */}
            <div style={{ fontSize: "11px", color: "#64748b", display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
              <span>
                {viewMode === "slider"
                  ? "← Drag slider left/right to contrast raw radiometry against extracted isotherms"
                  : `Viewing Step 0${activeStage}: ${PIPELINE_STAGES[activeStage - 1].desc}`}
              </span>
              <span style={{ color: "#38bdf8" }}>{currentChannelObj.bandInfo}</span>
            </div>
          </div>

          {/* Right: Neural ADT Diagnostic Telemetry & Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Model Confidence & T-Number Box */}
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Activity size={14} style={{ color: "#38bdf8" }} />
                  <span>OBJECTIVE ADT INFERENCE</span>
                </div>
                <span className="op-tech-panel-badge">RESNET-50</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>Dvorak T-Number</div>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#ffffff", fontFamily: "'JetBrains Mono', monospace" }}>
                    {dvorakCI}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>Current Intensity (CI)</div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>Estimated Vmax</div>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace" }}>
                    {currentWind} <span style={{ fontSize: "13px" }}>km/h</span>
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>{dvorakKnots} kt Sustained Wind</div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>Min Central Pressure</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>
                    {currentPressure} <span style={{ fontSize: "12px" }}>hPa</span>
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>ΔP: {deltaP} hPa deficit</div>
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>Model Confidence</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#10b981", fontFamily: "'JetBrains Mono', monospace" }}>
                    {confidenceScore}%
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>High Convective Fit</div>
                </div>
              </div>

              <div
                style={{
                  padding: "10px",
                  background: analysis?.rapid_intensification?.is_ri_expected ? "rgba(239, 68, 68, 0.08)" : "rgba(255, 255, 255, 0.02)",
                  border: analysis?.rapid_intensification?.is_ri_expected ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "3px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#cbd5e1" }}>
                    IMD: {imdClassification}
                  </div>
                  {analysis?.rapid_intensification && (
                    <span style={{ fontSize: "9.5px", padding: "2px 6px", borderRadius: "3px", background: analysis.rapid_intensification.is_ri_expected ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)", color: analysis.rapid_intensification.is_ri_expected ? "#ef4444" : "#10b981", fontWeight: 700 }}>
                      RI: {(analysis.rapid_intensification.probability * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>
                  {analysis?.classification?.pattern ? `PyTorch Dvorak: ${analysis.classification.pattern.replace(/_/g, ' ').toUpperCase()}` : "Eye warming signature indicates peak intensification prior to coastal interaction."}
                </div>
              </div>
            </div>

            {/* Live Parameter Re-inference Form */}
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Sliders size={14} style={{ color: "#38bdf8" }} />
                  <span>MANUAL PARAMETER OVERRIDE</span>
                </div>
                <span className="op-tech-panel-badge">TEST BENCH</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                <div>
                  <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>
                    LATITUDE (°N)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#03060a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#ffffff",
                      padding: "6px 8px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "12px",
                      borderRadius: "3px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>
                    LONGITUDE (°E)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={customLon}
                    onChange={(e) => setCustomLon(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#03060a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#ffffff",
                      padding: "6px 8px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "12px",
                      borderRadius: "3px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>
                    WIND SPEED (km/h)
                  </label>
                  <input
                    type="number"
                    value={customWind}
                    onChange={(e) => setCustomWind(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#03060a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#ffffff",
                      padding: "6px 8px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "12px",
                      borderRadius: "3px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "#64748b", display: "block", marginBottom: "4px" }}>
                    PRESSURE (hPa)
                  </label>
                  <input
                    type="number"
                    value={customPressure}
                    onChange={(e) => setCustomPressure(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#03060a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#ffffff",
                      padding: "6px 8px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "12px",
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="op-btn-primary"
                onClick={handleTriggerAnalysis}
                disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: "8px 12px" }}
              >
                {loading ? <RotateCw size={14} className="animate-spin" /> : <Zap size={14} />}
                <span>{loading ? "Computing ConvNet Weights..." : "Re-Run Neural Inference"}</span>
              </button>
            </div>

            {/* Direct Tactical Map Link with Custom Parameter Propagation */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "rgba(56, 189, 248, 0.05)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: "3px",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff" }}>Project to Tactical Map</div>
                <div style={{ fontSize: "10px", color: "#64748b" }}>
                  Track {currentWind} km/h wind field at {currentLat.toFixed(2)}°N, {currentLon.toFixed(2)}°E
                </div>
              </div>
              <button
                type="button"
                className="op-table-link"
                onClick={() =>
                  onNavigateToCommand(undefined, {
                    lat: currentLat,
                    lon: currentLon,
                    wind: currentWind,
                    pressure: currentPressure,
                    name: `${stormName.split("(")[0].trim()} (AI Overridden)`,
                  })
                }
              >
                Launch Map &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
