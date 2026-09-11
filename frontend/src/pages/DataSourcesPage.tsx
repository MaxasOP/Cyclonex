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
  Play,
  Layers
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
  flowColor: string;
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
    flowColor: "#38bdf8",
  },
  {
    id: "imd-dwr",
    name: "IMD Doppler Weather Radars",
    provider: "India Meteorological Dept",
    instrument: "S-Band & C-Band Coastal Radars",
    spectrum: "2.7–3.0 GHz Polarimetric",
    resolution: "250m Gate Resolution",
    cadence: "10 Minutes (Volume Scan)",
    latency: "2.1 min network latency",
    status: "ONLINE",
    coverage: "Mumbai, Goa, Kochi, Chennai, Visakhapatnam, Paradip, Kolkata",
    description: "Ground-truth radial velocity and precipitation reflectivity (Z) matrices validating eyewall mesovortices and rainfall rate conversion.",
    dataPoints: 21600,
    flowColor: "#10b981",
  },
  {
    id: "ecmwf-ifs",
    name: "ECMWF IFS & GFS Ensembles",
    provider: "ECMWF / NOAA NCEP",
    instrument: "Numerical Weather Prediction Suite",
    spectrum: "Synoptic Pressure & 500 hPa Steering",
    resolution: "0.25° × 0.25° (~25 km)",
    cadence: "6 Hours (00, 06, 12, 18 UTC)",
    latency: "45 min post-cycle",
    status: "SYNCED",
    coverage: "Synoptic NIO Domain",
    description: "Global numerical atmospheric boundary conditions providing steering flows, deep tropospheric shear, and 72h track dispersion.",
    dataPoints: 8640,
    flowColor: "#f59e0b",
  },
  {
    id: "noaa-ibtracs",
    name: "NOAA IBTrACS v04 Archive",
    provider: "NOAA NCEI",
    instrument: "Best-Track Multi-Agency Archive",
    spectrum: "1848–Present Historical NIO Tracks",
    resolution: "Point Coordinates & 1-min / 3-min Vmax",
    cadence: "Historical Benchmark Suite",
    latency: "Post-Season Validated",
    status: "ONLINE",
    coverage: "Global Tropical Basins",
    description: "Verified historical cyclone tracks and central pressure series utilized for back-testing Holland B peaking parameters.",
    dataPoints: 34200,
    flowColor: "#a855f7",
  },
  {
    id: "osm-cadastre",
    name: "OpenStreetMap Building Cadastre",
    provider: "OSM / Local Municipal GIS",
    instrument: "Vector Building Footprints & Roads",
    spectrum: "200m Spatial Exposure Grid",
    resolution: "Parcel-Level Polygon Geometry",
    cadence: "Dynamic Continuous Ingestion",
    latency: "Instant Database Cache",
    status: "ONLINE",
    coverage: "Coastal Districts of Maharashtra & Gujarat",
    description: "Structural GIS polygons and lifelines intersected with wind pressure fields to calculate parcel-level damage fragility.",
    dataPoints: 54000,
    flowColor: "#ec4899",
  },
];

const API_ENDPOINTS = [
  {
    method: "GET" as const,
    path: "/api/dataset/summary",
    description: "Retrieve active cyclone target telemetry, storm metadata, and real-time bounding box.",
    sampleResponse: `{\n  "total_records": 14400,\n  "storm_name": "NISARGA",\n  "active_coordinates": { "lat": 18.35, "lon": 72.98 },\n  "current_vmax_kph": 120,\n  "min_pressure_hpa": 984,\n  "resolution": "200m Physical Grid"\n}`,
  },
  {
    method: "POST" as const,
    path: "/api/ai/analyze-cyclone",
    description: "Execute Automated Dvorak Technique (ADT) and ResNet inference on coordinate/intensity parameters.",
    samplePayload: `{\n  "lat": 18.35,\n  "lon": 72.98,\n  "wind_kph": 120,\n  "pressure_hpa": 984\n}`,
    sampleResponse: `{\n  "dvorak_t_number": 4.5,\n  "raw_adt": 4.38,\n  "eye_temp_c": -38.2,\n  "cloud_top_c": -74.8,\n  "confidence": 0.947,\n  "category": "VSCS"\n}`,
  },
  {
    method: "POST" as const,
    path: "/api/scenario/simulate",
    description: "Run Holland 1980 wind profile and 200m building fragility screening for coastal landfalls.",
    samplePayload: `{\n  "storm_name": "nisarga",\n  "holland_b": 1.25,\n  "rmax_km": 28,\n  "pn_hpa": 1008,\n  "pc_hpa": 984\n}`,
    sampleResponse: `{\n  "peak_wind_kph": 120,\n  "peak_pressure_kpa": 1.82,\n  "critical_parcels": 24,\n  "estimated_loss_inr": 48000000\n}`,
  },
];

export default function DataSourcesPage() {
  const [selectedSourceId, setSelectedSourceId] = useState<string>("insat-3dr");
  const [activeEndpointIdx, setActiveEndpointIdx] = useState<number>(0);
  const [apiOutput, setApiOutput] = useState<string>("");
  const [isRunningApi, setIsRunningApi] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const activeSource = DATA_SOURCES.find(s => s.id === selectedSourceId) || DATA_SOURCES[0];
  const activeEndpoint = API_ENDPOINTS[activeEndpointIdx];

  const handleRunEndpoint = () => {
    setIsRunningApi(true);
    setTimeout(() => {
      setApiOutput(activeEndpoint.sampleResponse);
      setIsRunningApi(false);
    }, 400);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">

        {/* Editorial Header */}
        <div className="op-editorial-header" style={{ marginBottom: "20px" }}>
          <div>
            <div className="op-section-kicker">
              <Radio size={12} style={{ display: "inline", marginRight: "6px" }} />
              TELEMETRY INGESTION PIPELINE &middot; MULTI-SOURCE FEEDS
            </div>
            <h1 className="op-section-title" style={{ fontSize: "28px" }}>
              Data Sources &amp; REST API Pipeline
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Visualizing the multi-source earth observation architecture assimilating geostationary radiometry,
              Doppler radar scans, numerical atmospheric models, and cadastral GIS layers into the CycloneX engine.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981" }} />
              INGESTION BUS ACTIVE (99.98% UPTIME)
            </span>
          </div>
        </div>

        {/* PRIMARY VISUAL OBJECT: Animated Multi-Source Ingestion Pipeline Diagram */}
        <div style={{
          position: "relative",
          background: "#030508",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "4px",
          padding: "24px",
          marginBottom: "28px",
          overflow: "hidden"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#38bdf8" }}>
              DATA INGESTION BUS ARCHITECTURE
            </span>
            <span style={{ fontSize: "10.5px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
              CLICK ANY SOURCE TO INSPECT PACKET SPECIFICATION
            </span>
          </div>

          <div className="op-split-grid" style={{ gridTemplateColumns: "1.1fr 0.9fr", gap: "28px", alignItems: "center" }}>
            
            {/* Left: Interactive Data Pipeline Diagram */}
            <svg width="100%" height="280" viewBox="0 0 480 280" style={{ display: "block" }}>
              <defs>
                <linearGradient id="busGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Source Nodes (Left Stack) */}
              {DATA_SOURCES.map((s, idx) => {
                const y = 30 + idx * 52;
                const isSelected = s.id === selectedSourceId;

                return (
                  <g key={s.id} onClick={() => setSelectedSourceId(s.id)} style={{ cursor: "pointer" }}>
                    {/* Source Box */}
                    <rect
                      x="10"
                      y={y - 18}
                      width="150"
                      height="38"
                      rx="3"
                      fill={isSelected ? "rgba(56, 189, 248, 0.12)" : "#070b12"}
                      stroke={isSelected ? s.flowColor : "rgba(255, 255, 255, 0.1)"}
                      strokeWidth={isSelected ? 1.8 : 1}
                    />
                    <circle cx="24" cy={y + 1} r="4" fill={s.flowColor} />
                    <text x="36" y={y - 3} fill={isSelected ? "#ffffff" : "#cbd5e1"} fontSize="9.5" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                      {s.name.split(" ")[0]}
                    </text>
                    <text x="36" y={y + 10} fill="#64748b" fontSize="8" fontFamily="'JetBrains Mono', monospace">
                      {s.provider} &middot; {s.cadence.split(" ")[0]}
                    </text>

                    {/* Animated Flow Connecting Line */}
                    <path
                      d={`M 160,${y + 1} C 240,${y + 1} 260,140 330,140`}
                      fill="none"
                      stroke={isSelected ? s.flowColor : "rgba(255, 255, 255, 0.15)"}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeDasharray={isSelected ? "5 5" : undefined}
                      className={isSelected ? "op-stream-flow-line" : undefined}
                    />
                  </g>
                );
              })}

              {/* Central CycloneX Processing Engine Target Box */}
              <g transform="translate(330, 80)">
                <rect
                  x="0"
                  y="0"
                  width="140"
                  height="120"
                  rx="4"
                  fill="#06090e"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  filter="drop-shadow(0 0 16px rgba(56, 189, 248, 0.25))"
                />
                <circle cx="70" cy="35" r="14" fill="rgba(56, 189, 248, 0.1)" stroke="#38bdf8" strokeWidth="1.5" />
                <text x="70" y="39" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">X</text>
                
                <text x="70" y="65" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">CYCLONEX</text>
                <text x="70" y="80" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="'JetBrains Mono', monospace">NORMALIZATION</text>
                <text x="70" y="93" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">200m GRID ENGINE</text>
                <text x="70" y="106" textAnchor="middle" fill="#64748b" fontSize="7.5" fontFamily="'JetBrains Mono', monospace">LATENCY: &lt; 1.8s</text>
              </g>
            </svg>

            {/* Right: Selected Feed Telemetry Inspector Card */}
            <div style={{ background: "#05080e", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "16px", borderRadius: "3px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>{activeSource.name}</span>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: activeSource.flowColor, border: `1px solid ${activeSource.flowColor}`, padding: "1px 6px", borderRadius: "2px" }}>
                  {activeSource.status}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px" }}>
                {activeSource.provider} &middot; {activeSource.instrument}
              </div>

              <p style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 14px" }}>
                {activeSource.description}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10.5px", fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ padding: "6px 8px", background: "#020407", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b", fontSize: "9px" }}>RESOLUTION</div>
                  <div style={{ color: "#cbd5e1" }}>{activeSource.resolution}</div>
                </div>
                <div style={{ padding: "6px 8px", background: "#020407", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b", fontSize: "9px" }}>CADENCE</div>
                  <div style={{ color: "#38bdf8" }}>{activeSource.cadence}</div>
                </div>
                <div style={{ padding: "6px 8px", background: "#020407", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b", fontSize: "9px" }}>INGEST LATENCY</div>
                  <div style={{ color: "#10b981" }}>{activeSource.latency}</div>
                </div>
                <div style={{ padding: "6px 8px", background: "#020407", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b", fontSize: "9px" }}>COVERAGE</div>
                  <div style={{ color: "#cbd5e1" }}>{activeSource.coverage.split("(")[0]}</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Tabular Ingestion Infrastructure Ledger */}
        <div className="op-technical-panel" style={{ padding: "16px 20px", marginBottom: "28px" }}>
          <div className="op-tech-panel-header" style={{ marginBottom: "10px" }}>
            <div className="op-tech-panel-title">
              <Database size={13} style={{ color: "#38bdf8" }} />
              <span>EARTH OBSERVATION DATA FEEDS SPECIFICATION</span>
            </div>
            <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#64748b" }}>
              5 FEDERATED STREAMS
            </span>
          </div>

          <table className="op-ledger-table" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>SOURCE</th>
                <th>OPERATOR</th>
                <th>SPECTRUM / INSTRUMENT</th>
                <th>SPATIAL RESOLUTION</th>
                <th>CADENCE</th>
                <th>INGEST LATENCY</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map(s => (
                <tr
                  key={s.id}
                  style={{
                    background: s.id === selectedSourceId ? "rgba(56, 189, 248, 0.06)" : undefined,
                    cursor: "pointer"
                  }}
                  onClick={() => setSelectedSourceId(s.id)}
                >
                  <td style={{ fontWeight: 700, color: s.id === selectedSourceId ? "#38bdf8" : "#ffffff" }}>
                    {s.name}
                  </td>
                  <td>{s.provider}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.spectrum}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.resolution}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "#38bdf8" }}>{s.cadence}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "#10b981" }}>{s.latency}</td>
                  <td>
                    <span style={{ color: "#10b981", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px" }}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Interactive Developer REST API Test Bench */}
        <div className="op-technical-panel">
          <div className="op-tech-panel-header">
            <div className="op-tech-panel-title">
              <Terminal size={14} style={{ color: "#38bdf8" }} />
              <span>INTERACTIVE DEVELOPER REST API CONSOLE</span>
            </div>
            <span className="op-tech-panel-badge">FASTAPI BACKEND :8000</span>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto" }}>
            {API_ENDPOINTS.map((ep, idx) => (
              <button
                key={ep.path}
                type="button"
                className={`op-layer-tab ${activeEndpointIdx === idx ? "active" : ""}`}
                onClick={() => {
                  setActiveEndpointIdx(idx);
                  setApiOutput("");
                }}
                style={{ padding: "6px 12px", fontSize: "11px" }}
              >
                <span style={{ color: ep.method === "GET" ? "#10b981" : "#38bdf8", marginRight: "6px", fontWeight: 800 }}>
                  {ep.method}
                </span>
                {ep.path}
              </button>
            ))}
          </div>

          <div className="op-split-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "8px" }}>
                {activeEndpoint.description}
              </div>

              {activeEndpoint.samplePayload && (
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>
                    REQUEST BODY (JSON):
                  </div>
                  <pre style={{ margin: 0, padding: "10px", background: "#020408", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", fontSize: "11px", color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace" }}>
                    {activeEndpoint.samplePayload}
                  </pre>
                </div>
              )}

              <button
                type="button"
                className="op-btn-primary"
                onClick={handleRunEndpoint}
                disabled={isRunningApi}
                style={{ padding: "8px 16px", fontSize: "12px" }}
              >
                <Play size={13} />
                <span>{isRunningApi ? "Executing Request..." : "Test Endpoint Live"}</span>
              </button>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                  RESPONSE PAYLOAD (200 OK):
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(apiOutput || activeEndpoint.sampleResponse)}
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "10.5px" }}
                >
                  {copiedPath ? <Check size={12} style={{ color: "#10b981" }} /> : <Copy size={12} />}
                </button>
              </div>
              <pre style={{
                margin: 0,
                padding: "12px",
                background: "#020408",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "3px",
                fontSize: "11px",
                color: "#10b981",
                fontFamily: "'JetBrains Mono', monospace",
                minHeight: "140px",
                overflowX: "auto"
              }}>
                {apiOutput || activeEndpoint.sampleResponse}
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
