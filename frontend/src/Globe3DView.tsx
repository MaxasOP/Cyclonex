import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

interface Globe3DViewProps {
  center: { lat: number; lng: number };
  trajectory?: { lat: number; lng: number; label: string }[];
  headingDeg?: number;
  speedKph?: number;
  onExit3DGlobe?: () => void;
}

// Convert Geographical Lat/Lng into 3D Vector3 Cartesian Coordinates on a Sphere
// In Three.js SphereGeometry with equirectangular UV mapping:
// y = radius * sin(lat)
// x = radius * cos(lat) * cos(lng)
// z = -radius * cos(lat) * sin(lng)
// This accurately matches NASA Blue Marble / Equirectangular texture projection
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

  // Major continental polygons
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
    [72.5, 21], [68, 24]
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

  // Clear transparent
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Outer radial gradient glow
  const radialGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 240);
  radialGlow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  radialGlow.addColorStop(0.2, "rgba(255, 107, 91, 0.85)");
  radialGlow.addColorStop(0.5, "rgba(245, 158, 11, 0.65)");
  radialGlow.addColorStop(0.8, "rgba(56, 189, 248, 0.35)");
  radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = radialGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.fill();

  // Spiral Cloud Rainbands
  ctx.lineWidth = 14;
  ctx.lineCap = "round";

  for (let arm = 0; arm < 4; arm++) {
    const baseAngle = (arm * Math.PI) / 2;
    ctx.strokeStyle = arm % 2 === 0 ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 150, 130, 0.75)";
    ctx.beginPath();
    for (let t = 0; t < 120; t++) {
      const angle = baseAngle + t * 0.05;
      const r = 25 + t * 1.8;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Clear Central Eye
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Red Eye Rim
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

export default function Globe3DView({
  center,
  trajectory = [],
  headingDeg = 315,
  speedKph = 25,
  onExit3DGlobe,
}: Globe3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [textureLoaded, setTextureLoaded] = useState(false);

  // Focus directly on the cyclone eye
  const focusOnCyclone = () => {
    if (!controlsRef.current) return;
    const globeRadius = 80;
    const eyePos = latLngToVector3(center.lat, center.lng, globeRadius);
    const cameraDistance = 195;
    const targetCamPos = eyePos.clone().normalize().multiplyScalar(cameraDistance);

    controlsRef.current.object.position.copy(targetCamPos);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    // 1. Scene, Camera, and Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#040812");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    const globeRadius = 80;
    camera.position.set(0, 80, 215);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. Smooth OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 100;
    controls.maxDistance = 500;
    controls.target.set(0, 0, 0);
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 0.8;
    controls.update();

    // 3. Tactical 3D Earth Sphere
    const earthGeometry = new THREE.SphereGeometry(globeRadius, 64, 64);

    // High-resolution NASA Blue Marble texture with immediate vector fallback
    const textureLoader = new THREE.TextureLoader();
    const fallbackTexture = createProceduralWorldTexture();

    // Start with fallback canvas texture immediately so globe is NEVER pitch-black on initial frame
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: fallbackTexture,
      roughness: 0.65,
      metalness: 0.1,
    });

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

    // 4. Rotating Atmospheric Cloud Sphere
    const cloudsGeometry = new THREE.SphereGeometry(globeRadius * 1.008, 64, 64);
    const cloudsMaterial = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    textureLoader.load("/earth-clouds.png", (cloudTex: THREE.Texture) => {
      cloudsMaterial.map = cloudTex;
      cloudsMaterial.needsUpdate = true;
    });

    const clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    scene.add(clouds);

    // 5. Glowing Atmospheric Limb Halo Shader
    const atmosphereGeometry = new THREE.SphereGeometry(globeRadius * 1.045, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.22, 0.74, 0.98, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // 6. 3D Cyclone Vortex Placed at Exact Geographical Lat/Lng Coordinates
    const eyePos = latLngToVector3(center.lat, center.lng, globeRadius);
    const normal = eyePos.clone().normalize();

    const cycloneGroup = new THREE.Group();
    cycloneGroup.position.copy(eyePos);
    // Orient vortex flat against the surface of the globe
    cycloneGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    // 3D Spiral Cloud Disc
    const cycloneDiscGeom = new THREE.PlaneGeometry(28, 28);
    const cycloneDiscMat = new THREE.MeshBasicMaterial({
      map: createCycloneCloudTexture(),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cycloneDisc = new THREE.Mesh(cycloneDiscGeom, cycloneDiscMat);
    cycloneDisc.position.z = 1.2; // Hover slightly above ocean surface
    cycloneGroup.add(cycloneDisc);

    // 3D Concentric Warning Radius Rings
    const r64Geom = new THREE.RingGeometry(8.5, 9.2, 48);
    const r64Mat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const r64Mesh = new THREE.Mesh(r64Geom, r64Mat);
    r64Mesh.position.z = 1.4;
    cycloneGroup.add(r64Mesh);

    const r34Geom = new THREE.RingGeometry(14.5, 15.2, 48);
    const r34Mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const r34Mesh = new THREE.Mesh(r34Geom, r34Mat);
    r34Mesh.position.z = 1.3;
    cycloneGroup.add(r34Mesh);

    // Vertical 3D Eye Wall Cylinder (Tropospheric Column)
    const eyeWallGeom = new THREE.CylinderGeometry(1.2, 2.8, 7, 24, 1, true);
    const eyeWallMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const eyeWall = new THREE.Mesh(eyeWallGeom, eyeWallMat);
    eyeWall.rotation.x = Math.PI / 2;
    eyeWall.position.z = 3.5;
    cycloneGroup.add(eyeWall);

    scene.add(cycloneGroup);

    // 7. 3D Curved Forecast Trajectory Spline Arc Rising Off Planet Surface
    if (trajectory && trajectory.length > 0) {
      const arcPoints: THREE.Vector3[] = [eyePos];
      trajectory.forEach((pt) => {
        arcPoints.push(latLngToVector3(pt.lat, pt.lng, globeRadius + 1.2));
      });

      const curve = new THREE.CatmullRomCurve3(arcPoints);
      const tubeGeom = new THREE.TubeGeometry(curve, 48, 0.45, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
      });
      const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
      scene.add(tubeMesh);

      // Trajectory Waypoint Spheres
      trajectory.forEach((pt) => {
        const wpPos = latLngToVector3(pt.lat, pt.lng, globeRadius + 1.2);
        const wpGeom = new THREE.SphereGeometry(1.2, 16, 16);
        const wpMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const wpMesh = new THREE.Mesh(wpGeom, wpMat);
        wpMesh.position.copy(wpPos);
        scene.add(wpMesh);
      });
    }

    // 8. Balanced 3-Point Planetary Lighting (Zero dark shadows)
    const sunLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
    // Position main sunlight in front of the storm and India
    sunLight1.position.copy(normal.clone().multiplyScalar(280).add(new THREE.Vector3(60, 100, 40)));
    scene.add(sunLight1);

    const sunLight2 = new THREE.DirectionalLight(0x7dd3fc, 1.8);
    sunLight2.position.copy(normal.clone().multiplyScalar(-260).add(new THREE.Vector3(-60, -100, -40)));
    scene.add(sunLight2);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    // 9. Initial Camera Alignment: Focus Camera Directly on Cyclone Center
    const cameraDistance = 195;
    const initialCamPos = normal.clone().multiplyScalar(cameraDistance);
    camera.position.copy(initialCamPos);
    controls.target.set(0, 0, 0);
    controls.update();

    // 10. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate storm vortex disc counter-clockwise (Northern Hemisphere cyclonic rotation)
      cycloneDisc.rotation.z += 0.035;
      eyeWall.rotation.y += 0.04;

      // Pulse the warning rings
      const time = Date.now() * 0.003;
      r64Mesh.scale.setScalar(1 + 0.04 * Math.sin(time));
      r34Mesh.scale.setScalar(1 + 0.03 * Math.cos(time));

      // Slow realistic atmospheric cloud drift
      clouds.rotation.y += 0.0003;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 620;
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
    };
  }, [center.lat, center.lng, (trajectory || []).map((t) => `${t.lat.toFixed(3)},${t.lng.toFixed(3)}`).join("|"), headingDeg, speedKph]);

  // Update controls auto-rotate when state changes
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
    }
  }, [isAutoRotating]);

  return (
    <div
      className="globe-3d-container"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "620px",
        overflow: "hidden",
        background: "#040812",
      }}
    >
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* 3D Globe HUD Telemetry Badge (Top Left) */}
      <div
        className="globe-hud-overlay"
        style={{
          position: "absolute",
          top: "68px",
          left: "16px",
          background: "rgba(6, 12, 22, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.28)",
          borderRadius: "10px",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          fontSize: "0.78rem",
          color: "#ffffff",
          pointerEvents: "auto",
          zIndex: 1100,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
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
            <span>3D PLANETARY EARTH (WEBGL)</span>
          </div>
          <span className="badge badge-info" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
            {textureLoaded ? "NASA BLUE MARBLE" : "TACTICAL VECTOR"}
          </span>
        </div>

        <div style={{ fontSize: "0.76rem", color: "#94a3b8", lineHeight: 1.5 }}>
          <div>Storm Eye: <strong style={{ color: "#ffffff" }}>{center.lat.toFixed(2)}°N, {center.lng.toFixed(2)}°E</strong></div>
          <div>Movement Heading: <strong style={{ color: "#ffffff" }}>{headingDeg}° NW</strong> &middot; Speed: <strong style={{ color: "#ffffff" }}>{speedKph} km/h</strong></div>
          <div>Status: <strong style={{ color: "#ff6b5b" }}>ACTIVE SUPER CYCLONIC VORTEX</strong></div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="dock-btn"
            style={{ fontSize: "0.72rem", padding: "5px 10px", border: "1px solid rgba(56, 189, 248, 0.3)" }}
            onClick={focusOnCyclone}
            title="Snap camera directly to the storm eye in Bay of Bengal"
          >
            🎯 Focus Cyclone Eye
          </button>
          <button
            type="button"
            className="dock-btn"
            style={{ fontSize: "0.72rem", padding: "5px 10px", border: "1px solid rgba(255, 255, 255, 0.15)" }}
            onClick={() => setIsAutoRotating(!isAutoRotating)}
          >
            {isAutoRotating ? "⏸ Pause Spin" : "▶ Auto Spin"}
          </button>
          {onExit3DGlobe && (
            <button
              type="button"
              className="dock-btn active"
              style={{
                fontSize: "0.72rem",
                padding: "5px 12px",
                background: "var(--accent-cyan)",
                color: "#050b14",
                fontWeight: 800,
              }}
              onClick={onExit3DGlobe}
            >
              Back to 3D Tactical Map &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Floating Instructions Bottom */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(6, 12, 22, 0.85)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "6px 18px",
          fontSize: "0.74rem",
          color: "#94a3b8",
          pointerEvents: "none",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
          whiteSpace: "nowrap",
          zIndex: 100,
        }}
      >
        Left-Click + Drag: Rotate 360° &middot; Right-Click: Pan &middot; Scroll: Zoom In/Out
      </div>
    </div>
  );
}
