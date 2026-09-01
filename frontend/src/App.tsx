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
import RiskMap from "./RiskMap";

const presets = {
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

const legend = [
  ["#75c9f1", "No damage"],
  ["#35a66f", "Safe"],
  ["#ed8a28", "Damage likely"],
  ["#d4483b", "Severe risk"],
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"ml" | "screening">("ml");
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof presets>("amphan");
  const [selectedSource, setSelectedSource] = useState<string>("HURSAT_B1");

  const [form, setForm] = useState(presets.amphan);
  const [mlResult, setMlResult] = useState<MLInferenceResult | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<6 | 12 | 24>(24);

  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch backend dataset summary & run initial ML inference on mount
  useEffect(() => {
    void fetchDatasetSummary().then(setDatasetSummary);
    void handleMLInference("15.5", "87.5", "185", "925");
  }, []);

  async function handlePresetChange(presetKey: keyof typeof presets) {
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
      // Refresh summary
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

  const currentForecast: ForecastHorizon | null = mlResult
    ? mlResult[`forecast_${selectedHorizon}h`]
    : null;

  const trajectoryPoints = mlResult
    ? [
        { lat: mlResult.identification.centre_lat, lng: mlResult.identification.centre_lon, label: "Present Eye" },
        { lat: mlResult.forecast_6h.centre_lat, lng: mlResult.forecast_6h.centre_lon, label: "+6h Forecast" },
        { lat: mlResult.forecast_12h.centre_lat, lng: mlResult.forecast_12h.centre_lon, label: "+12h Forecast" },
        { lat: mlResult.forecast_24h.centre_lat, lng: mlResult.forecast_24h.centre_lon, label: "+24h Forecast" },
      ]
    : [];

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">SATELLITE CYCLONE INTELLIGENCE SYSTEM</p>
          <h1>CYCLONEX</h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginBottom: "6px" }}>
            <span className="badge badge-info">
              {datasetSummary ? `Status: ${datasetSummary.model_status}` : "Backend Connected"}
            </span>
            <span className="badge badge-info">
              {datasetSummary?.baseline_model?.algorithm || "GradientBoostedEnsemble"}
            </span>
          </div>
          <p className="constraint">Multi-Source Satellite Data · IBTrACS NIO Labels · 200 m Grid</p>
        </div>
      </header>

      <nav className="mode-tabs" aria-label="Workspace Modes">
        <button
          className={`tab-btn ${activeTab === "ml" ? "active" : ""}`}
          onClick={() => setActiveTab("ml")}
        >
          🤖 AI/ML Identification & Prediction
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
              <h2>AI/ML Satellite Intelligence</h2>
              <p>Multi-source satellite feature extraction, pattern classification, & 6–24 h predictive models.</p>

              <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                <label>
                  <span>1. Select Multi-Source Satellite Data</span>
                  <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
                    <option value="HURSAT_B1">NOAA HURSAT-B1 Historical IR Imagery</option>
                    <option value="INSAT">INSAT Geostationary IR / Visible</option>
                    <option value="GPM_IMERG">GPM IMERG Rain Rate Structure</option>
                    <option value="SENTINEL_1">Sentinel-1 SAR Surface Backscatter</option>
                  </select>
                </label>

                <label>
                  <span>2. Select IBTrACS Historical Storm Preset</span>
                  <select
                    value={selectedPreset}
                    onChange={(e) => handlePresetChange(e.target.value as keyof typeof presets)}
                  >
                    <option value="amphan">Cyclone Amphan (Super Cyclone - Bay of Bengal 2020)</option>
                    <option value="fani">Cyclone Fani (Extremely Severe - Bay of Bengal 2019)</option>
                    <option value="bulbul">Cyclone Bulbul (Very Severe - Bay of Bengal 2019)</option>
                    <option value="nisarga">Cyclone Nisarga (Severe - Arabian Sea 2020)</option>
                    <option value="custom">Custom Map Coordinate</option>
                  </select>
                </label>
              </div>

              <form onSubmit={handleMLFormSubmit}>
                <div className="pair">
                  <label>
                    <span>Latitude (°N)</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.lat}
                      onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Longitude (°E)</span>
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
                  {loading ? "Extracting Features..." : "Run AI/ML Identification & Prediction"}
                </button>
              </form>

              {mlResult && (
                <div style={{ marginTop: "18px" }}>
                  {/* Task 1 & 2 */}
                  <div className="ml-card">
                    <div className="ml-card-title">Task 1 & 2: Identification & Pattern</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                      <span className="badge badge-cyclone">
                        {mlResult.identification.presence.replaceAll("_", " ")}
                      </span>
                      <span className="badge badge-info">
                        {(mlResult.identification.confidence * 100).toFixed(0)}% Confidence
                      </span>
                      {mlResult.pattern_classification.lifecycle_pattern && (
                        <span className="badge badge-pattern">
                          PATTERN: {mlResult.pattern_classification.lifecycle_pattern}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#b3c4d7" }}>
                      Subsurface Ocean Node: Thermal Buffer <strong>{mlResult.ocean_context.tb_deg_c}°C</strong> · Ventilation Depth <strong>{mlResult.ocean_context.vf_m}m</strong>
                    </div>
                  </div>

                  {/* Task 3 */}
                  <div className="ml-card">
                    <div className="ml-card-title">Task 3: 6–24 h Predictive Forecast</div>
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
                        <div>Predicted Position: <strong>{currentForecast.centre_lat}°N, {currentForecast.centre_lon}°E</strong></div>
                        <div>Projected Max Wind: <strong>{currentForecast.max_sustained_wind_kph} km/h</strong></div>
                        <div>Central Pressure: <strong>{currentForecast.central_pressure_hpa} hPa</strong></div>
                        <div style={{ fontSize: "0.76rem", color: "#8fa4bf", marginTop: "4px" }}>
                          Track Error Uncertainty: ±{currentForecast.track_uncertainty_km} km
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Task 4 Downstream Impact */}
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: "100%" }}
                    onClick={handleRunMLImpactGrid}
                    disabled={loading}
                  >
                    ⚡ Overlay +{selectedHorizon}h Forecast 200m Building Risk Grid
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Create a screening scenario</h2>
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
                    <span>Latitude (°N)</span>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.lat}
                      onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Longitude (°E)</span>
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
            trajectory={trajectoryPoints}
          />
          {!scenario && (
            <div className="map-hint">
              {activeTab === "ml"
                ? "Select a forecast horizon (+6h, +12h, +24h) and click 'Overlay Forecast 200m Risk Grid'."
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
            <span>Model Algorithm</span>
            <strong>{scenario.ml_provenance?.model_algorithm || "Baseline Screening"}</strong>
          </div>
          <p>{scenario.model.data_quality}</p>
        </section>
      )}
    </main>
  );
}
