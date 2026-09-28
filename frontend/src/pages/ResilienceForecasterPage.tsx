import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Zap,
  Navigation,
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Layers,
  Radio,
  RefreshCw,
  Sparkles,
  Truck,
  Wind,
  Cpu,
  Share2,
  Copy,
} from "lucide-react";
import {
  fetchResilienceAssessment,
  type ResilienceAssessmentResult,
  type InfrastructureItem,
} from "../api";

interface ResilienceForecasterPageProps {
  onNavigateToCommand: () => void;
  onNavigateToAILab: () => void;
}

export const ResilienceForecasterPage: React.FC<ResilienceForecasterPageProps> = ({
  onNavigateToCommand,
  onNavigateToAILab,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ResilienceAssessmentResult | null>(null);
  const [selectedInfraId, setSelectedInfraId] = useState<string>("pwr-01");
  const [layerPower, setLayerPower] = useState<boolean>(true);
  const [layerRoads, setLayerRoads] = useState<boolean>(true);
  const [layerMedical, setLayerMedical] = useState<boolean>(true);
  const [layerGEE, setLayerGEE] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadAssessment = async () => {
    setIsRefreshing(true);
    const res = await fetchResilienceAssessment({
      storm_name: "Cyclone Nisarga",
      eye_lat: 18.35,
      eye_lon: 72.98,
      max_wind_kmh: 120.0,
      central_pressure_hpa: 984.0,
      heading_deg: 315.0,
      forward_speed_kmh: 22.0,
    });
    if (res) {
      setData(res);
      if (res.critical_infrastructure?.length > 0) {
        setSelectedInfraId(res.critical_infrastructure[0].id);
      }
    }
    setLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadAssessment();
  }, []);

  const selectedInfra = data?.critical_infrastructure.find(
    (item) => item.id === selectedInfraId
  ) || data?.critical_infrastructure[0];

  const handleCopyDispatch = () => {
    if (data?.gemini_multimodal_advisory?.early_warning_advisory_dispatch) {
      navigator.clipboard.writeText(
        data.gemini_multimodal_advisory.early_warning_advisory_dispatch
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">
        
        {/* Challenge 05 Banner Card */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.35)",
            borderRadius: "12px",
            padding: "24px 28px",
            marginBottom: "24px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#2563eb",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 800,
                  boxShadow: "0 0 20px rgba(37, 99, 235, 0.5)",
                }}
              >
                05
              </div>
              <div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "6px" }}>
                  <span
                    style={{
                      background: "rgba(59, 130, 246, 0.2)",
                      color: "#60a5fa",
                      border: "1px solid rgba(59, 130, 246, 0.4)",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: "12px",
                      letterSpacing: "0.08em",
                    }}
                  >
                    THEME: RESILIENCE
                  </span>
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Sparkles size={11} />
                    Gemini 3.7 Flash Multimodal
                  </span>
                  <span
                    style={{
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#fbbf24",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    Google Earth Engine (GEE)
                  </span>
                </div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px 0" }}>
                  Track-Based Cyclone Impact &amp; Infrastructure Vulnerability Forecaster
                </h1>
                <p style={{ color: "#94a3b8", fontSize: "13.5px", margin: 0, maxWidth: "880px", lineHeight: "1.5" }}>
                  Shifting disaster response from post-landfall recovery to pre-landfall anticipatory action.
                  Couples real-time meteorological tracks with Google Earth Engine (GEE) satellite feeds,
                  hydrodynamic surge &amp; rainfall drainage pathways, and Gemini 3.7 Flash multimodal reasoning
                  to protect power grids, arterial roads, and medical shelters while activating parametric insurance liquidity.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="op-btn-secondary"
                onClick={loadAssessment}
                disabled={isRefreshing}
                style={{ fontSize: "12px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                <span>Recalibrate Forecaster</span>
              </button>
              <button
                type="button"
                className="op-btn-primary"
                onClick={onNavigateToCommand}
                style={{ fontSize: "12px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Navigation size={13} />
                <span>Tactical Map Console</span>
              </button>
            </div>
          </div>
        </div>

        {/* Anticipatory Action Live KPI Strip */}
        <div className="saas-landing-live-strip" style={{ marginBottom: "24px" }}>
          <div className="saas-live-stat">
            <span className="saas-live-label">Anticipatory Action Window</span>
            <span className="saas-live-val" style={{ color: "#38bdf8" }}>T - 18h Pre-Landfall</span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Critical Infrastructure at Risk</span>
            <span className="saas-live-val" style={{ color: "#ef4444" }}>
              {data ? `${data.critical_infrastructure.filter(i => i.status === "CRITICAL_RISK").length} High-Risk Assets` : "Loading..."}
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Modeled Storm Surge Reach</span>
            <span className="saas-live-val" style={{ color: "#f59e0b" }}>
              {data ? `+${data.surge_and_runoff.peak_surge_height_m}m (${data.surge_and_runoff.inundation_reach_km} km)` : "Loading..."}
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Parametric Liquidity Wire</span>
            <span className="saas-live-val" style={{ color: "#10b981" }}>
              {data ? `₹${data.parametric_insurance.disbursed_liquidity_inr_cr} Cr Activated` : "Loading..."}
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Gemini 3.7 Flash Confidence</span>
            <span className="saas-live-val" style={{ color: "#a855f7" }}>
              {data ? `${(data.gemini_multimodal_advisory.confidence_score * 100).toFixed(1)}% High` : "Loading..."}
            </span>
          </div>
        </div>

        {/* Main Grid: Left Infrastructure Geospatial Engine & Right Gemini Reasoning Console */}
        <div className="op-split-grid" style={{ gridTemplateColumns: "1.15fr 0.85fr", gap: "24px" }}>
          
          {/* Left: Infrastructure Vulnerability & Geospatial Canvas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Visual Canvas Container */}
            <div
              style={{
                position: "relative",
                height: "460px",
                background: "#030508",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              {/* Tactical Canvas Topbar */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  padding: "10px 16px",
                  background: "rgba(5, 8, 14, 0.92)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  zIndex: 10,
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#94a3b8",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>INFRASTRUCTURE EXPOSURE &amp; DRAINAGE RUNOFF</span>
                </div>
                <div>BAY OF BENGAL / ARABIAN SEA MARITIME SECTOR</div>
              </div>

              {/* Layer Controls Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  left: "14px",
                  zIndex: 10,
                  background: "rgba(10, 15, 25, 0.92)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  display: "flex",
                  gap: "12px",
                  fontSize: "11px",
                  color: "#ffffff",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={layerPower}
                    onChange={(e) => setLayerPower(e.target.checked)}
                  />
                  <span>⚡ Power Grid (220kV)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={layerRoads}
                    onChange={(e) => setLayerRoads(e.target.checked)}
                  />
                  <span>🛣️ Arterial Roads</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={layerMedical}
                    onChange={(e) => setLayerMedical(e.target.checked)}
                  />
                  <span>🏥 Medical Shelters</span>
                </label>
              </div>

              {/* Interactive SVG Geospatial Map */}
              <svg width="100%" height="100%" viewBox="0 0 540 460" style={{ display: "block" }}>
                <defs>
                  <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="540" height="460" fill="#030508" />
                <rect width="540" height="460" fill="url(#gridPattern)" />

                {/* Ocean Area */}
                <rect x="0" y="0" width="200" height="460" fill="rgba(15, 23, 42, 0.6)" />
                <text x="35" y="240" fill="#334155" fontSize="13" fontFamily="'JetBrains Mono', monospace" letterSpacing="4">
                  COASTAL AP/BAY
                </text>

                {/* Storm Surge Inundation Reach Polygon */}
                <path
                  d="M 195,0 Q 225,120 235,220 T 245,360 Q 255,410 270,460 L 195,460 Z"
                  fill="rgba(56, 189, 248, 0.15)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text x="210" y="55" fill="#38bdf8" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                  SURGE CONTOUR (+{data?.surge_and_runoff.peak_surge_height_m || 2.8}m)
                </text>

                {/* Coastline Contour */}
                <path
                  d="M 195,0 Q 185,120 205,220 T 215,360 Q 225,410 250,460 L 540,460 L 540,0 Z"
                  fill="rgba(30, 41, 59, 0.35)"
                  stroke="rgba(148, 163, 184, 0.25)"
                  strokeWidth="1.5"
                />

                {/* Rainfall Overland Drainage Pathways */}
                <path
                  d="M 450,110 Q 340,140 260,150 T 205,170"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                />
                <text x="310" y="135" fill="#60a5fa" fontSize="8.5" fontFamily="'JetBrains Mono', monospace">
                  RUNOFF CHANNEL (142% OVERTOPPING)
                </text>

                {/* Arterial Road (NH-53) */}
                {layerRoads && (
                  <g>
                    <path
                      d="M 500,40 L 400,120 L 320,230 L 260,340 L 230,440"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                    />
                    {/* Culvert Flood breach marker */}
                    <circle cx="320" cy="230" r="7" fill="#ef4444" />
                    <text x="332" y="234" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                      CULVERT KM 18.4 (SEVERED)
                    </text>
                  </g>
                )}

                {/* Power Grid Transmission Line */}
                {layerPower && (
                  <path
                    d="M 280,90 L 360,180 L 430,300"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                )}

                {/* Infrastructure Nodes */}
                {data?.critical_infrastructure.map((item, idx) => {
                  const isPower = item.category === "POWER_GRID";
                  const isRoad = item.category === "ARTERIAL_ROAD";
                  const isMed = item.category === "MEDICAL_SHELTER";

                  if (isPower && !layerPower) return null;
                  if (isRoad && !layerRoads) return null;
                  if (isMed && !layerMedical) return null;

                  const isSelected = item.id === selectedInfraId;
                  const isCritical = item.status === "CRITICAL_RISK";
                  
                  // Projected canvas coordinates
                  const posX = 260 + (idx % 3) * 90;
                  const posY = 100 + idx * 65;

                  return (
                    <g
                      key={item.id}
                      onClick={() => setSelectedInfraId(item.id)}
                      style={{ cursor: "pointer" }}
                    >
                      {isSelected && (
                        <circle cx={posX} cy={posY} r="16" fill="none" stroke="#2563eb" strokeWidth="2" className="op-pulse-ring" />
                      )}
                      <circle
                        cx={posX}
                        cy={posY}
                        r={isSelected ? 9 : 7}
                        fill={isCritical ? "#ef4444" : isPower ? "#a855f7" : isRoad ? "#f59e0b" : "#10b981"}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={posX + 12}
                        y={posY + 4}
                        fill={isSelected ? "#ffffff" : "#94a3b8"}
                        fontSize="9.5"
                        fontWeight={isSelected ? 700 : 500}
                        fontFamily="'JetBrains Mono', monospace"
                      >
                        {item.name.split("·")[0].split("220kV")[0].trim()}
                      </text>
                    </g>
                  );
                })}

                {/* Storm Eye Coordinate & Cyclone Inflow Streamlines */}
                <circle cx="120" cy="180" r="14" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="2" />
                <circle cx="120" cy="180" r="4" fill="#ffffff" />
                <text x="140" y="185" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                  CYCLONE EYE (120 km/h)
                </text>
              </svg>
            </div>

            {/* Selected Infrastructure Inspection Dossier Card */}
            {selectedInfra && (
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {selectedInfra.category === "POWER_GRID" ? (
                      <Zap size={16} color="#a855f7" />
                    ) : selectedInfra.category === "ARTERIAL_ROAD" ? (
                      <Truck size={16} color="#f59e0b" />
                    ) : (
                      <Building2 size={16} color="#10b981" />
                    )}
                    <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff", margin: 0 }}>
                      {selectedInfra.name}
                    </h3>
                  </div>
                  <span
                    style={{
                      background:
                        selectedInfra.status === "CRITICAL_RISK"
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(245, 158, 11, 0.2)",
                      color:
                        selectedInfra.status === "CRITICAL_RISK" ? "#ef4444" : "#f59e0b",
                      border: `1px solid ${
                        selectedInfra.status === "CRITICAL_RISK"
                          ? "rgba(239, 68, 68, 0.4)"
                          : "rgba(245, 158, 11, 0.4)"
                      }`,
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {selectedInfra.status}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    marginBottom: "14px",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "4px" }}>
                    <div style={{ color: "#64748b", fontSize: "11px" }}>SURFACE ELEVATION</div>
                    <strong style={{ color: "#ffffff" }}>+{selectedInfra.elevation_m}m MSL</strong>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "4px" }}>
                    <div style={{ color: "#64748b", fontSize: "11px" }}>WIND TOLERANCE</div>
                    <strong style={{ color: "#ffffff" }}>{selectedInfra.design_wind_tolerance_kmh} km/h (Design)</strong>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "4px" }}>
                    <div style={{ color: "#64748b", fontSize: "11px" }}>FLOOD THRESHOLD</div>
                    <strong style={{ color: "#38bdf8" }}>+{selectedInfra.flood_threshold_m}m Tidal Limit</strong>
                  </div>
                </div>

                {/* Hardening Action Recommendation */}
                <div style={{ background: "rgba(37, 99, 235, 0.12)", border: "1px solid rgba(37, 99, 235, 0.3)", padding: "10px 14px", borderRadius: "6px", fontSize: "12.5px" }}>
                  <span style={{ color: "#60a5fa", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    🛠️ Pre-Landfall Hardening Directive:
                  </span>
                  <span style={{ color: "#e2e8f0" }}>
                    {selectedInfra.details.hardening_action || selectedInfra.details.vulnerability || "Maintain active monitoring"}
                  </span>
                </div>
              </div>
            )}

            {/* Google Earth Engine (GEE) Ingestion Drawer */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                padding: "14px 18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={13} />
                  GOOGLE EARTH ENGINE (GEE) SATELLITE PIPELINE
                </span>
                <span style={{ fontSize: "10.5px", color: "#34d399", background: "rgba(16, 185, 129, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                  4 Collections Active
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "11px" }}>
                {data?.gee_satellite_feeds.map((gee) => (
                  <div key={gee.id} style={{ background: "rgba(255,255,255,0.02)", padding: "6px 10px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <strong style={{ color: "#ffffff", display: "block" }}>{gee.name}</strong>
                    <span style={{ color: "#64748b" }}>{gee.gee_collection} ({gee.resolution})</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right: Gemini 3.7 Flash Multimodal Reasoning Console */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Gemini Reasoning Header Card */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(88, 28, 135, 0.3) 0%, rgba(15, 23, 42, 0.9) 100%)",
                border: "1px solid rgba(168, 85, 247, 0.35)",
                borderRadius: "8px",
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Cpu size={16} color="#c084fc" />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>
                    Gemini 3.7 Flash Multimodal Reasoning Engine
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#c084fc", background: "rgba(168, 85, 247, 0.15)", padding: "2px 8px", borderRadius: "10px" }}>
                  Lat: 64ms · XAI
                </span>
              </div>
              <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: 0, lineHeight: "1.5" }}>
                {data?.gemini_multimodal_advisory?.executive_summary || "Synthesizing multimodal satellite imagery, GEE topography, and storm track..."}
              </p>
            </div>

            {/* Official Early-Warning Advisory Dispatch Box */}
            <div
              style={{
                background: "rgba(10, 15, 26, 0.9)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "8px",
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={14} color="#ef4444" />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444" }}>
                    EARLY-WARNING ADVISORY DISPATCH (MUNICIPAL / NDMA)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyDispatch}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                  }}
                >
                  {copied ? <CheckCircle2 size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copied ? "Copied" : "Copy Alert"}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={data?.gemini_multimodal_advisory?.early_warning_advisory_dispatch || ""}
                rows={9}
                style={{
                  width: "100%",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "4px",
                  color: "#e2e8f0",
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: "10px",
                  lineHeight: "1.45",
                  resize: "none",
                }}
              />
            </div>

            {/* Pre-Landfall Infrastructure Hardening Directives */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", marginBottom: "12px" }}>
                PRE-LANDFALL INFRASTRUCTURE HARDENING PLAN
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data?.gemini_multimodal_advisory?.infrastructure_hardening_plan.map((plan, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "6px",
                      padding: "10px 12px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <strong style={{ color: "#60a5fa" }}>{plan.domain}</strong>
                      <span
                        style={{
                          color: plan.priority === "CRITICAL" ? "#ef4444" : "#f59e0b",
                          fontSize: "10.5px",
                          fontWeight: 700,
                        }}
                      >
                        {plan.deadline}
                      </span>
                    </div>
                    <p style={{ color: "#cbd5e1", margin: 0, lineHeight: "1.4", fontSize: "11.5px" }}>
                      {plan.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Parametric Insurance Smart Settlement Box */}
            <div
              style={{
                background: "linear-gradient(135deg, rgba(6, 78, 59, 0.25) 0%, rgba(15, 23, 42, 0.9) 100%)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldAlert size={14} />
                  PARAMETRIC INSURANCE PRE-LANDFALL LIQUIDITY
                </span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#34d399", background: "rgba(16, 185, 129, 0.2)", padding: "2px 8px", borderRadius: "10px" }}>
                  {data?.parametric_insurance.payout_status}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                <div>
                  <span style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff" }}>
                    ₹{data?.parametric_insurance.disbursed_liquidity_inr_cr} Cr
                  </span>
                  <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "6px" }}>
                    / ₹{data?.parametric_insurance.total_coverage_inr_cr} Cr Pool
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Settlement: {data?.parametric_insurance.time_to_settlement}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                {data?.parametric_insurance.allocated_funds_use.map((alloc, idx) => (
                  <div key={idx} style={{ background: "rgba(0,0,0,0.25)", padding: "6px 8px", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8", display: "block" }}>{alloc.item}</span>
                    <strong style={{ color: "#34d399" }}>₹{alloc.allocation_cr} Cr</strong>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default ResilienceForecasterPage;
