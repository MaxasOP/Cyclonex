import React, { useState } from "react";
import {
  Satellite,
  Layers,
  Split,
  Eye,
  Play,
  Pause,
  Clock,
  Radio,
  Sliders,
  Maximize2,
  Minimize2,
  RefreshCw,
  Compass,
} from "lucide-react";

export interface SatelliteLabProps {
  stormName: string;
  lat: number;
  lon: number;
  windKph: number;
  pressureHpa: number;
  onSelectStorm?: (preset: string) => void;
}

type ChannelType = "VIS" | "IR" | "WV" | "MW" | "RADAR";
type SatelliteSource = "INSAT-3DR" | "HIMAWARI-9" | "GOES-16" | "METEOSAT-10" | "GPM-IMERG";
type ViewMode = "single" | "split" | "compare";

const CHANNELS: { id: ChannelType; name: string; wavelength: string; desc: string }[] = [
  { id: "VIS", name: "Visible", wavelength: "0.65 µm", desc: "Daytime high-res cloud top & eye geometry" },
  { id: "IR", name: "Thermal IR", wavelength: "10.8 µm", desc: "24/7 cloud top brightness temperature (Tb)" },
  { id: "WV", name: "Water Vapor", wavelength: "6.7 µm", desc: "Upper-tropospheric moisture & wind shear" },
  { id: "MW", name: "Microwave", wavelength: "89.0 GHz", desc: "Eye-wall penetration & deep rain bands" },
  { id: "RADAR", name: "Doppler Radar", wavelength: "C-Band", desc: "Coastal reflectivity & precipitation cores" },
];

const SOURCES: { id: SatelliteSource; agency: string; orbit: string; resolution: string }[] = [
  { id: "INSAT-3DR", agency: "ISRO", orbit: "GEO 74.0°E", resolution: "1.0 km VIS / 4.0 km IR" },
  { id: "HIMAWARI-9", agency: "JMA", orbit: "GEO 140.7°E", resolution: "0.5 km VIS / 2.0 km IR" },
  { id: "GOES-16", agency: "NOAA", orbit: "GEO 75.2°W", resolution: "0.5 km VIS / 2.0 km IR" },
  { id: "METEOSAT-10", agency: "EUMETSAT", orbit: "GEO 0.0°E", resolution: "1.0 km VIS / 3.0 km IR" },
  { id: "GPM-IMERG", agency: "NASA / JAXA", orbit: "LEO Constellation", resolution: "0.1° (~10 km) Rain" },
];

export default function SatelliteLab({
  stormName,
  lat,
  lon,
  windKph,
  pressureHpa,
}: SatelliteLabProps) {
  const [activeChannel, setActiveChannel] = useState<ChannelType>("IR");
  const [activeSource, setActiveSource] = useState<SatelliteSource>("INSAT-3DR");
  const [secondarySource, setSecondarySource] = useState<SatelliteSource>("HIMAWARI-9");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [timelineIndex, setTimelineIndex] = useState<number>(3); // 0: -6h, 1: -4h, 2: -2h, 3: NOW, 4: +2h, 5: +4h
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.2);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);

  const TIMESTAMPS = [
    { label: "-6h", time: "17:30 IST", sub: "Pre-genesis convective burst" },
    { label: "-4h", time: "19:30 IST", sub: "Inner core curved banding" },
    { label: "-2h", time: "21:30 IST", sub: "Eyewall symmetry consolidation" },
    { label: "NOW", time: "23:35 IST", sub: "Active eye observation (Tb = -78°C)" },
    { label: "+2h", time: "01:30 IST", sub: "Projected coastal approach" },
    { label: "+4h", time: "03:30 IST", sub: "Primary spiral arm landfall" },
  ];

  // Procedural gradient background simulating realistic calibrated satellite channel palettes
  const getChannelColorPalette = (channel: ChannelType) => {
    switch (channel) {
      case "VIS":
        return "radial-gradient(circle at 50% 50%, rgba(240, 245, 255, 0.9) 0%, rgba(140, 160, 190, 0.6) 35%, rgba(40, 60, 90, 0.8) 70%, #030712 100%)";
      case "IR":
        return "radial-gradient(circle at 50% 50%, #ffffff 0%, #ff4500 15%, #ffd700 30%, #00ced1 55%, #00008b 75%, #050814 100%)";
      case "WV":
        return "radial-gradient(circle at 50% 50%, #e0f2fe 0%, #38bdf8 25%, #0284c7 50%, #1e1b4b 80%, #030712 100%)";
      case "MW":
        return "radial-gradient(circle at 50% 50%, #ffffff 0%, #22c55e 20%, #eab308 45%, #ef4444 70%, #020617 100%)";
      case "RADAR":
        return "radial-gradient(circle at 50% 50%, #bbf7d0 0%, #22c55e 25%, #eab308 45%, #dc2626 65%, #7f1d1d 85%, #020617 100%)";
    }
  };

  return (
    <div className="satellite-lab-workspace">
      {/* Top Workspace Header */}
      <div className="workspace-header-bar">
        <div className="header-left">
          <div className="workspace-icon-pill">
            <Satellite size={15} />
            <span>SATELLITE LAB</span>
          </div>
          <div className="storm-context-chip">
            <strong>{stormName || "ACTIVE TARGET"}</strong>
            <span>{lat.toFixed(2)}°N, {lon.toFixed(2)}°E</span>
            <span className="telemetry-badge">{windKph} km/h · {pressureHpa} hPa</span>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="workspace-toggle-group">
          <button
            type="button"
            className={`toggle-pill ${viewMode === "single" ? "active" : ""}`}
            onClick={() => setViewMode("single")}
          >
            Single View
          </button>
          <button
            type="button"
            className={`toggle-pill ${viewMode === "split" ? "active" : ""}`}
            onClick={() => setViewMode("split")}
          >
            <Split size={12} /> Split View
          </button>
          <button
            type="button"
            className={`toggle-pill ${viewMode === "compare" ? "active" : ""}`}
            onClick={() => setViewMode("compare")}
          >
            Compare Mode
          </button>
        </div>

        {/* Sensor & Channel Selectors */}
        <div className="header-right">
          <div className="sensor-selector">
            <Radio size={12} />
            <select
              value={activeSource}
              onChange={(e) => setActiveSource(e.target.value as SatelliteSource)}
              className="sensor-dropdown"
            >
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({s.agency})
                </option>
              ))}
            </select>
          </div>

          <div className="channel-pills-row">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`channel-pill ${activeChannel === ch.id ? "active" : ""}`}
                onClick={() => setActiveChannel(ch.id)}
                title={`${ch.name} (${ch.wavelength}): ${ch.desc}`}
              >
                {ch.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Satellite Viewing Canvas */}
      <div className="satellite-viewports-container">
        {/* Primary Viewport */}
        <div className={`satellite-viewport ${viewMode === "split" ? "split-left" : "fullscreen"}`}>
          <div className="viewport-overlay-meta">
            <div className="meta-badge-group">
              <span className="source-tag">{activeSource}</span>
              <span className="channel-tag">{activeChannel} · {CHANNELS.find((c) => c.id === activeChannel)?.wavelength}</span>
              <span className="time-tag">
                <Clock size={11} /> {TIMESTAMPS[timelineIndex].time}
              </span>
            </div>
            <div className="telemetry-corner">
              <span>LAT: {lat.toFixed(4)}°N</span>
              <span>LON: {lon.toFixed(4)}°E</span>
              <span>Tb: -78.4°C</span>
            </div>
          </div>

          {/* Calibrated Satellite Image Simulation Container */}
          <div
            className="satellite-scene-display"
            style={{
              transform: `scale(${zoomLevel})`,
              background: getChannelColorPalette(activeChannel),
            }}
          >
            {/* Realistic Logarithmic Spiral Cloud Bands */}
            <svg className="satellite-spiral-overlay" viewBox="0 0 800 800">
              <defs>
                <filter id="cloud-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="16" />
                </filter>
                <filter id="eye-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>

              {/* Convective Cloud Feeder Bands */}
              <g filter="url(#cloud-blur)" opacity="0.85">
                <path
                  d="M 400 400 Q 520 300 650 420 T 780 620"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="60"
                  strokeLinecap="round"
                />
                <path
                  d="M 400 400 Q 280 500 160 380 T 30 180"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="50"
                  strokeLinecap="round"
                />
                <path
                  d="M 400 400 Q 300 280 420 150 T 620 30"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="45"
                  strokeLinecap="round"
                />
                <path
                  d="M 400 400 Q 500 520 380 650 T 180 770"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="55"
                  strokeLinecap="round"
                />
              </g>

              {/* Tightly Defined Eye-Wall Ring */}
              <circle
                cx="400"
                cy="400"
                r="36"
                fill="none"
                stroke="#ffffff"
                strokeWidth="20"
                filter="url(#eye-glow)"
                opacity="0.95"
              />

              {/* Clear Central Warm-Core Eye */}
              <circle cx="400" cy="400" r="18" fill="#070b14" opacity="0.9" />

              {/* Crosshair Target Reticle */}
              {showCrosshairs && (
                <g stroke="rgba(56, 189, 248, 0.7)" strokeWidth="1" strokeDasharray="3, 3">
                  <line x1="400" y1="280" x2="400" y2="520" />
                  <line x1="280" y1="400" x2="520" y2="400" />
                  <circle cx="400" cy="400" r="8" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                </g>
              )}
            </svg>
          </div>

          {/* Viewport Control Tools */}
          <div className="viewport-floating-tools">
            <button
              type="button"
              className="tool-btn"
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              title="Zoom In"
            >
              +
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
              title="Zoom Out"
            >
              -
            </button>
            <button
              type="button"
              className={`tool-btn ${showCrosshairs ? "active" : ""}`}
              onClick={() => setShowCrosshairs(!showCrosshairs)}
              title="Toggle Reticle Crosshairs"
            >
              <Compass size={13} />
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setZoomLevel(1.0)}
              title="Reset Zoom"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Secondary Viewport (For Split-Screen Comparison) */}
        {viewMode === "split" && (
          <div className="satellite-viewport split-right">
            <div className="viewport-overlay-meta">
              <div className="meta-badge-group">
                <select
                  value={secondarySource}
                  onChange={(e) => setSecondarySource(e.target.value as SatelliteSource)}
                  className="sensor-dropdown-mini"
                >
                  {SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>{s.id}</option>
                  ))}
                </select>
                <span className="channel-tag">Water Vapor (6.7µm)</span>
                <span className="time-tag">
                  <Clock size={11} /> {TIMESTAMPS[timelineIndex].time}
                </span>
              </div>
              <div className="telemetry-corner">
                <span>SYNCHRONIZED VIEW</span>
              </div>
            </div>

            <div
              className="satellite-scene-display"
              style={{
                transform: `scale(${zoomLevel})`,
                background: getChannelColorPalette("WV"),
              }}
            >
              <svg className="satellite-spiral-overlay" viewBox="0 0 800 800">
                <circle cx="400" cy="400" r="32" fill="none" stroke="#e0f2fe" strokeWidth="18" opacity="0.8" />
                <circle cx="400" cy="400" r="16" fill="#030712" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Unified Satellite Temporal Scrubber Bar */}
      <div className="satellite-scrubber-bar">
        <button
          type="button"
          className="scrubber-play-btn"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          <span>{isPlaying ? "Pause Stream" : "Play Sequence"}</span>
        </button>

        <div className="scrubber-steps-track">
          {TIMESTAMPS.map((step, idx) => (
            <button
              key={step.label}
              type="button"
              className={`scrubber-step-marker ${timelineIndex === idx ? "active" : ""}`}
              onClick={() => {
                setTimelineIndex(idx);
                setIsPlaying(false);
              }}
            >
              <span className="step-dot" />
              <span className="step-label">{step.label}</span>
              <span className="step-time">{step.time}</span>
            </button>
          ))}
        </div>

        <div className="scrubber-legend-info">
          <span>{TIMESTAMPS[timelineIndex].sub}</span>
        </div>
      </div>
    </div>
  );
}
