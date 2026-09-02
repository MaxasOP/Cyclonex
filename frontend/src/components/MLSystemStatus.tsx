import React from "react";
import type { DatasetSummary } from "../api";

type MLSystemStatusProps = {
  datasetSummary: DatasetSummary | null;
};

export default function MLSystemStatus({ datasetSummary }: MLSystemStatusProps) {
  const splits = datasetSummary?.splits;

  return (
    <div className="eng-card">
      <div className="corner-marker" />
      <div className="panel-header">
        <div className="panel-title">
          <i>AI/ML PIPELINE ARCHITECTURE</i>
        </div>
        <span className="badge badge-signal">
          {datasetSummary?.model_status.toUpperCase() || "READY"}
        </span>
      </div>

      <div className="panel-body">
        {/* Pipeline Components Sub-status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
          <div className="hud-box">
            <div className="hud-title">SATELLITE INGESTION</div>
            <div style={{ color: "#76B900", fontWeight: 700, fontSize: "0.74rem" }}>● ACTIVE</div>
          </div>
          <div className="hud-box">
            <div className="hud-title">TRACK FORECAST</div>
            <div style={{ color: "#76B900", fontWeight: 700, fontSize: "0.74rem" }}>● ACTIVE</div>
          </div>
          <div className="hud-box">
            <div className="hud-title">OCEAN COUPLING</div>
            <div style={{ color: "#76B900", fontWeight: 700, fontSize: "0.74rem" }}>● ACTIVE (TB/VF)</div>
          </div>
          <div className="hud-box">
            <div className="hud-title">RISK ENGINE</div>
            <div style={{ color: "#76B900", fontWeight: 700, fontSize: "0.74rem" }}>● ACTIVE (200m)</div>
          </div>
        </div>

        {/* Dataset Summary Metrics */}
        {datasetSummary ? (
          <div className="telemetry-grid">
            <div className="metric-cell">
              <span className="metric-label">TRAINING SAMPLES</span>
              <span className="metric-value">{datasetSummary.training_samples}</span>
              <span className="metric-unit">HURSAT / IBTRACS</span>
            </div>

            <div className="metric-cell">
              <span className="metric-label">BEST TRACK LABELS</span>
              <span className="metric-value">{datasetSummary.best_track_labels}</span>
              <span className="metric-unit">IMD / JTWC NIO</span>
            </div>

            <div className="metric-cell" style={{ gridColumn: "span 2" }}>
              <span className="metric-label">STORM SPLITS (NO LEAKAGE)</span>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  color: "#FFFFFF",
                  marginTop: 4,
                }}
              >
                <span>TRAIN: <strong>{splits?.train.storms} storms</strong> ({splits?.train.samples} s)</span>
                <span>VAL: <strong>{splits?.validation.storms} storms</strong></span>
                <span>TEST: <strong>{splits?.test.storms} storms</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "0.72rem", color: "#888888", fontFamily: "var(--font-mono)" }}>
            Loading dataset provenance summary...
          </div>
        )}
      </div>
    </div>
  );
}
