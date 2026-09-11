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
  Shield,
  BookOpen,
  Radio,
  Search,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Crosshair,
  Zap,
  Compass,
  Users,
  Building2,
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
  tauktae: {
    name: "Cyclone Tauktae (Una / Diu Coast 20.75°N, 71.05°E)",
    lat: "20.75",
    lon: "71.05",
    wind: "185",
    pressure: "950",
    heading: "350",
    speed: "20",
    radius: "35",
    source: "INSAT",
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

  // Minimalist Theme Switcher State (Dark / Light)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("cyclonex_theme");
    return (saved === "light" || saved === "dark") ? saved : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cyclonex_theme", theme);
  }, [theme]);

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
  const [showZones, setShowZones] = useState(false);
  const [showShelters, setShowShelters] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [analysisMode, setAnalysisMode] = useState<MapAnalysisMode>("DAMAGE");
  const [viewDimension, setViewDimension] = useState<"2d" | "real3d" | "globe">("2d");
  const [selectedCell, setSelectedCell] = useState<FullCellAnalysis | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

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
      { name: "Diu / Una Coast, Gujarat", lat: "20.7500", lon: "71.0500", presetKey: "tauktae" },
      { name: "Kakdwip / Sundarbans, WB", lat: "21.8770", lon: "88.1887", presetKey: "amphan" },
    ],
    []
  );

  const filteredLocations = useMemo(() => {
    if (!searchLocationQuery.trim()) return coastalLocations;
    const q = searchLocationQuery.toLowerCase();
    return coastalLocations.filter((loc) => loc.name.toLowerCase().includes(q));
  }, [searchLocationQuery, coastalLocations]);

  const APP_NAV_ITEMS: Array<{
    id: AppPage;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tooltip: string;
  }> = [
    { id: "landing", label: "Overview", icon: Globe, tooltip: "Overview & Mission" },
    { id: "app", label: "Tactical Map", icon: Activity, tooltip: "Tactical Map & 3D Cities" },
    { id: "ai-lab", label: "AI Lab", icon: Brain, tooltip: "AI Satellite & Neural Lab" },
    { id: "forecast", label: "Forecast", icon: TrendingUp, tooltip: "Holland Wind Forecast" },
    { id: "evacuation", label: "Evacuation", icon: Shield, tooltip: "Shelters & Evacuation" },
    { id: "analytics", label: "Analytics", icon: BarChart3, tooltip: "Historical Storm Analytics" },
    { id: "data-sources", label: "Data Sources", icon: Radio, tooltip: "Data Feeds & Telemetry" },
    { id: "docs", label: "Docs", icon: BookOpen, tooltip: "Methodology & NDMA SOPs" },
    { id: "bulletins", label: "Bulletins", icon: Bell, tooltip: "Port Warnings & SITREP" },
  ];

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
      tauktae: "tauktae",
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

  const windNum = Number(form.wind) || 120;
  const stormCategory = useMemo(() => {
    if (windNum >= 222) return { code: "SuCS", name: "Super Cyclonic Storm", tier: "SEVERE RED", color: "#ef4444" };
    if (windNum >= 166) return { code: "ESCS", name: "Extremely Severe Cyclone", tier: "SEVERE RED", color: "#ef4444" };
    if (windNum >= 118) return { code: "VSCS", name: "Very Severe Cyclonic Storm (Cat 3)", tier: "SEVERE RED", color: "#ea580c" };
    if (windNum >= 88) return { code: "SCS", name: "Severe Cyclonic Storm (Cat 2)", tier: "HIGH ORANGE", color: "#f59e0b" };
    if (windNum >= 62) return { code: "CS", name: "Cyclonic Storm (Cat 1)", tier: "ELEVATED AMBER", color: "#eab308" };
    return { code: "DD", name: "Deep Depression", tier: "MODERATE BLUE", color: "#38bdf8" };
  }, [windNum]);

  const estPopulation = useMemo(() => {
    const base = Math.round((windNum / 100) * 195000 + (buildings.length * 48));
    return base > 0 ? base.toLocaleString() : "2,45,618";
  }, [windNum, buildings.length]);

  const estEconomicLossCr = useMemo(() => {
    const loss = ((windNum * windNum * 0.048) + (buildings.length * 0.012)).toFixed(1);
    return loss ? `₹${loss} Cr` : "₹741.6 Cr";
  }, [windNum, buildings.length]);

  const estSurgeHeight = useMemo(() => {
    const surge = Math.max(0.8, (windNum * 0.024) - 0.2).toFixed(1);
    return `+${surge} m`;
  }, [windNum]);

  const activeCellInspection = useMemo(() => {
    if (selectedCell) return selectedCell;
    const firstFeature = scenario?.risk_grid?.features?.[0];
    const props = firstFeature?.properties;
    return {
      cell_id: (firstFeature?.id as string) || "landfall-core",
      lat: props?.lat || Number(form.lat) || 18.35,
      lon: props?.lon || Number(form.lon) || 72.98,
      cyclone_heading_deg: Number(form.heading) || 35,
      relative_direction_deg: 45,
      land_type: props?.land_type || "COASTAL LAND",
      hazard: {
        wind_kph: props?.wind_kph || windNum,
        score: props?.damage_score ?? 0.84,
      },
      wind_force: {
        dynamic_pressure_pa: props?.dynamic_pressure_pa || Math.round(0.613 * Math.pow(windNum / 3.6, 2)),
        drag_coefficient: 1.3,
        shelter_factor: props?.shelter_factor ?? 1.0,
        modeled_wind_loading_n_m2: props?.effective_wind_loading_n_m2 || Math.round(0.613 * Math.pow(windNum / 3.6, 2) * 1.3),
        effective_wind_loading_n_m2: props?.effective_wind_loading_n_m2 || Math.round(0.613 * Math.pow(windNum / 3.6, 2) * 1.3),
      },
      exposure: {
        building_count: props?.building_count || buildings.length || 142,
        building_density: props?.building_density || 0.42,
        avg_building_height_m: props?.avg_building_height_m || 8.5,
        max_building_height_m: props?.max_building_height_m || 18.0,
        taller_building_count: tallerBuildingsCount || 12,
        exposure_score: props?.exposure_score || 0.72,
      },
      obstacles: {
        avg_upwind_height_m: props?.avg_upwind_height_m || 4.2,
        max_upwind_height_m: 9.0,
        obstruction_level: props?.obstruction_level || "LOW_OPEN",
        shelter_factor: props?.shelter_factor || 1.0,
      },
      structure: {
        estimated_class: props?.estimated_class || "RCC / MASONRY",
        vulnerability_score: props?.vulnerability_score || 0.78,
        estimated_resistance_pa: props?.estimated_resistance_pa || 300,
        load_to_resistance_ratio: props?.load_to_resistance_ratio || 1.42,
        data_provenance: {
          building_footprint: props?.building_count ? "OBSERVED (OSM)" : "OBSERVED",
          material: "INFERRED",
          height: "INFERRED",
          resistance_pa: "ASSUMED_SCREENING_VALUE",
          structural_class: "INFERRED",
          modeled: ["local_wind_field", "dynamic_pressure", "effective_wind_loading", "damage_score"],
        },
      },
      damage: {
        hazard_score: props?.damage_score || 0.84,
        exposure_score: props?.exposure_score || 0.72,
        vulnerability_score: props?.vulnerability_score || 0.78,
        structural_response_score: 0.95,
        damage_score: props?.damage_score || 0.84,
        classification: props?.classification || "SEVERE RISK",
        colour: props?.colour || "#ef4444",
        description: props?.description || "Severe damage risk along coastal eyewall corridor.",
      },
      drivers: {
        primary: props?.primary_driver || "HIGH_WIND_HAZARD",
        secondary: props?.secondary_driver || "STRUCTURAL_RESPONSE_LRR",
      },
    } as unknown as FullCellAnalysis;
  }, [selectedCell, scenario, form.lat, form.lon, form.heading, windNum, buildings.length, tallerBuildingsCount]);

  return (
    <div className="saas-shell">
      {/* 58px Persistent Left Rail Navigation across ALL views */}
      <aside className="saas-nav-rail" aria-label="Main Navigation">
        <div className="saas-rail-brand" onClick={() => navigateTo("landing")} title="CYCLONEX">
          <IconVortex />
        </div>
        <nav className="saas-rail-nav">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`saas-rail-item ${isActive ? "active" : ""}`}
                onClick={() => navigateTo(item.id)}
                aria-label={item.label}
              >
                <Icon size={18} />
                <span className="saas-tooltip">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="saas-rail-footer">
          <button
            type="button"
            className="saas-rail-item"
            onClick={() => setIsNewsPanelOpen(true)}
            title="Live Bulletins & Advisories"
          >
            <Bell size={17} />
            <span className="saas-tooltip">Live News</span>
          </button>
        </div>
      </aside>

      {/* Main Viewport & Global SaaS Header */}
      <div className="saas-main-viewport">
        <header className="saas-top-bar">
          <div className="saas-breadcrumb">
            <span className="saas-breadcrumb-item" onClick={() => navigateTo("landing")}>CYCLONEX</span>
            <span className="saas-breadcrumb-separator">/</span>
            <span className="saas-breadcrumb-active">
              {currentView === "landing" ? "Overview" :
               currentView === "app" ? "Tactical Hazard Map" :
               currentView === "ai-lab" ? "AI Satellite Lab" :
               currentView === "forecast" ? "Holland Wind Forecast" :
               currentView === "evacuation" ? "Shelters & Evacuation" :
               currentView === "analytics" ? "Historical Analytics" :
               currentView === "data-sources" ? "Data Feeds & Telemetry" :
               currentView === "docs" ? "Methodology & NDMA SOPs" : "Port Warnings & Bulletins"}
            </span>
            <span className="sih-student-badge" style={{ marginLeft: "12px" }}>
              SIH 2024 · Problem Statement ID: 1736
            </span>
          </div>

          {/* Search Box */}
          <div className="saas-search-box">
            <input
              type="text"
              className="saas-search-input"
              placeholder="Search coastal targets..."
              value={searchLocationQuery}
              onChange={(e) => setSearchLocationQuery(e.target.value)}
              onFocus={() => setIsSearchOpen(true)}
            />
            <span className="saas-search-kbd">⌘K</span>
            {isSearchOpen && filteredLocations.length > 0 && (
              <div className="saas-search-dropdown">
                {filteredLocations.map((loc) => (
                  <div
                    key={loc.name}
                    className="saas-search-item"
                    onClick={() => {
                      void handlePresetChange(loc.presetKey as keyof typeof presets);
                      setSearchLocationQuery("");
                      setIsSearchOpen(false);
                      navigateTo("app");
                    }}
                  >
                    <span>{loc.name}</span>
                    <span className="badge">{loc.presetKey.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Header Meta */}
          <div className="saas-header-meta">
            {/* Minimalist Dark / Light Mode Switcher */}
            <button
              type="button"
              className="saas-theme-toggle"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              title={theme === "dark" ? "Switch to Minimal White Theme" : "Switch to Minimal Dark Theme"}
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>

            <div className="saas-time-pill" title="Live Indian Standard Time">
              {currentTimeIST}
            </div>
            <div className="saas-status-pill" title="Active Sensor Feeds">
              <span className="saas-status-dot" />
              <span>INSAT-3D Online</span>
            </div>
            <button
              type="button"
              className="saas-action-btn primary"
              onClick={() => window.print()}
              title="Export official Situation Report as PDF"
            >
              <IconDownload />
              <span>Export SITREP</span>
            </button>
          </div>
        </header>

        {/* Viewport Content Router */}
        <div className="saas-page-viewport">
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
          onNavigateToCommand={(presetKey, customCoords) => {
            if (customCoords) {
              setForm((prev) => ({
                ...prev,
                lat: String(customCoords.lat),
                lon: String(customCoords.lon),
                wind: String(customCoords.wind),
                pressure: String(customCoords.pressure),
                name: customCoords.name || "Custom Cyclone Scenario",
              }));
              void runFullPipeline(
                String(customCoords.lat),
                String(customCoords.lon),
                String(customCoords.wind),
                String(customCoords.pressure),
                customCoords.name || "Custom Cyclone Scenario",
                form.heading,
                form.speed,
                form.radius
              );
            } else if (presetKey && presetKey in presets) {
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
        <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
          {/* Tactical Map Primary Canvas */}
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {/* Map-First Views: Command Center, Earth, Cyclone Intelligence, Forecast, Risk & Impact */}
            {(activeSection === "command" ||
              activeSection === "earth" ||
              activeSection === "cyclone" ||
              activeSection === "forecast" ||
              activeSection === "risk") && (
              <div className="tactical-console-container">
                {/* Collapsible Left Panel: Mission Controls & Inputs */}
                {viewDimension === "2d" && isLeftPanelOpen && (
                  <aside className="tactical-panel tactical-left-panel" aria-label="Mission Controls">
                    <div className="tactical-panel-header">
                      <div className="tactical-panel-title-wrap">
                        <Sliders size={13} className="tactical-panel-icon" />
                        <div>
                          <div className="tactical-panel-title">SIMULATION INPUTS</div>
                          <div className="tactical-panel-sub">Cyclone Kinematics &amp; IMD Presets</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tactical-collapse-btn"
                        onClick={() => setIsLeftPanelOpen(false)}
                        title="Collapse Controls (Expand Map View)"
                      >
                        <ChevronLeft size={15} />
                      </button>
                    </div>

                    <div className="tactical-panel-body">
                      {/* Active Cyclone Selection */}
                      <div className="tactical-control-group">
                        <label className="tactical-control-label">ACTIVE TROPICAL CYCLONE</label>
                        <select
                          className="tactical-select"
                          value={selectedPreset}
                          onChange={(e) => void handlePresetChange(e.target.value as keyof typeof presets)}
                        >
                          {Object.entries(presets).map(([k, p]) => (
                            <option key={k} value={k}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Meteorological Forcing Inputs */}
                      <div className="tactical-control-group">
                        <label className="tactical-control-label">METEOROLOGICAL PARAMETERS</label>
                        <div className="tactical-input-grid">
                          <div className="tactical-input-box">
                            <span className="tactical-box-label">PEAK WIND</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                className="tactical-box-input"
                                value={form.wind}
                                onChange={(e) => setForm((p) => ({ ...p, wind: e.target.value }))}
                              />
                              <span className="tactical-unit">km/h</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">CENTRAL PRES</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                className="tactical-box-input"
                                value={form.pressure}
                                onChange={(e) => setForm((p) => ({ ...p, pressure: e.target.value }))}
                              />
                              <span className="tactical-unit">hPa</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">EYE LATITUDE</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                step="0.01"
                                className="tactical-box-input"
                                value={form.lat}
                                onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                              />
                              <span className="tactical-unit">°N</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">EYE LONGITUDE</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                step="0.01"
                                className="tactical-box-input"
                                value={form.lon}
                                onChange={(e) => setForm((p) => ({ ...p, lon: e.target.value }))}
                              />
                              <span className="tactical-unit">°E</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">HEADING</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                className="tactical-box-input"
                                value={form.heading}
                                onChange={(e) => setForm((p) => ({ ...p, heading: e.target.value }))}
                              />
                              <span className="tactical-unit">°</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">FWD SPEED</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                className="tactical-box-input"
                                value={form.speed}
                                onChange={(e) => setForm((p) => ({ ...p, speed: e.target.value }))}
                              />
                              <span className="tactical-unit">km/h</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="tactical-recalc-btn"
                          disabled={loading}
                          onClick={() => {
                            void runFullPipeline(
                              form.lat,
                              form.lon,
                              form.wind,
                              form.pressure,
                              presets[selectedPreset]?.name || form.name,
                              form.heading,
                              form.speed,
                              form.radius
                            );
                          }}
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="spin" size={13} />
                              <span>Simulating Hydrodynamics...</span>
                            </>
                          ) : (
                            <>
                              <Zap size={13} />
                              <span>Update Hazard Screening</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Analytical Hazard Modes */}
                      <div className="tactical-control-group">
                        <label className="tactical-control-label">ANALYTICAL HAZARD MODE</label>
                        <div className="tactical-modes-grid">
                          {(["DAMAGE", "WIND", "EXPOSURE", "OBSTACLES", "HIT"] as MapAnalysisMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={`tactical-mode-btn ${analysisMode === mode ? "active" : ""}`}
                              onClick={() => setAnalysisMode(mode)}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Active Geospatial Layers */}
                      <div className="tactical-control-group">
                        <label className="tactical-control-label">GEOSPATIAL LAYERS &amp; DEFENSES</label>
                        <div className="tactical-layer-list">
                          <label className="tactical-layer-item">
                            <input
                              type="checkbox"
                              checked={showShelters}
                              onChange={(e) => setShowShelters(e.target.checked)}
                            />
                            <span>Cyclone Shelters (MPCS Network)</span>
                          </label>
                          <label className="tactical-layer-item">
                            <input
                              type="checkbox"
                              checked={showZones}
                              onChange={(e) => setShowZones(e.target.checked)}
                            />
                            <span>Land-Use Zones (36 Ward Sectors)</span>
                          </label>
                          <label className="tactical-layer-item">
                            <input
                              type="checkbox"
                              checked={layers.advanced.physicsGrid}
                              onChange={(e) => setLayers((prev) => ({ ...prev, advanced: { ...prev.advanced, physicsGrid: e.target.checked } }))}
                            />
                            <span>200m Physics Mesh &amp; Risk Grid</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </aside>
                )}

                {/* Center Map Viewport Canvas */}
                <div className="tactical-center-viewport">
                  {/* Floating Restore Toggles when panels are collapsed */}
                  {viewDimension === "2d" && !isLeftPanelOpen && (
                    <button
                      type="button"
                      className="tactical-panel-restore-btn left"
                      onClick={() => setIsLeftPanelOpen(true)}
                      title="Expand Mission Controls"
                    >
                      <Sliders size={13} />
                      <span>Controls</span>
                    </button>
                  )}

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
                    theme={theme}
                  />

                  {viewDimension === "2d" && !isRightPanelOpen && (
                    <button
                      type="button"
                      className="tactical-panel-restore-btn right"
                      onClick={() => setIsRightPanelOpen(true)}
                      title="Expand Live Output Dossier"
                    >
                      <Activity size={13} />
                      <span>Outputs</span>
                    </button>
                  )}

                  {/* Fixed Bottom Operational Intelligence Strip (only in 2D mode) */}
                  {viewDimension === "2d" && (
                    <div className="op-temporal-strip">
                      <div className="op-telemetry-live-status">
                        <span className="live-status-dot" />
                        <span className="live-status-title">INSAT-3DR / DWR RADAR STREAM</span>
                        <span className="live-status-sub">TIR-1 · 15-MIN CYCLE</span>
                      </div>

                      <div className="op-loss-telemetry">
                        <div className="op-loss-stat">
                          <span>RISK TIER:</span>
                          <strong className="red">
                            {summaryStats?.max_risk_score && summaryStats.max_risk_score >= 0.55 ? "SEVERE RED" : "HIGH ORANGE"}
                          </strong>
                        </div>
                        <div className="op-loss-stat">
                          <span>AFFECTED:</span>
                          <strong>{totalCells > 0 ? totalCells.toLocaleString() : "1,976"} SECTORS</strong>
                        </div>
                        <div className="op-loss-stat">
                          <span>POPULATION:</span>
                          <strong>{estPopulation}</strong>
                        </div>
                        <div className="op-loss-stat">
                          <span>EST. LOSS:</span>
                          <strong className="amber">{estEconomicLossCr}</strong>
                        </div>
                        <div className="op-loss-stat">
                          <span>NDMA DIRECTIVE:</span>
                          <strong className="red">MANDATORY IMMEDIATE</strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginLeft: "12px" }}>
                        <button
                          type="button"
                          className="saas-action-btn"
                          onClick={() => navigateTo("bulletins")}
                          title="Port Warnings & Civil Advisory Bulletins"
                        >
                          <Bell size={12} />
                          <span>Port Warnings</span>
                        </button>
                        <button
                          type="button"
                          className="saas-action-btn"
                          onClick={() => navigateTo("analytics")}
                          title="Comprehensive Validation Matrix & Provenance"
                        >
                          <BarChart3 size={12} />
                          <span>Validation</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Collapsible Right Panel: Live Outputs & Dossier */}
                {viewDimension === "2d" && isRightPanelOpen && (
                  <aside className="tactical-panel tactical-right-panel" aria-label="Output Dossier">
                    <div className="tactical-panel-header">
                      <div className="tactical-panel-title-wrap">
                        <Activity size={13} className="tactical-panel-icon" />
                        <div>
                          <div className="tactical-panel-title">HAZARD SIMULATION DOSSIER</div>
                          <div className="tactical-panel-sub">
                            Mode: <strong style={{ color: "#38bdf8" }}>{analysisMode}</strong> &middot; Multi-Sensor Spatial Output
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="tactical-collapse-btn"
                        onClick={() => setIsRightPanelOpen(false)}
                        title="Collapse Output Dossier"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    <div className="tactical-panel-body">
                      {/* Storm Threat Card */}
                      <div className="tactical-threat-card">
                        <div className="threat-header">
                          <span className="threat-badge red">
                            <span className="threat-pulse-dot" />
                            {stormCategory.tier}
                          </span>
                          <span className="threat-code">{stormCategory.code}</span>
                        </div>
                        <div className="threat-title">{stormCategory.name}</div>
                        <div className="threat-meta">
                          Landfall Target: <strong>{presets[selectedPreset]?.name.split("(")[0].trim() || form.name} Coast</strong>
                        </div>
                      </div>

                      {/* Dynamic Output Cards based on Active Analysis Mode */}
                      {analysisMode === "WIND" ? (
                        <>
                          <div className="tactical-kpi-grid">
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">SUSTAINED WIND</span>
                              <strong className="kpi-val red">{form.wind || 180} km/h</strong>
                              <span className="kpi-sub">10-Min Mean Velocity</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">PEAK 3-SEC GUST</span>
                              <strong className="kpi-val amber">{Math.round(Number(form.wind || 180) * 1.35)} km/h</strong>
                              <span className="kpi-sub">Gust Factor G = 1.35</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">DYNAMIC PRESSURE</span>
                              <strong className="kpi-val cyan">{Math.round(0.613 * Math.pow(Number(form.wind || 180) / 3.6, 2))} N/m²</strong>
                              <span className="kpi-sub">Aerodynamic Stagnation (q)</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">EYE RADIUS (RMAX)</span>
                              <strong className="kpi-val amber">{Math.round(Number(form.radius || 30) * 0.85)} km</strong>
                              <span className="kpi-sub">Zone of Maximum Hazard</span>
                            </div>
                          </div>

                          <div className="tactical-dossier-card">
                            <div className="dossier-header">
                              <div className="dossier-tag">
                                <Compass size={12} />
                                <span>WIND KINEMATICS · IS 875 (PART 3)</span>
                              </div>
                              <span className="dossier-coords">{activeCellInspection?.lat?.toFixed(2)}°N, {activeCellInspection?.lon?.toFixed(2)}°E</span>
                            </div>
                            <div className="dossier-rows">
                              <div className="dossier-row">
                                <span>Velocity Profile Law</span>
                                <strong>Modified Rankine Vortex</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Dynamic Pressure q</span>
                                <strong>{activeCellInspection?.wind_force?.dynamic_pressure_pa ?? 1640} Pa</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Terrain Factor k2 (IS 875)</span>
                                <strong>1.05 (Category 1 Coastal Plain)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Cyclonic Factor k4</span>
                                <strong>1.15 (High-Consequence Structure)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Inflow Spiral Angle</span>
                                <strong>22° Counter-Clockwise Inward</strong>
                              </div>
                            </div>
                          </div>

                          <div className="tactical-directive-card">
                            <div className="directive-tag">
                              <AlertTriangle size={12} />
                              <span>IMD METEOROLOGICAL ADVISORY</span>
                            </div>
                            <div className="directive-title">DESTRUCTIVE CYCLONIC GALE WARNING</div>
                            <p className="directive-desc">
                              Core winds exceed 150 km/h with 3-second microburst gusts. Suspend all coastal port operations, crane hoists, and civilian transit across sea-facing causeways.
                            </p>
                          </div>
                        </>
                      ) : analysisMode === "EXPOSURE" ? (
                        <>
                          <div className="tactical-kpi-grid">
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">EXPOSED POPULATION</span>
                              <strong className="kpi-val red">{estPopulation}</strong>
                              <span className="kpi-sub">Within Gale Danger Perimeter</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">CRITICAL FACILITIES</span>
                              <strong className="kpi-val amber">14 Assets</strong>
                              <span className="kpi-sub">Hospitals, Substations, Schools</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">URBAN DENSITY TIER</span>
                              <strong className="kpi-val cyan">
                                {activeCellInspection?.exposure?.building_density
                                  ? activeCellInspection.exposure.building_density > 0.6
                                    ? "HIGH URBAN"
                                    : activeCellInspection.exposure.building_density > 0.3
                                    ? "MEDIUM URBAN"
                                    : "LOW DENSITY"
                                  : "HIGH URBAN"}
                              </strong>
                              <span className="kpi-sub">Parcel Built-up Fraction</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">SURGE INUNDATION REACH</span>
                              <strong className="kpi-val red">{estSurgeHeight}</strong>
                              <span className="kpi-sub">Tidal Crest Above MHW</span>
                            </div>
                          </div>

                          <div className="tactical-dossier-card">
                            <div className="dossier-header">
                              <div className="dossier-tag">
                                <Users size={12} />
                                <span>SOCIO-ECONOMIC EXPOSURE MATRIX</span>
                              </div>
                              <span className="dossier-coords">{activeCellInspection?.lat?.toFixed(2)}°N, {activeCellInspection?.lon?.toFixed(2)}°E</span>
                            </div>
                            <div className="dossier-rows">
                              <div className="dossier-row">
                                <span>Vulnerability Index</span>
                                <strong className="red">Level 4 (Severe Coastal Exposure)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Settlement Classification</span>
                                <strong>Fishermen Settlements &amp; Masonry</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Power Grid Vulnerability</span>
                                <strong className="amber">Substation within 2.8 km (Dyke Protected)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Telecom Towers at Risk</span>
                                <strong>6 Base Transceiver Stations (BTS)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Designated Haven</span>
                                <strong className="green">MPCS Coastal Refuge (Capacity 2,500)</strong>
                              </div>
                            </div>
                          </div>

                          <div className="tactical-directive-card">
                            <div className="directive-tag">
                              <AlertTriangle size={12} />
                              <span>CIVIL PROTECTION DIRECTIVE</span>
                            </div>
                            <div className="directive-title">PRIORITY CIVILIAN RELOCATION</div>
                            <p className="directive-desc">
                              Mandatory evacuation for households residing in unreinforced masonry or tin-roofed dwellings within 3 km of the active shoreline.
                            </p>
                          </div>
                        </>
                      ) : analysisMode === "OBSTACLES" ? (
                        <>
                          <div className="tactical-kpi-grid">
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">TERRAIN ROUGHNESS</span>
                              <strong className="kpi-val cyan">Category 1</strong>
                              <span className="kpi-sub">IS 875 Open Sea / Plain</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">UPWIND SHELTERING</span>
                              <strong className="kpi-val green">Factor {activeCellInspection?.obstacles?.shelter_factor ?? 0.88}</strong>
                              <span className="kpi-sub">Obstacle Shading Factor</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">DRAG COEFFICIENT Cd</span>
                              <strong className="kpi-val amber">1.30</strong>
                              <span className="kpi-sub">Sharp-Edged Coastal Parcel</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">WAVE ATTENUATION</span>
                              <strong className="kpi-val green">78% Damping</strong>
                              <span className="kpi-sub">Mangrove Bioshield Belt</span>
                            </div>
                          </div>

                          <div className="tactical-dossier-card">
                            <div className="dossier-header">
                              <div className="dossier-tag">
                                <Shield size={12} />
                                <span>AERODYNAMIC BOUNDARY LAYER OBSTACLES</span>
                              </div>
                              <span className="dossier-coords">{activeCellInspection?.lat?.toFixed(2)}°N, {activeCellInspection?.lon?.toFixed(2)}°E</span>
                            </div>
                            <div className="dossier-rows">
                                <div className="dossier-row">
                                  <span>Upwind Obstruction Level</span>
                                  <strong>{activeCellInspection?.obstacles?.obstruction_level || "MODERATE_SHELTER"}</strong>
                                </div>
                              <div className="dossier-row">
                                <span>Effective Pressure Law</span>
                                <strong>q_eff = q_ambient &times; (Shelter_Factor)&sup2;</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Natural Bioshield Buffer</span>
                                <strong className="green">Active Mangrove Stand (Avicennia / Rhizophora)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Engineered Seawall</span>
                                <strong className="cyan">Tetrapod Revetment (Surge Limit 4.5m)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Wind Speed Reduction</span>
                                <strong>-14 km/h reduction behind dense canopy</strong>
                              </div>
                            </div>
                          </div>

                          <div className="tactical-directive-card">
                            <div className="directive-tag">
                              <AlertTriangle size={12} />
                              <span>ECOLOGICAL DEFENSE NOTICE</span>
                            </div>
                            <div className="directive-title">PRESERVE NATURAL DEFENSE BUFFERS</div>
                            <p className="directive-desc">
                              Mangrove bioshields and sand dune buffers dissipate over 75% of incoming wave surge energy. Fortify breach points with geosynthetic sandbags.
                            </p>
                          </div>
                        </>
                      ) : analysisMode === "HIT" ? (
                        <>
                          <div className="tactical-kpi-grid">
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">LANDFALL HIT ZONE</span>
                              <strong className="kpi-val red">DIRECT IMPACT</strong>
                              <span className="kpi-sub">Eyewall Transits Coastline</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">FLYING MISSILE RISK</span>
                              <strong className="kpi-val amber">38 - 52 m/s</strong>
                              <span className="kpi-sub">Windborne Debris Velocity</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">ROOF UPLIFT SUCTION</span>
                              <strong className="kpi-val red">2.4 kPa</strong>
                              <span className="kpi-sub">Bernoulli Peak Uplift (-&Delta;P)</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">BUFFER CLEARANCE</span>
                              <strong className="kpi-val cyan">25 Meters</strong>
                              <span className="kpi-sub">Minimum Hazard Perimeter</span>
                            </div>
                          </div>

                          <div className="tactical-dossier-card">
                            <div className="dossier-header">
                              <div className="dossier-tag">
                                <Crosshair size={12} />
                                <span>PROJECTILE TRAJECTORY &amp; IMPACT PHYSICS</span>
                              </div>
                              <span className="dossier-coords">{activeCellInspection?.lat?.toFixed(2)}°N, {activeCellInspection?.lon?.toFixed(2)}°E</span>
                            </div>
                            <div className="dossier-rows">
                              <div className="dossier-row">
                                <span>Primary Missile Threat</span>
                                <strong className="red">Corrugated Galvanized Iron (CGI) Sheets</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Cladding Failure Threshold</span>
                                <strong>Exceeded at wind velocities &gt; 135 km/h</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Bernoulli Pressure Equation</span>
                                <strong>-&Delta;P = 0.5 &times; &rho; &times; V&sup2; &times; (Cpe - Cpi)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Tree Uprooting Risk</span>
                                <strong className="amber">82% (Shallow-rooted trees)</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Dynamic Wall Impact</span>
                                <strong>Up to 4.2 kN dynamic impact on masonry</strong>
                              </div>
                            </div>
                          </div>

                          <div className="tactical-directive-card">
                            <div className="directive-tag">
                              <AlertTriangle size={12} />
                              <span>NDMA LIFE SAFETY ADVISORY</span>
                            </div>
                            <div className="directive-title">TOTAL INDOORS LOCKDOWN</div>
                            <p className="directive-desc">
                              Flying debris and detached tin sheets pose fatal ballistic hazards. Evacuees must remain sealed inside reinforced concrete MPCS shelters away from glass windows.
                            </p>
                          </div>
                        </>
                      ) : (
                        /* Default: DAMAGE Mode */
                        <>
                          <div className="tactical-kpi-grid">
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">EST. ECONOMIC LOSS</span>
                              <strong className="kpi-val amber">{estEconomicLossCr}</strong>
                              <span className="kpi-sub">Direct Asset Damage</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">MAX DAMAGE RISK</span>
                              <strong className="kpi-val red">{Math.round((activeCellInspection?.damage?.hazard_score || 0.84) * 100)}%</strong>
                              <span className="kpi-sub">Eyewall Landfall Corridor</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">AFFECTED POPULATION</span>
                              <strong className="kpi-val cyan">{estPopulation}</strong>
                              <span className="kpi-sub">Within Gale Danger Perimeter</span>
                            </div>
                            <div className="tactical-kpi-card">
                              <span className="kpi-label">EST. STORM SURGE</span>
                              <strong className="kpi-val cyan">{estSurgeHeight}</strong>
                              <span className="kpi-sub">Hydrodynamic Surge Peak</span>
                            </div>
                          </div>

                          <div className="tactical-dossier-card">
                            <div className="dossier-header">
                              <div className="dossier-tag">
                                <Building2 size={12} />
                                <span>STRUCTURAL RESISTANCE &amp; LOSS RATIO (LRR)</span>
                              </div>
                              <span className="dossier-coords">{activeCellInspection?.lat?.toFixed(2)}°N, {activeCellInspection?.lon?.toFixed(2)}°E</span>
                            </div>
                            <div className="dossier-rows">
                              <div className="dossier-row">
                                <span>Terrain Class</span>
                                <strong>{activeCellInspection?.land_type || "COASTAL_URBAN"}</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Wind Dynamic Pressure</span>
                                <strong>{activeCellInspection?.wind_force?.dynamic_pressure_pa || 1640} Pa</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Modeled Wind Loading</span>
                                <strong>{activeCellInspection?.wind_force?.modeled_wind_loading_n_m2 || 2132} N/m²</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Load-to-Resistance (LRR)</span>
                                <strong className="amber">{activeCellInspection?.structure?.load_to_resistance_ratio || "1.42"}</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Governing Failure Mode</span>
                                <strong className="red">Roof Cladding Suction &amp; Shear</strong>
                              </div>
                              <div className="dossier-row">
                                <span>Damage Equation</span>
                                <strong>LRR = (q &times; Cd &times; Shelter_Factor) / R_design</strong>
                              </div>
                            </div>
                          </div>

                          <div className="tactical-directive-card">
                            <div className="directive-tag">
                              <AlertTriangle size={12} />
                              <span>NDMA DIRECTIVE</span>
                            </div>
                            <div className="directive-title">MANDATORY IMMEDIATE EVACUATION</div>
                            <p className="directive-desc">
                              Activate cyclone shelters and initiate priority evacuation for vulnerable coastal settlements within 25 km of landfall.
                            </p>
                          </div>
                        </>
                      )}

                      {/* Student Project & Research Provenance Card */}
                      <div className="student-project-card">
                        <div className="student-project-header">
                          <span className="student-badge">SIH 2024 · Problem Statement ID: 1736</span>
                          <span className="student-team">Engineering Student Project</span>
                        </div>
                        <div className="student-project-title">
                          CYCLONEX · AI Multi-Source Satellite &amp; Physics Hazard System
                        </div>
                        <div className="student-project-meta">
                          <div><strong>AI Models:</strong> 4x PyTorch CNNs (Detection, Pattern, RI, Intensity)</div>
                          <div><strong>Wind Physics:</strong> Rankine Vortex + IS 875 (Part 3) Wind Loading Code</div>
                          <div><strong>Satellite Streams:</strong> INSAT-3DR TIR-1 / ScatSat / HURSAT-B1</div>
                        </div>
                      </div>

                      <div className="tactical-quick-actions">
                        <button type="button" className="tactical-action-btn primary" onClick={() => window.print()}>
                          <FileText size={12} />
                          <span>Export Official SITREP (PDF)</span>
                        </button>
                        <button type="button" className="tactical-action-btn" onClick={() => navigateTo("ai-lab")}>
                          <Brain size={12} />
                          <span>Launch AI Satellite Lab &rarr;</span>
                        </button>
                        <button type="button" className="tactical-action-btn" onClick={() => navigateTo("evacuation")}>
                          <Shield size={12} />
                          <span>View Evacuation Plan &rarr;</span>
                        </button>
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            )}

            {/* 4. Satellite Lab Workspace */}
            {activeSection === "satellite" && (
              <div className="workspace-view-container">
                <div className="workspace-nav-header">
                  <button
                    type="button"
                    className="btn-back-to-map"
                    onClick={() => handleSelectSection("command")}
                  >
                    <Activity size={13} />
                    <span>&larr; Return to Tactical Map Console</span>
                  </button>
                  <span className="workspace-view-title">SATELLITE &amp; SENSOR LAB WORKSPACE</span>
                </div>
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
                <div className="workspace-nav-header">
                  <button
                    type="button"
                    className="btn-back-to-map"
                    onClick={() => handleSelectSection("command")}
                  >
                    <Activity size={13} />
                    <span>&larr; Return to Tactical Map Console</span>
                  </button>
                  <span className="workspace-view-title">AI NEURAL ANALYSIS WORKSPACE</span>
                </div>
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
                <div className="workspace-nav-header">
                  <button
                    type="button"
                    className="btn-back-to-map"
                    onClick={() => handleSelectSection("command")}
                  >
                    <Activity size={13} />
                    <span>&larr; Return to Tactical Map Console</span>
                  </button>
                  <span className="workspace-view-title">HISTORICAL BENCHMARKS WORKSPACE</span>
                </div>
                <HistoricalAnalyticsWorkspace
                  datasetSummary={datasetSummary}
                  onLoadPreset={(key) => void handlePresetChange(key)}
                />
              </div>
            )}

            {/* 9. Alerts & Operations Workspace */}
            {activeSection === "alerts" && (
              <div className="workspace-view-container">
                <div className="workspace-nav-header">
                  <button
                    type="button"
                    className="btn-back-to-map"
                    onClick={() => handleSelectSection("command")}
                  >
                    <Activity size={13} />
                    <span>&larr; Return to Tactical Map Console</span>
                  </button>
                  <span className="workspace-view-title">ALERTS &amp; OPERATIONS WORKSPACE</span>
                </div>
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
                <div className="workspace-nav-header">
                  <button
                    type="button"
                    className="btn-back-to-map"
                    onClick={() => handleSelectSection("command")}
                  >
                    <Activity size={13} />
                    <span>&larr; Return to Tactical Map Console</span>
                  </button>
                  <span className="workspace-view-title">DATA SOURCES &amp; TELEMETRY WORKSPACE</span>
                </div>
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
              if (sec === "ai") navigateTo("ai-lab");
              else if (sec === "forecast") navigateTo("forecast");
              else if (sec === "risk") navigateTo("evacuation");
              else handleSelectSection(sec);
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
        </div>
      </div>

      {/* News & Bulletins Drawer */}
      <NewsPanel
        isOpen={isNewsPanelOpen}
        onClose={() => setIsNewsPanelOpen(false)}
        realtimeWeather={realtimeWeather}
      />
    </div>
  );
}
