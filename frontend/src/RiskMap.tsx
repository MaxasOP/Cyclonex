import { useEffect, useState, lazy, Suspense } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap as useLeafletMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
const RealWorld3DView = lazy(() => import("./RealWorld3DView"));
const Globe3DView = lazy(() => import("./Globe3DView"));
import type { BuildingFeature, RiskFeature, FullCellAnalysis, ZoneFeature, EvacuationPlan } from "./api";

export type MapAnalysisMode = "DAMAGE" | "HIT" | "WIND" | "EXPOSURE" | "BUILDINGS" | "OBSTACLES" | "ZONES" | "EVACUATION";

const cycloneVortexSvg = `
<div class="cyclone-eye-3d-tower">
  <div class="cyclone-pulse-ring-3d"></div>
  <div class="cyclone-vortex-3d-layer troposphere-upper"></div>
  <div class="cyclone-vortex-3d-layer troposphere-mid"></div>
  <div class="cyclone-vortex-3d-layer troposphere-surface">
    <svg class="cyclone-vortex-svg" viewBox="0 0 100 100" width="48" height="48">
      <circle cx="50" cy="50" r="14" fill="#d4483b" stroke="#ffffff" stroke-width="2.5" />
      <path d="M 50 20 C 65 20, 80 35, 80 50 C 80 40, 65 32, 50 32 Z" fill="#ff6b5b" opacity="0.85" />
      <path d="M 80 50 C 80 65, 65 80, 50 80 C 60 80, 68 65, 68 50 Z" fill="#ff6b5b" opacity="0.85" />
      <path d="M 50 80 C 35 80, 20 65, 20 50 C 20 60, 35 68, 50 68 Z" fill="#ff6b5b" opacity="0.85" />
      <path d="M 20 50 C 20 35, 35 20, 50 20 C 40 20, 32 35, 32 50 Z" fill="#ff6b5b" opacity="0.85" />
      <circle cx="50" cy="50" r="5" fill="#ffffff" />
    </svg>
  </div>
</div>
`;

const cycloneDivIcon = L.divIcon({
  className: "cyclone-vortex-leaflet-icon",
  html: cycloneVortexSvg,
  iconSize: [54, 54],
  iconAnchor: [27, 27],
});

function IconCube3D() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.12 6.4-9-5a2 2 0 0 0-2.24 0l-9 5A2 2 0 0 0 0 8.16v7.68a2 2 0 0 0 .88 1.76l9 5a2 2 0 0 0 2.24 0l9-5a2 2 0 0 0 .88-1.76z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconFocus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function IconTrack() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function computeConePolygon(
  center: { lat: number; lng: number },
  trajectory?: { lat: number; lng: number; label: string }[]
): [number, number][] {
  if (!trajectory || trajectory.length === 0) return [];
  const pts = [{ lat: center.lat, lng: center.lng }, ...trajectory];
  if (pts.length < 2) return [];

  // Calibrated out-of-sample track uncertainty radii in km [0h, 6h, 12h, 24h]
  const radiiKm = [10, 16.93, 34.14, 73.89];

  const leftCoords: [number, number][] = [];
  const rightCoords: [number, number][] = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const rKm = radiiKm[i] ?? radiiKm[radiiKm.length - 1];

    let headingRad = 0;
    if (i < pts.length - 1) {
      const next = pts[i + 1];
      const dy = next.lat - p.lat;
      const dx = (next.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180);
      headingRad = Math.atan2(dy, dx);
    } else {
      const prev = pts[i - 1];
      const dy = p.lat - prev.lat;
      const dx = (p.lng - prev.lng) * Math.cos((p.lat * Math.PI) / 180);
      headingRad = Math.atan2(dy, dx);
    }

    const normalRad = headingRad + Math.PI / 2;
    const dLat = (rKm / 111.0) * Math.sin(normalRad);
    const dLng = (rKm / (111.0 * Math.cos((p.lat * Math.PI) / 180))) * Math.cos(normalRad);

    leftCoords.push([p.lat + dLat, p.lng + dLng]);
    rightCoords.push([p.lat - dLat, p.lng - dLng]);
  }

  // Smooth terminal semicircle arc at the +24h point
  const tipCenter = pts[pts.length - 1];
  const tipRadiusKm = radiiKm[radiiKm.length - 1];
  const lastPrev = pts[pts.length - 2];
  const tipDy = tipCenter.lat - lastPrev.lat;
  const tipDx = (tipCenter.lng - lastPrev.lng) * Math.cos((tipCenter.lat * Math.PI) / 180);
  const tipHeading = Math.atan2(tipDy, tipDx);

  const arcCoords: [number, number][] = [];
  const arcSteps = 12;
  for (let s = 0; s <= arcSteps; s++) {
    const angle = tipHeading + Math.PI / 2 - (s / arcSteps) * Math.PI;
    const dLat = (tipRadiusKm / 111.0) * Math.sin(angle);
    const dLng = (tipRadiusKm / (111.0 * Math.cos((tipCenter.lat * Math.PI) / 180))) * Math.cos(angle);
    arcCoords.push([tipCenter.lat + dLat, tipCenter.lng + dLng]);
  }

  return [...leftCoords, ...arcCoords, ...rightCoords.reverse()];
}

type RiskMapProps = {
  scenarioId?: string;
  center: { lat: number; lng: number };
  features: RiskFeature[];
  buildings: BuildingFeature[];
  zones?: ZoneFeature[];
  sheltersPlan?: EvacuationPlan | null;
  trajectory?: { lat: number; lng: number; label: string }[];
  headingDeg?: number;
  speedKph?: number;
  analysisMode?: MapAnalysisMode;
  showZones?: boolean;
  showShelters?: boolean;
  viewDimension?: "2d" | "real3d" | "globe";
  onViewDimensionChange?: (dim: "2d" | "real3d" | "globe") => void;
  onSelectCell?: (cell: FullCellAnalysis | null) => void;
  locationName?: string;
  onSelectPreset?: (presetKey: string) => void;
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

type BasemapType = "google_dark" | "google_satellite" | "google_street";

const BASEMAPS: Record<BasemapType, { name: string; url: string; attribution: string }> = {
  google_dark: {
    name: "Dark Radar",
    url: `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}&style=feature:all|element:geometry|color:0x0a1a2e&style=feature:all|element:labels.text.fill|color:0x8fa4bf`,
    attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
  },
  google_satellite: {
    name: "Satellite",
    url: `https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}`,
    attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
  },
  google_street: {
    name: "Street Map",
    url: `https://mt{s}.google.com/vt/lyrs=r&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}`,
    attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
  },
};

function getDamageColor(score?: number, fallbackColour?: string): string {
  if (fallbackColour && fallbackColour !== "#75c9f1") return fallbackColour;
  if (score === undefined || score === null) return fallbackColour || "#75c9f1";
  if (score >= 0.55) return "#d4483b"; // 🔴 Red — Severe / Total Destruction Risk
  if (score >= 0.25) return "#ed8a28"; // 🟠 Orange — Damage Likely
  if (score >= 0.10) return "#35a66f"; // 🟢 Green — Safe
  return "#75c9f1"; // 🩵 Sky Blue — No Damage
}

function getHitColor(score?: number, landType?: string): string {
  if (landType === "OCEAN") return "#75c9f1"; // 🩵 Marine / Ocean (No direct land hit)
  if (score === undefined || score === null) return "#75c9f1";
  if (score >= 0.55) return "#d4483b"; // 🔴 Red — Direct Severe Land Hit
  if (score >= 0.25) return "#ed8a28"; // 🟠 Orange — Moderate Land Impact Hit
  if (score >= 0.10) return "#35a66f"; // 🟢 Green — Low Peripheral Land Hit
  return "#75c9f1";
}

function getWindColor(windKph?: number): string {
  if (!windKph) return "#75c9f1";
  if (windKph >= 180) return "#8b0000"; // Deep Red
  if (windKph >= 140) return "#d4483b"; // Red
  if (windKph >= 100) return "#ed8a28"; // Orange
  if (windKph >= 60) return "#f7d070";  // Yellow
  return "#35a66f";                    // Green
}

function getExposureColor(density?: number, landType?: string): string {
  if (landType === "OCEAN") return "#75c9f1";
  if (density === undefined || density === null || density === 0) return "#35a66f"; // Low asset density / open land
  if (density >= 0.5) return "#d4483b"; // 🔴 High Density Urban
  if (density >= 0.2) return "#ed8a28"; // 🟠 Moderate Density
  if (density >= 0.05) return "#f7d070"; // 🟡 Low Density
  return "#35a66f"; // 🟢 Open / Minimal Asset Density
}

function getObstacleColor(level?: string, shelterFactor?: number): string {
  if (shelterFactor !== undefined && shelterFactor !== null) {
    if (shelterFactor <= 0.85) return "#8b0000"; // Deep Red — High Sheltering
    if (shelterFactor <= 0.92) return "#ed8a28"; // Orange — Moderate Sheltering
    return "#35a66f"; // Green — Open / Low Sheltering
  }
  if (level === "HIGH") return "#8b0000";
  if (level === "MODERATE") return "#ed8a28";
  return "#35a66f";
}

function isOceanStrokeFor(landType?: string): boolean {
  return landType === "OCEAN";
}

function LeafletBoundsFitter({
  center,
  features,
  trajectory,
  scenarioId,
  zoomMode = "grid",
}: {
  center: { lat: number; lng: number };
  features: RiskFeature[];
  buildings?: BuildingFeature[];
  trajectory?: { lat: number; lng: number; label: string }[];
  scenarioId?: string;
  zoomMode?: "grid" | "track";
}) {
  const map = useLeafletMap();

  useEffect(() => {
    if (!map) return;

    // Track View: fit bounds to encompass the entire multi-day trajectory
    if (zoomMode === "track" && trajectory && trajectory.length > 0) {
      const trackBounds = L.latLngBounds([]);
      trackBounds.extend([center.lat, center.lng]);
      trajectory.forEach((t) => trackBounds.extend([t.lat, t.lng]));
      if (trackBounds.isValid()) {
        map.fitBounds(trackBounds, { padding: [50, 50], maxZoom: 8 });
        return;
      }
    }

    // Grid View: If 200m damage grid features are present, fit tightly to the grid bounds
    if (features && features.length > 0) {
      let minLat = 90;
      let maxLat = -90;
      let minLng = 180;
      let maxLng = -180;
      for (let i = 0; i < features.length; i++) {
        const p = features[i].properties;
        if (p?.lat != null && p?.lon != null) {
          if (p.lat < minLat) minLat = p.lat;
          if (p.lat > maxLat) maxLat = p.lat;
          if (p.lon < minLng) minLng = p.lon;
          if (p.lon > maxLng) maxLng = p.lon;
        }
      }
      if (minLat <= maxLat && minLng <= maxLng && minLat > -90 && maxLat < 90) {
        const gridBounds = L.latLngBounds([minLat - 0.015, minLng - 0.015], [maxLat + 0.015, maxLng + 0.015]);
        if (gridBounds.isValid()) {
          map.fitBounds(gridBounds, { padding: [30, 30], maxZoom: 12 });
          return;
        }
      }
    }

    // Fallback: fit to regional storm track
    if (trajectory && trajectory.length > 0) {
      const trackBounds = L.latLngBounds([]);
      trajectory.forEach((t) => trackBounds.extend([t.lat, t.lng]));
      trackBounds.extend([center.lat, center.lng]);
      if (trackBounds.isValid()) {
        map.fitBounds(trackBounds, { padding: [40, 40], maxZoom: 8 });
        return;
      }
    }

    map.setView([center.lat, center.lng], 9);
  }, [map, center.lat, center.lng, features.length, scenarioId, zoomMode]);

  return null;
}

function LeafletPlaybackPanner({
  activePoint,
  isNavigating,
}: {
  activePoint: { lat: number; lng: number };
  isNavigating: boolean;
}) {
  const map = useLeafletMap();
  useEffect(() => {
    if (map && isNavigating && activePoint) {
      map.panTo([activePoint.lat, activePoint.lng], { animate: true, duration: 0.8 });
    }
  }, [map, activePoint, isNavigating]);
  return null;
}

function LeafletResizer({ analysisMode, viewDimension }: { analysisMode: string; viewDimension?: string }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (!map) return;
    map.invalidateSize();

    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    const container = map.getContainer();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [map, analysisMode, viewDimension]);
  return null;
}

function buildCellPopupHtml(p: Record<string, unknown>): string {
  const score = Number(p.damage_score ?? p.risk_score ?? 0);
  const scorePct = (score * 100).toFixed(1);
  const windKph = Number(p.wind_kph || 0);
  const windMs = Number(p.wind_ms || 0);
  const windLoading = Number(p.effective_wind_loading_n_m2 || 0);
  const dynamicPa = Number(p.dynamic_pressure_pa || 0);
  const lrRatio = Number(p.load_to_resistance_ratio || 0);
  const lrPct = (lrRatio * 100).toFixed(1);
  const distKm = ((Number(p.distance_to_cyclone_m) || 0) / 1000).toFixed(2);
  const cellColor = String(p.colour || "#75c9f1").toLowerCase();
  const isLand = String(p.land_type || "LAND") !== "OCEAN";

  return `<div style="min-width: 280px; font-family: -apple-system, system-ui, sans-serif;">
    <div style="background: ${cellColor}; color: #0a1a2e; padding: 8px 10px; border-radius: 6px 6px 0 0; margin: -10px -10px 8px -10px; font-weight: 700; font-size: 0.95rem;">
      🌀 200m Cell Damage Inspection
    </div>
    <div style="background: rgba(255,255,255,0.04); padding: 8px 10px; border-radius: 6px; margin-bottom: 6px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: #8fa4bf; font-size: 0.78rem;">DAMAGE SCORE</span>
        <strong style="color: ${cellColor}; font-size: 1.05rem;">${scorePct}%</strong>
      </div>
      <div style="background: rgba(0,0,0,0.4); height: 8px; border-radius: 4px; overflow: hidden;">
        <div style="background: ${cellColor}; height: 100%; width: ${Math.min(score * 100, 100)}%; transition: width 0.3s;"></div>
      </div>
      <div style="margin-top: 4px; font-size: 0.78rem; color: #d6e3f5;">Classification: <strong>${p.classification || "N/A"}</strong></div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px;">
      <div style="background: rgba(255,255,255,0.04); padding: 6px 8px; border-radius: 4px;">
        <div style="color: #8fa4bf; font-size: 0.7rem;">💨 LOCAL WIND</div>
        <div style="font-weight: 600; color: #f7d070; font-size: 0.92rem;">${windKph.toFixed(1)} km/h</div>
        <div style="font-size: 0.72rem; color: #d6e3f5;">${windMs.toFixed(1)} m/s</div>
      </div>
      <div style="background: rgba(255,255,255,0.04); padding: 6px 8px; border-radius: 4px;">
        <div style="color: #8fa4bf; font-size: 0.7rem;">🧭 BEARING</div>
        <div style="font-weight: 600; color: #75c9f1; font-size: 0.92rem;">${(Number(p.bearing_from_eye_deg) || 0).toFixed(0)}°</div>
        <div style="font-size: 0.72rem; color: #d6e3f5;">${distKm} km from eye</div>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.04); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
        <span style="color: #8fa4bf;">Dynamic Pressure</span>
        <strong style="color: #d6e3f5;">${dynamicPa.toFixed(1)} Pa</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
        <span style="color: #8fa4bf;">Effective Wind Loading</span>
        <strong style="color: #d6e3f5;">${windLoading.toFixed(1)} N/m²</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
        <span style="color: #8fa4bf;">Load/Resistance Ratio</span>
        <strong style="color: ${lrRatio >= 1 ? '#d4483b' : lrRatio >= 0.55 ? '#ed8a28' : '#35a66f'};">${lrPct}%</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span style="color: #8fa4bf;">Land Type</span>
        <strong style="color: ${isLand ? '#35a66f' : '#75c9f1'};">${p.land_type || "N/A"}</strong>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.04); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
      <div style="color: #8fa4bf; font-size: 0.7rem; margin-bottom: 3px;">DRIVERS</div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span style="color: #d6e3f5;">Primary</span>
        <strong style="color: #ff6b5b;">${p.primary_driver || "N/A"}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span style="color: #d6e3f5;">Secondary</span>
        <strong style="color: #f7d070;">${p.secondary_driver || "N/A"}</strong>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.04); padding: 6px 10px; border-radius: 4px; margin-bottom: 6px;">
      <div style="color: #8fa4bf; font-size: 0.7rem; margin-bottom: 3px;">STRUCTURE & EXPOSURE</div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span style="color: #d6e3f5;">Estimated Class</span>
        <strong style="color: #d6e3f5;">${p.estimated_class || "N/A"}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span style="color: #d6e3f5;">Building Count</span>
        <strong style="color: #d6e3f5;">${p.building_count || 0}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
        <span style="color: #d6e3f5;">Obstruction Level</span>
        <strong style="color: #d6e3f5;">${p.obstruction_level || "N/A"}</strong>
      </div>
    </div>

    <em style="font-size: 0.72rem; color: #8fa4bf; display: block; text-align: center; margin-top: 4px;">Click cell for full explainable inspection card →</em>
  </div>`;
}

export default function RiskMap({
  scenarioId,
  center,
  features,
  buildings,
  zones = [],
  sheltersPlan = null,
  trajectory,
  headingDeg = 315,
  speedKph = 25,
  analysisMode = "DAMAGE",
  showZones = true,
  showShelters = true,
  viewDimension: viewDimensionProp,
  onViewDimensionChange: onViewDimensionChangeProp,
  onSelectCell,
  locationName,
  onSelectPreset,
}: RiskMapProps) {
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>("google_dark");
  const [gridOpacity, setGridOpacity] = useState<number>(0.74);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [zoomMode, setZoomMode] = useState<"grid" | "track">("grid");
  const [internalViewDimension, setInternalViewDimension] = useState<"2d" | "real3d" | "globe">("real3d");
  const viewDimension = viewDimensionProp ?? internalViewDimension;
  const setViewDimension = onViewDimensionChangeProp ?? setInternalViewDimension;

  // Assemble full trajectory waypoints: [0h (Live), +6h, +12h, +24h]
  const allWaypoints = [
    { lat: center.lat, lng: center.lng, label: "0h (Live Eye)" },
    ...(trajectory || []),
  ];

  // Auto playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setPlaybackIndex((prev) => (prev + 1) % Math.max(1, allWaypoints.length));
    }, 1600);
    return () => clearInterval(timer);
  }, [isPlaying, allWaypoints.length]);

  const activeEyePoint = allWaypoints[playbackIndex] || allWaypoints[0];
  const conePolygonCoords = computeConePolygon(center, trajectory);
  const polylineCoords = (trajectory || []).map((t) => [t.lat, t.lng] as [number, number]);
  const fullTrackCoords = [[center.lat, center.lng], ...polylineCoords] as [number, number][];

  useEffect(() => {
    console.log("[CYCLONEX MAP DEBUG]", {
      basemapLoaded: true,
      featureCount: features.length,
      buildingCount: buildings.length,
      analysisMode,
      center,
      firstFeature: features[0] ? features[0].properties : null,
    });
  }, [features, buildings, analysisMode, center]);

  // Compute movement direction vector endpoint (15 km length vector)
  const vectorLengthKm = 0.15; // ~15 km vector length in degrees lat/lon
  const headingVectorEnd = [
    activeEyePoint.lat + vectorLengthKm * Math.cos((((90 - headingDeg) % 360) * Math.PI) / 180),
    activeEyePoint.lng + vectorLengthKm * Math.sin((((90 - headingDeg) % 360) * Math.PI) / 180),
  ] as [number, number];

  return (
    <div className="leaflet-map-wrapper">
      {/* Unified Map Command Dock (Top Right) - Only in 2D Tactical Mode */}
      {viewDimension === "2d" && (
        <div className="map-view-dock" aria-label="Map View Controls">
          {/* 3D Mode Selector Group */}
          <div className="dock-group dimension-group">
            <button
              type="button"
              className="dock-btn active"
              onClick={() => setViewDimension("2d")}
              title="2D Risk Map - Color-coded damage areas"
            >
              <IconCube3D />
              <span>Map</span>
            </button>
            <button
              type="button"
              className="dock-btn"
              onClick={() => setViewDimension("real3d")}
              title="3D view - Buildings and terrain"
            >
              <span>3D View</span>
            </button>
            <button
              type="button"
              className="dock-btn"
              onClick={() => setViewDimension("globe")}
              title="Global storm position on Earth"
            >
              <IconTrack />
              <span>Globe</span>
            </button>
          </div>
          <div className="dock-divider" />
          <div className="dock-group">
            <button
              type="button"
              className={`dock-btn ${zoomMode === "grid" ? "active" : ""}`}
              onClick={() => setZoomMode("grid")}
              title="Focus on detailed damage areas"
            >
              <IconFocus />
              <span>Zoom In</span>
            </button>
            <button
              type="button"
              className={`dock-btn ${zoomMode === "track" ? "active" : ""}`}
              onClick={() => setZoomMode("track")}
              title="See full storm track"
            >
              <IconTrack />
              <span>Zoom Out</span>
            </button>
          </div>
          <div className="dock-divider" />
          <div className="dock-group">
            {(Object.keys(BASEMAPS) as BasemapType[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`dock-btn ${activeBasemap === key ? "active" : ""}`}
                onClick={() => setActiveBasemap(key)}
              >
                {BASEMAPS[key].name}
              </button>
            ))}
          </div>
          <div className="dock-divider" />
          <div className="dock-opacity">
            <span className="dock-opacity-label">Grid {Math.round(gridOpacity * 100)}%</span>
            <input
              type="range"
              min="15"
              max="95"
              value={Math.round(gridOpacity * 100)}
              onChange={(e) => setGridOpacity(Number(e.target.value) / 100)}
              className="dock-opacity-slider"
              title="Adjust 200m damage grid layer opacity (15%–95%)"
            />
          </div>
        </div>
      )}

      {/* Trajectory Playback Scrubber Dock (Bottom Center) - Only in 2D Mode */}
      {viewDimension === "2d" && allWaypoints.length > 1 && (
        <div className="map-timeline-player" aria-label="Forecast trajectory playback">
          <button
            type="button"
            className={`timeline-play-btn ${isPlaying ? "playing" : ""}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause Track Playback" : "Play Forecast Trajectory"}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
            <span>{isPlaying ? "Pause" : "Play Track"}</span>
          </button>
          <div className="timeline-steps">
            {allWaypoints.map((wp, idx) => (
              <button
                key={wp.label}
                type="button"
                className={`timeline-step-btn ${playbackIndex === idx ? "active" : ""}`}
                onClick={() => {
                  setPlaybackIndex(idx);
                  setIsPlaying(false);
                }}
              >
                {idx === 0 ? "0h Live" : wp.label.replace("Forecast", "").trim()}
              </button>
            ))}
          </div>
          <span className="timeline-badge">
            <span className="timeline-pulse-dot" />
            {activeEyePoint.label}
          </span>
        </div>
      )}

      {/* 3D Real-World City & Buildings */}
      {viewDimension === "real3d" && (
        <Suspense fallback={<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070c14", color: "#8fa4bf" }}>Loading 3D view...</div>}>
          <RealWorld3DView
            center={center}
            locationName={locationName}
            features={features}
            buildings={buildings}
            sheltersPlan={sheltersPlan}
            speedKph={speedKph}
            headingDeg={headingDeg}
            onExitReal3D={() => setViewDimension("2d")}
            onSelectPreset={onSelectPreset}
          />
        </Suspense>
      )}

      {/* 3D Planetary Globe */}
      {viewDimension === "globe" && (
<<<<<<< Updated upstream
        <Suspense fallback={<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070c14", color: "#8fa4bf" }}>Loading globe...</div>}>
          <Globe3DView
            center={center}
            trajectory={trajectory}
            headingDeg={headingDeg}
            speedKph={speedKph}
            onExit3DGlobe={() => setViewDimension("2d")}
          />
        </Suspense>
=======
        <Globe3DView
          center={center}
          trajectory={trajectory}
          headingDeg={headingDeg}
          speedKph={speedKph}
          locationName={locationName}
          onExit3DGlobe={() => setViewDimension("2d")}
          onSelectPreset={onSelectPreset}
        />
>>>>>>> Stashed changes
      )}

      {/* High-Precision Tactical Geospatial GIS Map (Leaflet) */}
      <div
        className="map-viewport-wrapper"
        style={{
          width: "100%",
          height: "100%",
          minHeight: "620px",
          position: viewDimension === "2d" ? "relative" : "absolute",
          left: viewDimension === "2d" ? 0 : "-99999px",
          top: 0,
          visibility: viewDimension === "2d" ? "visible" : "hidden",
          pointerEvents: viewDimension === "2d" ? "auto" : "none",
        }}
      >
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={10}
          scrollWheelZoom={true}
          preferCanvas={true}
          style={{ width: "100%", height: "100%", minHeight: "620px" }}
        >
          <LeafletResizer analysisMode={analysisMode} viewDimension={viewDimension} />
            <LeafletBoundsFitter
              center={center}
          features={features}
          buildings={buildings}
          trajectory={trajectory}
          scenarioId={scenarioId}
          zoomMode={zoomMode}
        />
        <LeafletPlaybackPanner
          activePoint={activeEyePoint}
          isNavigating={isPlaying || playbackIndex > 0}
        />

        <TileLayer
          key={activeBasemap}
          attribution={BASEMAPS[activeBasemap].attribution}
          url={BASEMAPS[activeBasemap].url}
          subdomains="0123"
          maxZoom={20}
        />

        {/* 0. Official IMD/NHC Cone of Uncertainty Polygon */}
        {conePolygonCoords.length > 2 && (
          <Polygon
            positions={conePolygonCoords}
            pathOptions={{
              fillColor: "#ff9100",
              fillOpacity: 0.16,
              color: "#ffab40",
              weight: 1.8,
              dashArray: "6, 6",
            }}
          >
            <Popup>
              <div style={{ fontFamily: "-apple-system, system-ui, sans-serif", fontSize: "0.82rem" }}>
                <strong style={{ color: "#ffab40" }}>⚠️ IMD Cone of Uncertainty</strong>
                <div style={{ marginTop: "4px", color: "#d7e5f5", lineHeight: 1.4 }}>
                  Represents 67% probability envelope of cyclone track based on out-of-sample error:
                  <br />• 6h error radius: ±16.9 km
                  <br />• 12h error radius: ±34.1 km
                  <br />• 24h error radius: ±73.9 km
                </div>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* 1. 200 m Spatial Damage & Hazard Grid (Underneath tracks/markers) */}
        {features.length > 0 && (
          <GeoJSON
            key={`risk-${scenarioId || "live"}-${features[0]?.id || "f0"}-${analysisMode}`}
            data={{ type: "FeatureCollection", features } as never}
            style={(feature) => {
              const props = feature?.properties || {};
              let fillColor = "#75c9f1";

              if (analysisMode === "DAMAGE") {
                const score = props.damage_score ?? props.risk_score;
                fillColor = getDamageColor(score, props.colour);
              } else if (analysisMode === "HIT") {
                const score = props.damage_score ?? props.risk_score;
                fillColor = getHitColor(score, props.land_type);
              } else if (analysisMode === "WIND") {
                fillColor = getWindColor(props.wind_kph);
              } else if (analysisMode === "EXPOSURE") {
                fillColor = getExposureColor(props.building_density, props.land_type);
              } else if (analysisMode === "OBSTACLES") {
                fillColor = getObstacleColor(props.obstruction_level, props.full_cell_analysis?.obstacles?.shelter_factor);
              } else {
                fillColor = getDamageColor(props.damage_score, props.colour);
              }

              const isOcean = props.land_type === "OCEAN";
              return {
                fillColor,
                fillOpacity: isOcean ? Math.max(0.1, gridOpacity * 0.45) : gridOpacity,
                color: isOcean ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.38)",
                weight: 0.75,
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const score = props.damage_score ?? props.risk_score ?? 0;
              const scorePct = (score * 100).toFixed(0);
              const windKph = (props.wind_kph || 0).toFixed(0);
              const landType = props.land_type || "LAND";
              const isOcean = landType === "OCEAN";
              const tooltipText = `<div style="font-family: -apple-system, system-ui, sans-serif; font-size: 0.78rem;">
                <div style="font-weight: 700; color: ${props.colour || '#75c9f1'}; margin-bottom: 2px;">⚡ ${scorePct}% damage</div>
                <div style="color: #d6e3f5;">💨 ${windKph} km/h · ${landType}</div>
                <div style="color: #8fa4bf; font-size: 0.7rem; margin-top: 2px;">Click for full analysis</div>
              </div>`;
              layer.bindTooltip(tooltipText, {
                sticky: true,
                direction: "top",
                offset: [0, -4],
                className: "cyclonex-cell-tooltip",
                opacity: 0.95,
              });
              layer.on("mouseover", () => {
                (layer as L.Path & { setStyle?: (s: Record<string, unknown>) => void }).setStyle?.({
                  weight: 2.2,
                  color: "#ffffff",
                  fillOpacity: 0.95,
                });
              });
              layer.on("mouseout", () => {
                (layer as L.Path & { setStyle?: (s: Record<string, unknown>) => void }).setStyle?.({
                  weight: 0.75,
                  color: isOcean ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.38)",
                  fillOpacity: isOcean ? Math.max(0.1, gridOpacity * 0.45) : gridOpacity,
                });
              });
              layer.on("click", (e) => {
                const l = layer as L.Path & { getPopup?: () => unknown; bindPopup?: (c: string) => void; openPopup?: (latlng?: unknown) => void };
                if (l.bindPopup && (!l.getPopup || !l.getPopup())) {
                  l.bindPopup(buildCellPopupHtml(props));
                }
                l.openPopup?.(e.latlng);

                if (!onSelectCell) return;
                const analysis: FullCellAnalysis = {
                  cell_id: (feature.id as string) || "cell",
                  lat: props.lat,
                  lon: props.lon,
                  cyclone_heading_deg: props.cyclone_heading_deg,
                  relative_direction_deg: props.relative_direction_deg,
                  land_type: props.land_type || "LAND",
                  hazard: {
                    wind_kph: props.wind_kph || 0,
                    wind_ms: props.wind_ms || 0,
                    wind_direction_deg: props.wind_direction_deg || 0,
                    distance_to_eye_m: props.distance_to_cyclone_m || 0,
                    bearing_from_eye_deg: props.bearing_from_eye_deg || 0,
                    pressure_hpa: props.pressure_hpa || 960,
                    pressure_deficit_hpa: props.pressure_deficit_hpa || 50,
                    rain_rate_mm_hr: props.rain_rate_mm_hr || 0,
                    storm_surge_m: props.storm_surge_m || 0,
                    hazard_score: props.hazard_score || props.damage_score || 0,
                  },
                  wind_force: {
                    dynamic_pressure_pa: props.dynamic_pressure_pa || 0,
                    drag_coefficient: 1.3,
                    shelter_factor: props.shelter_factor ?? 1.0,
                    modeled_wind_loading_n_m2: props.modeled_wind_loading_n_m2 || props.effective_wind_loading_n_m2 || 0,
                    effective_wind_loading_n_m2: props.effective_wind_loading_n_m2 || 0,
                  },
                  exposure: {
                    building_count: props.building_count || 0,
                    building_density: props.building_density || 0,
                    avg_building_height_m: props.avg_building_height_m ?? 0,
                    max_building_height_m: props.max_building_height_m ?? 0,
                    taller_building_count: 0,
                    exposure_score: props.exposure_score ?? 0,
                  },
                  obstacles: {
                    avg_upwind_height_m: props.avg_upwind_height_m ?? 0,
                    max_upwind_height_m: 0,
                    obstruction_level: props.obstruction_level || "LOW_OPEN",
                    shelter_factor: props.shelter_factor ?? 1.0,
                  },
                  structure: {
                    estimated_class: props.estimated_class || "OPEN_LAND_INFERRED",
                    vulnerability_score: props.vulnerability_score ?? 0,
                    estimated_resistance_pa: props.estimated_resistance_pa ?? 300,
                    load_to_resistance_ratio: props.load_to_resistance_ratio || 0,
                    data_provenance: {
                      building_footprint: props.building_count > 0 ? "OBSERVED (OSM)" : "NOT_AVAILABLE",
                      material: "INFERRED",
                      height: "INFERRED",
                      resistance_pa: "ASSUMED_SCREENING_VALUE",
                      structural_class: "INFERRED",
                      modeled: ["local_wind_field", "dynamic_pressure", "effective_wind_loading", "damage_score"],
                    },
                  },
                  damage: {
                    hazard_score: props.hazard_score || props.damage_score || 0,
                    exposure_score: props.exposure_score ?? 0,
                    vulnerability_score: props.vulnerability_score ?? 0,
                    structural_response_score: props.load_to_resistance_ratio
                      ? Math.min(1, props.load_to_resistance_ratio / 1.5)
                      : 0,
                    damage_score: props.damage_score || 0,
                    classification: props.classification || "SAFE",
                    colour: props.colour || "#35a66f",
                    description: props.description || "",
                  },
                  drivers: {
                    primary: props.primary_driver || "HIGH_WIND_HAZARD",
                    secondary: props.secondary_driver || "STRUCTURAL_RESPONSE_LRR",
                  },
                };
                onSelectCell(analysis);
              });
            }}
          />
        )}

        {/* 2. Building Footprints Layer */}
        {buildings.length > 0 && (
          <GeoJSON
            key={`bldg-${buildings.length}-${center.lat}-${center.lng}-${analysisMode}`}
            data={{ type: "FeatureCollection", features: buildings } as never}
            style={(feature) => {
              const props = feature?.properties || {};
              const isBuildingsMode = analysisMode === "BUILDINGS";
              const isTaller = props.is_locally_taller;
              const dmg = props.damage_score ?? 0.2;
              let strokeColor = "#38bdf8";
              let fillColor = "#0284c7";
              if (dmg >= 0.55) {
                strokeColor = "#ef4444";
                fillColor = "#dc2626";
              } else if (dmg >= 0.25) {
                strokeColor = "#f59e0b";
                fillColor = "#d97706";
              } else if (dmg >= 0.1) {
                strokeColor = "#22c55e";
                fillColor = "#16a34a";
              }
              if (props.display_colour && props.display_colour !== "#0a2a57") {
                strokeColor = props.display_colour;
                fillColor = props.display_colour;
              }

              return {
                fillColor,
                fillOpacity: isBuildingsMode ? 0.85 : 0.22,
                color: isTaller ? "#ffffff" : strokeColor,
                weight: isBuildingsMode ? 2.2 : 1,
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const dmg = props.damage_score ?? 0.2;
              const bColor = props.display_colour && props.display_colour !== "#0a2a57"
                ? props.display_colour
                : dmg >= 0.55 ? "#ef4444" : dmg >= 0.25 ? "#f59e0b" : "#22c55e";
              const heightM = props.height_m ? props.height_m.toFixed(1) + " m" : "Inferred (8.5 m)";
              const damageScore = props.damage_score;
              const damagePct = damageScore !== null && damageScore !== undefined ? (damageScore * 100).toFixed(1) + "%" : "20.0%";
              layer.bindPopup(
                `<div style="min-width: 240px; font-family: -apple-system, system-ui, sans-serif;">
                  <div style="background: ${bColor}; color: #ffffff; padding: 8px 10px; border-radius: 6px 6px 0 0; margin: -10px -10px 8px -10px; font-weight: 700; font-size: 0.95rem;">
                    ${props.name || "Building Footprint"}
                  </div>
                  <div style="background: rgba(255,255,255,0.04); padding: 6px 10px; border-radius: 4px; margin-bottom: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 2px;">
                      <span style="color: #8fa4bf;">Structure Type</span>
                      <strong style="color: #38bdf8;">${props.building_type || "RESIDENTIAL"}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 2px;">
                      <span style="color: #8fa4bf;">Height</span>
                      <strong style="color: #d6e3f5;">${heightM}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 2px;">
                      <span style="color: #8fa4bf;">Wind Force Exposure</span>
                      <strong style="color: ${props.is_locally_taller ? '#d4483b' : '#35a66f'};">${props.is_locally_taller ? "High Aerodynamic Drag" : "Standard Sheltered"}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 2px;">
                      <span style="color: #8fa4bf;">Damage Probability</span>
                      <strong style="color: ${bColor};">${damagePct}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                      <span style="color: #8fa4bf;">Classification</span>
                      <strong style="color: ${bColor};">${props.classification || "MODERATE"}</strong>
                    </div>
                  </div>
                  <div style="font-size: 0.7rem; color: #8fa4bf; text-align: center; margin-top: 4px;">
                    Sourced from 200m spatial hydrodynamic screening
                  </div>
                </div>`
              );
            }}
          />
        )}

        {/* 2b. Land-Use Zones Layer */}
        {(analysisMode === "ZONES" || showZones) && zones.length > 0 && (
          <GeoJSON
            key={`zones-${zones.length}-${center.lat}-${center.lng}`}
            data={{ type: "FeatureCollection", features: zones } as never}
            style={(feature) => ({
              fillColor: String(feature?.properties?.zone_colour || "#6b7f99"),
              fillOpacity: analysisMode === "ZONES" ? 0.65 : 0.28,
              color: String(feature?.properties?.zone_colour || "#6b7f99"),
              weight: 1.5,
              dashArray: "4, 6",
            })}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              layer.bindPopup(
                `<div style="min-width: 220px; font-family: -apple-system, system-ui, sans-serif;">
                  <div style="background: ${props.zone_colour || '#6b7f99'}; color: #0a1a2e; padding: 6px 10px; border-radius: 4px 4px 0 0; font-weight: 700; font-size: 0.9rem;">
                    Land-Use: ${props.zone_label || "Unclassified Zone"}
                  </div>
                  <div style="padding: 6px 8px; font-size: 0.8rem; color: #d7e5f5; line-height: 1.5;">
                    <div>Type: <strong>${props.zone_type || "UNKNOWN"}</strong></div>
                    <div>Vulnerability Factor: <strong>${((props.zone_vulnerability || 0) * 100).toFixed(0)}%</strong></div>
                    <div>Area: <strong>${props.area_m2 ? (props.area_m2 / 10000).toFixed(1) + " ha" : "N/A"}</strong></div>
                    ${props.osm_name ? `<div style="margin-top: 3px; color: #8fa4bf;"><em>${props.osm_name}</em></div>` : ""}
                  </div>
                </div>`
              );
            }}
          />
        )}

        {/* 2c. Multipurpose Cyclone Shelters (MPCS) */}
        {(analysisMode === "EVACUATION" || showShelters) && sheltersPlan && sheltersPlan.shelters.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={s.evacuation_priority === "IMMEDIATE" ? 10 : 8}
            pathOptions={{
              fillColor: s.evacuation_priority === "IMMEDIATE" ? "#d4483b" : "#35a66f",
              color: "#ffffff",
              weight: 2.5,
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "-apple-system, system-ui, sans-serif", minWidth: "220px" }}>
                <div style={{ fontWeight: 700, color: s.evacuation_priority === "IMMEDIATE" ? "#ff6b5b" : "#35a66f", fontSize: "0.95rem", marginBottom: "4px" }}>
                  {s.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#d7e5f5", lineHeight: "1.5" }}>
                  <div>Capacity: <strong style={{ color: "#75c9f1" }}>{s.capacity.toLocaleString()} persons</strong></div>
                  <div>District: <strong>{s.district}, {s.state}</strong></div>
                  <div>Facility: <strong>{s.facility_type}</strong></div>
                  <div>Distance from eye: <strong>{s.distance_km} km</strong></div>
                  <div style={{ marginTop: "4px" }}>
                    Status: <span style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      background: s.evacuation_priority === "IMMEDIATE" ? "#d4483b" : "#35a66f",
                      color: "#ffffff",
                    }}>{s.evacuation_priority} ACTIVE</span>
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 3. Continuous Forecast Trajectory Polyline */}
        {fullTrackCoords.length > 1 && (
          <Polyline
            positions={fullTrackCoords}
            pathOptions={{ color: "#75c9f1", weight: 3.5, dashArray: "6, 8" }}
          />
        )}

        {/* 4. Storm Movement Direction Vector Line */}
        <Polyline
          positions={[[activeEyePoint.lat, activeEyePoint.lng], headingVectorEnd]}
          pathOptions={{ color: "#ff6b5b", weight: 4, opacity: 0.9 }}
        />

        {/* 5. Forecast Trajectory Waypoints (+6h, +12h, +24h) */}
        {(trajectory || []).map((t, idx) => (
          <CircleMarker
            key={`traj-${idx}-${t.lat}-${t.lng}`}
            center={[t.lat, t.lng]}
            radius={8}
            pathOptions={{
              fillColor: "#ff9100",
              color: "#ffffff",
              weight: 2.5,
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div style={{ fontFamily: "-apple-system, system-ui, sans-serif", minWidth: "190px" }}>
                <div style={{ fontWeight: 800, color: "#ff9100", fontSize: "0.92rem", marginBottom: "4px" }}>
                  {t.label}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#d7e5f5", lineHeight: 1.5 }}>
                  <div>Latitude: <strong>{t.lat.toFixed(4)}°N</strong></div>
                  <div>Longitude: <strong>{t.lng.toFixed(4)}°E</strong></div>
                  <div>Forecast Horizon: <strong>+{idx === 0 ? "6" : idx === 1 ? "12" : "24"} Hours</strong></div>
                  <div style={{ marginTop: "4px", color: "#8fa4bf", fontSize: "0.72rem" }}>
                    Click scrubber button below to track storm eye to this location.
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 6. Pulsing Rmax Wind Core Danger Boundary (28 km Radius) */}
        <Circle
          center={[activeEyePoint.lat, activeEyePoint.lng]}
          radius={28000}
          pathOptions={{
            color: "#ff4436",
            fillColor: "#ff4436",
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: "5, 5",
          }}
        />

        {/* 7. Animated Rotating Cyclone Vortex Eye Marker (On Top) */}
        <Marker
          position={[activeEyePoint.lat, activeEyePoint.lng]}
          icon={cycloneDivIcon}
        >
          <Popup>
            <div style={{ fontFamily: "-apple-system, system-ui, sans-serif", minWidth: "220px" }}>
              <div style={{ fontWeight: 800, color: "#ff6b5b", fontSize: "0.95rem", marginBottom: "4px" }}>
                {activeEyePoint.label}
              </div>
              <div style={{ fontSize: "0.82rem", color: "#d7e5f5", lineHeight: 1.5 }}>
                <div>Position: <strong>{activeEyePoint.lat.toFixed(2)}°N, {activeEyePoint.lng.toFixed(2)}°E</strong></div>
                <div>Movement Heading: <strong>{headingDeg}°</strong> ({speedKph} km/h)</div>
                <div>Radius of Max Wind ($R_{'{'}max{'}'}$): <strong>28 km</strong></div>
                {playbackIndex > 0 ? (
                  <div style={{ marginTop: "4px", padding: "3px 6px", background: "rgba(255, 171, 64, 0.15)", border: "1px solid #ffab40", borderRadius: "4px", color: "#ffab40", fontWeight: 700, fontSize: "0.74rem" }}>
                    Track Trajectory Horizon Stage +{playbackIndex === 1 ? "6h" : playbackIndex === 2 ? "12h" : "24h"}
                  </div>
                ) : (
                  <div style={{ marginTop: "4px", color: "#35a66f", fontWeight: 700, fontSize: "0.74rem" }}>
                    ● LIVE OBSERVED RADAR/SATELLITE POSITION
                  </div>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
      </div>
    </div>
  );
}
