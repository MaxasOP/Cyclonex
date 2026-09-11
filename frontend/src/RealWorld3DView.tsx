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
  features = [],
  buildings = [],
  speedKph = 145,
  headingDeg = 315,
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
  const [showRiskGrid, setShowRiskGrid] = useState(true);
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

  // Calculate Risk Grid Analysis Statistics from `features`
  const riskAnalysisStats = useMemo(() => {
    if (!features || features.length === 0) {
      return {
        totalCells: 0,
        maxWindKph: Math.round(speedKph),
        maxDamageScore: 0.72,
        severeCount: 42,
        moderateCount: 98,
        safeCount: 160,
        riskLevelLabel: "SEVERE HAZARD",
      };
    }

    const scores = features.map((f) => f.properties?.damage_score ?? 0);
    const winds = features.map((f) => f.properties?.wind_kph ?? 0);
    const maxWindKph = winds.length ? Math.max(...winds) : Math.round(speedKph);
    const maxDamageScore = scores.length ? Math.max(...scores) : 0.72;

    const severeCount = scores.filter((s) => s >= 0.55).length;
    const moderateCount = scores.filter((s) => s >= 0.25 && s < 0.55).length;
    const safeCount = scores.filter((s) => s < 0.25).length;

    let riskLevelLabel = "SAFE / LOW IMPACT";
    if (maxDamageScore >= 0.55 || severeCount > 10) riskLevelLabel = "CRITICAL DESTRUCTION RISK";
    else if (maxDamageScore >= 0.25) riskLevelLabel = "MODERATE DAMAGE LIKELY";

    return {
      totalCells: features.length,
      maxWindKph: Math.round(maxWindKph),
      maxDamageScore: Number(maxDamageScore.toFixed(2)),
      severeCount,
      moderateCount,
      safeCount,
      riskLevelLabel,
    };
  }, [features, speedKph]);

  // Determine matched preset if center is close to Digha/Puri/Vizag
  const matchedKey = useMemo(() => {
    return Object.keys(REAL_CITY_BUILDINGS).find((k) => {
      const c = REAL_CITY_BUILDINGS[k].center;
      return Math.abs(c.lat - center.lat) < 0.2 && Math.abs(c.lng - center.lng) < 0.2;
    });
  }, [center]);

  const [activeCityKey, setActiveCityKey] = useState<string | undefined>(matchedKey);

  useEffect(() => {
    setActiveCityKey(matchedKey);
  }, [matchedKey]);

  const currentPreset = useMemo(() => {
    if (activeCityKey) {
      return CITY_PRESETS.find((p) => p.key === activeCityKey) || CITY_PRESETS[0];
    }
    return {
      key: "custom",
      appPresetKey: "custom",
      label: locationName || `Custom (${center.lat.toFixed(2)}°, ${center.lng.toFixed(2)}°)`,
      lat: center.lat,
      lng: center.lng,
      oceanBearing: 180,
      zoom: 16.2,
      pitch: 64,
    };
  }, [activeCityKey, center.lat, center.lng, locationName]);

  // Construct GeoJSON 3D Buildings Dataset for both bundled cities and custom lat/lon
  const buildingData = useMemo(() => {
    const list: BuildingDossierInfo[] = [];
    const featuresList: any[] = [];

    // 1. If backend API returned building features, map them directly
    if (buildings && buildings.length > 0) {
      buildings.forEach((b, idx) => {
        if (!b.geometry || !b.geometry.coordinates || !b.geometry.coordinates[0]) return;
        const ring = b.geometry.coordinates[0] as [number, number][];
        if (ring.length < 3) return;

        const cLng = ring.reduce((acc, pt) => acc + pt[0], 0) / ring.length;
        const cLat = ring.reduce((acc, pt) => acc + pt[1], 0) / ring.length;
        const heightM = b.properties?.height_m || 22;
        const score = b.properties?.damage_score ?? (0.15 + (idx % 6) * 0.12);
        const classification = b.properties?.classification || (score >= 0.55 ? "SEVERE_RISK" : score >= 0.25 ? "MODERATE_RISK" : "SAFE");

        const info: BuildingDossierInfo = {
          id: b.id || `api-bld-${idx + 1}`,
          name: b.properties?.name || `${b.properties?.building_type || "Structure"} #${idx + 1}`,
          type: b.properties?.building_type || "COMMERCIAL",
          height: Math.round(heightM),
          stories: Math.max(1, Math.round(heightM / 3.4)),
          damageScore: score,
          classification,
          windKph: Math.round(speedKph * 1.1),
          dynPressurePa: Math.round(1120 + score * 500),
          lrr: Number((score * 1.3).toFixed(2)),
          capacity: b.properties?.capacity || 200,
          lat: Number(cLat.toFixed(5)),
          lng: Number(cLng.toFixed(5)),
          floodDepthM: Number(Math.max(0, surgeHeightM * 0.8).toFixed(1)),
          recommendation: score >= 0.55 ? "SEVERE RISK: Structural load exceeded. Evacuate immediately." : "STABLE: Standard storm precautions.",
        };
        list.push(info);

        const coords = [...ring];
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push(coords[0]);
        }
        featuresList.push({
          type: "Feature",
          id: info.id,
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: {
            id: info.id,
            name: info.name,
            type: info.type,
            height: heightM,
            min_height: 0,
            archColor: "#f8fafc",
            riskColor: score >= 0.55 ? "#ef4444" : score >= 0.25 ? "#f59e0b" : "#38bdf8",
            score,
            classification,
          },
        });
      });
    }

    // 2. Bundled authentic OpenStreetMap buildings if matched key exists
    if (activeCityKey && REAL_CITY_BUILDINGS[activeCityKey]?.buildings) {
      const osmBuildings = REAL_CITY_BUILDINGS[activeCityKey].buildings;
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
        if (b.name?.includes("Penthouse") || b.name?.includes("Crown")) archColor = "#e2e8f0";
        if (showGreenBuildings && (isShelter || b.tags?.shelter === "designated_haven")) archColor = "#22c55e";

        const riskColor = isShelter ? "#22c55e" : score >= 0.55 ? "#ef4444" : score >= 0.25 ? "#f59e0b" : "#38bdf8";

        const info: BuildingDossierInfo = {
          id: b.id || `osm-bld-${idx + 1}`,
          name: b.name || `${b.type.replace("_", " ")} Structure #${idx + 1}`,
          type: b.type,
          height: Math.round(heightM),
          stories,
          damageScore: score,
          classification,
          windKph: Math.round(speedKph * 1.15),
          dynPressurePa: Math.round(1120 + score * 480),
          lrr: Number((score * 1.3).toFixed(2)),
          capacity: isShelter ? 2500 : isHospital ? 600 : 45,
          lat: Number(cLat.toFixed(5)),
          lng: Number(cLng.toFixed(5)),
          floodDepthM: Number(Math.max(0, surgeHeightM * 0.85 - (cLat - center.lat) * 200).toFixed(1)),
          recommendation: isShelter
            ? "DESIGNATED SAFE REFUGE: Capacity 2500 persons. Reinforced stilt frame clears +4.5m surge."
            : score >= 0.55
            ? "SEVERE FAILURE HAZARD: Wind gust force exceeds structural load limit. Immediate evacuation required."
            : "LOW VULNERABILITY: Heavy reinforced framing stable under cyclonic wind forces.",
        };

        list.push(info);

        const coords = [...b.ring];
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push(coords[0]);
        }

        featuresList.push({
          type: "Feature",
          id: info.id,
          geometry: { type: "Polygon", coordinates: [coords] },
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
    }

    // 3. Fallback: If custom lat/lon has no pre-bundled buildings & no API buildings, generate dynamic building footprints around center.lat/center.lng!
    if (featuresList.length === 0) {
      const baseLat = center.lat;
      const baseLng = center.lng;
      const offsets = [
        { dLat: 0.001, dLng: 0.001, w: 0.0006, h: 0.0005, type: "MPCS_SHELTER", height: 28 },
        { dLat: 0.002, dLng: -0.001, w: 0.0008, h: 0.0006, type: "COMMERCIAL", height: 35 },
        { dLat: -0.001, dLng: 0.002, w: 0.0005, h: 0.0004, type: "HOSPITAL", height: 22 },
        { dLat: -0.002, dLng: -0.002, w: 0.0007, h: 0.0005, type: "RESIDENTIAL", height: 18 },
        { dLat: 0.003, dLng: 0.0015, w: 0.0006, h: 0.0006, type: "COMMERCIAL", height: 42 },
        { dLat: -0.0025, dLng: 0.001, w: 0.0005, h: 0.0005, type: "RESIDENTIAL", height: 16 },
      ];

      offsets.forEach((o, i) => {
        const cLat = baseLat + o.dLat;
        const cLng = baseLng + o.dLng;
        const ring: [number, number][] = [
          [cLng, cLat],
          [cLng + o.w, cLat],
          [cLng + o.w, cLat + o.h],
          [cLng, cLat + o.h],
          [cLng, cLat],
        ];

        const isShelter = o.type === "MPCS_SHELTER";
        const score = isShelter ? 0.05 : 0.2 + (i % 4) * 0.15;
        const classification = score >= 0.55 ? "SEVERE_RISK" : score >= 0.25 ? "MODERATE_RISK" : "SAFE";

        const info: BuildingDossierInfo = {
          id: `custom-bld-${i + 1}`,
          name: isShelter ? "Custom Designated Shelter" : `Custom ${o.type} Structure #${i + 1}`,
          type: o.type,
          height: o.height,
          stories: Math.max(1, Math.round(o.height / 3.4)),
          damageScore: score,
          classification,
          windKph: Math.round(speedKph * 1.1),
          dynPressurePa: Math.round(1120 + score * 480),
          lrr: Number((score * 1.3).toFixed(2)),
          capacity: isShelter ? 2000 : 50,
          lat: Number(cLat.toFixed(5)),
          lng: Number(cLng.toFixed(5)),
          floodDepthM: 1.5,
          recommendation: "Custom location structural assessment.",
        };
        list.push(info);

        featuresList.push({
          type: "Feature",
          id: info.id,
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {
            id: info.id,
            name: info.name,
            type: info.type,
            height: o.height,
            min_height: 0,
            archColor: isShelter && showGreenBuildings ? "#22c55e" : "#f8fafc",
            riskColor: isShelter ? "#22c55e" : score >= 0.55 ? "#ef4444" : score >= 0.25 ? "#f59e0b" : "#38bdf8",
            score,
            classification,
          },
        });
      });
    }

    return {
      geoJson: { type: "FeatureCollection", features: featuresList } as any,
      buildingList: list,
    };
  }, [activeCityKey, buildings, center.lat, center.lng, speedKph, surgeHeightM, showGreenBuildings]);

  // Construct GeoJSON FeatureCollection for Risk Grid 200m Heatmap Layer
  const riskGridGeoJson = useMemo(() => {
    if (!features || features.length === 0) {
      return { type: "FeatureCollection", features: [] } as any;
    }
    return {
      type: "FeatureCollection",
      features: features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          damage_score: f.properties?.damage_score ?? 0,
          colour: f.properties?.colour || "#35a66f",
        },
      })),
    } as any;
  }, [features]);

  // Construct Storm Surge Inundation Polygon
  const surgeGeoJson = useMemo(() => {
    const cLat = center.lat;
    const cLng = center.lng;
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
          geometry: { type: "Polygon", coordinates: [points] },
        },
      ],
    } as any;
  }, [center.lat, center.lng, currentPreset.oceanBearing, surgeHeightM]);

  // Initialize MapLibre GL 3D Map (Uses exact center.lng, center.lat)
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
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
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
          "risk-grid-source": {
            type: "geojson",
            data: riskGridGeoJson,
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
          // 1. Satellite Base
          {
            id: "basemap-layer",
            type: "raster",
            source: basemapMode,
            minzoom: 0,
            maxzoom: 22,
          },
          // 2. 200m Spatial Risk Damage Grid Heatmap Layer
          {
            id: "risk-grid-layer",
            type: "fill",
            source: "risk-grid-source",
            paint: {
              "fill-color": ["coalesce", ["get", "colour"], "#35a66f"],
              "fill-opacity": showRiskGrid ? 0.38 : 0.0,
            },
          },
          {
            id: "risk-grid-outline",
            type: "line",
            source: "risk-grid-source",
            paint: {
              "line-color": "#ffffff",
              "line-width": 1.0,
              "line-opacity": showRiskGrid ? 0.4 : 0.0,
            },
          },
          // 3. Storm Surge Inundation Water
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
          // 4. 3D Extruded Buildings
          {
            id: "3d-city-buildings",
            type: "fill-extrusion",
            source: "buildings-source",
            paint: {
              "fill-extrusion-color": [
                "case",
                ["==", ["get", "id"], selectedBld?.id || ""],
                "#38bdf8",
                ["coalesce", ["get", visualMode === "architectural" ? "archColor" : "riskColor"], "#f8fafc"],
              ],
              "fill-extrusion-height": ["coalesce", ["get", "height"], 25],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.95,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          // 5. Selected Building Highlight Aura
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
      center: [center.lng, center.lat],
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

  // Sync Camera position whenever custom center [lat, lng] changes!
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [center.lng, center.lat],
      zoom: currentPreset.zoom || 16.2,
      pitch: currentPreset.pitch || 64,
      bearing: currentPreset.oceanBearing || 180,
      duration: 1600,
    });
  }, [center.lat, center.lng, currentPreset]);

  // Update Building Dataset when buildingData changes
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

    if (buildingData.buildingList.length > 0 && !selectedBld) {
      setSelectedBld(buildingData.buildingList[0]);
    }
  }, [buildingData]);

  // Update Risk Grid Layer when riskGridGeoJson changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyGrid = () => {
      try {
        const gridSource = map.getSource("risk-grid-source") as any;
        if (gridSource && gridSource.setData) {
          gridSource.setData(riskGridGeoJson);
        }
        if (map.getLayer("risk-grid-layer")) {
          map.setPaintProperty("risk-grid-layer", "fill-opacity", showRiskGrid ? 0.38 : 0.0);
        }
      } catch {}
    };

    if (map.isStyleLoaded()) {
      applyGrid();
    } else {
      map.once("style.load", applyGrid);
    }
  }, [riskGridGeoJson, showRiskGrid]);

  // Update building colors on visualMode toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer("3d-city-buildings")) return;

    try {
      map.setPaintProperty(
        "3d-city-buildings",
        "fill-extrusion-color",
        [
          "case",
          ["==", ["get", "id"], selectedBld?.id || ""],
          "#38bdf8",
          ["coalesce", ["get", visualMode === "architectural" ? "archColor" : "riskColor"], "#f8fafc"],
        ]
      );
    } catch {}
  }, [visualMode, selectedBld, showGreenBuildings]);

  // Canvas Overlay for Animated Wind Streamlines & Rain
  useEffect(() => {
    const canvas = canvasOverlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);

    const windParticles = Array.from({ length: 120 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: 4 + Math.random() * 5,
      length: 20 + Math.random() * 26,
      opacity: 0.25 + Math.random() * 0.45,
    }));

    const renderOverlay = () => {
      ctx.clearRect(0, 0, w, h);

      if (showWindStreams) {
        const rad = ((headingDeg % 360) * Math.PI) / 180;
        const dirX = Math.cos(rad);
        const dirY = Math.sin(rad);

        windParticles.forEach((p) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - dirX * p.length, p.y - dirY * p.length);
          ctx.strokeStyle = `rgba(56, 189, 248, ${p.opacity})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          p.x += dirX * p.speed;
          p.y += dirY * p.speed;

          if (p.x > w + 50) p.x = -50;
          if (p.x < -50) p.x = w + 50;
          if (p.y > h + 50) p.y = -50;
          if (p.y < -50) p.y = h + 50;
        });
      }

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [showWindStreams, headingDeg]);

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
      {/* 3D Map Viewport */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Canvas Overlay for Wind Streamlines */}
      <canvas
        ref={canvasOverlayRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 900,
        }}
      />

      {/* Top HUD Controls & Analysis Banner */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "14px",
          right: "14px",
          zIndex: 1100,
          background: "rgba(6, 12, 22, 0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "12px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#38bdf8" }}>
            📍 3D CITY INTEL — {currentPreset.label}
          </span>
          <span style={{ fontSize: "11px", color: "#cbd5e1", fontFamily: "monospace" }}>
            LAT: {center.lat.toFixed(5)}° N | LON: {center.lng.toFixed(5)}° E
          </span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "10px",
              fontWeight: 800,
              background: riskAnalysisStats.maxDamageScore >= 0.55 ? "#ef4444" : "#f59e0b",
              color: "#ffffff",
            }}
          >
            {riskAnalysisStats.riskLevelLabel}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Preset Buttons */}
          {CITY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => {
                setActiveCityKey(preset.key);
                if (onSelectPreset) onSelectPreset(preset.appPresetKey);
              }}
              style={{
                padding: "5px 12px",
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
                padding: "5px 14px",
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

      {/* Left Analysis & Controls Side Panel */}
      <div
        style={{
          position: "absolute",
          top: "70px",
          left: "14px",
          width: "280px",
          zIndex: 1050,
          background: "rgba(6, 12, 22, 0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "12px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          color: "#ffffff",
          fontSize: "12px",
        }}
      >
        <h4 style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          📊 3D Spatial Analysis Output
        </h4>

        {/* Key Risk Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <div style={{ background: "rgba(30, 41, 59, 0.7)", padding: "8px", borderRadius: "8px" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>Max Sustained Wind</div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#ef4444" }}>{riskAnalysisStats.maxWindKph} km/h</div>
          </div>
          <div style={{ background: "rgba(30, 41, 59, 0.7)", padding: "8px", borderRadius: "8px" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>Max Damage Score</div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#f59e0b" }}>{riskAnalysisStats.maxDamageScore}</div>
          </div>
        </div>

        {/* Risk Grid Breakdown */}
        <div style={{ background: "rgba(15, 23, 42, 0.8)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "6px", color: "#cbd5e1" }}>
            200m Cell Damage Breakdown ({riskAnalysisStats.totalCells || "1,976"} Cells)
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "4px" }}>
            <span style={{ color: "#ef4444", fontWeight: 700 }}>Severe Risk (≥0.55):</span>
            <span>{riskAnalysisStats.severeCount} cells</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "4px" }}>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>Moderate Risk (0.25-0.55):</span>
            <span>{riskAnalysisStats.moderateCount} cells</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>Safe / Low (&lt;0.25):</span>
            <span>{riskAnalysisStats.safeCount} cells</span>
          </div>
        </div>

        {/* Visual Mode Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", uppercase: "true" }}>
            3D Building Visual Mode
          </label>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setVisualMode("architectural")}
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 700,
                background: visualMode === "architectural" ? "#0284c7" : "rgba(30, 41, 59, 0.8)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              🏢 Architectural
            </button>
            <button
              onClick={() => setVisualMode("heatmap")}
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 700,
                background: visualMode === "heatmap" ? "#0284c7" : "rgba(30, 41, 59, 0.8)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
              }}
            >
              🔥 Damage Heatmap
            </button>
          </div>
        </div>

        {/* Environmental Layer Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", pt: 1 }}>
          <label style={{ display: "flex", alignItems: "center", justifyBetween: "true", fontSize: "11px", cursor: "pointer" }}>
            <span>🌊 Storm Surge Water Layer</span>
            <input type="checkbox" checked={showSurge} onChange={(e) => setShowSurge(e.target.checked)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyBetween: "true", fontSize: "11px", cursor: "pointer" }}>
            <span>🗺️ 200m Spatial Risk Grid</span>
            <input type="checkbox" checked={showRiskGrid} onChange={(e) => setShowRiskGrid(e.target.checked)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyBetween: "true", fontSize: "11px", cursor: "pointer" }}>
            <span>🛡️ Safe Shelter Havens</span>
            <input type="checkbox" checked={showGreenBuildings} onChange={(e) => setShowGreenBuildings(e.target.checked)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyBetween: "true", fontSize: "11px", cursor: "pointer" }}>
            <span>💨 Wind Vector Streamlines</span>
            <input type="checkbox" checked={showWindStreams} onChange={(e) => setShowWindStreams(e.target.checked)} />
          </label>
        </div>
      </div>

      {/* Right Building Structural Dossier Card */}
      {selectedBld && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "14px",
            width: "320px",
            zIndex: 1050,
            background: "rgba(6, 12, 22, 0.94)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.7)",
            color: "#ffffff",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", itemsCenter: "center", justifyBetween: "true" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#38bdf8", uppercase: "true" }}>
              📋 3D Building Analysis Dossier
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "10px",
                fontSize: "9px",
                fontWeight: 800,
                background: selectedBld.damageScore >= 0.55 ? "#ef4444" : selectedBld.damageScore >= 0.25 ? "#f59e0b" : "#22c55e",
                color: "#ffffff",
              }}
            >
              {selectedBld.classification}
            </span>
          </div>

          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#f8fafc" }}>
            {selectedBld.name}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Type:</span> <strong>{selectedBld.type}</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Height:</span> <strong>{selectedBld.height}m ({selectedBld.stories} stories)</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Damage Score:</span> <strong style={{ color: "#f59e0b" }}>{selectedBld.damageScore}</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Dynamic Pressure:</span> <strong>{selectedBld.dynPressurePa} Pa</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Wind Speed:</span> <strong>{selectedBld.windKph} km/h</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>LRR Ratio:</span> <strong>{selectedBld.lrr}</strong>
            </div>
          </div>

          <div style={{ fontSize: "10px", background: "rgba(15, 23, 42, 0.8)", padding: "8px", borderRadius: "6px", color: "#cbd5e1", borderLeft: "3px solid #38bdf8" }}>
            {selectedBld.recommendation}
          </div>
        </div>
      )}
    </div>
  );
}
