import { Activity, Brain, TrendingUp, Shield, BarChart3, Radio, BookOpen, Bell, Sparkles } from "lucide-react";
import type { AppPage } from "./App";
import type { DatasetSummary, ScenarioResult } from "./api";

type Props = {
  onLaunchConsole: (preset?: string) => void;
  onNavigatePage: (page: AppPage) => void;
  scenario: ScenarioResult | null;
  datasetSummary: DatasetSummary | null;
  presets: Record<string, {name: string}>;
};

const workspaces = [
  ["ai-lab", Brain, "AI image analysis", "Upload imagery or inspect a synthetic scenario and its model provenance."],
  ["forecast", TrendingUp, "Forecast", "Explore the forecast waypoints and the radial wind profile."],
  ["evacuation", Shield, "Shelters and evacuation", "Inspect reference shelters near the selected storm."],
  ["resilience", Sparkles, "Infrastructure resilience", "Screen infrastructure exposure and compare scenario assumptions."],
  ["analytics", BarChart3, "Historical analytics", "Explore historical reference presets and available evaluation results."],
  ["bulletins", Bell, "Bulletins", "Read sourced articles and print a scenario screening report."],
  ["data-sources", Radio, "Data sources", "Check data provenance and query the backend."],
  ["docs", BookOpen, "Methodology", "Read the assumptions and limitations of the screening models."],
] as const;

export default function LandingPage({ onLaunchConsole, onNavigatePage, scenario, datasetSummary, presets }: Props) {
  return <main className="op-showcase-root"><div className="op-showcase-container">
    <section className="op-showcase-section op-hero-grid">
      <div>
        <h1 className="op-hero-title">Cyclonex</h1>
        <p className="op-hero-mission">Explore how a cyclone's position, wind speed and movement influence coastal wind and building exposure. Select a storm to run a scenario.</p>
        <button className="op-btn-primary" onClick={() => onLaunchConsole()}><Activity size={15}/>Open tactical map</button>
      </div>
      <div className="op-technical-panel">
        <label htmlFor="overview-preset" className="tactical-control-label">Reference storm</label>
        <select id="overview-preset" className="tactical-select" defaultValue="" onChange={e => onLaunchConsole(e.target.value)}>
          <option value="" disabled>Select a scenario</option>
          {Object.entries(presets).map(([key, preset]) => <option key={key} value={key}>{preset.name}</option>)}
        </select>
        <p>Current run: {scenario?.input?.name ?? "No scenario available"}</p>
        <p>Grid resolution: {scenario?.risk_grid.metadata?.grid_size_m == null ? "Unavailable" : `${scenario.risk_grid.metadata.grid_size_m} m`}</p>
        <p>Baseline training: {datasetSummary?.model_status ?? "Unavailable"}</p>
      </div>
    </section>
    <section className="op-showcase-section"><h2 className="op-section-title">Workspaces</h2>
      <div className="op-workspace-ledger">{workspaces.map(([id, Icon, title, description]) =>
        <button className="op-workspace-row" key={id} onClick={() => onNavigatePage(id)}>
          <span className="op-workspace-name"><Icon size={15}/> {title}</span>
          <span className="op-workspace-desc">{description}</span>
        </button>)}</div>
    </section>
  </div></main>;
}
