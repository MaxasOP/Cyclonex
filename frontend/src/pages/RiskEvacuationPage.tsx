import { useState } from "react";
import type { EvacuationPlan, ScenarioResult, BuildingFeature } from "../api";

interface Props {
  scenario: ScenarioResult | null;
  buildings: BuildingFeature[];
  sheltersPlan: EvacuationPlan | null;
  locationName: string;
  onNavigateToCommand: () => void;
  onSelectCity3D: () => void;
}
export default function RiskEvacuationPage({scenario, buildings, sheltersPlan, locationName, onNavigateToCommand, onSelectCity3D}: Props) {
  const [priority, setPriority] = useState("ALL");
  const shelters = sheltersPlan?.shelters ?? [];
  const filtered = shelters.filter(s => priority === "ALL" || s.evacuation_priority === priority);
  return <main className="op-showcase-root"><div className="op-showcase-container">
    <h1 className="op-section-title">Shelters and evacuation planning</h1>
    <p className="op-section-desc">{locationName}. The scenario screens reference facilities by distance from the storm. Current intake, road passability and bed availability require local confirmation.</p>
    <div className="op-hero-cta-group">
      <button className="op-btn-primary" onClick={onNavigateToCommand}>Open shelter map</button>
      <button className="op-btn-secondary" onClick={onSelectCity3D}>Inspect 3D buildings</button>
    </div>
    <div className="saas-landing-live-strip">
      <div className="saas-live-stat"><span className="saas-live-label">Listed shelters</span><strong>{sheltersPlan?.total_shelters_active ?? "Unavailable"}</strong></div>
      <div className="saas-live-stat"><span className="saas-live-label">Reference capacity</span><strong>{sheltersPlan?.total_capacity?.toLocaleString() ?? "Unavailable"}</strong></div>
      <div className="saas-live-stat"><span className="saas-live-label">Population at risk</span><strong>{sheltersPlan?.estimated_population_at_risk?.toLocaleString() ?? "Unavailable"}</strong></div>
      <div className="saas-live-stat"><span className="saas-live-label">Mapped footprints</span><strong>{scenario ? buildings.length : "Unavailable"}</strong></div>
    </div>
    <section className="op-technical-panel"><h2>Reference shelter directory</h2>
      <label>Scenario priority <select value={priority} onChange={e => setPriority(e.target.value)}>
        {["ALL", ...new Set(shelters.map(s => s.evacuation_priority).filter(Boolean))].map(p => <option key={p} value={p}>{p}</option>)}
      </select></label>
      <p role="status">{!sheltersPlan ? "Shelter data are unavailable for this run." : !filtered.length ? "No matching shelters." : ""}</p>
      {filtered.length > 0 && <table className="op-ledger-table"><thead><tr><th>Facility</th><th>District</th><th>Distance from eye</th><th>Design capacity</th><th>Scenario priority</th></tr></thead>
        <tbody>{filtered.map(s => <tr key={s.id}><td>{s.name}</td><td>{s.district}</td><td>{s.distance_km == null ? "Unavailable" : s.distance_km + " km"}</td><td>{s.capacity}</td><td>{s.evacuation_priority}</td></tr>)}</tbody></table>}
    </section>
    {Boolean(sheltersPlan?.ward_priorities?.length) && <section className="op-technical-panel"><h2>Scenario sectors</h2>
      <table className="op-ledger-table"><thead><tr><th>Sector</th><th>Screening level</th><th>Nearest listed shelter</th></tr></thead>
      <tbody>{sheltersPlan?.ward_priorities.map(w => <tr key={w.ward_id}><td>{w.name}</td><td>{w.risk_level}</td><td>{w.nearest_shelter ?? "Unavailable"}</td></tr>)}</tbody></table>
    </section>}
  </div></main>;
}
