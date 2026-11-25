import { apiBaseUrl } from "../api";
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
  status: string;
  coverage: string;
  description: string;
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
    latency: "Not measured",
    status: "Catalogue",
    coverage: "North Indian Ocean (0°N–35°N, 45°E–105°E)",
    description: "Satellite imagery can be supplied manually to the AI Lab.",
    flowColor: "#8b5cf6",
  },
  {
    id: "imd-dwr",
    name: "IMD Doppler Weather Radars",
    provider: "India Meteorological Dept",
    instrument: "S-Band & C-Band Coastal Radars",
    spectrum: "2.7–3.0 GHz Polarimetric",
    resolution: "250m Gate Resolution",
    cadence: "10 Minutes (Volume Scan)",
    latency: "Not measured",
    status: "Catalogue",
    coverage: "Mumbai, Goa, Kochi, Chennai, Visakhapatnam, Paradip, Kolkata",
    description: "Reference radar instrument. No active radar ingestion is configured.",
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
    latency: "Not measured",
    status: "Catalogue",
    coverage: "Synoptic NIO Domain",
    description: "Reference forecast products. The scenario forecast uses the model identified in its API response.",
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
    latency: "Not measured",
    status: "Catalogue",
    coverage: "Global Tropical Basins",
    description: "Historical best-track records can be imported into the training dataset.",
    flowColor: "#a855f7",
  },
  {
    id: "osm-cadastre",
    name: "OpenStreetMap Building Cadastre",
    provider: "OSM / Local Municipal GIS",
    instrument: "Vector Building Footprints & Roads",
    spectrum: "200m Spatial Exposure Grid",
    resolution: "Parcel-Level Polygon Geometry",
    cadence: "Bundled or on request",
    latency: "Not measured",
    status: "Catalogue",
    coverage: "Coastal Districts of Maharashtra & Gujarat",
    description: "Structural GIS polygons and lifelines intersected with wind pressure fields to calculate parcel-level damage fragility.",
    flowColor: "#ec4899",
  },
];

const API_ENDPOINTS: Array<{method: "GET" | "POST"; path: string; description: string; samplePayload?: string}> = [
  {method: "GET", path: "/api/v3/dataset-summary", description: "Read the current observation, label, training and split counts."},
  {method: "GET", path: "/api/ai/models-status", description: "Check which experimental model weights are available."},
  {method: "POST", path: "/api/v3/inference", description: "Generate a forecast for the example storm inputs.",
    samplePayload: JSON.stringify({centre_lat: 18.35, centre_lon: 72.98, max_sustained_wind_kph: 120, central_pressure_hpa: 984, heading_deg: 35, speed_kph: 22}, null, 2)},
];

export default function DataSourcesPage() {
  const [selectedSourceId, setSelectedSourceId] = useState<string>("insat-3dr");
  const [activeEndpointIdx, setActiveEndpointIdx] = useState<number>(0);
  const [apiOutput, setApiOutput] = useState<string>("");
  const [isRunningApi, setIsRunningApi] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const activeSource = DATA_SOURCES.find(s => s.id === selectedSourceId) || DATA_SOURCES[0];
  const activeEndpoint = API_ENDPOINTS[activeEndpointIdx];

  const handleRunEndpoint = async () => {
    setIsRunningApi(true);
    setApiOutput("");
    try {
      const response = await fetch(apiBaseUrl + activeEndpoint.path, {
        method: activeEndpoint.method,
        headers: activeEndpoint.samplePayload ? {"Content-Type": "application/json"} : undefined,
        body: activeEndpoint.samplePayload,
      });
      const body = await response.text();
      let formatted = body;
      try { formatted = JSON.stringify(JSON.parse(body), null, 2); } catch { /* Plain-text provider response */ }
      setApiOutput(`HTTP ${response.status}\n${formatted}`);
    } catch (error) {
      setApiOutput(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setIsRunningApi(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPath(text);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch { setCopiedPath(null); }
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
              Browse reference datasets and query the running backend below for dataset counts and model availability.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981" }} />
              REFERENCE CATALOGUE
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
            <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#8b5cf6" }}>
              DATA INGESTION BUS ARCHITECTURE
            </span>
            <span style={{ fontSize: "10.5px", color: "#64748b", fontFamily: "'Space Mono', monospace" }}>
              CLICK ANY SOURCE TO INSPECT PACKET SPECIFICATION
            </span>
          </div>

          <div className="op-split-grid" style={{ gridTemplateColumns: "1.1fr 0.9fr", gap: "28px", alignItems: "center" }}>
            
            {/* Left: Interactive Data Pipeline Diagram */}
            <svg width="100%" height="280" viewBox="0 0 480 280" style={{ display: "block" }}>
              <defs>
                <linearGradient id="busGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
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
                    <text x="36" y={y - 3} fill={isSelected ? "#ffffff" : "#cbd5e1"} fontSize="9.5" fontWeight="bold" fontFamily="'Space Mono', monospace">
                      {s.name.split(" ")[0]}
                    </text>
                    <text x="36" y={y + 10} fill="#64748b" fontSize="8" fontFamily="'Space Mono', monospace">
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
                  stroke="#8b5cf6"
                  strokeWidth="2"
                  filter="drop-shadow(0 0 16px rgba(56, 189, 248, 0.25))"
                />
                <circle cx="70" cy="35" r="14" fill="rgba(56, 189, 248, 0.1)" stroke="#8b5cf6" strokeWidth="1.5" />
                <text x="70" y="39" textAnchor="middle" fill="#8b5cf6" fontSize="10" fontWeight="bold" fontFamily="'Space Mono', monospace">X</text>
                
                <text x="70" y="65" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="'Space Mono', monospace">CYCLONEX</text>
                <text x="70" y="80" textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="'Space Mono', monospace">NORMALIZATION</text>
                <text x="70" y="93" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="bold" fontFamily="'Space Mono', monospace">200m GRID ENGINE</text>
                <text x="70" y="106" textAnchor="middle" fill="#64748b" fontSize="7.5" fontFamily="'Space Mono', monospace">LATENCY: &lt; 1.8s</text>
              </g>
            </svg>

            {/* Right: Selected Feed Telemetry Inspector Card */}
            <div style={{ background: "#05080e", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "16px", borderRadius: "3px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>{activeSource.name}</span>
                <span style={{ fontSize: "10px", fontFamily: "'Space Mono', monospace", color: activeSource.flowColor, border: `1px solid ${activeSource.flowColor}`, padding: "1px 6px", borderRadius: "2px" }}>
                  {activeSource.status}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "12px" }}>
                {activeSource.provider} &middot; {activeSource.instrument}
              </div>

              <p style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 14px" }}>
                {activeSource.description}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10.5px", fontFamily: "'Space Mono', monospace" }}>
                <div style={{ padding: "6px 8px", background: "#020407", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b", fontSize: "9px" }}>RESOLUTION</div>
                  <div style={{ color: "#cbd5e1" }}>{activeSource.resolution}</div>
                </div>
                <div style={{ padding: "6px 8px", background: "#020407", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b", fontSize: "9px" }}>CADENCE</div>
                  <div style={{ color: "#8b5cf6" }}>{activeSource.cadence}</div>
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
              <Database size={13} style={{ color: "#8b5cf6" }} />
              <span>EARTH OBSERVATION DATA FEEDS SPECIFICATION</span>
            </div>
            <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#64748b" }}>
              5 CATALOGUE ENTRIES
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
                  <td style={{ fontWeight: 700, color: s.id === selectedSourceId ? "#8b5cf6" : "#ffffff" }}>
                    {s.name}
                  </td>
                  <td>{s.provider}</td>
                  <td style={{ fontFamily: "'Space Mono', monospace" }}>{s.spectrum}</td>
                  <td style={{ fontFamily: "'Space Mono', monospace" }}>{s.resolution}</td>
                  <td style={{ fontFamily: "'Space Mono', monospace", color: "#8b5cf6" }}>{s.cadence}</td>
                  <td style={{ fontFamily: "'Space Mono', monospace", color: "#10b981" }}>{s.latency}</td>
                  <td>
                    <span style={{ color: "#10b981", fontWeight: 700, fontFamily: "'Space Mono', monospace", fontSize: "10.5px" }}>
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
              <Terminal size={14} style={{ color: "#8b5cf6" }} />
              <span>INTERACTIVE DEVELOPER REST API CONSOLE</span>
            </div>
            <span className="op-tech-panel-badge">FASTAPI BACKEND :8000</span>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto" }}>
            {API_ENDPOINTS.map((ep, idx) => (
              <button
                key={ep.path}
                disabled={isRunningApi}
                type="button"
                className={`op-layer-tab ${activeEndpointIdx === idx ? "active" : ""}`}
                onClick={() => {
                  setActiveEndpointIdx(idx);
                  setApiOutput("");
                }}
                style={{ padding: "6px 12px", fontSize: "11px" }}
              >
                <span style={{ color: ep.method === "GET" ? "#10b981" : "#8b5cf6", marginRight: "6px", fontWeight: 800 }}>
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
                  <div style={{ fontSize: "10px", color: "#64748b", fontFamily: "'Space Mono', monospace", marginBottom: "4px" }}>
                    REQUEST BODY (JSON):
                  </div>
                  <pre style={{ margin: 0, padding: "10px", background: "#020408", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px", fontSize: "11px", color: "#8b5cf6", fontFamily: "'Space Mono', monospace" }}>
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
                <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "'Space Mono', monospace" }}>
                  HTTP RESPONSE
                </span>
                <button
                  type="button"
                  disabled={!apiOutput}
                  aria-label="Copy API response"
                  onClick={() => handleCopy(apiOutput)}
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
                fontFamily: "'Space Mono', monospace",
                minHeight: "140px", maxHeight: "430px", overflowY: "auto",
                overflowX: "auto"
              }}>
                {apiOutput || "Run the request to view its response."}
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
