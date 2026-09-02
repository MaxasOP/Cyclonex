import React from "react";

type SatelliteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedSource: string;
  stormName?: string;
  centerLat?: number;
  centerLon?: number;
};

const satelliteSpecs: Record<string, { title: string; sensor: string; wavelength: string; res: string; orbit: string; desc: string }> = {
  HURSAT_B1: {
    title: "NOAA HURSAT-B1 HISTORICAL IR SCENE",
    sensor: "AVHRR / GOES Imager",
    wavelength: "10.8 µm Thermal IR",
    res: "8.0 km Storm-Centred Grid",
    orbit: "Geostationary Synchronous",
    desc: "Long-record tropical cyclone thermal infrared brightness temperature cube used for baseline pattern classification.",
  },
  INSAT: {
    title: "INSAT-3D/3DR GEOSTATIONARY IMAGERY",
    sensor: "Imager / Sounder Payload",
    wavelength: "10.8 µm TIR-1 + 0.65 µm VIS",
    res: "1.0 km Visible / 4.0 km IR",
    orbit: "Geostationary 74.0°E (Bay of Bengal)",
    desc: "Operational ISRO satellite observation covering North Indian Ocean, Bay of Bengal, and Arabian Sea cyclones.",
  },
  GPM_IMERG: {
    title: "NASA GPM IMERG PRECIPITATION STRUCTURE",
    sensor: "Dual-frequency Precipitation Radar (DPR)",
    wavelength: "Ku/Ka-band Radar (13.6/35.5 GHz)",
    res: "0.1° x 0.1° Multi-satellite",
    orbit: "Low Earth Orbit Constellation",
    desc: "High-resolution satellite-derived precipitation rate structure isolating convective eyeball and spiral rainbands.",
  },
  SENTINEL_1: {
    title: "ESA SENTINEL-1 C-BAND SAR BACKSCATTER",
    sensor: "Synthetic Aperture Radar (SAR)",
    wavelength: "5.405 GHz C-Band (VV/VH)",
    res: "10.0 m High-Resolution Backscatter",
    orbit: "Sun-synchronous Polar Orbit (693 km)",
    desc: "All-weather surface roughness and ocean backscatter measuring extreme surface wind vectors and coastal inundation.",
  },
};

export default function SatelliteModal({
  isOpen,
  onClose,
  selectedSource,
  stormName = "Cyclone Amphan Eye",
  centerLat = 15.5,
  centerLon = 87.5,
}: SatelliteModalProps) {
  if (!isOpen) return null;

  const spec = satelliteSpecs[selectedSource] || satelliteSpecs.HURSAT_B1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{spec.title}</div>
            <div style={{ fontSize: "0.68rem", color: "#76B900", fontFamily: "var(--font-mono)", marginTop: 2 }}>
              CONSTELLATION TELEMETRY · SENSOR BAND ACTIVE
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="satellite-image-view">
          {/* Simulated Satellite Radiance Scene Grid with Target Crosshair */}
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <radialGradient id="stormEyeGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0.95" />
                <stop offset="15%" stopColor="#FF3333" stopOpacity="0.8" />
                <stop offset="35%" stopColor="#FF9900" stopOpacity="0.7" />
                <stop offset="60%" stopColor="#76B900" stopOpacity="0.5" />
                <stop offset="85%" stopColor="#00BFFF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#03080F" stopOpacity="0.0" />
              </radialGradient>

              <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(118,185,0,0.12)" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Grid */}
            <rect width="100%" height="100%" fill="url(#gridPattern)" />

            {/* Simulated Spiral Storm Radiance */}
            <g transform="translate(480, 240)">
              <circle cx="0" cy="0" r="220" fill="url(#stormEyeGrad)" />
              <circle cx="0" cy="0" r="18" fill="#000000" stroke="#76B900" strokeWidth="1.5" />
              
              {/* Spiral Rainbands */}
              <path
                d="M 0 0 Q 60 -100 160 -80 Q 220 20 180 120"
                fill="none"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <path
                d="M 0 0 Q -80 60 -140 140 Q -180 40 -120 -80"
                fill="none"
                stroke="rgba(118, 185, 0, 0.5)"
                strokeWidth="2.5"
              />

              {/* Crosshair Target Reticle */}
              <line x1="-30" y1="0" x2="30" y2="0" stroke="#76B900" strokeWidth="1.5" />
              <line x1="0" y1="-30" x2="0" y2="30" stroke="#76B900" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="35" fill="none" stroke="#76B900" strokeWidth="1" strokeDasharray="3 3" />
            </g>
          </svg>

          {/* SpaceX HUD Overlay */}
          <div className="satellite-hud-grid">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div className="hud-box">
                <div className="hud-title">TARGET STORM CENTRE</div>
                <div className="hud-value">
                  {centerLat.toFixed(2)}°N, {centerLon.toFixed(2)}°E
                </div>
              </div>

              <div className="hud-box" style={{ textAlign: "right" }}>
                <div className="hud-title">SENSOR RESOLUTION</div>
                <div className="hud-value" style={{ color: "#FFFFFF" }}>
                  {spec.res}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div className="hud-box">
                <div className="hud-title">SPECTRAL WAVELENGTH</div>
                <div style={{ color: "#FFFFFF", fontWeight: 700 }}>{spec.wavelength}</div>
                <div style={{ fontSize: "0.62rem", color: "#888888" }}>ORBIT: {spec.orbit}</div>
              </div>

              <div className="hud-box" style={{ textAlign: "right" }}>
                <div className="hud-title">SCENE STATUS</div>
                <div style={{ color: "#76B900", fontWeight: 800 }}>LIVE INGESTION CO-REGISTERED</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-body" style={{ backgroundColor: "var(--bg-black)" }}>
          <p style={{ fontSize: "0.78rem", color: "#CCCCCC" }}>{spec.desc}</p>
        </div>
      </div>
    </div>
  );
}
