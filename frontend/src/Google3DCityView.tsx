import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { BuildingFeature, RiskFeature, EvacuationPlan } from "./api";

export interface RealWorld3DViewProps {
  center: { lat: number; lng: number };
  locationName?: string;
  features?: RiskFeature[];
  buildings?: BuildingFeature[];
  sheltersPlan?: EvacuationPlan | null;
  speedKph?: number;
  headingDeg?: number;
  onExitReal3D?: () => void;
  onSelectBuilding?: (building: BuildingFeature | null) => void;
  onSelectPreset?: (presetKey: string) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

function getDamageColor(score: number): string {
  if (score >= 0.55) return "#ef4444";
  if (score >= 0.25) return "#f97316";
  return "#22c55e";
}

const CAM_PRESETS = {
  birdseye: { altitude: 800,  tilt: 55, range: 1200 },
  drone:    { altitude: 120,  tilt: 75, range: 300  },
  surge:    { altitude: 60,   tilt: 80, range: 600  },
  orbit:    { altitude: 600,  tilt: 60, range: 1000 },
} as const;
type CamPreset = keyof typeof CAM_PRESETS;

export default function Google3DCityView({
  center,
  locationName,
  features = [],
  speedKph = 25,
  headingDeg = 315,
  onExitReal3D,
  onSelectPreset,
}: RealWorld3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const map3dRef = useRef<HTMLElement | null>(null);

  const [cameraView, setCameraView]          = useState<CamPreset>("birdseye");
  const [showSurge, setShowSurge]            = useState(true);
  const [surgeHeightM, setSurgeHeightM]      = useState(2.8);
  const [showWindStreams, setShowWindStreams] = useState(true);
  const [showRain, setShowRain]              = useState(true);
  const [loadStatus, setLoadStatus]          = useState("Loading Google Photorealistic 3D Tiles…");
  const [loadError, setLoadError]            = useState<string | null>(null);
  const [isReady, setIsReady]                = useState(false);

  const derivedLocation = locationName || `${center.lat.toFixed(3)}°N, ${center.lng.toFixed(3)}°E`;
  const severeCount   = features.filter(f => (f.properties.damage_score ?? 0) >= 0.55).length;
  const moderateCount = features.filter(f => { const s = f.properties.damage_score ?? 0; return s >= 0.25 && s < 0.55; }).length;
  const maxWind       = features.reduce((m, f) => Math.max(m, f.properties.wind_kph ?? 0), 0);

  const flyTo = useCallback((preset: CamPreset) => {
    const el = map3dRef.current as (HTMLElement & { flyCameraTo?: (o: object) => void }) | null;
    if (!el) return;
    const { altitude, tilt, range } = CAM_PRESETS[preset];
    el.flyCameraTo?.({
      endCamera: { center: { lat: center.lat, lng: center.lng, altitude }, tilt, range, heading: headingDeg },
      durationMillis: 1800,
    });
  }, [center.lat, center.lng, headingDeg]);

  const handleSetCameraPreset = (preset: CamPreset) => {
    setCameraView(preset);
    flyTo(preset);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    if (!GOOGLE_MAPS_API_KEY) {
      setLoadError("VITE_GOOGLE_MAPS_API_KEY is not set. Add it to frontend/.env.local and your Vercel env vars, then restart the dev server.");
      return;
    }

    let cancelled = false;

    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: "alpha",
    });

    importLibrary("maps3d").then(async () => {
      if (cancelled || !containerRef.current) return;
      await customElements.whenDefined("gmp-map-3d").catch(() => {});
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = "";

      const map3d = document.createElement("gmp-map-3d") as HTMLElement & {
        flyCameraTo?: (o: object) => void;
      };
      map3d.setAttribute("center",  JSON.stringify({ lat: center.lat, lng: center.lng, altitude: 600 }));
      map3d.setAttribute("tilt",    "55");
      map3d.setAttribute("range",   "1200");
      map3d.setAttribute("heading", String(headingDeg));
      Object.assign(map3d.style, { width: "100%", height: "100%", display: "block" });
      containerRef.current.appendChild(map3d);
      map3dRef.current = map3d;

      setLoadStatus("Google Photorealistic 3D Tiles Active");
      setIsReady(true);

      // Cyclone eye marker
      const eyeMarker = document.createElement("gmp-marker-3d");
      eyeMarker.setAttribute("position", JSON.stringify({ lat: center.lat, lng: center.lng, altitude: 80 }));
      eyeMarker.setAttribute("altitude-mode", "RELATIVE_TO_GROUND");
      eyeMarker.setAttribute("title", "Cyclone Eye");
      map3d.appendChild(eyeMarker);

      // Damage zone polygon overlays
      const topFeatures = features.filter(f => (f.properties.damage_score ?? 0) >= 0.45).slice(0, 40);
      for (const feat of topFeatures) {
        const ring = feat.geometry?.coordinates?.[0];
        if (!ring || ring.length < 3) continue;
        const score = feat.properties.damage_score ?? 0;
        const color = getDamageColor(score);
        const poly = document.createElement("gmp-polygon-3d");
        poly.setAttribute("outer-coordinates", JSON.stringify(ring.map(([lng, lat]: number[]) => ({ lat, lng, altitude: 25 }))));
        poly.setAttribute("altitude-mode", "RELATIVE_TO_GROUND");
        poly.setAttribute("fill-color", color + "55");
        poly.setAttribute("stroke-color", color);
        poly.setAttribute("stroke-width", "2");
        poly.setAttribute("extruded", "true");
        map3d.appendChild(poly);
      }

    }).catch((err: Error) => {
      if (!cancelled) setLoadError(`Google Maps load failed: ${err.message}`);
    });

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
      map3dRef.current = null;
      setIsReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, headingDeg]);

  const CAM_LABELS: Record<CamPreset, string> = {
    birdseye: "Birds-Eye 45deg",
    drone:    "Street Drone",
    surge:    "Coastline Surge",
    orbit:    "360 Orbit",
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "620px", overflow: "hidden", background: "#07101a" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading / Error overlay */}
      {(!isReady || loadError) && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: "rgba(6,12,22,0.94)", backdropFilter: "blur(16px)",
          border: `1px solid ${loadError ? "rgba(239,68,68,0.5)" : "rgba(56,189,248,0.3)"}`,
          borderRadius: "12px", padding: "24px 32px", textAlign: "center",
          color: "#e2e8f0", zIndex: 2000, maxWidth: "480px",
        }}>
          {loadError ? (
            <>
              <div style={{ fontSize: "2rem", marginBottom: "10px" }}>{"⚠️"}</div>
              <div style={{ fontWeight: 800, color: "#f87171", marginBottom: "8px" }}>Google Maps Load Error</div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.6 }}>{loadError}</div>
              <div style={{ marginTop: "12px", fontSize: "0.72rem", color: "#64748b" }}>
                Ensure: VITE_GOOGLE_MAPS_API_KEY set · Maps JavaScript API + Map Tiles API enabled
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "2rem", marginBottom: "10px" }}>{"🌐"}</div>
              <div style={{ fontWeight: 800, color: "#38bdf8", marginBottom: "8px" }}>Loading Google Photorealistic 3D Tiles</div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{loadStatus}</div>
            </>
          )}
        </div>
      )}

      {/* Top header bar */}
      <div style={{
        position: "absolute", top: "10px", left: "10px", right: "10px", zIndex: 1200,
        background: "rgba(6,12,22,0.92)", backdropFilter: "blur(14px)",
        border: "1px solid rgba(56,189,248,0.28)", borderRadius: "8px",
        padding: "8px 14px", display: "flex", alignItems: "center", gap: "12px",
        pointerEvents: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.6)", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 200px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: isReady ? "#10b981" : "#f59e0b", boxShadow: isReady ? "0 0 8px #10b981" : "0 0 8px #f59e0b", display: "inline-block" }} />
          <span style={{ fontWeight: 800, color: "#38bdf8", fontSize: "0.82rem", letterSpacing: "0.04em" }}>GOOGLE PHOTOREALISTIC 3D</span>
          <span style={{ fontSize: "0.62rem", fontWeight: 700, background: "rgba(16,185,129,0.2)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)", padding: "2px 6px", borderRadius: "4px" }}>
            {isReady ? "LIVE TILES" : "LOADING"}
          </span>
        </div>
        <div style={{ fontSize: "0.73rem", color: "#94a3b8", display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <span>{"📍"} <strong style={{ color: "#fff" }}>{derivedLocation}</strong></span>
          <span>{"💨"} <strong style={{ color: "#f87171" }}>{maxWind.toFixed(0)} km/h</strong></span>
          <span>{"🔴"} <strong style={{ color: "#f87171" }}>{severeCount}</strong> severe</span>
          <span>{"🟠"} <strong style={{ color: "#fbbf24" }}>{moderateCount}</strong> moderate</span>
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {(Object.keys(CAM_PRESETS) as CamPreset[]).map(p => (
            <button key={p} type="button" onClick={() => handleSetCameraPreset(p)}
              style={{ padding: "4px 10px", background: cameraView === p ? "#0284c7" : "rgba(255,255,255,0.08)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: cameraView === p ? 700 : 500, fontSize: "0.7rem" }}>
              {CAM_LABELS[p]}
            </button>
          ))}
          {onExitReal3D && (
            <button type="button" onClick={onExitReal3D}
              style={{ padding: "4px 12px", background: "#38bdf8", color: "#050b14", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 800, fontSize: "0.7rem" }}>
              {"<"} Back to 2D
            </button>
          )}
        </div>
      </div>

      {/* Physics simulation panel */}
      <div style={{
        position: "absolute", top: "68px", right: "16px", zIndex: 1100,
        background: "rgba(8,16,28,0.94)", backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.16)", borderRadius: "8px",
        padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px",
        color: "#e2e8f0", fontSize: "0.74rem", minWidth: "240px",
        pointerEvents: "auto", boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontWeight: 800, color: "#38bdf8", borderBottom: "1px solid rgba(255,255,255,0.12)", paddingBottom: "5px" }}>{"⚡"} 3D PHYSICS SIMULATION</div>
        <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Basemap: <strong style={{ color: "#38bdf8" }}>{"🛰️"} Google Photorealistic</strong></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="checkbox" checked={showSurge} onChange={e => setShowSurge(e.target.checked)} />
              <span>{"🌊"} Storm Surge Flood</span>
            </label>
            <span style={{ color: "#38bdf8", fontWeight: 800 }}>+{surgeHeightM.toFixed(1)} m</span>
          </div>
          {showSurge && <input type="range" min="0.5" max="5.0" step="0.1" value={surgeHeightM} onChange={e => setSurgeHeightM(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#0284c7" }} />}
        </div>
        <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <input type="checkbox" checked={showWindStreams} onChange={e => setShowWindStreams(e.target.checked)} />
          <span>{"💨"} Aerodynamic Wind Streamlines</span>
        </label>
        <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <input type="checkbox" checked={showRain} onChange={e => setShowRain(e.target.checked)} />
          <span>{"🌧️"} Tropical Torrential Rain</span>
        </label>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "6px", lineHeight: 1.6 }}>
          <div style={{ color: "#94a3b8" }}>Eye: <strong style={{ color: "#fff" }}>{center.lat.toFixed(3)}°N, {center.lng.toFixed(3)}°E</strong></div>
          <div style={{ color: "#94a3b8" }}>Heading: <strong style={{ color: "#fff" }}>{headingDeg}°</strong> · Speed: <strong style={{ color: "#fff" }}>{speedKph} km/h</strong></div>
        </div>
        {onSelectPreset && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "6px" }}>
            <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: "4px" }}>Jump to preset:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {["puri_odisha", "visakhapatnam", "chennai"].map(key => (
                <button key={key} type="button" onClick={() => onSelectPreset(key)}
                  style={{ padding: "3px 8px", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "4px", color: "#38bdf8", fontSize: "0.67rem", cursor: "pointer", fontWeight: 600 }}>
                  {key.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Damage legend */}
      <div style={{
        position: "absolute", bottom: "16px", right: "16px", zIndex: 1100,
        background: "rgba(8,16,28,0.92)", backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px",
        padding: "6px 14px", display: "flex", alignItems: "center", gap: "12px",
        fontSize: "0.7rem", color: "#94a3b8", pointerEvents: "none",
      }}>
        {[["#ef4444","Severe Risk"],["#f97316","Moderate"],["#22c55e","Safe"],["#06b6d4","MPCS Haven"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c, display: "inline-block" }} />
            <span>{l}</span>
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div style={{
        position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)",
        background: "rgba(6,12,22,0.85)", backdropFilter: "blur(10px)",
        borderRadius: "20px", padding: "5px 16px", fontSize: "0.72rem", color: "#94a3b8",
        pointerEvents: "none", border: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", zIndex: 100,
      }}>
        {isReady ? "Powered by Google Maps Platform · Photorealistic 3D Tiles" : loadStatus}
      </div>
    </div>
  );
}
