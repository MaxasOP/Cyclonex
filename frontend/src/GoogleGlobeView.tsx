import { useEffect, useRef, useState, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

interface GoogleGlobeViewProps {
  center: { lat: number; lng: number };
  trajectory?: { lat: number; lng: number; label: string }[];
  headingDeg?: number;
  speedKph?: number;
  onExit3DGlobe?: () => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export default function GoogleGlobeView({
  center,
  trajectory = [],
  headingDeg = 315,
  speedKph = 25,
  onExit3DGlobe,
}: GoogleGlobeViewProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<google.maps.Map | null>(null);
  const autoRotateRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const headingStateRef = useRef<number>(headingDeg);

  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isReady, setIsReady]               = useState(false);
  const [loadError, setLoadError]            = useState<string | null>(null);
  const [loadStatus, setLoadStatus]          = useState("Loading Google Maps Globe…");

  // ── Focus camera on cyclone ──────────────────────────────────────────────
  const focusOnCyclone = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.moveCamera({
      center: { lat: center.lat, lng: center.lng },
      zoom: 5,
      tilt: 45,
      heading: headingDeg,
    });
  }, [center.lat, center.lng, headingDeg]);

  // ── Auto-orbit toggle ────────────────────────────────────────────────────
  const toggleAutoRotate = () => {
    setIsAutoRotating(prev => !prev);
  };

  useEffect(() => {
    if (!isAutoRotating) {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
      return;
    }
    autoRotateRef.current = setInterval(() => {
      const map = mapRef.current;
      if (!map) return;
      headingStateRef.current = (headingStateRef.current + 0.3) % 360;
      map.moveCamera({ heading: headingStateRef.current });
    }, 50);
    return () => { if (autoRotateRef.current) clearInterval(autoRotateRef.current); };
  }, [isAutoRotating]);

  // ── Main mount effect ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    if (!GOOGLE_MAPS_API_KEY) {
      setLoadError("VITE_GOOGLE_MAPS_API_KEY is not set. Add it to frontend/.env.local.");
      return;
    }

    let cancelled = false;

    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: "weekly",
    });

    importLibrary("maps").then(async (mapsLib) => {
      if (cancelled || !containerRef.current) return;

      const { Map } = mapsLib as google.maps.MapsLibrary;

      if (cancelled || !containerRef.current) return;

      setLoadStatus("Initialising satellite globe…");

      const map = new Map(containerRef.current, {
        center:    { lat: center.lat, lng: center.lng },
        zoom:      5,
        tilt:      45,
        heading:   headingDeg,
        mapTypeId: "satellite",
        mapTypeControl:        false,
        streetViewControl:     false,
        fullscreenControl:     false,
        zoomControl:           true,
        gestureHandling:       "greedy",
        mapId:                 import.meta.env.VITE_GOOGLE_MAP_ID || undefined,
      });

      mapRef.current = map;
      headingStateRef.current = headingDeg;

      // ── 64kt / 34kt warning radius circles ──────────────────────────────
      new google.maps.Circle({
        map,
        center: { lat: center.lat, lng: center.lng },
        radius: 100_000, // 100 km ~ 64kt radius
        strokeColor:   "#ef4444",
        strokeOpacity: 0.9,
        strokeWeight:  2,
        fillColor:     "#ef4444",
        fillOpacity:   0.08,
      });
      new google.maps.Circle({
        map,
        center: { lat: center.lat, lng: center.lng },
        radius: 220_000, // 220 km ~ 34kt radius
        strokeColor:   "#f59e0b",
        strokeOpacity: 0.7,
        strokeWeight:  1.5,
        fillColor:     "#f59e0b",
        fillOpacity:   0.05,
      });

      // ── Forecast trajectory polyline ─────────────────────────────────────
      if (trajectory.length > 0) {
        const path = [
          { lat: center.lat, lng: center.lng },
          ...trajectory.map(t => ({ lat: t.lat, lng: t.lng })),
        ];
        new google.maps.Polyline({
          map,
          path,
          strokeColor:   "#38bdf8",
          strokeOpacity: 0.9,
          strokeWeight:  3,
          icons: [{
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, strokeColor: "#38bdf8", scale: 3 },
            repeat: "80px",
          }],
        });

        // Waypoint markers
        trajectory.forEach((pt, i) => {
          new google.maps.Marker({
            map,
            position: { lat: pt.lat, lng: pt.lng },
            title:    pt.label,
            icon: {
              path:         google.maps.SymbolPath.CIRCLE,
              scale:        7,
              fillColor:    i === trajectory.length - 1 ? "#f59e0b" : "#38bdf8",
              fillOpacity:  1,
              strokeColor:  "#ffffff",
              strokeWeight: 1.5,
            },
            label: {
              text:      pt.label.replace("Forecast", "").trim(),
              color:     "#ffffff",
              fontSize:  "10px",
              fontWeight: "700",
            },
          });
        });
      }

      // ── Cyclone eye overlay ──────────────────────────────────────────────
      class CycloneEyeOverlay extends google.maps.OverlayView {
        private div: HTMLDivElement | null = null;
        draw() {
          if (!this.div) return;
          const proj = this.getProjection();
          const pos = proj.fromLatLngToDivPixel(new google.maps.LatLng(center.lat, center.lng));
          if (pos) {
            this.div.style.left = `${pos.x - 24}px`;
            this.div.style.top  = `${pos.y - 24}px`;
          }
        }
        onAdd() {
          this.div = document.createElement("div");
          Object.assign(this.div.style, {
            position:  "absolute",
            width:     "48px",
            height:    "48px",
            cursor:    "pointer",
          });
          this.div.innerHTML = `
            <div style="position:relative;width:48px;height:48px;">
              <div style="position:absolute;inset:0;border-radius:50%;border:2px solid #ef4444;animation:cyclone-pulse 1.5s ease-in-out infinite;opacity:0.8;"></div>
              <svg viewBox="0 0 100 100" width="48" height="48">
                <circle cx="50" cy="50" r="14" fill="#d4483b" stroke="#fff" stroke-width="2.5"/>
                <path d="M50 20C65 20 80 35 80 50C80 40 65 32 50 32Z" fill="#ff6b5b" opacity="0.85"/>
                <path d="M80 50C80 65 65 80 50 80C60 80 68 65 68 50Z" fill="#ff6b5b" opacity="0.85"/>
                <path d="M50 80C35 80 20 65 20 50C20 60 35 68 50 68Z" fill="#ff6b5b" opacity="0.85"/>
                <path d="M20 50C20 35 35 20 50 20C40 20 32 35 32 50Z" fill="#ff6b5b" opacity="0.85"/>
                <circle cx="50" cy="50" r="5" fill="#fff"/>
              </svg>
            </div>`;
          const panes = this.getPanes();
          panes?.overlayMouseTarget.appendChild(this.div);
        }
        onRemove() {
          this.div?.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }
      const eyeOverlay = new CycloneEyeOverlay();
      eyeOverlay.setMap(map);

      setLoadStatus("Google Maps Satellite Globe Active");
      setIsReady(true);

    }).catch((err: Error) => {
      if (!cancelled) {
        console.error("[GoogleGlobeView] Maps JS API load failed:", err);
        setLoadError(`Google Maps load failed: ${err.message}`);
      }
    });

    return () => {
      cancelled = true;
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
      mapRef.current = null;
      setIsReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, headingDeg, trajectory.map(t => `${t.lat},${t.lng}`).join("|")]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "620px", overflow: "hidden", background: "#040812" }}>

      {/* Google Maps satellite canvas */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Cyclone pulse keyframe (injected once) */}
      <style>{`@keyframes cyclone-pulse{0%,100%{transform:scale(1);opacity:0.8}50%{transform:scale(1.4);opacity:0.3}}`}</style>

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
            </>
          ) : (
            <>
              <div style={{ fontSize: "2rem", marginBottom: "10px" }}>{"🌍"}</div>
              <div style={{ fontWeight: 800, color: "#38bdf8", marginBottom: "8px" }}>Loading Google Satellite Globe</div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{loadStatus}</div>
            </>
          )}
        </div>
      )}

      {/* HUD top-left badge */}
      <div style={{
        position: "absolute", top: "68px", left: "16px",
        background: "rgba(6,12,22,0.92)", backdropFilter: "blur(16px)",
        border: "1px solid rgba(56,189,248,0.28)", borderRadius: "10px",
        padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px",
        fontSize: "0.78rem", color: "#ffffff", pointerEvents: "auto",
        zIndex: 1100, boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.04em" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: isReady ? "#10b981" : "#f59e0b", boxShadow: isReady ? "0 0 10px #10b981" : "0 0 10px #f59e0b", display: "inline-block" }} />
            <span>GOOGLE MAPS SATELLITE GLOBE</span>
          </div>
          <span style={{ fontSize: "0.65rem", padding: "2px 6px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "4px", color: "#38bdf8", fontWeight: 700 }}>
            {isReady ? "LIVE" : "LOADING"}
          </span>
        </div>

        <div style={{ fontSize: "0.76rem", color: "#94a3b8", lineHeight: 1.5 }}>
          <div>Storm Eye: <strong style={{ color: "#ffffff" }}>{center.lat.toFixed(2)}°N, {center.lng.toFixed(2)}°E</strong></div>
          <div>Movement: <strong style={{ color: "#ffffff" }}>{headingDeg}°</strong> · Speed: <strong style={{ color: "#ffffff" }}>{speedKph} km/h</strong></div>
          <div>Status: <strong style={{ color: "#ff6b5b" }}>ACTIVE SUPER CYCLONIC VORTEX</strong></div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
          <button type="button" onClick={focusOnCyclone}
            style={{ padding: "5px 10px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "6px", color: "#38bdf8", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>
            {"🎯"} Focus Cyclone Eye
          </button>
          <button type="button" onClick={() => setIsAutoRotating(r => !r)}
            style={{ padding: "5px 10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", color: "#fff", cursor: "pointer", fontSize: "0.72rem" }}>
            {isAutoRotating ? "⏸ Pause Spin" : "▶ Auto Spin"}
          </button>
          {onExit3DGlobe && (
            <button type="button" onClick={onExit3DGlobe}
              style={{ padding: "5px 12px", background: "#38bdf8", color: "#050b14", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 800, fontSize: "0.72rem" }}>
              Back to 3D Tactical Map →
            </button>
          )}
        </div>
      </div>

      {/* Bottom instructions */}
      <div style={{
        position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)",
        background: "rgba(6,12,22,0.85)", backdropFilter: "blur(10px)",
        borderRadius: "20px", padding: "6px 18px", fontSize: "0.74rem",
        color: "#94a3b8", pointerEvents: "none", border: "1px solid rgba(255,255,255,0.08)",
        whiteSpace: "nowrap", zIndex: 100,
      }}>
        {isReady
          ? "Left-Click + Drag: Rotate · Scroll: Zoom · Tilt: Right-Click Drag"
          : loadStatus}
      </div>
    </div>
  );
}
