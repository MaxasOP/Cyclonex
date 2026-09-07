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

function getExposureColor(density?: number): string {
  if (density === undefined || density === null || density === 0) return "#75c9f1"; // Open Land
  if (density >= 0.5) return "#d4483b";
  if (density >= 0.2) return "#ed8a28";
  if (density >= 0.05) return "#35a66f";
  return "#75c9f1";
}

function getObstacleColor(level?: string): string {
  if (level === "HIGH") return "#8b0000";
  if (level === "MODERATE") return "#ed8a28";
  return "#35a66f";
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
                fillColor = getExposureColor(props.building_density);
              } else if (analysisMode === "OBSTACLES") {
                fillColor = getObstacleColor(props.obstruction_level);
              } else {
                fillColor = getDamageColor(props.damage_score, props.colour);
              }

              const isOcean = props.land_type === "OCEAN";
              return {
                fillColor,
                fillOpacity: isOcean ? 0.35 : 0.72,
                color: isOcean ? "#ffffff" : "#ffffff",
                weight: isOcean ? 0.15 : 0.35,
              };
            }}
            onEachFeature={(feature, layer) => {
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

              const props = feature.properties || {};
              const score = props.damage_score ?? props.risk_score ?? 0;
              layer.bindPopup(
                `<div>
                  <strong>200m Cell Damage Inspection</strong><br/>
                  <span>Damage Score: <strong>${score}</strong> (${props.classification || "N/A"})</span><br/>
                  <span>Local Wind: ${props.wind_kph || 0} km/h (${props.wind_ms || 0} m/s)</span><br/>
                  <span>Wind Loading: ${props.effective_wind_loading_n_m2 || 0} N/m²</span><br/>
                  <span>Land Type: ${props.land_type || "N/A"}</span><br/>
                  <span>Primary Driver: <strong>${props.primary_driver || "N/A"}</strong></span><br/>
                  <em style="font-size:0.75rem; color:#8fa4bf;">Click cell for detailed explainable inspection card</em>
                </div>`
              );
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
              layer.bindPopup(
                `<div>
                  <strong>Building Footprint Inspection</strong><br/>
                  <span>Height: ${props.height_m ? props.height_m + " m" : "Unknown / Inferred"}</span><br/>
                  <span>Locally Taller / Exposed: ${props.is_locally_taller ? "Yes (High Vulnerability)" : "No"}</span>
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
