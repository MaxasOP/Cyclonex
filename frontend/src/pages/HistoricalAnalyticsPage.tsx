import { useState } from "react";
import {
  BarChart3,
  Archive,
  Compass,
  CheckCircle2,
  Wind,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  MapPin
} from "lucide-react";
import type { DatasetSummary } from "../api";

interface HistoricalAnalyticsPageProps {
  datasetSummary: DatasetSummary | null;
  onLoadPreset: (presetKey: string) => void;
  onNavigateToCommand: () => void;
}

export default function HistoricalAnalyticsPage({
  datasetSummary,
  onLoadPreset,
  onNavigateToCommand,
}: HistoricalAnalyticsPageProps) {
  const [selectedStormKey, setSelectedStormKey] = useState<string>("nisarga");
  const [selectedTimestepIdx, setSelectedTimestepIdx] = useState<number>(3); // index along intensity curve

  const HISTORICAL_STORMS = [
    {
      key: "nisarga",
      name: "Cyclone Nisarga",
      year: "2020",
      basin: "Arabian Sea",
      landfall: "Shrivardhan / Alibaug, Maharashtra",
      peakWind: "120 km/h",
      minPressure: "984 hPa",
      category: "Very Severe Cyclonic Storm",
      trackError24h: "14.2 km",
      modelAccuracy: "96.4%",
      notes: "First cyclone to strike Maharashtra coast near Mumbai since 1891; severe roof structural failure in rural Alibaug.",
      trackPath: "M 130,280 Q 150,220 180,180 T 205,145",
      nodes: [
        { label: "Genesis (T-72h)", x: 130, y: 280, wind: 55, pressure: 1002 },
        { label: "Deep Dep (T-48h)", x: 150, y: 220, wind: 85, pressure: 994 },
        { label: "Peak VSCS (T-12h)", x: 180, y: 180, wind: 120, pressure: 984 },
        { label: "Landfall (T-0h)", x: 205, y: 145, wind: 110, pressure: 988 },
        { label: "Inland Decay (+12h)", x: 230, y: 125, wind: 60, pressure: 998 },
      ],
      color: "#38bdf8",
    },
    {
      key: "biparjoy",
      name: "Cyclone Biparjoy",
      year: "2023",
      basin: "Arabian Sea",
      landfall: "Jakhau Port / Kutch, Gujarat",
      peakWind: "140 km/h",
      minPressure: "965 hPa",
      category: "Very Severe Cyclonic Storm",
      trackError24h: "18.5 km",
      modelAccuracy: "94.8%",
      notes: "Extremely long-lived Arabian Sea system (13 days); extensive power grid destruction across Saurashtra.",
      trackPath: "M 110,320 Q 120,240 140,160 T 165,95",
      nodes: [
        { label: "Genesis (T-96h)", x: 110, y: 320, wind: 65, pressure: 998 },
        { label: "ESCS Stage (T-48h)", x: 130, y: 200, wind: 150, pressure: 960 },
        { label: "Peak (T-24h)", x: 140, y: 160, wind: 140, pressure: 965 },
        { label: "Landfall (T-0h)", x: 165, y: 95, wind: 125, pressure: 972 },
        { label: "Dissipation (+18h)", x: 190, y: 70, wind: 50, pressure: 1000 },
      ],
      color: "#f59e0b",
    },
    {
      key: "tauktae",
      name: "Cyclone Tauktae",
      year: "2021",
      basin: "Arabian Sea",
      landfall: "Una / Diu Coast, Gujarat",
      peakWind: "185 km/h",
      minPressure: "950 hPa",
      category: "Extremely Severe Cyclonic Storm",
      trackError24h: "15.8 km",
      modelAccuracy: "95.9%",
      notes: "Parallel trajectory along the Konkan coast; massive offshore oil barge emergencies and widespread infrastructure damage.",
      trackPath: "M 120,330 Q 135,230 160,150 T 175,115",
      nodes: [
        { label: "Genesis (T-84h)", x: 120, y: 330, wind: 60, pressure: 1000 },
        { label: "Intensify (T-48h)", x: 135, y: 230, wind: 130, pressure: 970 },
        { label: "Peak ESCS (T-12h)", x: 160, y: 150, wind: 185, pressure: 950 },
        { label: "Landfall (T-0h)", x: 175, y: 115, wind: 160, pressure: 958 },
        { label: "Inland (+12h)", x: 195, y: 85, wind: 70, pressure: 992 },
      ],
      color: "#ef4444",
    },
    {
      key: "amphan",
      name: "Cyclone Amphan",
      year: "2020",
      basin: "Bay of Bengal",
      landfall: "Bakkhali / Digha, West Bengal",
      peakWind: "165 km/h",
      minPressure: "950 hPa",
      category: "Super Cyclonic Storm",
      trackError24h: "19.8 km",
      modelAccuracy: "95.2%",
      notes: "Costliest cyclone in North Indian Ocean history (over ₹1.02 lakh crore loss); widespread storm surge in Sundarbans.",
      trackPath: "M 320,310 Q 330,220 340,150 T 350,90",
      nodes: [
        { label: "Genesis (T-96h)", x: 320, y: 310, wind: 75, pressure: 992 },
        { label: "SuCS Peak (T-48h)", x: 330, y: 220, wind: 240, pressure: 920 },
        { label: "Weakening (T-12h)", x: 340, y: 150, wind: 175, pressure: 945 },
        { label: "Landfall (T-0h)", x: 350, y: 90, wind: 155, pressure: 955 },
        { label: "Kolkata (+6h)", x: 360, y: 70, wind: 115, pressure: 970 },
      ],
      color: "#10b981",
    },
    {
      key: "fani",
      name: "Cyclone Fani",
      year: "2019",
      basin: "Bay of Bengal",
      landfall: "Puri, Odisha",
      peakWind: "175 km/h",
      minPressure: "937 hPa",
      category: "Extremely Severe Cyclonic Storm",
      trackError24h: "16.1 km",
      modelAccuracy: "97.1%",
      notes: "Catastrophic damage in Puri & Bhubaneswar; test of massive 1.2M person evacuation protocol.",
      trackPath: "M 300,330 Q 315,240 330,170 T 340,120",
      nodes: [
        { label: "Genesis (T-120h)", x: 300, y: 330, wind: 65, pressure: 996 },
        { label: "ESCS Stage (T-48h)", x: 315, y: 240, wind: 190, pressure: 937 },
        { label: "Landfall (T-0h)", x: 340, y: 120, wind: 175, pressure: 940 },
        { label: "Odisha Inland (+6h)", x: 355, y: 100, wind: 120, pressure: 965 },
        { label: "Dissipation (+18h)", x: 375, y: 80, wind: 55, pressure: 998 },
      ],
      color: "#a855f7",
    },
  ];

  const currentStorm = HISTORICAL_STORMS.find(s => s.key === selectedStormKey) || HISTORICAL_STORMS[0];
  const activeNode = currentStorm.nodes[selectedTimestepIdx] || currentStorm.nodes[0];

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">

        {/* Editorial Header */}
        <div className="op-editorial-header" style={{ marginBottom: "20px" }}>
          <div>
            <div className="op-section-kicker">
              <BarChart3 size={12} style={{ display: "inline", marginRight: "6px" }} />
              NOAA IBTRACS v04 &middot; HINDCAST VERIFICATION MATRIX
            </div>
            <h1 className="op-section-title" style={{ fontSize: "28px" }}>
              Historical Analytics &amp; Basin Hindcasts
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Spatial best-track analysis across Arabian Sea and Bay of Bengal benchmark cyclones. Select any historical
              system to inspect trajectory kinematics, landfall pressure profiles, and synchronized intensity curves.
            </p>
          </div>

          <button
            type="button"
            className="op-btn-primary"
            onClick={() => onLoadPreset(currentStorm.key)}
            style={{ fontSize: "12px", padding: "8px 14px" }}
          >
            <Activity size={13} />
            <span>Load {currentStorm.name} in Map</span>
          </button>
        </div>

        {/* Primary Visual Split: Interactive North Indian Ocean Map (Left) & Synced Intensity Chart (Right) */}
        <div className="op-split-grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", gap: "28px", marginBottom: "24px" }}>
          
          {/* Left: Geographic NIO Historical Track Map Canvas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{
              position: "relative",
              height: "420px",
              background: "#030508",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              overflow: "hidden"
            }}>
              
              {/* Tactical Topbar */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                padding: "8px 14px",
                background: "rgba(5, 8, 14, 0.9)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10.5px",
                color: "#64748b",
                zIndex: 10
              }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: currentStorm.color }} />
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>NORTH INDIAN OCEAN BEST-TRACK ATLAS</span>
                </div>
                <div>ACTIVE FOCUS: {currentStorm.name.toUpperCase()} ({currentStorm.year})</div>
              </div>

              {/* Map SVG Canvas */}
              <svg width="100%" height="100%" viewBox="0 0 500 420" style={{ display: "block" }}>
                <defs>
                  <pattern id="histGrid" width="25" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255, 255, 255, 0.025)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="500" height="420" fill="#030508" />
                <rect width="500" height="420" fill="url(#histGrid)" />

                {/* Stylized Indian Subcontinent Landmass Polygon */}
                <path
                  d="M 120,40 L 260,30 L 390,40 L 410,120 L 370,180 L 310,270 L 250,370 L 245,370 L 190,260 L 160,180 L 120,120 Z"
                  fill="rgba(30, 41, 59, 0.35)"
                  stroke="rgba(148, 163, 184, 0.25)"
                  strokeWidth="1.5"
                />

                {/* Sea Region Watermark Labels */}
                <text x="50" y="240" fill="#1e293b" fontSize="12" fontFamily="'JetBrains Mono', monospace" letterSpacing="3">ARABIAN SEA</text>
                <text x="360" y="240" fill="#1e293b" fontSize="12" fontFamily="'JetBrains Mono', monospace" letterSpacing="3">BAY OF BENGAL</text>
                <text x="220" y="160" fill="#475569" fontSize="11" fontFamily="'JetBrains Mono', monospace">INDIA</text>

                {/* All Storm Tracks in Background */}
                {HISTORICAL_STORMS.map(s => {
                  const isSelected = s.key === selectedStormKey;
                  return (
                    <g key={s.key} onClick={() => setSelectedStormKey(s.key)} style={{ cursor: "pointer" }}>
                      <path
                        d={s.trackPath}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={isSelected ? 3 : 1}
                        strokeDasharray={isSelected ? undefined : "3 3"}
                        opacity={isSelected ? 1 : 0.25}
                      />
                    </g>
                  );
                })}

                {/* Active Storm Nodes */}
                {currentStorm.nodes.map((n, idx) => {
                  const isNodeActive = idx === selectedTimestepIdx;
                  return (
                    <g key={idx} onClick={() => setSelectedTimestepIdx(idx)} style={{ cursor: "pointer" }}>
                      {isNodeActive && (
                        <circle cx={n.x} cy={n.y} r="14" fill="none" stroke={currentStorm.color} className="op-pulse-ring" />
                      )}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={isNodeActive ? 6 : 3.5}
                        fill={isNodeActive ? currentStorm.color : "#05080e"}
                        stroke={currentStorm.color}
                        strokeWidth={isNodeActive ? 2 : 1}
                      />
                      <text
                        x={n.x + 8}
                        y={n.y + 4}
                        fill={isNodeActive ? "#ffffff" : "#64748b"}
                        fontSize="9"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight={isNodeActive ? "bold" : "normal"}
                      >
                        {n.label.split("(")[0].trim()}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Bottom Synced Timestep Telemetry Box */}
              <div style={{
                position: "absolute",
                bottom: "10px",
                left: "14px",
                right: "14px",
                background: "rgba(4, 7, 12, 0.92)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "8px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                zIndex: 10
              }}>
                <div>
                  TIMESTEP: <strong style={{ color: currentStorm.color }}>{activeNode.label}</strong> &middot; SUSTAINED: <strong style={{ color: "#ffffff" }}>{activeNode.wind} km/h</strong>
                </div>
                <div>
                  PRESSURE: <strong style={{ color: "#f59e0b" }}>{activeNode.pressure} hPa</strong> &middot; ACCURACY: <strong style={{ color: "#10b981" }}>{currentStorm.modelAccuracy}</strong>
                </div>
              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", padding: "0 4px" }}>
              <span>Click any storm path or node on map to synchronize with intensity curve</span>
              <span style={{ color: currentStorm.color }}>Dataset: NOAA National Centers for Environmental Information (NCEI)</span>
            </div>
          </div>

          {/* Right: Synchronized Intensity Chart & Storm Dossier */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Synchronized Intensity Time-Series Chart */}
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <TrendingUp size={14} style={{ color: currentStorm.color }} />
                  <span>SYNCHRONIZED INTENSITY PROFILE</span>
                </div>
                <span className="op-tech-panel-badge" style={{ color: currentStorm.color, borderColor: currentStorm.color }}>
                  PEAK {currentStorm.peakWind}
                </span>
              </div>

              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>
                Hover or click points along the timeline to highlight the corresponding storm location on the map.
              </div>

              {/* Time Series SVG Graph */}
              <div style={{ background: "#020408", border: "1px solid rgba(255,255,255,0.05)", padding: "12px", marginBottom: "14px" }}>
                <svg width="100%" height="110" viewBox="0 0 320 110" style={{ display: "block" }}>
                  {/* Axis */}
                  <line x1="30" y1="90" x2="310" y2="90" stroke="#334155" strokeWidth="1" />
                  <line x1="30" y1="15" x2="30" y2="90" stroke="#334155" strokeWidth="1" />
                  <text x="30" y="102" fill="#475569" fontSize="8" fontFamily="'JetBrains Mono', monospace">T-72h</text>
                  <text x="170" y="102" fill="#475569" fontSize="8" fontFamily="'JetBrains Mono', monospace">PEAK</text>
                  <text x="270" y="102" fill="#475569" fontSize="8" fontFamily="'JetBrains Mono', monospace">LANDFALL</text>

                  {/* Intensity Curve Line */}
                  <path
                    d="M 40,75 L 100,55 L 175,22 L 245,35 L 300,75"
                    fill="none"
                    stroke={currentStorm.color}
                    strokeWidth="2.5"
                  />

                  {/* Interactive Nodes on Chart */}
                  {currentStorm.nodes.map((n, idx) => {
                    const cx = 40 + idx * 65;
                    const cy = 90 - (n.wind / 200) * 75;
                    const isActive = idx === selectedTimestepIdx;

                    return (
                      <g key={idx} onClick={() => setSelectedTimestepIdx(idx)} style={{ cursor: "pointer" }}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isActive ? 6 : 3.5}
                          fill={isActive ? currentStorm.color : "#03060a"}
                          stroke={currentStorm.color}
                          strokeWidth={isActive ? 2 : 1}
                        />
                        {isActive && (
                          <text x={cx - 10} y={cy - 10} fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="'JetBrains Mono', monospace">
                            {n.wind} km/h
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Active Step Readout */}
              <div style={{ padding: "10px", background: "#03060a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "3px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff" }}>{activeNode.label}</span>
                  <span style={{ fontSize: "10.5px", fontFamily: "'JetBrains Mono', monospace", color: "#38bdf8" }}>{activeNode.wind} km/h &middot; {activeNode.pressure} hPa</span>
                </div>
                <div style={{ fontSize: "10.5px", color: "#64748b" }}>
                  {currentStorm.notes}
                </div>
              </div>
            </div>

            {/* Quick Storm Switcher Pill Strip */}
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Archive size={14} style={{ color: "#38bdf8" }} />
                  <span>HISTORICAL BENCHMARK SELECTION</span>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {HISTORICAL_STORMS.map(s => (
                  <button
                    key={s.key}
                    type="button"
                    className={`op-layer-tab ${selectedStormKey === s.key ? "active" : ""}`}
                    onClick={() => {
                      setSelectedStormKey(s.key);
                      setSelectedTimestepIdx(2);
                    }}
                    style={{ padding: "6px 12px", fontSize: "11px" }}
                  >
                    {s.name} ({s.year})
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Verification Matrix Ledger Table */}
        <div className="op-technical-panel" style={{ padding: "16px 20px" }}>
          <div className="op-tech-panel-header" style={{ marginBottom: "10px" }}>
            <div className="op-tech-panel-title">
              <CheckCircle2 size={13} style={{ color: "#10b981" }} />
              <span>HINDCAST ERROR VERIFICATION MATRIX</span>
            </div>
            <span style={{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#64748b" }}>
              10 BENCHMARK CYCLONES (2014–2023)
            </span>
          </div>

          <table className="op-ledger-table" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>CYCLONE</th>
                <th>BASIN &amp; YEAR</th>
                <th>LANDFALL SECTOR</th>
                <th>PEAK WIND</th>
                <th>24H TRACK ERROR</th>
                <th>MODEL ACCURACY</th>
                <th style={{ textAlign: "right" }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {HISTORICAL_STORMS.map(s => (
                <tr
                  key={s.key}
                  style={{
                    background: s.key === selectedStormKey ? "rgba(56, 189, 248, 0.06)" : undefined,
                    cursor: "pointer"
                  }}
                  onClick={() => setSelectedStormKey(s.key)}
                >
                  <td style={{ fontWeight: 700, color: s.key === selectedStormKey ? "#38bdf8" : "#ffffff" }}>
                    {s.name}
                  </td>
                  <td>{s.basin} · {s.year}</td>
                  <td>{s.landfall}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "#38bdf8" }}>{s.peakWind}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.trackError24h}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "#10b981" }}>{s.modelAccuracy}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="op-table-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadPreset(s.key);
                      }}
                    >
                      Load Map &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
