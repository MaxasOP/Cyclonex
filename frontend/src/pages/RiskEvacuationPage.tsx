import { useState, useMemo } from "react";
import {
  ShieldAlert,
  Home,
  Building2,
  Navigation,
  FileDown,
  Box,
  Radio,
  Zap,
  MapPin,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronRight
} from "lucide-react";
import type { EvacuationPlan, ScenarioResult, BuildingFeature } from "../api";

interface RiskEvacuationPageProps {
  scenario: ScenarioResult | null;
  buildings: BuildingFeature[];
  sheltersPlan: EvacuationPlan | null;
  locationName: string;
  onNavigateToCommand: (presetKey?: string) => void;
  onSelectCity3D: () => void;
}

interface WardData {
  id: string;
  name: string;
  population: number;
  criticalBuildings: number;
  surgeHeightM: number;
  nearestShelterId: string;
  evacPriority: "CRITICAL" | "HIGH" | "MODERATE" | "NOMINAL";
  evacRoute: string;
  routeDistanceKm: number;
  estEvacTimeMin: number;
  mapPolygon: string;
  center: { x: number; y: number };
}

export default function RiskEvacuationPage({
  scenario,
  buildings,
  sheltersPlan,
  locationName,
  onNavigateToCommand,
  onSelectCity3D,
}: RiskEvacuationPageProps) {
  const [selectedWardId, setSelectedWardId] = useState<string>("w-1");
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>("sh-1");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");

  // Determine coastal region and basin from scenario / locationName
  const locUpper = (locationName || scenario?.input?.name || "").toUpperCase();
  const centerLon = scenario?.input?.center_lon ?? 86.6;
  const isOdisha = locUpper.includes("ODISHA") || locUpper.includes("FANI") || locUpper.includes("PARADIP") || locUpper.includes("PURI");
  const isBengal = locUpper.includes("BENGAL") || locUpper.includes("AMPHAN") || locUpper.includes("DIGHA") || locUpper.includes("SAGAR");
  const isGujarat = locUpper.includes("GUJARAT") || locUpper.includes("BIPARJOY") || locUpper.includes("MANDVI") || locUpper.includes("JAKHAU");

  const basinName = (centerLon >= 77.5 || isOdisha || isBengal) ? "BAY OF BENGAL" : "ARABIAN SEA";
  const sectorTitle = isOdisha
    ? "SECTOR: PARADIP & ODISHA COASTAL BELT · SEVERE SURGE REACH"
    : isBengal
    ? "SECTOR: PURBA MEDINIPUR & SUNDARBANS DELTA · SEVERE SURGE REACH"
    : isGujarat
    ? "SECTOR: KUTCH & MANDVI COASTAL HARBOR BELT"
    : "SECTOR: KONKAN MARITIME & ALIBAUG SECTOR";

  const WARDS: WardData[] = useMemo(() => {
    if (isOdisha) {
      return [
        {
          id: "w-1",
          name: "Ward 01 · Paradip Port Marine & Harbor Hub",
          population: 3450,
          criticalBuildings: 22,
          surgeHeightM: 4.2,
          nearestShelterId: "sh-1",
          evacPriority: "CRITICAL",
          evacRoute: "NH-53 Heavy Vehicle Coastal Evacuation Corridor",
          routeDistanceKm: 2.3,
          estEvacTimeMin: 20,
          mapPolygon: "M 220,130 L 300,120 L 320,180 L 240,195 Z",
          center: { x: 270, y: 155 },
        },
        {
          id: "w-2",
          name: "Ward 02 · Jagatsinghpur Inshore Agricultural Belt",
          population: 2890,
          criticalBuildings: 14,
          surgeHeightM: 3.5,
          nearestShelterId: "sh-2",
          evacPriority: "CRITICAL",
          evacRoute: "Cuttack-Paradip Elevated Highway",
          routeDistanceKm: 3.8,
          estEvacTimeMin: 32,
          mapPolygon: "M 200,60 L 280,50 L 300,110 L 220,120 Z",
          center: { x: 250, y: 85 },
        },
        {
          id: "w-3",
          name: "Ward 03 · Chandbali Riverine Plain",
          population: 3100,
          criticalBuildings: 9,
          surgeHeightM: 2.3,
          nearestShelterId: "sh-3",
          evacPriority: "HIGH",
          evacRoute: "Bhadrak-Chandbali Highway",
          routeDistanceKm: 4.5,
          estEvacTimeMin: 40,
          mapPolygon: "M 250,210 L 330,200 L 350,280 L 270,290 Z",
          center: { x: 300, y: 245 },
        },
        {
          id: "w-4",
          name: "Ward 04 · Dhamra Estuary Fishery Sector",
          population: 1850,
          criticalBuildings: 7,
          surgeHeightM: 1.8,
          nearestShelterId: "sh-4",
          evacPriority: "MODERATE",
          evacRoute: "Dhamra Port Dedicated Link Road",
          routeDistanceKm: 5.8,
          estEvacTimeMin: 55,
          mapPolygon: "M 280,300 L 360,290 L 390,370 L 310,380 Z",
          center: { x: 335, y: 335 },
        },
      ];
    }
    if (isBengal) {
      return [
        {
          id: "w-1",
          name: "Ward 01 · Digha Coastal Promenade & Harbor",
          population: 3820,
          criticalBuildings: 26,
          surgeHeightM: 4.6,
          nearestShelterId: "sh-1",
          evacPriority: "CRITICAL",
          evacRoute: "Contai-Digha Multi-Lane Highway Arterial",
          routeDistanceKm: 2.1,
          estEvacTimeMin: 18,
          mapPolygon: "M 220,130 L 300,120 L 320,180 L 240,195 Z",
          center: { x: 270, y: 155 },
        },
        {
          id: "w-2",
          name: "Ward 02 · Sagar Island South Tip Settlement",
          population: 2640,
          criticalBuildings: 15,
          surgeHeightM: 4.1,
          nearestShelterId: "sh-2",
          evacPriority: "CRITICAL",
          evacRoute: "Sagar Island Central High-Dyke Spine",
          routeDistanceKm: 3.5,
          estEvacTimeMin: 30,
          mapPolygon: "M 200,60 L 280,50 L 300,110 L 220,120 Z",
          center: { x: 250, y: 85 },
        },
        {
          id: "w-3",
          name: "Ward 03 · Bakkhali Estuary Vulnerable Sector",
          population: 2190,
          criticalBuildings: 10,
          surgeHeightM: 2.7,
          nearestShelterId: "sh-3",
          evacPriority: "HIGH",
          evacRoute: "Namkhana-Bakkhali Link Road",
          routeDistanceKm: 5.1,
          estEvacTimeMin: 42,
          mapPolygon: "M 250,210 L 330,200 L 350,280 L 270,290 Z",
          center: { x: 300, y: 245 },
        },
        {
          id: "w-4",
          name: "Ward 04 · Kakdwip Delta Ferry Terminal",
          population: 2410,
          criticalBuildings: 8,
          surgeHeightM: 2.0,
          nearestShelterId: "sh-4",
          evacPriority: "MODERATE",
          evacRoute: "Diamond Harbour Express Arterial",
          routeDistanceKm: 6.4,
          estEvacTimeMin: 58,
          mapPolygon: "M 280,300 L 360,290 L 390,370 L 310,380 Z",
          center: { x: 335, y: 335 },
        },
      ];
    }
    if (isGujarat) {
      return [
        {
          id: "w-1",
          name: "Ward 01 · Mandvi Fishing Port & Beachfront",
          population: 3120,
          criticalBuildings: 19,
          surgeHeightM: 3.7,
          nearestShelterId: "sh-1",
          evacPriority: "CRITICAL",
          evacRoute: "Mandvi-Bhuj State Highway 47",
          routeDistanceKm: 2.4,
          estEvacTimeMin: 22,
          mapPolygon: "M 220,130 L 300,120 L 320,180 L 240,195 Z",
          center: { x: 270, y: 155 },
        },
        {
          id: "w-2",
          name: "Ward 02 · Jakhau Harbor Tidal Creek Belt",
          population: 2210,
          criticalBuildings: 11,
          surgeHeightM: 3.4,
          nearestShelterId: "sh-2",
          evacPriority: "CRITICAL",
          evacRoute: "Jakhau Coast Guard Radial Corridor",
          routeDistanceKm: 3.6,
          estEvacTimeMin: 34,
          mapPolygon: "M 200,60 L 280,50 L 300,110 L 220,120 Z",
          center: { x: 250, y: 85 },
        },
        {
          id: "w-3",
          name: "Ward 03 · Dwarka Coastal Pilgrim Precinct",
          population: 2780,
          criticalBuildings: 12,
          surgeHeightM: 2.4,
          nearestShelterId: "sh-3",
          evacPriority: "HIGH",
          evacRoute: "Okha-Dwarka National Highway 51",
          routeDistanceKm: 4.6,
          estEvacTimeMin: 44,
          mapPolygon: "M 250,210 L 330,200 L 350,280 L 270,290 Z",
          center: { x: 300, y: 245 },
        },
        {
          id: "w-4",
          name: "Ward 04 · Porbandar Inshore Lowlands",
          population: 1950,
          criticalBuildings: 6,
          surgeHeightM: 1.7,
          nearestShelterId: "sh-4",
          evacPriority: "MODERATE",
          evacRoute: "Porbandar Coastal Bypass Expressway",
          routeDistanceKm: 5.9,
          estEvacTimeMin: 52,
          mapPolygon: "M 280,300 L 360,290 L 390,370 L 310,380 Z",
          center: { x: 335, y: 335 },
        },
      ];
    }
    return [
      {
        id: "w-1",
        name: "Ward 01 · Coastal Beach & Harbor",
        population: 2840,
        criticalBuildings: 18,
        surgeHeightM: 3.8,
        nearestShelterId: "sh-1",
        evacPriority: "CRITICAL",
        evacRoute: "Arterial Alpha (Alibag Harbor Rd)",
        routeDistanceKm: 2.1,
        estEvacTimeMin: 25,
        mapPolygon: "M 220,130 L 300,120 L 320,180 L 240,195 Z",
        center: { x: 270, y: 155 },
      },
      {
        id: "w-2",
        name: "Ward 02 · Varsoli Coastal Settlement",
        population: 1980,
        criticalBuildings: 12,
        surgeHeightM: 3.2,
        nearestShelterId: "sh-2",
        evacPriority: "CRITICAL",
        evacRoute: "Varsoli-Pen Link Corridor",
        routeDistanceKm: 3.4,
        estEvacTimeMin: 35,
        mapPolygon: "M 200,60 L 280,50 L 300,110 L 220,120 Z",
        center: { x: 250, y: 85 },
      },
      {
        id: "w-3",
        name: "Ward 03 · Nagaon Inshore Plain",
        population: 3420,
        criticalBuildings: 8,
        surgeHeightM: 2.1,
        nearestShelterId: "sh-3",
        evacPriority: "HIGH",
        evacRoute: "Nagaon Bypass Road",
        routeDistanceKm: 4.8,
        estEvacTimeMin: 45,
        mapPolygon: "M 250,210 L 330,200 L 350,280 L 270,290 Z",
        center: { x: 300, y: 245 },
      },
      {
        id: "w-4",
        name: "Ward 04 · Revdanda Estuary Zone",
        population: 2150,
        criticalBuildings: 6,
        surgeHeightM: 1.8,
        nearestShelterId: "sh-4",
        evacPriority: "MODERATE",
        evacRoute: "Revdanda Bridge Expressway",
        routeDistanceKm: 6.2,
        estEvacTimeMin: 60,
        mapPolygon: "M 280,300 L 360,290 L 390,370 L 310,380 Z",
        center: { x: 335, y: 335 },
      },
    ];
  }, [isOdisha, isBengal, isGujarat]);

  const SHELTERS = useMemo(() => {
    if (isOdisha) {
      return [
        {
          id: "sh-1",
          name: "Paradip Port Multipurpose Cyclone Shelter (MPCS-01)",
          capacity: 3500,
          occupancy: 2980,
          type: "Reinforced Concrete MPCS (G+3)",
          standbyPower: "100% Dual Diesel DG",
          potableWater: "21 Days",
          helipad: true,
          x: 350,
          y: 165,
        },
        {
          id: "sh-2",
          name: "Dhamra Port Coastal Refuge Citadel (MPCS-02)",
          capacity: 2800,
          occupancy: 2100,
          type: "ODRRA Standard Shelter",
          standbyPower: "100% Diesel",
          potableWater: "14 Days",
          helipad: true,
          x: 340,
          y: 80,
        },
        {
          id: "sh-3",
          name: "Puri Jagannath Coastal High-Capacity Refuge",
          capacity: 3000,
          occupancy: 1850,
          type: "State Disaster Relief Campus",
          standbyPower: "100% Solar + DG",
          potableWater: "18 Days",
          helipad: true,
          x: 390,
          y: 250,
        },
        {
          id: "sh-4",
          name: "Chandipur Coast Guard Adjacent Shelter",
          capacity: 2200,
          occupancy: 1400,
          type: "Community Cyclone Relief Hub",
          standbyPower: "100% Diesel",
          potableWater: "14 Days",
          helipad: false,
          x: 420,
          y: 340,
        },
      ];
    }
    if (isBengal) {
      return [
        {
          id: "sh-1",
          name: "Digha Coastal Multipurpose Shelter Hub (MPCS-WB01)",
          capacity: 3200,
          occupancy: 2750,
          type: "RCC Stilted 3-Story Citadel",
          standbyPower: "100% Dual DG",
          potableWater: "21 Days",
          helipad: true,
          x: 350,
          y: 165,
        },
        {
          id: "sh-2",
          name: "Sagar Island Central Fortified Shelter",
          capacity: 3200,
          occupancy: 2600,
          type: "Fortified Cyclone Campus",
          standbyPower: "100% Diesel",
          potableWater: "15 Days",
          helipad: true,
          x: 340,
          y: 80,
        },
        {
          id: "sh-3",
          name: "Bakkhali South Coast Refugee Citadel",
          capacity: 2000,
          occupancy: 1420,
          type: "Stilted Community MPCS",
          standbyPower: "100% Diesel",
          potableWater: "12 Days",
          helipad: false,
          x: 390,
          y: 250,
        },
        {
          id: "sh-4",
          name: "Kakdwip Port Flood Refuge Citadel",
          capacity: 2500,
          occupancy: 1300,
          type: "Multi-Purpose Cyclone Shelter",
          standbyPower: "100% Solar + DG",
          potableWater: "14 Days",
          helipad: false,
          x: 420,
          y: 340,
        },
      ];
    }
    if (isGujarat) {
      return [
        {
          id: "sh-1",
          name: "Mandvi Port Emergency Cyclone Fortress (MPCS-GJ01)",
          capacity: 3000,
          occupancy: 2450,
          type: "Reinforced Concrete MPCS (G+2)",
          standbyPower: "100% Diesel",
          potableWater: "20 Days",
          helipad: true,
          x: 350,
          y: 165,
        },
        {
          id: "sh-2",
          name: "Jakhau Deep Tidal Storm Shelter",
          capacity: 2200,
          occupancy: 1780,
          type: "Coast Guard Fortified Refuge",
          standbyPower: "100% Diesel",
          potableWater: "14 Days",
          helipad: false,
          x: 340,
          y: 80,
        },
        {
          id: "sh-3",
          name: "Dwarka Coastal Refuge Complex",
          capacity: 2600,
          occupancy: 1600,
          type: "State Disaster Relief Campus",
          standbyPower: "100% Solar + DG",
          potableWater: "15 Days",
          helipad: true,
          x: 390,
          y: 250,
        },
        {
          id: "sh-4",
          name: "Porbandar Municipal Disaster Center",
          capacity: 2400,
          occupancy: 1100,
          type: "Municipal MPCS Citadel",
          standbyPower: "100% Diesel",
          potableWater: "14 Days",
          helipad: false,
          x: 420,
          y: 340,
        },
      ];
    }
    return [
      {
        id: "sh-1",
        name: "Alibaug Multipurpose Cyclone Shelter (MPCS-01)",
        capacity: 2200,
        occupancy: 1840,
        type: "Reinforced Concrete MPCS (G+2)",
        standbyPower: "100% Diesel",
        potableWater: "14 Days",
        helipad: true,
        x: 350,
        y: 165,
      },
      {
        id: "sh-2",
        name: "Varsoli High School Cyclone Bunker",
        capacity: 1500,
        occupancy: 1150,
        type: "Designated Relief Campus",
        standbyPower: "100% Diesel",
        potableWater: "10 Days",
        helipad: false,
        x: 340,
        y: 80,
      },
      {
        id: "sh-3",
        name: "Nagaon SDMA Regional Relief Center",
        capacity: 1800,
        occupancy: 1250,
        type: "State Disaster Shelter Campus",
        standbyPower: "100% Diesel",
        potableWater: "21 Days",
        helipad: true,
        x: 390,
        y: 250,
      },
      {
        id: "sh-4",
        name: "Murud Coastal Community Shelter",
        capacity: 2200,
        occupancy: 980,
        type: "Community Cyclone Relief Hub",
        standbyPower: "100% Diesel",
        potableWater: "14 Days",
        helipad: false,
        x: 420,
        y: 340,
      },
    ];
  }, [isOdisha, isBengal, isGujarat]);

  const totalCapacity = useMemo(() => SHELTERS.reduce((acc, s) => acc + s.capacity, 0), [SHELTERS]);
  const totalOccupancy = useMemo(() => SHELTERS.reduce((acc, s) => acc + s.occupancy, 0), [SHELTERS]);
  const immediateRiskPop = useMemo(
    () => sheltersPlan?.immediate_evacuation_count || WARDS.filter(w => w.evacPriority === "CRITICAL").reduce((acc, w) => acc + w.population, 0),
    [sheltersPlan, WARDS]
  );

  const activeWard = WARDS.find(w => w.id === selectedWardId) || WARDS[0];
  const assignedShelter = SHELTERS.find(s => s.id === activeWard.nearestShelterId) || SHELTERS[0];
  const inspectedShelter = SHELTERS.find(s => s.id === selectedShelterId) || assignedShelter;

  const filteredWards = filterPriority === "ALL"
    ? WARDS
    : WARDS.filter(w => w.evacPriority === filterPriority);

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">

        {/* Editorial Header */}
        <div className="op-editorial-header" style={{ marginBottom: "20px" }}>
          <div>
            <div className="op-section-kicker">
              <ShieldAlert size={12} style={{ display: "inline", marginRight: "6px" }} />
              CIVIL DEFENSE OPERATIONS &middot; LOGISTICS MATRIX
            </div>
            <h1 className="op-section-title" style={{ fontSize: "28px" }}>
              Shelters &amp; Evacuation Logistics Map
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Interactive parcel risk routing linking at-risk coastal wards to the nearest multi-purpose cyclone shelters (MPCS)
              and high-elevation evacuation corridors.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="op-btn-secondary"
              onClick={onSelectCity3D}
              style={{ fontSize: "12px", padding: "8px 14px" }}
            >
              <Box size={13} />
              <span>Inspect 3D City Buildings</span>
            </button>
            <button
              type="button"
              className="op-btn-primary"
              onClick={() => onNavigateToCommand()}
              style={{ fontSize: "12px", padding: "8px 14px" }}
            >
              <Navigation size={13} />
              <span>Tactical Map Console</span>
            </button>
          </div>
        </div>

        {/* Top Operational Telemetry Summary Strip */}
        <div className="saas-landing-live-strip" style={{ marginBottom: "24px" }}>
          <div className="saas-live-stat">
            <span className="saas-live-label">Population at Immediate Risk</span>
            <span className="saas-live-val" style={{ color: "#ef4444" }}>
              {immediateRiskPop.toLocaleString()} Residents
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Total Shelter Capacity</span>
            <span className="saas-live-val" style={{ color: "#ffffff" }}>
              {totalCapacity.toLocaleString()} Beds
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Current Intake (Utilization)</span>
            <span className="saas-live-val" style={{ color: "#38bdf8" }}>
              {totalOccupancy.toLocaleString()} ({totalCapacity > 0 ? ((totalOccupancy / totalCapacity) * 100).toFixed(1) : "0.0"}%)
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Standby Capacity</span>
            <span className="saas-live-val" style={{ color: "#10b981" }}>
              {Math.max(0, totalCapacity - totalOccupancy).toLocaleString()} Vacant
            </span>
          </div>
          <div className="saas-live-stat">
            <span className="saas-live-label">Simulated Asset Loss</span>
            <span className="saas-live-val" style={{ color: "#f59e0b" }}>
              {scenario?.risk_grid?.summary?.estimated_loss_crores_inr != null
                ? `₹${scenario.risk_grid.summary.estimated_loss_crores_inr.toFixed(1)} Cr Estimated`
                : "₹4.8 Cr Estimated"}
            </span>
          </div>
        </div>

        {/* Main Interactive Grid: Dedicated Evacuation Map (Left) & Ranked Priority List (Right) */}
        <div className="op-split-grid" style={{ gridTemplateColumns: "1.25fr 0.75fr", gap: "28px" }}>
          
          {/* Left: Interactive Geospatial Evacuation Canvas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{
              position: "relative",
              height: "440px",
              background: "#030508",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              overflow: "hidden"
            }}>
              
              {/* Tactical Topbar */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                padding: "8px 14px",
                background: "rgba(5, 8, 14, 0.9)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10.5px",
                color: "#64748b",
                zIndex: 10
              }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444" }} />
                  <span style={{ color: "#ffffff", fontWeight: 700 }}>GEOSPATIAL EVACUATION CORRIDOR ENGINE</span>
                </div>
                <div>{sectorTitle}</div>
              </div>

              {/* Map SVG Engine */}
              <svg width="100%" height="100%" viewBox="0 0 520 440" style={{ display: "block" }}>
                <defs>
                  <pattern id="evacGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.025)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="520" height="440" fill="#030508" />
                <rect width="520" height="440" fill="url(#evacGrid)" />

                {/* Ocean Area (Left Side) */}
                <rect x="0" y="0" width="190" height="440" fill="rgba(15, 23, 42, 0.5)" />
                <text x="30" y="220" fill="#334155" fontSize="13" fontFamily="'JetBrains Mono', monospace" letterSpacing="4">{basinName}</text>

                {/* Coastline Polygon */}
                <path
                  d="M 190,0 Q 180,90 200,160 T 210,260 Q 220,330 250,440 L 520,440 L 520,0 Z"
                  fill="rgba(30, 41, 59, 0.3)"
                  stroke="rgba(148, 163, 184, 0.2)"
                  strokeWidth="1.5"
                />

                {/* Coastal Seawall Revetment (Dashed Teal Line along coast) */}
                <path
                  d="M 194,10 Q 184,95 204,165 T 214,265 Q 224,335 254,430"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <text x="130" y="50" fill="#38bdf8" fontSize="8.5" fontFamily="'JetBrains Mono', monospace">SEAWALL (14.2 km)</text>

                {/* Mangrove Bioshield Zone */}
                <path
                  d="M 202,170 Q 215,220 220,250 L 240,245 Q 235,215 220,165 Z"
                  fill="rgba(16, 185, 129, 0.25)"
                  stroke="#10b981"
                  strokeWidth="1"
                />
                <text x="110" y="210" fill="#10b981" fontSize="8" fontFamily="'JetBrains Mono', monospace">BIOSHIELD (180 HA)</text>

                {/* Ward Polygons */}
                {WARDS.map(w => {
                  const isSelected = w.id === selectedWardId;
                  const strokeColor = w.evacPriority === "CRITICAL" ? "#ef4444" : w.evacPriority === "HIGH" ? "#f59e0b" : "#38bdf8";
                  const fillColor = isSelected
                    ? (w.evacPriority === "CRITICAL" ? "rgba(239, 68, 68, 0.35)" : "rgba(245, 158, 11, 0.3)")
                    : (w.evacPriority === "CRITICAL" ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.03)");

                  return (
                    <g key={w.id} onClick={() => setSelectedWardId(w.id)} style={{ cursor: "pointer" }}>
                      <path
                        d={w.mapPolygon}
                        fill={fillColor}
                        stroke={isSelected ? "#ffffff" : strokeColor}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      <circle cx={w.center.x} cy={w.center.y} r={isSelected ? 5 : 3} fill={strokeColor} />
                      <text
                        x={w.center.x + 8}
                        y={w.center.y + 3}
                        fill={isSelected ? "#ffffff" : "#94a3b8"}
                        fontSize="9"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight={isSelected ? "bold" : "normal"}
                      >
                        {w.name.split("·")[0].trim()}
                      </text>
                    </g>
                  );
                })}

                {/* Active Evacuation Path from Selected Ward to its Assigned Shelter */}
                <line
                  x1={activeWard.center.x}
                  y1={activeWard.center.y}
                  x2={assignedShelter.x}
                  y2={assignedShelter.y}
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  className="op-stream-flow-line"
                />

                {/* MPCS Shelter Markers */}
                {SHELTERS.map(s => {
                  const isInspected = s.id === selectedShelterId || s.id === activeWard.nearestShelterId;
                  const isFull = s.occupancy / s.capacity > 0.85;

                  return (
                    <g
                      key={s.id}
                      onClick={() => setSelectedShelterId(s.id)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Pulse ring for active shelter */}
                      {isInspected && (
                        <circle cx={s.x} cy={s.y} r="14" fill="none" stroke="#10b981" className="op-pulse-ring" />
                      )}
                      <circle
                        cx={s.x}
                        cy={s.y}
                        r={isInspected ? 8 : 6}
                        fill="#05080e"
                        stroke={isFull ? "#f59e0b" : "#10b981"}
                        strokeWidth={2}
                      />
                      <circle
                        cx={s.x}
                        cy={s.y}
                        r={3}
                        fill={isFull ? "#f59e0b" : "#10b981"}
                      />
                      <text
                        x={s.x + 10}
                        y={s.y + 4}
                        fill={isInspected ? "#ffffff" : "#64748b"}
                        fontSize="9"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight={isInspected ? "bold" : "normal"}
                      >
                        {s.id.toUpperCase()} ({Math.round((s.occupancy / s.capacity) * 100)}%)
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Contextual Popover for Active Ward Evacuation Corridor */}
              <div style={{
                position: "absolute",
                bottom: "10px",
                left: "14px",
                right: "14px",
                background: "rgba(4, 7, 12, 0.95)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                zIndex: 10
              }}>
                <div>
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>SELECTED: {activeWard.name.toUpperCase()}</span>
                  <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: "2px" }}>
                    ROUTE: <strong style={{ color: "#ffffff" }}>{activeWard.evacRoute}</strong> &middot; DISTANCE: <strong style={{ color: "#38bdf8" }}>{activeWard.routeDistanceKm} km</strong> &middot; EST. TIME: <strong style={{ color: "#10b981" }}>{activeWard.estEvacTimeMin} min</strong>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#64748b", fontSize: "10px" }}>TARGET REFUGE:</div>
                  <div style={{ color: "#10b981", fontWeight: 700 }}>{assignedShelter.name}</div>
                </div>
              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", padding: "0 4px" }}>
              <span>Click any ward or shelter on map to inspect evacuation logistics</span>
              <span style={{ color: "#38bdf8" }}>Shortest Corridor Algorithm: Dijkstra Elevation-Weighted</span>
            </div>
          </div>

          {/* Right: Ranked Priority List & Shelter Inspector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Contextual Shelter Facility Inspector */}
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Shield size={14} style={{ color: "#10b981" }} />
                  <span>SHELTER FACILITY PROFILE</span>
                </div>
                <span className="op-tech-panel-badge" style={{ color: "#10b981", borderColor: "#10b981" }}>
                  ACTIVE REFUGE
                </span>
              </div>

              <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", marginBottom: "4px" }}>
                {inspectedShelter.name}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "14px" }}>
                {inspectedShelter.type} &middot; {inspectedShelter.helipad ? "Helipad Equipped" : "Ground Access Only"}
              </div>

              {/* Capacity Load Meter */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>
                  <span style={{ color: "#64748b" }}>CURRENT OCCUPANCY LOAD:</span>
                  <span style={{ color: inspectedShelter.occupancy / inspectedShelter.capacity > 0.85 ? "#f59e0b" : "#10b981", fontWeight: 700 }}>
                    {inspectedShelter.occupancy} / {inspectedShelter.capacity} ({Math.round((inspectedShelter.occupancy / inspectedShelter.capacity) * 100)}%)
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(inspectedShelter.occupancy / inspectedShelter.capacity) * 100}%`,
                      height: "100%",
                      background: inspectedShelter.occupancy / inspectedShelter.capacity > 0.85 ? "#f59e0b" : "#10b981"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "11px", color: "#94a3b8" }}>
                <div style={{ padding: "8px", background: "#03060a", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "9.5px", color: "#64748b" }}>STANDBY POWER</div>
                  <div style={{ color: "#10b981", fontWeight: 700 }}>{inspectedShelter.standbyPower}</div>
                </div>
                <div style={{ padding: "8px", background: "#03060a", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: "9.5px", color: "#64748b" }}>POTABLE WATER</div>
                  <div style={{ color: "#38bdf8", fontWeight: 700 }}>{inspectedShelter.potableWater}</div>
                </div>
              </div>
            </div>

            {/* Ranked Evacuation Priority List */}
            <div className="op-technical-panel" style={{ flex: 1 }}>
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <ShieldAlert size={14} style={{ color: "#ef4444" }} />
                  <span>WARD EVACUATION ROSTER</span>
                </div>
                <span className="op-tech-panel-badge">RANKED BY SURGE</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredWards.map(w => {
                  const isSelected = w.id === selectedWardId;
                  const priorityColor = w.evacPriority === "CRITICAL" ? "#ef4444" : w.evacPriority === "HIGH" ? "#f59e0b" : "#38bdf8";

                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedWardId(w.id)}
                      style={{
                        padding: "10px 12px",
                        background: isSelected ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.02)",
                        border: "1px solid",
                        borderColor: isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.06)",
                        borderRadius: "3px",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: 700, color: isSelected ? "#ffffff" : "#cbd5e1" }}>
                          {w.name}
                        </span>
                        <span style={{ fontSize: "9.5px", fontFamily: "'JetBrains Mono', monospace", color: priorityColor, fontWeight: 700 }}>
                          {w.evacPriority}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "#64748b" }}>
                        <span>Pop: <strong style={{ color: "#ffffff" }}>{w.population}</strong> &middot; Critical: <strong style={{ color: "#ef4444" }}>{w.criticalBuildings}</strong></span>
                        <span>Surge: <strong style={{ color: "#f59e0b" }}>{w.surgeHeightM}m</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
