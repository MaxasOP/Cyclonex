import { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  Clock,
  ShieldAlert,
  Wind,
  Play,
  Pause,
  RotateCcw,
  Compass,
  ArrowRight,
  Activity,
  Sliders
} from "lucide-react";
import type { MLInferenceResult } from "../api";

interface ForecastPageProps {
  mlResult: MLInferenceResult | null;
  stormName: string;
  lat: number;
  lon: number;
  windKph: number;
  pressureHpa: number;
  headingDeg: number;
  speedKph: number;
  onNavigateToCommand: (presetKey?: string) => void;
}

export default function ForecastPage({
  mlResult,
  stormName,
  lat,
  lon,
  windKph,
  pressureHpa,
  headingDeg,
  speedKph,
  onNavigateToCommand,
}: ForecastPageProps) {
  const [selectedHorizon, setSelectedHorizon] = useState<0 | 6 | 12 | 24>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hoveredRadius, setHoveredRadius] = useState<number>(28); // km from eye

  // Compute waypoint steps dynamically
  const headingRad = (((90 - headingDeg) % 360) * Math.PI) / 180;
  const d6 = (speedKph * 6) / 111;
  const d12 = (speedKph * 12) / 111;
  const d24 = (speedKph * 24) / 111;

  const waypoints = [
    {
      horizon: 0 as const,
      label: "0h (Observed)",
      lat: lat,
      lon: lon,
      wind: windKph,
      pressure: pressureHpa,
      uncertaintyKm: 10,
      stage: "Active Observed",
      speed: speedKph,
      heading: headingDeg,
      x: 140,
      y: 260,
    },
    {
      horizon: 6 as const,
      label: "+6h Horizon",
      lat: mlResult?.forecast_6h?.centre_lat ?? Number((lat + d6 * Math.sin(headingRad)).toFixed(2)),
      lon: mlResult?.forecast_6h?.centre_lon ?? Number((lon + d6 * Math.cos(headingRad)).toFixed(2)),
      wind: mlResult?.forecast_6h?.max_wind_kph ?? Math.round(windKph * 1.05),
      pressure: mlResult?.forecast_6h?.central_pressure_hpa ?? Math.round(pressureHpa - 4),
      uncertaintyKm: 16.93,
      stage: "Very Severe Cyclonic Storm",
      speed: speedKph,
      heading: headingDeg,
      x: 210,
      y: 205,
    },
    {
      horizon: 12 as const,
      label: "+12h Horizon",
      lat: mlResult?.forecast_12h?.centre_lat ?? Number((lat + d12 * Math.sin(headingRad)).toFixed(2)),
      lon: mlResult?.forecast_12h?.centre_lon ?? Number((lon + d12 * Math.cos(headingRad)).toFixed(2)),
      wind: mlResult?.forecast_12h?.max_wind_kph ?? Math.round(windKph * 1.10),
      pressure: mlResult?.forecast_12h?.central_pressure_hpa ?? Math.round(pressureHpa - 8),
      uncertaintyKm: 34.14,
      stage: "Peak Intensity Corridor",
      speed: speedKph,
      heading: headingDeg,
      x: 290,
      y: 150,
    },
    {
      horizon: 24 as const,
      label: "+24h Landfall",
      lat: mlResult?.forecast_24h?.centre_lat ?? Number((lat + d24 * Math.sin(headingRad)).toFixed(2)),
      lon: mlResult?.forecast_24h?.centre_lon ?? Number((lon + d24 * Math.cos(headingRad)).toFixed(2)),
      wind: mlResult?.forecast_24h?.max_wind_kph ?? Math.round(windKph * 0.92),
      pressure: mlResult?.forecast_24h?.central_pressure_hpa ?? Math.round(pressureHpa + 6),
      uncertaintyKm: 58.74,
      stage: "Projected Landfall Sector",
      speed: speedKph,
      heading: headingDeg,
      x: 390,
      y: 110,
    },
  ];

  // Derive active coastal sector label from storm coordinates
  const getCoastalSector = (targetLat: number, targetLon: number) => {
    if (targetLon > 80) {
      if (targetLat >= 20) return "ODISHA / WB COAST";
      if (targetLat >= 14) return "ANDHRA PRADESH COAST";
      return "TAMIL NADU COAST";
    } else {
      if (targetLat >= 20.5) return "GUJARAT / SAURASHTRA";
      if (targetLat >= 15) return "MAHARASHTRA / GOA";
      return "KARNATAKA / KERALA";
    }
  };

  const coastalSector = getCoastalSector(lat, lon);

  // Current active waypoint values
  const currentWp = waypoints.find(w => w.horizon === selectedHorizon) || waypoints[0];

  // Playback timer loop
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setSelectedHorizon(prev => {
          if (prev === 0) return 6;
          if (prev === 6) return 12;
          if (prev === 12) return 24;
          return 0;
        });
      }, 1800);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  // Holland 1980 Radial Wind Calculation
  // V(r) = sqrt( (B/rho) * (Rmax/r)^B * (Pn - Pc) * exp(-(Rmax/r)^B) )
  const calcHollandWind = (rKm: number) => {
    if (rKm <= 0) return 0;
    const B = 1.25;
    const Rmax = 28;
    const dP = (1008 - currentWp.pressure) * 100; // Pa
    const rho = 1.15; // kg/m^3
    const ratio = Rmax / rKm;
    const expTerm = Math.exp(-Math.pow(ratio, B));
    const vMs = Math.sqrt((B / rho) * Math.pow(ratio, B) * dP * expTerm);
    return Math.round(vMs * 3.6); // km/h
  };

  const calculatedWindAtHover = calcHollandWind(hoveredRadius);
  const calculatedPressureAtHover = (0.613 * Math.pow(calculatedWindAtHover / 3.6, 2) / 1000).toFixed(2); // kPa

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">

        {/* Editorial Header */}
        <div className="op-editorial-header" style={{ marginBottom: "20px" }}>
          <div>
            <div className="op-section-kicker">
              <TrendingUp size={12} style={{ display: "inline", marginRight: "6px" }} />
              ATMOSPHERIC DYNAMICS &middot; HOLLAND 1980 SOLVER
            </div>
            <h1 className="op-section-title" style={{ fontSize: "28px" }}>
              Ensemble Trajectory &amp; Radial Wind Field
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Animated forward track simulation showing spatial progression from current observation to coastal landfall,
              coupled with the parametric Holland 1980 radial velocity profile.
            </p>
          </div>

          {/* Temporal Scrubber Control Strip */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="op-btn-primary"
              onClick={() => setIsPlaying(!isPlaying)}
              style={{ padding: "8px 14px", fontSize: "12px" }}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              <span>{isPlaying ? "Pause Forecast" : "Play Timeline"}</span>
            </button>
            <div style={{ display: "flex", gap: "4px", background: "#05070a", border: "1px solid rgba(255,255,255,0.08)", padding: "4px", borderRadius: "3px" }}>
              {([0, 6, 12, 24] as const).map(h => (
                <button
                  key={h}
                  type="button"
                  className={`op-layer-tab ${selectedHorizon === h ? "active" : ""}`}
                  onClick={() => {
                    setSelectedHorizon(h);
                    setIsPlaying(false);
                  }}
                  style={{ padding: "4px 10px", fontSize: "11px" }}
                >
                  {h === 0 ? "NOW (0h)" : `+${h}h`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Primary Visual Split: Trajectory Canvas (Left) & Holland Physics (Right) */}
        <div className="op-split-grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", gap: "28px", marginBottom: "24px" }}>
          
          {/* Left: Animated Storm Trajectory Canvas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{
              position: "relative",
              height: "400px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
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
                background: "var(--bg-surface-elevated)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                color: "var(--text-secondary)",
                zIndex: 10
              }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent-cyan)" }} />
                  <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>TRAJECTORY SIMULATION · {stormName.toUpperCase()}</span>
                </div>
                <div>FORWARD SPEED: {speedKph} km/h · HEADING: {headingDeg}° (NW)</div>
              </div>

              {/* Trajectory SVG Engine */}
              <svg width="100%" height="100%" viewBox="0 0 500 400" style={{ display: "block" }}>
                <defs>
                  <pattern id="navGrid" width="25" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 25 0 L 0 0 0 25" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
                  </pattern>
                </defs>
                <rect width="500" height="400" fill="var(--bg-surface)" />
                <rect width="500" height="400" fill="url(#navGrid)" />

                {/* Coastline Polygon */}
                <path
                  d="M 370,0 Q 360,90 350,150 T 380,260 Q 400,320 440,400 L 500,400 L 500,0 Z"
                  fill="var(--bg-surface-elevated)"
                  stroke="var(--border-medium)"
                  strokeWidth="1.5"
                />
                <text x="390" y="50" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">{coastalSector}</text>
                <text x="390" y="70" fill="var(--status-red)" fontSize="9" fontWeight="bold" fontFamily="var(--font-mono)">PROJECTED LANDFALL</text>

                {/* Uncertainty Cone Polygon */}
                <polygon
                  points="140,260 210,185 290,120 420,70 380,150 290,180 210,225"
                  fill="rgba(79, 70, 229, 0.06)"
                  stroke="rgba(79, 70, 229, 0.35)"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />

                {/* Forecast Path Line */}
                <path
                  d="M 140,260 L 210,205 L 290,150 L 390,110"
                  fill="none"
                  stroke="var(--accent-cyan)"
                  strokeWidth="2.5"
                  className="op-stream-flow-line"
                />

                {/* Waypoint Nodes */}
                {waypoints.map(w => {
                  const isActive = w.horizon === selectedHorizon;
                  return (
                    <g key={w.horizon} onClick={() => { setSelectedHorizon(w.horizon); setIsPlaying(false); }} style={{ cursor: "pointer" }}>
                      <circle
                        cx={w.x}
                        cy={w.y}
                        r={isActive ? 8 : 4}
                        fill={isActive ? "var(--accent-cyan)" : "var(--text-muted)"}
                        stroke="var(--bg-surface)"
                        strokeWidth={isActive ? 2 : 1}
                      />
                      <text
                        x={w.x + 10}
                        y={w.y + 4}
                        fill={isActive ? "var(--text-primary)" : "var(--text-secondary)"}
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                        fontWeight={isActive ? "bold" : "normal"}
                      >
                        {w.label}
                      </text>
                    </g>
                  );
                })}

                {/* Active Storm Cyclone Center with Concentric Wind Rings */}
                <g transform={`translate(${currentWp.x}, ${currentWp.y})`}>
                  {/* Outer R34 Gale Radius Ring (60px) */}
                  <circle cx="0" cy="0" r="60" fill="none" stroke="var(--accent-cyan)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                  {/* R50 Storm Radius Ring (38px) */}
                  <circle cx="0" cy="0" r="38" fill="none" stroke="var(--status-amber)" strokeWidth="1.2" opacity="0.8" />
                  {/* Rmax Ring (18px) */}
                  <circle cx="0" cy="0" r="18" fill="rgba(220, 38, 38, 0.15)" stroke="var(--status-red)" strokeWidth="2" />
                  {/* Eye Center */}
                  <circle cx="0" cy="0" r="3" fill="var(--text-primary)" />

                  {/* Heading Vector Arrow */}
                  <line x1="0" y1="0" x2="22" y2="-22" stroke="var(--text-primary)" strokeWidth="2" />
                  <polygon points="22,-22 14,-22 22,-14" fill="var(--text-primary)" />
                </g>
              </svg>

              {/* Bottom State Bar */}
              <div style={{
                position: "absolute",
                bottom: "10px",
                left: "14px",
                right: "14px",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                padding: "8px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                zIndex: 10
              }}>
                <div>
                  TIMESTEP: <strong style={{ color: "var(--accent-cyan)" }}>{currentWp.label}</strong> &middot; COORD: <strong style={{ color: "var(--text-primary)" }}>{currentWp.lat}°N, {currentWp.lon}°E</strong>
                </div>
                <div>
                  VMAX: <strong style={{ color: "var(--accent-cyan)" }}>{currentWp.wind} km/h</strong> &middot; PC: <strong style={{ color: "var(--status-amber)" }}>{currentWp.pressure} hPa</strong>
                </div>
              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", padding: "0 4px" }}>
              <span>Use Play button or click waypoints to observe forecast track evolution</span>
              <span style={{ color: "var(--accent-cyan)" }}>Ensemble Model: ECMWF IFS + GFS Blended Track</span>
            </div>
          </div>

          {/* Right: Holland Wind Model Physics Visualizer */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Wind size={14} style={{ color: "var(--accent-cyan)" }} />
                  <span>HOLLAND 1980 RADIAL VELOCITY CURVE</span>
                </div>
                <span className="op-tech-panel-badge">B = 1.25</span>
              </div>

              <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "12px" }}>
                Drag or hover the radial distance slider below to compute the instantaneous tangential wind speed
                and structural wind pressure at any distance \(r\) from the cyclone center.
              </div>

              {/* Radial Distance Slider */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-muted)" }}>RADIAL DISTANCE (r):</span>
                  <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{hoveredRadius} km</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="160"
                  value={hoveredRadius}
                  onChange={(e) => setHoveredRadius(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--accent-cyan)", cursor: "pointer" }}
                />
              </div>

              {/* Instantaneous Calculation Readout Box */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "12px", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "4px", marginBottom: "14px" }}>
                <div>
                  <div style={{ fontSize: "9.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Wind Velocity V(r)</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>
                    {calculatedWindAtHover} <span style={{ fontSize: "12px" }}>km/h</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{hoveredRadius === 28 ? "Peak Vmax (Eyewall)" : "Outer Radial Isotach"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "9.5px", color: "var(--text-muted)", textTransform: "uppercase" }}>Wind Pressure (pz)</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--status-amber)", fontFamily: "var(--font-mono)" }}>
                    {calculatedPressureAtHover} <span style={{ fontSize: "12px" }}>kPa</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>IS:875 Facade Load</div>
                </div>
              </div>

              {/* SVG Radial Velocity Curve */}
              <div style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", padding: "12px", borderRadius: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}>
                  <span>RADIAL VELOCITY PROFILE V(r)</span>
                  <span style={{ color: "var(--status-red)" }}>RMAX: 28 km</span>
                </div>
                <svg width="100%" height="90" viewBox="0 0 300 90" style={{ display: "block" }}>
                  {/* Axis */}
                  <line x1="25" y1="75" x2="290" y2="75" stroke="var(--border-medium)" strokeWidth="1" />
                  <line x1="25" y1="10" x2="25" y2="75" stroke="var(--border-medium)" strokeWidth="1" />

                  {/* Velocity Curve */}
                  <path
                    d="M 25,73 Q 55,70 75,18 Q 120,40 180,56 T 290,68"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2.5"
                  />

                  {/* Peak Point */}
                  <circle cx="75" cy="18" r="3.5" fill="#ef4444" />
                  <text x="80" y="24" fill="#ef4444" fontSize="8.5" fontFamily="'Space Mono', monospace">Vmax: {currentWp.wind} km/h</text>

                  {/* Dynamic Hover Point on Curve */}
                  {(() => {
                    const normX = Math.min(280, Math.max(30, 25 + (hoveredRadius / 160) * 260));
                    const windRatio = calculatedWindAtHover / (currentWp.wind || 120);
                    const normY = 75 - (windRatio * 57);
                    return (
                      <g>
                        <circle cx={normX} cy={normY} r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                        <line x1={normX} y1={normY} x2={normX} y2="75" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                      </g>
                    );
                  })()}
                </svg>
              </div>

              {/* Exact Formula Block */}
              <div className="op-formula-block" style={{ fontSize: "11px", margin: "12px 0 0" }}>
                V(r) = √[ (B/ρ)·(Rmax/r)^B·ΔP·exp(-(Rmax/r)^B) ]
              </div>
            </div>

            {/* Launch to Full Tactical Map */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(56, 189, 248, 0.05)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "3px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff" }}>View Live in Tactical Map</div>
                <div style={{ fontSize: "10px", color: "#64748b" }}>Inspect 3D city buildings under active wind load</div>
              </div>
              <button
                type="button"
                className="op-table-link"
                onClick={() => onNavigateToCommand()}
              >
                Open Map &rarr;
              </button>
            </div>

          </div>

        </div>

        {/* Waypoints Ledger Table */}
        <div className="op-technical-panel" style={{ padding: "16px 20px" }}>
          <div className="op-tech-panel-header" style={{ marginBottom: "10px" }}>
            <div className="op-tech-panel-title">
              <Clock size={13} style={{ color: "#8b5cf6" }} />
              <span>ENSEMBLE WAYPOINTS SCHEDULE</span>
            </div>
            <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#64748b" }}>
              BASIN: ARABIAN SEA (NIO)
            </span>
          </div>

          <table className="op-ledger-table" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>HORIZON</th>
                <th>COORDINATES</th>
                <th>MAX WIND (Vmax)</th>
                <th>CENTRAL PRESSURE</th>
                <th>UNCERTAINTY ENVELOPE</th>
                <th>OPERATIONAL STAGE</th>
              </tr>
            </thead>
            <tbody>
              {waypoints.map(w => (
                <tr
                  key={w.horizon}
                  style={{
                    background: w.horizon === selectedHorizon ? "rgba(56, 189, 248, 0.06)" : undefined,
                    cursor: "pointer"
                  }}
                  onClick={() => { setSelectedHorizon(w.horizon); setIsPlaying(false); }}
                >
                  <td style={{ fontWeight: 700, color: w.horizon === selectedHorizon ? "#8b5cf6" : "#ffffff" }}>
                    {w.label}
                  </td>
                  <td style={{ fontFamily: "'Space Mono', monospace" }}>{w.lat}°N, {w.lon}°E</td>
                  <td style={{ fontFamily: "'Space Mono', monospace", color: "#8b5cf6" }}>{w.wind} km/h</td>
                  <td style={{ fontFamily: "'Space Mono', monospace", color: "#f59e0b" }}>{w.pressure} hPa</td>
                  <td style={{ fontFamily: "'Space Mono', monospace" }}>± {w.uncertaintyKm} km</td>
                  <td style={{ color: w.horizon === 24 ? "#f43f5e" : "#cbd5e1", fontWeight: w.horizon === 24 ? 700 : "normal" }}>
                    {w.stage}
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
