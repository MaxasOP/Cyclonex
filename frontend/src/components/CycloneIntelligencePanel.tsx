import React from "react";
import type { MLInferenceResult } from "../api";

type CycloneIntelligencePanelProps = {
  mlResult: MLInferenceResult | null;
  loading: boolean;
  onRunInference: () => void;
};

export default function CycloneIntelligencePanel({
  mlResult,
  loading,
  onRunInference,
}: CycloneIntelligencePanelProps) {
  if (loading) {
    return (
      <div className="eng-card accent-green" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="radar-spinner" />
          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.1em" }}>
              EXTRACTING SATELLITE FEATURES...
            </div>
            <div style={{ fontSize: "0.68rem", color: "#AAAAAA", fontFamily: "var(--font-mono)", marginTop: 2 }}>
              Multi-spectral scene co-registration & pattern tensor inference
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mlResult) {
    return (
      <div className="eng-card" style={{ padding: 14 }}>
        <div className="panel-title" style={{ fontSize: "0.72rem", marginBottom: 8 }}>
          <i>SYSTEM READY</i> · NO ACTIVE INFERENCE
        </div>
        <p style={{ fontSize: "0.72rem", color: "#888888" }}>
          Select a storm preset or enter geographical coordinates to launch satellite feature extraction.
        </p>
      </div>
    );
  }

  const { identification, pattern_classification, model_provenance } = mlResult;

  const presenceBadgeClass =
    identification.presence === "TROPICAL_CYCLONE"
      ? "badge-extreme"
      : identification.presence === "TROPICAL_DISTURBANCE"
      ? "badge-elevated"
      : "badge-info";

  return (
    <div className="eng-card accent-green">
      <div className="corner-marker" />
      <div className="panel-header">
        <div className="panel-title">
          <i>TROPICAL CYCLONE</i> INTELLIGENCE
        </div>
        <span className={`badge ${presenceBadgeClass}`}>
          {identification.presence.replace("_", " ")}
        </span>
      </div>

      <div className="panel-body">
        {/* Core Metrics Grid */}
        <div className="telemetry-grid">
          <div className="metric-cell">
            <span className="metric-label">CENTER POSITION</span>
            <span className="metric-value">
              {identification.centre_lat.toFixed(2)}°N
            </span>
            <span className="metric-unit" style={{ fontFamily: "var(--font-mono)" }}>
              {identification.centre_lon.toFixed(2)}°E
            </span>
          </div>

          <div className="metric-cell">
            <span className="metric-label">MODEL CONFIDENCE</span>
            <span className="metric-value" style={{ color: "#76B900" }}>
              {(identification.confidence * 100).toFixed(0)}
              <span className="metric-unit">%</span>
            </span>
            <span className="metric-unit">IDENTIFICATION</span>
          </div>

          <div className="metric-cell">
            <span className="metric-label">LIFECYCLE STAGE</span>
            <span className="metric-value" style={{ fontSize: "0.88rem", color: "#FF9900" }}>
              {pattern_classification.lifecycle_pattern || "MONITORING"}
            </span>
            <span className="metric-unit">
              {pattern_classification.confidence
                ? `${(pattern_classification.confidence * 100).toFixed(0)}% EST.`
                : "PATTERN CONFIRMED"}
            </span>
          </div>

          <div className="metric-cell">
            <span className="metric-label">ALGORITHM PROVENANCE</span>
            <span className="metric-value" style={{ fontSize: "0.8rem", color: "#CCCCCC" }}>
              {model_provenance.model_version}
            </span>
            <span className="metric-unit">{model_provenance.algorithm}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary"
          style={{ width: "100%", marginTop: 4 }}
          onClick={onRunInference}
        >
          ⚡ RE-RUN ML PATTERN INFERENCE
        </button>
      </div>
    </div>
  );
}
