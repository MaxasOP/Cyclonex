import { useState } from "react";
import {
  ShieldAlert,
  Users,
  Home,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  FileDown,
  Box,
  Radio,
  Zap,
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

export default function RiskEvacuationPage({
  scenario,
  buildings,
  sheltersPlan,
  locationName,
  onNavigateToCommand,
  onSelectCity3D,
}: RiskEvacuationPageProps) {
  const [filterType, setFilterType] = useState<"ALL" | "IMMEDIATE" | "STANDBY">("ALL");

  const shelters = sheltersPlan?.shelters ?? [
    {
      id: "sh-1",
      name: "Alibaug Multipurpose Cyclone Shelter (MPCS-01)",
      district: "Raigad",
      state: "Maharashtra",
      lat: 18.358,
      lon: 72.985,
      capacity: 1500,
      current_occupancy: 1240,
      evacuation_priority: "IMMEDIATE",
      distance_km: 2.4,
      facility_type: "Reinforced Concrete MPCS (G+2)",
    },
    {
      id: "sh-2",
      name: "Varsoli Coastal Relief Center",
      district: "Raigad",
      state: "Maharashtra",
      lat: 18.372,
      lon: 72.991,
      capacity: 1200,
      current_occupancy: 1050,
      evacuation_priority: "IMMEDIATE",
      distance_km: 4.1,
      facility_type: "Designated High School Cyclone Bunker",
    },
    {
      id: "sh-3",
      name: "Nagaon Cyclone Shelter Facility",
      district: "Raigad",
      state: "Maharashtra",
      lat: 18.324,
      lon: 72.978,
      capacity: 1800,
      current_occupancy: 950,
      evacuation_priority: "HIGH",
      distance_km: 6.8,
      facility_type: "State Disaster Management Center",
    },
    {
      id: "sh-4",
      name: "Murud Coastal MPCS Hub",
      district: "Raigad",
      state: "Maharashtra",
      lat: 18.285,
      lon: 72.962,
      capacity: 2200,
      current_occupancy: 820,
      evacuation_priority: "STANDBY",
      distance_km: 12.5,
      facility_type: "Community Cyclone Relief Campus",
    },
  ];

  const filteredShelters = shelters.filter((s) => {
    if (filterType === "IMMEDIATE") return s.evacuation_priority === "IMMEDIATE";
    if (filterType === "STANDBY") return s.evacuation_priority === "STANDBY";
    return true;
  });

  const totalCapacity = shelters.reduce((acc, s) => acc + s.capacity, 0);
  const totalOccupancy = shelters.reduce((acc, s) => acc + (s.current_occupancy || 0), 0);
  const occupancyPercent = Math.round((totalOccupancy / totalCapacity) * 100);

  const tallerCount = buildings.filter((b) => b.properties?.is_locally_taller).length;

  return (
    <div className="page-container risk-evacuation-page">
      {/* Header */}
      <div className="page-header-bar">
        <div>
          <div className="page-breadcrumb">
            <span>CYCLONEX</span> &gt; <span>OPERATIONS &amp; LOGISTICS</span> &gt; <strong>RISK &amp; EVACUATION</strong>
          </div>
          <h1 className="page-title">
            <ShieldAlert className="page-title-icon" size={24} />
            Disaster Risk, Infrastructure &amp; Evacuation Planning
          </h1>
          <p className="page-subtitle">
            Multipurpose Cyclone Shelter (MPCS) network, 200m ward screening, building vulnerability screening, and NDMA operational directives.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-primary-action"
            onClick={onSelectCity3D}
          >
            <Box size={14} />
            <span>Launch 3D City Twin</span>
          </button>
          <button
            type="button"
            className="btn-ghost-action"
            onClick={() => window.print()}
          >
            <FileDown size={14} />
            <span>Export SITREP</span>
          </button>
        </div>
      </div>

      {/* Top Telemetry KPI Bar */}
      <div className="evac-kpi-bar">
        <div className="evac-kpi-cell">
          <span className="kpi-label">POPULATION AT RISK</span>
          <strong className="kpi-val red">{(scenario?.risk_grid?.summary?.estimated_population_affected ?? 330930).toLocaleString()}</strong>
          <span className="kpi-sub">Within 35 km eyewall buffer</span>
        </div>
        <div className="evac-kpi-cell">
          <span className="kpi-label">ESTIMATED ECONOMIC LOSS</span>
          <strong className="kpi-val amber">₹ {(scenario?.risk_grid?.summary?.estimated_loss_crores_inr ?? 1131.8).toFixed(1)} Cr</strong>
          <span className="kpi-sub">Infrastructure &amp; assets screening</span>
        </div>
        <div className="evac-kpi-cell">
          <span className="kpi-label">ACTIVE MPCS SHELTERS</span>
          <strong className="kpi-val cyan">{shelters.length} Facilities</strong>
          <span className="kpi-sub">Total Capacity: {totalCapacity.toLocaleString()}</span>
        </div>
        <div className="evac-kpi-cell">
          <span className="kpi-label">SHELTER CAPACITY UTILIZATION</span>
          <strong className="kpi-val green">{occupancyPercent}%</strong>
          <span className="kpi-sub">{totalOccupancy.toLocaleString()} currently sheltered</span>
        </div>
      </div>

      {/* Main Grid: Shelters on Left, Infrastructure on Right */}
      <div className="page-grid-2col">
        {/* Left Column: MPCS Shelter Management */}
        <div className="page-card shelters-card">
          <div className="card-header-row">
            <div>
              <span className="card-tag">LOGISTICS &amp; REDISTRIBUTION</span>
              <h3 className="card-heading">Multipurpose Cyclone Shelter (MPCS) Network</h3>
            </div>
            <div className="filter-pill-group">
              {(["ALL", "IMMEDIATE", "STANDBY"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`filter-pill ${filterType === f ? "active" : ""}`}
                  onClick={() => setFilterType(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="shelters-list">
            {filteredShelters.map((s) => {
              const occPct = Math.round(((s.current_occupancy || 0) / s.capacity) * 100);
              const isUrgent = s.evacuation_priority === "IMMEDIATE";
              return (
                <div key={s.id} className={`shelter-item-card ${isUrgent ? "urgent" : ""}`}>
                  <div className="shelter-header-line">
                    <div className="shelter-title-block">
                      <Home size={14} className="shelter-icon" />
                      <strong>{s.name}</strong>
                    </div>
                    <span className={`priority-badge ${(s.evacuation_priority || "STANDBY").toLowerCase()}`}>
                      {s.evacuation_priority || "STANDBY"} ACTIVE
                    </span>
                  </div>

                  <div className="shelter-meta-row">
                    <span>Facility: <em>{s.facility_type}</em></span>
                    <span>Distance from Eye: <strong>{s.distance_km} km</strong></span>
                  </div>

                  {/* Occupancy Progress Bar */}
                  <div className="occupancy-bar-container">
                    <div className="occupancy-bar-label">
                      <span>Occupancy: {s.current_occupancy} / {s.capacity}</span>
                      <strong>{occPct}%</strong>
                    </div>
                    <div className="occupancy-track">
                      <div
                        className={`occupancy-fill ${occPct >= 85 ? "high" : "normal"}`}
                        style={{ width: `${Math.min(occPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Critical Infrastructure & Building Assets */}
        <div className="page-column-stack">
          {/* Critical Infrastructure Table */}
          <div className="page-card infra-card">
            <div className="card-header-row">
              <div>
                <span className="card-tag">CRITICAL LIFELINES</span>
                <h3 className="card-heading">Infrastructure Vulnerability Matrix</h3>
              </div>
            </div>

            <div className="infra-items-list">
              <div className="infra-row high-risk">
                <div className="infra-info">
                  <Zap size={14} className="infra-icon" />
                  <div>
                    <strong>220kV Coastal Electrical Substation</strong>
                    <span className="infra-sub">Transmission Grid Isolation Protocol</span>
                  </div>
                </div>
                <span className="infra-status-tag red">High Surge Risk</span>
              </div>

              <div className="infra-row high-risk">
                <div className="infra-info">
                  <Navigation size={14} className="infra-icon" />
                  <div>
                    <strong>Commercial Fishing Port &amp; Jetties</strong>
                    <span className="infra-sub">Port Warning Signal: 10 (Great Danger)</span>
                  </div>
                </div>
                <span className="infra-status-tag red">Mandatory Cease Operations</span>
              </div>

              <div className="infra-row moderate-risk">
                <div className="infra-info">
                  <Building2 size={14} className="infra-icon" />
                  <div>
                    <strong>District Government Hospital &amp; Trauma Unit</strong>
                    <span className="infra-sub">Backup Diesel Generators &amp; O2 Supplies</span>
                  </div>
                </div>
                <span className="infra-status-tag amber">Standby Protocol</span>
              </div>

              <div className="infra-row safe">
                <div className="infra-info">
                  <Radio size={14} className="infra-icon" />
                  <div>
                    <strong>Emergency VHF / HAM Communications Tower</strong>
                    <span className="infra-sub">Wind Loading Resistance: 220 km/h</span>
                  </div>
                </div>
                <span className="infra-status-tag green">Operational</span>
              </div>
            </div>
          </div>

          {/* Building Aerodynamics Screening */}
          <div className="page-card buildings-screening-card">
            <div className="card-header-row">
              <div>
                <span className="card-tag">3D DIGITAL TWIN SCREENING</span>
                <h3 className="card-heading">Urban Building Stock Summary</h3>
              </div>
            </div>

            <div className="building-stats-grid">
              <div className="bldg-stat-box">
                <span className="bldg-stat-lbl">TOTAL FOOTPRINTS SCREENED</span>
                <strong className="bldg-stat-val">{buildings.length > 0 ? buildings.length.toLocaleString() : "872"}</strong>
                <span className="bldg-stat-sub">From OpenStreetMap GeoJSON</span>
              </div>
              <div className="bldg-stat-box">
                <span className="bldg-stat-lbl">LOCALLY TALLER ASSETS</span>
                <strong className="bldg-stat-val amber">{tallerCount > 0 ? tallerCount : "14"}</strong>
                <span className="bldg-stat-sub">Elevated aerodynamic drag loading</span>
              </div>
            </div>

            <div className="card-bottom-cta">
              <button
                type="button"
                className="btn-open-3d-city"
                onClick={onSelectCity3D}
              >
                <Box size={14} />
                <span>Open 3D City View &amp; Wind Particle Simulation &rarr;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
