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
  Volume2,
  VolumeX,
  Globe,
  Waves,
  Compass,
  FileText,
  Clock,
  Check,
  Info,
  Server,
  Database,
  ArrowRight,
} from "lucide-react";
import {
  fetchResilienceAssessment,
  type ResilienceAssessmentResult,
  type InfrastructureItem,
  type RecommendationEvidenceAction,
  type EvacuationRouteOption,
} from "../api";

interface ResilienceForecasterPageProps {
  onNavigateToCommand: () => void;
  onNavigateToAILab: () => void;
}

type IndianLang = "en" | "hi" | "or" | "bn" | "gu" | "mr";

interface StormPreset {
  id: string;
  name: string;
  basin: string;
  state: string;
  defaultLang: IndianLang;
  lat: number;
  lon: number;
  max_wind_kmh: number;
  central_pressure_hpa: number;
  heading_deg: number;
  forward_speed_kmh: number;
  tag: string;
}

const STORM_PRESETS: StormPreset[] = [
  {
    id: "dana",
    name: "Cyclone Dana",
    basin: "Bay of Bengal",
    state: "Odisha / WB",
    defaultLang: "or",
    lat: 20.4,
    lon: 86.8,
    max_wind_kmh: 125.0,
    central_pressure_hpa: 980.0,
    heading_deg: 320.0,
    forward_speed_kmh: 18.0,
    tag: "Bay of Bengal Major Threat",
  },
  {
    id: "nisarga",
    name: "Cyclone Nisarga",
    basin: "Arabian Sea",
    state: "Maharashtra",
    defaultLang: "mr",
    lat: 18.35,
    lon: 72.98,
    max_wind_kmh: 120.0,
    central_pressure_hpa: 984.0,
    heading_deg: 315.0,
    forward_speed_kmh: 22.0,
    tag: "Konkan Coast Direct Impact",
  },
  {
    id: "biparjoy",
    name: "Cyclone Biparjoy",
    basin: "Arabian Sea",
    state: "Gujarat",
    defaultLang: "gu",
    lat: 22.8,
    lon: 68.6,
    max_wind_kmh: 145.0,
    central_pressure_hpa: 970.0,
    heading_deg: 35.0,
    forward_speed_kmh: 14.0,
    tag: "Saurashtra & Kutch Threat",
  },
  {
    id: "remal",
    name: "Cyclone Remal",
    basin: "Bay of Bengal",
    state: "West Bengal",
    defaultLang: "bn",
    lat: 21.9,
    lon: 88.9,
    max_wind_kmh: 115.0,
    central_pressure_hpa: 986.0,
    heading_deg: 350.0,
    forward_speed_kmh: 16.0,
    tag: "Sundarbans Ecological Risk",
  },
];

const LANG_CONFIG: Record<IndianLang, { label: string; native: string; speechCode: string }> = {
  en: { label: "English", native: "English", speechCode: "en-IN" },
  hi: { label: "Hindi", native: "हिन्दी", speechCode: "hi-IN" },
  or: { label: "Odia", native: "ଓଡ଼ିଆ", speechCode: "hi-IN" }, // OSDMA fallback
  bn: { label: "Bengali", native: "বাংলা", speechCode: "bn-IN" },
  gu: { label: "Gujarati", native: "ગુજરાતી", speechCode: "gu-IN" },
  mr: { label: "Marathi", native: "मराठी", speechCode: "mr-IN" },
};

export const ResilienceForecasterPage: React.FC<ResilienceForecasterPageProps> = ({
  onNavigateToCommand,
  onNavigateToAILab,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ResilienceAssessmentResult | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("dana");
  const [selectedInfraId, setSelectedInfraId] = useState<string>("pwr-01");
  const [selectedLang, setSelectedLang] = useState<IndianLang>("or");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Failure Simulation Mode (Graceful Degradation Testing)
  const [failGemini, setFailGemini] = useState<boolean>(false);
  const [failGEE, setFailGEE] = useState<boolean>(false);
  const [failWeather, setFailWeather] = useState<boolean>(false);

  // Lifecycle Mode Toggle
  const [lifecyclePhase, setLifecyclePhase] = useState<"PRE_LANDFALL" | "POST_LANDFALL">("PRE_LANDFALL");

  // Layer Toggles
  const [layerPower, setLayerPower] = useState<boolean>(true);
  const [layerRoads, setLayerRoads] = useState<boolean>(true);
  const [layerMedical, setLayerMedical] = useState<boolean>(true);
  const [layerSurge, setLayerSurge] = useState<boolean>(true);
  const [layerGEE, setLayerGEE] = useState<boolean>(true);

  const [copied, setCopied] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showProvenanceDrawer, setShowProvenanceDrawer] = useState<boolean>(false);

  const activePreset = STORM_PRESETS.find((p) => p.id === selectedPresetId) || STORM_PRESETS[0];

  const loadAssessment = async (
    preset = activePreset,
    overrideFailGemini = failGemini,
    overrideFailGEE = failGEE,
    overrideFailWeather = failWeather
  ) => {
    setIsRefreshing(true);
    const res = await fetchResilienceAssessment({
      storm_name: preset.name,
      eye_lat: preset.lat,
      eye_lon: preset.lon,
      max_wind_kmh: preset.max_wind_kmh,
      central_pressure_hpa: preset.central_pressure_hpa,
      heading_deg: preset.heading_deg,
      forward_speed_kmh: preset.forward_speed_kmh,
      simulate_failure_gemini: overrideFailGemini,
      simulate_failure_gee: overrideFailGEE,
      simulate_failure_weather: overrideFailWeather,
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
  }, [failGemini, failGEE, failWeather]);

  const handleSelectPreset = (preset: StormPreset) => {
    setSelectedPresetId(preset.id);
    setSelectedLang(preset.defaultLang);
    if (isSpeaking && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    loadAssessment(preset);
  };

  const selectedInfra =
    data?.critical_infrastructure.find((item) => item.id === selectedInfraId) ||
    data?.critical_infrastructure[0];

  // Resolve active warning text for current selected language
  const activeAdvisoryText =
    (data?.gemini_multimodal_advisory?.multilingual_advisories &&
      data.gemini_multimodal_advisory.multilingual_advisories[selectedLang]) ||
    data?.gemini_multimodal_advisory?.early_warning_advisory_dispatch ||
    "";

  const handleCopyDispatch = () => {
    if (activeAdvisoryText) {
      navigator.clipboard.writeText(activeAdvisoryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleVoiceBroadcast = () => {
    if (!("speechSynthesis" in window)) {
      alert("Web Speech API voice synthesis is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!activeAdvisoryText) return;

    window.speechSynthesis.cancel();
    const textSnippet = activeAdvisoryText.slice(0, 350);
    const utterance = new SpeechSynthesisUtterance(textSnippet);
    utterance.lang = LANG_CONFIG[selectedLang]?.speechCode || "en-IN";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">
        
        {/* System Health Status Center Banner */}
        <div
          style={{
            background: "rgba(10, 15, 26, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "8px",
            padding: "8px 16px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "11px",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px" }}>
              <Server size={12} color="#38bdf8" />
              SYSTEM HEALTH:
            </span>
            <span style={{ color: data?.system_status?.meteorology === "LIVE" ? "#34d399" : "#fbbf24" }}>
              ● MET: {data?.system_status?.meteorology || "LIVE"}
            </span>
            <span style={{ color: data?.system_status?.gee_sentinel1 === "CONNECTED" ? "#34d399" : "#60a5fa" }}>
              ● GEE SATELLITE: {data?.system_status?.gee_sentinel1 || "CACHED"}
            </span>
            <span style={{ color: "#34d399" }}>
              ● ML ENGINE: {data?.system_status?.ml_engine || "ACTIVE"}
            </span>
            <span style={{ color: data?.system_status?.gemini_ai === "ACTIVE" ? "#c084fc" : "#f59e0b" }}>
              ● GEMINI: {data?.system_status?.gemini_ai || "ACTIVE"}
            </span>
            <span style={{ color: data?.system_status?.rule_engine === "ACTIVE" ? "#f59e0b" : "#64748b" }}>
              ● RULE ENGINE: {data?.system_status?.rule_engine || "STANDBY"}
            </span>
            <span style={{ color: "#34d399" }}>
              ● TTS VOICE: {data?.system_status?.tts_speech || "READY"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setShowProvenanceDrawer(!showProvenanceDrawer)}
              style={{
                background: showProvenanceDrawer ? "rgba(37, 99, 235, 0.3)" : "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#e2e8f0",
                padding: "3px 8px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "10.5px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Info size={11} />
              <span>Data Provenance</span>
            </button>
          </div>
        </div>

        {/* Developer Failure Simulation Drawer (Demonstrates Graceful Degradation) */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            borderRadius: "6px",
            padding: "8px 16px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "11px",
          }}
        >
          <span style={{ color: "#fbbf24", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
            🛠️ TEST GRACEFUL DEGRADATION:
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", color: failGemini ? "#f87171" : "#94a3b8", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={failGemini}
                onChange={(e) => setFailGemini(e.target.checked)}
              />
              <span>Simulate Gemini Offline (Test RuleEngine Fallback)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", color: failGEE ? "#f87171" : "#94a3b8", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={failGEE}
                onChange={(e) => setFailGEE(e.target.checked)}
              />
              <span>Simulate GEE Offline (Test Cache)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", color: failWeather ? "#f87171" : "#94a3b8", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={failWeather}
                onChange={(e) => setFailWeather(e.target.checked)}
              />
              <span>Simulate Met API Offline</span>
            </label>
          </div>
        </div>

        {/* Data Provenance Table (Collapsible) */}
        {showProvenanceDrawer && (
          <div
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "8px",
              padding: "14px 18px",
              marginBottom: "18px",
              fontSize: "11.5px",
            }}
          >
            <div style={{ color: "#60a5fa", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Database size={13} />
              DATA PROVENANCE &amp; TRACEABILITY AUDIT
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", color: "#cbd5e1" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "left", color: "#94a3b8", fontSize: "10.5px" }}>
                    <th style={{ padding: "6px 8px" }}>OUTPUT DOMAIN</th>
                    <th style={{ padding: "6px 8px" }}>DATA SOURCES</th>
                    <th style={{ padding: "6px 8px" }}>DATASET / COLLECTION</th>
                    <th style={{ padding: "6px 8px" }}>MODEL VERSION</th>
                    <th style={{ padding: "6px 8px" }}>LATENCY</th>
                    <th style={{ padding: "6px 8px" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.provenance?.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 700, color: "#ffffff" }}>{p.output_domain}</td>
                      <td style={{ padding: "6px 8px", color: "#94a3b8" }}>{p.data_sources.join(", ")}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono', monospace", color: "#60a5fa" }}>{p.dataset_collection}</td>
                      <td style={{ padding: "6px 8px" }}>{p.model_version}</td>
                      <td style={{ padding: "6px 8px" }}>{p.processing_latency_ms}ms</td>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{
                          background: p.status === "LIVE" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: p.status === "LIVE" ? "#34d399" : "#fbbf24",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Challenge 05 Banner Card */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30, 58, 138, 0.28) 0%, rgba(15, 23, 42, 0.85) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            borderRadius: "12px",
            padding: "24px 28px",
            marginBottom: "20px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "#2563eb",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 800,
                  boxShadow: "0 0 24px rgba(37, 99, 235, 0.6)",
                  flexShrink: 0,
                }}
              >
                05
              </div>
              <div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "rgba(59, 130, 246, 0.2)",
                      color: "#60a5fa",
                      border: "1px solid rgba(59, 130, 246, 0.45)",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "3px 10px",
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
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Sparkles size={11} />
                    Gemini 3.7 Flash Decision Intelligence
                  </span>
                  <span
                    style={{
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#fbbf24",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "12px",
                    }}
                  >
                    Google Earth Engine (GEE)
                  </span>
                  <span
                    style={{
                      background: "rgba(168, 85, 247, 0.15)",
                      color: "#c084fc",
                      border: "1px solid rgba(168, 85, 247, 0.3)",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "12px",
                    }}
                  >
                    Built for India (Pan-Coastal)
                  </span>
                </div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#ffffff", margin: "0 0 6px 0" }}>
                  Track-Based Cyclone Impact &amp; Infrastructure Vulnerability Forecaster
                </h1>
                <p style={{ color: "#94a3b8", fontSize: "13.5px", margin: 0, maxWidth: "860px", lineHeight: "1.5" }}>
                  AI-powered predictive risk and vulnerability modeling platform utilizing Google Earth Engine (GEE) satellite feeds,
                  real-time meteorological data, and Gemini 3.7 Flash multimodal reasoning. Simulates storm surges, rainfall damage pathways,
                  critical infrastructure exposure (power grids, roads, shelters), and automated early-warning advisory dispatches.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="op-btn-secondary"
                onClick={() => loadAssessment()}
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
                <span>Tactical Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pan-India Multi-Basin Storm Selector (Scale Across States & Communities) */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "10px",
            padding: "12px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass size={16} color="#60a5fa" />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.03em" }}>
              SELECT BASIN &amp; REGIONAL IMPACT ZONE:
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {STORM_PRESETS.map((p) => {
              const isSelected = p.id === selectedPresetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  style={{
                    background: isSelected ? "rgba(37, 99, 235, 0.3)" : "rgba(255, 255, 255, 0.04)",
                    border: `1px solid ${isSelected ? "#3b82f6" : "rgba(255, 255, 255, 0.1)"}`,
                    color: isSelected ? "#ffffff" : "#94a3b8",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: isSelected ? "#3b82f6" : "#64748b",
                    }}
                  />
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: "11px", opacity: 0.8 }}>({p.state})</span>
                </button>
              );
            })}
          </div>

          {/* Lifecycle Mode Toggle */}
          <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "3px", borderRadius: "6px" }}>
            <button
              type="button"
              onClick={() => setLifecyclePhase("PRE_LANDFALL")}
              style={{
                background: lifecyclePhase === "PRE_LANDFALL" ? "#2563eb" : "transparent",
                color: lifecyclePhase === "PRE_LANDFALL" ? "#ffffff" : "#94a3b8",
                border: "none",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Pre-Landfall Action
            </button>
            <button
              type="button"
              onClick={() => setLifecyclePhase("POST_LANDFALL")}
              style={{
                background: lifecyclePhase === "POST_LANDFALL" ? "#7c3aed" : "transparent",
                color: lifecyclePhase === "POST_LANDFALL" ? "#ffffff" : "#94a3b8",
                border: "none",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Post-Landfall Assessment
            </button>
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
              {data ? `${data.critical_infrastructure.filter((i: any) => i.overall_vulnerability === "CRITICAL" || i.status === "CRITICAL_RISK").length} High-Risk Assets` : "Loading..."}
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Modeled Storm Surge Reach</span>
            <span className="saas-live-val" style={{ color: "#f59e0b" }}>
              {data ? `+${data.surge_and_runoff.peak_surge_height_m}m (${data.surge_and_runoff.inundation_reach_km} km)` : "Loading..."}
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Parametric Liquidity Simulation</span>
            <span className="saas-live-val" style={{ color: "#10b981" }}>
              {data ? `₹${data.parametric_insurance.disbursed_liquidity_inr_cr} Cr Triggered` : "Loading..."}
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">AI Decision Confidence</span>
            <span className="saas-live-val" style={{ color: "#a855f7" }}>
              {data ? `${(data.gemini_multimodal_advisory.confidence_score * 100).toFixed(1)}%` : "Loading..."}
            </span>
          </div>
        </div>

        {/* Complete Causal Rainfall Damage Pathway Card */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.7) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#60a5fa", display: "flex", alignItems: "center", gap: "6px" }}>
              <Droplets size={14} />
              COMPLETE CAUSAL RAINFALL DAMAGE PATHWAY (RAINFALL → RUNOFF → INUNDATION → ROAD IMPACT)
            </span>
            <span style={{ fontSize: "11px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "2px 8px", borderRadius: "10px" }}>
              Physics-Informed Causal Model
            </span>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px", fontSize: "11px" }}>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "10px" }}>1. RAIN RATE</span>
              <strong style={{ color: "#ffffff", fontSize: "13px" }}>75 mm/hr</strong>
              <span style={{ color: "#64748b", display: "block", fontSize: "10px", marginTop: "2px" }}>Convective Core</span>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "10px" }}>2. 24H ACCUMULATION</span>
              <strong style={{ color: "#38bdf8", fontSize: "13px" }}>{data?.surge_and_runoff.projected_24h_rainfall_mm || 280} mm</strong>
              <span style={{ color: "#64748b", display: "block", fontSize: "10px", marginTop: "2px" }}>Basin Watershed</span>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "10px" }}>3. SOIL SATURATION</span>
              <strong style={{ color: "#fbbf24", fontSize: "13px" }}>SATURATED</strong>
              <span style={{ color: "#64748b", display: "block", fontSize: "10px", marginTop: "2px" }}>100% Infiltration</span>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "10px" }}>4. RUNOFF COEFF</span>
              <strong style={{ color: "#f59e0b", fontSize: "13px" }}>0.88 Overland</strong>
              <span style={{ color: "#64748b", display: "block", fontSize: "10px", marginTop: "2px" }}>Hydro Runoff</span>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "10px" }}>5. DRAINAGE CAPACITY</span>
              <strong style={{ color: "#ef4444", fontSize: "13px" }}>142% OVERTOPPING</strong>
              <span style={{ color: "#64748b", display: "block", fontSize: "10px", marginTop: "2px" }}>Estuary Alpha</span>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "10px" }}>6. ESTIMATED FLOOD</span>
              <strong style={{ color: "#f87171", fontSize: "13px" }}>+{data?.surge_and_runoff.max_flood_depth_m || 1.45}m Depth</strong>
              <span style={{ color: "#64748b", display: "block", fontSize: "10px", marginTop: "2px" }}>Road Culvert Breach</span>
            </div>
          </div>
        </div>

        {/* Main Split Grid: Left Geospatial & Asset Inspection | Right Gemini Reasoning Console */}
        <div className="op-split-grid" style={{ gridTemplateColumns: "1.15fr 0.85fr", gap: "24px" }}>
          
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Visual Geospatial Canvas */}
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
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>
                    INFRASTRUCTURE EXPOSURE &amp; DRAINAGE RUNOFF · {activePreset.name.toUpperCase()}
                  </span>
                </div>
                <div>{activePreset.basin.toUpperCase()} ({activePreset.state})</div>
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
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={layerSurge}
                    onChange={(e) => setLayerSurge(e.target.checked)}
                  />
                  <span>🌊 Surge &amp; Inundation</span>
                </label>
              </div>

              {/* Interactive SVG Geospatial Map */}
              <svg width="100%" height="100%" viewBox="0 0 540 460" style={{ display: "block" }}>
                <defs>
                  <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
                  </pattern>
                  <linearGradient id="surgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(56, 189, 248, 0.35)" />
                    <stop offset="100%" stopColor="rgba(56, 189, 248, 0.05)" />
                  </linearGradient>
                </defs>
                <rect width="540" height="460" fill="#030508" />
                <rect width="540" height="460" fill="url(#gridPattern)" />

                {/* Ocean Area */}
                <rect x="0" y="0" width="200" height="460" fill="rgba(15, 23, 42, 0.65)" />
                <text x="30" y="240" fill="#334155" fontSize="13" fontFamily="'JetBrains Mono', monospace" letterSpacing="4">
                  {activePreset.basin.toUpperCase()}
                </text>

                {/* Storm Surge Inundation Reach Polygon */}
                {layerSurge && (
                  <g>
                    <path
                      d="M 195,0 Q 225,120 235,220 T 245,360 Q 255,410 270,460 L 195,460 Z"
                      fill="url(#surgeGrad)"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    <text x="210" y="55" fill="#38bdf8" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                      SURGE CONTOUR (+{data?.surge_and_runoff.peak_surge_height_m || 2.8}m MSL)
                    </text>
                  </g>
                )}

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
                  DRAINAGE OVERTOPPING (+1.45m FLOOD)
                </text>

                {/* Arterial Road (Evacuation Corridor) */}
                {layerRoads && (
                  <g>
                    <path
                      d="M 230,460 L 250,330 L 270,220 L 310,130 L 380,0"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      strokeOpacity="0.8"
                    />
                    <text x="290" y="270" fill="#f59e0b" fontSize="8.5" fontFamily="'JetBrains Mono', monospace">
                      {activePreset.id === "dana" ? "NH-53 EVAC CORRIDOR" : "COASTAL ARTERIAL (SH-47)"}
                    </text>
                  </g>
                )}

                {/* High Voltage Power Grid (220kV Lines) */}
                {layerPower && (
                  <g>
                    <path
                      d="M 280,460 L 290,320 L 320,200 L 360,90"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                      strokeOpacity="0.75"
                    />
                    <text x="340" y="190" fill="#a855f7" fontSize="8.5" fontFamily="'JetBrains Mono', monospace">
                      220kV TRANSMISSION LINE
                    </text>
                  </g>
                )}

                {/* Critical Infrastructure Nodes */}
                {data?.critical_infrastructure.map((item: any, idx: number) => {
                  const isPower = item.category === "POWER_GRID";
                  const isRoad = item.category === "ARTERIAL_ROAD";
                  const isMed = item.category === "MEDICAL_SHELTER";

                  if (isPower && !layerPower) return null;
                  if (isRoad && !layerRoads) return null;
                  if (isMed && !layerMedical) return null;

                  const isSelected = item.asset_id === selectedInfraId || item.id === selectedInfraId;
                  const isCritical = item.overall_vulnerability === "CRITICAL" || item.status === "CRITICAL_RISK";

                  const posX = 260 + (idx % 3) * 90;
                  const posY = 100 + idx * 65;

                  return (
                    <g
                      key={item.asset_id || item.id}
                      onClick={() => setSelectedInfraId(item.asset_id || item.id)}
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

                {/* Storm Eye Coordinate */}
                <circle cx="120" cy="180" r="14" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="2" />
                <circle cx="120" cy="180" r="4" fill="#ffffff" />
                <text x="140" y="185" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                  CYCLONE EYE ({activePreset.max_wind_kmh} km/h)
                </text>
              </svg>
            </div>

            {/* Selected Infrastructure Inspection Dossier Card (Cross-Layer Intelligence) */}
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
                        (selectedInfra.overall_vulnerability === "CRITICAL" || selectedInfra.status === "CRITICAL_RISK")
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(245, 158, 11, 0.2)",
                      color:
                        (selectedInfra.overall_vulnerability === "CRITICAL" || selectedInfra.status === "CRITICAL_RISK") ? "#ef4444" : "#f59e0b",
                      border: "1px solid currentColor",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {selectedInfra.overall_vulnerability || selectedInfra.status}
                  </span>
                </div>

                {/* Sub-Exposure Matrix */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "10px",
                    marginBottom: "14px",
                    fontSize: "11.5px",
                  }}
                >
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "4px" }}>
                    <div style={{ color: "#64748b", fontSize: "10.5px" }}>SURFACE ELEVATION</div>
                    <strong style={{ color: "#ffffff" }}>+{selectedInfra.elevation_m}m MSL</strong>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "4px" }}>
                    <div style={{ color: "#64748b", fontSize: "10.5px" }}>WIND EXPOSURE</div>
                    <strong style={{ color: "#f87171" }}>{selectedInfra.wind_exposure_pct || 92}%</strong>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "4px" }}>
                    <div style={{ color: "#64748b", fontSize: "10.5px" }}>FLOOD EXPOSURE</div>
                    <strong style={{ color: "#38bdf8" }}>{selectedInfra.flood_exposure_pct || 78}%</strong>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "4px" }}>
                    <div style={{ color: "#64748b", fontSize: "10.5px" }}>SALT ARC RISK</div>
                    <strong style={{ color: "#c084fc" }}>{selectedInfra.salt_spray_exposure_pct || 85}%</strong>
                  </div>
                </div>

                {/* Road Passability & Alternate Route Callout (if Road) */}
                {selectedInfra.category === "ARTERIAL_ROAD" && selectedInfra.alternate_route && (
                  <div style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "10px 14px", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>
                    <span style={{ color: "#fbbf24", fontWeight: 700, display: "block", marginBottom: "3px" }}>
                      ⚠️ Passability Status: {selectedInfra.passability_status || "IMPASSABLE_FLOODED"} (+1.45m Water Over Culvert)
                    </span>
                    <span style={{ color: "#cbd5e1" }}>
                      Alternate Elevated Route: <strong style={{ color: "#ffffff" }}>{selectedInfra.alternate_route.name}</strong> (+{selectedInfra.alternate_route.additional_km} km distance penalty)
                    </span>
                  </div>
                )}

                {/* Shelter Readiness Index (if Medical Shelter) */}
                {selectedInfra.category === "MEDICAL_SHELTER" && selectedInfra.shelter_readiness && (
                  <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "10px 14px", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>
                    <span style={{ color: "#34d399", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                      🏥 Shelter Readiness Index: {selectedInfra.shelter_readiness.overall_readiness_index * 100}%
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", fontSize: "11px", color: "#cbd5e1" }}>
                      <div>Safety: <strong>{(selectedInfra.shelter_readiness.physical_safety_score * 100).toFixed(0)}%</strong></div>
                      <div>Readiness: <strong>{(selectedInfra.shelter_readiness.operational_readiness_score * 100).toFixed(0)}%</strong></div>
                      <div>Access: <strong>{(selectedInfra.shelter_readiness.accessibility_score * 100).toFixed(0)}%</strong></div>
                      <div>Capacity: <strong>{(selectedInfra.shelter_readiness.capacity_score * 100).toFixed(0)}%</strong></div>
                    </div>
                  </div>
                )}

                {/* Hardening Action Directive */}
                <div style={{ background: "rgba(37, 99, 235, 0.12)", border: "1px solid rgba(37, 99, 235, 0.3)", padding: "10px 14px", borderRadius: "6px", fontSize: "12.5px" }}>
                  <span style={{ color: "#60a5fa", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    🛠️ Pre-Landfall Hardening Directive:
                  </span>
                  <span style={{ color: "#e2e8f0" }}>
                    {selectedInfra.hardening_directive || selectedInfra.details?.hardening_action || "Maintain active emergency monitoring"}
                  </span>
                </div>
              </div>
            )}

            {/* Evacuation Routing Options (Fastest vs Safest Trade-Offs) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Navigation size={13} />
                EVACUATION CORRIDOR SELECTION (TRADE-OFF ANALYSIS)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data?.evacuation?.recommended_routes.map((rt: EvacuationRouteOption) => (
                  <div
                    key={rt.route_id}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      fontSize: "11.5px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                      <strong style={{ color: "#ffffff" }}>{rt.name}</strong>
                      <span
                        style={{
                          background: rt.route_type === "Safest" ? "rgba(16, 185, 129, 0.2)" : rt.route_type === "Fastest" ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                          color: rt.route_type === "Safest" ? "#34d399" : rt.route_type === "Fastest" ? "#fbbf24" : "#60a5fa",
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {rt.route_type} ({rt.travel_time_minutes} mins · {rt.distance_km} km)
                      </span>
                    </div>
                    <p style={{ color: "#94a3b8", margin: 0, fontSize: "11px", lineHeight: "1.4" }}>
                      {rt.trade_off_explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

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
                  <div key={gee.id} style={{ background: "rgba(255,255,255,0.02)", padding: "8px 10px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
                      <strong style={{ color: "#ffffff" }}>{gee.name}</strong>
                      <span style={{ fontSize: "9.5px", color: gee.status === "LIVE" ? "#34d399" : "#fbbf24" }}>{gee.status}</span>
                    </div>
                    <span style={{ color: "#64748b", display: "block" }}>{gee.gee_collection} ({gee.resolution})</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Gemini Decision Intelligence & Action Console */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Gemini Decision Intelligence Header Card */}
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
                    {data?.gemini_multimodal_advisory?.source || "Gemini 3.7 Flash Decision Intelligence"}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#c084fc", background: "rgba(168, 85, 247, 0.15)", padding: "2px 8px", borderRadius: "10px" }}>
                  Explainable AI (XAI)
                </span>
              </div>
              <p style={{ fontSize: "12.5px", color: "#cbd5e1", margin: 0, lineHeight: "1.5" }}>
                {data?.gemini_multimodal_advisory?.executive_summary || "Synthesizing multimodal satellite feeds, GEE topography, and storm surge dynamics..."}
              </p>
            </div>

            {/* Evidence -> Reasoning -> Action Cards */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                borderRadius: "8px",
                padding: "14px 18px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#c084fc", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px", letterSpacing: "0.05em" }}>
                <Activity size={12} />
                GEMINI DECISION REASONING: EVIDENCE → REASONING → ACTION
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data?.gemini_multimodal_advisory?.evidence_reasoning_actions?.map((era: RecommendationEvidenceAction, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "6px",
                      padding: "10px 12px",
                      fontSize: "11.5px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ color: "#60a5fa" }}>{era.domain}</strong>
                      <span
                        style={{
                          background: era.priority === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: era.priority === "CRITICAL" ? "#ef4444" : "#f59e0b",
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {era.deadline}
                      </span>
                    </div>
                    
                    {/* Evidence */}
                    <div style={{ marginBottom: "4px" }}>
                      <span style={{ color: "#94a3b8", fontSize: "10.5px", fontWeight: 700 }}>EVIDENCE: </span>
                      <span style={{ color: "#cbd5e1", fontSize: "11px" }}>{era.evidence.join(" · ")}</span>
                    </div>

                    {/* Reasoning */}
                    <div style={{ marginBottom: "6px" }}>
                      <span style={{ color: "#94a3b8", fontSize: "10.5px", fontWeight: 700 }}>REASONING: </span>
                      <span style={{ color: "#cbd5e1", fontSize: "11px" }}>{era.reasoning}</span>
                    </div>

                    {/* Action */}
                    <div style={{ background: "rgba(37, 99, 235, 0.15)", padding: "6px 8px", borderRadius: "4px", border: "1px solid rgba(37, 99, 235, 0.3)" }}>
                      <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: "10.5px" }}>ACTION: </span>
                      <span style={{ color: "#ffffff", fontSize: "11px" }}>{era.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Early-Warning Advisory Dispatch Box with Multilingual Support & Voice Broadcast */}
            <div
              style={{
                background: "rgba(10, 15, 26, 0.92)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "8px",
                padding: "16px 18px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={14} color="#ef4444" />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444" }}>
                    EARLY-WARNING ADVISORY DISPATCH (MUNICIPAL / NDMA)
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {/* Voice Broadcast Button (Web Speech API) */}
                  <button
                    type="button"
                    onClick={handleVoiceBroadcast}
                    style={{
                      background: isSpeaking ? "rgba(239, 68, 68, 0.25)" : "rgba(37, 99, 235, 0.2)",
                      border: `1px solid ${isSpeaking ? "#ef4444" : "#3b82f6"}`,
                      color: isSpeaking ? "#ef4444" : "#60a5fa",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isSpeaking ? <VolumeX size={12} className="animate-pulse" /> : <Volume2 size={12} />}
                    <span>{isSpeaking ? "⏹️ Stop Voice" : "🔊 Broadcast Voice Warning"}</span>
                  </button>

                  {/* Copy Alert Button */}
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
              </div>

              {/* Language Selector Pill Bar (6 Coastal Indian Languages) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: "10px",
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "6px",
                  overflowX: "auto",
                }}
              >
                <span style={{ fontSize: "10.5px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "3px", marginRight: "4px" }}>
                  <Globe size={11} />
                  LANGUAGE:
                </span>
                {(["en", "hi", "or", "bn", "gu", "mr"] as IndianLang[]).map((lang) => {
                  const isLangActive = selectedLang === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLang(lang)}
                      style={{
                        background: isLangActive ? "#2563eb" : "transparent",
                        color: isLangActive ? "#ffffff" : "#94a3b8",
                        border: "none",
                        borderRadius: "4px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: isLangActive ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {LANG_CONFIG[lang].label} ({LANG_CONFIG[lang].native})
                    </button>
                  );
                })}
              </div>

              {/* Multilingual Advisory Text Display */}
              <textarea
                readOnly
                value={activeAdvisoryText}
                rows={8}
                style={{
                  width: "100%",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "4px",
                  color: "#e2e8f0",
                  fontSize: "11px",
                  fontFamily: selectedLang === "en" ? "'JetBrains Mono', monospace" : "inherit",
                  padding: "10px",
                  lineHeight: "1.55",
                  resize: "none",
                }}
              />
            </div>

            {/* Dynamic Anticipatory Action Timeline (T-24h to T+24h) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={13} />
                DYNAMIC ANTICIPATORY ACTION TIMELINE (T - 24H TO T + 24H)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data?.dynamic_timeline?.map((tm, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "10px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      fontSize: "11px",
                    }}
                  >
                    <span style={{ color: "#38bdf8", fontWeight: 700, minWidth: "90px" }}>{tm.phase}</span>
                    <div>
                      <strong style={{ color: "#ffffff", display: "block" }}>{tm.title}</strong>
                      <span style={{ color: "#94a3b8" }}>{tm.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parametric Insurance Smart Trigger (Fintech Resilience Simulation) */}
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
                  PARAMETRIC LIQUIDITY SIMULATION
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
                    / ₹{data?.parametric_insurance.total_coverage_inr_cr} Cr Facility Pool
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Execution: &lt; 12 Minutes
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", marginBottom: "8px" }}>
                {data?.parametric_insurance.allocated_funds_use.map((alloc, idx) => (
                  <div key={idx} style={{ background: "rgba(0,0,0,0.25)", padding: "6px 8px", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8", display: "block" }}>{alloc.item}</span>
                    <strong style={{ color: "#34d399" }}>₹{alloc.allocation_cr} Cr</strong>
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: "10px", color: "#64748b", fontStyle: "italic" }}>
                {data?.parametric_insurance.disclaimer || "Parametric Liquidity Simulation: Demonstrates pre-agreed smart covenant trigger and resource allocation."}
              </p>
            </div>

            {/* Post-Landfall Rapid Assessment (when Lifecycle Phase is toggled) */}
            {lifecyclePhase === "POST_LANDFALL" && (
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(88, 28, 135, 0.25) 0%, rgba(15, 23, 42, 0.9) 100%)",
                  border: "1px solid rgba(168, 85, 247, 0.4)",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#c084fc", marginBottom: "8px" }}>
                  POST-LANDFALL RAPID ASSESSMENT (SAR FLOOD MASK &amp; VIIRS BLACKOUT ANOMALIES)
                </div>
                <p style={{ color: "#cbd5e1", fontSize: "11.5px", margin: "0 0 10px 0" }}>
                  {data?.post_landfall?.sar_flood_observation_notes}
                </p>
                <div style={{ fontSize: "11px", color: "#ffffff", marginBottom: "10px" }}>
                  Potential Power Outage Zone: <strong style={{ color: "#ef4444" }}>{data?.post_landfall?.power_outage_risk_area_km2 || 1570} km²</strong>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {data?.post_landfall?.restoration_priority_manifest.map((item, idx) => (
                    <div key={idx} style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: "4px", fontSize: "11px" }}>
                      <strong style={{ color: "#38bdf8" }}>Priority {item.priority}: {item.target}</strong>
                      <span style={{ color: "#94a3b8", display: "block" }}>{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

export default ResilienceForecasterPage;
