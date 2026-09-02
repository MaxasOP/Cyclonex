import React from "react";
import type { ForecastHorizon, MLInferenceResult } from "../api";

type ForecastTimelineProps = {
  mlResult: MLInferenceResult | null;
  selectedHorizon: 6 | 12 | 24;
  setSelectedHorizon: (h: 6 | 12 | 24) => void;
  onOverlayRiskGrid: () => void;
  loading: boolean;
};

export default function ForecastTimeline({
  mlResult,
  selectedHorizon,
  setSelectedHorizon,
  onOverlayRiskGrid,
  loading,
}: ForecastTimelineProps) {
  if (!mlResult) return null;

  const currentForecast: ForecastHorizon = mlResult[`forecast_${selectedHorizon}h`];

  return (
    <div className="eng-card">
      <div className="corner-marker" />
      <div className="panel-header">
        <div className="panel-title">
          <i>FORECAST TIMELINE</i> · 6H–24H
        </div>
        <span className="badge badge-signal">ML PREDICTIVE ENGINE</span>
      </div>

      <div className="panel-body">
        <div className="horizon-grid">
          {([6, 12, 24] as const).map((h) => (
            <button
              key={h}
              type="button"
              className={`horizon-btn ${selectedHorizon === h ? "active" : ""}`}
              onClick={() => setSelectedHorizon(h)}
            >
              +{h} HOURS
            </button>
          ))}
        </div>

        {currentForecast && (
          <div className="telemetry-grid" style={{ marginTop: 4 }}>
            <div className="metric-cell">
              <span className="metric-label">FORECAST POSITION (+{selectedHorizon}H)</span>
              <span className="metric-value">
                {currentForecast.centre_lat.toFixed(2)}°N
              </span>
              <span className="metric-unit" style={{ fontFamily: "var(--font-mono)" }}>
                {currentForecast.centre_lon.toFixed(2)}°E
              </span>
            </div>

            <div className="metric-cell">
              <span className="metric-label">MAX SUSTAINED WIND</span>
              <span className="metric-value" style={{ color: "#FF9900" }}>
                {currentForecast.max_sustained_wind_kph}
                <span className="metric-unit">KM/H</span>
              </span>
              <span className="metric-unit">
                UNCERTAINTY: ±{currentForecast.wind_uncertainty_kph} KM/H
              </span>
            </div>

            <div className="metric-cell">
              <span className="metric-label">CENTRAL PRESSURE</span>
              <span className="metric-value">
                {currentForecast.central_pressure_hpa}
                <span className="metric-unit">HPA</span>
              </span>
              <span className="metric-unit">ESTIMATED DROP</span>
            </div>

            <div className="metric-cell">
              <span className="metric-label">TRACK ERROR CORRIDOR</span>
              <span className="metric-value" style={{ color: "#76B900" }}>
                ±{currentForecast.track_uncertainty_km}
                <span className="metric-unit">KM</span>
              </span>
              <span className="metric-unit">UNCERTAINTY RADIUS</span>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%", marginTop: 6 }}
          onClick={onOverlayRiskGrid}
          disabled={loading}
        >
          {loading ? "CALCULATING RISK GRID..." : `⚡ OVERLAY +${selectedHorizon}H FORECAST 200M RISK GRID`}
        </button>
      </div>
    </div>
  );
}
