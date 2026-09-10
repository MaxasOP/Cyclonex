import React, { useEffect, useRef, useState, useMemo } from "react";
import { Map as MapLibreMap, NavigationControl, Marker, config } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Configure MapLibre web worker to use the local static worker asset
config.WORKER_URL = "/maplibre-gl-worker.mjs";
import { REAL_CITY_BUILDINGS } from "./data/realCityBuildings";
import type { BuildingFeature, RiskFeature } from "./api";

interface RealWorld3DProps {
  center: { lat: number; lng: number };
  locationName?: string;
  features: RiskFeature[];
  buildings: BuildingFeature[];
  sheltersPlan?: any;
  speedKph?: number;
  headingDeg?: number;
  onExitReal3D?: () => void;
  onSelectPreset?: (presetKey: string) => void;
}

export interface BuildingDossierInfo {
  id: string;
  name: string;
  type: string;
  height: number;
  stories: number;
  damageScore: number;
  classification: string;
  windKph: number;
  dynPressurePa: number;
  lrr: number;
  capacity: number;
  lat: number;
  lng: number;
  floodDepthM: number;
  recommendation: string;
}

const CITY_PRESETS = [
  { key: "digha", appPresetKey: "landfall_amphan", label: "Digha, WB", lat: 21.6235, lng: 87.5220, oceanBearing: 195, zoom: 16.3, pitch: 64 },
  { key: "puri", appPresetKey: "landfall_fani", label: "Puri, Odisha", lat: 19.8035, lng: 85.8280, oceanBearing: 165, zoom: 16.3, pitch: 64 },
  { key: "vizag", appPresetKey: "landfall_hudhud", label: "Vizag, AP", lat: 17.7050, lng: 83.3080, oceanBearing: 118, zoom: 16.2, pitch: 66 },
];

export default function RealWorld3DView({
  center,
  locationName,
  buildings,
  speedKph = 145,
  headingDeg = 210,
  onExitReal3D,
  onSelectPreset,
}: RealWorld3DProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  // UI & Simulation State
  const [selectedBld, setSelectedBld] = useState<BuildingDossierInfo | null>(null);
  const [cameraMode, setCameraMode] = useState<"birdseye" | "drone" | "surge" | "orbit">("birdseye");
  const [basemapMode, setBasemapMode] = useState<"esri" | "osm" | "carto_dark">("esri");
  const [visualMode, setVisualMode] = useState<"architectural" | "heatmap">("architectural");
  const [showGreenBuildings, setShowGreenBuildings] = useState(true);
  const [showRoadCorridors, setShowRoadCorridors] = useState(false);
  const [showSurge, setShowSurge] = useState(true);
  const [surgeHeightM, setSurgeHeightM] = useState(2.8);
  const [showWindStreams, setShowWindStreams] = useState(true);
  const [showRain, setShowRain] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState(false);

  // Live Telemetry
  const [telemetry, setTelemetry] = useState({
    latStr: center.lat.toFixed(5) + "°N",
    lngStr: center.lng.toFixed(5) + "°E",
    elevM: 14,
    eyeAltM: 420,
    headingDeg: 180,
    tiltDeg: 60,
  });

  // Determine current matched preset from center
  const matchedKey = useMemo(() => {
    return Object.keys(REAL_CITY_BUILDINGS).find((k) => {
      const c = REAL_CITY_BUILDINGS[k].center;
      return Math.abs(c.lat - center.lat) < 0.35 && Math.abs(c.lng - center.lng) < 0.35;
    }) || "vizag";
  }, [center]);

  const [activeCityKey, setActiveCityKey] = useState<string>(matchedKey);

  useEffect(() => {
    if (matchedKey) {
      setActiveCityKey(matchedKey);
    }
  }, [matchedKey]);

  const currentPreset = useMemo(() => {
    return CITY_PRESETS.find((p) => p.key === activeCityKey) || CITY_PRESETS[2];
  }, [activeCityKey]);

  // Construct GeoJSON 3D Buildings Dataset
  const buildingData = useMemo(() => {
    const list: BuildingDossierInfo[] = [];
    const features: any[] = [];

    const osmBuildings = REAL_CITY_BUILDINGS[activeCityKey]?.buildings || [];

    osmBuildings.forEach((b, idx) => {
      if (!b.ring || b.ring.length < 3) return;

      const cLng = b.ring.reduce((acc, pt) => acc + pt[0], 0) / b.ring.length;
      const cLat = b.ring.reduce((acc, pt) => acc + pt[1], 0) / b.ring.length;

      const heightM = b.height_m || 24;
      const minHeightM = b.min_height_m || 0;
      const stories = Math.max(1, Math.round(heightM / 3.4));

      const isShelter = b.type === "MPCS_SHELTER" || b.id?.includes("shelter") || b.name?.includes("Shelter") || b.name?.includes("Haven");
      const isHospital = b.type === "HOSPITAL" || b.name?.includes("Hospital") || b.name?.includes("Clinic");

      const score = isShelter ? 0.05 : isHospital ? 0.15 : b.type === "COMMERCIAL" ? 0.38 : (0.22 + (idx % 7) * 0.09);
      const classification = score >= 0.55 ? "SEVERE_RISK" : score >= 0.25 ? "MODERATE_RISK" : "SAFE";

      let archColor = "#f8fafc";
      if (b.name?.includes("Penthouse") || b.name?.includes("Crown")) {
        archColor = "#e2e8f0";
      } else if (b.name?.includes("Rotunda")) {
        archColor = "#ffffff";
      }

      if (showGreenBuildings && (isShelter || b.tags?.shelter === "designated_haven")) {
        archColor = "#22c55e";
      }

      const riskColor = isShelter ? "#22c55e" : score >= 0.55 ? "#ef4444" : score >= 0.25 ? "#f59e0b" : "#38bdf8";

      const info: BuildingDossierInfo = {
        id: b.id || `osm-bld-${idx + 1}`,
        name: b.name || `${b.type.replace("_", " ")} Structure #${idx + 1}`,
        type: b.type,
        height: Math.round(heightM),
        stories,
        damageScore: score,
        classification,
        windKph: Math.round(speedKph * 3.8 + 25),
        dynPressurePa: Math.round(1120 + score * 480),
        lrr: Number((score * 1.3).toFixed(2)),
        capacity: isShelter ? 2500 : isHospital ? 600 : b.type === "COMMERCIAL" ? 450 : 35,
        lat: Number(cLat.toFixed(5)),
        lng: Number(cLng.toFixed(5)),
        floodDepthM: Number(Math.max(0, surgeHeightM * 0.85 - (cLat - currentPreset.lat) * 200).toFixed(1)),
        recommendation: isShelter
          ? "DESIGNATED SAFE REFUGE: Capacity 2500 persons. Elevated stilts clear +4.5m storm surge."
          : score >= 0.55
          ? "SEVERE FAILURE HAZARD: Wind gust force exceeds structural load limit. Immediate evacuation required."
          : score >= 0.25
          ? "MODERATE RISK: Coastal gale precautions required. Stand by for directives."
          : "LOW VULNERABILITY: Heavy reinforced framing stable under cyclonic wind forces.",
      };

      list.push(info);

      const coords = [...b.ring];
      if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
      }

      features.push({
        type: "Feature",
        id: info.id,
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
        properties: {
          id: info.id,
          name: info.name,
          type: info.type,
          height: heightM,
          min_height: minHeightM,
          archColor,
          riskColor,
          isShelter,
          score,
          classification,
        },
      });
    });

    return {
      geoJson: { type: "FeatureCollection", features } as any,
      buildingList: list,
    };
  }, [activeCityKey, speedKph, surgeHeightM, currentPreset.lat, showGreenBuildings]);

  const roadCorridorsGeoJson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: [],
    } as any;
  }, []);

  const surgeGeoJson = useMemo(() => {
    const cLat = currentPreset.lat;
    const cLng = currentPreset.lng;
    const oceanRad = (currentPreset.oceanBearing * Math.PI) / 180;
    const inlandDist = 0.0035 + (surgeHeightM / 5.0) * 0.0075;

    const coastTangentX = -Math.sin(oceanRad);
    const coastTangentY = Math.cos(oceanRad);
    const inlandX = -Math.cos(oceanRad);
    const inlandY = -Math.sin(oceanRad);

    const span = 0.045;
    const points: [number, number][] = [];

    points.push([cLng - coastTangentX * span - inlandX * 0.03, cLat - coastTangentY * span - inlandY * 0.03]);
    points.push([cLng + coastTangentX * span - inlandX * 0.03, cLat + coastTangentY * span - inlandY * 0.03]);

    const steps = 36;
    for (let s = steps; s >= 0; s--) {
      const t = (s / steps - 0.5) * 2;
      const waveInland = inlandDist * (0.8 + Math.sin(t * 8) * 0.25 + Math.cos(t * 14) * 0.15);
      const px = cLng + coastTangentX * span * t + inlandX * waveInland;
      const py = cLat + coastTangentY * span * t + inlandY * waveInland;
      points.push([px, py]);
    }
    points.push(points[0]);

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { depth: surgeHeightM },
          geometry: {
            type: "Polygon",
            coordinates: [points],
          },
        },
      ],
    } as any;
  }, [currentPreset, surgeHeightM]);

  // Initialize MapLibre GL 3D Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: {
        version: 8,
        light: {
          anchor: "viewport",
          color: "#ffffff",
          intensity: 0.88,
          position: [1.6, 215, 38],
        },
        sources: {
          esri: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: "Esri World Satellite Imagery",
          },
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
          carto_dark: {
            type: "raster",
            tiles: ["https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© CARTO",
          },
          "road-corridors-source": {
            type: "geojson",
            data: roadCorridorsGeoJson,
          },
          "surge-flood-source": {
            type: "geojson",
            data: surgeGeoJson,
          },
          "buildings-source": {
            type: "geojson",
            data: buildingData.geoJson,
            promoteId: "id",
          },
        },
        layers: [
          {
            id: "basemap-layer",
            type: "raster",
            source: basemapMode,
            minzoom: 0,
            maxzoom: 22,
          },
          {
            id: "surge-flood-water",
            type: "fill",
            source: "surge-flood-source",
            paint: {
              "fill-color": "#0284c7",
              "fill-opacity": showSurge ? 0.65 : 0.0,
            },
          },
          {
            id: "surge-flood-shore-edge",
            type: "line",
            source: "surge-flood-source",
            paint: {
              "line-color": "#bae6fd",
              "line-width": 3.5,
              "line-opacity": showSurge ? 0.85 : 0.0,
            },
          },
          {
            id: "3d-city-buildings",
            type: "fill-extrusion",
            source: "buildings-source",
            paint: {
              "fill-extrusion-color": [
                "case",
                ["==", ["get", "id"], ""],
                "#38bdf8",
                ["coalesce", ["get", visualMode === "architectural" ? "archColor" : "riskColor"], "#f8fafc"],
              ],
              "fill-extrusion-height": ["coalesce", ["get", "height"], 25],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.95,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          {
            id: "selected-building-highlight",
            type: "fill-extrusion",
            source: "buildings-source",
            filter: ["==", "id", ""],
            paint: {
              "fill-extrusion-color": "#38bdf8",
              "fill-extrusion-height": ["+", ["coalesce", ["get", "height"], 25], 3.0],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.98,
            },
          },
        ],
      },
      center: [currentPreset.lng, currentPreset.lat],
      zoom: currentPreset.zoom,
      pitch: currentPreset.pitch,
      bearing: currentPreset.oceanBearing,
      maxPitch: 85,
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");

    map.on("click", "3d-city-buildings", (e) => {
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const bId = feat.properties?.id;
      const bldInfo = buildingData.buildingList.find((b) => b.id === bId);
      if (bldInfo) {
        setSelectedBld(bldInfo);
      }
    });

    map.on("move", () => {
      const c = map.getCenter();
      setTelemetry((prev) => ({
        ...prev,
        latStr: c.lat.toFixed(5) + "°N",
        lngStr: c.lng.toFixed(5) + "°E",
        headingDeg: Math.round(map.getBearing()),
        tiltDeg: Math.round(map.getPitch()),
        eyeAltM: Math.round(400 + (19 - map.getZoom()) * 180),
      }));
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyData = () => {
      try {
        const bldSource = map.getSource("buildings-source") as any;
        if (bldSource && bldSource.setData) {
          bldSource.setData(buildingData.geoJson);
        }
      } catch {}
    };

    if (map.isStyleLoaded()) {
      applyData();
    } else {
      map.once("style.load", applyData);
    }
  }, [buildingData]);

  const applyCameraMode = (mode: "birdseye" | "drone" | "surge" | "orbit") => {
    setCameraMode(mode);
    setIsOrbiting(false);
    const map = mapRef.current;
    if (!map) return;

    if (mode === "birdseye") {
      map.easeTo({ pitch: 64, zoom: 16.3, bearing: currentPreset.oceanBearing, duration: 1800 });
    } else if (mode === "drone") {
      map.easeTo({ pitch: 76, zoom: 17.8, bearing: currentPreset.oceanBearing - 20, duration: 2000 });
    } else if (mode === "surge") {
      map.easeTo({ pitch: 66, zoom: 16.0, bearing: currentPreset.oceanBearing, duration: 2000 });
    } else if (mode === "orbit") {
      setIsOrbiting(true);
    }
  };

  return (
    <div
      className="real-world-3d-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#030712",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Top HUD Controls Bar */}
      <div
        className="real3d-top-bar"
        style={{
          position: "absolute",
          top: "12px",
          left: "14px",
          right: "14px",
          zIndex: 1100,
          background: "rgba(6, 12, 22, 0.90)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "10px",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#38bdf8" }}>
            📍 {currentPreset.label} — 3D Digital Twin
          </span>
          <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>
            {telemetry.latStr} {telemetry.lngStr}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {CITY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => {
                setActiveCityKey(preset.key);
                if (onSelectPreset) onSelectPreset(preset.appPresetKey);
                if (mapRef.current) {
                  mapRef.current.flyTo({ center: [preset.lng, preset.lat], zoom: preset.zoom, pitch: preset.pitch, bearing: preset.oceanBearing });
                }
              }}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                background: activeCityKey === preset.key ? "#0284c7" : "rgba(30, 41, 59, 0.8)",
                color: "#ffffff",
                border: "1px solid " + (activeCityKey === preset.key ? "#38bdf8" : "rgba(255,255,255,0.1)"),
                cursor: "pointer",
              }}
            >
              {preset.label}
            </button>
          ))}
          {onExitReal3D && (
            <button
              onClick={onExitReal3D}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              ✕ Exit 3D View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
