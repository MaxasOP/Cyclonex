import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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

interface BuildingInfo {
  feature: BuildingFeature;
  mesh: THREE.Object3D;
  type: string;
  name: string;
  sector: string;
  height: number;
  damageScore: number;
  classification: string;
  windKph: number;
  dynPressurePa: number;
  lrr: number;
  capacity: number;
  lat: number;
  lng: number;
  recommendation: string;
}

// Slippy map tile calculations
function getTileXY(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function tileToBBox(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return { west, east, north, south };
}

type BasemapType = "esri" | "osm" | "carto_dark";

export default function RealWorld3DView({
  center,
  locationName,
  features = [],
  buildings = [],
  speedKph = 25,
  headingDeg = 315,
  onExitReal3D,
  onSelectBuilding,
  onSelectPreset,
}: RealWorld3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // HUD and Simulation State
  const [selectedBld, setSelectedBld] = useState<BuildingInfo | null>(null);
  const [visualMode, setVisualMode] = useState<"heatmap" | "realistic">("realistic");
  const [basemapMode, setBasemapMode] = useState<BasemapType>("esri");
  const [showSurge, setShowSurge] = useState<boolean>(true);
  const [surgeHeightM, setSurgeHeightM] = useState<number>(2.8);
  const [showWindStreams, setShowWindStreams] = useState<boolean>(true);
  const [showRain, setShowRain] = useState<boolean>(true);
  const [cameraView, setCameraView] = useState<"drone" | "birdseye" | "surge" | "orbit">("birdseye");
  const [tileLoadStatus, setTileLoadStatus] = useState<string>("Streaming High-Res Satellite Tiles...");

  // Three.js object references
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const surgeMeshRef = useRef<THREE.Mesh | null>(null);
  const buildingMeshesRef = useRef<BuildingInfo[]>([]);
  const highlightBoxRef = useRef<THREE.BoxHelper | null>(null);
  const visualModeRef = useRef<"heatmap" | "realistic">(visualMode);
  visualModeRef.current = visualMode;

  // Derive human-readable location label
  const derivedLocation = locationName
    ? locationName
    : Math.abs(center.lat - 21.62) < 0.25 && Math.abs(center.lng - 87.51) < 0.25
    ? "Digha Coastline, West Bengal"
    : Math.abs(center.lat - 19.81) < 0.25 && Math.abs(center.lng - 85.83) < 0.25
    ? "Puri Coastal Sector, Odisha"
    : Math.abs(center.lat - 20.316) < 0.25 && Math.abs(center.lng - 86.61) < 0.25
    ? "Paradip Port & Jagatsinghpur, Odisha"
    : Math.abs(center.lat - 17.68) < 0.25 && Math.abs(center.lng - 83.21) < 0.25
    ? "Visakhapatnam Harbor & Urban Coast, AP"
    : Math.abs(center.lat - 13.08) < 0.25 && Math.abs(center.lng - 80.27) < 0.25
    ? "Chennai Marina & Urban Coast, Tamil Nadu"
    : `Lat: ${center.lat.toFixed(4)}°N, Lng: ${center.lng.toFixed(4)}°E`;

  const maxWind = features.reduce((m, f) => Math.max(m, f.properties?.wind_kph ?? 0), 0);

  // Camera presets
  const handleSetCameraPreset = (preset: "drone" | "birdseye" | "surge" | "orbit") => {
    setCameraView(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === "drone") {
      controls.autoRotate = false;
      controls.target.set(0, 10, 0);
      camera.position.set(0, 16, 50);
    } else if (preset === "birdseye") {
      controls.autoRotate = false;
      controls.target.set(0, 10, 0);
      camera.position.set(70, 85, 105);
    } else if (preset === "surge") {
      controls.autoRotate = false;
      controls.target.set(0, 8, 0);
      camera.position.set(-55, 30, 70);
    } else if (preset === "orbit") {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.0;
      controls.target.set(0, 10, 0);
      camera.position.set(95, 80, 105);
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07101a");
    scene.fog = new THREE.FogExp2("#081320", 0.0012);

    // 2. Camera Setup
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 620;
    const camera = new THREE.PerspectiveCamera(50, Math.max(0.1, width / Math.max(1, height)), 0.5, 5000);
    camera.position.set(70, 85, 105);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 15;
    controls.maxDistance = 1800;
    controls.target.set(0, 10, 0);
    controlsRef.current = controls;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight("#93b7de", 0.85);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight("#a3d0fd", "#142538", 0.7);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight("#fff5db", 1.95);
    sunLight.position.set(240, 340, 180);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1400;
    const d = 450;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight("#38bdf8", 0.45);
    fillLight.position.set(-220, 160, -120);
    scene.add(fillLight);

    const lightningLight = new THREE.PointLight("#60a5fa", 0, 2500);
    lightningLight.position.set(0, 300, -80);
    scene.add(lightningLight);

    // 6. Geographic Tile Coordinates & High-Res Satellite Terrain
    const zoom = 15;
    const { x: cx, y: cy } = getTileXY(center.lat, center.lng, zoom);
    const minX = cx - 1;
    const maxX = cx + 1;
    const minY = cy - 1;
    const maxY = cy + 1;

    const bboxNW = tileToBBox(minX, minY, zoom);
    const bboxSE = tileToBBox(maxX, maxY, zoom);
    const west = bboxNW.west;
    const north = bboxNW.north;
    const east = bboxSE.east;
    const south = bboxSE.south;

    const metersPerDegLat = 110540;
    const metersPerDegLng = 111320 * Math.cos((center.lat * Math.PI) / 180);
    const worldScale = 0.22; // 1 unit in Three.js ≈ 4.5 meters

    const spanMetersX = (east - west) * metersPerDegLng;
    const spanMetersZ = (north - south) * metersPerDegLat;
    const planeWidth = spanMetersX * worldScale;
    const planeHeight = spanMetersZ * worldScale;

    // Center offset between tile grid center and exact storm center
    const gridCenterLon = (west + east) / 2;
    const gridCenterLat = (north + south) / 2;
    const groundOffsetX = (gridCenterLon - center.lng) * metersPerDegLng * worldScale;
    const groundOffsetZ = -(gridCenterLat - center.lat) * metersPerDegLat * worldScale;

    // Offscreen Canvas for Satellite Texture (3x3 tiles = 768x768 px)
    const groundCanvas = document.createElement("canvas");
    groundCanvas.width = 768;
    groundCanvas.height = 768;
    const ctx = groundCanvas.getContext("2d")!;

    // Initial Tactical Vector Fallback (displays instantly while tiles stream)
    ctx.fillStyle = "#0c1b29";
    ctx.fillRect(0, 0, 768, 768);

    // Geo Coordinate Grid Lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
    ctx.lineWidth = 1.5;
    for (let i = 64; i < 768; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 768);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(768, i);
      ctx.stroke();
    }

    // High-Tech Geo Coordinate Labels
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
    ctx.fillText(`${north.toFixed(4)}°N [NW]`, 16, 26);
    ctx.fillText(`${south.toFixed(4)}°N [SW]`, 16, 750);
    ctx.fillText(`${west.toFixed(4)}°E`, 16, 384);
    ctx.fillText(`${east.toFixed(4)}°E`, 660, 384);

    // Center Target Reticle at Exact (center.lat, center.lng)
    const centerU = (center.lng - west) / (east - west);
    const centerV = (north - center.lat) / (north - south);
    const centerPixelX = Math.round(centerU * 768);
    const centerPixelY = Math.round(centerV * 768);

    ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerPixelX, centerPixelY, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerPixelX - 38, centerPixelY);
    ctx.lineTo(centerPixelX + 38, centerPixelY);
    ctx.moveTo(centerPixelX, centerPixelY - 38);
    ctx.lineTo(centerPixelX, centerPixelY + 38);
    ctx.stroke();

    const groundTex = new THREE.CanvasTexture(groundCanvas);
    groundTex.wrapS = THREE.ClampToEdgeWrapping;
    groundTex.wrapT = THREE.ClampToEdgeWrapping;
    groundTex.anisotropy = 16;

    // Asynchronously download and stitch the 9 high-res satellite / map tiles
    const tileBaseUrls: Record<BasemapType, (x: number, y: number, z: number) => string> = {
      esri: (x, y, z) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
      osm: (x, y, z) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      carto_dark: (x, y, z) => `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
    };

    let loadedCount = 0;
    const tileUrlFn = tileBaseUrls[basemapMode] || tileBaseUrls.esri;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const tx = minX + col;
        const ty = minY + row;
        const tileUrl = tileUrlFn(tx, ty, zoom);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.drawImage(img, col * 256, row * 256, 256, 256);
          loadedCount++;
          if (loadedCount >= 9) {
            setTileLoadStatus(`High-Res Aerial Satellite Imagery Active (${zoom}x)`);
          } else {
            setTileLoadStatus(`Streaming satellite tiles: ${loadedCount}/9...`);
          }
          groundTex.needsUpdate = true;
        };
        img.onerror = () => {
          loadedCount++;
          groundTex.needsUpdate = true;
        };
        img.src = tileUrl;
      }
    }

    // 7. Ground Plane Geometry (Mesh sized to exact geographic bounding box)
    const groundGeo = new THREE.PlaneGeometry(planeWidth, planeHeight, 64, 64);
    groundGeo.rotateX(-Math.PI / 2);

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.85,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(groundOffsetX, 0, groundOffsetZ);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 8. Ocean Detection & Real Shoreline Alignment
    let oceanCount = 0;
    let oceanSumLon = 0;
    let oceanSumLat = 0;

    features.forEach((f) => {
      if (f.properties?.land_type === "OCEAN") {
        const ring = f.geometry?.coordinates?.[0];
        if (ring && ring.length >= 3) {
          oceanCount++;
          oceanSumLon += ring.reduce((acc, p) => acc + p[0], 0) / ring.length;
          oceanSumLat += ring.reduce((acc, p) => acc + p[1], 0) / ring.length;
        }
      }
    });

    const hasRealOcean = oceanCount > 2;
    let oceanBearingX = 0;
    let oceanBearingZ = 1; // Default south

    if (hasRealOcean) {
      const avgOceanLon = oceanSumLon / oceanCount;
      const avgOceanLat = oceanSumLat / oceanCount;
      const dLon = avgOceanLon - center.lng;
      const dLat = avgOceanLat - center.lat;
      const mag = Math.hypot(dLon, dLat) || 1;
      oceanBearingX = dLon / mag;
      oceanBearingZ = -(dLat / mag);
    }

    // Coastal Ocean Water Plane
    const oceanGeo = new THREE.PlaneGeometry(planeWidth * 1.5, planeHeight * 0.65, 48, 48);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: "#08334c",
      transparent: true,
      opacity: 0.88,
      roughness: 0.08,
      metalness: 0.25,
      reflectivity: 0.95,
      transmission: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(
      groundOffsetX + oceanBearingX * (planeWidth * 0.35),
      -0.5,
      groundOffsetZ + oceanBearingZ * (planeHeight * 0.35)
    );
    scene.add(oceanMesh);

    // Animated Dynamic Storm Surge Layer (Anchored to Coastal Sector)
    const surgeGeo = new THREE.PlaneGeometry(planeWidth * 1.2, planeHeight * 0.45, 32, 32);
    surgeGeo.rotateX(-Math.PI / 2);
    const surgeMat = new THREE.MeshPhysicalMaterial({
      color: "#0284c7",
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.2,
      transmission: 0.4,
      clearcoat: 0.8,
    });
    const surgeMesh = new THREE.Mesh(surgeGeo, surgeMat);
    surgeMesh.position.set(
      groundOffsetX + oceanBearingX * (planeWidth * 0.35),
      0.2,
      groundOffsetZ + oceanBearingZ * (planeHeight * 0.35)
    );
    surgeMesh.visible = showSurge;
    scene.add(surgeMesh);
    surgeMeshRef.current = surgeMesh;

    // 9. Materials Setup for Realistic vs Heatmap Toggling
    const damageMaterials = {
      severe: new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.5, metalness: 0.15, emissive: "#7f1d1d", emissiveIntensity: 0.35 }),
      moderate: new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.55, metalness: 0.1, emissive: "#7c2d12", emissiveIntensity: 0.25 }),
      safe: new THREE.MeshStandardMaterial({ color: "#22c55e", roughness: 0.55, metalness: 0.1, emissive: "#14532d", emissiveIntensity: 0.3 }),
      haven: new THREE.MeshStandardMaterial({ color: "#06b6d4", roughness: 0.45, metalness: 0.2, emissive: "#164e63", emissiveIntensity: 0.35 }),
    };

    const realisticMaterials = {
      concrete: new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.8, metalness: 0.1 }),
      hospitalWhite: new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.6, metalness: 0.1 }),
      brick: new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.9, metalness: 0.05 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#1d4ed8", roughness: 0.08, metalness: 0.6, transmission: 0.5, clearcoat: 1.0 }),
      shelterBunker: new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.5, metalness: 0.2 }),
      substationMetal: new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.35, metalness: 0.8 }),
      steelTruss: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.3, metalness: 0.85 }),
      roofTileRed: new THREE.MeshStandardMaterial({ color: "#991b1b", roughness: 0.85 }),
      solarBlue: new THREE.MeshPhysicalMaterial({ color: "#1e3a8a", roughness: 0.1, metalness: 0.8 }),
    };

    // 10. Building Generation Anchored to Exact GPS Coordinates
    const buildingList: BuildingInfo[] = [];
    const cityGroup = new THREE.Group();
    scene.add(cityGroup);
    const dynamicMeshes: { mesh: THREE.Mesh; dmgMat: THREE.Material; realMat: THREE.Material }[] = [];

    // Collect source building features
    let sourceBlds: BuildingFeature[] = [...buildings];

    // If buildings are not yet loaded from OSM or before simulation:
    // Generate organic georeferenced infrastructure clusters across the exact coordinates
    if (sourceBlds.length === 0) {
      const baseLat = center.lat;
      const baseLng = center.lng;

      // Realistic street offsets & clusters (Marine Drive, Town Center, Civic Quad, Safe Heights)
      const clusterOffsets = [
        // Marine Drive / Shoreline strip
        { dLat: -0.0035, dLng: -0.0070, type: "COMMERCIAL", name: "Oceanview Resort & Suites", h: 22, score: 0.48, cap: 400 },
        { dLat: -0.0032, dLng: -0.0042, type: "COMMERCIAL", name: "Coastal Promenade Hotel", h: 18, score: 0.45, cap: 250 },
        { dLat: -0.0038, dLng: -0.0015, type: "RESIDENTIAL", name: "Frontline Fishermen Chalet #1", h: 6, score: 0.84, cap: 12 },
        { dLat: -0.0040, dLng: 0.0012, type: "RESIDENTIAL", name: "Frontline Fishermen Chalet #2", h: 6, score: 0.88, cap: 14 },
        { dLat: -0.0036, dLng: 0.0038, type: "COMMERCIAL", name: "Beachside Trade Market", h: 14, score: 0.52, cap: 180 },
        { dLat: -0.0034, dLng: 0.0065, type: "COMMERCIAL", name: "Seaside Grand Hotel", h: 24, score: 0.44, cap: 350 },

        // Civic Healthcare & Administrative District
        { dLat: 0.0015, dLng: -0.0055, type: "HOSPITAL", name: "Coastal District Emergency Hospital", h: 20, score: 0.18, cap: 350 },
        { dLat: 0.0022, dLng: -0.0030, type: "COMMERCIAL", name: "District Municipal Administration", h: 15, score: 0.28, cap: 200 },
        { dLat: 0.0012, dLng: -0.0025, type: "COMMERCIAL", name: "Emergency Response Center", h: 12, score: 0.22, cap: 100 },

        // Lifeline Utilities (Substation & Telecom Mast)
        { dLat: 0.0042, dLng: -0.0062, type: "POWER_SUBSTATION", name: "132kV Coastal Grid Substation", h: 12, score: 0.68, cap: 0 },
        { dLat: 0.0048, dLng: -0.0035, type: "TELECOM_TOWER", name: "45m Emergency VHF/GSM Mast", h: 46, score: 0.74, cap: 0 },

        // Designated Haven Heights (MPCS Safe Cyclone Shelters)
        { dLat: 0.0055, dLng: 0.0045, type: "MPCS_SHELTER", name: "Primary MPCS Cyclone Shelter #1", h: 20, score: 0.06, cap: 1500 },
        { dLat: 0.0062, dLng: 0.0018, type: "MPCS_SHELTER", name: "MPCS Safe Haven Shelter #2", h: 18, score: 0.08, cap: 1200 },

        // Downtown Commercial Towers
        { dLat: -0.0005, dLng: 0.0010, type: "COMMERCIAL", name: "Coastal Financial Center", h: 36, score: 0.38, cap: 500 },
        { dLat: -0.0008, dLng: 0.0035, type: "COMMERCIAL", name: "Oceanic Trade Tower", h: 30, score: 0.42, cap: 450 },
        { dLat: 0.0002, dLng: 0.0060, type: "COMMERCIAL", name: "Harbor Commercial Complex", h: 22, score: 0.46, cap: 300 },

        // Residential Neighborhoods (Villas and Multi-Family Pucca Blocks)
        { dLat: 0.0025, dLng: 0.0025, type: "RESIDENTIAL", name: "Pucca Residential Block #1", h: 9, score: 0.25, cap: 30 },
        { dLat: 0.0028, dLng: 0.0050, type: "RESIDENTIAL", name: "Pucca Residential Block #2", h: 9, score: 0.28, cap: 30 },
        { dLat: 0.0035, dLng: 0.0032, type: "RESIDENTIAL", name: "Safe Heights Villa #3", h: 8, score: 0.20, cap: 16 },
        { dLat: 0.0038, dLng: 0.0058, type: "RESIDENTIAL", name: "Safe Heights Villa #4", h: 8, score: 0.18, cap: 16 },
        { dLat: 0.0045, dLng: 0.0015, type: "RESIDENTIAL", name: "Highland Family Home #5", h: 8, score: 0.19, cap: 14 },
        { dLat: 0.0050, dLng: -0.0005, type: "RESIDENTIAL", name: "Highland Family Home #6", h: 8, score: 0.21, cap: 14 },
        { dLat: -0.0015, dLng: -0.0040, type: "RESIDENTIAL", name: "Coastal Settlement Home #7", h: 7, score: 0.62, cap: 18 },
        { dLat: -0.0020, dLng: -0.0018, type: "RESIDENTIAL", name: "Coastal Settlement Home #8", h: 7, score: 0.65, cap: 18 },
        { dLat: -0.0022, dLng: 0.0015, type: "RESIDENTIAL", name: "Coastal Settlement Home #9", h: 7, score: 0.58, cap: 18 },
        { dLat: -0.0018, dLng: 0.0042, type: "RESIDENTIAL", name: "Coastal Settlement Home #10", h: 7, score: 0.54, cap: 18 },
      ];

      clusterOffsets.forEach((c, idx) => {
        const bLat = baseLat + c.dLat;
        const bLng = baseLng + c.dLng;
        const halfW = 0.00035;
        const halfH = 0.00028;

        sourceBlds.push({
          type: "Feature",
          id: `cluster-bld-${idx + 1}`,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [bLng - halfW, bLat - halfH],
                [bLng + halfW, bLat - halfH],
                [bLng + halfW, bLat + halfH],
                [bLng - halfW, bLat + halfH],
                [bLng - halfW, bLat - halfH],
              ],
            ],
          },
          properties: {
            name: c.name,
            building_type: c.type,
            height_m: c.h,
            damage_score: c.score,
            classification: c.score >= 0.55 ? "SEVERE" : c.score >= 0.25 ? "MODERATE" : "SAFE",
            wind_kph: Math.round(speedKph * 3.8 + 25),
            dynamic_pressure_pa: Math.round(1100 + (c.score * 500)),
            load_to_resistance_ratio: Number((c.score * 1.3).toFixed(2)),
            capacity: c.cap,
          },
        });
      });
    }

    // Sort all buildings by proximity to exact storm center so the most relevant structures render
    sourceBlds.sort((a, b) => {
      const ringA = a.geometry?.coordinates?.[0];
      const ringB = b.geometry?.coordinates?.[0];
      if (!ringA || !ringB) return 0;
      const cLonA = ringA.reduce((acc, pt) => acc + pt[0], 0) / ringA.length;
      const cLatA = ringA.reduce((acc, pt) => acc + pt[1], 0) / ringA.length;
      const cLonB = ringB.reduce((acc, pt) => acc + pt[0], 0) / ringB.length;
      const cLatB = ringB.reduce((acc, pt) => acc + pt[1], 0) / ringB.length;
      const distA = Math.hypot(cLonA - center.lng, cLatA - center.lat);
      const distB = Math.hypot(cLonB - center.lng, cLatB - center.lat);
      return distA - distB;
    });

    // Iterate through top georeferenced buildings and place at exact (X, Z) coordinates
    sourceBlds.slice(0, 160).forEach((bld, idx) => {
      const ring = bld.geometry?.coordinates?.[0];
      if (!ring || ring.length < 3) return;

      const cLon = ring.reduce((acc, pt) => acc + pt[0], 0) / ring.length;
      const cLat = ring.reduce((acc, pt) => acc + pt[1], 0) / ring.length;

      // Exact mathematical georeferenced coordinate mapping
      const worldX = (cLon - center.lng) * metersPerDegLng * worldScale;
      const worldZ = -(cLat - center.lat) * metersPerDegLat * worldScale;

      // Filter to visible ground boundaries
      if (Math.abs(worldX - groundOffsetX) > planeWidth * 0.52 || Math.abs(worldZ - groundOffsetZ) > planeHeight * 0.52) {
        return;
      }

      const props = bld.properties || {};
      const bldType = props.building_type || "RESIDENTIAL";
      const height = props.height_m || (bldType === "TELECOM_TOWER" ? 42 : bldType === "MPCS_SHELTER" ? 18 : 10);
      const score = props.damage_score ?? (bldType === "MPCS_SHELTER" ? 0.06 : 0.35);
      const wind = props.wind_kph ?? Math.round(speedKph * 3.8 + 30);
      const dynPress = props.dynamic_pressure_pa ?? 1150;
      const lrr = props.load_to_resistance_ratio ?? Number((score * 1.3).toFixed(2));
      const capacity = props.capacity ?? (bldType === "MPCS_SHELTER" ? 1500 : bldType === "HOSPITAL" ? 300 : 0);
      const classification = score >= 0.55 ? "SEVERE_RISK" : score >= 0.25 ? "MODERATE_RISK" : "SAFE";

      const dmgMat = score >= 0.55 ? damageMaterials.severe : score >= 0.25 ? damageMaterials.moderate : damageMaterials.safe;

      // Construct building group at exact GPS position
      const bldGroup = new THREE.Group();
      bldGroup.position.set(worldX, 0, worldZ);

      // Footprint dimensions
      const minLon = Math.min(...ring.map((p) => p[0]));
      const maxLon = Math.max(...ring.map((p) => p[0]));
      const minLat = Math.min(...ring.map((p) => p[1]));
      const maxLat = Math.max(...ring.map((p) => p[1]));

      const wMeters = Math.max(16, (maxLon - minLon) * metersPerDegLng);
      const dMeters = Math.max(16, (maxLat - minLat) * metersPerDegLat);
      const w = Math.max(12, Math.min(40, wMeters * worldScale * 1.4));
      const d = Math.max(12, Math.min(40, dMeters * worldScale * 1.4));
      const h = Math.max(12, Math.min(70, height * worldScale * 2.0));

      // Attempt authentic polygonal shape extrusion if ring has valid polygon coordinates
      let extrudedGeo: THREE.BufferGeometry | null = null;
      if (ring && ring.length >= 4) {
        try {
          const shape = new THREE.Shape();
          const pts = ring.slice(0, -1).map((p) => {
            const px = (p[0] - cLon) * metersPerDegLng * worldScale;
            const py = (p[1] - cLat) * metersPerDegLat * worldScale;
            return new THREE.Vector2(px, py);
          });
          if (pts.length >= 3) {
            shape.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              shape.lineTo(pts[i].x, pts[i].y);
            }
            shape.closePath();

            const extrudeSettings: THREE.ExtrudeGeometryOptions = {
              depth: h,
              bevelEnabled: true,
              bevelThickness: 0.2,
              bevelSize: 0.15,
              bevelSegments: 1,
            };
            const shapeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            shapeGeo.rotateX(-Math.PI / 2);
            extrudedGeo = shapeGeo;
          }
        } catch {
          extrudedGeo = null;
        }
      }

      // Architectural Archetype Details
      if (bldType === "MPCS_SHELTER") {
        // 8 Reinforced Concrete Stilts (Elevates bunker 4.5m above flood water)
        const stiltGeo = new THREE.CylinderGeometry(0.8, 0.8, 4.5, 12);
        const stiltMat = realisticMaterials.shelterBunker;
        [-w * 0.4, 0, w * 0.4].forEach((sx) => {
          [-d * 0.4, d * 0.4].forEach((sz) => {
            const stilt = new THREE.Mesh(stiltGeo, stiltMat);
            stilt.position.set(sx, 2.25, sz);
            stilt.castShadow = true;
            bldGroup.add(stilt);
          });
        });

        // Main Bunker Hall
        const bunkerGeo = new THREE.BoxGeometry(w * 1.15, h, d * 1.15);
        const bunkerMesh = new THREE.Mesh(bunkerGeo, visualMode === "heatmap" ? damageMaterials.haven : realisticMaterials.shelterBunker);
        bunkerMesh.position.set(0, 4.5 + h / 2, 0);
        bunkerMesh.castShadow = true;
        bunkerMesh.receiveShadow = true;
        bldGroup.add(bunkerMesh);
        dynamicMeshes.push({ mesh: bunkerMesh, dmgMat: damageMaterials.haven, realMat: realisticMaterials.shelterBunker });

        // Rooftop Rescue Helipad with Yellow "H"
        const padGeo = new THREE.CylinderGeometry(w * 0.35, w * 0.35, 0.4, 24);
        const padMat = new THREE.MeshStandardMaterial({ color: "#1e293b" });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.position.set(0, 4.5 + h + 0.2, 0);
        bldGroup.add(padMesh);

        // Blinking Emerald-Green Safety Beacon
        const beaconGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const beaconMat = new THREE.MeshBasicMaterial({ color: "#22c55e" });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0, 4.5 + h + 2.5, 0);
        bldGroup.add(beacon);

        const haloGeo = new THREE.RingGeometry(2.0, 3.2, 24);
        haloGeo.rotateX(-Math.PI / 2);
        const haloMat = new THREE.MeshBasicMaterial({ color: "#4ade80", side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.set(0, 4.5 + h + 2.5, 0);
        bldGroup.add(halo);
      } else if (bldType === "HOSPITAL") {
        // Multi-wing Hospital Block
        const hospGeo = new THREE.BoxGeometry(w * 1.2, h, d * 1.1);
        const hospMesh = new THREE.Mesh(hospGeo, visualMode === "heatmap" ? dmgMat : realisticMaterials.hospitalWhite);
        hospMesh.position.set(0, h / 2, 0);
        hospMesh.castShadow = true;
        hospMesh.receiveShadow = true;
        bldGroup.add(hospMesh);
        dynamicMeshes.push({ mesh: hospMesh, dmgMat, realMat: realisticMaterials.hospitalWhite });

        // 3D Illuminated Red Cross
        const crossHGeo = new THREE.BoxGeometry(4.5, 1.2, 0.6);
        const crossVGeo = new THREE.BoxGeometry(1.2, 4.5, 0.6);
        const crossMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });
        const crossH = new THREE.Mesh(crossHGeo, crossMat);
        const crossV = new THREE.Mesh(crossVGeo, crossMat);
        crossH.position.set(0, h * 0.7, d * 0.56);
        crossV.position.set(0, h * 0.7, d * 0.56);
        bldGroup.add(crossH);
        bldGroup.add(crossV);

        // Ambulance parked outside
        const ambGeo = new THREE.BoxGeometry(2.2, 1.8, 4.5);
        const ambMat = new THREE.MeshStandardMaterial({ color: "#ffffff" });
        const amb = new THREE.Mesh(ambGeo, ambMat);
        amb.position.set(w * 0.65, 0.9, 0);
        bldGroup.add(amb);
      } else if (bldType === "TELECOM_TOWER") {
        // 3D Steel Truss Mast
        const mastGeo = new THREE.ConeGeometry(w * 0.35, h * 1.6, 4);
        const mastMesh = new THREE.Mesh(mastGeo, visualMode === "heatmap" ? dmgMat : realisticMaterials.steelTruss);
        mastMesh.position.set(0, (h * 1.6) / 2, 0);
        mastMesh.castShadow = true;
        bldGroup.add(mastMesh);
        dynamicMeshes.push({ mesh: mastMesh, dmgMat, realMat: realisticMaterials.steelTruss });

        // Red Aviation Warning Beacon
        const beaconGeo = new THREE.SphereGeometry(1.0, 12, 12);
        const beaconMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0, h * 1.6 + 0.8, 0);
        bldGroup.add(beacon);
      } else if (bldType === "POWER_SUBSTATION") {
        const subGeo = new THREE.BoxGeometry(w, h * 0.5, d);
        const subMesh = new THREE.Mesh(subGeo, visualMode === "heatmap" ? dmgMat : realisticMaterials.substationMetal);
        subMesh.position.set(0, (h * 0.5) / 2, 0);
        bldGroup.add(subMesh);
        dynamicMeshes.push({ mesh: subMesh, dmgMat, realMat: realisticMaterials.substationMetal });

        // Step-down transformers
        [-w * 0.25, w * 0.25].forEach((tx) => {
          const transGeo = new THREE.BoxGeometry(w * 0.35, h * 0.45, d * 0.35);
          const transMesh = new THREE.Mesh(transGeo, realisticMaterials.substationMetal);
          transMesh.position.set(tx, (h * 0.5) + (h * 0.45) / 2, 0);
          bldGroup.add(transMesh);
        });
      } else if (bldType === "COMMERCIAL") {
        const comGeo = extrudedGeo || new THREE.BoxGeometry(w, h, d);
        const comMesh = new THREE.Mesh(comGeo, visualMode === "heatmap" ? dmgMat : realisticMaterials.glass);
        if (!extrudedGeo) {
          comMesh.position.set(0, h / 2, 0);
        }
        comMesh.castShadow = true;
        comMesh.receiveShadow = true;
        bldGroup.add(comMesh);
        dynamicMeshes.push({ mesh: comMesh, dmgMat, realMat: realisticMaterials.glass });

        // Rooftop Penthouse / Utility
        const pentGeo = new THREE.BoxGeometry(Math.max(3, w * 0.45), 2.8, Math.max(3, d * 0.45));
        const pentMesh = new THREE.Mesh(pentGeo, realisticMaterials.concrete);
        pentMesh.position.set(0, h + 1.4, 0);
        bldGroup.add(pentMesh);
      } else {
        // Residential Houses with exact footprints or traditional pitched roofs
        const bGeo = extrudedGeo || new THREE.BoxGeometry(w, h * 0.7, d);
        const bMesh = new THREE.Mesh(bGeo, visualMode === "heatmap" ? dmgMat : (idx % 2 === 0 ? realisticMaterials.brick : realisticMaterials.concrete));
        if (!extrudedGeo) {
          bMesh.position.set(0, (h * 0.7) / 2, 0);
        }
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        bldGroup.add(bMesh);
        dynamicMeshes.push({ mesh: bMesh, dmgMat, realMat: (idx % 2 === 0 ? realisticMaterials.brick : realisticMaterials.concrete) });

        if (!extrudedGeo) {
          const rGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3.5, 4);
          rGeo.rotateY(Math.PI / 4);
          const rMesh = new THREE.Mesh(rGeo, visualMode === "heatmap" ? dmgMat : realisticMaterials.roofTileRed);
          rMesh.position.set(0, h * 0.7 + 1.75, 0);
          rMesh.castShadow = true;
          bldGroup.add(rMesh);
          dynamicMeshes.push({ mesh: rMesh, dmgMat, realMat: realisticMaterials.roofTileRed });
        } else {
          // Add low-profile parapet / rooftop element for extruded residential structures
          const roofBorderGeo = new THREE.BoxGeometry(Math.max(2.5, w * 0.35), 1.2, Math.max(2.5, d * 0.35));
          const roofBorderMesh = new THREE.Mesh(roofBorderGeo, realisticMaterials.roofTileRed);
          roofBorderMesh.position.set(0, h + 0.6, 0);
          bldGroup.add(roofBorderMesh);
        }
      }

      const info: BuildingInfo = {
        feature: bld,
        mesh: bldGroup,
        type: bldType,
        name: props.name || `Building #${idx + 1}`,
        sector: `${derivedLocation} (${cLat.toFixed(4)}°N, ${cLon.toFixed(4)}°E)`,
        height: Math.round(height),
        damageScore: score,
        classification,
        windKph: wind,
        dynPressurePa: dynPress,
        lrr,
        capacity,
        lat: Number(cLat.toFixed(5)),
        lng: Number(cLon.toFixed(5)),
        recommendation:
          bldType === "MPCS_SHELTER"
            ? `DESIGNATED SAFE REFUGE: Capacity ${capacity} persons. Elevated stilts clear +4.5m storm surge. 260 km/h wind rating.`
            : score >= 0.55
            ? `SEVERE FAILURE HAZARD: Wind gust force exceeds structural load limits. Evacuate immediately to designated MPCS Shelter.`
            : score >= 0.25
            ? `MODERATE RISK: Glass and roof tile precautions required. Standby for local civic directives.`
            : `LOW VULNERABILITY: Heavy reinforced framing stable under local wind field.`,
      };

      bldGroup.userData = { bldInfo: info };
      cityGroup.add(bldGroup);
      buildingList.push(info);
    });

    // 11. Aerodynamic Wind Streamline Particles aligned with headingDeg
    const windCount = 350;
    const windGeo = new THREE.BufferGeometry();
    const windPositions = new Float32Array(windCount * 3);
    const windVelocities = new Float32Array(windCount * 3);

    const rad = ((headingDeg % 360) * Math.PI) / 180;
    const windDirX = Math.cos(rad);
    const windDirZ = -Math.sin(rad);

    for (let i = 0; i < windCount; i++) {
      windPositions[i * 3] = (Math.random() - 0.5) * planeWidth;
      windPositions[i * 3 + 1] = 6 + Math.random() * 50;
      windPositions[i * 3 + 2] = (Math.random() - 0.5) * planeHeight;

      const spd = 1.2 + Math.random() * 2.2;
      windVelocities[i * 3] = windDirX * spd;
      windVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      windVelocities[i * 3 + 2] = windDirZ * spd;
    }
    windGeo.setAttribute("position", new THREE.BufferAttribute(windPositions, 3));

    const windMat = new THREE.PointsMaterial({
      color: "#38bdf8",
      size: 2.2,
      transparent: true,
      opacity: 0.65,
    });
    const windParticles = new THREE.Points(windGeo, windMat);
    windParticles.visible = showWindStreams;
    scene.add(windParticles);

    // 12. Tropical Torrential Rain Particles
    const rainCount = 1800;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * planeWidth * 1.2;
      rainPositions[i * 3 + 1] = Math.random() * 180;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * planeHeight * 1.2;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: "#93c5fd",
      size: 1.4,
      transparent: true,
      opacity: 0.5,
    });
    const rainParticles = new THREE.Points(rainGeo, rainMat);
    rainParticles.visible = showRain;
    scene.add(rainParticles);

    // 13. Raycaster for Interactive Building Selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const handlePointerDown = (e: MouseEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const performSelection = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cityGroup.children, true);

      if (intersects.length > 0) {
        let cur: THREE.Object3D | null = intersects[0].object;
        while (cur && !cur.userData?.bldInfo && cur.parent && cur.parent !== cityGroup) {
          cur = cur.parent;
        }

        if (cur && cur.userData?.bldInfo) {
          const info: BuildingInfo = cur.userData.bldInfo;
          setSelectedBld(info);
          if (onSelectBuilding) onSelectBuilding(info.feature);

          if (highlightBoxRef.current) {
            scene.remove(highlightBoxRef.current);
            highlightBoxRef.current.dispose();
          }
          const box = new THREE.BoxHelper(cur, new THREE.Color("#38bdf8"));
          scene.add(box);
          highlightBoxRef.current = box;
        }
      }
    };

    const handlePointerUp = (event: MouseEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) {
        return;
      }
      performSelection(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cityGroup.children, true);
      renderer.domElement.style.cursor = intersects.length > 0 ? "pointer" : "default";
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    buildingMeshesRef.current = buildingList;

    // Automatically select the primary shelter on initial load
    if (buildingList.length > 0) {
      const defaultBld = buildingList.find((b) => b.type === "MPCS_SHELTER") || buildingList[0];
      setSelectedBld(defaultBld);
      const box = new THREE.BoxHelper(defaultBld.mesh, new THREE.Color("#38bdf8"));
      scene.add(box);
      highlightBoxRef.current = box;
    }

    // 14. Animation Loop
    let animFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      controls.update();

      // Ripple animation on ocean
      oceanMesh.position.y = -0.5 + Math.sin(elapsed * 1.8) * 0.12;

      // Storm surge water height
      if (surgeMeshRef.current) {
        surgeMeshRef.current.position.y = surgeHeightM * 0.8 - 0.5 + Math.sin(elapsed * 1.5) * 0.08;
      }

      // Wind particles flow
      if (windParticles.visible) {
        const pArr = windGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < windCount; i++) {
          pArr[i * 3] += windVelocities[i * 3] * delta * 50;
          pArr[i * 3 + 1] += windVelocities[i * 3 + 1] * delta * 50;
          pArr[i * 3 + 2] += windVelocities[i * 3 + 2] * delta * 50;

          if (Math.abs(pArr[i * 3]) > planeWidth * 0.6 || Math.abs(pArr[i * 3 + 2]) > planeHeight * 0.6) {
            pArr[i * 3] = (Math.random() - 0.5) * planeWidth * 0.8;
            pArr[i * 3 + 1] = 6 + Math.random() * 45;
            pArr[i * 3 + 2] = (Math.random() - 0.5) * planeHeight * 0.8;
          }
        }
        windGeo.attributes.position.needsUpdate = true;
      }

      // Rain particles falling
      if (rainParticles.visible) {
        const rArr = rainGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < rainCount; i++) {
          rArr[i * 3 + 1] -= delta * 160;
          rArr[i * 3] += delta * 12;
          if (rArr[i * 3 + 1] < 0) {
            rArr[i * 3 + 1] = 160;
            rArr[i * 3] = (Math.random() - 0.5) * planeWidth;
          }
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      if (highlightBoxRef.current) {
        highlightBoxRef.current.update();
      }

      // Occasional lightning flash
      if (Math.random() < 0.003) {
        lightningLight.intensity = 3500;
        setTimeout(() => {
          lightningLight.intensity = 0;
        }, 80);
      }

      // Toggle heatmap vs realistic materials
      dynamicMeshes.forEach((item) => {
        item.mesh.material = visualModeRef.current === "heatmap" ? item.dmgMat : item.realMat;
      });

      renderer.render(scene, camera);
    };

    animate();

    // ResizeObserver
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 900;
      const h = container.clientHeight || 620;
      if (w > 10 && h > 10) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [center.lat, center.lng, speedKph, headingDeg, buildings, features, basemapMode]);

  // Update surge mesh visibility
  useEffect(() => {
    if (surgeMeshRef.current) {
      surgeMeshRef.current.visible = showSurge;
    }
  }, [showSurge]);

  return (
    <div
      className="real3d-viewport-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "640px",
        overflow: "hidden",
      }}
    >
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} style={{ width: "100%", height: "100%", minHeight: "640px" }} />

      {/* Unified Sleek Top HUD Bar */}
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
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "10px",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          gap: "12px",
          flexWrap: "wrap",
          pointerEvents: "auto",
        }}
      >
        {/* Left: Location & Telemetry */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 10px #10b981",
              display: "inline-block",
            }}
          />
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>3D DIGITAL TWIN</span>
              <span style={{ color: "#64748b" }}>·</span>
              <span style={{ color: "#ffffff" }}>{derivedLocation}</span>
            </div>
            <div style={{ fontSize: "0.66rem", color: "#94a3b8" }}>
              GPS: {center.lat.toFixed(3)}°N, {center.lng.toFixed(3)}°E · Wind: <strong style={{ color: "#fca5a5" }}>{maxWind || speedKph} km/h</strong> · {tileLoadStatus}
            </div>
          </div>
        </div>

        {/* Center: Camera Presets */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "7px",
            padding: "3px 4px",
            display: "flex",
            gap: "3px",
          }}
        >
          <button
            type="button"
            className={`real3d-subtab ${cameraView === "birdseye" ? "active" : ""}`}
            onClick={() => handleSetCameraPreset("birdseye")}
            style={{
              padding: "4px 9px",
              background: cameraView === "birdseye" ? "#0284c7" : "transparent",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.7rem",
            }}
          >
            🏙️ Birds-Eye
          </button>
          <button
            type="button"
            className={`real3d-subtab ${cameraView === "drone" ? "active" : ""}`}
            onClick={() => handleSetCameraPreset("drone")}
            style={{
              padding: "4px 9px",
              background: cameraView === "drone" ? "#0284c7" : "transparent",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.7rem",
            }}
          >
            🚁 Drone
          </button>
          <button
            type="button"
            className={`real3d-subtab ${cameraView === "surge" ? "active" : ""}`}
            onClick={() => handleSetCameraPreset("surge")}
            style={{
              padding: "4px 9px",
              background: cameraView === "surge" ? "#0284c7" : "transparent",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.7rem",
            }}
          >
            🌊 Surge
          </button>
          <button
            type="button"
            className={`real3d-subtab ${cameraView === "orbit" ? "active" : ""}`}
            onClick={() => handleSetCameraPreset("orbit")}
            style={{
              padding: "4px 9px",
              background: cameraView === "orbit" ? "#0284c7" : "transparent",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.7rem",
            }}
          >
            🔄 Orbit
          </button>
        </div>

        {/* Right: Quick Location Jump & Back Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {onSelectPreset && (
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                onClick={() => onSelectPreset("landfall_amphan")}
                style={{
                  background: Math.abs(center.lat - 21.62) < 0.2 ? "#0284c7" : "rgba(255, 255, 255, 0.07)",
                  border: Math.abs(center.lat - 21.62) < 0.2 ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  borderRadius: "5px",
                  padding: "3px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Digha
              </button>
              <button
                type="button"
                onClick={() => onSelectPreset("landfall_fani")}
                style={{
                  background: Math.abs(center.lat - 19.81) < 0.2 ? "#0284c7" : "rgba(255, 255, 255, 0.07)",
                  border: Math.abs(center.lat - 19.81) < 0.2 ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  borderRadius: "5px",
                  padding: "3px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Puri
              </button>
              <button
                type="button"
                onClick={() => onSelectPreset("landfall_hudhud")}
                style={{
                  background: Math.abs(center.lat - 17.68) < 0.2 ? "#0284c7" : "rgba(255, 255, 255, 0.07)",
                  border: Math.abs(center.lat - 17.68) < 0.2 ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#fff",
                  borderRadius: "5px",
                  padding: "3px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Vizag
              </button>
            </div>
          )}

          {onExitReal3D && (
            <button
              type="button"
              onClick={onExitReal3D}
              style={{
                background: "rgba(239, 68, 68, 0.25)",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                color: "#fca5a5",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
                marginLeft: "4px",
              }}
              title="Return to 2D Map Tactical Perspective"
            >
              &larr; Back to 2D
            </button>
          )}
        </div>
      </div>

      {/* Compact 3D Simulation Controls Panel (Bottom Right) */}
      <div
        className="real3d-simulation-tools"
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          zIndex: 1100,
          background: "rgba(6, 12, 22, 0.90)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "10px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          color: "#e2e8f0",
          fontSize: "0.72rem",
          minWidth: "220px",
          pointerEvents: "auto",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "4px" }}>
          <span style={{ fontWeight: 800, color: "#38bdf8" }}>⚡ 3D PHYSICS CONTROLS</span>
          <button
            type="button"
            onClick={() => setVisualMode(visualMode === "realistic" ? "heatmap" : "realistic")}
            style={{
              padding: "2px 6px",
              background: visualMode === "realistic" ? "rgba(37, 99, 235, 0.4)" : "rgba(217, 119, 6, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "4px",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.64rem",
            }}
          >
            {visualMode === "realistic" ? "🏛️ Realistic" : "🔴 Heatmap"}
          </button>
        </div>

        {/* Basemap Imagery Mode */}
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            onClick={() => setBasemapMode("esri")}
            style={{
              flex: 1,
              padding: "3px 4px",
              background: basemapMode === "esri" ? "#0284c7" : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "0.66rem",
              fontWeight: basemapMode === "esri" ? 700 : 500,
              cursor: "pointer",
            }}
          >
            🛰️ Sat
          </button>
          <button
            type="button"
            onClick={() => setBasemapMode("osm")}
            style={{
              flex: 1,
              padding: "3px 4px",
              background: basemapMode === "osm" ? "#0284c7" : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "0.66rem",
              fontWeight: basemapMode === "osm" ? 700 : 500,
              cursor: "pointer",
            }}
          >
            🗺️ OSM
          </button>
          <button
            type="button"
            onClick={() => setBasemapMode("carto_dark")}
            style={{
              flex: 1,
              padding: "3px 4px",
              background: basemapMode === "carto_dark" ? "#0284c7" : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "0.66rem",
              fontWeight: basemapMode === "carto_dark" ? 700 : 500,
              cursor: "pointer",
            }}
          >
            ⚡ Dark
          </button>
        </div>

        {/* Storm Surge Slider */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
              <input
                type="checkbox"
                checked={showSurge}
                onChange={(e) => setShowSurge(e.target.checked)}
                style={{ accentColor: "#0284c7" }}
              />
              <span>🌊 Storm Surge</span>
            </label>
            <span style={{ color: "#38bdf8", fontWeight: 800 }}>+{surgeHeightM.toFixed(1)} m</span>
          </div>
          {showSurge && (
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={surgeHeightM}
              onChange={(e) => setSurgeHeightM(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#0284c7" }}
            />
          )}
        </div>

        {/* Wind Streamlines & Rain Toggles */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
            <input
              type="checkbox"
              checked={showWindStreams}
              onChange={(e) => setShowWindStreams(e.target.checked)}
              style={{ accentColor: "#0284c7" }}
            />
            <span>💨 Wind</span>
          </label>
          <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
            <input
              type="checkbox"
              checked={showRain}
              onChange={(e) => setShowRain(e.target.checked)}
              style={{ accentColor: "#0284c7" }}
            />
            <span>🌧️ Rain</span>
          </label>
        </div>
      </div>

      {/* Interactive Selected Building Engineering Dossier (Bottom Left) */}
      {selectedBld && (
        <div
          className="real3d-building-dossier"
          style={{
            position: "absolute",
            bottom: "20px",
            left: "16px",
            zIndex: 1150,
            background: "rgba(8, 16, 28, 0.96)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: "10px",
            padding: "14px 18px",
            color: "#e2e8f0",
            maxWidth: "380px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.75)",
            pointerEvents: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <div>
              <span
                style={{
                  fontSize: "0.66rem",
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  background:
                    selectedBld.damageScore >= 0.55
                      ? "rgba(239, 68, 68, 0.25)"
                      : selectedBld.damageScore >= 0.25
                      ? "rgba(245, 158, 11, 0.25)"
                      : "rgba(34, 197, 94, 0.25)",
                  color:
                    selectedBld.damageScore >= 0.55
                      ? "#fca5a5"
                      : selectedBld.damageScore >= 0.25
                      ? "#fde68a"
                      : "#86efac",
                  padding: "3px 7px",
                  borderRadius: "4px",
                  border: `1px solid ${
                    selectedBld.damageScore >= 0.55
                      ? "#ef4444"
                      : selectedBld.damageScore >= 0.25
                      ? "#f59e0b"
                      : "#22c55e"
                  }`,
                }}
              >
                {selectedBld.classification}
              </span>
              <div style={{ fontSize: "0.96rem", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
                {selectedBld.name}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                GPS: <strong style={{ color: "#38bdf8" }}>{selectedBld.lat.toFixed(4)}°N, {selectedBld.lng.toFixed(4)}°E</strong> &middot; {selectedBld.type}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedBld(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "1.2rem",
                cursor: "pointer",
                padding: "0 4px",
              }}
            >
              &times;
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              fontSize: "0.72rem",
              background: "rgba(255, 255, 255, 0.04)",
              padding: "8px 10px",
              borderRadius: "6px",
              marginBottom: "8px",
            }}
          >
            <div>
              <div style={{ color: "#94a3b8" }}>Height / Floors:</div>
              <div style={{ fontWeight: 700, color: "#fff" }}>
                {selectedBld.height} m ({Math.max(1, Math.round(selectedBld.height / 3.4))} Stories)
              </div>
            </div>
            <div>
              <div style={{ color: "#94a3b8" }}>Peak Wind Gust:</div>
              <div style={{ fontWeight: 700, color: "#f87171" }}>
                {selectedBld.windKph} km/h
              </div>
            </div>
            <div>
              <div style={{ color: "#94a3b8" }}>Dynamic Pressure (q):</div>
              <div style={{ fontWeight: 700, color: "#38bdf8" }}>
                {selectedBld.dynPressurePa} Pa (N/m²)
              </div>
            </div>
            <div>
              <div style={{ color: "#94a3b8" }}>Load / Resistance (LRR):</div>
              <div style={{ fontWeight: 700, color: selectedBld.lrr > 0.8 ? "#ef4444" : "#22c55e" }}>
                {selectedBld.lrr}
              </div>
            </div>
          </div>

          <div
            style={{
              background:
                selectedBld.damageScore >= 0.55
                  ? "rgba(239, 68, 68, 0.15)"
                  : selectedBld.type === "MPCS_SHELTER"
                  ? "rgba(34, 197, 94, 0.15)"
                  : "rgba(56, 189, 248, 0.12)",
              border: `1px solid ${
                selectedBld.damageScore >= 0.55
                  ? "rgba(239, 68, 68, 0.35)"
                  : selectedBld.type === "MPCS_SHELTER"
                  ? "rgba(34, 197, 94, 0.35)"
                  : "rgba(56, 189, 248, 0.3)"
              }`,
              padding: "8px 10px",
              borderRadius: "6px",
              fontSize: "0.71rem",
              lineHeight: 1.45,
              color:
                selectedBld.damageScore >= 0.55
                  ? "#fca5a5"
                  : selectedBld.type === "MPCS_SHELTER"
                  ? "#86efac"
                  : "#bae6fd",
            }}
          >
            {selectedBld.recommendation}
          </div>
        </div>
      )}

      {/* Floating Instructions & Legend (Bottom Right) */}
      <div
        className="real3d-legend"
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          zIndex: 1100,
          background: "rgba(8, 16, 28, 0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "6px",
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "0.7rem",
          color: "#94a3b8",
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
          <span>Severe Risk</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f97316", display: "inline-block" }} />
          <span>Moderate</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          <span>Safe Facility</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#06b6d4", display: "inline-block" }} />
          <span>MPCS Haven</span>
        </div>
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: "10px", color: "#cbd5e1" }}>
          🖱️ Click building for dossier &middot; Left-drag to orbit &middot; Right-drag to pan
        </div>
      </div>
    </div>
  );
}
