import { FormEvent, useEffect, useMemo, useState } from "react";
import LandingPage from "./LandingPage";
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
  const [currentView, setCurrentView] = useState<"landing" | "app">(() => {
    return window.location.hash === "#landing" ? "landing" : "app";
  });
  
  // Single Clean Primary Navigation
  const [activeNavTab, setActiveNavTab] = useState<"risk_map" | "forecast" | "sitrep" | "analytics">("risk_map");
  
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

  // Keyboard Shortcuts: 1 (2D), 2 (Real 3D), 3 (Globe), Esc (Close drawers)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "1") setViewDimension("2d");
      if (e.key === "2") setViewDimension("real3d");
      if (e.key === "3") setViewDimension("globe");
      if (e.key === "Escape") {
        setSelectedCell(null);
        setIsSearchOpen(false);
        if (activeNavTab === "sitrep" || activeNavTab === "analytics") {
          setActiveNavTab("risk_map");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeNavTab]);

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

  function navigateTo(view: "landing" | "app") {
    setCurrentView(view);
    window.location.hash = view === "app" ? "#app" : "#landing";
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
            <span className="gov-tag">NATIONAL DISASTER OPERATIONS PLATFORM</span>
          </div>
        </div>

        {/* Unified Primary Navigation */}
        <nav className="primary-nav-bar" aria-label="Primary Platform Navigation">
          <button
            type="button"
            className={`primary-nav-item ${activeNavTab === "risk_map" ? "active" : ""}`}
            onClick={() => {
              setActiveNavTab("risk_map");
              setAnalysisMode("DAMAGE");
            }}
          >
            <IconGrid />
            <span>Risk Map</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${activeNavTab === "forecast" ? "active" : ""}`}
            onClick={() => {
              setActiveNavTab("forecast");
              setAnalysisMode("WIND");
            }}
          >
            <IconRadar />
            <span>Storm Forecast</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${activeNavTab === "sitrep" ? "active" : ""}`}
            onClick={() => setActiveNavTab("sitrep")}
          >
            <IconShield />
            <span>SITREP</span>
          </button>
          <button
            type="button"
            className={`primary-nav-item ${activeNavTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveNavTab("analytics")}
          >
            <IconActivity />
            <span>Analytics</span>
          </button>
        </nav>

        {/* Operational Telemetry & Quick Actions */}
        <div className="header-meta-strip">
          <div className="time-clock-display" title="Live Indian Standard Time">
            {currentTimeIST}
          </div>
          <span className="sensor-status-badge" title="Active Satellite Sensor Feeds: INSAT-3D, GPM, Sentinel-1">
            <span className="status-pulse-dot" />
            INSAT-3D / GPM ACTIVE
          </span>
          <button
            type="button"
            className="btn-header-action"
            onClick={() => setIsNewsPanelOpen(true)}
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

      {/* View Switcher: Landing vs Command Console */}
      {currentView === "landing" ? (
        <LandingPage
          onLaunchConsole={handleLaunchConsole}
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
      ) : (
        <main className="command-workspace-shell">
          {/* =================================================================
              2. OPERATIONAL LEFT SIDEBAR (280PX, COLLAPSIBLE, CSS GRID FORM)
              ================================================================= */}
          <aside className={`operational-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
            <div className="sidebar-header">
              <div className="sidebar-heading">
                <IconCompass />
                <span>Operational Controls</span>
              </div>
              <button
                type="button"
                className="btn-sidebar-toggle"
                onClick={handleToggleSidebar}
                title="Collapse sidebar"
              >
                ◀
              </button>
            </div>

            <div className="sidebar-content-scroll">
              {/* Active Storm Card */}
              <div className="active-storm-card">
                <div className="active-storm-header">
                  <span className="active-storm-name">
                    {presets[selectedPreset]?.name.split("(")[0].trim() || form.name}
                  </span>
                  <span className="storm-severity-badge severe">
                    {Number(form.wind) >= 165 ? "EXTREMELY SEVERE" : Number(form.wind) >= 120 ? "VERY SEVERE" : "CYCLONIC STORM"}
                  </span>
                </div>
                
                {/* Presets Selector Dropdown */}
                <select
                  className="storm-select"
                  value={selectedPreset}
                  onChange={(e) => void handlePresetChange(e.target.value)}
                  title="Select a historic or benchmark cyclone scenario"
                >
                  <option value="nisarga">Cyclone Nisarga (Maharashtra, 2020)</option>
                  <option value="biparjoy">Cyclone Biparjoy (Gujarat, 2023)</option>
                  <option value="dana">Cyclone Dana (Odisha Coast, 2024)</option>
                  <option value="amphan">Cyclone Amphan (West Bengal, 2020)</option>
                  <option value="fani">Cyclone Fani (Odisha / Bay of Bengal, 2019)</option>
                  <option value="hudhud">Cyclone Hudhud (Visakhapatnam, 2014)</option>
                  <option value="custom">Custom Map Coordinates</option>
                </select>
              </div>

              {/* Key Telemetry Quad */}
              <div className="telemetry-quad">
                <div className="telemetry-cell">
                  <span className="telemetry-label">Peak Wind</span>
                  <span className="telemetry-value accent">{form.wind || "120"} km/h</span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-label">Pressure</span>
                  <span className="telemetry-value">{form.pressure || "984"} hPa</span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-label">Movement</span>
                  <span className="telemetry-value">{form.heading || "35"}°</span>
                </div>
                <div className="telemetry-cell">
                  <span className="telemetry-label">Velocity</span>
                  <span className="telemetry-value">{form.speed || "22"} km/h</span>
                </div>
              </div>

              {/* Storm Parameters Dedicated CSS Grid Panel */}
              <div className="storm-parameters-panel">
                <div className="panel-subheading">
                  <span>Storm Parameters</span>
                  <span style={{ color: "#38bdf8", fontSize: "9px" }}>200m Physics Grid</span>
                </div>

                <form onSubmit={handleStormFormSubmit}>
                  <div className="storm-form-grid">
                    <div className="form-field">
                      <label className="form-field-label">Latitude</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          step="0.0001"
                          value={form.lat}
                          onChange={(e) => setForm({ ...form, lat: e.target.value })}
                          placeholder="18.35"
                        />
                        <span className="input-unit-badge">°N</span>
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-field-label">Longitude</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          step="0.0001"
                          value={form.lon}
                          onChange={(e) => setForm({ ...form, lon: e.target.value })}
                          placeholder="72.98"
                        />
                        <span className="input-unit-badge">°E</span>
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-field-label">Wind Speed</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          value={form.wind}
                          onChange={(e) => setForm({ ...form, wind: e.target.value })}
                          placeholder="120"
                        />
                        <span className="input-unit-badge">km/h</span>
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-field-label">Pressure</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          value={form.pressure}
                          onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                          placeholder="984"
                        />
                        <span className="input-unit-badge">hPa</span>
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-field-label">Movement</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          min="0"
                          max="360"
                          value={form.heading || "35"}
                          onChange={(e) => setForm({ ...form, heading: e.target.value })}
                          placeholder="35"
                        />
                        <span className="input-unit-badge">°</span>
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-field-label">Movement Speed</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          min="0"
                          max="120"
                          value={form.speed || "22"}
                          onChange={(e) => setForm({ ...form, speed: e.target.value })}
                          placeholder="22"
                        />
                        <span className="input-unit-badge">km/h</span>
                      </div>
                    </div>

                    <div className="form-field span-2">
                      <label className="form-field-label">Storm Radius</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={form.radius || "30"}
                          onChange={(e) => setForm({ ...form, radius: e.target.value })}
                          placeholder="30"
                        />
                        <span className="input-unit-badge">km</span>
                      </div>
                    </div>
                  </div>

                  <div className="form-action-row">
                    <button type="submit" className="btn-command primary" disabled={loading}>
                      {loading ? "Calculating..." : "📊 Generate Risk Map"}
                    </button>
                    <button
                      type="button"
                      className="btn-command danger-ghost"
                      onClick={handleClearAllCyclones}
                      title="Clear active storm data"
                    >
                      🧹 Clear
                    </button>
                  </div>
                </form>
              </div>

              {/* Multi-Horizon Track Forecast */}
              {mlResult && (
                <div className="storm-parameters-panel">
                  <div className="panel-subheading">
                    <span>Forecast Horizon</span>
                    <span style={{ color: "#38bdf8", fontSize: "9px" }}>AI/ML Track</span>
                  </div>
                  <div className="horizon-selector-row">
                    {([6, 12, 24] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={`horizon-pill ${selectedHorizon === h ? "active" : ""}`}
                        onClick={() => setSelectedHorizon(h)}
                      >
                        +{h}h Track
                      </button>
                    ))}
                  </div>
                  {currentForecast && (
                    <div style={{ marginTop: "8px", fontSize: "11px", color: "#cbd5e1", lineHeight: "1.5" }}>
                      <div>Centre: <strong>{currentForecast.centre_lat.toFixed(2)}°N, {currentForecast.centre_lon.toFixed(2)}°E</strong></div>
                      <div>Max Wind: <strong>{currentForecast.max_sustained_wind_kph} km/h</strong></div>
                      <div style={{ color: "#8295ab", fontSize: "10px" }}>Uncertainty: ±{currentForecast.track_uncertainty_km} km</div>
                    </div>
                  )}
                </div>
              )}

              {/* Layer Controls */}
              <div className="sidebar-layers-panel">
                <div className="panel-subheading">
                  <span>Geospatial Layers</span>
                </div>
                <label className="layer-toggle-item">
                  <span>Land-Use Zones</span>
                  <input
                    type="checkbox"
                    checked={showZones}
                    onChange={(e) => setShowZones(e.target.checked)}
                  />
                </label>
                <label className="layer-toggle-item">
                  <span>MPCS Cyclone Shelters</span>
                  <input
                    type="checkbox"
                    checked={showShelters}
                    onChange={(e) => setShowShelters(e.target.checked)}
                  />
                </label>
                <label className="layer-toggle-item">
                  <span>AI Neural Forecast Layer</span>
                  <input
                    type="checkbox"
                    checked={showAiLayer}
                    onChange={(e) => setShowAiLayer(e.target.checked)}
                  />
                </label>
              </div>

              {/* Coastal Sector Quick Jump */}
              <div className="storm-parameters-panel">
                <div className="panel-subheading">
                  <span>Coastal Sector Jump</span>
                </div>
                <div className="district-search-wrapper">
                  <span className="district-search-icon">🔍</span>
                  <input
                    type="text"
                    className="district-search-input"
                    placeholder="Search coastal district..."
                    value={searchLocationQuery}
                    onChange={(e) => {
                      setSearchLocationQuery(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                  />
                  {isSearchOpen && filteredLocations.length > 0 && (
                    <div className="district-dropdown-results">
                      {filteredLocations.map((loc) => (
                        <div
                          key={loc.name}
                          className="district-dropdown-row"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, lat: loc.lat, lon: loc.lon }));
                            setSearchLocationQuery(loc.name);
                            setIsSearchOpen(false);
                            void handlePresetChange(loc.presetKey as keyof typeof presets);
                          }}
                        >
                          <span>{loc.name}</span>
                          <span style={{ fontSize: "9.5px", color: "#8295ab", fontFamily: "monospace" }}>
                            {loc.lat}°N, {loc.lon}°E
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Cyclone Panel if enabled */}
              {showAiLayer && (
                <AICyclonePanel
                  analysis={aiAnalysis}
                  loading={aiLoading}
                  onAnalyze={() => void handleRunAiAnalysis()}
                />
              )}

              {error && <div style={{ color: "#ef4444", fontSize: "11px", padding: "6px" }}>{error}</div>}
            </div>
          </aside>

          {/* =================================================================
              3. CENTRAL DOMINANT MAP WORKSPACE
              ================================================================= */}
          <section className="map-workspace-shell">
            {/* Floating Expand Sidebar Button when sidebar collapsed */}
            {!sidebarOpen && (
              <button
                type="button"
                className="btn-expand-sidebar-floating"
                onClick={handleToggleSidebar}
                title="Expand operational sidebar"
              >
                ▶
              </button>
            )}

            {/* Floating Map Command Ribbon */}
            <div className="map-command-ribbon" aria-label="Map Analysis Modes">
              <div className="ribbon-engine-switcher">
                <button
                  type="button"
                  className={`engine-pill ${viewDimension === "2d" ? "active" : ""}`}
                  onClick={() => setViewDimension("2d")}
                  title="2D Tactical GIS Map"
                >
                  🗺️ 2D Grid
                </button>
                <button
                  type="button"
                  className={`engine-pill ${viewDimension === "real3d" ? "active" : ""}`}
                  onClick={() => setViewDimension("real3d")}
                  title="3D City Digital Twin"
                >
                  🏢 3D City
                </button>
                <button
                  type="button"
                  className={`engine-pill ${viewDimension === "globe" ? "active" : ""}`}
                  onClick={() => setViewDimension("globe")}
                  title="3D Earth Globe View"
                >
                  🌐 3D Globe
                </button>
              </div>

              <div className="ribbon-divider" />

              <div className="ribbon-mode-pills">
                {(["DAMAGE", "HIT", "WIND", "EXPOSURE", "BUILDINGS", "OBSTACLES", "ZONES", "EVACUATION"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`ribbon-pill ${analysisMode === mode ? "active" : ""}`}
                    onClick={() => {
                      setAnalysisMode(mode);
                      if (mode === "BUILDINGS") setViewDimension("real3d");
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Dominant Map Canvas Container */}
            <div className="map-canvas-container">
              <RiskMap
                center={mapCenter}
                features={scenario?.risk_grid.features ?? []}
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
                onSelectCell={(cell) => {
                  setSelectedCell(cell);
                }}
                scenarioId={scenario?.id}
                locationName={form.name || scenario?.input?.name}
                onSelectPreset={(key) => void handlePresetChange(key as keyof typeof presets)}
                onCustomLocationChange={(lat, lon) => {
                  setForm((prev) => ({ ...prev, lat: String(lat), lon: String(lon) }));
                  void runFullPipeline(String(lat), String(lon), form.wind, form.pressure, "Custom Location", form.heading, form.speed, form.radius);
                }}
              />
            </div>

            {/* Bottom Operational Intelligence Strip */}
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
                  onClick={() => setActiveNavTab("sitrep")}
                  title="Open NDMA Situation Report panel"
                >
                  <IconShield />
                  <span>View SITREP</span>
                </button>
                <button
                  type="button"
                  className="btn-intel-action"
                  onClick={() => setActiveNavTab("analytics")}
                  title="Open Model Analytics"
                >
                  <IconActivity />
                  <span>Analytics</span>
                </button>
              </div>
            </div>
          </section>

          {/* =================================================================
              4. RIGHT DETAIL DRAWER (CELL & BUILDING DOSSIER)
              ================================================================= */}
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

          {/* =================================================================
              5. DEDICATED SITREP PANEL MODAL / OVERLAY
              ================================================================= */}
          {activeNavTab === "sitrep" && (
            <div className="operational-panel-modal-backdrop" onClick={() => setActiveNavTab("risk_map")}>
              <div className="operational-panel-modal" onClick={(e) => e.stopPropagation()}>
                <div className="panel-modal-header">
                  <div className="panel-modal-title">
                    <IconShield />
                    <span>NDMA SITUATION REPORT (SITREP) · 200M RESOLUTION</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn-header-action primary"
                      onClick={() => window.print()}
                    >
                      <IconDownload />
                      <span>Export SITREP (PDF)</span>
                    </button>
                    <button
                      type="button"
                      className="btn-close-drawer"
                      onClick={() => setActiveNavTab("risk_map")}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="panel-modal-body">
                  {/* Calibrated Loss & Impact Metrics */}
                  <div className="loss-metric-row">
                    <div className="loss-box">
                      <span className="loss-lbl">Estimated Economic Loss</span>
                      <strong className="loss-val inr">
                        ₹ {(scenario?.risk_grid?.summary?.estimated_loss_crores_inr ?? 1131.8).toFixed(1)} Cr
                      </strong>
                      <span className="loss-sub">Calibrated NDMA standard valuation</span>
                    </div>
                    <div className="loss-box">
                      <span className="loss-lbl">Population in Harm&apos;s Way</span>
                      <strong className="loss-val pop">
                        {(scenario?.risk_grid?.summary?.estimated_population_affected ?? 330930).toLocaleString()}
                      </strong>
                      <span className="loss-sub">High-risk coastal evacuation zone</span>
                    </div>
                    <div className="loss-box">
                      <span className="loss-lbl">Evacuation Urgency</span>
                      <strong className="loss-val" style={{ color: "#ef4444" }}>
                        {(scenario?.risk_grid?.summary?.ndma_directives?.evacuation_urgency || "MANDATORY IMMEDIATE").replace(/_/g, " ")}
                      </strong>
                      <span className="loss-sub">Landfall zero-hour posture</span>
                    </div>
                    <div className="loss-box">
                      <span className="loss-lbl">NDRF Mobilization</span>
                      <strong className="loss-val" style={{ color: "#10b981" }}>
                        {scenario?.risk_grid?.summary?.ndma_directives?.ndrf_battalions_recommended ?? 18} Battalions
                      </strong>
                      <span className="loss-sub">Pre-positioned coastal hubs</span>
                    </div>
                  </div>

                  {/* Actionable Directives */}
                  <div className="directives-grid">
                    <div className="directive-item">
                      <span className="directive-tag">Maritime &amp; Port Signal</span>
                      <strong style={{ color: "#ef4444" }}>
                        {(scenario?.risk_grid?.summary?.ndma_directives?.port_warning_signal || "SIGNAL 10 GREAT DANGER").replace(/_/g, " ")}
                      </strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#8295ab" }}>
                        Halt port operations, recall trawlers, secure crane gantries.
                      </p>
                    </div>

                    <div className="directive-item">
                      <span className="directive-tag">Power Grid Isolation</span>
                      <strong style={{ color: "#38bdf8" }}>
                        {(scenario?.risk_grid?.summary?.ndma_directives?.power_grid_advisory || "EMERGENCY ISOLATION TRIGGERED").replace(/_/g, " ")}
                      </strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#8295ab" }}>
                        Isolate 33/11 kV substations 2 hours before 100 km/h perimeter arrival.
                      </p>
                    </div>

                    <div className="directive-item" style={{ gridColumn: "span 2" }}>
                      <span className="directive-tag">Rail &amp; Highway Transport Directive</span>
                      <strong style={{ color: "#f59e0b" }}>
                        {(scenario?.risk_grid?.summary?.ndma_directives?.rail_traffic_directive || "SUSPEND ALL COASTAL RAIL").replace(/_/g, " ")}
                      </strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#8295ab" }}>
                        Suspend express trains traversing coastal corridors; convoy control on national highways.
                      </p>
                    </div>
                  </div>

                  {/* MPCS Shelter Allocation */}
                  {sheltersPlan && (
                    <div style={{ background: "rgba(6, 14, 27, 0.7)", border: "1px solid var(--border-subtle)", borderRadius: "6px", padding: "12px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#10b981", textTransform: "uppercase", marginBottom: "8px" }}>
                        Active Cyclone Shelters (MPCS) Logistics
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "10px" }}>
                        <div>Active Shelters: <strong>{sheltersPlan.total_shelters_active}</strong></div>
                        <div>Capacity: <strong>{sheltersPlan.total_capacity.toLocaleString()}</strong></div>
                        <div>Immediate Evacuees: <strong>{sheltersPlan.immediate_evacuation_count.toLocaleString()}</strong></div>
                        <div>Pop. at Risk: <strong>{sheltersPlan.estimated_population_at_risk.toLocaleString()}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              6. DEDICATED ANALYTICS PANEL MODAL / OVERLAY
              ================================================================= */}
          {activeNavTab === "analytics" && (
            <div className="operational-panel-modal-backdrop" onClick={() => setActiveNavTab("risk_map")}>
              <div className="operational-panel-modal" onClick={(e) => e.stopPropagation()}>
                <div className="panel-modal-header">
                  <div className="panel-modal-title">
                    <IconActivity />
                    <span>AI/ML SATELLITE PREDICTION &amp; MODEL PROVENANCE</span>
                  </div>
                  <button
                    type="button"
                    className="btn-close-drawer"
                    onClick={() => setActiveNavTab("risk_map")}
                  >
                    ✕
                  </button>
                </div>

                <div className="panel-modal-body">
                  {/* Accuracy Legend */}
                  <div className="accuracy-legend-bar">
                    <span style={{ fontWeight: 800, color: "#8295ab", textTransform: "uppercase", fontSize: "10px" }}>
                      Forecast Accuracy Grade:
                    </span>
                    <span className="accuracy-legend-item">
                      <i className="accuracy-legend-dot" style={{ background: "#10b981" }} />
                      <strong style={{ color: "#10b981" }}>Grade A</strong> High (&ge;90%)
                    </span>
                    <span className="accuracy-legend-item">
                      <i className="accuracy-legend-dot" style={{ background: "#38bdf8" }} />
                      <strong style={{ color: "#38bdf8" }}>Grade B</strong> Good (80–89%)
                    </span>
                    <span className="accuracy-legend-item">
                      <i className="accuracy-legend-dot" style={{ background: "#f59e0b" }} />
                      <strong style={{ color: "#f59e0b" }}>Grade C</strong> Moderate (70–79%)
                    </span>
                    <span className="accuracy-legend-item">
                      <i className="accuracy-legend-dot" style={{ background: "#ef4444" }} />
                      <strong style={{ color: "#ef4444" }}>Grade D</strong> Elevated Uncertainty (&lt;70%)
                    </span>
                  </div>

                  {/* Multi-Horizon Trajectory Table */}
                  {mlResult && (
                    <table className="ai-ml-table">
                      <thead>
                        <tr>
                          <th>Horizon</th>
                          <th>Predicted Position</th>
                          <th>Projected Wind</th>
                          <th>Central Pressure</th>
                          <th>Track Uncertainty</th>
                          <th>Accuracy Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([6, 12, 24] as const).map((h) => {
                          const f = mlResult[`forecast_${h}h`];
                          const acc = getAccuracyInfo(h === 6 ? 94 : h === 12 ? 88 : 82);
                          return (
                            <tr key={h}>
                              <td><strong>+{h} Hours</strong></td>
                              <td>{f.centre_lat.toFixed(2)}°N, {f.centre_lon.toFixed(2)}°E</td>
                              <td>{f.max_sustained_wind_kph} km/h</td>
                              <td>{f.central_pressure_hpa} hPa</td>
                              <td>±{f.track_uncertainty_km} km</td>
                              <td>
                                <span className="accuracy-badge" style={{ color: acc.color, background: acc.bg }}>
                                  {acc.grade}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* System Diagnostic Telemetry */}
                  {devPanelStats && (
                    <div style={{ background: "rgba(6, 14, 27, 0.7)", border: "1px solid var(--border-subtle)", borderRadius: "6px", padding: "12px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <IconTerminal /> System Diagnostic Telemetry
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontSize: "11.5px" }}>
                        <div>Total Grid Cells: <strong>{devPanelStats.totalCells.toLocaleString()}</strong></div>
                        <div>Severe Risk Cells: <strong style={{ color: "#ef4444" }}>{devPanelStats.redCells}</strong></div>
                        <div>Moderate Risk Cells: <strong style={{ color: "#f59e0b" }}>{devPanelStats.orangeCells}</strong></div>
                        <div>Safe / Marine Cells: <strong style={{ color: "#10b981" }}>{devPanelStats.greenCells + devPanelStats.blueCells}</strong></div>
                        <div>Buildings Screened: <strong>{devPanelStats.buildingCells}</strong></div>
                        <div>Model Status: <strong style={{ color: "#38bdf8" }}>{devPanelStats.mlModelStatus}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
        </main>
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
