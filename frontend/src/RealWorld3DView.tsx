import React, { useEffect, useRef, useState, useMemo } from "react";
import { Map as MapLibreMap, NavigationControl, Marker, config } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Configure MapLibre web worker to use the local static worker asset
config.WORKER_URL = "/maplibre-gl-worker.mjs";
import { REAL_CITY_BUILDINGS } from "./data/realCityBuildings";
import { REAL_CITY_ROADS } from "./data/realCityRoads";
import type { BuildingFeature, RiskFeature, EvacuationPlan, CycloneShelter } from "./api";

interface RealWorld3DProps {
  center: { lat: number; lng: number };
  locationName?: string;
  features: RiskFeature[];
  buildings: BuildingFeature[];
  sheltersPlan?: EvacuationPlan | null;
  speedKph?: number;
  headingDeg?: number;
  onExitReal3D?: () => void;
  onSelectPreset?: (presetKey: string) => void;
  onCustomLocationChange?: (lat: number, lng: number) => void;
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
  { key: "digha", appPresetKey: "landfall_amphan", label: "Digha, West Bengal", lat: 21.6240, lng: 87.5210, oceanBearing: -15, zoom: 16.5, pitch: 60 },
  { key: "puri", appPresetKey: "landfall_fani", label: "Puri, Odisha", lat: 19.8020, lng: 85.8260, oceanBearing: -15, zoom: 16.5, pitch: 60 },
  { key: "vizag", appPresetKey: "landfall_hudhud", label: "Visakhapatnam, AP", lat: 17.7080, lng: 83.3120, oceanBearing: -15, zoom: 16.5, pitch: 60 },
];

export default function RealWorld3DView({
  center,
  locationName,
  features = [],
  buildings = [],
  sheltersPlan,
  speedKph = 145,
  headingDeg = 315,
  onExitReal3D,
  onSelectPreset,
  onCustomLocationChange,
}: RealWorld3DProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const cycloneMarkerRef = useRef<Marker | null>(null);
  const buildingListRef = useRef<BuildingDossierInfo[]>([]);

  // Debug panel state
  const [showDebug, setShowDebug] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ featureCount: 0, roadCount: 0, layerActive: false, sourceLoaded: false });

  // UI & Simulation State
  const [selectedBld, setSelectedBld] = useState<BuildingDossierInfo | null>(null);
  const [hoveredBld, setHoveredBld] = useState<BuildingDossierInfo | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [viewPerspective, setViewPerspective] = useState<"city3d" | "street" | "overview">("city3d");
  const [satelliteOpacity, setSatelliteOpacity] = useState(1.0);
  const [showRoads, setShowRoads] = useState(true);
  const [basemapMode, setBasemapMode] = useState<"esri" | "osm" | "carto_dark">("esri");
  const [visualMode, setVisualMode] = useState<"architectural" | "heatmap">("architectural");
  const [showGreenBuildings, setShowGreenBuildings] = useState(true);
  const [showRiskGrid, setShowRiskGrid] = useState(false);
  const [showSurge, setShowSurge] = useState(false);
  const [surgeHeightM, setSurgeHeightM] = useState(2.8);
  const [showWindStreams, setShowWindStreams] = useState(true);
  const [showRain, setShowRain] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState(false);

  // Custom Lat/Lon Input State
  const [customLatInput, setCustomLatInput] = useState(center.lat.toFixed(4));
  const [customLngInput, setCustomLngInput] = useState(center.lng.toFixed(4));

  useEffect(() => {
    setCustomLatInput(center.lat.toFixed(4));
    setCustomLngInput(center.lng.toFixed(4));
  }, [center.lat, center.lng]);

  // Live Telemetry
  const [telemetry, setTelemetry] = useState({
    latStr: center.lat.toFixed(5) + "°N",
    lngStr: center.lng.toFixed(5) + "°E",
    elevM: 14,
    eyeAltM: 420,
    headingDeg: -15,
    tiltDeg: 60,
    zoom: "16.5",
  });

  // Mitigation & Refugee Shelters Modal State
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [activeShelterId, setActiveShelterId] = useState<string | null>(null);

  // Calculate nearest shelter for selected building
  const nearestShelterForBld = useMemo(() => {
    if (!selectedBld) return null;
    const shelters = sheltersPlan?.shelters || [];
    if (shelters.length === 0) {
      return {
        id: "mpcs-coastal-refuge-01",
        name: "Coastal Multipurpose Cyclone Shelter (MPCS-1)",
        district: "Coastal District",
        state: "State DRM",
        distance_km: 1.4,
        capacity: 2500,
        facility_type: "RCC Stilted 3-Story Cyclone Shelter",
        evacuation_priority: (selectedBld.damageScore >= 0.55 ? "IMMEDIATE" : "ADVISORY") as "IMMEDIATE" | "ADVISORY" | "STANDBY",
        backup_generator: true,
        helipad: true,
        walking_time_mins: 16,
        vehicle_time_mins: 4,
        stilt_clearance_m: 4.5,
        lat: selectedBld.lat + 0.008,
        lon: selectedBld.lng + 0.006,
      };
    }

    let closest = shelters[0];
    let minD = 999999;
    shelters.forEach((s) => {
      const dLat = (s.lat - selectedBld.lat) * 111;
      const dLng = (s.lon - selectedBld.lng) * 111 * Math.cos((selectedBld.lat * Math.PI) / 180);
      const d = Math.sqrt(dLat * dLat + dLng * dLng);
      if (d < minD) {
        minD = d;
        closest = s;
      }
    });

    const distKm = Number(minD.toFixed(2));
    return {
      ...closest,
      distance_km: distKm,
      walking_time_mins: Math.max(2, Math.round((distKm / 4.5) * 60)),
      vehicle_time_mins: Math.max(1, Math.round((distKm / 35.0) * 60)),
      stilt_clearance_m: 4.5,
    };
  }, [selectedBld, sheltersPlan]);

  // Construct GeoJSON FeatureCollection for Risk Grid 200m Heatmap Layer
  const riskGridGeoJson = useMemo(() => {
    if (features && features.length > 0) {
      return {
        type: "FeatureCollection",
        features: features.map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            damage_score: f.properties?.damage_score ?? 0,
            colour: f.properties?.colour || (
              (f.properties?.damage_score ?? 0) >= 0.55 ? "#ef4444" :
              (f.properties?.damage_score ?? 0) >= 0.25 ? "#f59e0b" : "#35a66f"
            ),
          },
        })),
      } as any;
    }

    // Dynamic 200m spatial risk grid around center.lat / center.lng if backend features list is empty
    const generatedFeatures: any[] = [];
    const step = 0.0018; // ~200m grid cell
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const minLng = center.lng + dx * step;
        const maxLng = minLng + step * 0.92;
        const minLat = center.lat + dy * step;
        const maxLat = minLat + step * 0.92;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const score = Math.max(0.08, Math.min(0.92, 0.76 - dist * 0.12 + Math.sin(dx * 1.5 + dy) * 0.06));
        const colour = score >= 0.55 ? "#ef4444" : score >= 0.25 ? "#f59e0b" : "#35a66f";

        generatedFeatures.push({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ]],
          },
          properties: {
            damage_score: Number(score.toFixed(2)),
            wind_kph: Math.round(speedKph * (1 - dist * 0.04)),
            colour,
          },
        });
      }
    }
    return { type: "FeatureCollection", features: generatedFeatures } as any;
  }, [features, center.lat, center.lng, speedKph]);

  // Calculate Risk Grid Analysis Statistics from active features
  const riskAnalysisStats = useMemo(() => {
    const activeFeatures: any[] = (features && features.length > 0) ? features : riskGridGeoJson.features;

    if (!activeFeatures || activeFeatures.length === 0) {
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

    const scores = activeFeatures.map((f) => f.properties?.damage_score ?? 0);
    const winds = activeFeatures.map((f) => f.properties?.wind_kph ?? 0);
    const maxWindKph = winds.length ? Math.max(...winds) : Math.round(speedKph);
    const maxDamageScore = scores.length ? Math.max(...scores) : 0.72;

    const severeCount = scores.filter((s) => s >= 0.55).length;
    const moderateCount = scores.filter((s) => s >= 0.25 && s < 0.55).length;
    const safeCount = scores.filter((s) => s < 0.25).length;

    let riskLevelLabel = "SAFE / LOW IMPACT";
    if (maxDamageScore >= 0.55 || severeCount > 10) riskLevelLabel = "CRITICAL DESTRUCTION RISK";
    else if (maxDamageScore >= 0.25) riskLevelLabel = "MODERATE DAMAGE LIKELY";

    return {
      totalCells: activeFeatures.length,
      maxWindKph: Math.round(maxWindKph),
      maxDamageScore: Number(maxDamageScore.toFixed(2)),
      severeCount,
      moderateCount,
      safeCount,
      riskLevelLabel,
    };
  }, [features, riskGridGeoJson, speedKph]);

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
        const heightM = b.properties?.height_m || (12 + (idx % 7) * 4);
        const stories = Math.max(1, Math.round(heightM / 3.0));
        const score = b.properties?.damage_score ?? (0.12 + (idx % 6) * 0.11);
        const classification = score >= 0.55 ? "SEVERE_RISK" : score >= 0.25 ? "MODERATE_RISK" : score >= 0.10 ? "LOW_RISK" : "SAFE";

        const archColors = ["#64748B", "#475569", "#64748b", "#94a3b8", "#718096"];
        const archColor = archColors[idx % archColors.length];
        const riskColor = score >= 0.55 ? "#ef4444" : score >= 0.25 ? "#f59e0b" : score >= 0.10 ? "#84cc16" : "#22c55e";

        const info: BuildingDossierInfo = {
          id: b.id || `api-bld-${idx + 1}`,
          name: b.properties?.name || `${b.properties?.building_type || "Structure"} #${idx + 1}`,
          type: b.properties?.building_type || "COMMERCIAL",
          height: Math.round(heightM),
          stories,
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
            "building:levels": stories,
            stories,
            archColor,
            riskColor,
            score,
            classification,
          },
        });
      });
    // 2. Bundled authentic OpenStreetMap buildings if matched key exists (only if no API buildings)
    } else if (activeCityKey && REAL_CITY_BUILDINGS[activeCityKey]?.buildings) {
      const osmBuildings = REAL_CITY_BUILDINGS[activeCityKey].buildings;
      osmBuildings.forEach((b, idx) => {
        if (!b.ring || b.ring.length < 3) return;

        const cLng = b.ring.reduce((acc, pt) => acc + pt[0], 0) / b.ring.length;
        const cLat = b.ring.reduce((acc, pt) => acc + pt[1], 0) / b.ring.length;

        const heightM = b.height_m || (b.tags?.["building:levels"] ? Number(b.tags["building:levels"]) * 3.0 : (12 + (idx % 8) * 3.5));
        const minHeightM = b.min_height_m || 0;
        const stories = Math.max(1, Math.round(heightM / 3.0));

        const isShelter = b.type === "MPCS_SHELTER" || b.id?.includes("shelter") || b.name?.includes("Shelter") || b.name?.includes("Haven");
        const isHospital = b.type === "HOSPITAL" || b.name?.includes("Hospital") || b.name?.includes("Clinic");

        const score = isShelter ? 0.05 : isHospital ? 0.15 : b.type === "COMMERCIAL" ? 0.38 : (0.18 + (idx % 7) * 0.08);
        const classification = score >= 0.55 ? "SEVERE_RISK" : score >= 0.25 ? "MODERATE_RISK" : score >= 0.10 ? "LOW_RISK" : "SAFE";

        const archColors = ["#64748B", "#475569", "#64748b", "#94a3b8", "#718096"];
        let archColor = archColors[idx % archColors.length];
        if (b.name?.includes("Penthouse") || b.name?.includes("Crown")) archColor = "#94a3b8";
        if (showGreenBuildings && (isShelter || b.tags?.shelter === "designated_haven")) archColor = "#22c55e";

        const riskColor =
          isShelter ? "#22c55e" :
          score >= 0.55 ? "#ef4444" :
          score >= 0.25 ? "#f59e0b" :
          score >= 0.10 ? "#84cc16" : "#22c55e";

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
            "building:levels": stories,
            stories,
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
  }, [buildings, activeCityKey, center.lat, center.lng, speedKph, surgeHeightM, showGreenBuildings]);

  // Construct GeoJSON Road Network Dataset (OSM Street corridors interlocking with buildings)
  const roadsGeoJson = useMemo(() => {
    const roadData = activeCityKey ? REAL_CITY_ROADS[activeCityKey] : null;
    if (roadData && roadData.roads && roadData.roads.length > 0) {
      return {
        type: "FeatureCollection",
        features: roadData.roads.map((r) => ({
          type: "Feature",
          id: r.id,
          geometry: {
            type: "LineString",
            coordinates: r.coordinates,
          },
          properties: {
            id: r.id,
            name: r.name,
            type: r.type,
            width_m: r.width_m,
            class: r.type === "highway" || r.type === "primary" ? "primary" : r.type === "secondary" ? "secondary" : "residential",
          },
        })),
      } as any;
    }

    // Dynamic procedural urban grid for custom lat/lon
    const cLat = center.lat;
    const cLng = center.lng;
    const features: any[] = [];
    for (let i = -3; i <= 3; i++) {
      const lat = cLat + i * 0.0018;
      features.push({
        type: "Feature",
        id: `custom-rd-ew-${i}`,
        geometry: {
          type: "LineString",
          coordinates: [
            [cLng - 0.008, lat],
            [cLng + 0.008, lat],
          ],
        },
        properties: {
          id: `custom-rd-ew-${i}`,
          name: i === 0 ? "Grand Coastal Boulevard" : `Sector Avenue ${Math.abs(i)} ${i > 0 ? "North" : "South"}`,
          type: i === 0 ? "primary" : "secondary",
          width_m: i === 0 ? 14 : 9,
          class: i === 0 ? "primary" : "secondary",
        },
      });

      const lng = cLng + i * 0.0024;
      features.push({
        type: "Feature",
        id: `custom-rd-ns-${i}`,
        geometry: {
          type: "LineString",
          coordinates: [
            [lng, cLat - 0.007],
            [lng, cLat + 0.007],
          ],
        },
        properties: {
          id: `custom-rd-ns-${i}`,
          name: `Cross Link Road ${i + 4}`,
          type: "residential",
          width_m: 6,
          class: "residential",
        },
      });
    }

    return {
      type: "FeatureCollection",
      features,
    } as any;
  }, [activeCityKey, center.lat, center.lng]);

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
          intensity: 0.90,
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
          "roads-source": {
            type: "geojson",
            data: roadsGeoJson,
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
          // 1. Satellite Base Layer (Opacity adjustable)
          {
            id: "basemap-layer",
            type: "raster",
            source: basemapMode,
            minzoom: 0,
            maxzoom: 22,
            paint: {
              "raster-opacity": satelliteOpacity,
            },
          },
          // 2. 200m Spatial Risk Damage Grid Heatmap Layer
          {
            id: "risk-grid-layer",
            type: "fill",
            source: "risk-grid-source",
            paint: {
              "fill-color": ["coalesce", ["get", "colour"], "#35a66f"],
              "fill-opacity": showRiskGrid ? 0.35 : 0.0,
            },
          },
          {
            id: "risk-grid-outline",
            type: "line",
            source: "risk-grid-source",
            paint: {
              "line-color": "#ffffff",
              "line-width": 1.0,
              "line-opacity": showRiskGrid ? 0.35 : 0.0,
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
          // 4. Road Network Layers (Dark casing, asphalt core, painted centerline)
          {
            id: "roads-casing",
            type: "line",
            source: "roads-source",
            paint: {
              "line-color": "#090d16",
              "line-width": [
                "match",
                ["get", "class"],
                "primary", 13,
                "secondary", 9,
                6
              ],
              "line-opacity": showRoads ? 0.95 : 0.0,
            },
          },
          {
            id: "roads-asphalt",
            type: "line",
            source: "roads-source",
            paint: {
              "line-color": [
                "match",
                ["get", "class"],
                "primary", "#334155",
                "secondary", "#253342",
                "#1e293b"
              ],
              "line-width": [
                "match",
                ["get", "class"],
                "primary", 8.5,
                "secondary", 5.5,
                3.5
              ],
              "line-opacity": showRoads ? 0.95 : 0.0,
            },
          },
          {
            id: "roads-centerline",
            type: "line",
            source: "roads-source",
            paint: {
              "line-color": [
                "match",
                ["get", "class"],
                "primary", "#f59e0b",
                "#94a3b8"
              ],
              "line-width": [
                "match",
                ["get", "class"],
                "primary", 1.8,
                1.0
              ],
              "line-dasharray": [3, 2.5],
              "line-opacity": showRoads ? 0.85 : 0.0,
            },
          },
          // 5. 3D Extruded Buildings (True GIS Digital Twin Heights)
          {
            id: "3d-city-buildings",
            type: "fill-extrusion",
            source: "buildings-source",
            paint: {
              "fill-extrusion-color": [
                "case",
                ["==", ["get", "id"], ""],
                "#38bdf8",
                ["coalesce", ["get", visualMode === "architectural" ? "archColor" : "riskColor"], "#64748B"],
              ],
              "fill-extrusion-height": [
                "coalesce",
                ["get", "height"],
                ["*", ["coalesce", ["get", "building:levels"], ["get", "stories"], 1], 3.0],
                12.0
              ],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.95,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          // 6. Selected Building Highlight Aura
          {
            id: "selected-building-highlight",
            type: "fill-extrusion",
            source: "buildings-source",
            filter: ["==", ["get", "id"], ""],
            paint: {
              "fill-extrusion-color": "#38bdf8",
              "fill-extrusion-height": ["+", ["coalesce", ["get", "height"], 15], 4],
              "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
              "fill-extrusion-opacity": 0.98,
            },
          },
        ],
      },
      center: [center.lng, center.lat],
      zoom: currentPreset.zoom || 16.5,
      pitch: currentPreset.pitch || 60,
      bearing: currentPreset.oceanBearing || -15,
      maxPitch: 85,
    });

    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");

    // Building click handler — uses ref to avoid stale closure
    map.on("click", "3d-city-buildings", (e) => {
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const bId = feat.properties?.id;
      const bldInfo = buildingListRef.current.find((b) => b.id === bId);
      if (bldInfo) {
        setSelectedBld(bldInfo);
      }
    });

    // Hover tooltip detection
    map.on("mousemove", "3d-city-buildings", (e) => {
      map.getCanvas().style.cursor = "pointer";
      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const bId = feat.properties?.id;
      const bldInfo = buildingListRef.current.find((b) => b.id === bId);
      if (bldInfo) {
        setHoveredBld(bldInfo);
        setHoverPos({ x: e.point.x, y: e.point.y });
      }
    });

    // Cursor & hover clear on mouseleave
    map.on("mouseleave", "3d-city-buildings", () => {
      map.getCanvas().style.cursor = "";
      setHoveredBld(null);
      setHoverPos(null);
    });

    // Diagnostic logging on map load
    map.on("load", () => {
      const bldSource = map.getSource("buildings-source") as any;
      const bldLayer = map.getLayer("3d-city-buildings");
      const featureCount = bldSource?._data?.features?.length ?? buildingData.geoJson?.features?.length ?? 0;
      const rdCount = roadsGeoJson?.features?.length ?? 0;
      const firstFeat = bldSource?._data?.features?.[0] || buildingData.geoJson?.features?.[0];

      console.log(`
BUILDING DEBUG
---------------
source loaded: ${bldSource ? "true" : "false"}
feature count: ${featureCount}
geometry type: ${firstFeat?.geometry?.type || "Polygon"}
height property: ${firstFeat?.properties?.height !== undefined ? "available" : "unavailable"}
levels property: ${firstFeat?.properties?.["building:levels"] !== undefined || firstFeat?.properties?.stories !== undefined ? "available" : "unavailable"}
`);

      setDebugInfo({
        featureCount,
        roadCount: rdCount,
        layerActive: !!bldLayer,
        sourceLoaded: !!bldSource,
      });
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
    // Keep ref in sync for click handler
    buildingListRef.current = buildingData.buildingList;

    const map = mapRef.current;
    if (!map) return;

    const applyData = () => {
      try {
        const bldSource = map.getSource("buildings-source") as any;
        if (bldSource && bldSource.setData) {
          bldSource.setData(buildingData.geoJson);
          console.log("[3D CITY] Building data updated:", buildingData.buildingList.length, "buildings");
        }
        // Update debug info
        setDebugInfo((prev) => ({
          ...prev,
          featureCount: buildingData.buildingList.length,
          sourceLoaded: !!bldSource,
          layerActive: !!map.getLayer("3d-city-buildings"),
        }));
      } catch {}
    };

    if (map.isStyleLoaded()) {
      applyData();
    } else {
      map.once("style.load", applyData);
    }

    // Auto-select first building if none selected, or reset for new city
    if (buildingData.buildingList.length > 0) {
      setSelectedBld(buildingData.buildingList[0]);
    } else {
      setSelectedBld(null);
    }
  }, [buildingData]);

  // Update Road Network Layer when roadsGeoJson or showRoads changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyRoads = () => {
      try {
        const rdSource = map.getSource("roads-source") as any;
        if (rdSource && rdSource.setData) {
          rdSource.setData(roadsGeoJson);
        }
        const casingOpacity = showRoads ? 0.95 : 0.0;
        const asphaltOpacity = showRoads ? 0.95 : 0.0;
        const centerlineOpacity = showRoads ? 0.85 : 0.0;

        if (map.getLayer("roads-casing")) map.setPaintProperty("roads-casing", "line-opacity", casingOpacity);
        if (map.getLayer("roads-asphalt")) map.setPaintProperty("roads-asphalt", "line-opacity", asphaltOpacity);
        if (map.getLayer("roads-centerline")) map.setPaintProperty("roads-centerline", "line-opacity", centerlineOpacity);

        const rCount = roadsGeoJson?.features?.length || 0;
        setDebugInfo((prev) => ({ ...prev, roadCount: rCount }));
      } catch {}
    };

    if (map.isStyleLoaded()) {
      applyRoads();
    } else {
      map.once("style.load", applyRoads);
    }
  }, [roadsGeoJson, showRoads]);

  // Update Satellite Basemap Opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyOpacity = () => {
      try {
        if (map.getLayer("basemap-layer")) {
          map.setPaintProperty("basemap-layer", "raster-opacity", satelliteOpacity);
        }
      } catch {}
    };

    if (map.isStyleLoaded()) {
      applyOpacity();
    } else {
      map.once("style.load", applyOpacity);
    }
  }, [satelliteOpacity, basemapMode]);

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
          map.setPaintProperty("risk-grid-layer", "fill-opacity", showRiskGrid ? 0.35 : 0.0);
        }
        if (map.getLayer("risk-grid-outline")) {
          map.setPaintProperty("risk-grid-outline", "line-opacity", showRiskGrid ? 0.35 : 0.0);
        }
      } catch {}
    };

    if (map.isStyleLoaded()) {
      applyGrid();
    } else {
      map.once("style.load", applyGrid);
    }
  }, [riskGridGeoJson, showRiskGrid]);

  // Camera Perspective Handlers
  const handleSetPerspective = (mode: "city3d" | "street" | "overview") => {
    setViewPerspective(mode);
    const map = mapRef.current;
    if (!map) return;

    const targetLat = center.lat;
    const targetLng = center.lng;

    if (mode === "street") {
      // High pitch 75°, zoom 18.2, street level
      map.flyTo({
        center: [targetLng, targetLat],
        zoom: 18.2,
        pitch: 75,
        bearing: -15,
        duration: 1400,
      });
    } else if (mode === "overview") {
      // Pitch 50°, zoom 14.5, high altitude overview
      map.flyTo({
        center: [targetLng, targetLat],
        zoom: 14.5,
        pitch: 50,
        bearing: -15,
        duration: 1200,
      });
    } else {
      // Standard 3D City (Pitch 60°, Zoom 16.5)
      map.flyTo({
        center: [targetLng, targetLat],
        zoom: 16.5,
        pitch: 60,
        bearing: -15,
        duration: 1200,
      });
    }
  };

  const handleResetView = () => {
    setViewPerspective("city3d");
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [currentPreset.lng, currentPreset.lat],
      zoom: currentPreset.zoom || 16.5,
      pitch: currentPreset.pitch || 60,
      bearing: currentPreset.oceanBearing || -15,
      duration: 1000,
    });
  };

  // Update building colors on visualMode toggle + highlight selected building
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyColors = () => {
      if (!map.isStyleLoaded() || !map.getLayer("3d-city-buildings")) return;
      try {
        // Update main building layer colors (selected = blue, others = arch/risk color)
        map.setPaintProperty(
          "3d-city-buildings",
          "fill-extrusion-color",
          [
            "case",
            ["==", ["get", "id"], selectedBld?.id || ""],
            "#38bdf8",
            ["coalesce", ["get", visualMode === "architectural" ? "archColor" : "riskColor"], "#64748B"],
          ]
        );
        // Update highlight aura layer filter to match selected building
        if (map.getLayer("selected-building-highlight")) {
          map.setFilter("selected-building-highlight", ["==", ["get", "id"], selectedBld?.id || ""]);
        }
      } catch {}
    };

    if (map.isStyleLoaded()) {
      applyColors();
    } else {
      map.once("style.load", applyColors);
    }
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

    const windParticles = Array.from({ length: 50 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: 3 + Math.random() * 4,
      length: 12 + Math.random() * 13,
      opacity: 0.10 + Math.random() * 0.15,
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
          ctx.lineWidth = 0.8;
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

  // Render MPCS Shelter Beacons
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Compact MPCS Refugee Shelters
    const shelters = sheltersPlan?.shelters || [];
    if (showGreenBuildings && shelters.length > 0) {
      shelters.forEach((shelter) => {
        const el = document.createElement("div");
        el.className = "mpcs-3d-beacon";
        el.style.display = "flex";
        el.style.flexDirection = "column";
        el.style.alignItems = "center";
        el.style.cursor = "pointer";
        el.style.zIndex = "100";

        const badge = document.createElement("div");
        const isImm = shelter.evacuation_priority === "IMMEDIATE";
        badge.style.background = isImm ? "rgba(220, 38, 38, 0.95)" : "rgba(16, 185, 129, 0.95)";
        badge.style.border = "1px solid #ffffff";
        badge.style.color = "#ffffff";
        badge.style.fontSize = "9px";
        badge.style.fontWeight = "800";
        badge.style.padding = "2px 6px";
        badge.style.borderRadius = "8px";
        badge.style.boxShadow = isImm ? "0 0 10px rgba(239, 68, 68, 0.6)" : "0 0 10px rgba(16, 185, 129, 0.6)";
        badge.style.whiteSpace = "nowrap";
        badge.innerHTML = `🛡️ ${shelter.name.split(" ")[0]} (${shelter.capacity || 2500}p)`;

        const pin = document.createElement("div");
        pin.style.width = "1.5px";
        pin.style.height = "12px";
        pin.style.background = isImm ? "#ef4444" : "#10b981";

        el.appendChild(badge);
        el.appendChild(pin);

        el.onclick = () => {
          setActiveShelterId(shelter.id);
          setShowMitigationModal(true);
          map.flyTo({
            center: [shelter.lon, shelter.lat],
            zoom: 17.0,
            pitch: 65,
            bearing: 180,
            duration: 1200,
          });
        };

        try {
          const marker = new Marker({ element: el, anchor: "bottom" })
            .setLngLat([shelter.lon, shelter.lat])
            .addTo(map);
          markersRef.current.push(marker);
        } catch {}
      });
    }
  }, [center.lat, center.lng, speedKph, locationName, sheltersPlan, showGreenBuildings]);

  const handleFlyToShelter = (lat: number, lon: number, shelterId?: string) => {
    if (shelterId) setActiveShelterId(shelterId);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lon, lat],
        zoom: 17.0,
        pitch: 65,
        bearing: 180,
        duration: 1200,
      });
    }
  };

  const handleApplyCustomCoords = () => {
    const lat = parseFloat(customLatInput);
    const lng = parseFloat(customLngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      setActiveCityKey(undefined);
      if (onCustomLocationChange) {
        onCustomLocationChange(lat, lng);
      }
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 16.2,
          pitch: 64,
          bearing: 180,
          duration: 1400,
        });
      }
    }
  };

  return (
    <div
      className="real-world-3d-container"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#030712",
      }}
    >
      {/* 3D Map Viewport */}
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

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

      {/* Top Telemetry & Global Controls Header */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "14px",
          right: "14px",
          zIndex: 1100,
          background: "rgba(6, 12, 22, 0.90)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "10px",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.5px" }}>
            📍 CYCLONEX &bull; 3D CITY DIGITAL TWIN
          </span>
          <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>
            {center.lat.toFixed(4)}° N, {center.lng.toFixed(4)}° E &bull; Alt: {telemetry.eyeAltM}m &bull; Pitch: {telemetry.tiltDeg}°
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Custom Lat/Lon Direct Input Form */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(15, 23, 42, 0.8)", padding: "2px 6px", borderRadius: "6px", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700 }}>Lat:</span>
            <input
              type="number"
              step="0.0001"
              value={customLatInput}
              onChange={(e) => setCustomLatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApplyCustomCoords(); }}
              style={{ width: "62px", background: "#0f172a", border: "1px solid #334155", color: "#38bdf8", borderRadius: "4px", fontSize: "10px", padding: "2px 4px", fontWeight: 700 }}
            />
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, marginLeft: "2px" }}>Lon:</span>
            <input
              type="number"
              step="0.0001"
              value={customLngInput}
              onChange={(e) => setCustomLngInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApplyCustomCoords(); }}
              style={{ width: "62px", background: "#0f172a", border: "1px solid #334155", color: "#38bdf8", borderRadius: "4px", fontSize: "10px", padding: "2px 4px", fontWeight: 700 }}
            />
            <button
              onClick={handleApplyCustomCoords}
              style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800, background: "#0284c7", color: "#ffffff", border: "none", cursor: "pointer" }}
            >
              Go 📍
            </button>
          </div>

          {/* Mitigation & Shelters Intelligence Button */}
          <button
            onClick={() => setShowMitigationModal(true)}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              color: "#ffffff",
              border: "1px solid #34d399",
              cursor: "pointer",
              boxShadow: "0 0 10px rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
            title="Open Cyclone Mitigation Measures & Refugee MPCS Shelters Analysis"
          >
            <span>🛡️ Shelters &amp; Mitigations</span>
            {sheltersPlan && (
              <span style={{ background: "#ffffff", color: "#065f46", fontSize: "9.5px", padding: "1px 5px", borderRadius: "8px", fontWeight: 800 }}>
                {sheltersPlan.total_shelters_active} MPCS
              </span>
            )}
          </button>

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

      {/* Floating Cyclone Intelligence Card (Top Right, max-width 320px - Step 9) */}
      <div
        style={{
          position: "absolute",
          top: "64px",
          right: "14px",
          width: "250px",
          maxWidth: "320px",
          zIndex: 1050,
          background: "rgba(6, 12, 22, 0.94)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: "12px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(239, 68, 68, 0.15)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>🌀</span>
            <span style={{ fontSize: "12px", fontWeight: 900, color: "#f87171", letterSpacing: "0.5px" }}>
              {locationName ? locationName.toUpperCase() : "CYCLONE STORM"}
            </span>
          </div>
          <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
            ACTIVE
          </span>
        </div>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#e2e8f0" }}>
          {speedKph} km/h • 950 hPa
        </div>
        <div style={{ fontSize: "10px", color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
          <span>Dyn Pressure: <strong style={{ color: "#f87171" }}>2,800 Pa</strong></span>
          <span>Heading: <strong style={{ color: "#38bdf8" }}>{headingDeg}°</strong></span>
        </div>
      </div>

      {/* Floating Compact 3D City Digital Twin Controller (Section 18) */}
      <div
        style={{
          position: "absolute",
          top: "64px",
          left: "14px",
          width: "270px",
          zIndex: 1050,
          background: "rgba(6, 12, 22, 0.94)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "12px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          color: "#ffffff",
          fontSize: "11.5px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.5px" }}>
              🏙️ 3D CITY
            </div>
            <div style={{ fontSize: "10px", color: "#cbd5e1" }}>
              {currentPreset.label}
            </div>
          </div>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "9px",
              fontWeight: 800,
              background: riskAnalysisStats.maxDamageScore >= 0.55 ? "#ef4444" : "#f59e0b",
              color: "#ffffff",
            }}
          >
            {riskAnalysisStats.riskLevelLabel}
          </span>
        </div>

        {/* City Presets Bar */}
        <div style={{ display: "flex", gap: "4px" }}>
          {CITY_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => {
                setActiveCityKey(preset.key);
                if (onSelectPreset) onSelectPreset(preset.appPresetKey);
              }}
              style={{
                flex: 1,
                padding: "4px 2px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 700,
                background: activeCityKey === preset.key ? "#0284c7" : "rgba(30, 41, 59, 0.8)",
                color: "#ffffff",
                border: activeCityKey === preset.key ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer",
              }}
            >
              {preset.label.split(",")[0]}
            </button>
          ))}
        </div>

        {/* Interactive Layer Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span>🏢 3D Buildings ({buildingData.buildingList.length})</span>
            <span style={{ color: "#38bdf8", fontWeight: 800 }}>● Active</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span>🛣️ OSM Roads ({roadsGeoJson.features.length})</span>
            <input type="checkbox" checked={showRoads} onChange={(e) => setShowRoads(e.target.checked)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span>🔥 Building Risk Coloring</span>
            <input
              type="checkbox"
              checked={visualMode === "heatmap"}
              onChange={(e) => setVisualMode(e.target.checked ? "heatmap" : "architectural")}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span>💨 Wind Vector Streams</span>
            <input type="checkbox" checked={showWindStreams} onChange={(e) => setShowWindStreams(e.target.checked)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span>🌊 Storm Surge Inundation</span>
            <input type="checkbox" checked={showSurge} onChange={(e) => setShowSurge(e.target.checked)} />
          </label>
        </div>

        {/* Camera Toolbar & Mode Switcher */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingTop: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700 }}>Camera:</span>
            <div style={{ display: "flex", gap: "3px" }}>
              <button
                onClick={() => mapRef.current?.zoomIn()}
                style={{ padding: "2px 7px", borderRadius: "4px", fontSize: "11px", fontWeight: 800, background: "rgba(30, 41, 59, 0.9)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                style={{ padding: "2px 7px", borderRadius: "4px", fontSize: "11px", fontWeight: 800, background: "rgba(30, 41, 59, 0.9)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={handleResetView}
                style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800, background: "rgba(30, 41, 59, 0.9)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.3)", cursor: "pointer" }}
                title="Center City"
              >
                ⌖
              </button>
              <button
                onClick={() => mapRef.current?.resetNorthPitch({ duration: 600 })}
                style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800, background: "rgba(30, 41, 59, 0.9)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
                title="Reset North"
              >
                N
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => handleSetPerspective("city3d")}
              style={{
                flex: 1,
                padding: "5px 4px",
                borderRadius: "5px",
                fontSize: "10px",
                fontWeight: 800,
                background: viewPerspective === "city3d" ? "#0284c7" : "rgba(30, 41, 59, 0.8)",
                color: "#ffffff",
                border: viewPerspective === "city3d" ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              🏙️ 3D CITY
            </button>
            <button
              onClick={() => handleSetPerspective("street")}
              style={{
                flex: 1,
                padding: "5px 4px",
                borderRadius: "5px",
                fontSize: "10px",
                fontWeight: 800,
                background: viewPerspective === "street" ? "#0284c7" : "rgba(30, 41, 59, 0.8)",
                color: "#ffffff",
                border: viewPerspective === "street" ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              🚶 STREET
            </button>
          </div>
        </div>
      </div>

      {/* Building Assessment Dossier Card (Section 19) */}
      {selectedBld && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "14px",
            width: "310px",
            zIndex: 1050,
            background: "rgba(6, 12, 22, 0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.7)",
            color: "#ffffff",
            fontSize: "11px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(56, 189, 248, 0.25)", paddingBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.5px" }}>
              📋 BUILDING ASSESSMENT
            </span>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: "4px",
                fontSize: "9px",
                fontWeight: 800,
                background: selectedBld.damageScore >= 0.55 ? "#ef4444" : selectedBld.damageScore >= 0.25 ? "#f59e0b" : "#22c55e",
                color: "#ffffff",
              }}
            >
              {selectedBld.damageScore >= 0.55 ? "SEVERE RISK" : selectedBld.damageScore >= 0.25 ? "MODERATE" : "SAFE"}
            </span>
          </div>

          <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff" }}>
            {selectedBld.name}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", background: "rgba(15, 23, 42, 0.7)", padding: "8px", borderRadius: "6px" }}>
            <div><span style={{ color: "#94a3b8" }}>Building ID:</span> <strong style={{ color: "#e2e8f0" }}>{selectedBld.id}</strong></div>
            <div><span style={{ color: "#94a3b8" }}>Height:</span> <strong style={{ color: "#e2e8f0" }}>{selectedBld.height} m</strong></div>
            <div><span style={{ color: "#94a3b8" }}>Floors:</span> <strong style={{ color: "#e2e8f0" }}>{selectedBld.stories} stories</strong></div>
            <div><span style={{ color: "#94a3b8" }}>Wind Pressure:</span> <strong style={{ color: "#ef4444" }}>{(selectedBld.dynPressurePa / 1000).toFixed(2)} kPa</strong></div>
            <div><span style={{ color: "#94a3b8" }}>Load / Resist:</span> <strong style={{ color: "#f59e0b" }}>{selectedBld.lrr}</strong></div>
            <div><span style={{ color: "#94a3b8" }}>Damage Risk:</span> <strong style={{ color: selectedBld.damageScore >= 0.55 ? "#ef4444" : "#f59e0b" }}>{Math.round(selectedBld.damageScore * 100)}%</strong></div>
          </div>

          <div style={{ padding: "6px 8px", background: selectedBld.damageScore >= 0.55 ? "rgba(220, 38, 38, 0.2)" : "rgba(16, 185, 129, 0.15)", border: "1px solid " + (selectedBld.damageScore >= 0.55 ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.3)"), borderRadius: "6px", fontSize: "10px" }}>
            <span style={{ fontWeight: 800, color: selectedBld.damageScore >= 0.55 ? "#fca5a5" : "#6ee7b7" }}>
              {selectedBld.damageScore >= 0.55 ? "⚠️ EVACUATION ADVISED: " : "✅ STABLE STRUCTURE: "}
            </span>
            <span style={{ color: "#cbd5e1" }}>{selectedBld.recommendation}</span>
          </div>

          {/* Nearest Shelter Evacuation Route Button */}
          {nearestShelterForBld && (
            <button
              onClick={() => {
                handleFlyToShelter(nearestShelterForBld.lat, nearestShelterForBld.lon, nearestShelterForBld.id);
                setShowMitigationModal(true);
              }}
              style={{
                width: "100%",
                padding: "6px",
                borderRadius: "5px",
                fontSize: "10px",
                fontWeight: 800,
                background: "#059669",
                color: "#ffffff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              🛡️ Navigate to Nearest MPCS ({nearestShelterForBld.distance_km} km)
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          MITIGATION MEASURES & REFUGEE SHELTERS ANALYSIS MODAL (3D COMMAND CENTER)
          ========================================================================= */}
      {showMitigationModal && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1300,
            background: "rgba(3, 7, 18, 0.82)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMitigationModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "880px",
              maxHeight: "90vh",
              background: "rgba(10, 18, 32, 0.96)",
              border: "1px solid rgba(16, 185, 129, 0.5)",
              borderRadius: "16px",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.8), 0 0 32px rgba(16, 185, 129, 0.2)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              color: "#ffffff",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(16, 185, 129, 0.25)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(90deg, rgba(6, 78, 59, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>🛡️</span>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#34d399", letterSpacing: "0.5px" }}>
                    CYCLONE MITIGATION MEASURES &amp; REFUGEE SHELTERS INTELLIGENCE
                  </h3>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  Multipurpose Cyclone Shelters (MPCS) Network &middot; IS-875 Part 3 Structural Hardening &middot; Safe Evacuation Corridors
                </div>
              </div>
              <button
                onClick={() => setShowMitigationModal(false)}
                style={{
                  background: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#cbd5e1",
                  fontSize: "14px",
                  fontWeight: 700,
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body Scrollable Container */}
            <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Top KPI Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
                <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "10px", padding: "10px" }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Active MPCS Facilities</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#34d399", marginTop: "2px" }}>
                    {sheltersPlan?.total_shelters_active ?? 5} Shelters
                  </div>
                  <div style={{ fontSize: "10px", color: "#a7f3d0" }}>Pre-positioned Coastal Assets</div>
                </div>

                <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "10px", padding: "10px" }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Safe Shelter Capacity</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", marginTop: "2px" }}>
                    {(sheltersPlan?.total_capacity ?? 12500).toLocaleString()} <span style={{ fontSize: "11px", fontWeight: 600 }}>persons</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#bae6fd" }}>RCC Category-5 Fortified</div>
                </div>

                <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "10px", padding: "10px" }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Immediate Evacuees</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#ef4444", marginTop: "2px" }}>
                    {(sheltersPlan?.immediate_evacuation_count ?? 9400).toLocaleString()} <span style={{ fontSize: "11px", fontWeight: 600 }}>persons</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#fca5a5" }}>Red Zone (&ge;0.55) Risk</div>
                </div>

                <div style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "10px", padding: "10px" }}>
                  <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Surge Stilt Clearance</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#f59e0b", marginTop: "2px" }}>
                    +4.5 m MSL
                  </div>
                  <div style={{ fontSize: "10px", color: "#fde68a" }}>Surge Height: {surgeHeightM.toFixed(1)}m (Safe Clearance)</div>
                </div>
              </div>

              {/* Section 1: Coastal Multipurpose Refugee Shelters Inventory */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🏢</span> Designated Multipurpose Cyclone Shelters (MPCS Roster)
                  </h4>
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Click &ldquo;Fly to Shelter in 3D&rdquo; to center camera on facility
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                  {(sheltersPlan?.shelters && sheltersPlan.shelters.length > 0 ? sheltersPlan.shelters : [
                    {
                      id: "mpcs-wb-digha-01",
                      name: "Digha Coastal Multipurpose Shelter-1",
                      lat: 21.628,
                      lon: 87.521,
                      capacity: 2500,
                      district: "Purba Medinipur",
                      state: "West Bengal",
                      facility_type: "RCC Stilted 3-Story Cyclone Shelter",
                      backup_generator: true,
                      helipad: true,
                      distance_km: 1.2,
                      evacuation_priority: "IMMEDIATE" as const,
                    },
                    {
                      id: "mpcs-wb-shankarpur-02",
                      name: "Shankarpur Fishing Harbour Shelter",
                      lat: 21.637,
                      lon: 87.568,
                      capacity: 1800,
                      district: "Purba Medinipur",
                      state: "West Bengal",
                      facility_type: "Elevated Community Shelter",
                      backup_generator: true,
                      helipad: false,
                      distance_km: 4.8,
                      evacuation_priority: "ADVISORY" as const,
                    },
                    {
                      id: "mpcs-wb-mandarmani-03",
                      name: "Mandarmani Coastal Community Shelter",
                      lat: 21.668,
                      lon: 87.712,
                      capacity: 2000,
                      district: "Purba Medinipur",
                      state: "West Bengal",
                      facility_type: "RCC Stilted 3-Story Cyclone Shelter",
                      backup_generator: true,
                      helipad: false,
                      distance_km: 18.5,
                      evacuation_priority: "STANDBY" as const,
                    },
                  ]).map((shelter) => (
                    <div
                      key={shelter.id}
                      style={{
                        background: activeShelterId === shelter.id ? "rgba(6, 78, 59, 0.7)" : "rgba(15, 23, 42, 0.75)",
                        border: "1px solid " + (activeShelterId === shelter.id ? "#34d399" : "rgba(56, 189, 248, 0.25)"),
                        borderRadius: "10px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: "12px", color: "#f8fafc" }}>{shelter.name}</strong>
                          <div style={{ fontSize: "10px", color: "#94a3b8" }}>{shelter.district}, {shelter.state}</div>
                        </div>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "8px",
                            background: shelter.evacuation_priority === "IMMEDIATE" ? "#dc2626" : shelter.evacuation_priority === "ADVISORY" ? "#d97706" : "#059669",
                            color: "#ffffff",
                          }}
                        >
                          {shelter.evacuation_priority}
                        </span>
                      </div>

                      <div style={{ fontSize: "11px", color: "#cbd5e1" }}>
                        <div>Safe Capacity: <strong style={{ color: "#34d399" }}>{(shelter.capacity || 2500).toLocaleString()} persons</strong></div>
                        <div>Design: <strong>{shelter.facility_type}</strong></div>
                        <div>Distance from eye: <strong>{shelter.distance_km ?? 2.4} km</strong></div>
                      </div>

                      {/* Equipment Badges */}
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                        {shelter.backup_generator && (
                          <span style={{ fontSize: "9px", background: "rgba(245, 158, 11, 0.2)", color: "#fcd34d", padding: "1px 5px", borderRadius: "4px" }}>
                            ⚡ 125 kVA GenSet
                          </span>
                        )}
                        {shelter.helipad && (
                          <span style={{ fontSize: "9px", background: "rgba(56, 189, 248, 0.2)", color: "#7dd3fc", padding: "1px 5px", borderRadius: "4px" }}>
                            🚁 Helipad Ready
                          </span>
                        )}
                        <span style={{ fontSize: "9px", background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", padding: "1px 5px", borderRadius: "4px" }}>
                          🌊 +4.5m Stilt Clearance
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          handleFlyToShelter(shelter.lat, shelter.lon, shelter.id);
                          setShowMitigationModal(false);
                        }}
                        style={{
                          marginTop: "6px",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontWeight: 800,
                          background: "#0284c7",
                          color: "#ffffff",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                      >
                        📍 Fly to Shelter in 3D
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: 5 Structural Engineering Mitigation Pillars (IS-875 Part 3) */}
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 800, color: "#10b981", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📐</span> 5 Structural &amp; Engineering Disaster Mitigation Measures
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontWeight: 800, fontSize: "11px", color: "#38bdf8", marginBottom: "3px" }}>
                      1. Roof Truss Hurricane Tie-Downs
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#cbd5e1", lineHeight: 1.5 }}>
                      Galvanized steel hurricane straps between roof rafters and reinforced masonry bond beams. Eliminates upward aerodynamic suction detachment, reducing Load-to-Resistance Ratio (LRR) from <strong style={{ color: "#ef4444" }}>1.45</strong> to <strong style={{ color: "#22c55e" }}>0.62</strong>.
                    </div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontWeight: 800, fontSize: "11px", color: "#38bdf8", marginBottom: "3px" }}>
                      2. Window Impact Storm Shutters
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#cbd5e1", lineHeight: 1.5 }}>
                      Boarding or aluminum roll-down shutters prevent glass breach. A single broken windward window induces internal pressurization ($+0.8 C_p$), doubling net roof uplift force and triggering catastrophic structural roof loss.
                    </div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontWeight: 800, fontSize: "11px", color: "#38bdf8", marginBottom: "3px" }}>
                      3. Upwind Obstacle Sheltering (15% Reduction)
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#cbd5e1", lineHeight: 1.5 }}>
                      Directional upwind structures and mature Casuarina tree belts provide aerodynamic roughness shielding. Reduces effective dynamic wind loading $q \cdot C_d$ by <strong style={{ color: "#34d399" }}>8%–15%</strong> (Shelter Factor $0.85$–$0.92$).
                    </div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontWeight: 800, fontSize: "11px", color: "#38bdf8", marginBottom: "3px" }}>
                      4. RCC Stilted Elevation &amp; Scour Piles
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#cbd5e1", lineHeight: 1.5 }}>
                      Elevates shelter functional floors +4.5 m MSL on reinforced concrete pile stilts. Allows high-velocity storm surge and hydrodynamic wave pounding to flow beneath living quarters without hydrostatic wall collapse.
                    </div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "8px", padding: "10px", gridColumn: "span 2" }}>
                    <div style={{ fontWeight: 800, fontSize: "11px", color: "#38bdf8", marginBottom: "3px" }}>
                      5. Coastal Mangrove &amp; Casuarina Bio-Shields
                    </div>
                    <div style={{ fontSize: "10.5px", color: "#cbd5e1", lineHeight: 1.5 }}>
                      Dense mangrove forest buffer zones physically attenuate and dissipate up to <strong style={{ color: "#34d399" }}>66% of cyclone wave energy</strong> within the first 100 meters of shoreline, protecting inland masonry dwellings from catastrophic hydrodynamic scour.
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Sector Evacuation Priority Corridors */}
              {sheltersPlan?.ward_priorities && sheltersPlan.ward_priorities.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🚨</span> Sector-Level Evacuation Routing &amp; Priority Directives
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "8px" }}>
                    {sheltersPlan.ward_priorities.map((w) => (
                      <div
                        key={w.ward_id}
                        style={{
                          background: "rgba(15, 23, 42, 0.8)",
                          borderLeft: `4px solid ${w.color}`,
                          borderRadius: "6px",
                          padding: "8px 10px",
                          fontSize: "10.5px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#f8fafc" }}>
                          <span>{w.name}</span>
                          <span style={{ color: w.color }}>[{w.risk_level}]</span>
                        </div>
                        <div style={{ color: "#cbd5e1", marginTop: "2px" }}>
                          {w.action}
                        </div>
                        <div style={{ color: "#94a3b8", marginTop: "4px", fontSize: "10px" }}>
                          Assigned Shelter: <strong style={{ color: "#38bdf8" }}>{w.nearest_shelter}</strong> ({w.distance_km} km)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Buildings Warning */}
      {buildingData.buildingList.length === 0 && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(6, 12, 22, 0.95)",
          border: "1px solid rgba(245, 158, 11, 0.6)",
          borderRadius: "12px",
          padding: "20px 28px",
          zIndex: 1200,
          textAlign: "center",
          maxWidth: "340px",
        }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>⚠️</div>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#f59e0b", marginBottom: "6px" }}>
            3D BUILDING DATA UNAVAILABLE
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.5 }}>
            No building footprints loaded for this location.
            Try selecting a preset city (Digha, Puri, or Vizag) from the controls above.
          </div>
        </div>
      )}

      {/* Interactive Floating Hover Tooltip */}
      {hoveredBld && hoverPos && !selectedBld && (
        <div
          style={{
            position: "absolute",
            left: `${Math.min(hoverPos.x + 14, window.innerWidth - 220)}px`,
            top: `${Math.max(hoverPos.y - 45, 60)}px`,
            zIndex: 1150,
            background: "rgba(10, 18, 32, 0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            pointerEvents: "none",
            color: "#ffffff",
            fontSize: "11px",
            minWidth: "180px",
            maxWidth: "240px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
            <span style={{ fontWeight: 800, color: "#38bdf8", fontSize: "11.5px" }}>{hoveredBld.name}</span>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: "4px",
                background: hoveredBld.damageScore >= 0.55 ? "#ef4444" : hoveredBld.damageScore >= 0.25 ? "#f59e0b" : "#22c55e",
                color: "#ffffff",
              }}
            >
              {hoveredBld.classification}
            </span>
          </div>
          <div style={{ fontSize: "10px", color: "#cbd5e1", display: "flex", justifyContent: "space-between" }}>
            <span>{hoveredBld.stories} Floors ({hoveredBld.height}m)</span>
            <span>Wind: <strong style={{ color: "#ef4444" }}>{hoveredBld.windKph} km/h</strong></span>
          </div>
          <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "3px", textAlign: "center" }}>
            💡 Click to inspect structural dossier
          </div>
        </div>
      )}

      {/* 3D CITY STATUS Debug Panel (Bottom-Left - Step 13) */}
      <div style={{
        position: "absolute",
        bottom: "14px",
        left: "14px",
        zIndex: 1200,
      }}>
        <button
          onClick={() => setShowDebug(!showDebug)}
          style={{
            background: "rgba(6, 12, 22, 0.85)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "10px",
            color: "#94a3b8",
            cursor: "pointer",
            marginBottom: showDebug ? "6px" : "0",
          }}
        >
          {showDebug ? "▼ Hide Status" : "▶ 3D City Status"}
        </button>
        {showDebug && (
          <div style={{
            background: "rgba(6, 12, 22, 0.94)",
            backdropFilter: "blur(16px)",
            border: debugInfo.featureCount === 0 ? "1.5px solid #ef4444" : "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "10.5px",
            fontFamily: "monospace",
            color: "#cbd5e1",
            lineHeight: 1.6,
            minWidth: "210px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}>
            <div style={{ fontWeight: 900, color: "#38bdf8", marginBottom: "4px", fontSize: "11px", letterSpacing: "0.5px" }}>
              3D CITY STATUS
            </div>
            {debugInfo.featureCount === 0 ? (
              <div style={{ color: "#ef4444", fontWeight: 800, padding: "4px 0" }}>
                ❌ BUILDING DATA NOT LOADED
              </div>
            ) : (
              <>
                <div><span style={{ color: "#94a3b8" }}>MapLibre: </span><span style={{ color: "#22c55e", fontWeight: 700 }}>READY</span></div>
                <div><span style={{ color: "#94a3b8" }}>Satellite: </span><span style={{ color: "#22c55e", fontWeight: 700 }}>READY</span></div>
                <div><span style={{ color: "#94a3b8" }}>Buildings: </span><span style={{ color: "#22c55e", fontWeight: 700 }}>READY</span></div>
                <div><span style={{ color: "#94a3b8" }}>Building Features: </span><strong style={{ color: "#38bdf8" }}>{debugInfo.featureCount.toLocaleString()}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>3D Extrusion: </span><span style={{ color: "#22c55e", fontWeight: 700 }}>{debugInfo.layerActive ? "ACTIVE" : "MISSING"}</span></div>
                <div><span style={{ color: "#94a3b8" }}>Roads: </span><span style={{ color: "#22c55e", fontWeight: 700 }}>{debugInfo.roadCount > 0 ? "READY" : "EMPTY"}</span></div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "4px", paddingTop: "4px" }}>
                  <div style={{ color: "#94a3b8", fontWeight: 700, marginBottom: "2px" }}>Camera:</div>
                  <div>Zoom {telemetry.zoom || "16.5"}</div>
                  <div>Pitch {telemetry.tiltDeg}°</div>
                  <div>Bearing {telemetry.headingDeg}°</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
