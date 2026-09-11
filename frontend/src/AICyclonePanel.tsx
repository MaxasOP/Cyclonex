import React from "react";
import type { AICycloneAnalysisResponse } from "./api";

interface AICyclonePanelProps {
  analysis: AICycloneAnalysisResponse | null;
  loading?: boolean;
  onAnalyze?: () => void;
}

export default function AICyclonePanel({ analysis, loading, onAnalyze }: AICyclonePanelProps) {
  if (loading) {
    return (
      <div className="card" style={{ padding: "16px", textAlign: "center", background: "#f8fafc", borderColor: "#cbd5e1" }}>
        <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>
          🌀 RUNNING MULTI-SOURCE SATELLITE AI ANALYSIS...
        </div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
          Preprocessing INSAT-3D, GPM IMERG & HURSAT Tensors
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="card" style={{ padding: "14px", background: "#ffffff", borderColor: "#cbd5e1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            AI CYCLONE ANALYSIS LAYER
          </span>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              className="btn btn-primary btn-sm"
              style={{ fontSize: "0.72rem", padding: "3px 10px" }}
            >
              Run AI Analysis
            </button>
          )}
        </div>
        <p style={{ fontSize: "0.75rem", margin: 0, color: "#64748b", lineHeight: "1.5" }}>
          Fuse satellite imagery (Visible, IR, WV, Microwave) to run AI detection, pattern classification, and temporal intensity forecasting.
        </p>
      </div>
    );
  }

  const { identification, classification, current_conditions, prediction, model_status, active_channels } = analysis;

  return (
    <div
      className="card"
      style={{
        padding: "14px",
        background: "#ffffff",
        borderColor: "#cbd5e1",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            AI CYCLONE ANALYSIS
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "0.68rem",
              fontWeight: 800,
              background: identification.cyclone_detected ? "#fee2e2" : "#dcfce7",
              color: identification.cyclone_detected ? "#b91c1c" : "#15803d",
              border: `1px solid ${identification.cyclone_detected ? "#fca5a5" : "#86efac"}`,
            }}
          >
            {identification.cyclone_detected ? "CYCLONE DETECTED" : "NO CYCLONE"}
          </span>
        </div>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.7rem", padding: "2px 8px" }}
          >
            Re-run AI
          </button>
        )}
      </div>

      {/* Active Satellite Channels */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>Satellite Channels:</span>
        {(active_channels || ["visible", "infrared"]).map((ch) => (
          <span
            key={ch}
            style={{
              fontSize: "0.65rem",
              padding: "1px 6px",
              borderRadius: "3px",
              background: "#f1f5f9",
              color: "#334155",
              border: "1px solid #cbd5e1",
              fontWeight: 600,
            }}
          >
            {ch.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Grid Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
        <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Pattern Class</div>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#b45309", textTransform: "uppercase", marginTop: "2px" }}>
            {classification.pattern.replace("_", " ")}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>
            Confidence: {(classification.confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Current Telemetry</div>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#b91c1c", marginTop: "2px" }}>
            {current_conditions.wind_speed_kmh} km/h
          </div>
          <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>
            {current_conditions.pressure_hpa} hPa
          </div>
        </div>
      </div>

      {/* Intensity Predictions (+6h, +12h, +24h) */}
      <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", marginBottom: "10px", border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#1e293b", marginBottom: "6px" }}>
          TEMPORAL INTENSITY FORECAST
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", textAlign: "center" }}>
          <div style={{ background: "#ffffff", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: "0.65rem", color: "#64748b" }}>+6h Ahead</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#b45309" }}>{prediction["6h"]?.wind_speed_kmh} km/h</div>
            <div style={{ fontSize: "0.68rem", color: "#475569" }}>{prediction["6h"]?.pressure_hpa} hPa</div>
          </div>
          <div style={{ background: "#ffffff", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: "0.65rem", color: "#64748b" }}>+12h Ahead</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#c2410c" }}>{prediction["12h"]?.wind_speed_kmh} km/h</div>
            <div style={{ fontSize: "0.68rem", color: "#475569" }}>{prediction["12h"]?.pressure_hpa} hPa</div>
          </div>
          <div style={{ background: "#ffffff", padding: "6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: "0.65rem", color: "#64748b" }}>+24h Ahead</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#b91c1c" }}>{prediction["24h"]?.wind_speed_kmh} km/h</div>
            <div style={{ fontSize: "0.68rem", color: "#475569" }}>{prediction["24h"]?.pressure_hpa} hPa</div>
          </div>
        </div>
      </div>

      {/* Model Status Badges */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#64748b", paddingTop: "4px", borderTop: "1px solid #f1f5f9" }}>
        <div>
          Detection: <strong style={{ color: model_status.detection === "READY" ? "#15803d" : "#b45309" }}>{model_status.detection}</strong>
        </div>
        <div>
          Pattern: <strong style={{ color: model_status.classification === "READY" ? "#15803d" : "#b45309" }}>{model_status.classification}</strong>
        </div>
        <div>
          Intensity: <strong style={{ color: model_status.intensity === "READY" ? "#15803d" : "#b45309" }}>{model_status.intensity}</strong>
        </div>
      </div>
    </div>
  );
}

