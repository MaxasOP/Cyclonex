import React from "react";
import type { BuildingFeature, ScenarioResult } from "../api";

type RiskIntelligencePanelProps = {
  scenario: ScenarioResult | null;
  buildings: BuildingFeature[];
  activeTab: "ml" | "screening";
};

export default function RiskIntelligencePanel({
  scenario,
  buildings,
  activeTab,
}: RiskIntelligencePanelProps) {
  if (!scenario) {
    return (
      <div className="eng-card" style={{ padding: 14 }}>
        <div className="panel-title" style={{ fontSize: "0.72rem", marginBottom: 6 }}>
          <i>200M HAZARD SCREENING</i> · INACTIVE
        </div>
        <p style={{ fontSize: "0.72rem", color: "#888888" }}>
          Run an ML forecast impact grid or switch to "200m Hazard Screening" to calculate high-resolution grid damage and building vulnerability.
        </p>
      </div>
    );
  }

  const features = scenario.risk_grid.features;
  const totalGridCells = features.length;

  // Count risk classifications
  const counts = features.reduce<Record<string, number>>((acc, f) => {
    const cls = f.properties.classification || "UNKNOWN";
    acc[cls] = (acc[cls] || 0) + 1;
    return acc;
  }, {});

  const legendItems = [
    { label: "Severe risk", color: "#d4483b", count: counts["Severe risk"] || 0 },
    { label: "Damage likely", color: "#ed8a28", count: counts["Damage likely"] || 0 },
    { label: "Safe", color: "#35a66f", count: counts["Safe"] || 0 },
    { label: "No damage", color: "#75c9f1", count: counts["No damage"] || 0 },
  ];

  return (
    <div className="eng-card accent-green">
      <div className="corner-marker" />
      <div className="panel-header">
        <div className="panel-title">
          <i>RISK INTELLIGENCE</i> · 200M GRID
        </div>
        <span className="badge badge-signal">ACTIVE RISK LAYER</span>
      </div>

      <div className="panel-body">
        <div className="telemetry-grid">
          <div className="metric-cell">
            <span className="metric-label">TOTAL GRID CELLS</span>
            <span className="metric-value">{totalGridCells}</span>
            <span className="metric-unit">200M RESOLUTION</span>
          </div>

          <div className="metric-cell">
            <span className="metric-label">BUILDING FOOTPRINTS</span>
            <span className="metric-value" style={{ color: buildings.length ? "#76B900" : "#CCCCCC" }}>
              {buildings.length}
            </span>
            <span className="metric-unit">INSPECTED STRUCTURES</span>
          </div>
        </div>

        {/* Hazard Classification Distribution Bars */}
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="metric-label">RISK CLASSIFICATION DISTRIBUTION</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {legendItems.map((item) => {
              const pct = totalGridCells > 0 ? ((item.count / totalGridCells) * 100).toFixed(1) : "0";
              return (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
                  <span style={{ width: 8, height: 8, backgroundColor: item.color, display: "inline-block" }} />
                  <span style={{ flex: 1, color: "#CCCCCC" }}>{item.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#FFFFFF", fontWeight: 700 }}>
                    {item.count} <span style={{ color: "#666666", fontWeight: 400 }}>({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: "0.68rem", color: "#888888", fontFamily: "var(--font-mono)", marginTop: 6 }}>
          Data Quality: {scenario.model.data_quality}
        </div>
      </div>
    </div>
  );
}
