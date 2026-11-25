import type { AICycloneAnalysisRequest } from "./api";
import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import LandingPage from "./LandingPage";
import AILabPage from "./pages/AILabPage";
import ForecastPage from "./pages/ForecastPage";
import RiskEvacuationPage from "./pages/RiskEvacuationPage";
import HistoricalAnalyticsPage from "./pages/HistoricalAnalyticsPage";
import DataSourcesPage from "./pages/DataSourcesPage";
import DocumentationPage from "./pages/DocumentationPage";
import BulletinsPage from "./pages/BulletinsPage";
import ResilienceForecasterPage from "./pages/ResilienceForecasterPage";
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
import SatelliteLab from "./components/SatelliteLab";
import ContextualCyclonePanel from "./components/ContextualCyclonePanel";
import GlobalLayersMenu, { type LayerState } from "./components/GlobalLayersMenu";
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
  ShieldAlert,
  Sparkles,
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
  | "bulletins"
  | "resilience";

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
  if (hash === "resilience" || hash === "infrastructure" || hash === "challenge05") return "resilience";
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

export default function App() {
  const [currentView, setCurrentView] = useState<AppPage>(() => getPageFromHash());

  // Primary Theme State (Default: light)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("cyclonex_theme");
    return saved === "dark" ? "dark" : "light";
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
  const [draft, setDraft] = useState(presets.nisarga);
  const searchInput = useRef<HTMLInputElement>(null);
  const [mlResult, setMlResult] = useState<MLInferenceResult | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<DatasetSummary | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<6 | 12 | 24>(24);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // News Panel & Real-time Weather Sync state
  const [isNewsPanelOpen, setIsNewsPanelOpen] = useState(false);
  const [realtimeWeather, setRealtimeWeather] = useState<RealtimeWeather | null>(null);
  useEffect(() => {
    let active = true;
    setRealtimeWeather(null);
    if (isNewsPanelOpen) {
      void fetchRealtimeWeather(Number(form.lat), Number(form.lon)).then(value => {
        if (active) setRealtimeWeather(value);
      });
    }
    return () => { active = false; };
  }, [isNewsPanelOpen, form.lat, form.lon]);

  const pipelineRequest = useRef(0);
  const aiRequest = useRef(0);
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
    { id: "resilience", label: "Resilience", icon: ShieldAlert, tooltip: "Challenge 05: Infrastructure Vulnerability & GEE" },
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
    const destination = { ai: "ai-lab", analytics: "analytics", alerts: "bulletins", settings: "data-sources" } as const;
    if (section === "ai" || section === "analytics" || section === "alerts" || section === "settings") {
      navigateTo(destination[section]);
      return;
    }
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsNewsPanelOpen(false);
      }
      if (currentView !== "app" || e.ctrlKey || e.metaKey || e.altKey) return;
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
  }, [viewDimension, currentView]);

  // AI Cyclone Analysis State
  const [showAiLayer, setShowAiLayer] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<AICycloneAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function handleRunAiAnalysis(latNum?: number, lonNum?: number, windNum?: number, presNum?: number, satelliteImages?: AICycloneAnalysisRequest["satellite_images"], motion = { heading: Number(form.heading), speed: Number(form.speed) }) {
    const requestId = ++aiRequest.current;
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const res = await analyzeAICyclone({
        satellite_images: satelliteImages,
        heading: motion.heading,
        speed: motion.speed,
        latitude: latNum ?? Number(form.lat),
        longitude: lonNum ?? Number(form.lon),
        wind_speed: windNum ?? Number(form.wind),
        pressure: presNum ?? Number(form.pressure),
      });
      if (requestId === aiRequest.current) setAiAnalysis(res);
    } catch (e) {
      if (requestId !== aiRequest.current) return;
      setAiAnalysis(null);
      setError(e instanceof Error ? e.message : "AI analysis unavailable");
    } finally {
      if (requestId === aiRequest.current) setAiLoading(false);
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
    radiusStr: string = "30",
    detail200m: boolean = false
  ) {
    const fields = [
      [latStr, -90, 90, "Latitude"], [lonStr, -180, 180, "Longitude"],
      [windStr, 0, 400, "Wind speed"], [pressureStr, 800, 1050, "Central pressure"],
      [headingStr, 0, 360, "Heading"], [speedStr, 0, 120, "Forward speed"],
      [radiusStr, 0.2, 500, "Grid radius"],
    ] as const;
    for (const [value, low, high, label] of fields) {
      if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < low || Number(value) > high) {
        setError(`${label} must be between ${low} and ${high}.`);
        return;
      }
    }
    const requestId = ++pipelineRequest.current;
    setLoading(true);
    setError("");
    setScenario(null);
    setMlResult(null);
    setBuildings([]);
    setZones([]);
    setSheltersPlan(null);
    setSelectedCell(null);
    const inputs = { name: scenarioName, lat: latStr, lon: lonStr, wind: windStr, pressure: pressureStr, heading: headingStr, speed: speedStr };
    setForm(prev => ({ ...prev, ...inputs, radius: detail200m ? prev.radius : radiusStr }));
    setDraft(prev => ({ ...prev, ...inputs }));
    const [lat, lon, wind, pressure, heading, speed, radius] = fields.map(([value]) => Number(value));
    void runMLInference({
      centre_lat: lat, centre_lon: lon, max_sustained_wind_kph: wind,
      central_pressure_hpa: pressure, heading_deg: heading, speed_kph: speed,
    }).then(result => {
      if (requestId === pipelineRequest.current) setMlResult(result);
    }).catch(reason => {
      if (requestId === pipelineRequest.current) setError(reason instanceof Error ? reason.message : "Forecast unavailable.");
    });
    void handleRunAiAnalysis(lat, lon, wind, pressure, undefined, { heading, speed });
    try {
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
        grid_resolution_m: detail200m ? 200 : undefined,
      });
      if (requestId !== pipelineRequest.current) return;
      setScenario(scn);
      setBuildings([]);
      setZones([]);
      setSheltersPlan(null);

      void Promise.all([

        fetchBuildings(scn.id).then(value => { if (requestId === pipelineRequest.current) setBuildings(value); }),
        fetchZones(scn.id).then(value => { if (requestId === pipelineRequest.current) setZones(value); }),
        fetchSheltersAndEvacuation(scn.id).then(value => { if (requestId === pipelineRequest.current) setSheltersPlan(value); }),
      ]).catch((err) => console.error("Error fetching grid or contextual layers:", err));
    } catch (reason) {
      if (requestId !== pipelineRequest.current) return;
      setError(reason instanceof Error ? reason.message : "Run failed.");
    } finally {
      if (requestId === pipelineRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    void fetchDatasetSummary().then(setDatasetSummary);
    const initialRun = window.setTimeout(() => void runFullPipeline(
      presets.nisarga.lat,
      presets.nisarga.lon,
      presets.nisarga.wind,
      presets.nisarga.pressure,
      presets.nisarga.name,
      presets.nisarga.heading,
      presets.nisarga.speed,
      presets.nisarga.radius
    ), 0);
    return () => window.clearTimeout(initialRun);
  }, []);

  async function handlePresetChange(rawKey: string, location?: { name: string; lat: string; lon: string }) {
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
    const preset = presets[presetKey];
    if (!preset) return;
    const p = location ? { ...preset, name: location.name, lat: location.lat, lon: location.lon } : preset;
    setSelectedPreset(presetKey);
    setDraft(p);
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
    ++pipelineRequest.current;
    ++aiRequest.current;
    setForm(presets.custom);
    setDraft(presets.custom);
    setAiAnalysis(null);
    setLoading(false);
    setAiLoading(false);
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
    document.querySelector(".saas-page-viewport")?.scrollTo(0, 0);
  }

  function handleLaunchConsole(presetKey?: string) {
    if (presetKey && presetKey in presets) {
      void handlePresetChange(presetKey as keyof typeof presets);
    }
    navigateTo("app");
  }

  const mapCenter = useMemo(() => {
    return {
      lat: Number(form.lat),
      lng: Number(form.lon),
    };
  }, [form.lat, form.lon]);

  const trajectoryPoints = useMemo(() => {
    if (!mlResult) return [];
    return ([6, 12, 24] as const).map(hours => {
      const point = mlResult[`forecast_${hours}h`];
      return { lat: point.centre_lat, lng: point.centre_lon, label: `+${hours}h forecast`, uncertaintyKm: point.track_uncertainty_km };
    });
  }, [mlResult]);

  const summaryStats = scenario?.risk_grid?.summary;
  const totalCells = scenario?.risk_grid?.features?.length || 0;
  const tallerBuildingsCount = buildings.filter((b) => b.properties.is_locally_taller).length;

  const currentForecast = mlResult ? mlResult[`forecast_${selectedHorizon}h`] : null;

  const devPanelStats = useMemo(() => {
    if (!showDevPanel) return null;
    const features = scenario?.risk_grid?.features ?? [];
    if (features.length === 0) return null;
    const scores = features.map((f) => f.properties?.damage_score ?? 0);
    const coords = features.flatMap(({geometry}) => geometry.type === "MultiPolygon" ? geometry.coordinates.flat(2) : geometry.coordinates.flat());
    const allLats = coords.map(c => c[1]);
    const allLons = coords.map(c => c[0]);
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
      mlModelStatus: mlResult?.model_provenance?.model_status ?? "Unavailable",
      mlValidation: mlResult?.model_provenance?.validation_status ?? "Unavailable",
    };
  }, [showDevPanel, scenario, mlResult]);

  const windNum = Number(form.wind);
  const stormCategory = useMemo(() => {
    if (windNum >= 222) return { code: "SuCS", name: "Super Cyclonic Storm", tier: "SEVERE RED", color: "#ef4444" };
    if (windNum >= 166) return { code: "ESCS", name: "Extremely Severe Cyclone", tier: "SEVERE RED", color: "#ef4444" };
    if (windNum >= 118) return { code: "VSCS", name: "Very Severe Cyclonic Storm ", tier: "SEVERE RED", color: "#ea580c" };
    if (windNum >= 88) return { code: "SCS", name: "Severe Cyclonic Storm ", tier: "HIGH ORANGE", color: "#f59e0b" };
    if (windNum >= 62) return { code: "CS", name: "Cyclonic Storm ", tier: "ELEVATED AMBER", color: "#eab308" };
    if (windNum >= 50) return { code: "DD", name: "Deep Depression", tier: "DEPRESSION", color: "#8b5cf6" };
    if (windNum >= 31) return { code: "D", name: "Depression", tier: "DEPRESSION", color: "#8b5cf6" };
    return { code: "L", name: "Low pressure scenario", tier: "LOW WIND", color: "#8b5cf6" };
  }, [windNum]);

  const estPopulation = summaryStats?.estimated_population_affected != null
    ? `${summaryStats.estimated_population_affected.toLocaleString()} (screening estimate)` : "Unavailable";
  const estEconomicLossCr = summaryStats?.estimated_loss_crores_inr != null
    ? `₹${summaryStats.estimated_loss_crores_inr.toFixed(1)} Cr (screening estimate)` : "Unavailable";
  const estSurgeHeight = scenario?.input ? `+${scenario.input.storm_surge_m ?? 0} m (scenario input)` : "Unavailable";
  const gridResolution = scenario?.risk_grid.metadata?.grid_size_m;
  const resolutionLabel = gridResolution ? `${gridResolution} m ${gridResolution === 200 ? "detail" : "overview"} grid` : "Risk grid (not loaded)";

  function printScreeningReport() {
    if (!scenario) { setError("Run a scenario before printing its report."); return; }
    navigateTo("app");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  }

  const activeCellInspection = selectedCell ?? scenario?.risk_grid.features[0]?.properties.full_cell_analysis ?? null;

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
               currentView === "docs" ? "Methodology & NDMA SOPs" :
               currentView === "resilience" ? "Track-Based Infrastructure Vulnerability Forecaster (Challenge 05)" : "Port Warnings & Bulletins"}
            </span>
          </div>

          {/* Search Box */}
          <div className="saas-search-box">
            <input
              type="text"
              className="saas-search-input"
              ref={searchInput}
              aria-label="Search coastal targets"
              onBlur={() => setIsSearchOpen(false)}
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
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => {
                      void handlePresetChange(loc.presetKey, loc);
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
            <button
              type="button"
              className="saas-action-btn primary"
              onClick={printScreeningReport}
              title="Print scenario screening report; choose Save as PDF in your browser"
            >
              <IconDownload />
              <span>Print screening report</span>
            </button>
          </div>
        </header>

        {error && <div role="alert" style={{padding: "12px 20px", color: "#b91c1c", background: "#fff1f2"}}>{error}</div>}
        {/* Viewport Content Router */}
        <div className="saas-page-viewport">
          {currentView === "landing" ? (
        <LandingPage
          onLaunchConsole={handleLaunchConsole}
          onNavigatePage={(page) => navigateTo(page as AppPage)}
          datasetSummary={datasetSummary}
          scenario={scenario}
          presets={presets}
        />
      ) : currentView === "ai-lab" ? (
        <AILabPage key={[form.lat, form.lon, form.wind, form.pressure].join(",")}
          analysis={aiAnalysis}
          loading={aiLoading}
          onRunAnalysis={handleRunAiAnalysis}
          stormName={form.name}
          lat={Number(form.lat)}
          lon={Number(form.lon)}
          windKph={Number(form.wind)}
          pressureHpa={Number(form.pressure)}
          onNavigateToCommand={(presetKey, customCoords) => {
            if (customCoords) {
              setSelectedPreset("custom");
              setDraft((prev) => ({
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
          stormName={form.name}
          lat={Number(form.lat)}
          lon={Number(form.lon)}
          windKph={Number(form.wind)}
          pressureHpa={Number(form.pressure)}
          headingDeg={Number(form.heading)}
          speedKph={Number(form.speed)}
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
          locationName={form.name}
          onNavigateToCommand={() => { setShowShelters(true); setActiveSection("command"); setViewDimension("2d"); navigateTo("app"); }}
          onSelectCity3D={() => {
            setActiveSection("command");
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
          stormName={form.name}
          onNavigateToCommand={() => navigateTo("app")}
          onPrint={printScreeningReport}
        />
      ) : currentView === "resilience" ? (
        <ResilienceForecasterPage
          onNavigateToCommand={() => navigateTo("app")}
          onNavigateToAILab={() => navigateTo("ai-lab")}
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
                          <div className="tactical-panel-title">STORM SCENARIO</div>
                          <div className="tactical-panel-sub">Select a reference storm or adjust its track</div>
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
                        <label className="tactical-control-label">Reference storm</label>
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
                        <label className="tactical-control-label">Storm conditions</label>
                        <div className="tactical-input-grid">
                          <div className="tactical-input-box">
                            <span className="tactical-box-label">PEAK WIND</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                className="tactical-box-input"
                                value={draft.wind}
                                onChange={(e) => setDraft((p) => ({ ...p, wind: e.target.value }))}
                              />
                              <span className="tactical-unit">km/h</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">CENTRAL PRESSURE</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                className="tactical-box-input"
                                value={draft.pressure}
                                onChange={(e) => setDraft((p) => ({ ...p, pressure: e.target.value }))}
                              />
                              <span className="tactical-unit">hPa</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">CENTRE LATITUDE</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                step="0.01"
                                className="tactical-box-input"
                                value={draft.lat}
                                onChange={(e) => setDraft((p) => ({ ...p, lat: e.target.value }))}
                              />
                              <span className="tactical-unit">°N</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">CENTRE LONGITUDE</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                step="0.01"
                                className="tactical-box-input"
                                value={draft.lon}
                                onChange={(e) => setDraft((p) => ({ ...p, lon: e.target.value }))}
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
                                value={draft.heading}
                                onChange={(e) => setDraft((p) => ({ ...p, heading: e.target.value }))}
                              />
                              <span className="tactical-unit">°</span>
                            </div>
                          </div>

                          <div className="tactical-input-box">
                            <span className="tactical-box-label">FORWARD SPEED</span>
                            <div className="tactical-box-val-row">
                              <input
                                type="number"
                                className="tactical-box-input"
                                value={draft.speed}
                                onChange={(e) => setDraft((p) => ({ ...p, speed: e.target.value }))}
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
                              draft.lat,
                              draft.lon,
                              draft.wind,
                              draft.pressure,
                              draft.name,
                              draft.heading,
                              draft.speed,
                              draft.radius
                            );
                          }}
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="spin" size={13} />
                              <span>Updating scenario…</span>
                            </>
                          ) : (
                            <>
                              <Zap size={13} />
                              <span>Update risk map</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="tactical-secondary-btn"
                          onClick={() => navigateTo("resilience")}
                        >
                          <Sparkles size={13} />
                          <span>Plan community resilience</span>
                        </button>
                      </div>

                      {/* Analytical Hazard Modes */}
                      <div className="tactical-control-group">
                        <label className="tactical-control-label">Map layer</label>
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
                        <label className="tactical-control-label">Response layers</label>
                        <div className="tactical-layer-list">
                          <label className="tactical-layer-item">
                            <input
                              type="checkbox"
                              checked={showShelters}
                              onChange={(e) => setShowShelters(e.target.checked)}
                            />
                            <span>Cyclone shelters</span>
                          </label>
                          <label className="tactical-layer-item">
                            <input
                              type="checkbox"
                              checked={showZones}
                              onChange={(e) => setShowZones(e.target.checked)}
                            />
                            <span>Land-use zones</span>
                          </label>
                          <label className="tactical-layer-item">
                            <input
                              type="checkbox"
                              checked={layers.advanced.physicsGrid}
                              onChange={(e) => setLayers((prev) => ({ ...prev, advanced: { ...prev.advanced, physicsGrid: e.target.checked } }))}
                            />
                            <span>{resolutionLabel}</span>
                          </label>
                        </div>
                        <button type="button" className="tactical-action-btn" disabled={loading}
                          onClick={() => { setLayers(prev => ({...prev, advanced: {...prev.advanced, physicsGrid: true}})); void runFullPipeline(draft.lat, draft.lon, draft.wind, draft.pressure, draft.name, draft.heading, draft.speed, "6", true); }}>
                          Inspect 200 m detail · 6 km radius
                        </button>
                        <p style={{fontSize: 11}}>Wider scenarios use the overview resolution shown above.</p>
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
                    headingDeg={Number(form.heading)}
                    speedKph={Number(form.speed)}
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
                      setSelectedPreset("custom");
                      setDraft((prev) => ({ ...prev, lat: String(lat), lon: String(lon) }));
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
                        <span className="live-status-title">SCENARIO STATUS</span>
                        <span className="live-status-sub">SCREENING OUTPUT · NOT A LIVE FEED</span>
                      </div>

                      <div className="op-loss-telemetry">
                        <div className="op-loss-stat">
                          <span>RISK TIER:</span>
                          <strong className="red">
                            {!summaryStats ? "UNAVAILABLE" : summaryStats.max_risk_score >= 0.55 ? "SEVERE RED" : summaryStats.max_risk_score >= 0.25 ? "MODERATE" : summaryStats.max_risk_score >= 0.10 ? "LOW" : "NO MODELLED DAMAGE"}
                          </strong>
                        </div>
                        <div className="op-loss-stat">
                          <span>AFFECTED:</span>
                          <strong>{scenario ? totalCells.toLocaleString() : "Unavailable"} SECTORS</strong>
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
                          <span>RESPONSE STATUS:</span>
                          <strong className="red">SCENARIO ONLY</strong>
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
                          <span>Advisories</span>
                        </button>
                        <button
                          type="button"
                          className="saas-action-btn"
                          onClick={() => navigateTo("analytics")}
                          title="Comprehensive Validation Matrix & Provenance"
                        >
                          <BarChart3 size={12} />
                          <span>Methods</span>
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
                          <div className="tactical-panel-title">IMPACT BRIEF</div>
                          <div className="tactical-panel-sub">
                            Layer: <strong className="tactical-mode-readout">{analysisMode}</strong> &middot; Scenario screening output
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
                          Scenario: <strong>{form.name}</strong>
                        </div>
                      </div>

                      <div className="tactical-kpi-grid">
                        {[
                          ["GRID CELLS", summaryStats?.total_cells],
                          ["MAXIMUM CELL WIND", summaryStats?.max_wind_kph == null ? null : summaryStats.max_wind_kph + " km/h"],
                          ["PEAK DAMAGE INDEX", summaryStats?.max_risk_score?.toFixed(2)],
                          ["HIGH-INDEX CELLS", summaryStats?.severe_cells],
                        ].map(([label, value]) => <div className="tactical-kpi-card" key={label}>
                          <span className="kpi-label">{label}</span><strong className="kpi-val cyan">{value ?? "Unavailable"}</strong>
                        </div>)}
                      </div>
                      <div className="tactical-dossier-card">
                        <div className="dossier-header"><strong>{selectedCell ? "Selected cell" : "Sample cell"} · {activeCellInspection?.cell_id ?? "Unavailable"}</strong></div>
                        <div className="dossier-rows">{[
                          ["Grid resolution", resolutionLabel],
                          ["Land type", activeCellInspection?.land_type],
                          ["Local modeled wind", activeCellInspection && activeCellInspection.hazard.wind_kph + " km/h"],
                          ["Effective wind loading", activeCellInspection && activeCellInspection.wind_force.effective_wind_loading_n_m2 + " N/m²"],
                          ["Building count", activeCellInspection?.exposure.building_count],
                          ["Upwind obstruction", activeCellInspection?.obstacles.obstruction_level],
                          ["Damage index", activeCellInspection?.damage.damage_score?.toFixed(3)],
                          ["Primary driver", activeCellInspection?.drivers.primary],
                        ].map(([label, value]) => <div className="dossier-row" key={label}><span>{label}</span><strong>{value ?? "Unavailable"}</strong></div>)}</div>
                      </div>
                      {/* Student Project & Research Provenance Card */}
                      <div className="student-project-card">
                        <div className="student-project-header">
                          <span className="student-team">Research prototype · method provenance</span>
                        </div>
                        <div className="student-project-title">
                          CYCLONEX · AI Multi-Source Satellite &amp; Physics Hazard System
                        </div>
                        <div className="student-project-meta">
                          <div><strong>ML workflow:</strong> identification, pattern classification, rapid-intensification and intensity forecasting</div>
                          <div><strong>Wind Physics:</strong> Rankine Vortex + IS 875 (Part 3) Wind Loading Code</div>
                          <div><strong>Satellite catalogue:</strong> INSAT-3DR, ScatSat and HURSAT-B1 inputs; availability depends on the selected run</div>
                        </div>
                      </div>

                      <div className="tactical-quick-actions">
                        <button type="button" className="tactical-action-btn primary" onClick={printScreeningReport}>
                          <FileText size={12} />
                          <span>Print screening report (Save as PDF)</span>
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

          </div>

          {/* Contextual Cyclone Dossier Drawer (Right Side) */}
          <ContextualCyclonePanel
            isOpen={isCyclonePanelOpen}
            onClose={() => setIsCyclonePanelOpen(false)}
            stormName={form.name}
            category={stormCategory.name}
            trend={mlResult?.pattern_classification.lifecycle_pattern ?? undefined}
            radiusKm={scenario?.input?.radius_max_winds_km}
            windKph={Number(form.wind)}
            pressureHpa={Number(form.pressure)}
            headingDeg={Number(form.heading)}
            speedKph={Number(form.speed)}
            lat={Number(form.lat)}
            lon={Number(form.lon)}
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
                  <span>CELL DOSSIER · {resolutionLabel}</span>
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
                    Damage screening index: <strong style={{ color: "#ffffff" }}>{selectedCell.damage.damage_score.toFixed(4)}</strong>
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
          <div className="official-sitrep-print-doc" aria-label="Cyclonex scenario screening report">
            <div className="sitrep-header">
              <div className="sitrep-header-emblem">
                <div className="sitrep-emblem-badge">CYCLONEX</div>
                <div>
                  <h1 className="sitrep-title">SCENARIO SCREENING REPORT</h1>
                  <div className="sitrep-subtitle">RESEARCH PROTOTYPE · NOT AN OFFICIAL ADVISORY</div>
                  <div className="sitrep-system">CYCLONEX GEOSPATIAL INTELLIGENCE &amp; EMERGENCY RESPONSE SYSTEM</div>
                </div>
              </div>
              <div className="sitrep-meta-box">
                <div><strong>DOC REF:</strong> CYCLONEX/SCREENING/{new Date().getFullYear()}/{(form.name || "STORM").replace(/[^a-zA-Z0-9]/g, "-").toUpperCase()}</div>
                <div><strong>ISSUED:</strong> {new Date().toUTCString()} ({currentTimeIST})</div>
                <div><strong>REPORT TYPE:</strong> <span className="sitrep-alert-badge">DRAFT SCENARIO · REVIEW REQUIRED</span></div>
                <div><strong>RESOLUTION:</strong> {resolutionLabel} · Scenario screening</div>
              </div>
            </div>

            <div className="sitrep-divider" />

            <div className="sitrep-section">
              <h2 className="sitrep-section-title">1. EXECUTIVE SUMMARY &amp; IMPACT PROJECTION</h2>
              <div className="sitrep-summary-grid">
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">ESTIMATED ECONOMIC LOSS</span>
                  <strong className="sitrep-stat-val">{estEconomicLossCr}</strong>
                </div>
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">POPULATION AT RISK</span>
                  <strong className="sitrep-stat-val">{estPopulation}</strong>
                </div>
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">EVACUATION URGENCY</span>
                  <strong className="sitrep-stat-val">{(scenario?.risk_grid?.summary?.ndma_directives?.evacuation_urgency || "UNAVAILABLE").replace(/_/g, " ")}</strong>
                </div>
                <div className="sitrep-stat-card">
                  <span className="sitrep-stat-label">NDRF BATTALIONS</span>
                  <strong className="sitrep-stat-val">{summaryStats?.ndma_directives?.ndrf_battalions_recommended ?? "Unavailable"}</strong>
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
                    <th>Image provenance</th>
                    <td>{aiAnalysis?.provenance?.imagery || "Not analyzed"}</td>
                  </tr>
                  <tr>
                    <th>Eye Coordinates</th>
                    <td>{Number(form.lat).toFixed(2)}°N, {Number(form.lon).toFixed(2)}°E</td>
                    <th>Central Pressure</th>
                    <td>{form.pressure} hPa</td>
                  </tr>
                  <tr>
                    <th>Peak Wind Speed</th>
                    <td>{form.wind} km/h</td>
                    <th>Heading &amp; Velocity</th>
                    <td>{form.heading}° at {form.speed} km/h</td>
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
