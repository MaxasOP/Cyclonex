import { FormEvent, useState } from "react";
import { createScenario, fetchBuildings, type BuildingFeature, type ScenarioResult } from "./api";
import RiskMap from "./RiskMap";

const defaults = {
  name: "Bay of Bengal screening run",
  center_lat: "15.2",
  center_lon: "87.4",
  max_wind_kph: "180",
  central_pressure_hpa: "940",
  rain_rate_mm_hr: "70",
  storm_surge_m: "2.5",
  field_radius_km: "2",
};

const legend = [
  ["#75c9f1", "No damage"],
  ["#35a66f", "Safe"],
  ["#ed8a28", "Damage likely"],
  ["#d4483b", "Severe risk"],
];

export default function App() {
  const [form, setForm] = useState(defaults);
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await createScenario({
        ...form,
        center_lat: Number(form.center_lat),
        center_lon: Number(form.center_lon),
        max_wind_kph: Number(form.max_wind_kph),
        central_pressure_hpa: Number(form.central_pressure_hpa),
        rain_rate_mm_hr: Number(form.rain_rate_mm_hr),
        storm_surge_m: Number(form.storm_surge_m),
        field_radius_km: Number(form.field_radius_km),
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

  function field(name: keyof typeof defaults, label: string, step = "any") {
    return (
      <label>
        <span>{label}</span>
        <input
          required
          type={name === "name" ? "text" : "number"}
          step={step}
          value={form[name]}
          onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        />
      </label>
    );
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">CYCLONE RISK SCREENING</p>
          <h1>CYCLONEX</h1>
        </div>
        <p className="constraint">200 m grid · 90° wind incidence</p>
      </header>
      <section className="workspace">
        <aside className="controls">
          <h2>Create a scenario</h2>
          <p>Results are transparent screening estimates, not structural certificates.</p>
          <form onSubmit={submit}>
            {field("name", "Scenario name")}
            <div className="pair">{field("center_lat", "Latitude", "0.0001")}{field("center_lon", "Longitude", "0.0001")}</div>
            <div className="pair">{field("max_wind_kph", "Maximum wind (km/h)")}{field("central_pressure_hpa", "Central pressure (hPa)")}</div>
            <div className="pair">{field("rain_rate_mm_hr", "Rainfall (mm/h)")}{field("storm_surge_m", "Storm surge (m)", "0.1")}</div>
            {field("field_radius_km", "Model radius (km)", "0.1")}
            <button type="submit" disabled={loading}>{loading ? "Calculating…" : "Calculate risk grid"}</button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="legend" aria-label="Risk legend">
            {legend.map(([colour, label]) => <span key={label}><i style={{ background: colour }} />{label}</span>)}
          </div>
        </aside>
        <section className="map-shell" aria-label="Cyclone risk map">
          <RiskMap
            center={{ lat: Number(form.center_lat), lng: Number(form.center_lon) }}
            features={scenario?.risk_grid.features ?? []}
            buildings={buildings}
          />
          {!scenario && <div className="map-hint">Enter a scenario to overlay its risk grid.</div>}
        </section>
      </section>
      {scenario && (
        <section className="summary">
          <div><span>Cells modelled</span><strong>{scenario.risk_grid.features.length}</strong></div>
          <div><span>Ocean basin</span><strong>{scenario.basin?.replaceAll("_", " ") || "Not in North Indian Ocean"}</strong></div>
          <div><span>Ocean input</span><strong>{scenario.ocean_node?.meta.source || "Not requested"}</strong></div>
          <p>{scenario.model.data_quality}</p>
        </section>
      )}
    </main>
  );
}
