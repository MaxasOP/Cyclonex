import { FormEvent, useEffect, useState } from "react";
import {
  createScenario,
  fetchBuildings,
  runMLInference,
  runMLStormImpact,
  type BuildingFeature,
  type ForecastHorizon,
  type MLInferenceResult,
  type ScenarioResult,
} from "./api";
import RiskMap from "./RiskMap";

const presets = {
  amphan: {
    name: "Cyclone Amphan (Bay of Bengal 2020)",
    lat: "15.5",
    lon: "87.5",
    wind: "185",
    pressure: "925",
  },
  fani: {
    name: "Cyclone Fani (Bay of Bengal 2019)",
    lat: "14.2",
    lon: "85.2",
    wind: "175",
    pressure: "937",
  },
  custom: {
    name: "Custom Coordinates",
    lat: "15.2",
    lon: "87.4",
    wind: "140",
    pressure: "960",
  },
};

const legend = [
  ["#75c9f1", "No damage"],
  ["#35a66f", "Safe"],
  ["#ed8a28", "Damage likely"],
  ["#d4483b", "Severe risk"],
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"ml" | "screening">("ml");
  const [selectedPreset, setSelectedPreset] = useState<"amphan" | "fani" | "custom">("amphan");

  const [form, setForm] = useState(presets.amphan);
  const [mlResult, setMlResult] = useState<MLInferenceResult | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<6 | 12 | 24>(24);

  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Run initial ML inference on mount for Cyclone Amphan preset
  useEffect(() => {
    void handleMLInference("15.5", "87.5", "185", "925");
  }, []);

  async function handlePresetChange(presetKey: "amphan" | "fani" | "custom") {
    setSelectedPreset(presetKey);
    const p = presets[presetKey];
    setForm(p);
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
      // Use storm ID or fallback to current coordinates
      const horizonData: ForecastHorizon = mlResult[`forecast_${selectedHorizon}h`];
      const result = await createScenario({
        name: `ML Forecast ${selectedHorizon}h Impact Run`,
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

  const currentForecast: ForecastHorizon | null = mlResult
    ? mlResult[`forecast_${selectedHorizon}h`]
    : null;

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">SATELLITE CYCLONE INTELLIGENCE</p>
          <h1>CYCLONEX</h1>
        </div>
        <p className="constraint">Multi-Source Satellite Data · 200 m Risk Grid</p>
      </header>

      <nav className="mode-tabs" aria-label="Workspace Modes">
        <button
          className={`tab-btn ${activeTab === "ml" ? "active" : ""}`}
          onClick={() => setActiveTab("ml")}
        >
          🤖 AI/ML Cyclone Intelligence
        </button>
        <button
          className={`tab-btn ${activeTab === "screening" ? "active" : ""}`}
          onClick={() => setActiveTab("screening")}
        >
          🌐 200m Hazard Screening
        </button>
      </nav>

      <section className="workspace">
        <aside className="controls">
          {activeTab === "ml" ? (
            <>
              <h2>AI/ML Identification & Forecast</h2>
              <p>Multi-source satellite feature extraction, pattern classification, & 6–24 h predictive models.</p>

              <label style={{ marginBottom: "14px" }}>
                <span>Select Presets / Historical Storms</span>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value as "amphan" | "fani" | "custom")}
                >
                  <option value="amphan">Cyclone Amphan (Bay of Bengal 2020)</option>
                  <option value="fani">Cyclone Fani (Bay of Bengal 2019)</option>
                  <option value="custom">Custom Coordinates</option>
                </select>
              </label>

              <form onSubmit={handleMLFormSubmit}>
                <div className="pair">
                  <label>
                    <span>Latitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.lat}
                      onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Longitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.lon}
                      onChange={(e) => setForm({ ...form, lon: e.target.value })}
                    />
                  </label>
                </div>

                <div className="pair">
                  <label>
                    <span>Max Wind (km/h)</span>
                    <input
                      type="number"
                      value={form.wind}
                      onChange={(e) => setForm({ ...form, wind: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Central Pressure (hPa)</span>
                    <input
                      type="number"
                      value={form.pressure}
                      onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                    />
                  </label>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? "Analyzing..." : "Run AI/ML Identification & Prediction"}
                </button>
              </form>

              {mlResult && (
                <div style={{ marginTop: "20px" }}>
                  <div className="ml-card">
                    <div className="ml-card-title">1. Identification & Pattern</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                      <span className="badge badge-cyclone">
                        {mlResult.identification.presence.replaceAll("_", " ")}
                      </span>
                      <span className="badge badge-info">
                        {(mlResult.identification.confidence * 100).toFixed(0)}% Confidence
                      </span>
                      {mlResult.pattern_classification.lifecycle_pattern && (
                        <span className="badge badge-pattern">
                          STAGE: {mlResult.pattern_classification.lifecycle_pattern}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#b3c4d7" }}>
                      Ocean Context: Thermal Buffer <strong>{mlResult.ocean_context.tb_deg_c}°C</strong> · Ventilation Depth <strong>{mlResult.ocean_context.vf_m}m</strong>
                    </div>
                  </div>

                  <div className="ml-card">
                    <div className="ml-card-title">2. Select Forecast Horizon</div>
                    <div className="horizon-grid">
                      {([6, 12, 24] as const).map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`horizon-btn ${selectedHorizon === h ? "selected" : ""}`}
                          onClick={() => setSelectedHorizon(h)}
                        >
                          +{h} Hours
                        </button>
                      ))}
                    </div>

                    {currentForecast && (
                      <div style={{ fontSize: "0.84rem", lineHeight: "1.5", color: "#d7e5f5" }}>
                        <div>Centre: <strong>{currentForecast.centre_lat}°N, {currentForecast.centre_lon}°E</strong></div>
                        <div>Max Sustained Wind: <strong>{currentForecast.max_sustained_wind_kph} km/h</strong></div>
                        <div>Central Pressure: <strong>{currentForecast.central_pressure_hpa} hPa</strong></div>
                        <div style={{ fontSize: "0.76rem", color: "#8fa4bf", marginTop: "4px" }}>
                          Uncertainty: ±{currentForecast.track_uncertainty_km} km track error
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: "100%" }}
                    onClick={handleRunMLImpactGrid}
                    disabled={loading}
                  >
                    ⚡ Overlay {selectedHorizon}h Forecast 200m Impact Grid
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Create a scenario</h2>
              <p>Transparent hazard-screening estimates and building vulnerability inspection.</p>
              <form onSubmit={handleScreeningSubmit}>
                <label>
                  <span>Scenario Name</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <div className="pair">
                  <label>
                    <span>Latitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.lat}
                      onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Longitude</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.lon}
                      onChange={(e) => setForm({ ...form, lon: e.target.value })}
                    />
                  </label>
                </div>

                <div className="pair">
                  <label>
                    <span>Maximum Wind (km/h)</span>
                    <input
                      type="number"
                      value={form.wind}
                      onChange={(e) => setForm({ ...form, wind: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Central Pressure (hPa)</span>
                    <input
                      type="number"
                      value={form.pressure}
                      onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                    />
                  </label>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? "Calculating..." : "Calculate risk grid"}
                </button>
              </form>
            </>
          )}

          {error && <p className="error" role="alert">{error}</p>}

          <div className="legend" aria-label="Risk legend">
            {legend.map(([colour, label]) => (
              <span key={label}>
                <i style={{ background: colour }} />
                {label}
              </span>
            ))}
          </div>
        </aside>

        <section className="map-shell" aria-label="Cyclone risk map">
          <RiskMap
            center={mapCenter}
            features={scenario?.risk_grid.features ?? []}
            buildings={buildings}
          />
          {!scenario && (
            <div className="map-hint">
              {activeTab === "ml"
                ? "Select a forecast horizon (+6h, +12h, +24h) and click 'Overlay 200m Impact Grid'."
                : "Enter coordinates to overlay the risk grid."}
            </div>
          )}
        </section>
      </section>

      {scenario && (
        <section className="summary">
          <div>
            <span>Grid Cells</span>
            <strong>{scenario.risk_grid.features.length}</strong>
          </div>
          <div>
            <span>Ocean Basin</span>
            <strong>{scenario.basin?.replaceAll("_", " ") || "Not in North Indian Ocean"}</strong>
          </div>
          <div>
            <span>Ocean Input</span>
            <strong>{scenario.ocean_node?.meta.source || "Not requested"}</strong>
          </div>
          <div>
            <span>Model Provenance</span>
            <strong>{scenario.ml_provenance?.model_algorithm || "Baseline Screening"}</strong>
          </div>
          <p>{scenario.model.data_quality}</p>
        </section>
      )}
    </main>
  );
}
