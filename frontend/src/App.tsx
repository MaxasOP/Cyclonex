import { FormEvent, useEffect, useState } from "react";
import {
  createScenario,
  fetchBuildings,
  fetchDatasetSummary,
  runMLInference,
  type BuildingFeature,
  type DatasetSummary,
  type ForecastHorizon,
  type MLInferenceResult,
  type ScenarioResult,
} from "./api";
import RiskMap, { type TrajectoryPoint } from "./RiskMap";

import CycloneIntelligencePanel from "./components/CycloneIntelligencePanel";
import ForecastTimeline from "./components/ForecastTimeline";
import Header from "./components/Header";
import HistoricalPresets, { type PresetKey } from "./components/HistoricalPresets";
import MLSystemStatus from "./components/MLSystemStatus";
import OceanIntelligencePanel from "./components/OceanIntelligencePanel";
import RiskIntelligencePanel from "./components/RiskIntelligencePanel";
import SatelliteBar from "./components/SatelliteBar";
import SatelliteModal from "./components/SatelliteModal";

const presets = {
  landfall_amphan: {
    name: "Cyclone Amphan Landfall (Coastal West Bengal / Digha 21.6°N, 87.5°E)",
    lat: "21.62",
    lon: "87.51",
    wind: "165",
    pressure: "950",
    source: "HURSAT_B1",
  },
  amphan: {
    name: "Cyclone Amphan (Super Cyclone - Bay of Bengal 2020)",
    lat: "15.5",
    lon: "87.5",
    wind: "185",
    pressure: "925",
    source: "HURSAT_B1",
  },
  fani: {
    name: "Cyclone Fani (Extremely Severe - Bay of Bengal 2019)",
    lat: "14.2",
    lon: "85.2",
    wind: "175",
    pressure: "937",
    source: "INSAT",
  },
  bulbul: {
    name: "Cyclone Bulbul (Very Severe - Bay of Bengal 2019)",
    lat: "18.1",
    lon: "87.2",
    wind: "140",
    pressure: "970",
    source: "GPM_IMERG",
  },
  nisarga: {
    name: "Cyclone Nisarga (Severe - Arabian Sea 2020)",
    lat: "16.8",
    lon: "72.4",
    wind: "110",
    pressure: "984",
    source: "SENTINEL_1",
  },
  custom: {
    name: "Custom Map Coordinate",
    lat: "15.2",
    lon: "87.4",
    wind: "140",
    pressure: "960",
    source: "HURSAT_B1",
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"ml" | "screening">("ml");
  const [activeNavView, setActiveNavView] = useState<"LIVE" | "FORECAST" | "RISK" | "OCEAN" | "HISTORY">("LIVE");

  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("amphan");
  const [selectedSource, setSelectedSource] = useState<string>("HURSAT_B1");

  const [form, setForm] = useState(presets.amphan);
  const [mlResult, setMlResult] = useState<MLInferenceResult | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<6 | 12 | 24>(24);

  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Satellite Modal State
  const [isSatelliteModalOpen, setIsSatelliteModalOpen] = useState(false);

  // Initial loading
  useEffect(() => {
    void fetchDatasetSummary().then(setDatasetSummary);
    void handleMLInference("15.5", "87.5", "185", "925");
  }, []);

  async function handlePresetChange(presetKey: PresetKey) {
    setSelectedPreset(presetKey);
    const p = presets[presetKey];
    setForm(p);
    setSelectedSource(p.source);
    if (activeTab === "ml") {
      await handleMLInference(p.lat, p.lon, p.wind, p.pressure);
    }
  }

  async function handleMLInference(latStr: string, lonStr: string, windStr: string, pressureStr: string) {
    setLoading(true);
    setError("");
    try {
      const res = await runMLInference({
        centre_lat: Number(latStr),
        centre_lon: Number(lonStr),
        max_sustained_wind_kph: Number(windStr),
        central_pressure_hpa: Number(pressureStr),
      });
      setMlResult(res);
      void fetchDatasetSummary().then(setDatasetSummary);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ML inference failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMLFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleMLInference(form.lat, form.lon, form.wind, form.pressure);
  }

  async function handleRunMLImpactGrid() {
    if (!mlResult) return;
    setLoading(true);
    setError("");
    try {
      const horizonData: ForecastHorizon = mlResult[`forecast_${selectedHorizon}h`];
      const result = await createScenario({
        name: `ML Forecast +${selectedHorizon}h Impact Grid`,
        center_lat: horizonData.centre_lat,
        center_lon: horizonData.centre_lon,
        max_wind_kph: horizonData.max_sustained_wind_kph,
        central_pressure_hpa: horizonData.central_pressure_hpa,
        rain_rate_mm_hr: 70,
        storm_surge_m: 2.5,
        field_radius_km: 2,
      });
      setScenario(result);
      setBuildings([]);
      void fetchBuildings(result.id).then(setBuildings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ML storm impact run failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleScreeningSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await createScenario({
        name: form.name,
        center_lat: Number(form.lat),
        center_lon: Number(form.lon),
        max_wind_kph: Number(form.wind),
        central_pressure_hpa: Number(form.pressure),
        rain_rate_mm_hr: 70,
        storm_surge_m: 2.5,
        field_radius_km: 2,
      });
      setScenario(result);
      setBuildings([]);
      void fetchBuildings(result.id).then(setBuildings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The scenario could not be created.");
    } finally {
      setLoading(false);
    }
  }

  const mapCenter = scenario
    ? { lat: Number(form.lat), lng: Number(form.lon) }
    : mlResult
    ? { lat: mlResult.identification.centre_lat, lng: mlResult.identification.centre_lon }
    : { lat: Number(form.lat), lng: Number(form.lon) };

  const trajectoryPoints: TrajectoryPoint[] = mlResult
    ? [
        { lat: mlResult.identification.centre_lat, lng: mlResult.identification.centre_lon, label: "Present Eye" },
        {
          lat: mlResult.forecast_6h.centre_lat,
          lng: mlResult.forecast_6h.centre_lon,
          label: "+6h Forecast",
          uncertaintyKm: mlResult.forecast_6h.track_uncertainty_km,
        },
        {
          lat: mlResult.forecast_12h.centre_lat,
          lng: mlResult.forecast_12h.centre_lon,
          label: "+12h Forecast",
          uncertaintyKm: mlResult.forecast_12h.track_uncertainty_km,
        },
        {
          lat: mlResult.forecast_24h.centre_lat,
          lng: mlResult.forecast_24h.centre_lon,
          label: "+24h Forecast",
          uncertaintyKm: mlResult.forecast_24h.track_uncertainty_km,
        },
      ]
    : [];

  return (
    <div className="app-shell grid-bg">
      {/* Header Command Shell */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasetSummary={datasetSummary}
        selectedSource={selectedSource}
        activeNavView={activeNavView}
        setActiveNavView={setActiveNavView}
        onOpenSatelliteModal={() => setIsSatelliteModalOpen(true)}
      />

      {/* Main Workspace Layout */}
      <main className="workspace-grid">
        {/* Left Sidebar: Controls & Satellite Ingestion */}
        <aside className="sidebar-panel">
          {/* Workspace Mode Tabs */}
          <div className="eng-card">
            <div className="panel-header">
              <div className="panel-title">
                <i>PROCESSING MODE</i>
              </div>
            </div>
            <div style={{ padding: 6, display: "flex", gap: 4 }}>
              <button
                type="button"
                className={`nav-tab-btn ${activeTab === "ml" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setActiveTab("ml")}
              >
                🤖 AI/ML MODEL
              </button>
              <button
                type="button"
                className={`nav-tab-btn ${activeTab === "screening" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setActiveTab("screening")}
              >
                🌐 200M RISK GRID
              </button>
            </div>
          </div>

          {/* Multi-Source Satellite Selector */}
          <SatelliteBar
            selectedSource={selectedSource}
            setSelectedSource={setSelectedSource}
            onOpenSatelliteModal={() => setIsSatelliteModalOpen(true)}
          />

          {/* Historical Preset Selector */}
          <HistoricalPresets
            presets={presets}
            selectedPreset={selectedPreset}
            onSelectPreset={handlePresetChange}
          />

          {/* Inputs & Parameters Form */}
          <div className="eng-card">
            <div className="corner-marker" />
            <div className="panel-header">
              <div className="panel-title">
                <i>{activeTab === "ml" ? "STORM PARAMETERS" : "SCREENING SCENARIO"}</i>
              </div>
              <span className="badge badge-info">INPUT VECTOR</span>
            </div>

            <div className="panel-body">
              {activeTab === "ml" ? (
                <form onSubmit={handleMLFormSubmit}>
                  <div className="eng-row-pair">
                    <div className="eng-form-group">
                      <label className="eng-label">LATITUDE (°N)</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="eng-input"
                        value={form.lat}
                        onChange={(e) => setForm({ ...form, lat: e.target.value })}
                      />
                    </div>

                    <div className="eng-form-group">
                      <label className="eng-label">LONGITUDE (°E)</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="eng-input"
                        value={form.lon}
                        onChange={(e) => setForm({ ...form, lon: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="eng-row-pair">
                    <div className="eng-form-group">
                      <label className="eng-label">MAX WIND (KM/H)</label>
                      <input
                        type="number"
                        className="eng-input"
                        value={form.wind}
                        onChange={(e) => setForm({ ...form, wind: e.target.value })}
                      />
                    </div>

                    <div className="eng-form-group">
                      <label className="eng-label">PRESSURE (HPA)</label>
                      <input
                        type="number"
                        className="eng-input"
                        value={form.pressure}
                        onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 6 }}>
                    {loading ? "EXTRACTING FEATURES..." : "⚡ RUN AI/ML PATTERN INFERENCE"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleScreeningSubmit}>
                  <div className="eng-form-group">
                    <label className="eng-label">SCENARIO NAME</label>
                    <input
                      type="text"
                      className="eng-input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="eng-row-pair">
                    <div className="eng-form-group">
                      <label className="eng-label">LATITUDE (°N)</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="eng-input"
                        value={form.lat}
                        onChange={(e) => setForm({ ...form, lat: e.target.value })}
                      />
                    </div>

                    <div className="eng-form-group">
                      <label className="eng-label">LONGITUDE (°E)</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="eng-input"
                        value={form.lon}
                        onChange={(e) => setForm({ ...form, lon: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="eng-row-pair">
                    <div className="eng-form-group">
                      <label className="eng-label">WIND (KM/H)</label>
                      <input
                        type="number"
                        className="eng-input"
                        value={form.wind}
                        onChange={(e) => setForm({ ...form, wind: e.target.value })}
                      />
                    </div>

                    <div className="eng-form-group">
                      <label className="eng-label">PRESSURE (HPA)</label>
                      <input
                        type="number"
                        className="eng-input"
                        value={form.pressure}
                        onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 6 }}>
                    {loading ? "CALCULATING GRID..." : "🌐 GENERATE 200M RISK GRID"}
                  </button>
                </form>
              )}

              {error && (
                <div style={{ color: "#FF3333", fontSize: "0.74rem", fontFamily: "var(--font-mono)", marginTop: 8 }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Center: Map Centerpiece Console */}
        <section className="map-centerpiece">
          <div className="map-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="badge badge-signal">MAP VIEWPORT</span>
              <span style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "#FFFFFF", fontWeight: 700 }}>
                {presets[selectedPreset]?.name.split("(")[0] || "Custom Storm Track"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: "4px 8px", fontSize: "0.68rem" }}
                onClick={() => setIsSatelliteModalOpen(true)}
              >
                🛰️ SATELLITE HUD
              </button>
            </div>
          </div>

          <div className="map-viewport">
            {/* Map Telemetry HUD Overlay */}
            <div className="map-hud-overlay">
              <div className="hud-box">
                <div className="hud-title">ACTIVE COORDINATES</div>
                <div className="hud-value">
                  {mapCenter.lat.toFixed(4)}°N, {mapCenter.lng.toFixed(4)}°E
                </div>
              </div>

              <div className="hud-box">
                <div className="hud-title">SATELLITE SOURCE</div>
                <div style={{ color: "#FFFFFF", fontWeight: 700 }}>{selectedSource}</div>
              </div>
            </div>

            {/* Map Renderer */}
            <RiskMap
              center={mapCenter}
              features={scenario?.risk_grid.features ?? []}
              buildings={buildings}
              trajectory={trajectoryPoints}
              selectedSource={selectedSource}
            />
          </div>
        </section>

        {/* Right Sidebar: Operational Intelligence Panels */}
        <aside className="sidebar-panel right-sidebar">
          {/* Cyclone Intelligence Panel */}
          <CycloneIntelligencePanel
            mlResult={mlResult}
            loading={loading}
            onRunInference={() => handleMLInference(form.lat, form.lon, form.wind, form.pressure)}
          />

          {/* Forecast Horizon Matrix */}
          <ForecastTimeline
            mlResult={mlResult}
            selectedHorizon={selectedHorizon}
            setSelectedHorizon={setSelectedHorizon}
            onOverlayRiskGrid={handleRunMLImpactGrid}
            loading={loading}
          />

          {/* Ocean Intelligence Subsurface Context */}
          <OceanIntelligencePanel mlResult={mlResult} scenario={scenario} />

          {/* Risk Intelligence Panel */}
          <RiskIntelligencePanel scenario={scenario} buildings={buildings} activeTab={activeTab} />

          {/* ML System & Pipeline Status */}
          <MLSystemStatus datasetSummary={datasetSummary} />
        </aside>
      </main>

      {/* Cinematic SpaceX Satellite Inspector Modal */}
      <SatelliteModal
        isOpen={isSatelliteModalOpen}
        onClose={() => setIsSatelliteModalOpen(false)}
        selectedSource={selectedSource}
        stormName={presets[selectedPreset]?.name}
        centerLat={mapCenter.lat}
        centerLon={mapCenter.lng}
      />
    </div>
  );
}
