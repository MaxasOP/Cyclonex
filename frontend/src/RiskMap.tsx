import { useEffect, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap as useLeafletMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { BuildingFeature, RiskFeature, FullCellAnalysis } from "./api";

export type MapAnalysisMode = "DAMAGE" | "HIT" | "WIND" | "EXPOSURE" | "BUILDINGS" | "OBSTACLES";

type RiskMapProps = {
  scenarioId?: string;
  center: { lat: number; lng: number };
  features: RiskFeature[];
  buildings: BuildingFeature[];
  trajectory?: { lat: number; lng: number; label: string }[];
  headingDeg?: number;
  speedKph?: number;
  analysisMode?: MapAnalysisMode;
  onSelectCell?: (cell: FullCellAnalysis | null) => void;
};

type BasemapType = "osm" | "esri" | "carto";

const BASEMAPS: Record<BasemapType, { name: string; url: string; attribution: string }> = {
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  esri: {
    name: "Esri Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  carto: {
    name: "Carto Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
}: {
  center: { lat: number; lng: number };
  features: RiskFeature[];
  buildings?: BuildingFeature[];
  trajectory?: { lat: number; lng: number; label: string }[];
  scenarioId?: string;
}) {
  const map = useLeafletMap();

  useEffect(() => {
    if (!map) return;

    // If 200m damage grid features are present, fit tightly to the grid bounds!
    if (features && features.length > 0) {
      let minLat = 90;
      let maxLat = -90;
      let minLng = 180;
      let maxLng = -180;
      for (let i = 0; i < features.length; i++) {
        const ring = features[i].geometry?.coordinates?.[0];
        if (ring && ring.length > 0) {
          const c0 = ring[0];
          const c2 = ring[2] || ring[1];
          if (c0[1] < minLat) minLat = c0[1];
          if (c2[1] > maxLat) maxLat = c2[1];
          if (c0[0] < minLng) minLng = c0[0];
          if (c2[0] > maxLng) maxLng = c2[0];
        }
      }
      const gridBounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
      if (gridBounds.isValid()) {
        map.fitBounds(gridBounds, { padding: [30, 30], maxZoom: 13 });
        return;
      }
    }

    // If no grid features yet, fit to the regional storm track
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
  }, [map, center.lat, center.lng, features, trajectory, scenarioId]);

  return null;
}

function LeafletViewUpdater({
  center,
  scenarioId,
}: {
  center: { lat: number; lng: number };
  scenarioId?: string;
}) {
  const map = useLeafletMap();
  useEffect(() => {
    if (map) {
      map.panTo([center.lat, center.lng], { animate: true, duration: 0.6 });
      map.invalidateSize();
    }
  }, [map, center.lat, center.lng, scenarioId]);
  return null;
}

function LeafletResizer({ analysisMode }: { analysisMode: string }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (map) {
      map.invalidateSize();
    }
  }, [map, analysisMode]);
  return null;
}

export default function RiskMap({
  scenarioId,
  center,
  features,
  buildings,
  trajectory,
  headingDeg = 315,
  speedKph = 25,
  analysisMode = "DAMAGE",
  onSelectCell,
}: RiskMapProps) {
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>("osm");
  const polylineCoords = (trajectory || []).map((t) => [t.lat, t.lng] as [number, number]);

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
    center.lat + vectorLengthKm * Math.cos((((90 - headingDeg) % 360) * Math.PI) / 180),
    center.lng + vectorLengthKm * Math.sin((((90 - headingDeg) % 360) * Math.PI) / 180),
  ] as [number, number];

  return (
    <div className="leaflet-map-wrapper">
      {/* Floating Basemap Selector */}
      <div className="basemap-selector" aria-label="Basemap selector">
        {(Object.keys(BASEMAPS) as BasemapType[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`basemap-btn ${activeBasemap === key ? "active" : ""}`}
            onClick={() => setActiveBasemap(key)}
          >
            {BASEMAPS[key].name}
          </button>
        ))}
      </div>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={10}
        scrollWheelZoom={true}
        preferCanvas={true}
        style={{ width: "100%", height: "100%", minHeight: "620px" }}
      >
        <LeafletResizer analysisMode={analysisMode} />
        <LeafletViewUpdater center={center} scenarioId={scenarioId} />
        <LeafletBoundsFitter
          center={center}
          features={features}
          buildings={buildings}
          trajectory={trajectory}
          scenarioId={scenarioId}
        />

        <TileLayer
          key={activeBasemap}
          attribution={BASEMAPS[activeBasemap].attribution}
          url={BASEMAPS[activeBasemap].url}
        />

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
                fillOpacity: isOcean ? 0.35 : 0.72,
                color: isOcean ? "#ffffff" : "#ffffff",
                weight: 1,
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const score = props.damage_score ?? props.risk_score ?? 0;
              const scorePct = (score * 100).toFixed(0);
              const windKph = (props.wind_kph || 0).toFixed(0);
              const landType = props.land_type || "LAND";
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
                  weight: 2.5,
                  color: "#ffffff",
                });
              });
              layer.on("mouseout", () => {
                (layer as L.Path & { setStyle?: (s: Record<string, unknown>) => void }).setStyle?.({
                  weight: 1,
                  color: isOceanStrokeFor(props.land_type) ? "#ffffff" : "#ffffff",
                });
              });
              layer.on("click", () => {
                if (!onSelectCell) return;
                const props = feature.properties || {};
                const analysis: FullCellAnalysis = props.full_cell_analysis || {
                  cell_id: feature.id || "cell",
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
                    pressure_hpa: 960,
                    pressure_deficit_hpa: 50,
                    rain_rate_mm_hr: 0,
                    storm_surge_m: 0,
                    hazard_score: props.damage_score || 0,
                  },
                  wind_force: {
                    dynamic_pressure_pa: props.dynamic_pressure_pa || 0,
                    effective_wind_loading_n_m2: props.effective_wind_loading_n_m2 || 0,
                  },
                  exposure: {
                    building_count: props.building_count || 0,
                    building_density: props.building_density || 0,
                    avg_building_height_m: 6.0,
                    max_building_height_m: 12.0,
                    taller_building_count: 0,
                    exposure_score: 0.5,
                  },
                  obstacles: {
                    avg_upwind_height_m: 0,
                    max_upwind_height_m: 0,
                    obstruction_level: props.obstruction_level || "LOW",
                    shelter_factor: 1.0,
                  },
                  structure: {
                    estimated_class: props.estimated_class || "RESIDENTIAL_MASONRY",
                    vulnerability_score: 0.8,
                    estimated_resistance_pa: 900,
                    load_to_resistance_ratio: props.load_to_resistance_ratio || 0,
                    data_provenance: {
                      building_footprint: "ESTIMATED",
                      material: "MIXED",
                      height: "ESTIMATED",
                      resistance_pa: "ASSUMED_SCREENING_VALUE",
                      structural_class: "INFERRED",
                      modeled: ["local_wind_field", "dynamic_pressure", "effective_wind_loading", "damage_score"],
                    },
                  },
                  damage: {
                    hazard_score: props.damage_score || 0,
                    exposure_score: 0.5,
                    vulnerability_score: 0.8,
                    structural_response_score: 0.5,
                    damage_score: props.damage_score || 0,
                    classification: props.classification || "SAFE",
                    colour: props.colour || "#35a66f",
                    description: props.description || "",
                  },
                  drivers: {
                    primary: props.primary_driver || "WIND",
                    secondary: props.secondary_driver || "EXPOSURE",
                  },
                };
                onSelectCell(analysis);
              });

              // Wrap popup-building in an IIFE to scope variables (avoids duplicates with
              // the tooltip variables declared earlier in the same onEachFeature scope).
              ((p: Record<string, unknown>) => {
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
              layer.bindPopup(
                `<div style="min-width: 280px; font-family: -apple-system, system-ui, sans-serif;">
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
                </div>`
              );
              })(props);
            }}
          />
        )}

        {/* 2. Building Footprints Layer */}
        {(analysisMode === "BUILDINGS" || buildings.length > 0) && (
          <GeoJSON
            key={`bldg-${buildings.length}-${center.lat}-${center.lng}`}
            data={{ type: "FeatureCollection", features: buildings } as never}
            style={(feature) => ({
              fillColor: String(feature?.properties?.display_colour || "#0a2a57"),
              fillOpacity: 0.88,
              color: feature?.properties?.is_locally_taller ? "#ffffff" : "#0a2a57",
              weight: 1.5,
            })}
            onEachFeature={(feature, layer) => {
              const props = feature.properties || {};
              const bColor = (props.display_colour || "#0a2a57").toLowerCase();
              const heightM = props.height_m ? props.height_m.toFixed(1) + " m" : "Unknown / Inferred";
              const damageScore = props.damage_score;
              const damagePct = damageScore !== null && damageScore !== undefined ? (damageScore * 100).toFixed(1) + "%" : "N/A";
              layer.bindPopup(
                `<div style="min-width: 240px; font-family: -apple-system, system-ui, sans-serif;">
                  <div style="background: ${bColor}; color: #0a1a2e; padding: 8px 10px; border-radius: 6px 6px 0 0; margin: -10px -10px 8px -10px; font-weight: 700; font-size: 0.95rem;">
                    🏢 Building Footprint Inspection
                  </div>
                  <div style="background: rgba(255,255,255,0.04); padding: 6px 10px; border-radius: 4px; margin-bottom: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 2px;">
                      <span style="color: #8fa4bf;">Height</span>
                      <strong style="color: #d6e3f5;">${heightM}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 2px;">
                      <span style="color: #8fa4bf;">Locally Taller / Exposed</span>
                      <strong style="color: ${props.is_locally_taller ? '#d4483b' : '#35a66f'};">${props.is_locally_taller ? "Yes (High Vulnerability)" : "No"}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 2px;">
                      <span style="color: #8fa4bf;">Damage Score (parent cell)</span>
                      <strong style="color: ${bColor};">${damagePct}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
                      <span style="color: #8fa4bf;">Classification</span>
                      <strong style="color: ${bColor};">${props.classification || "N/A"}</strong>
                    </div>
                  </div>
                  <div style="font-size: 0.7rem; color: #8fa4bf; text-align: center; margin-top: 4px;">
                    Colour sourced from containing 200m risk cell
                  </div>
                </div>`
              );
            }}
          />
        )}

        {/* 3. Forecast Trajectory Polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{ color: "#75c9f1", weight: 3.5, dashArray: "6, 8" }}
          />
        )}

        {/* 4. Storm Movement Direction Vector Line */}
        <Polyline
          positions={[[center.lat, center.lng], headingVectorEnd]}
          pathOptions={{ color: "#ff6b5b", weight: 4, opacity: 0.9 }}
        />

        {/* 5. Forecast Trajectory Waypoints */}
        {(trajectory || []).map((t, idx) => (
          <CircleMarker
            key={`traj-${idx}`}
            center={[t.lat, t.lng]}
            radius={7}
            pathOptions={{
              fillColor: idx === 0 ? "#d4483b" : "#ed8a28",
              color: "#ffffff",
              weight: 2,
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <strong>{t.label}</strong>
              <br />
              Lat: {t.lat.toFixed(2)}°N, Lon: {t.lng.toFixed(2)}°E
            </Popup>
          </CircleMarker>
        ))}

        {/* 6. Storm Eye Dominant Marker (On Top) */}
        <CircleMarker
          center={[center.lat, center.lng]}
          radius={24}
          pathOptions={{
            fillColor: "#d4483b",
            color: "#ff8c7a",
            weight: 2.5,
            fillOpacity: 0.25,
          }}
        />
        <CircleMarker
          center={[center.lat, center.lng]}
          radius={12}
          pathOptions={{
            fillColor: "#d4483b",
            color: "#ffffff",
            weight: 3,
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <strong>Storm Eye Center</strong>
            <br />
            Position: {center.lat}°N, {center.lng}°E
            <br />
            Movement Heading: {headingDeg}° ({speedKph} km/h)
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
