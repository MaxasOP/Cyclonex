import React, { useEffect, useState } from "react";
import type { DatasetSummary } from "../api";

type HeaderProps = {
  activeTab: "ml" | "screening";
  setActiveTab: (tab: "ml" | "screening") => void;
  datasetSummary: DatasetSummary | null;
  selectedSource: string;
  activeNavView: "LIVE" | "FORECAST" | "RISK" | "OCEAN" | "HISTORY";
  setActiveNavView: (view: "LIVE" | "FORECAST" | "RISK" | "OCEAN" | "HISTORY") => void;
  onOpenSatelliteModal: () => void;
};

export default function Header({
  activeTab,
  setActiveTab,
  datasetSummary,
  selectedSource,
  activeNavView,
  setActiveNavView,
  onOpenSatelliteModal,
}: HeaderProps) {
  const [utcTime, setUtcTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().substring(11, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="command-header">
      <div className="brand-section">
        <div className="brand-logo">
          <div className="brand-title">
            <span className="signal-dot" />
            CYCLONEX
          </div>
          <span className="brand-subtitle">SATELLITE CYCLONE INTELLIGENCE</span>
        </div>

        {/* Primary View Navigation */}
        <nav className="nav-tabs" aria-label="Command View Modes">
          {(["LIVE", "FORECAST", "RISK", "OCEAN", "HISTORY"] as const).map((view) => (
            <button
              key={view}
              className={`nav-tab-btn ${activeNavView === view ? "active" : ""}`}
              onClick={() => {
                setActiveNavView(view);
                if (view === "RISK" && activeTab !== "screening") {
                  setActiveTab("screening");
                } else if (view !== "RISK" && activeTab !== "ml") {
                  setActiveTab("ml");
                }
              }}
            >
              {view}
            </button>
          ))}
        </nav>
      </div>

      {/* Header Telemetry Bar */}
      <div className="header-telemetry">
        <div className="telemetry-item">
          <span className="telemetry-label">SYSTEM STATUS</span>
          <span className="telemetry-value live">
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#76B900" }} />
            {datasetSummary ? datasetSummary.model_status.toUpperCase() : "ONLINE"}
          </span>
        </div>

        <div className="telemetry-item">
          <span className="telemetry-label">ACTIVE SOURCE</span>
          <span className="telemetry-value" style={{ cursor: "pointer" }} onClick={onOpenSatelliteModal}>
            {selectedSource} 👁️
          </span>
        </div>

        <div className="telemetry-item">
          <span className="telemetry-label">PIPELINE MODEL</span>
          <span className="telemetry-value">
            {datasetSummary?.baseline_model?.algorithm || "GradBoostV3"}
          </span>
        </div>

        <div className="telemetry-item">
          <span className="telemetry-label">STATION TIME</span>
          <span className="telemetry-value" style={{ color: "#76B900" }}>
            {utcTime}
          </span>
        </div>
      </div>
    </header>
  );
}
