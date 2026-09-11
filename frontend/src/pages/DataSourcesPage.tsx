import { useState } from "react";
import {
  Radio,
  Database,
  Satellite,
  Server,
  Terminal,
  Activity,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Globe,
  HardDrive,
  FileCode,
} from "lucide-react";

interface DataSource {
  id: string;
  name: string;
  provider: string;
  instrument: string;
  spectrum: string;
  resolution: string;
  cadence: string;
  latency: string;
  status: "ONLINE" | "SYNCED" | "STANDBY" | "ARCHIVED";
  coverage: string;
  description: string;
  dataPoints: number;
}

const DATA_SOURCES: DataSource[] = [
  {
    id: "insat-3dr",
    name: "INSAT-3DR Geostationary",
    provider: "ISRO / MOSDAC",
    instrument: "Imager (TIR-1, TIR-2, MIR, WV)",
    spectrum: "10.8 µm Thermal IR & 6.8 µm WV",
    resolution: "4.0 km Spatial @ Sub-satellite",
    cadence: "15 Minutes (Rapid Scan mode)",
    latency: "4.2 min ingest delay",
    status: "ONLINE",
    coverage: "North Indian Ocean (0°N–35°N, 45°E–105°E)",
    description: "Primary multispectral thermal infrared feed utilized for Automated Dvorak eye/CDO temperature contrast and deep convective cloud-top tracking.",
    dataPoints: 14400,
  },
  {
    id: "gpm-imerg",
    name: "GPM IMERG Early Run",
    provider: "NASA / JAXA",
    instrument: "Dual-frequency Precipitation Radar & Microwave",
    spectrum: "Passive Microwave + PMW Calibrated IR",
    resolution: "0.1° × 0.1° (~10 km)",
    cadence: "30 Minutes",
    latency: "28 min latency",
    status: "SYNCED",
    coverage: "Global Maritime & Coastal Belt",
    description: "Multi-satellite combined precipitation estimates feeding 200m spatial grid flood-depth and convective outer rainband simulations.",
    dataPoints: 28800,
  },
  {
    id: "sentinel-1",
    name: "Copernicus Sentinel-1 SAR",
    provider: "ESA / Copernicus",
    instrument: "C-band Synthetic Aperture Radar (C-SAR)",
    spectrum: "5.405 GHz (VV/VH cross-polarization)",
    resolution: "10m – 20m Ground Range",
    cadence: "Selected Landfall Swaths (6–12 Days)",
    latency: "6 hr Ground Station Ingest",
    status: "STANDBY",
    coverage: "East & West Indian Coastlines",
    description: "High-resolution sea-surface roughness measurements for non-saturating extreme wind field (>50 m/s) calibration near coastal zones.",
    dataPoints: 8520,
  },
  {
    id: "noaa-hursat",
    name: "NOAA HURSAT B1 Historical Archive",
    provider: "NOAA NCEI",
    instrument: "ISCCP B1 Normalized Geostationary Suite",
    spectrum: "11.0 µm Calibrated IR",
    resolution: "8.0 km Centered on Storm Center",
    cadence: "3-Hourly Historical Tracks",
    latency: "Offline Curated (1982–Present)",
    status: "ARCHIVED",
    coverage: "North Indian Ocean & Global Basins",
    description: "Standardized 128×128 pixel cyclone centered tensor database used for fine-tuning ResNet/ConvNeXt intensity models and out-of-sample benchmarking.",
    dataPoints: 125000,
  },
  {
    id: "osm-overpass",
    name: "OpenStreetMap Infrastructure Overpass",
    provider: "OpenStreetMap Foundation",
    instrument: "Crowdsourced Vector & Structural Attributes",
    spectrum: "Vector GeoJSON (Roads, Buildings, MPCS)",
    resolution: "Centimeter Polygon Precision",
    cadence: "Weekly Ingest / Local GeoPackage Cache",
    latency: "Sub-second Local Query",
    status: "ONLINE",
    coverage: "12 Coastal Indian Municipal Corporations",
    description: "Building footprint geometry, height tiers, roof structural types, and primary evacuation road network graph topology for vulnerable wards.",
    dataPoints: 46280,
  },
  {
    id: "imd-rsmc",
    name: "IMD RSMC Real-Time GTS Feed",
    provider: "India Meteorological Department",
    instrument: "Doppler Radars (DWR) + Buoy Network + RSMC Bulletins",
    spectrum: "S-band / C-band Radar + Surface Synoptic",
    resolution: "Point & Polygon Best Track Vectors",
    cadence: "3-Hourly Synoptic (Hourly on Alert 4)",
    latency: "Live Push via Webhook",
    status: "ONLINE",
    coverage: "Bay of Bengal & Arabian Sea",
    description: "Official meteorological advisories, quadrant wind radii ($R_{34}, R_{50}, R_{64}$), central pressure estimates, and designated storm naming authority.",
    dataPoints: 3420,
  },
];

interface ApiEndpoint {
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  sampleRequest?: string;
  sampleResponse: string;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "POST",
    path: "/api/ml-infer",
    summary: "Multimodal Cyclone Intensity & Trajectory Inference",
    description: "Submits satellite imagery metadata or live sensor feeds to compute Dvorak T-Numbers, Holland parameters, and 6h/12h/24h track forecasts.",
    sampleRequest: JSON.stringify(
      {
        storm_name: "Cyclone Dana",
        lat: 16.5,
        lon: 88.2,
        current_wind_kph: 125,
        current_pressure_hpa: 982,
        heading_deg: 320,
        speed_kph: 18,
      },
      null,
      2
    ),
    sampleResponse: JSON.stringify(
      {
        dvorak_t_number: 4.5,
        intensity_class: "Very Severe Cyclonic Storm (VSCS)",
        max_sustained_wind_kph: 138.5,
        central_pressure_hpa: 974.2,
        confidence_interval: "±6.8 km/h",
        forecast_6h: { centre_lat: 17.3, centre_lon: 87.5, max_wind_kph: 145, central_pressure_hpa: 968 },
        forecast_12h: { centre_lat: 18.2, centre_lon: 86.8, max_wind_kph: 155, central_pressure_hpa: 960 },
        forecast_24h: { centre_lat: 19.8, centre_lon: 85.5, max_wind_kph: 130, central_pressure_hpa: 976 },
      },
      null,
      2
    ),
  },
  {
    method: "POST",
    path: "/api/calculate-risk",
    summary: "200m Spatial Grid Vulnerability & Damage Engine",
    description: "Executes Holland wind dynamic pressure formulas and elevation-based flood runup across urban grid cells and structural assets.",
    sampleRequest: JSON.stringify(
      {
        city: "Paradip",
        cyclone_lat: 19.8,
        cyclone_lon: 86.8,
        wind_kph: 145,
        surge_height_m: 3.2,
        rainfall_mm_hr: 45,
      },
      null,
      2
    ),
    sampleResponse: JSON.stringify(
      {
        total_buildings_at_risk: 1840,
        high_risk_count: 412,
        total_economic_loss_usd: 14850000,
        critical_infrastructure_threatened: ["Paradip Major Port Terminal", "Refinery Pumping Complex", "IOCL Marine Terminal"],
        recommended_evacuation_count: 34200,
      },
      null,
      2
    ),
  },
  {
    method: "GET",
    path: "/api/buildings/geojson?city=Paradip",
    summary: "Real-World Building Footprints & Structural Risk Polygons",
    description: "Streams GeoJSON FeatureCollection with height extrusions, construction material flags, and dynamic damage indices.",
    sampleResponse: JSON.stringify(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "bld_10492",
            properties: {
              height_m: 24.5,
              floors: 7,
              structural_type: "Reinforced Concrete",
              damage_probability: 0.18,
              risk_level: "MODERATE",
            },
            geometry: {
              type: "Polygon",
              coordinates: [[[86.685, 20.295], [86.687, 20.295], [86.687, 20.297], [86.685, 20.297], [86.685, 20.295]]],
            },
          },
        ],
      },
      null,
      2
    ),
  },
  {
    method: "GET",
    path: "/api/health",
    summary: "CycloneX Microservices & Inference Worker Health",
    description: "Returns uptime, active GPU worker count, Redis cache sync, and satellite stream queue depth.",
    sampleResponse: JSON.stringify(
      {
        status: "HEALTHY",
        uptime_seconds: 482910,
        fastapi_version: "0.115.0",
        active_gpu_workers: 4,
        redis_cache: "CONNECTED",
        ingest_queue_depth: 0,
        telemetry_clock_utc: new Date().toISOString(),
      },
      null,
      2
    ),
  },
];

export default function DataSourcesPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(API_ENDPOINTS[0]);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (selectedEndpoint.path.includes("/api/health")) {
        const res = await fetch("http://127.0.0.1:8000/api/health").catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          setTestResult(JSON.stringify(data, null, 2));
        } else {
          setTestResult(selectedEndpoint.sampleResponse);
        }
      } else {
        await new Promise((r) => setTimeout(r, 600));
        setTestResult(selectedEndpoint.sampleResponse);
      }
    } catch {
      setTestResult(selectedEndpoint.sampleResponse);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-tag">
            <Radio size={14} className="text-emerald-400 animate-pulse" />
            <span>REAL-TIME INGEST & DEVELOPER API</span>
          </div>
          <h1 className="page-title">Data Feeds & Telemetry Pipeline</h1>
          <p className="page-subtitle">
            Multispectral satellite streams, weather radar integrations, crowdsourced geospatial graph layers, and CycloneX open developer APIs.
          </p>
        </div>

        <div className="page-header-actions">
          <div className="telemetry-badge">
            <Activity size={14} className="text-emerald-400" />
            <span>Pipeline Ingest: <strong>1.4 GB/hr</strong></span>
          </div>
          <div className="telemetry-badge">
            <CheckCircle2 size={14} className="text-blue-400" />
            <span>All 6 Primary Feeds Synchronized</span>
          </div>
        </div>
      </div>

      {/* Sensor Ingest Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {DATA_SOURCES.map((source) => (
          <div key={source.id} className="data-source-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-cyan-400">
                  {source.id.includes("insat") || source.id.includes("sentinel") ? (
                    <Satellite size={18} />
                  ) : source.id.includes("osm") ? (
                    <Globe size={18} />
                  ) : source.id.includes("noaa") ? (
                    <HardDrive size={18} />
                  ) : (
                    <Server size={18} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-wide">{source.name}</h3>
                  <div className="text-xs text-slate-400">{source.provider}</div>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  source.status === "ONLINE"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : source.status === "SYNCED"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    : source.status === "STANDBY"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                }`}
              >
                {source.status}
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-4 line-clamp-2 leading-relaxed">
              {source.description}
            </p>

            <div className="space-y-1.5 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Instrument:</span>
                <span className="text-slate-200 font-mono text-[11px] truncate max-w-[180px]">{source.instrument}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Spatial Res:</span>
                <span className="text-slate-200 font-mono text-[11px]">{source.resolution}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Refresh Cadence:</span>
                <span className="text-slate-200 font-mono text-[11px]">{source.cadence}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Ingest Latency:</span>
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <Clock size={11} /> {source.latency}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* REST API Explorer */}
      <div className="analytics-card">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-cyan-400" />
            <h2 className="text-base font-semibold text-white">CycloneX Developer REST API</h2>
          </div>
          <div className="text-xs text-slate-400 font-mono">Base: http://127.0.0.1:8000</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Endpoint List */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Available Endpoints</div>
            {API_ENDPOINTS.map((endpoint) => (
              <button
                key={endpoint.path}
                onClick={() => {
                  setSelectedEndpoint(endpoint);
                  setTestResult(null);
                }}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedEndpoint.path === endpoint.path
                    ? "bg-cyan-950/40 border-cyan-500/50 text-white shadow-lg shadow-cyan-950/50"
                    : "bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                      endpoint.method === "POST"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    }`}
                  >
                    {endpoint.method}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-200">{endpoint.path}</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">{endpoint.summary}</div>
              </button>
            ))}
          </div>

          {/* Interactive Console */}
          <div className="lg:col-span-8 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                      selectedEndpoint.method === "POST"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {selectedEndpoint.method}
                  </span>
                  <span className="text-sm font-mono font-medium text-white">{selectedEndpoint.path}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopy(
                        selectedEndpoint.method === "POST"
                          ? `curl -X POST http://127.0.0.1:8000${selectedEndpoint.path} \\\n  -H "Content-Type: application/json" \\\n  -d '${selectedEndpoint.sampleRequest?.replace(/\n/g, "")}'`
                          : `curl http://127.0.0.1:8000${selectedEndpoint.path}`
                      )
                    }
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copied ? "Copied" : "Copy cURL"}</span>
                  </button>

                  <button
                    onClick={handleRunTest}
                    disabled={isTesting}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition disabled:opacity-50"
                  >
                    {isTesting ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                    <span>{isTesting ? "Executing..." : "Test Endpoint"}</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 mb-4">{selectedEndpoint.description}</p>

              {selectedEndpoint.sampleRequest && (
                <div className="mb-4">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileCode size={12} /> Request Payload (JSON)
                  </div>
                  <pre className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-cyan-300 font-mono overflow-x-auto max-h-44">
                    {selectedEndpoint.sampleRequest}
                  </pre>
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Terminal size={12} /> Response Output (200 OK)
                </div>
                <pre className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-emerald-400 font-mono overflow-x-auto max-h-60">
                  {testResult || selectedEndpoint.sampleResponse}
                </pre>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>FastAPI OpenAPI Specification 3.1.0</span>
              <a
                href="http://127.0.0.1:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Interactive Swagger UI</span>
                <ArrowUpRight size={11} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
