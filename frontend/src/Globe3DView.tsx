import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface LifecycleStage {
  id: string;
  label: string;
  timeOffsetHours: number;
  dateStr: string;
  lat: number;
  lng: number;
  category: string;
  windSpeedKph: number;
  pressureHpa: number;
  sstC: number;
  color: string;
  description: string;
  coneRadiusKm: number;
  statusType: "genesis" | "intensification" | "landfall" | "inland" | "dissipation";
}

interface Globe3DViewProps {
  center: { lat: number; lng: number };
  trajectory?: { lat: number; lng: number; label: string }[];
  headingDeg?: number;
  speedKph?: number;
  locationName?: string;
  onExit3DGlobe?: () => void;
  onSelectPreset?: (presetKey: string) => void;
}

// Convert Geographical Lat/Lng into 3D Vector3 Cartesian Coordinates on a Sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const x = radius * Math.cos(latRad) * Math.cos(lngRad);
  const y = radius * Math.sin(latRad);
  const z = -radius * Math.cos(latRad) * Math.sin(lngRad);
  return new THREE.Vector3(x, y, z);
}

// Generate Procedural High-Contrast Vector World Canvas as a guaranteed offline fallback
function createProceduralWorldTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Deep Obsidian Navy Ocean
  ctx.fillStyle = "#060d1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Lat / Long Coordinate Grid (Graticule)
  ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += canvas.width / 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += canvas.height / 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Equator & Prime Meridian highlighted
  ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();

  // Continents in tactical slate with cyan glowing boundaries
  ctx.fillStyle = "#112238";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
  ctx.lineWidth = 1.5;

  const toCanvasX = (lng: number) => ((lng + 180) / 360) * canvas.width;
  const toCanvasY = (lat: number) => ((90 - lat) / 180) * canvas.height;

  const drawPoly = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([lng, lat], i) => {
      const x = toCanvasX(lng);
      const y = toCanvasY(lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  // Indian Subcontinent & Bay of Bengal
  drawPoly([
    [68, 24], [72, 32], [78, 36], [88, 28], [92, 24], [89, 22],
    [87, 21.5], [85, 19], [80, 13], [77.5, 8.1], [76, 10], [73, 16],
    [72.5, 21], [68, 24],
  ]);

  // Sri Lanka
  drawPoly([[80, 9.8], [81.8, 8.5], [81.5, 6.2], [79.8, 6.5], [80, 9.8]]);

  // Southeast Asia & Indochina
  drawPoly([[92, 24], [102, 22], [108, 16], [105, 10], [100, 5], [98, 10], [92, 16], [92, 24]]);

  // Arabian Peninsula
  drawPoly([[40, 28], [55, 26], [60, 22], [54, 16], [45, 12], [42, 16], [35, 28], [40, 28]]);

  // Africa
  drawPoly([[35, 30], [51, 12], [42, -5], [32, -28], [18, -34], [12, -15], [8, 4], [-17, 15], [-5, 36], [35, 30]]);

  // Eurasia
  drawPoly([[0, 42], [30, 40], [60, 45], [90, 50], [120, 40], [140, 36], [130, 60], [80, 70], [20, 65], [-8, 55], [0, 42]]);

  // Australia
  drawPoly([[115, -22], [130, -12], [145, -15], [153, -28], [148, -38], [136, -35], [115, -34], [115, -22]]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Generate high-resolution spiral cyclone cloud texture for the 3D vortex
function createCycloneCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = 256;
  const cy = 256;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pure realistic atmospheric spiral clouds (natural cirrus white/translucent)
  // 1. Subtle core cloud overcast
  const coreOvercast = ctx.createRadialGradient(cx, cy, 14, cx, cy, 180);
  coreOvercast.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  coreOvercast.addColorStop(0.3, "rgba(240, 248, 255, 0.35)");
  coreOvercast.addColorStop(0.7, "rgba(200, 220, 245, 0.12)");
  coreOvercast.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = coreOvercast;
  ctx.beginPath();
  ctx.arc(cx, cy, 180, 0, Math.PI * 2);
  ctx.fill();

  // 2. Realistic Logarithmic Spiral Cloud Arms (Feathered Cirrus Wisps)
  for (let arm = 0; arm < 5; arm++) {
    const baseAngle = (arm * Math.PI * 2) / 5;
    for (let wisp = 0; wisp < 3; wisp++) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 - wisp * 0.1})`;
      ctx.lineWidth = 14 - wisp * 3;
      ctx.lineCap = "round";
      ctx.beginPath();

      for (let t = 0; t < 100; t++) {
        const angle = baseAngle + t * 0.052 + wisp * 0.04;
        const r = 18 + t * 1.7;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // 3. Clear Tightly Defined Meteorological Eye (14px radius)
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // 4. Subtle, razor-sharp Eyewall Boundary (not a giant red circle)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, 13.5, 0, Math.PI * 2);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

// Generate Translucent Glassmorphism Sprite Badges with reduced opacity and high legibility
function createGlobeBadgeSprite(
  title: string,
  subtitle: string,
  badgeBorder: string,
  bgOpacity: number = 0.45,
  matOpacity: number = 0.85
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 120;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Translucent glass rounded card with reduced opacity
  ctx.fillStyle = `rgba(6, 14, 26, ${bgOpacity})`;
  ctx.strokeStyle = badgeBorder;
  ctx.lineWidth = 2.5;

  // Soft glow around border
  ctx.shadowColor = badgeBorder;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 14);
  ctx.fill();
  ctx.stroke();

  // Reset shadow for text rendering
  ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Glowing pulse pip
  ctx.fillStyle = badgeBorder;
  ctx.beginPath();
  ctx.arc(30, 40, 8, 0, Math.PI * 2);
  ctx.fill();

  // Crisp title text
  ctx.font = "bold 24px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, 50, 48);

  // Subtitle text with high contrast
  ctx.font = "16px monospace";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(subtitle, 24, 88);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: matOpacity,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(15, 4.7, 1);
  return sprite;
}

// Determine historical or calculated lifecycle stages
export function getLifecycleStages(
  center: { lat: number; lng: number },
  locationName?: string
): LifecycleStage[] {
  const isAmphan =
    (locationName && locationName.toLowerCase().includes("amphan")) ||
    (Math.abs(center.lat - 21.62) < 0.35 && Math.abs(center.lng - 87.51) < 0.35);

  const isFani =
    (locationName && locationName.toLowerCase().includes("fani")) ||
    (Math.abs(center.lat - 19.81) < 0.35 && Math.abs(center.lng - 85.83) < 0.35);

  const isHudhud =
    (locationName && locationName.toLowerCase().includes("hudhud")) ||
    (Math.abs(center.lat - 17.68) < 0.35 && Math.abs(center.lng - 83.21) < 0.35);

  const isNisarga =
    (locationName && locationName.toLowerCase().includes("nisarga")) ||
    (Math.abs(center.lat - 18.35) < 0.8 && Math.abs(center.lng - 72.98) < 0.8) ||
    (Math.abs(center.lat - 16.8) < 0.8 && Math.abs(center.lng - 72.4) < 0.8);

  const isBiparjoy =
    (locationName && locationName.toLowerCase().includes("biparjoy")) ||
    (Math.abs(center.lat - 23.2) < 0.8 && Math.abs(center.lng - 68.6) < 0.8);

  const isDana =
    (locationName && locationName.toLowerCase().includes("dana")) ||
    (Math.abs(center.lat - 20.85) < 0.6 && Math.abs(center.lng - 86.95) < 0.6);

  if (isNisarga) {
    return [
      {
        id: "nisarga-genesis",
        label: "Stage 0: Arabian Sea Genesis (-72h)",
        timeOffsetHours: -72,
        dateStr: "May 31, 12:00 UTC",
        lat: 11.5,
        lng: 72.8,
        category: "Low Pressure (Lakshadweep)",
        windSpeedKph: 45,
        pressureHpa: 1004,
        sstC: 31.5,
        color: "#38bdf8",
        description: "Formed over exceptionally warm Arabian Sea waters (>31°C) near Lakshadweep archipelago.",
        coneRadiusKm: 25,
        statusType: "genesis",
      },
      {
        id: "nisarga-deepen",
        label: "Stage 1: Marine Intensification (-36h)",
        timeOffsetHours: -36,
        dateStr: "June 2, 06:00 UTC",
        lat: 14.8,
        lng: 71.8,
        category: "Cyclonic Storm (Open Water)",
        windSpeedKph: 85,
        pressureHpa: 994,
        sstC: 30.8,
        color: "#f59e0b",
        description: "Rapidly intensified tracking north-northeastward through the eastern Arabian Sea marine corridor.",
        coneRadiusKm: 40,
        statusType: "intensification",
      },
      {
        id: "nisarga-peak",
        label: "Stage 2: Severe Storm Peak (-12h)",
        timeOffsetHours: -12,
        dateStr: "June 3, 00:00 UTC",
        lat: 16.8,
        lng: 72.4,
        category: "Severe Cyclonic Storm",
        windSpeedKph: 110,
        pressureHpa: 984,
        sstC: 30.2,
        color: "#ef4444",
        description: "Severe Cyclonic Storm off Konkan coast with central pressure 984 hPa and prominent spiral rainbands.",
        coneRadiusKm: 55,
        statusType: "intensification",
      },
      {
        id: "nisarga-landfall",
        label: "Stage 3: Maharashtra Landfall (Target 0h)",
        timeOffsetHours: 0,
        dateStr: "June 3, 07:00 UTC",
        lat: 18.35,
        lng: 72.98,
        category: "Severe Landfall (Alibag / Shriwardhan)",
        windSpeedKph: 120,
        pressureHpa: 984,
        sstC: 29.6,
        color: "#ef4444",
        description: "Direct landfall near Shriwardhan / Alibag (Raigad, Maharashtra) south of Mumbai with 120 km/h gusts.",
        coneRadiusKm: 70,
        statusType: "landfall",
      },
      {
        id: "nisarga-inland",
        label: "Stage 4: Western Ghats Friction (+12h)",
        timeOffsetHours: 12,
        dateStr: "June 3, 18:00 UTC",
        lat: 19.4,
        lng: 74.3,
        category: "Cyclonic Storm (Pune / Nashik)",
        windSpeedKph: 75,
        pressureHpa: 994,
        sstC: 0.0,
        color: "#f59e0b",
        description: "Collision with Western Ghats mountain terrain rapidly shears storm circulation and triggers torrential rainfall.",
        coneRadiusKm: 110,
        statusType: "inland",
      },
      {
        id: "nisarga-dissipate",
        label: "Stage 5: Inland Dissipation (+24h)",
        timeOffsetHours: 24,
        dateStr: "June 4, 06:00 UTC",
        lat: 21.2,
        lng: 76.8,
        category: "Well-Marked Low (Vidarbha / MP)",
        windSpeedKph: 45,
        pressureHpa: 1002,
        sstC: 0.0,
        color: "#38bdf8",
        description: "Dissipated into remnant low pressure area over central India as kinetic energy is completely exhausted.",
        coneRadiusKm: 165,
        statusType: "dissipation",
      },
    ];
  }

  if (isBiparjoy) {
    return [
      {
        id: "biparjoy-genesis",
        label: "Stage 0: South Arabian Sea Genesis (-120h)",
        timeOffsetHours: -120,
        dateStr: "June 6, 00:00 UTC",
        lat: 12.0,
        lng: 66.0,
        category: "Depression (Central Arabian Sea)",
        windSpeedKph: 50,
        pressureHpa: 1002,
        sstC: 31.8,
        color: "#38bdf8",
        description: "Formed in extremely warm waters of south-central Arabian Sea.",
        coneRadiusKm: 30,
        statusType: "genesis",
      },
      {
        id: "biparjoy-peak",
        label: "Stage 1: Extremely Severe Ocean Peak (-48h)",
        timeOffsetHours: -48,
        dateStr: "June 11, 12:00 UTC",
        lat: 18.2,
        lng: 67.6,
        category: "Extremely Severe Cyclonic Storm",
        windSpeedKph: 165,
        pressureHpa: 955,
        sstC: 30.5,
        color: "#ef4444",
        description: "Reached peak intensity in open Arabian Sea with 165 km/h sustained winds and 14m storm waves.",
        coneRadiusKm: 55,
        statusType: "intensification",
      },
      {
        id: "biparjoy-landfall",
        label: "Stage 2: Jakhau Port Gujarat Landfall (0h)",
        timeOffsetHours: 0,
        dateStr: "June 15, 17:00 UTC",
        lat: 23.2,
        lng: 68.6,
        category: "Very Severe Landfall (Gujarat Coast)",
        windSpeedKph: 140,
        pressureHpa: 965,
        sstC: 29.2,
        color: "#ef4444",
        description: "Landfall near Jakhau Port (Kutch, Gujarat) causing extensive coastal inundation.",
        coneRadiusKm: 75,
        statusType: "landfall",
      },
      {
        id: "biparjoy-inland",
        label: "Stage 3: Rajasthan Dissipation (+24h)",
        timeOffsetHours: 24,
        dateStr: "June 17, 00:00 UTC",
        lat: 25.5,
        lng: 71.8,
        category: "Depression (South Rajasthan)",
        windSpeedKph: 50,
        pressureHpa: 996,
        sstC: 0.0,
        color: "#38bdf8",
        description: "Weakened into depression over southwest Rajasthan desert.",
        coneRadiusKm: 150,
        statusType: "dissipation",
      },
    ];
  }

  if (isDana) {
    return [
      {
        id: "dana-genesis",
        label: "Stage 0: East-Central Bay Genesis (-48h)",
        timeOffsetHours: -48,
        dateStr: "Oct 22, 12:00 UTC",
        lat: 14.5,
        lng: 89.2,
        category: "Depression (Bay of Bengal)",
        windSpeedKph: 55,
        pressureHpa: 1002,
        sstC: 30.6,
        color: "#38bdf8",
        description: "Developed over east-central Bay of Bengal from active monsoon trough.",
        coneRadiusKm: 30,
        statusType: "genesis",
      },
      {
        id: "dana-intensify",
        label: "Stage 1: Severe Storm Deepening (-24h)",
        timeOffsetHours: -24,
        dateStr: "Oct 23, 18:00 UTC",
        lat: 18.2,
        lng: 88.0,
        category: "Severe Cyclonic Storm",
        windSpeedKph: 110,
        pressureHpa: 985,
        sstC: 30.0,
        color: "#f59e0b",
        description: "Intensified while heading northwestward toward north Odisha coast.",
        coneRadiusKm: 50,
        statusType: "intensification",
      },
      {
        id: "dana-landfall",
        label: "Stage 2: Dhamra / Bhitarkanika Landfall (0h)",
        timeOffsetHours: 0,
        dateStr: "Oct 25, 00:00 UTC",
        lat: 20.85,
        lng: 86.95,
        category: "Severe Landfall (Odisha Coast)",
        windSpeedKph: 120,
        pressureHpa: 980,
        sstC: 29.4,
        color: "#ef4444",
        description: "Landfall between Dhamra Port and Bhitarkanika National Park, Odisha with 120 km/h wind gusts.",
        coneRadiusKm: 70,
        statusType: "landfall",
      },
      {
        id: "dana-inland",
        label: "Stage 3: Inland Dissipation (+24h)",
        timeOffsetHours: 24,
        dateStr: "Oct 26, 00:00 UTC",
        lat: 21.8,
        lng: 85.5,
        category: "Depression (Inland Odisha)",
        windSpeedKph: 50,
        pressureHpa: 1000,
        sstC: 0.0,
        color: "#38bdf8",
        description: "Weakened rapidly over north interior Odisha hills.",
        coneRadiusKm: 140,
        statusType: "dissipation",
      },
    ];
  }

  if (isAmphan) {
    return [
      {
        id: "amphan-genesis",
        label: "Stage 0: Tropical Genesis",
        timeOffsetHours: -96,
        dateStr: "May 16, 00:00 UTC",
        lat: 9.8,
        lng: 86.5,
        category: "Tropical Depression",
        windSpeedKph: 55,
        pressureHpa: 1004,
        sstC: 31.4,
        color: "#38bdf8",
        description: "Formed in warm equatorial waters of southern Bay of Bengal. Latent heat flux exceeds 280 W/m².",
        coneRadiusKm: 25,
        statusType: "genesis",
      },
      {
        id: "amphan-intensify",
        label: "Stage 1: Rapid Intensification",
        timeOffsetHours: -48,
        dateStr: "May 18, 06:00 UTC",
        lat: 14.5,
        lng: 86.8,
        category: "Extremely Severe Cyclonic Storm",
        windSpeedKph: 165,
        pressureHpa: 940,
        sstC: 30.8,
        color: "#f59e0b",
        description: "Explosive deepening over open ocean with central pressure falling 50 hPa in 24 hours.",
        coneRadiusKm: 40,
        statusType: "intensification",
      },
      {
        id: "amphan-peak",
        label: "Stage 2: Super Cyclone Peak",
        timeOffsetHours: -24,
        dateStr: "May 19, 12:00 UTC",
        lat: 18.2,
        lng: 87.2,
        category: "Super Cyclonic Storm (SuCS)",
        windSpeedKph: 240,
        pressureHpa: 920,
        sstC: 30.2,
        color: "#ef4444",
        description: "Peak intensity over marine waters. Maximum sustained winds reach 240 km/h with 15m wave heights.",
        coneRadiusKm: 55,
        statusType: "intensification",
      },
      {
        id: "amphan-landfall",
        label: "Stage 3: Coastal Landfall (Current Target)",
        timeOffsetHours: 0,
        dateStr: "May 20, 12:00 UTC",
        lat: 21.62,
        lng: 87.51,
        category: "Very Severe Cyclonic Storm (Landfall)",
        windSpeedKph: 185,
        pressureHpa: 950,
        sstC: 29.4,
        color: "#ef4444",
        description: "Landfall near Digha / Sundarbans. Massive coastal obstacle roughness initiates rapid kinetic friction.",
        coneRadiusKm: 70,
        statusType: "landfall",
      },
      {
        id: "amphan-inland",
        label: "Stage 4: +12h Inland Dissipation",
        timeOffsetHours: 12,
        dateStr: "May 21, 00:00 UTC",
        lat: 23.8,
        lng: 88.5,
        category: "Severe Cyclonic Storm (Weakening)",
        windSpeedKph: 110,
        pressureHpa: 978,
        sstC: 0.0,
        color: "#f59e0b",
        description: "Eye tracks across West Bengal. Cut off from warm ocean moisture; surface friction slows vortex.",
        coneRadiusKm: 110,
        statusType: "inland",
      },
      {
        id: "amphan-dissipate",
        label: "Stage 5: +24h Remnant Low",
        timeOffsetHours: 24,
        dateStr: "May 21, 12:00 UTC",
        lat: 25.5,
        lng: 89.6,
        category: "Depression (Dissipating)",
        windSpeedKph: 55,
        pressureHpa: 998,
        sstC: 0.0,
        color: "#38bdf8",
        description: "Degenerates into a remnant low over inland Assam/Bangladesh hills due to topographical obstacles.",
        coneRadiusKm: 175,
        statusType: "dissipation",
      },
    ];
  }

  if (isFani) {
    return [
      {
        id: "fani-genesis",
        label: "Stage 0: Equatorial Genesis",
        timeOffsetHours: -144,
        dateStr: "April 26, 06:00 UTC",
        lat: 5.2,
        lng: 88.5,
        category: "Tropical Depression",
        windSpeedKph: 45,
        pressureHpa: 1006,
        sstC: 31.2,
        color: "#38bdf8",
        description: "Formed very close to equator in east Indian Ocean, slowly tracking northward into Bay of Bengal.",
        coneRadiusKm: 25,
        statusType: "genesis",
      },
      {
        id: "fani-intensify",
        label: "Stage 1: Rapid Intensification",
        timeOffsetHours: -72,
        dateStr: "April 30, 12:00 UTC",
        lat: 12.8,
        lng: 85.1,
        category: "Extremely Severe Cyclonic Storm",
        windSpeedKph: 160,
        pressureHpa: 950,
        sstC: 30.6,
        color: "#f59e0b",
        description: "Curved northward around subtropical ridge, undergoing rapid intensification with clear 30km eye.",
        coneRadiusKm: 45,
        statusType: "intensification",
      },
      {
        id: "fani-peak",
        label: "Stage 2: Peak Ocean Intensity",
        timeOffsetHours: -24,
        dateStr: "May 2, 06:00 UTC",
        lat: 16.8,
        lng: 84.9,
        category: "Super Cyclonic Storm",
        windSpeedKph: 215,
        pressureHpa: 932,
        sstC: 30.1,
        color: "#ef4444",
        description: "Reached category 5 equivalent strength off Odisha coast with high oceanic heat content.",
        coneRadiusKm: 60,
        statusType: "intensification",
      },
      {
        id: "fani-landfall",
        label: "Stage 3: Puri Landfall (Target)",
        timeOffsetHours: 0,
        dateStr: "May 3, 03:30 UTC",
        lat: 19.81,
        lng: 85.83,
        category: "Extremely Severe Landfall",
        windSpeedKph: 185,
        pressureHpa: 937,
        sstC: 29.5,
        color: "#ef4444",
        description: "Eye made direct landfall near Puri. Coastal dunes and urban structures absorbed initial kinetic thrust.",
        coneRadiusKm: 75,
        statusType: "landfall",
      },
      {
        id: "fani-inland",
        label: "Stage 4: +12h Inland Dissipation",
        timeOffsetHours: 12,
        dateStr: "May 3, 15:30 UTC",
        lat: 21.6,
        lng: 86.9,
        category: "Cyclonic Storm",
        windSpeedKph: 90,
        pressureHpa: 982,
        sstC: 0.0,
        color: "#f59e0b",
        description: "Rapid friction degradation over Odisha river basins and settlements.",
        coneRadiusKm: 120,
        statusType: "inland",
      },
      {
        id: "fani-dissipate",
        label: "Stage 5: +24h Dissipation",
        timeOffsetHours: 24,
        dateStr: "May 4, 03:30 UTC",
        lat: 23.6,
        lng: 88.2,
        category: "Deep Depression",
        windSpeedKph: 55,
        pressureHpa: 996,
        sstC: 0.0,
        color: "#38bdf8",
        description: "Dissipated into deep depression over West Bengal / Bangladesh border.",
        coneRadiusKm: 180,
        statusType: "dissipation",
      },
    ];
  }

  if (isHudhud) {
    return [
      {
        id: "hudhud-genesis",
        label: "Stage 0: Andaman Genesis",
        timeOffsetHours: -120,
        dateStr: "Oct 7, 03:00 UTC",
        lat: 12.0,
        lng: 92.5,
        category: "Depression (Andaman Sea)",
        windSpeedKph: 50,
        pressureHpa: 1004,
        sstC: 30.6,
        color: "#38bdf8",
        description: "Formed over warm waters near Tenasserim / Andaman Sea with strong southwesterly monsoon surge.",
        coneRadiusKm: 25,
        statusType: "genesis",
      },
      {
        id: "hudhud-intensify",
        label: "Stage 1: Central Bay Deepening",
        timeOffsetHours: -48,
        dateStr: "Oct 10, 06:00 UTC",
        lat: 15.2,
        lng: 86.8,
        category: "Very Severe Cyclonic Storm",
        windSpeedKph: 150,
        pressureHpa: 960,
        sstC: 30.2,
        color: "#f59e0b",
        description: "Intensified rapidly while traversing the warm core of the central Bay of Bengal.",
        coneRadiusKm: 45,
        statusType: "intensification",
      },
      {
        id: "hudhud-landfall",
        label: "Stage 2: Visakhapatnam Landfall",
        timeOffsetHours: 0,
        dateStr: "Oct 12, 06:00 UTC",
        lat: 17.68,
        lng: 83.21,
        category: "Very Severe Landfall",
        windSpeedKph: 185,
        pressureHpa: 950,
        sstC: 29.2,
        color: "#ef4444",
        description: "Direct eyewall impact on Visakhapatnam urban coast and Eastern Ghat hills. Severe obstacle deceleration.",
        coneRadiusKm: 70,
        statusType: "landfall",
      },
      {
        id: "hudhud-inland",
        label: "Stage 3: +12h Eastern Ghats Friction",
        timeOffsetHours: 12,
        dateStr: "Oct 12, 18:00 UTC",
        lat: 19.5,
        lng: 82.0,
        category: "Cyclonic Storm",
        windSpeedKph: 80,
        pressureHpa: 985,
        sstC: 0.0,
        color: "#f59e0b",
        description: "Collision with Eastern Ghat mountain ridges caused rapid orographic cloudburst and spin breakdown.",
        coneRadiusKm: 115,
        statusType: "inland",
      },
      {
        id: "hudhud-dissipate",
        label: "Stage 4: +24h Dissipation",
        timeOffsetHours: 24,
        dateStr: "Oct 13, 06:00 UTC",
        lat: 21.5,
        lng: 80.5,
        category: "Deep Depression",
        windSpeedKph: 45,
        pressureHpa: 1000,
        sstC: 0.0,
        color: "#38bdf8",
        description: "Weakened into low pressure area over Chhattisgarh and eastern MP.",
        coneRadiusKm: 175,
        statusType: "dissipation",
      },
    ];
  }

  // Generic dynamic fallback for any custom coordinates
  const baseLat = center.lat;
  const baseLng = center.lng;
  const isArabianSea = baseLng < 77;

  return [
    {
      id: "gen-stage-0",
      label: "Stage 0: Oceanic Genesis (-96h)",
      timeOffsetHours: -96,
      dateStr: "-96 Hours (Warm Water Genesis)",
      lat: Math.max(5, baseLat - (isArabianSea ? 7.0 : 10.0)),
      lng: isArabianSea ? Math.max(60, baseLng - 2.5) : Math.max(82, baseLng - 2.0),
      category: "Tropical Low / Genesis",
      windSpeedKph: 50,
      pressureHpa: 1004,
      sstC: 31.2,
      color: "#38bdf8",
      description: `Tropical depression initiated over warm waters of ${isArabianSea ? "the Arabian Sea" : "the Bay of Bengal"} (SST > 30°C).`,
      coneRadiusKm: 25,
      statusType: "genesis",
    },
    {
      id: "gen-stage-1",
      label: "Stage 1: Marine Intensification (-48h)",
      timeOffsetHours: -48,
      dateStr: "-48 Hours (Open Ocean)",
      lat: Math.max(8, baseLat - (isArabianSea ? 3.5 : 5.0)),
      lng: isArabianSea ? Math.max(62, baseLng - 1.2) : Math.max(83, baseLng - 1.0),
      category: "Severe Cyclonic Storm",
      windSpeedKph: 135,
      pressureHpa: 965,
      sstC: 30.8,
      color: "#f59e0b",
      description: "Eye organization and rapid convective banding fueled by warm marine surface moisture.",
      coneRadiusKm: 45,
      statusType: "intensification",
    },
    {
      id: "gen-stage-2",
      label: "Stage 2: Peak Landfall Threat (0h)",
      timeOffsetHours: 0,
      dateStr: "Landfall Interception (Current)",
      lat: baseLat,
      lng: baseLng,
      category: "Extremely Severe Cyclone",
      windSpeedKph: 185,
      pressureHpa: 945,
      sstC: 29.5,
      color: "#ef4444",
      description: "Direct coastal landfall zone. Severe aerodynamic drag and boundary layer transition initiated.",
      coneRadiusKm: 70,
      statusType: "landfall",
    },
    {
      id: "gen-stage-3",
      label: "Stage 3: +12h Inland Dissipation",
      timeOffsetHours: 12,
      dateStr: "+12 Hours Inland",
      lat: Math.min(32, baseLat + 2.4),
      lng: Math.min(95, baseLng + (isArabianSea ? 1.5 : 1.2)),
      category: "Cyclonic Storm",
      windSpeedKph: 95,
      pressureHpa: 980,
      sstC: 0.0,
      color: "#f59e0b",
      description: "Inland ground friction and lack of oceanic latent heat cause rapid vortex deceleration.",
      coneRadiusKm: 120,
      statusType: "inland",
    },
    {
      id: "gen-stage-4",
      label: "Stage 4: +24h Dissipation",
      timeOffsetHours: 24,
      dateStr: "+24 Hours Post-Landfall",
      lat: Math.min(34, baseLat + 4.5),
      lng: Math.min(96, baseLng + (isArabianSea ? 3.0 : 2.0)),
      category: "Depression / Remnant Low",
      windSpeedKph: 50,
      pressureHpa: 998,
      sstC: 0.0,
      color: "#38bdf8",
      description: "Degenerates into a remnant low over higher inland terrain obstacles.",
      coneRadiusKm: 180,
      statusType: "dissipation",
    },
  ];
}

export default function Globe3DView({
  center,
  trajectory = [],
  headingDeg = 315,
  speedKph = 25,
  locationName,
  onExit3DGlobe,
  onSelectPreset,
}: Globe3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Simulation & Lifecycle State
  const [stages, setStages] = useState<LifecycleStage[]>(() => getLifecycleStages(center, locationName));
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(() => {
    const s = getLifecycleStages(center, locationName);
    const landfallIdx = s.findIndex((st) => st.statusType === "landfall");
    return landfallIdx >= 0 ? landfallIdx : 0;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [textureLoaded, setTextureLoaded] = useState<boolean>(false);
  const [showConeOfUncertainty, setShowConeOfUncertainty] = useState<boolean>(true);
  const [showWindField, setShowWindField] = useState<boolean>(true);
  const [showObstacleBarrier, setShowObstacleBarrier] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"lifecycle" | "wind" | "cone" | "obstacles">("lifecycle");

  // Opacity & Density controls (Defaults: soft, translucent, non-obstructive)
  const [notationOpacity, setNotationOpacity] = useState<number>(65); // 65% opacity
  const [layerOpacity, setLayerOpacity] = useState<number>(50); // 50% opacity
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState<boolean>(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(false);

  // References to dynamic opacity materials in Three.js scene
  const cycloneGroupRef = useRef<THREE.Group | null>(null);
  const badgeSpritesRef = useRef<THREE.Sprite[]>([]);
  const dynamicMatsRef = useRef<{
    r64Mat?: THREE.MeshBasicMaterial;
    r50Mat?: THREE.MeshBasicMaterial;
    r34Mat?: THREE.MeshBasicMaterial;
    windMat?: THREE.PointsMaterial;
    coneMat?: THREE.MeshBasicMaterial;
    cloudsMat?: THREE.MeshStandardMaterial;
    cycloneDiscMat?: THREE.MeshBasicMaterial;
  }>({});

  // Recompute stages when center or locationName changes
  useEffect(() => {
    const s = getLifecycleStages(center, locationName);
    setStages(s);
    const lfIdx = s.findIndex((st) => st.statusType === "landfall");
    setCurrentStageIdx(lfIdx >= 0 ? lfIdx : 0);
  }, [center.lat, center.lng, locationName]);

  const activeStage = stages[currentStageIdx] || stages[0];

  // Dynamically update Three.js object opacities when sliders change
  useEffect(() => {
    const nFactor = notationOpacity / 100;
    const lFactor = layerOpacity / 100;

    badgeSpritesRef.current.forEach((sp) => {
      sp.material.opacity = nFactor * 0.95;
    });

    const m = dynamicMatsRef.current;
    if (m.r64Mat) m.r64Mat.opacity = 0.55 * lFactor;
    if (m.r50Mat) m.r50Mat.opacity = 0.45 * lFactor;
    if (m.r34Mat) m.r34Mat.opacity = 0.35 * lFactor;
    if (m.windMat) m.windMat.opacity = 0.70 * lFactor;
    if (m.coneMat) m.coneMat.opacity = 0.28 * lFactor;
    if (m.cloudsMat) m.cloudsMat.opacity = 0.35 * lFactor;
    if (m.cycloneDiscMat) m.cycloneDiscMat.opacity = 0.55 * lFactor;
  }, [notationOpacity, layerOpacity]);

  // Camera smooth focus on target position
  const focusOnCoordinates = (lat: number, lng: number, distance = 190) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const globeRadius = 80;
    const pos = latLngToVector3(lat, lng, globeRadius);
    const targetCamPos = pos.clone().normalize().multiplyScalar(distance);

    const startPos = cameraRef.current.position.clone();
    const startTime = performance.now();
    const duration = 900;

    const animateCam = () => {
      const p = Math.min(1, (performance.now() - startTime) / duration);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      cameraRef.current?.position.lerpVectors(startPos, targetCamPos, ease);
      controlsRef.current?.target.set(0, 0, 0);
      controlsRef.current?.update();
      if (p < 1) requestAnimationFrame(animateCam);
    };
    animateCam();
  };

  const focusCurrentStage = () => {
    if (activeStage) {
      focusOnCoordinates(activeStage.lat, activeStage.lng, 195);
    }
  };

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#040812");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    cameraRef.current = camera;
    const globeRadius = 80;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 98;
    controls.maxDistance = 500;
    controls.target.set(0, 0, 0);
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 0.8;

    // Initial Camera View directly facing storm center
    const landfallStage = stages.find((s) => s.statusType === "landfall") || stages[0];
    const initialPos = latLngToVector3(landfallStage.lat, landfallStage.lng, globeRadius);
    const initialCamPos = initialPos.clone().normalize().multiplyScalar(195);
    camera.position.copy(initialCamPos);
    controls.update();

    // 4. Tactical 3D Earth Sphere
    const earthGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const fallbackTexture = createProceduralWorldTexture();
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: fallbackTexture,
      roughness: 0.65,
      metalness: 0.1,
    });

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/earth-blue-marble.jpg",
      (loadedTex: THREE.Texture) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        earthMaterial.map = loadedTex;
        earthMaterial.needsUpdate = true;
        setTextureLoaded(true);
      },
      undefined,
      (err: unknown) => {
        console.warn("[3D Globe] High-res texture loading error, keeping procedural vector fallback:", err);
      }
    );

    const globe = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(globe);

    // 5. Atmospheric Cloud Sphere with reduced opacity
    const cloudsGeometry = new THREE.SphereGeometry(globeRadius * 1.008, 64, 64);
    const cloudsMaterial = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dynamicMatsRef.current.cloudsMat = cloudsMaterial;

    textureLoader.load("/earth-clouds.png", (cloudTex: THREE.Texture) => {
      cloudsMaterial.map = cloudTex;
      cloudsMaterial.needsUpdate = true;
    });

    const clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    scene.add(clouds);

    // 6. Glowing Atmospheric Limb Halo Shader
    const atmosphereGeometry = new THREE.SphereGeometry(globeRadius * 1.045, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: [
        "varying vec3 vNormal;",
        "void main() {",
        "  vNormal = normalize(normalMatrix * normal);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vNormal;",
        "void main() {",
        "  float intensity = pow(0.60 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);",
        "  gl_FragColor = vec4(0.22, 0.74, 0.98, 1.0) * intensity;",
        "}",
      ].join("\n"),
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // 7. 3D Cyclone Vortex Placed at Active Stage Lat/Lng
    const cycloneGroup = new THREE.Group();
    cycloneGroupRef.current = cycloneGroup;
    scene.add(cycloneGroup);

    // 3D Spiral Cloud Disc with gentle translucency (compact scale)
    const cycloneDiscGeom = new THREE.PlaneGeometry(6.5, 6.5);
    const cycloneDiscMat = new THREE.MeshBasicMaterial({
      map: createCycloneCloudTexture(),
      transparent: true,
      opacity: 0.50,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    dynamicMatsRef.current.cycloneDiscMat = cycloneDiscMat;
    const cycloneDisc = new THREE.Mesh(cycloneDiscGeom, cycloneDiscMat);
    cycloneDisc.position.z = 0.5;
    cycloneGroup.add(cycloneDisc);

    // 3D Concentric Warning Radius Rings (Isotachs: R64, R50, R34) - Compact & Calibrated
    const r64Geom = new THREE.RingGeometry(1.6, 1.85, 48);
    const r64Mat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.40,
    });
    dynamicMatsRef.current.r64Mat = r64Mat;
    const r64Mesh = new THREE.Mesh(r64Geom, r64Mat);
    r64Mesh.position.z = 0.65;
    cycloneGroup.add(r64Mesh);

    const r50Geom = new THREE.RingGeometry(2.8, 3.05, 48);
    const r50Mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.30,
    });
    dynamicMatsRef.current.r50Mat = r50Mat;
    const r50Mesh = new THREE.Mesh(r50Geom, r50Mat);
    r50Mesh.position.z = 0.60;
    cycloneGroup.add(r50Mesh);

    const r34Geom = new THREE.RingGeometry(4.2, 4.45, 48);
    const r34Mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
    });
    dynamicMatsRef.current.r34Mat = r34Mat;
    const r34Mesh = new THREE.Mesh(r34Geom, r34Mat);
    r34Mesh.position.z = 0.55;
    cycloneGroup.add(r34Mesh);

    // Vertical Eyewall Column (Tropospheric Vortex - Compact)
    const eyeWallGeom = new THREE.CylinderGeometry(0.3, 0.7, 2.0, 24, 1, true);
    const eyeWallMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const eyeWall = new THREE.Mesh(eyeWallGeom, eyeWallMat);
    eyeWall.rotation.x = Math.PI / 2;
    eyeWall.position.z = 1.0;
    cycloneGroup.add(eyeWall);

    const updateCyclonePosition = (lat: number, lng: number, scaleMultiplier = 1.0) => {
      const pos = latLngToVector3(lat, lng, globeRadius);
      cycloneGroup.position.copy(pos);
      cycloneGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());
      cycloneGroup.scale.setScalar(scaleMultiplier);
    };

    updateCyclonePosition(activeStage.lat, activeStage.lng, 0.55 + (activeStage.windSpeedKph / 250) * 0.25);

    // 8. 3D Swirling Wind Speed Field (Particles spiraling into eyewall - Fine & Compact)
    const windParticleCount = 380;
    const windPositions = new Float32Array(windParticleCount * 3);
    const windColors = new Float32Array(windParticleCount * 3);
    const particleThetas = new Float32Array(windParticleCount);
    const particleRadii = new Float32Array(windParticleCount);
    const particleSpeeds = new Float32Array(windParticleCount);

    for (let i = 0; i < windParticleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.9 + Math.pow(Math.random(), 1.4) * 5.2;
      particleThetas[i] = theta;
      particleRadii[i] = r;
      particleSpeeds[i] = 0.025 + (1.0 / Math.max(1.0, r)) * 0.20;

      windPositions[i * 3] = r * Math.cos(theta);
      windPositions[i * 3 + 1] = r * Math.sin(theta);
      windPositions[i * 3 + 2] = 0.5 + Math.random() * 1.0;

      const c = new THREE.Color();
      if (r < 1.8) {
        c.set("#ef4444"); // Hurricane force (>64 kt)
      } else if (r < 3.2) {
        c.set("#f59e0b"); // Storm force (48-63 kt)
      } else {
        c.set("#38bdf8"); // Gale force (34-47 kt)
      }
      windColors[i * 3] = c.r;
      windColors[i * 3 + 1] = c.g;
      windColors[i * 3 + 2] = c.b;
    }

    const windGeo = new THREE.BufferGeometry();
    windGeo.setAttribute("position", new THREE.BufferAttribute(windPositions, 3));
    windGeo.setAttribute("color", new THREE.BufferAttribute(windColors, 3));

    const windMat = new THREE.PointsMaterial({
      size: 0.45,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dynamicMatsRef.current.windMat = windMat;
    const windParticlesMesh = new THREE.Points(windGeo, windMat);
    windParticlesMesh.visible = showWindField;
    cycloneGroup.add(windParticlesMesh);

    // 9. Multi-Stage Lifecycle Track Arc & Waypoint Spheres
    const trackPoints: THREE.Vector3[] = stages.map((st) =>
      latLngToVector3(st.lat, st.lng, globeRadius + 1.2)
    );

    const trackCurve = new THREE.CatmullRomCurve3(trackPoints);
    const trackTubeGeom = new THREE.TubeGeometry(trackCurve, 64, 0.40, 8, false);
    const trackTubeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.70,
    });
    const trackTube = new THREE.Mesh(trackTubeGeom, trackTubeMat);
    scene.add(trackTube);

    // Waypoint Markers & Non-Overlapping Translucent Badges
    const waypointGroup = new THREE.Group();
    scene.add(waypointGroup);
    badgeSpritesRef.current = [];

    stages.forEach((st) => {
      const pos = latLngToVector3(st.lat, st.lng, globeRadius + 1.2);
      const isGenesis = st.statusType === "genesis";
      const isLandfall = st.statusType === "landfall";

      const wpGeom = new THREE.SphereGeometry(isLandfall ? 0.9 : isGenesis ? 0.75 : 0.55, 16, 16);
      const wpMat = new THREE.MeshBasicMaterial({ color: st.color });
      const wpMesh = new THREE.Mesh(wpGeom, wpMat);
      wpMesh.position.copy(pos);
      waypointGroup.add(wpMesh);

      // Elevated beacon line
      const beaconLineGeom = new THREE.BufferGeometry().setFromPoints([
        pos,
        pos.clone().multiplyScalar(1.08),
      ]);
      const beaconLineMat = new THREE.LineBasicMaterial({
        color: st.color,
        transparent: true,
        opacity: 0.65,
        linewidth: 1.5,
      });
      const beaconLine = new THREE.Line(beaconLineGeom, beaconLineMat);
      waypointGroup.add(beaconLine);

      // 3D Canvas Badge Sprite with subtle background opacity (0.42)
      if (isGenesis) {
        const badgeSprite = createGlobeBadgeSprite(
          "ORIGIN GENESIS",
          `${st.lat.toFixed(1)}°N, ${st.lng.toFixed(1)}°E | ${st.windSpeedKph} km/h`,
          st.color,
          0.42,
          0.85
        );
        // Positioned slightly south/outward so it is clear and isolated
        badgeSprite.position.copy(pos.clone().multiplyScalar(1.09).add(new THREE.Vector3(0, -2.5, 0)));
        waypointGroup.add(badgeSprite);
        badgeSpritesRef.current.push(badgeSprite);

        // Genesis Thermal Ring on ocean surface
        const genRingGeom = new THREE.RingGeometry(2.5, 4.0, 32);
        const genRingMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.45,
        });
        const genRing = new THREE.Mesh(genRingGeom, genRingMat);
        genRing.position.copy(pos);
        genRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());
        waypointGroup.add(genRing);
      }

      if (isLandfall) {
        const badgeSprite = createGlobeBadgeSprite(
          "LANDFALL TARGET",
          `${st.lat.toFixed(1)}°N, ${st.lng.toFixed(1)}°E | ${st.windSpeedKph} km/h`,
          st.color,
          0.42,
          0.85
        );
        // Elevated with a northeast offset so it NEVER collides with obstacle barrier
        badgeSprite.position.copy(pos.clone().multiplyScalar(1.10).add(new THREE.Vector3(3.5, 3.0, 0)));
        waypointGroup.add(badgeSprite);
        badgeSpritesRef.current.push(badgeSprite);

        // Leader line to badge
        const badgeLeaderGeo = new THREE.BufferGeometry().setFromPoints([
          pos,
          badgeSprite.position,
        ]);
        const badgeLeaderMat = new THREE.LineBasicMaterial({
          color: st.color,
          transparent: true,
          opacity: 0.45,
        });
        waypointGroup.add(new THREE.Line(badgeLeaderGeo, badgeLeaderMat));
      }
    });

    // 10. 3D Expanding Cone of Uncertainty ("Where can it go")
    const coneGroup = new THREE.Group();
    scene.add(coneGroup);

    const landfallIdx = stages.findIndex((st) => st.statusType === "landfall");
    const forecastStages = landfallIdx >= 0 ? stages.slice(landfallIdx) : stages.slice(2);

    if (forecastStages.length >= 2) {
      const coneVertices: number[] = [];
      const coneIndices: number[] = [];

      for (let i = 0; i < forecastStages.length; i++) {
        const st = forecastStages[i];
        const centerPos = latLngToVector3(st.lat, st.lng, globeRadius + 0.8);
        const normal = centerPos.clone().normalize();

        let nextSt = forecastStages[i + 1] || forecastStages[i];
        let prevSt = forecastStages[i - 1] || forecastStages[i];
        const dir = latLngToVector3(nextSt.lat, nextSt.lng, globeRadius)
          .sub(latLngToVector3(prevSt.lat, prevSt.lng, globeRadius))
          .normalize();

        const lateral = new THREE.Vector3().crossVectors(normal, dir).normalize();
        const lateralOffset = (st.coneRadiusKm / 111.0) * 1.35;

        const leftPos = centerPos.clone().add(lateral.clone().multiplyScalar(lateralOffset));
        const rightPos = centerPos.clone().add(lateral.clone().multiplyScalar(-lateralOffset));

        coneVertices.push(leftPos.x, leftPos.y, leftPos.z);
        coneVertices.push(rightPos.x, rightPos.y, rightPos.z);

        if (i < forecastStages.length - 1) {
          const base = i * 2;
          coneIndices.push(base, base + 1, base + 2);
          coneIndices.push(base + 1, base + 3, base + 2);
        }
      }

      const coneGeo = new THREE.BufferGeometry();
      coneGeo.setAttribute("position", new THREE.Float32BufferAttribute(coneVertices, 3));
      coneGeo.setIndex(coneIndices);
      coneGeo.computeVertexNormals();

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18, // Reduced opacity so underlying geography is clearly visible
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      dynamicMatsRef.current.coneMat = coneMat;
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneGroup.add(coneMesh);

      const leftLinePts: THREE.Vector3[] = [];
      const rightLinePts: THREE.Vector3[] = [];
      for (let i = 0; i < coneVertices.length / 3; i += 2) {
        leftLinePts.push(new THREE.Vector3(coneVertices[i * 3], coneVertices[i * 3 + 1], coneVertices[i * 3 + 2]));
        rightLinePts.push(new THREE.Vector3(coneVertices[(i + 1) * 3], coneVertices[(i + 1) * 3 + 1], coneVertices[(i + 1) * 3 + 2]));
      }

      const leftLineGeo = new THREE.BufferGeometry().setFromPoints(leftLinePts);
      const rightLineGeo = new THREE.BufferGeometry().setFromPoints(rightLinePts);
      const coneLineMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.65 });

      coneGroup.add(new THREE.Line(leftLineGeo, coneLineMat));
      coneGroup.add(new THREE.Line(rightLineGeo, coneLineMat));
    }
    coneGroup.visible = showConeOfUncertainty;

    // 11. 3D Obstacle Boundary Layer Transition Ribbon (Coastline Roughness Barrier)
    const obstacleGroup = new THREE.Group();
    scene.add(obstacleGroup);

    const lfStage = stages.find((st) => st.statusType === "landfall") || stages[0];
    const lfPos = latLngToVector3(lfStage.lat, lfStage.lng, globeRadius + 0.4);

    const ribbonPoints: THREE.Vector3[] = [];
    const ribbonSegments = 16;
    for (let i = -ribbonSegments / 2; i <= ribbonSegments / 2; i++) {
      const angle = (i / ribbonSegments) * 0.45;
      const offsetLat = lfStage.lat + Math.sin(angle) * 2.5;
      const offsetLng = lfStage.lng + Math.cos(angle) * 3.5;
      ribbonPoints.push(latLngToVector3(offsetLat, offsetLng, globeRadius + 0.6));
    }

    const ribbonGeo = new THREE.BufferGeometry().setFromPoints(ribbonPoints);
    const ribbonMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 2.5,
      transparent: true,
      opacity: 0.75,
    });
    const ribbonLine = new THREE.Line(ribbonGeo, ribbonMat);
    obstacleGroup.add(ribbonLine);

    // Upward Kinetic Deflection Vector Arrows
    [-1.2, 0, 1.2].forEach((offset) => {
      const arrowBase = latLngToVector3(lfStage.lat + offset * 0.8, lfStage.lng + offset * 0.5, globeRadius + 0.8);
      const arrowDir = arrowBase.clone().normalize();
      const arrowHelper = new THREE.ArrowHelper(arrowDir, arrowBase, 4.0, 0xef4444, 1.2, 0.6);
      obstacleGroup.add(arrowHelper);
    });

    // Obstacle Barrier Badge placed distinctly NORTHWEST along the coastline
    // This prevents any collision or overlapping with the Landfall Target badge!
    const obsPos = latLngToVector3(lfStage.lat + 2.0, lfStage.lng - 3.8, globeRadius * 1.10);
    const obstacleBadge = createGlobeBadgeSprite(
      "COASTAL OBSTACLE BARRIER",
      "Roughness Jump: z0 0.0002m -> 0.85m | Deceleration: -42%",
      "#f59e0b",
      0.40,
      0.85
    );
    obstacleBadge.position.copy(obsPos);
    obstacleGroup.add(obstacleBadge);
    badgeSpritesRef.current.push(obstacleBadge);

    // Leader line connecting barrier to its badge
    const obsGroundPos = latLngToVector3(lfStage.lat + 1.2, lfStage.lng - 2.0, globeRadius + 0.6);
    const obsLeaderGeo = new THREE.BufferGeometry().setFromPoints([obsGroundPos, obsPos]);
    const obsLeaderMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.40,
    });
    obstacleGroup.add(new THREE.Line(obsLeaderGeo, obsLeaderMat));
    obstacleGroup.visible = showObstacleBarrier;

    // 12. Balanced Planetary Lighting
    const sunLight1 = new THREE.DirectionalLight(0xffffff, 2.6);
    sunLight1.position.copy(initialPos.clone().multiplyScalar(3.2).add(new THREE.Vector3(50, 80, 30)));
    scene.add(sunLight1);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.6);
    fillLight.position.copy(initialPos.clone().multiplyScalar(-3.0).add(new THREE.Vector3(-50, -80, -30)));
    scene.add(fillLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    // 13. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      cycloneDisc.rotation.z += 0.035;
      eyeWall.rotation.y += 0.04;

      // Pulse warning rings gently
      r64Mesh.scale.setScalar(1 + 0.030 * Math.sin(elapsed * 4));
      r50Mesh.scale.setScalar(1 + 0.022 * Math.cos(elapsed * 3.5));
      r34Mesh.scale.setScalar(1 + 0.018 * Math.sin(elapsed * 3));

      // Swirling Wind Streamline Particle Dynamics
      if (windParticlesMesh.visible) {
        const pArr = windGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < windParticleCount; i++) {
          particleThetas[i] += particleSpeeds[i];
          particleRadii[i] -= 0.018;

          if (particleRadii[i] < 0.7) {
            particleRadii[i] = 5.2 + Math.random() * 1.2;
            particleThetas[i] = Math.random() * Math.PI * 2;
          }

          const r = particleRadii[i];
          const theta = particleThetas[i];
          pArr[i * 3] = r * Math.cos(theta);
          pArr[i * 3 + 1] = r * Math.sin(theta);
        }
        windGeo.attributes.position.needsUpdate = true;
      }

      clouds.rotation.y += 0.0003;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(container);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      cycloneGroupRef.current = null;
    };
  }, [stages]);

  // Smoothly move the 3D Cyclone Vortex across the planetary sphere surface whenever stage changes or plays
  useEffect(() => {
    if (!stages[currentStageIdx] || !cycloneGroupRef.current) return;
    const stage = stages[currentStageIdx];
    const globeRadius = 80;
    const targetPos = latLngToVector3(stage.lat, stage.lng, globeRadius);
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      targetPos.clone().normalize()
    );
    const targetScale = 0.55 + (stage.windSpeedKph / 250) * 0.25;

    const grp = cycloneGroupRef.current;
    const startPos = grp.position.clone();
    const startQuat = grp.quaternion.clone();
    const startScale = grp.scale.x;

    const startTime = performance.now();
    const duration = isPlaying ? Math.round(1500 / playbackSpeed) : 750;

    let animId: number;
    const animateGlide = () => {
      const elapsed = performance.now() - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

      grp.position.lerpVectors(startPos, targetPos, ease);
      grp.quaternion.slerpQuaternions(startQuat, targetQuat, ease);
      const s = THREE.MathUtils.lerp(startScale, targetScale, ease);
      grp.scale.setScalar(s);

      if (p < 1) {
        animId = requestAnimationFrame(animateGlide);
      }
    };
    animateGlide();

    // Camera smoothly glides to track active storm eye
    focusOnCoordinates(stage.lat, stage.lng, isPlaying ? 200 : 190);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentStageIdx, stages, playbackSpeed, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.round(2800 / playbackSpeed);
    const interval = setInterval(() => {
      setCurrentStageIdx((prev) => {
        if (prev >= stages.length - 1) {
          setIsPlaying(false);
          return 0; // loop back to genesis when finished
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [isPlaying, stages.length, playbackSpeed]);

  return (
    <div
      className="globe-3d-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "640px",
        overflow: "hidden",
        background: "#040812",
      }}
    >
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* TOP LEFT: Lifecycle Control & Presets Deck */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          background: "rgba(6, 12, 22, 0.78)", // Reduced opacity glassmorphism
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "12px",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: "0.78rem",
          color: "#ffffff",
          maxWidth: "380px",
          zIndex: 1100,
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
          transition: "all 0.2s ease-in-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.04em" }}>
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 10px #10b981",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "0.74rem" }}>3D PLANETARY SIMULATION</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="badge badge-info" style={{ fontSize: "0.62rem", padding: "1px 6px" }}>
              {textureLoaded ? "NASA MARBLE" : "VECTOR"}
            </span>
            <button
              type="button"
              className="dock-btn"
              style={{ fontSize: "0.65rem", padding: "1px 6px", border: "1px solid rgba(255, 255, 255, 0.2)" }}
              onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
              title={isLeftPanelCollapsed ? "Expand Control Deck" : "Minimize Deck for Unobstructed View"}
            >
              {isLeftPanelCollapsed ? "▼" : "▲"}
            </button>
          </div>
        </div>

        {!isLeftPanelCollapsed && (
          <>
            {/* Historical Presets Quick Switch */}
            {onSelectPreset && (
              <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Presets:</span>
                <button
                  type="button"
                  className="dock-btn"
                  style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                  onClick={() => onSelectPreset("nisarga")}
                  title="Cyclone Nisarga Landfall - Maharashtra Coast (Arabian Sea 2020)"
                >
                  🌊 Nisarga (MH)
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                  onClick={() => onSelectPreset("biparjoy")}
                  title="Cyclone Biparjoy Landfall - Gujarat Coast (Arabian Sea 2023)"
                >
                  🌊 Biparjoy (GJ)
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                  onClick={() => onSelectPreset("dana")}
                  title="Cyclone Dana Landfall - Odisha Coast (Bay of Bengal 2024)"
                >
                  🌀 Dana (OD)
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                  onClick={() => onSelectPreset("amphan")}
                  title="Cyclone Amphan Landfall - Digha / WB (Bay of Bengal 2020)"
                >
                  🌀 Amphan (WB)
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                  onClick={() => onSelectPreset("fani")}
                  title="Cyclone Fani Landfall - Puri / Odisha (Bay of Bengal 2019)"
                >
                  🌀 Fani (OD)
                </button>
                <button
                  type="button"
                  className="dock-btn"
                  style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                  onClick={() => onSelectPreset("hudhud")}
                  title="Cyclone Hudhud Landfall - Visakhapatnam / AP (Bay of Bengal 2014)"
                >
                  🌀 Hudhud (AP)
                </button>
              </div>
            )}

            {/* Active Stage Timeline Info */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.55)",
                border: `1px solid ${activeStage.color}44`,
                borderRadius: "8px",
                padding: "7px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: activeStage.color, fontSize: "0.78rem" }}>
                  {activeStage.label}
                </strong>
                <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{activeStage.dateStr}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#cbd5e1", lineHeight: 1.35 }}>
                {activeStage.description}
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "2px", fontSize: "0.70rem", color: "#94a3b8" }}>
                <div>Eye: <strong style={{ color: "#ffffff" }}>{activeStage.lat.toFixed(2)}°N, {activeStage.lng.toFixed(2)}°E</strong></div>
                <div>Winds: <strong style={{ color: activeStage.color }}>{activeStage.windSpeedKph} km/h</strong></div>
                <div>Pressure: <strong style={{ color: "#ffffff" }}>{activeStage.pressureHpa} hPa</strong></div>
              </div>
            </div>

            {/* Timeline Scrubber */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "#94a3b8" }}>
                <span>Genesis (-96h)</span>
                <span>Intensify</span>
                <span>Landfall (0h)</span>
                <span>Dissipate (+24h)</span>
              </div>
              <input
                type="range"
                min="0"
                max={stages.length - 1}
                value={currentStageIdx}
                onChange={(e) => setCurrentStageIdx(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: activeStage.color,
                  cursor: "pointer",
                }}
              />
            </div>

            {/* NOTATION & LAYER OPACITY ADJUSTER SLIDERS */}
            <div
              style={{
                background: "rgba(10, 18, 30, 0.65)",
                border: "1px solid rgba(56, 189, 248, 0.18)",
                borderRadius: "8px",
                padding: "6px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.68rem", color: "#38bdf8", fontWeight: 700 }}>
                  🏷️ Notation Transparency:
                </span>
                <span style={{ fontSize: "0.68rem", color: "#ffffff", fontWeight: 800 }}>
                  {notationOpacity}%
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="100"
                value={notationOpacity}
                onChange={(e) => setNotationOpacity(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer", height: "4px" }}
                title="Slide left to make labels/notations more translucent"
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                  🌀 Wind & Cloud Opacity:
                </span>
                <span style={{ fontSize: "0.68rem", color: "#ffffff", fontWeight: 800 }}>
                  {layerOpacity}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={layerOpacity}
                onChange={(e) => setLayerOpacity(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#f59e0b", cursor: "pointer", height: "4px" }}
                title="Slide left to make winds and rings less obtrusive"
              />
            </div>

            {/* Timeline Action Buttons */}
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="dock-btn"
                style={{
                  fontSize: "0.70rem",
                  padding: "4px 8px",
                  background: isPlaying ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                  borderColor: isPlaying ? "#ef4444" : "#10b981",
                  color: isPlaying ? "#ef4444" : "#10b981",
                  fontWeight: 700,
                }}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? "⏸ Pause Timeline" : "▶ Play Lifecycle"}
              </button>
              <button
                type="button"
                className="dock-btn"
                style={{ fontSize: "0.70rem", padding: "4px 8px" }}
                onClick={focusCurrentStage}
              >
                🎯 Focus Eye
              </button>
              <button
                type="button"
                className="dock-btn"
                style={{ fontSize: "0.70rem", padding: "4px 8px" }}
                onClick={() => setIsAutoRotating(!isAutoRotating)}
              >
                {isAutoRotating ? "⏸ Stop Spin" : "🌐 Auto Spin"}
              </button>
              {onExit3DGlobe && (
                <button
                  type="button"
                  className="dock-btn active"
                  style={{
                    fontSize: "0.70rem",
                    padding: "4px 9px",
                    background: "var(--accent-cyan)",
                    color: "#050b14",
                    fontWeight: 800,
                  }}
                  onClick={onExit3DGlobe}
                >
                  Back to Tactical Map &rarr;
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* TOP RIGHT: Analysis HUD Tabs & Diagnostics Deck with minimize toggle */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          background: "rgba(6, 12, 22, 0.78)", // Reduced opacity glassmorphism
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "12px",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: "0.78rem",
          color: "#ffffff",
          width: isRightPanelCollapsed ? "auto" : "350px",
          maxHeight: "85vh",
          overflowY: "auto",
          zIndex: 1100,
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
          transition: "all 0.2s ease-in-out",
        }}
      >
        {/* Navigation Tabs & Minimize Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "5px", gap: "4px" }}>
          {!isRightPanelCollapsed ? (
            <div style={{ display: "flex", gap: "3px", flex: 1 }}>
              <button
                type="button"
                className={`dock-btn ${activeTab === "lifecycle" ? "active" : ""}`}
                style={{ fontSize: "0.66rem", padding: "3px 6px", flex: 1 }}
                onClick={() => setActiveTab("lifecycle")}
              >
                Origin
              </button>
              <button
                type="button"
                className={`dock-btn ${activeTab === "wind" ? "active" : ""}`}
                style={{ fontSize: "0.66rem", padding: "3px 6px", flex: 1 }}
                onClick={() => setActiveTab("wind")}
              >
                Winds
              </button>
              <button
                type="button"
                className={`dock-btn ${activeTab === "cone" ? "active" : ""}`}
                style={{ fontSize: "0.66rem", padding: "3px 6px", flex: 1 }}
                onClick={() => setActiveTab("cone")}
              >
                Forecast
              </button>
              <button
                type="button"
                className={`dock-btn ${activeTab === "obstacles" ? "active" : ""}`}
                style={{ fontSize: "0.66rem", padding: "3px 6px", flex: 1 }}
                onClick={() => setActiveTab("obstacles")}
              >
                Obstacles
              </button>
            </div>
          ) : (
            <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700 }}>Diagnostics Panel</span>
          )}

          <button
            type="button"
            className="dock-btn"
            style={{ fontSize: "0.65rem", padding: "2px 6px", border: "1px solid rgba(255, 255, 255, 0.2)" }}
            onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
            title={isRightPanelCollapsed ? "Expand Diagnostics" : "Minimize to Unblock Map"}
          >
            {isRightPanelCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        {!isRightPanelCollapsed && (
          <>
            {/* TAB 1: ORIGIN & GENESIS THERMAL ENERGY */}
            {activeTab === "lifecycle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.78rem" }}>
                  🌀 TROPICAL CYCLOGENESIS ORIGIN
                </div>
                <div style={{ fontSize: "0.73rem", color: "#cbd5e1", lineHeight: 1.35 }}>
                  The cyclone originated in deep tropical equatorial waters where high sea surface temperatures provided massive thermodynamic latent heat.
                </div>

                <div style={{ background: "rgba(15, 23, 42, 0.65)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.18)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>Genesis Ocean SST:</span>
                    <strong style={{ color: "#ef4444" }}>{stages[0]?.sstC || 31.2}°C (&gt;26.5°C)</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>Genesis Coordinates:</span>
                    <strong style={{ color: "#38bdf8" }}>{stages[0]?.lat.toFixed(1)}°N, {stages[0]?.lng.toFixed(1)}°E</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>Ocean Heat Content (OHC):</span>
                    <strong style={{ color: "#f59e0b" }}>&gt; 95 kJ/cm² (Extreme)</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Coriolis Parameter f:</span>
                    <strong style={{ color: "#ffffff" }}>2.48 × 10⁻⁵ s⁻¹</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="dock-btn"
                  style={{ fontSize: "0.70rem", padding: "5px", background: "rgba(56, 189, 248, 0.15)", borderColor: "#38bdf8", color: "#38bdf8" }}
                  onClick={() => {
                    setCurrentStageIdx(0);
                    focusOnCoordinates(stages[0].lat, stages[0].lng, 185);
                  }}
                >
                  🔍 Fly to Tropical Genesis Point
                </button>
              </div>
            )}

            {/* TAB 2: WIND SPEED ISOTACHS */}
            {activeTab === "wind" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: "0.78rem" }}>
                  💨 3D SWIRLING WIND SPEED FIELD
                </div>
                <div style={{ fontSize: "0.73rem", color: "#cbd5e1", lineHeight: 1.35 }}>
                  Dynamic particle streamlines spiral counter-clockwise into the central eye, color-coded by IMD wind velocity thresholds.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ background: "rgba(239, 68, 68, 0.12)", borderLeft: "3px solid #ef4444", padding: "5px 7px", borderRadius: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ color: "#ef4444" }}>R64 (Hurricane Force Core)</strong>
                      <span>&gt; 118 km/h</span>
                    </div>
                    <span style={{ fontSize: "0.66rem", color: "#94a3b8" }}>Radius: 35 km from Eye</span>
                  </div>

                  <div style={{ background: "rgba(245, 158, 11, 0.12)", borderLeft: "3px solid #f59e0b", padding: "5px 7px", borderRadius: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ color: "#f59e0b" }}>R50 (Storm Force Band)</strong>
                      <span>89 - 117 km/h</span>
                    </div>
                    <span style={{ fontSize: "0.66rem", color: "#94a3b8" }}>Radius: 85 km</span>
                  </div>

                  <div style={{ background: "rgba(56, 189, 248, 0.12)", borderLeft: "3px solid #38bdf8", padding: "5px 7px", borderRadius: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ color: "#38bdf8" }}>R34 (Gale Force Outer Extent)</strong>
                      <span>63 - 88 km/h</span>
                    </div>
                    <span style={{ fontSize: "0.66rem", color: "#94a3b8" }}>Radius: 180 km</span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px" }}>
                  <span style={{ fontSize: "0.70rem", color: "#94a3b8" }}>Toggle Wind Streamlines:</span>
                  <button
                    type="button"
                    className="dock-btn"
                    style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                    onClick={() => setShowWindField(!showWindField)}
                  >
                    {showWindField ? "Visible (On)" : "Hidden (Off)"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: CONE OF UNCERTAINTY */}
            {activeTab === "cone" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.78rem" }}>
                  🎯 FORECAST PATH & CONE OF UNCERTAINTY
                </div>
                <div style={{ fontSize: "0.73rem", color: "#cbd5e1", lineHeight: 1.35 }}>
                  The 3D expanding envelope displays the geographical spread of probable storm eye positions across the next 24 to 48 hours.
                </div>

                <div style={{ background: "rgba(15, 23, 42, 0.65)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(56, 189, 248, 0.18)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>+6h Forecast Spread:</span>
                    <strong style={{ color: "#ffffff" }}>± 35 km margin</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>+12h Forecast Spread:</span>
                    <strong style={{ color: "#ffffff" }}>± 80 km margin</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>+24h Forecast Spread:</span>
                    <strong style={{ color: "#ffffff" }}>± 160 km margin</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Steering Flow:</span>
                    <strong style={{ color: "#38bdf8" }}>500 hPa Ridge Crest</strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px" }}>
                  <span style={{ fontSize: "0.70rem", color: "#94a3b8" }}>Toggle 3D Cone:</span>
                  <button
                    type="button"
                    className="dock-btn"
                    style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                    onClick={() => setShowConeOfUncertainty(!showConeOfUncertainty)}
                  >
                    {showConeOfUncertainty ? "Visible (On)" : "Hidden (Off)"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: OBSTACLE PROCESS & DISSIPATION */}
            {activeTab === "obstacles" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: "0.78rem" }}>
                  🏔 COASTAL OBSTACLE & GROUND FRICTION
                </div>
                <div style={{ fontSize: "0.73rem", color: "#cbd5e1", lineHeight: 1.35 }}>
                  When the cyclone crosses from water to land, terrain obstacles, seawalls, dune embankments, and dense urban buildings trigger rapid aerodynamic dissipation.
                </div>

                <div style={{ background: "rgba(15, 23, 42, 0.65)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>Ocean Roughness z₀:</span>
                    <strong style={{ color: "#38bdf8" }}>0.0002 m</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>Terrestrial Roughness z₀:</span>
                    <strong style={{ color: "#f59e0b" }}>0.85 m</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "#94a3b8" }}>Kinetic Drag Loss:</span>
                    <strong style={{ color: "#ef4444" }}>-42% in 60 km</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Vertical Deflection:</span>
                    <strong style={{ color: "#ffffff" }}>+18m updraft</strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "3px" }}>
                  <span style={{ fontSize: "0.70rem", color: "#94a3b8" }}>Toggle Obstacle Barrier:</span>
                  <button
                    type="button"
                    className="dock-btn"
                    style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                    onClick={() => setShowObstacleBarrier(!showObstacleBarrier)}
                  >
                    {showObstacleBarrier ? "Visible (On)" : "Hidden (Off)"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* BOTTOM CENTER: Main Trajectory Movement & Playback Deck */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(6, 12, 22, 0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          borderRadius: "16px",
          padding: "10px 18px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.7)",
          zIndex: 1100,
          maxWidth: "92vw",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* Play/Pause Button */}
        <button
          type="button"
          className="dock-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.82rem",
            padding: "6px 14px",
            background: isPlaying ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)",
            borderColor: isPlaying ? "#ef4444" : "#10b981",
            color: isPlaying ? "#ef4444" : "#10b981",
            fontWeight: 800,
            borderRadius: "10px",
            boxShadow: isPlaying ? "0 0 12px rgba(239,68,68,0.4)" : "0 0 12px rgba(16,185,129,0.4)",
          }}
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? "Pause Cyclone Simulation Movement" : "Play Full Movement from Water/Genesis to Landfall & Dissipation"}
        >
          <span style={{ fontSize: "1rem" }}>{isPlaying ? "⏸" : "▶"}</span>
          <span>{isPlaying ? "PAUSE" : "PLAY MOVEMENT"}</span>
        </button>

        {/* Step Prev & Next */}
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className="dock-btn"
            style={{ fontSize: "0.74rem", padding: "5px 8px" }}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStageIdx((prev) => Math.max(0, prev - 1));
            }}
            title="Previous Stage"
          >
            ⏮
          </button>
          <button
            type="button"
            className="dock-btn"
            style={{ fontSize: "0.74rem", padding: "5px 8px" }}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStageIdx((prev) => Math.min(stages.length - 1, prev + 1));
            }}
            title="Next Stage"
          >
            ⏭
          </button>
        </div>

        {/* Timeline Stages Chips */}
        <div style={{ display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" }}>
          {stages.map((st, idx) => {
            const isActive = currentStageIdx === idx;
            return (
              <button
                key={st.id}
                type="button"
                className="dock-btn"
                style={{
                  fontSize: "0.70rem",
                  padding: "4px 8px",
                  background: isActive ? `${st.color}33` : "rgba(15, 23, 42, 0.6)",
                  borderColor: isActive ? st.color : "rgba(255, 255, 255, 0.12)",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  fontWeight: isActive ? 800 : 500,
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => {
                  setCurrentStageIdx(idx);
                  setIsPlaying(false);
                }}
                title={st.description}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: st.color,
                    display: "inline-block",
                  }}
                />
                <span>
                  {st.statusType === "genesis"
                    ? "Genesis"
                    : st.statusType === "intensification"
                    ? "Intensify"
                    : st.statusType === "landfall"
                    ? "Landfall"
                    : st.statusType === "inland"
                    ? "Inland"
                    : "Dissipate"}
                </span>
                <span style={{ fontSize: "0.62rem", opacity: 0.8 }}>
                  ({st.timeOffsetHours > 0 ? `+${st.timeOffsetHours}h` : `${st.timeOffsetHours}h`})
                </span>
              </button>
            );
          })}
        </div>

        {/* Playback Speed Controls */}
        <div style={{ display: "flex", gap: "3px", alignItems: "center", borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: "10px" }}>
          <span style={{ fontSize: "0.66rem", color: "#94a3b8" }}>Speed:</span>
          {([1, 2, 4] as const).map((spd) => (
            <button
              key={spd}
              type="button"
              className="dock-btn"
              style={{
                fontSize: "0.66rem",
                padding: "2px 6px",
                background: playbackSpeed === spd ? "var(--accent-cyan)" : "transparent",
                color: playbackSpeed === spd ? "#050b14" : "#94a3b8",
                fontWeight: playbackSpeed === spd ? 800 : 600,
              }}
              onClick={() => setPlaybackSpeed(spd)}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Focus Target Button */}
        <button
          type="button"
          className="dock-btn"
          style={{ fontSize: "0.72rem", padding: "5px 10px", borderColor: "#38bdf8", color: "#38bdf8" }}
          onClick={focusCurrentStage}
          title="Recenter Camera on Active Eye Position"
        >
          🎯 Recenter Eye
        </button>
      </div>
    </div>
  );
}
