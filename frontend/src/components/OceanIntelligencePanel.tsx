import React from "react";
import type { MLInferenceResult, ScenarioResult } from "../api";

type OceanIntelligencePanelProps = {
  mlResult: MLInferenceResult | null;
  scenario: ScenarioResult | null;
};

export default function OceanIntelligencePanel({ mlResult, scenario }: OceanIntelligencePanelProps) {
  const tb = mlResult?.ocean_context.tb_deg_c ?? null;
  const vf = mlResult?.ocean_context.vf_m ?? null;

  const ohc = scenario?.ocean_node?.VF.ocean_heat_content_kj_cm2 ?? null;
  const source = scenario?.ocean_node?.meta.source ?? "HYCOM / Subsurface Profile";
  const basin = scenario?.basin?.replace("_", " ") ?? "NORTH INDIAN OCEAN";

  return (
    <div className="eng-card">
      <div className="corner-marker" />
      <div className="panel-header">
        <div className="panel-title">
          <i>OCEAN INTELLIGENCE</i> · SUBSURFACE CONTEXT
        </div>
        <span className="badge badge-info">{basin}</span>
      </div>

      <div className="panel-body">
        <div className="telemetry-grid">
          <div className="metric-cell">
            <span className="metric-label">THERMAL BUFFER (TB)</span>
            <span className="metric-value" style={{ color: tb && tb >= 26 ? "#76B900" : "#00BFFF" }}>
              {tb !== null ? `${tb}°C` : "N/A"}
            </span>
            <span className="metric-unit">
              {tb && tb >= 26 ? "CYCLONIC HEAT FAVORABLE" : "SUBSURFACE OCEAN"}
            </span>
          </div>

          <div className="metric-cell">
            <span className="metric-label">VENTILATION FACTOR (VF)</span>
            <span className="metric-value">
              {vf !== null ? `${vf}m` : "N/A"}
            </span>
            <span className="metric-unit">VENTILATION DEPTH</span>
          </div>

          <div className="metric-cell">
            <span className="metric-label">OCEAN HEAT CONTENT</span>
            <span className="metric-value">
              {ohc !== null ? `${ohc.toFixed(1)}` : "DYNAMIC"}
              <span className="metric-unit">kJ/cm²</span>
            </span>
            <span className="metric-unit">UPPER OCEAN ENERGETICS</span>
          </div>

          <div className="metric-cell">
            <span className="metric-label">PROFILE DEPTH RANGE</span>
            <span className="metric-value" style={{ fontSize: "0.9rem" }}>
              0 – 200m
            </span>
            <span className="metric-unit">{source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
