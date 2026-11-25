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

  const points = [{horizon: 0 as const, label: "0h scenario input", lat, lon, wind: windKph,
    pressure: pressureHpa, uncertaintyKm: null as number | null, stage: "Scenario input"},
    ...([6, 12, 24] as const).flatMap(horizon => {
      const forecast = mlResult?.[`forecast_${horizon}h`];
      if (!forecast) return [];
      return [{horizon, label: `+${horizon}h`, lat: forecast.centre_lat, lon: forecast.centre_lon,
        wind: forecast.max_sustained_wind_kph, pressure: forecast.central_pressure_hpa,
        uncertaintyKm: forecast.track_uncertainty_km, stage: forecast.method ?? mlResult?.model_provenance.model_name ?? "Baseline"}];
    })];
  // North-up local projection, unwrapping longitudes across the date line.
  const offsets = points.map(p => ({
    x: (((p.lon - lon + 540) % 360) - 180) * Math.cos(lat * Math.PI / 180),
    y: lat - p.lat,
  }));
  const extent = Math.max(0.01, ...offsets.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))));
  const waypoints = points.map((p, i) => ({...p, x: 250 + offsets[i].x * 125 / extent, y: 200 + offsets[i].y * 125 / extent}));
  // Current active waypoint values
  const currentWp = waypoints.find(w => w.horizon === selectedHorizon) || waypoints[0];

  // Playback timer loop
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isPlaying && mlResult) {
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
  }, [isPlaying, mlResult]);

  // Holland 1980 Radial Wind Calculation
  // V(r) = sqrt( (B/rho) * (Rmax/r)^B * (Pn - Pc) * exp(-(Rmax/r)^B) )
  const calcHollandWind = (rKm: number) => {
    if (rKm <= 0) return 0;
    const B = 1.25;
    const Rmax = 28;
    const dP = Math.max(0, 1008 - currentWp.pressure) * 100; // Pa
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
              Forecast Trajectory &amp; Radial Wind Field
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Track points use the returned scenario forecast. The radial profile illustrates the Holland model with fixed parameters.
            </p>
          </div>

          {/* Temporal Scrubber Control Strip */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="op-btn-primary"
              disabled={!mlResult}
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
                  disabled={h !== 0 && !mlResult}
                  type="button"
                  className={`op-layer-tab ${selectedHorizon === h ? "active" : ""}`}
                  onClick={() => {
                    setSelectedHorizon(h);
                    setIsPlaying(false);
                  }}
                  style={{ padding: "4px 10px", fontSize: "11px" }}
                >
                  {h === 0 ? "Input (0h)" : `+${h}h`}
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
                <div>FORWARD SPEED: {speedKph} km/h · HEADING: {headingDeg}°</div>
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

                <polyline points={waypoints.map(w => `${w.x},${w.y}`).join(" ")} stroke="var(--accent-cyan)" fill="none" strokeWidth="2.5" />
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
                  <circle r="9" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" />
                  <path d="M0,0 V-22 M-4,-17 L0,-22 L4,-17" fill="none" stroke="var(--text-primary)" transform={`rotate(${headingDeg})`}/>
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
              <span style={{ color: "var(--accent-cyan)" }}>{mlResult?.model_provenance.model_name ?? "Forecast unavailable"}</span>
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
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Dynamic pressure estimate</div>
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

                  {(() => {
                    const peak = calcHollandWind(28);
                    const y = (r: number) => 75 - 57 * calcHollandWind(r) / Math.max(peak, 1);
                    const x = (r: number) => 25 + 260 * r / 160;
                    return <g>
                      <polyline points={Array.from({length: 161}, (_, r) => `${x(r)},${y(r)}`).join(" ")} fill="none" stroke="#8b5cf6" strokeWidth="2.5"/>
                      <text x="80" y="12" fill="#ef4444" fontSize="9">Profile peak {peak} km/h</text>
                      <circle cx={x(hoveredRadius)} cy={y(hoveredRadius)} r="4" fill="#f59e0b"/>
                    </g>;
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
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff" }}>View in tactical map</div>
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
              <span>FORECAST WAYPOINTS</span>
            </div>
            <span style={{ fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "#64748b" }}>
              {mlResult?.model_provenance.uncertainty_status ?? "Model unavailable"}
            </span>
          </div>

          <table className="op-ledger-table" style={{ fontSize: "11.5px" }}>
            <thead>
              <tr>
                <th>HORIZON</th>
                <th>COORDINATES</th>
                <th>MAX WIND (Vmax)</th>
                <th>CENTRAL PRESSURE</th>
                <th>TRACK ERROR ESTIMATE</th>
                <th>METHOD</th>
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
                  <td style={{ fontFamily: "'Space Mono', monospace" }}>{w.uncertaintyKm == null ? "Unavailable" : w.uncertaintyKm + " km"}</td>
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
