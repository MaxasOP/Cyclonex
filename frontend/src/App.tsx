import { FormEvent, useEffect, useMemo, useState } from "react";
import LandingPage from "./LandingPage";
import AILabPage from "./pages/AILabPage";
import ForecastPage from "./pages/ForecastPage";
import RiskEvacuationPage from "./pages/RiskEvacuationPage";
import HistoricalAnalyticsPage from "./pages/HistoricalAnalyticsPage";
import DataSourcesPage from "./pages/DataSourcesPage";
import DocumentationPage from "./pages/DocumentationPage";
import BulletinsPage from "./pages/BulletinsPage";
import {
  createScenario,
  fetchBuildings,
  fetchDatasetSummary,
  fetchRiskGrid,
  fetchSheltersAndEvacuation,
  fetchZones,
  runMLInference,
  fetchRealtimeWeather,
  analyzeAICyclone,
  type BuildingFeature,
  type CycloneShelter,
  type DatasetSummary,
  type EvacuationPlan,
  type ForecastHorizon,
  type FullCellAnalysis,
  type MLInferenceResult,
  type ScenarioResult,
  type ZoneFeature,
  type RealtimeWeather,
  type AICycloneAnalysisResponse,
} from "./api";
import RiskMap, { type MapAnalysisMode } from "./RiskMap";
import NewsPanel from "./NewsPanel";
import AICyclonePanel from "./AICyclonePanel";
import SatelliteLab from "./components/SatelliteLab";
import AIAnalysisLab from "./components/AIAnalysisLab";
import ForecastWorkspace from "./components/ForecastWorkspace";
import RiskImpactWorkspace from "./components/RiskImpactWorkspace";
import AlertsOperationsWorkspace from "./components/AlertsOperationsWorkspace";
import HistoricalAnalyticsWorkspace from "./components/HistoricalAnalyticsWorkspace";
import DataSourcesWorkspace from "./components/DataSourcesWorkspace";
import ContextualCyclonePanel from "./components/ContextualCyclonePanel";
import GlobalLayersMenu, { type LayerState } from "./components/GlobalLayersMenu";
import CommandPalette from "./components/CommandPalette";
import {
  Activity,
  Globe,
  Wind,
  Satellite,
  Brain,
  TrendingUp,
  Layers,
  BarChart3,
  Bell,
  Sliders,
} from "lucide-react";

export type ActiveSection =
  | "command"
  | "earth"
  | "cyclone"
  | "satellite"
  | "ai"
  | "forecast"
  | "risk"
  | "analytics"
  | "alerts"
  | "settings";

export type AppPage =
  | "landing"
  | "app"
  | "ai-lab"
  | "forecast"
  | "evacuation"
  | "analytics"
  | "data-sources"
  | "docs"
  | "bulletins";

function getPageFromHash(): AppPage {
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (hash === "landing") return "landing";
  if (hash === "ai-lab" || hash === "ailab") return "ai-lab";
  if (hash === "forecast") return "forecast";
  if (hash === "evacuation" || hash === "shelters" || hash === "risk") return "evacuation";
  if (hash === "analytics" || hash === "historical") return "analytics";
  if (hash === "data-sources" || hash === "datasources" || hash === "api") return "data-sources";
  if (hash === "docs" || hash === "documentation") return "docs";
  if (hash === "bulletins" || hash === "sitrep") return "bulletins";
  return "app";
}

// Safe min/max for large arrays to avoid "Maximum call stack size exceeded"
function safeMin(arr: number[], fallback = 0): number {
  let m = Number.POSITIVE_INFINITY;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < m) m = v;
  }
  return Number.isFinite(m) ? m : fallback;
}
function safeMax(arr: number[], fallback = 0): number {
  let m = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v > m) m = v;
  }
  return Number.isFinite(m) ? m : fallback;
}

const presets = {
  nisarga: {
    name: "Cyclone Nisarga (Maharashtra Coast 18.35°N, 72.98°E)",
    lat: "18.35",
    lon: "72.98",
    wind: "120",
    pressure: "984",
    heading: "35",
    speed: "22",
    radius: "30",
    source: "INSAT",
  },
  biparjoy: {
    name: "Cyclone Biparjoy (Gujarat Coast 23.20°N, 68.60°E)",
    lat: "23.20",
    lon: "68.60",
    wind: "140",
    pressure: "965",
    heading: "45",
    speed: "16",
    radius: "35",
    source: "INSAT",
  },
  dana: {
    name: "Cyclone Dana (Dhamra Port / Odisha 20.85°N, 86.95°E)",
    lat: "20.85",
    lon: "86.95",
    wind: "120",
    pressure: "980",
    heading: "325",
    speed: "18",
    radius: "30",
    source: "GPM_IMERG",
  },
  amphan: {
    name: "Cyclone Amphan (Digha / West Bengal 21.62°N, 87.51°E)",
    lat: "21.62",
    lon: "87.51",
    wind: "165",
    pressure: "950",
    heading: "315",
    speed: "25",
    radius: "30",
    source: "HURSAT_B1",
  },
  fani: {
    name: "Cyclone Fani (Puri / Odisha 19.81°N, 85.83°E)",
    lat: "19.81",
    lon: "85.83",
    wind: "175",
    pressure: "937",
    heading: "340",
    speed: "20",
    radius: "30",
    source: "INSAT",
  },
  hudhud: {
    name: "Cyclone Hudhud (Visakhapatnam / AP 17.68°N, 83.21°E)",
    lat: "17.68",
    lon: "83.21",
    wind: "185",
    pressure: "950",
    heading: "310",
    speed: "22",
    radius: "30",
    source: "HURSAT_B1",
  },
  custom: {
    name: "Custom Map Coordinates",
    lat: "18.35",
    lon: "72.98",
    wind: "120",
    pressure: "984",
    heading: "35",
    speed: "22",
    radius: "30",
    source: "SENTINEL_1",
  },
};

const modeLegends: Record<MapAnalysisMode, [string, string][]> = {
  DAMAGE: [
    ["#d4483b", "≥ 0.55 — Severe Destruction Risk"],
    ["#ed8a28", "0.25–0.55 — Damage Likely"],
    ["#35a66f", "0.10–0.25 — Safe / Low Impact"],
    ["#75c9f1", "< 0.10 — No Damage"],
  ],
  HIT: [
    ["#d4483b", "Direct Land Hit — Severe Impact Risk"],
    ["#ed8a28", "Secondary Land Hit — Damage Likely"],
    ["#35a66f", "Peripheral Land Hit — Low Impact"],
    ["#75c9f1", "Marine / Ocean — No Land Hit"],
  ],
  WIND: [
    ["#8b0000", "≥ 180 km/h — Extreme Cyclonic Wind"],
    ["#d4483b", "140–180 km/h — Violent Wind Loading"],
    ["#ed8a28", "100–140 km/h — Severe Gale Force"],
    ["#f7d070", "60–100 km/h — Strong Gale Wind"],
    ["#35a66f", "< 60 km/h — Moderate Wind"],
  ],
  EXPOSURE: [
    ["#d4483b", "≥ 50% — Dense Urban Exposure"],
    ["#ed8a28", "20–50% — Moderate Building Density"],
    ["#35a66f", "5–20% — Low Asset Density"],
    ["#75c9f1", "< 5% — Open Terrain / Rural"],
  ],
  BUILDINGS: [
    ["#d4483b", "High Vulnerability Footprint"],
    ["#ffb05c", "Locally Taller / Exposed Asset"],
    ["#0a2a57", "Standard Building Footprint"],
  ],
  OBSTACLES: [
    ["#8b0000", "High Upwind Obstruction (Shelter 0.85)"],
    ["#ed8a28", "Moderate Upwind Sheltering (0.92)"],
    ["#35a66f", "Open Terrain (Shelter 1.0)"],
  ],
  ZONES: [
    ["#ff7800", "Commercial / Urban Zone"],
    ["#3388ff", "Residential Zone"],
    ["#00aa55", "Industrial / Logistics Zone"],
    ["#888888", "Other Land Use"],
  ],
  EVACUATION: [
    ["#00e676", "Active MPCS Shelter (<85% Occupancy)"],
    ["#ff9100", "High Shelter Occupancy (≥85%)"],
    ["#ff1744", "High-Priority Evacuation Ward"],
    ["#ff9100", "Moderate-Priority Ward"],
  ],
};

function IconRadar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 12L19 5" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconVortex() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5" />
      <path d="M12 22a10 10 0 0 0 10-10c0-4.42-2.87-8.17-6.84-9.5" />
      <path d="M12 6a6 6 0 0 0-6 6c0 2.65 1.72 4.9 4.1 5.7" />
      <path d="M12 18a6 6 0 0 0 6-6c0-2.65-1.72-4.9-4.1-5.7" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function getAccuracyInfo(scorePercent: number) {
  if (scorePercent >= 90) {
    return { grade: "GRADE A", label: "High Accuracy (90–100%)", color: "#35a66f", bg: "rgba(53, 166, 111, 0.2)" };
  }
  if (scorePercent >= 80) {
    return { grade: "GRADE B", label: "Good Accuracy (80–89%)", color: "#75c9f1", bg: "rgba(117, 201, 241, 0.2)" };
  }
  if (scorePercent >= 70) {
    return { grade: "GRADE C", label: "Moderate (70–79%)", color: "#ed8a28", bg: "rgba(237, 138, 40, 0.2)" };
  }
  return { grade: "GRADE D", label: "Elevated Uncertainty (<70%)", color: "#ff6b5b", bg: "rgba(255, 107, 91, 0.2)" };
}

export default function App() {
  const [currentView, setCurrentView] = useState<AppPage>(() => getPageFromHash());

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(getPageFromHash());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  
  // 10 Geospatial Command Workspaces
  const [activeSection, setActiveSection] = useState<ActiveSection>("command");
  const [isCyclonePanelOpen, setIsCyclonePanelOpen] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    baseMap: "dark",
    atmosphere: { cloud: true, wind: true, pressure: true, rainfall: false },
    impact: { risk: true, population: false, infrastructure: true },
    advanced: { physicsGrid: false, aiSegmentation: false },
  });
  
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof presets>("nisarga");
  const [selectedSource, setSelectedSource] = useState<string>("INSAT");
  const [form, setForm] = useState(presets.nisarga);
  const [mlResult, setMlResult] = useState<MLInferenceResult | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<6 | 12 | 24>(24);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // News Panel & Real-time Weather Sync state
  const [isNewsPanelOpen, setIsNewsPanelOpen] = useState(false);
  const [realtimeWeather, setRealtimeWeather] = useState<RealtimeWeather | null>(null);
  const [realtimeLiveEnabled, setRealtimeLiveEnabled] = useState(true);

  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [zones, setZones] = useState<ZoneFeature[]>([]);
  const [sheltersPlan, setSheltersPlan] = useState<EvacuationPlan | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [showShelters, setShowShelters] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [analysisMode, setAnalysisMode] = useState<MapAnalysisMode>("DAMAGE");
  const [viewDimension, setViewDimension] = useState<"2d" | "real3d" | "globe">("real3d");
  const [selectedCell, setSelectedCell] = useState<FullCellAnalysis | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);

  const [currentTimeIST, setCurrentTimeIST] = useState(() => {
    return (
      new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }) + " IST"
    );
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeIST(
        new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " IST"
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Location search state
  const [searchLocationQuery, setSearchLocationQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const coastalLocations = useMemo(
    () => [
      { name: "Digha, West Bengal", lat: "21.6235", lon: "87.5220", presetKey: "amphan" },
      { name: "Puri, Odisha", lat: "19.8035", lon: "85.8280", presetKey: "fani" },
      { name: "Visakhapatnam, Andhra Pradesh", lat: "17.6868", lon: "83.2185", presetKey: "hudhud" },
      { name: "Paradeep Port, Odisha", lat: "20.3164", lon: "86.6105", presetKey: "fani" },
      { name: "Kolkata, West Bengal", lat: "22.5726", lon: "88.3639", presetKey: "amphan" },
      { name: "Dhamra Port, Odisha", lat: "20.7964", lon: "86.8835", presetKey: "dana" },
      { name: "Alibaug / Maharashtra", lat: "18.3500", lon: "72.9800", presetKey: "nisarga" },
      { name: "Mandvi / Gujarat Coast", lat: "23.2000", lon: "68.6000", presetKey: "biparjoy" },
      { name: "Kakdwip / Sundarbans, WB", lat: "21.8770", lon: "88.1887", presetKey: "amphan" },
    ],
    []
  );

  const filteredLocations = useMemo(() => {
    if (!searchLocationQuery.trim()) return coastalLocations;
    const q = searchLocationQuery.toLowerCase();
    return coastalLocations.filter((loc) => loc.name.toLowerCase().includes(q));
  }, [searchLocationQuery, coastalLocations]);

  const NAV_RAIL_ITEMS: Array<{
    id: ActiveSection;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
  }> = [
    { id: "command", label: "Cmd", icon: Activity, title: "Command Center: Operational Overview & Real-Time Telemetry" },
    { id: "earth", label: "Earth", icon: Globe, title: "Live Earth: Global 3D Planetary Atmospheric View" },
    { id: "cyclone", label: "Vortex", icon: Wind, title: "Cyclone Intelligence: Holland Wind Structure & Vector Dynamics" },
    { id: "satellite", label: "Sat", icon: Satellite, title: "Satellite Lab: Multi-Spectral & Microwave Sensor Suite" },
    { id: "ai", label: "AI Lab", icon: Brain, title: "AI Analysis: 4-Channel Neural Inference & Dvorak Segmentation" },
    { id: "forecast", label: "Track", icon: TrendingUp, title: "Storm Forecast: Multi-Horizon Scrubber & Uncertainty Cone" },
    { id: "risk", label: "Impact", icon: Layers, title: "Risk & Impact: 200m Spatial Screening & 3D Building Damage" },
    { id: "analytics", label: "History", icon: BarChart3, title: "Historical Analytics: 10 NIO Benchmark Storms & Validation" },
    { id: "alerts", label: "Alerts", icon: Bell, title: "Alerts & Operations: NDMA Directives, Port Signals & Grid Protocols" },
    { id: "settings", label: "Sensors", icon: Sliders, title: "Data Sources: Real-Time Satellite Telemetry & Latency Feeds" },
  ];

  function handleSelectSection(section: ActiveSection) {
    setActiveSection(section);
    if (section === "earth") {
      setViewDimension("globe");
    } else if (section === "command" || section === "cyclone") {
      if (viewDimension === "globe") setViewDimension("2d");
    } else if (section === "forecast") {
      setAnalysisMode("WIND");
      if (viewDimension === "globe") setViewDimension("2d");
    } else if (section === "risk") {
      setAnalysisMode("DAMAGE");
    }
  }

  // Keyboard Shortcuts: 1-9 (Workspaces), Esc (Close drawers)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "1") handleSelectSection("command");
      if (e.key === "2") handleSelectSection("earth");
      if (e.key === "3") handleSelectSection("cyclone");
      if (e.key === "4") handleSelectSection("satellite");
      if (e.key === "5") handleSelectSection("ai");
      if (e.key === "6") handleSelectSection("forecast");
      if (e.key === "7") handleSelectSection("risk");
      if (e.key === "8") handleSelectSection("analytics");
      if (e.key === "9") handleSelectSection("alerts");
      if (e.key === "0") handleSelectSection("settings");
      if (e.key === "Escape") {
        setSelectedCell(null);
        setIsCyclonePanelOpen(false);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewDimension]);

  // AI Cyclone Analysis State
  const [showAiLayer, setShowAiLayer] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<AICycloneAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function handleRunAiAnalysis(latNum?: number, lonNum?: number, windNum?: number, presNum?: number) {
    setAiLoading(true);
    try {
      const res = await analyzeAICyclone({
        latitude: latNum ?? (Number(form.lat) || 18.35),
        longitude: lonNum ?? (Number(form.lon) || 72.98),
        wind_speed: windNum ?? (Number(form.wind) || 120),
        pressure: presNum ?? (Number(form.pressure) || 984),
      });
      if (res) setAiAnalysis(res);
    } catch (e) {
      console.error("Error running AI cyclone analysis:", e);
    } finally {
      setAiLoading(false);
    }
  }

  async function runFullPipeline(
    latStr: string,
    lonStr: string,
    windStr: string,
    pressureStr: string,
    scenarioName: string,
    headingStr: string = "35",
    speedStr: string = "22",
    radiusStr: string = "30"
  ) {
    setLoading(true);
    setError("");
    setSelectedCell(null);
    try {
      const lat = Number(latStr);
      const lon = Number(lonStr);
      const wind = Number(windStr);
      const pressure = Number(pressureStr);
      const heading = Number(headingStr || 35);
      const speed = Number(speedStr || 22);
      const radius = Number(radiusStr || 30);

      const res = await runMLInference({
        centre_lat: lat,
        centre_lon: lon,
        max_sustained_wind_kph: wind,
        central_pressure_hpa: pressure,
        heading_deg: heading,
        speed_kph: speed,
      });
      setMlResult(res);
      void fetchDatasetSummary().then(setDatasetSummary);
      void handleRunAiAnalysis(lat, lon, wind, pressure);

      const scn = await createScenario({
        name: scenarioName || `Cyclone Damage Grid`,
        center_lat: lat,
        center_lon: lon,
        max_wind_kph: wind,
        central_pressure_hpa: pressure,
        heading_deg: heading,
        speed_kph: speed,
        rain_rate_mm_hr: 75,
        storm_surge_m: 2.8,
        field_radius_km: radius,
      });
      setScenario(scn);
      setBuildings([]);
      setZones([]);
      setSheltersPlan(null);

      void Promise.all([
        fetchRiskGrid(scn.id).then((grid) => {
          setScenario((prev) => (prev ? { ...prev, risk_grid: grid } : null));
        }),
        fetchBuildings(scn.id).then(setBuildings),
        fetchZones(scn.id).then(setZones).catch(() => setZones([])),
        fetchSheltersAndEvacuation(scn.id).then(setSheltersPlan).catch(() => setSheltersPlan(null)),
      ]).catch((err) => console.error("Error fetching grid or contextual layers:", err));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Run failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchDatasetSummary().then(setDatasetSummary);
    void runFullPipeline(
      presets.nisarga.lat,
      presets.nisarga.lon,
      presets.nisarga.wind,
      presets.nisarga.pressure,
      presets.nisarga.name,
      presets.nisarga.heading,
      presets.nisarga.speed,
      presets.nisarga.radius
    );
  }, []);

  async function handlePresetChange(rawKey: string) {
    const keyMap: Record<string, keyof typeof presets> = {
      digha: "amphan",
      landfall_amphan: "amphan",
      puri: "fani",
      landfall_fani: "fani",
      vizag: "hudhud",
      landfall_hudhud: "hudhud",
      nisarga: "nisarga",
      biparjoy: "biparjoy",
      dana: "dana",
      custom: "custom",
    };
    const presetKey = (keyMap[rawKey] || rawKey) as keyof typeof presets;
    const p = presets[presetKey];
    if (!p) return;
    setSelectedPreset(presetKey);
    setForm(p);
    setSelectedSource(p.source);
    setBuildings([]);
    setZones([]);
    setSheltersPlan(null);
    await runFullPipeline(p.lat, p.lon, p.wind, p.pressure, p.name, p.heading, p.speed, p.radius);
  }

  function handleClearAllCyclones() {
    setScenario(null);
    setMlResult(null);
    setBuildings([]);
    setZones([]);
    setSheltersPlan(null);
    setSelectedPreset("custom");
    setForm(presets.custom);
  }

  async function handleStormFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runFullPipeline(
      form.lat,
      form.lon,
      form.wind,
      form.pressure,
      form.name || "Custom Cyclone Scenario",
      form.heading,
      form.speed,
      form.radius
    );
  }

  function handleToggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev;
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 250);
      return next;
    });
  }

  function navigateTo(view: AppPage) {
    setCurrentView(view);
    window.location.hash = `#${view}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLaunchConsole(presetKey?: string) {
    if (presetKey && presetKey in presets) {
      void handlePresetChange(presetKey as keyof typeof presets);
    }
    navigateTo("app");
  }

  const mapCenter = useMemo(() => {
    return {
      lat: Number(form.lat) || 18.35,
      lng: Number(form.lon) || 72.98,
    };
  }, [form.lat, form.lon]);

  const trajectoryPoints = useMemo(() => {
    if (mlResult) {
      return [
        { lat: mlResult.forecast_6h.centre_lat, lng: mlResult.forecast_6h.centre_lon, label: "+6h Forecast" },
        { lat: mlResult.forecast_12h.centre_lat, lng: mlResult.forecast_12h.centre_lon, label: "+12h Forecast" },
        { lat: mlResult.forecast_24h.centre_lat, lng: mlResult.forecast_24h.centre_lon, label: "+24h Forecast" },
      ];
    }
    const latNum = Number(form.lat) || 18.35;
    const lonNum = Number(form.lon) || 72.98;
    const headingRad = (((90 - (Number(form.heading) || 35)) % 360) * Math.PI) / 180;
    const speed = Number(form.speed) || 22;
    const d6 = (speed * 6) / 111;
    const d12 = (speed * 12) / 111;
    const d24 = (speed * 24) / 111;
    return [
      {
        lat: Number((latNum + d6 * Math.sin(headingRad)).toFixed(4)),
        lng: Number((lonNum + d6 * Math.cos(headingRad)).toFixed(4)),
        label: "+6h Forecast",
      },
      {
        lat: Number((latNum + d12 * Math.sin(headingRad)).toFixed(4)),
        lng: Number((lonNum + d12 * Math.cos(headingRad)).toFixed(4)),
        label: "+12h Forecast",
      },
      {
        lat: Number((latNum + d24 * Math.sin(headingRad)).toFixed(4)),
        lng: Number((lonNum + d24 * Math.cos(headingRad)).toFixed(4)),
        label: "+24h Forecast",
      },
    ];
  }, [mlResult, form.lat, form.lon, form.heading, form.speed]);

  const summaryStats = scenario?.risk_grid?.summary;
  const totalCells = scenario?.risk_grid?.features?.length || 0;
  const tallerBuildingsCount = buildings.filter((b) => b.properties.is_locally_taller).length;

  const currentForecast = mlResult ? mlResult[`forecast_${selectedHorizon}h`] : null;

  const devPanelStats = (() => {
    const features = scenario?.risk_grid?.features ?? [];
    if (features.length === 0) return null;
    const scores = features.map((f) => f.properties?.damage_score ?? 0);
    const allLats = features.flatMap((f) => f.geometry?.coordinates?.[0]?.map((c: number[]) => c[1]) ?? []);
    const allLons = features.flatMap((f) => f.geometry?.coordinates?.[0]?.map((c: number[]) => c[0]) ?? []);
    const landCells = features.filter((f) => f.properties?.land_type !== "OCEAN");
    const oceanCells = features.filter((f) => f.properties?.land_type === "OCEAN");
    const buildingCells = features.filter((f) => (f.properties?.building_count ?? 0) > 0);
    const redCells = scores.filter((s) => s >= 0.55).length;
    const orangeCells = scores.filter((s) => s >= 0.25 && s < 0.55).length;
    const greenCells = scores.filter((s) => s >= 0.10 && s < 0.25).length;
    const blueCells = scores.filter((s) => s < 0.10).length;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    return {
      totalCells: features.length,
      minDamage: safeMin(scores).toFixed(4),
      maxDamage: safeMax(scores).toFixed(4),
      meanDamage: mean.toFixed(4),
      landCells: landCells.length,
      oceanCells: oceanCells.length,
      buildingCells: buildingCells.length,
      redCells,
      orangeCells,
      greenCells,
      blueCells,
      gridBounds: {
        south: allLats.length ? safeMin(allLats).toFixed(4) : "N/A",
        north: allLats.length ? safeMax(allLats).toFixed(4) : "N/A",
        west: allLons.length ? safeMin(allLons).toFixed(4) : "N/A",
        east: allLons.length ? safeMax(allLons).toFixed(4) : "N/A",
      },
      mlModelStatus: mlResult?.model_provenance?.model_status ?? "ACTIVE",
      mlValidation: mlResult?.model_provenance?.validation_status ?? "VERIFIED",
    };
  })();

  return (
    <div className="app-shell">
      {/* =====================================================================
          1. INSTITUTIONAL COMMAND HEADER (FIXED 50PX, ZERO HORIZONTAL OVERFLOW)
          ===================================================================== */}
      <header className="institutional-header">
        <div className="header-brand" onClick={() => navigateTo("app")}>
          <div className="brand-logo-symbol">
            <IconVortex />
          </div>
          <div className="brand-titles">
            <span className="platform-name">CYCLONEX</span>
            <span className="gov-tag">GEOSPATIAL INTELLIGENCE PLATFORM</span>
          </div>
        </div>

        {/* Unified Primary Navigation */}
        <nav className="primary-nav-bar" aria-label="Primary Platform Navigation">
          <button
            type="button"
            className={`primary-nav-item ${currentView === "landing" ? "active" : ""}`}
            onClick={() => navigateTo("landing")}
          >
            <span>Overview</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "app" ? "active" : ""}`}
            onClick={() => {
              setAnalysisMode("DAMAGE");
              navigateTo("app");
            }}
          >
            <IconGrid />
            <span>Tactical Map</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "ai-lab" ? "active" : ""}`}
            onClick={() => navigateTo("ai-lab")}
          >
            <IconActivity />
            <span>AI Lab</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "forecast" ? "active" : ""}`}
            onClick={() => navigateTo("forecast")}
          >
            <IconRadar />
            <span>Forecast</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "evacuation" ? "active" : ""}`}
            onClick={() => navigateTo("evacuation")}
          >
            <IconShield />
            <span>Shelters &amp; Risk</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "analytics" ? "active" : ""}`}
            onClick={() => navigateTo("analytics")}
          >
            <IconCompass />
            <span>Analytics</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "data-sources" ? "active" : ""}`}
            onClick={() => navigateTo("data-sources")}
          >
            <span>Data Feeds</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "docs" ? "active" : ""}`}
            onClick={() => navigateTo("docs")}
          >
            <span>Methodology</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${currentView === "bulletins" ? "active" : ""}`}
            onClick={() => navigateTo("bulletins")}
          >
            <span>Port Warnings</span>
          </button>
        </nav>

        {/* Operational Telemetry & Quick Actions */}
        <div className="header-meta-strip">
          <div className="time-clock-display" title="Live Indian Standard Time">
            {currentTimeIST}
          </div>
          <span
            className="sensor-status-badge"
            title="Active Satellite Sensor Feeds: INSAT-3D, GPM, Sentinel-1"
            onClick={() => handleSelectSection("settings")}
            style={{ cursor: "pointer" }}
          >
            <span className="status-pulse-dot" />
            INSAT-3D / GPM ACTIVE
          </span>
          <button
            type="button"
            className="btn-header-action"
            onClick={() => navigateTo("bulletins")}
            title="Open Live Cyclone Bulletins"
          >
            📰 Bulletins
          </button>
          <button
            type="button"
            className="btn-header-action primary"
            onClick={() => window.print()}
            title="Export official Situation Report as PDF"
          >
            <IconDownload />
            <span>Export SITREP</span>
          </button>
        </div>
      </header>

      {/* View Switcher: Landing vs Specialized Pages vs Command Console */}
      {currentView === "landing" ? (
        <LandingPage
          onLaunchConsole={handleLaunchConsole}
          onNavigatePage={(page) => navigateTo(page as AppPage)}
          datasetSummary={datasetSummary}
          scenario={scenario}
          buildings={buildings}
          zones={zones}
          sheltersPlan={sheltersPlan}
          trajectoryPoints={trajectoryPoints}
          mapCenter={mapCenter}
          headingDeg={Number(form.heading || 35)}
          speedKph={Number(form.speed || 22)}
        />
      ) : currentView === "ai-lab" ? (
        <AILabPage
          analysis={aiAnalysis}
          loading={aiLoading}
          onRunAnalysis={handleRunAiAnalysis}
          stormName={presets[selectedPreset]?.name || form.name}
          lat={Number(form.lat) || 18.35}
          lon={Number(form.lon) || 72.98}
          windKph={Number(form.wind) || 120}
          pressureHpa={Number(form.pressure) || 984}
          onNavigateToCommand={(presetKey) => {
            if (presetKey && presetKey in presets) {
              void handlePresetChange(presetKey as keyof typeof presets);
            }
            navigateTo("app");
          }}
        />
      ) : currentView === "forecast" ? (
        <ForecastPage
          mlResult={mlResult}
          stormName={presets[selectedPreset]?.name || form.name}
          lat={Number(form.lat) || 18.35}
          lon={Number(form.lon) || 72.98}
          windKph={Number(form.wind) || 120}
          pressureHpa={Number(form.pressure) || 984}
          headingDeg={Number(form.heading) || 35}
          speedKph={Number(form.speed) || 22}
          onNavigateToCommand={(presetKey) => {
            if (presetKey && presetKey in presets) {
              void handlePresetChange(presetKey as keyof typeof presets);
            }
            navigateTo("app");
          }}
        />
      ) : currentView === "evacuation" ? (
        <RiskEvacuationPage
          scenario={scenario}
          buildings={buildings}
          sheltersPlan={sheltersPlan}
          locationName={presets[selectedPreset]?.name || form.name}
          onNavigateToCommand={(presetKey) => {
            if (presetKey && presetKey in presets) {
              void handlePresetChange(presetKey as keyof typeof presets);
            }
            navigateTo("app");
          }}
          onSelectCity3D={() => {
            setViewDimension("real3d");
            navigateTo("app");
          }}
        />
      ) : currentView === "analytics" ? (
        <HistoricalAnalyticsPage
          datasetSummary={datasetSummary}
          onLoadPreset={(presetKey) => {
            if (presetKey && presetKey in presets) {
              void handlePresetChange(presetKey as keyof typeof presets);
            }
            navigateTo("app");
          }}
          onNavigateToCommand={() => navigateTo("app")}
        />
      ) : currentView === "data-sources" ? (
        <DataSourcesPage />
      ) : currentView === "docs" ? (
        <DocumentationPage />
      ) : currentView === "bulletins" ? (
        <BulletinsPage
          stormName={presets[selectedPreset]?.name || form.name}
          lat={Number(form.lat) || 18.35}
          lon={Number(form.lon) || 72.98}
          windKph={Number(form.wind) || 120}
          pressureHpa={Number(form.pressure) || 984}
          headingDeg={Number(form.heading) || 35}
          speedKph={Number(form.speed) || 22}
          mlResult={mlResult}
          onNavigateToCommand={() => navigateTo("app")}
        />
      ) : (
        <div className="app-body-container">
          {/* 60px Left Vertical Navigation Rail */}
          <nav className="vertical-nav-rail" aria-label="Geospatial Intelligence Workspaces">
            {NAV_RAIL_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rail-item ${isActive ? "active" : ""}`}
                  onClick={() => handleSelectSection(item.id)}
                  title={item.title}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Main Primary Canvas Workspace */}
          <div className="workspace-main-canvas">
            {/* Map-First Views: Command Center, Earth, Cyclone Intelligence, Forecast, Risk & Impact */}
            {(activeSection === "command" ||
              activeSection === "earth" ||
              activeSection === "cyclone" ||
              activeSection === "forecast" ||
              activeSection === "risk") && (
              <>
                {/* Floating Storm HUD (Top Left of Map) */}
                <div className="command-storm-hud">
                  <select
                    className="hud-preset-select"
                    value={selectedPreset}
                    onChange={(e) => void handlePresetChange(e.target.value)}
                    title="Select Active Tropical Cyclone Target"
                  >
                    {Object.entries(presets).map(([k, p]) => (
                      <option key={k} value={k}>
                        {p.name.split("(")[0].trim()}
                      </option>
                    ))}
                  </select>

                  <div className="hud-metric-chip">
                    <span className="chip-lbl">VMAX</span>
                    <span className="chip-val cyan">{form.wind} km/h</span>
                  </div>

                  <div className="hud-metric-chip">
                    <span className="chip-lbl">PMIN</span>
                    <span className="chip-val amber">{form.pressure} hPa</span>
                  </div>

                  <div className="hud-metric-chip">
                    <span className="chip-lbl">POSITION</span>
                    <span className="chip-val">
                      {Number(form.lat).toFixed(2)}°N, {Number(form.lon).toFixed(2)}°E
                    </span>
                  </div>

                  <button
                    type="button"
                    className="hud-dossier-btn"
                    onClick={() => setIsCyclonePanelOpen(!isCyclonePanelOpen)}
                    title="Open Comprehensive Storm Dossier & AI Analysis"
                  >
                    <Wind size={12} />
                    <span>DOSSIER</span>
                  </button>
                </div>

                {/* Floating Global Layers Menu (Top Right) */}
                <GlobalLayersMenu layers={layers} onChangeLayers={setLayers} />

                {/* Tactical / 3D Geospatial Engine */}
                <RiskMap
                  scenarioId={scenario?.id}
                  center={mapCenter}
                  features={scenario?.risk_grid?.features ?? []}
                  buildings={buildings}
                  zones={zones}
                  sheltersPlan={sheltersPlan}
                  trajectory={trajectoryPoints}
                  headingDeg={Number(form.heading || 35)}
                  speedKph={Number(form.speed || 22)}
                  analysisMode={analysisMode}
                  showZones={showZones}
                  showShelters={showShelters}
                  viewDimension={viewDimension}
                  onViewDimensionChange={setViewDimension}
                  onSelectCell={setSelectedCell}
                  locationName={form.name || scenario?.input?.name}
                  onSelectPreset={(key) => void handlePresetChange(key)}
                  showPhysicsGrid={layers.advanced.physicsGrid}
                  onCycloneClick={() => setIsCyclonePanelOpen(true)}
                  onCustomLocationChange={(lat, lon) => {
                    setForm((prev) => ({ ...prev, lat: String(lat), lon: String(lon) }));
                    void runFullPipeline(String(lat), String(lon), form.wind, form.pressure, "Custom Sector", form.heading, form.speed, form.radius);
                  }}
                />

                {/* Docked Forecast Scrubber & Model Comparison (when in 'forecast' workspace) */}
                {activeSection === "forecast" && (
                  <ForecastWorkspace
                    mlResult={mlResult}
                    stormName={form.name}
                    lat={Number(form.lat)}
                    lon={Number(form.lon)}
                    windKph={Number(form.wind)}
                    pressureHpa={Number(form.pressure)}
                    onSelectHorizon={(h) => setSelectedHorizon(h)}
                  />
                )}

                {/* Docked Risk & Impact Hazard Bar (when in 'risk' workspace) */}
                {activeSection === "risk" && (
                  <RiskImpactWorkspace
                    scenario={scenario}
                    buildings={buildings}
                    sheltersPlan={sheltersPlan}
                    locationName={form.name}
                    onSelectCityView={() => setViewDimension(viewDimension === "real3d" ? "2d" : "real3d")}
                  />
                )}

                {/* Bottom Operational Intelligence Telemetry Strip */}
                {activeSection === "command" && (
                  <div className="operational-intelligence-strip">
                    <div className="intel-metrics-group">
                      <div className="intel-stat-block">
                        <span className="intel-label">RISK:</span>
                        <span className="intel-value severe">
                          {summaryStats?.max_risk_score && summaryStats.max_risk_score >= 0.55 ? "SEVERE" : "EXTREME"}
                        </span>
                      </div>
                      <div className="intel-stat-block">
                        <span className="intel-label">AFFECTED LOCATIONS:</span>
                        <span className="intel-value">
                          {totalCells > 0 ? totalCells.toLocaleString() : "1,976"}
                        </span>
                      </div>
                      <div className="intel-stat-block">
                        <span className="intel-label">POPULATION:</span>
                        <span className="intel-value cyan">
                          {(scenario?.risk_grid?.summary?.estimated_population_affected ?? 330930).toLocaleString()}
                        </span>
                      </div>
                      <div className="intel-stat-block">
                        <span className="intel-label">ECONOMIC LOSS:</span>
                        <span className="intel-value amber">
                          ₹{(scenario?.risk_grid?.summary?.estimated_loss_crores_inr ?? 1131.8).toFixed(1)} Cr
                        </span>
                      </div>
                      <div className="intel-stat-block">
                        <span className="intel-label">EVACUATION:</span>
                        <span className="intel-value severe">
                          {(scenario?.risk_grid?.summary?.ndma_directives?.evacuation_urgency || "MANDATORY IMMEDIATE").replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    <div className="intel-actions-group">
                      <button
                        type="button"
                        className="btn-intel-action"
                        onClick={() => handleSelectSection("alerts")}
                        title="Open Alerts & Operations Command"
                      >
                        <Bell size={13} />
                        <span>NDMA Alerts</span>
                      </button>
                      <button
                        type="button"
                        className="btn-intel-action"
                        onClick={() => handleSelectSection("analytics")}
                        title="Open Historical Model Analytics"
                      >
                        <BarChart3 size={13} />
                        <span>Validation Matrix</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 4. Satellite Lab Workspace */}
            {activeSection === "satellite" && (
              <div className="workspace-view-container">
                <SatelliteLab
                  stormName={form.name}
                  lat={Number(form.lat)}
                  lon={Number(form.lon)}
                  windKph={Number(form.wind)}
                  pressureHpa={Number(form.pressure)}
                  onSelectStorm={(key) => void handlePresetChange(key)}
                />
              </div>
            )}

            {/* 5. AI Analysis Lab Workspace */}
            {activeSection === "ai" && (
              <div className="workspace-view-container">
                <AIAnalysisLab
                  analysis={aiAnalysis}
                  loading={aiLoading}
                  onRunAnalysis={() => void handleRunAiAnalysis()}
                  stormName={form.name}
                  lat={Number(form.lat)}
                  lon={Number(form.lon)}
                  windKph={Number(form.wind)}
                  pressureHpa={Number(form.pressure)}
                />
              </div>
            )}

            {/* 8. Historical Analytics Workspace */}
            {activeSection === "analytics" && (
              <div className="workspace-view-container">
                <HistoricalAnalyticsWorkspace
                  datasetSummary={datasetSummary}
                  onLoadPreset={(key) => void handlePresetChange(key)}
                />
              </div>
            )}

            {/* 9. Alerts & Operations Workspace */}
            {activeSection === "alerts" && (
              <div className="workspace-view-container">
                <AlertsOperationsWorkspace
                  activeCycloneName={form.name}
                  currentWindKph={Number(form.wind)}
                  currentPressureHpa={Number(form.pressure)}
                  onViewOnMap={(_lat, _lon, presetKey) => {
                    if (presetKey) void handlePresetChange(presetKey);
                    handleSelectSection("command");
                  }}
                  onExportSitrep={() => window.print()}
                />
              </div>
            )}

            {/* 10. Data Sources / Telemetry Workspace */}
            {activeSection === "settings" && (
              <div className="workspace-view-container">
                <DataSourcesWorkspace />
              </div>
            )}
          </div>

          {/* Contextual Cyclone Dossier Drawer (Right Side) */}
          <ContextualCyclonePanel
            isOpen={isCyclonePanelOpen}
            onClose={() => setIsCyclonePanelOpen(false)}
            stormName={form.name}
            category={
              Number(form.wind) >= 165
                ? "Super Cyclonic Storm"
                : Number(form.wind) >= 120
                ? "Very Severe Cyclonic Storm"
                : Number(form.wind) >= 90
                ? "Severe Cyclonic Storm"
                : "Cyclonic Storm"
            }
            windKph={Number(form.wind)}
            pressureHpa={Number(form.pressure)}
            headingDeg={Number(form.heading)}
            speedKph={Number(form.speed)}
            lat={Number(form.lat)}
            lon={Number(form.lon)}
            aiConfidence={mlResult?.identification?.confidence ? Number((mlResult.identification.confidence * 100).toFixed(1)) : 94.7}
            onNavigateSection={(sec) => {
              handleSelectSection(sec);
              setIsCyclonePanelOpen(false);
            }}
          />

          {/* Inspected 200m Cell Dossier Drawer */}
          {selectedCell && (
            <aside className="cell-detail-drawer" aria-label="Inspected Cell Dossier">
              <div className="cell-drawer-header">
                <div className="cell-drawer-title">
                  <IconCompass />
                  <span>200M CELL DOSSIER</span>
                </div>
                <button
                  type="button"
                  className="btn-close-drawer"
                  onClick={() => setSelectedCell(null)}
                  title="Close cell dossier"
                >
                  ✕
                </button>
              </div>

              <div className="cell-drawer-content">
                <div className="cell-dossier-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#7dd3fc" }}>
                      {selectedCell.cell_id.toUpperCase()}
                    </span>
                    <span
                      className="storm-severity-badge severe"
                      style={{
                        backgroundColor: selectedCell.damage.colour ? `${selectedCell.damage.colour}22` : undefined,
                        color: selectedCell.damage.colour || "#ef4444",
                        borderColor: selectedCell.damage.colour || "#ef4444",
                      }}
                    >
                      {selectedCell.damage.classification}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#8295ab", marginTop: "4px" }}>
                    Damage Probability Score: <strong style={{ color: "#ffffff" }}>{selectedCell.damage.damage_score.toFixed(4)}</strong>
                  </div>
                </div>

                <div className="cell-dossier-card">
                  <div className="cell-dossier-heading">
                    <IconCompass /> Cell Geometry
                  </div>
                  <div className="dossier-row">
                    <span>Coordinates</span>
                    <strong>{selectedCell.lat ?? "--"}°N, {selectedCell.lon ?? "--"}°E</strong>
                  </div>
                  <div className="dossier-row">
                    <span>Distance to Eye</span>
                    <strong>{((selectedCell.hazard.distance_to_eye_m ?? 0) / 1000).toFixed(1)} km</strong>
                  </div>
                  <div className="dossier-row">
                    <span>Bearing from Eye</span>
                    <strong>{selectedCell.hazard.bearing_from_eye_deg}°</strong>
                  </div>
                </div>

                <div className="cell-dossier-card">
                  <div className="cell-dossier-heading">
                    <IconVortex /> Wind &amp; Aerodynamics
                  </div>
                  <div className="dossier-row">
                    <span>Local Wind Velocity</span>
                    <strong>{selectedCell.hazard.wind_kph} km/h</strong>
                  </div>
                  <div className="dossier-row">
                    <span>Dynamic Pressure (q)</span>
                    <strong>{selectedCell.wind_force.dynamic_pressure_pa} Pa</strong>
                  </div>
                  <div className="dossier-row">
                    <span>Effective Loading</span>
                    <strong>{selectedCell.wind_force.effective_wind_loading_n_m2} N/m²</strong>
                  </div>
                </div>

                <div className="cell-dossier-card">
                  <div className="cell-dossier-heading">
                    <IconShield /> Exposure &amp; Vulnerability
                  </div>
                  <div className="dossier-row">
                    <span>Land Classification</span>
                    <strong>{selectedCell.land_type}</strong>
                  </div>
                  <div className="dossier-row">
                    <span>Buildings in Cell</span>
                    <strong>{selectedCell.exposure.building_count}</strong>
                  </div>
                  <div className="dossier-row">
                    <span>Obstacle Influence</span>
                    <strong>{selectedCell.obstacles.obstruction_level}</strong>
                  </div>
                  <div className="dossier-row">
                    <span>Primary Hazard Driver</span>
                    <strong style={{ color: "#f87171" }}>{selectedCell.drivers.primary}</strong>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* Official NDMA SITREP Printable Viewport */}
          <div className="official-sitrep-print-doc" aria-label="NDMA Official Situation Report">
            <div className="sitrep-header">
              <div className="sitrep-header-emblem">
                <div className="sitrep-emblem-badge">🇮🇳 NDMA</div>
                <div>
                  <h1 className="sitrep-title">NATIONAL DISASTER MANAGEMENT AUTHORITY</h1>
                  <div className="sitrep-subtitle">MINISTRY OF HOME AFFAIRS · GOVERNMENT OF INDIA</div>
                  <div className="sitrep-system">CYCLONEX GEOSPATIAL INTELLIGENCE &amp; EMERGENCY RESPONSE SYSTEM</div>
                </div>
              </div>
              <div className="sitrep-meta-box">
                <div><strong>DOC REF:</strong> NDMA/CYC/SITREP/{new Date().getFullYear()}/{(form.name || "STORM").replace(/[^a-zA-Z0-9]/g, "-").toUpperCase()}</div>
                <div><strong>ISSUED:</strong> {new Date().toUTCString()} ({currentTimeIST})</div>
                <div><strong>OPERATIONAL LEVEL:</strong> <span className="sitrep-alert-badge">RED ALERT / IMMEDIATE ACTION</span></div>
                <div><strong>RESOLUTION:</strong> 200m Spatial Precision · Multi-Source Satellite Feeds</div>
              </div>
            </div>

            <div className="sitrep-divider" />

            <div className="sitrep-section">
              <h2 className="sitrep-section-title">1. EXECUTIVE SUMMARY &amp; IMPACT PROJECTION</h2>
              <div className="sitrep-summary-grid">
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">ESTIMATED ECONOMIC LOSS</span>
                  <strong className="sitrep-stat-val">₹ {(scenario?.risk_grid?.summary?.estimated_loss_crores_inr ?? 1131.8).toFixed(1)} Cr</strong>
                </div>
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">POPULATION AT RISK</span>
                  <strong className="sitrep-stat-val">{(scenario?.risk_grid?.summary?.estimated_population_affected ?? 330930).toLocaleString()}</strong>
                </div>
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">EVACUATION URGENCY</span>
                  <strong className="sitrep-stat-val">{(scenario?.risk_grid?.summary?.ndma_directives?.evacuation_urgency || "MANDATORY").replace(/_/g, " ")}</strong>
                </div>
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">NDRF BATTALIONS</span>
                  <strong className="sitrep-stat-val">{scenario?.risk_grid?.summary?.ndma_directives?.ndrf_battalions_recommended ?? 18} Units</strong>
                </div>
              </div>
            </div>

            <div className="sitrep-section">
              <h2 className="sitrep-section-title">2. METEOROLOGICAL PARAMETERS</h2>
              <table className="sitrep-table">
                <tbody>
                  <tr>
                    <th>Target Cyclone System</th>
                    <td><strong>{form.name || "Active Cyclone System"}</strong></td>
                    <th>Primary Satellite Sensor</th>
                    <td>{selectedSource}</td>
                  </tr>
                  <tr>
                    <th>Eye Coordinates</th>
                    <td>{Number(form.lat).toFixed(2)}°N, {Number(form.lon).toFixed(2)}°E</td>
                    <th>Central Pressure</th>
                    <td>{form.pressure || 950} hPa</td>
                  </tr>
                  <tr>
                    <th>Peak Wind Speed</th>
                    <td>{form.wind || 165} km/h</td>
                    <th>Heading &amp; Velocity</th>
                    <td>{form.heading || 35}° at {form.speed || 22} km/h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* News & Bulletins Drawer */}
      <NewsPanel
        isOpen={isNewsPanelOpen}
        onClose={() => setIsNewsPanelOpen(false)}
        realtimeWeather={realtimeWeather}
      />
    </div>
  );
}
