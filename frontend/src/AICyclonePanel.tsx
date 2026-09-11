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
      <div style={{ background: "rgba(6, 12, 22, 0.92)", borderRadius: "12px", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "16px", color: "#38bdf8", textAlign: "center" }}>
        🌀 Running Multi-Source Satellite AI Analysis...
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ background: "rgba(6, 12, 22, 0.92)", borderRadius: "12px", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "16px", color: "#94a3b8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#38bdf8" }}>🤖 AI CYCLONE ANALYSIS</span>
          {onAnalyze && (
            <button
              onClick={onAnalyze}
              style={{ background: "#0284c7", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
            >
              Run AI Analysis ⚡
            </button>
          )}
        </div>
        <p style={{ fontSize: "11px", margin: 0, color: "#64748b" }}>
          Click "Run AI Analysis" to fuse satellite imagery (Visible, IR, WV, Microwave) and run AI detection, pattern classification, and intensity prediction models.
        </p>
      </div>
    );
  }

  const { identification, classification, current_conditions, prediction, model_status, active_channels } = analysis;

  return (
    <div
      className="ai-cyclone-panel"
      style={{
        background: "rgba(6, 12, 22, 0.94)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        borderRadius: "12px",
        padding: "16px",
        color: "#ffffff",
        fontSize: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#38bdf8" }}>🤖 AI CYCLONE ANALYSIS</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "10px",
              fontSize: "9px",
              fontWeight: 800,
              background: identification.cyclone_detected ? "#ef4444" : "#22c55e",
              color: "#fff",
            }}
          >
            {identification.cyclone_detected ? "CYCLONE DETECTED" : "NO CYCLONE"}
          </span>
        </div>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            style={{ background: "#0284c7", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
          >
            Re-run AI ⚡
          </button>
        )}
      </div>

      {/* Active Satellite Channels */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
        <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700 }}>Satellite Channels:</span>
        {(active_channels || ["visible", "infrared"]).map((ch) => (
          <span key={ch} style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)" }}>
            {ch.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Grid Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
        <div style={{ background: "rgba(30, 41, 59, 0.7)", padding: "10px", borderRadius: "8px" }}>
          <div style={{ fontSize: "10px", color: "#94a3b8" }}>Pattern Classification</div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#f59e0b", textTransform: "uppercase" }}>
            {classification.pattern.replace("_", " ")}
          </div>
          <div style={{ fontSize: "10px", color: "#38bdf8", marginTop: "2px" }}>
            Confidence: {(classification.confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div style={{ background: "rgba(30, 41, 59, 0.7)", padding: "10px", borderRadius: "8px" }}>
          <div style={{ fontSize: "10px", color: "#94a3b8" }}>Current Telemetry</div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#ef4444" }}>
            {current_conditions.wind_speed_kmh} km/h
          </div>
          <div style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "2px" }}>
            {current_conditions.pressure_hpa} hPa
          </div>
        </div>
      </div>

      {/* Intensity Predictions (+6h, +12h, +24h) */}
      <div style={{ background: "rgba(15, 23, 42, 0.8)", padding: "10px", borderRadius: "8px", marginBottom: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#cbd5e1", marginBottom: "8px" }}>
          ⏱️ Temporal Intensity Forecast
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", textAlign: "center" }}>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "6px", borderRadius: "6px" }}>
            <div style={{ fontSize: "9px", color: "#94a3b8" }}>+6h Ahead</div>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#f59e0b" }}>{prediction["6h"]?.wind_speed_kmh} km/h</div>
            <div style={{ fontSize: "9px", color: "#cbd5e1" }}>{prediction["6h"]?.pressure_hpa} hPa</div>
          </div>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "6px", borderRadius: "6px" }}>
            <div style={{ fontSize: "9px", color: "#94a3b8" }}>+12h Ahead</div>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#ef4444" }}>{prediction["12h"]?.wind_speed_kmh} km/h</div>
            <div style={{ fontSize: "9px", color: "#cbd5e1" }}>{prediction["12h"]?.pressure_hpa} hPa</div>
          </div>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "6px", borderRadius: "6px" }}>
            <div style={{ fontSize: "9px", color: "#94a3b8" }}>+24h Ahead</div>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#dc2626" }}>{prediction["24h"]?.wind_speed_kmh} km/h</div>
            <div style={{ fontSize: "9px", color: "#cbd5e1" }}>{prediction["24h"]?.pressure_hpa} hPa</div>
          </div>
        </div>
      </div>

      {/* Model Status Badges */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#94a3b8", pt: 1 }}>
        <div>
          Detection Model: <strong style={{ color: model_status.detection === "READY" ? "#22c55e" : "#f59e0b" }}>{model_status.detection}</strong>
        </div>
        <div>
          Pattern Model: <strong style={{ color: model_status.classification === "READY" ? "#22c55e" : "#f59e0b" }}>{model_status.classification}</strong>
        </div>
        <div>
          Intensity Model: <strong style={{ color: model_status.intensity === "READY" ? "#22c55e" : "#f59e0b" }}>{model_status.intensity}</strong>
        </div>
      </div>
    </div>
  );
}
