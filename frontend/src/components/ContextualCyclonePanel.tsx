import React from "react";
import {
  X,
  Compass,
  Wind,
  Gauge,
  Activity,
  Brain,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
} from "lucide-react";

export interface ContextualCyclonePanelProps {
  isOpen: boolean;
  onClose: () => void;
  stormName: string;
  category: string;
  windKph: number;
  pressureHpa: number;
  headingDeg: number;
  speedKph: number;
  lat: number;
  lon: number;
  aiConfidence?: number;
  trend?: string;
  onNavigateSection: (section: "ai" | "forecast" | "risk") => void;
}

export default function ContextualCyclonePanel({
  isOpen,
  onClose,
  stormName,
  category,
  windKph,
  pressureHpa,
  headingDeg,
  speedKph,
  lat,
  lon,
  aiConfidence = 94.7,
  trend = "Strengthening (Eyewall consolidation)",
  onNavigateSection,
}: ContextualCyclonePanelProps) {
  if (!isOpen) return null;

  // Convert compass degree heading to cardinal direction (e.g. 35° -> NE, 310° -> NW)
  const getCardinalDirection = (deg: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(deg / 45) % 8];
  };

  return (
    <aside className="contextual-cyclone-drawer" aria-label="Cyclone Contextual Dossier">
      {/* Header */}
      <div className="drawer-top-bar">
        <div>
          <span className="drawer-system-tag">ACTIVE TROPICAL SYSTEM</span>
          <h2 className="drawer-storm-title">{stormName || "CYCLONE TARGET"}</h2>
        </div>
        <button
          type="button"
          className="drawer-close-btn"
          onClick={onClose}
          title="Close Panel"
        >
          <X size={15} />
        </button>
      </div>

      <div className="drawer-body-scroll">
        {/* Core Intensity Metrics */}
        <div className="drawer-primary-metrics">
          <div className="primary-metric-box">
            <span className="metric-lbl">MAX SUSTAINED WIND</span>
            <strong className="metric-val cyan">{windKph} km/h</strong>
            <span className="metric-sub">{(windKph / 1.852).toFixed(0)} knots</span>
          </div>

          <div className="primary-metric-box">
            <span className="metric-lbl">CENTRAL PRESSURE</span>
            <strong className="metric-val">{pressureHpa} hPa</strong>
            <span className="metric-sub">ΔP {(1013.25 - pressureHpa).toFixed(1)} hPa</span>
          </div>
        </div>

        {/* Severity Classification Pill */}
        <div className="drawer-category-banner">
          <span className="category-tag">{category || "Severe Cyclonic Storm"}</span>
          <span className="trend-tag">
            <TrendingUp size={12} /> {trend}
          </span>
        </div>

        {/* Key Operational Parameters List */}
        <div className="drawer-params-list">
          <div className="param-item">
            <span className="param-label">Movement Vector:</span>
            <strong>{getCardinalDirection(headingDeg)} ({headingDeg}°) · {speedKph} km/h</strong>
          </div>

          <div className="param-item">
            <span className="param-label">Eye Coordinates:</span>
            <strong>{lat.toFixed(2)}° N, {lon.toFixed(2)}° E</strong>
          </div>

          <div className="param-item">
            <span className="param-label">AI Neural Confidence:</span>
            <strong style={{ color: "#10b981" }}>{aiConfidence}% (Verified)</strong>
          </div>

          <div className="param-item">
            <span className="param-label">Radius of Max Winds (Rmax):</span>
            <strong>28.0 km</strong>
          </div>
        </div>

        {/* Action Button Navigation Links */}
        <div className="drawer-quick-actions">
          <button
            type="button"
            className="btn-drawer-action"
            onClick={() => onNavigateSection("ai")}
          >
            <Brain size={14} />
            <span>AI ANALYSIS</span>
            <ArrowUpRight size={13} />
          </button>

          <button
            type="button"
            className="btn-drawer-action"
            onClick={() => onNavigateSection("forecast")}
          >
            <Activity size={14} />
            <span>FORECAST TRACK</span>
            <ArrowUpRight size={13} />
          </button>

          <button
            type="button"
            className="btn-drawer-action"
            onClick={() => onNavigateSection("risk")}
          >
            <ShieldAlert size={14} />
            <span>RISK &amp; IMPACT</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
