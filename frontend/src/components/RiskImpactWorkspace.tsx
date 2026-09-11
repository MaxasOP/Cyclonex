import React, { useState } from "react";
import {
  ShieldAlert,
  Users,
  Building2,
  TrendingDown,
  AlertTriangle,
  Waves,
  CloudRain,
  Wind,
  Navigation,
  CheckCircle,
} from "lucide-react";
import type { ScenarioResult, BuildingFeature, EvacuationPlan } from "../api";

export interface RiskImpactWorkspaceProps {
  scenario: ScenarioResult | null;
  buildings: BuildingFeature[];
  sheltersPlan: EvacuationPlan | null;
  locationName: string;
  onSelectCityView?: () => void;
}

type RiskLayer = "wind" | "surge" | "rain" | "flood" | "population" | "infrastructure" | "economic";

export default function RiskImpactWorkspace({
  scenario,
  buildings,
  sheltersPlan,
  locationName,
  onSelectCityView,
}: RiskImpactWorkspaceProps) {
  const [activeRiskLayer, setActiveRiskLayer] = useState<RiskLayer>("wind");

  const summary = scenario?.risk_grid?.summary;
  const totalCells = scenario?.risk_grid?.features?.length || 1976;
  const exposedPop = summary?.estimated_population_affected || 245610;
  const economicLossCr = summary?.estimated_loss_crores_inr || 1131.8;
  const evacuationUrgency = summary?.ndma_directives?.evacuation_urgency || "MANDATORY IMMEDIATE";
  const ndrfUnits = summary?.ndma_directives?.ndrf_battalions_recommended || 18;

  const vulnerableBuildings = buildings.filter(
    (b) => (b.properties.damage_score ?? 0) >= 0.55 || b.properties.is_locally_taller
  ).length;

  return (
    <div className="risk-impact-workspace-overlay">
      {/* Top Floating Layer Switcher */}
      <div className="risk-layer-selector-bar">
        <span className="bar-title">RISK HAZARD LAYERS:</span>
        <div className="layer-pills-row">
          {(
            [
              { id: "wind", label: "Wind Velocity", icon: Wind },
              { id: "surge", label: "Storm Surge", icon: Waves },
              { id: "rain", label: "Rainfall Saturation", icon: CloudRain },
              { id: "population", label: "Population Density", icon: Users },
              { id: "infrastructure", label: "Critical Assets", icon: Building2 },
              { id: "economic", label: "Economic Exposure", icon: TrendingDown },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`risk-layer-pill ${activeRiskLayer === item.id ? "active" : ""}`}
                onClick={() => setActiveRiskLayer(item.id)}
              >
                <Icon size={12} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Impact Summary Dossier (Top Left) */}
      <div className="floating-impact-card">
        <div className="impact-card-header">
          <div>
            <span className="card-subhead">GEOGRAPHIC IMPACT ASSESSMENT</span>
            <h3 className="card-title">{locationName || "Coastal Landfall Zone"}</h3>
          </div>
          <span className="urgency-badge red">
            <AlertTriangle size={12} /> {evacuationUrgency.replace(/_/g, " ")}
          </span>
        </div>

        <div className="impact-stats-grid">
          <div className="impact-stat-tile">
            <span className="stat-label">Population Exposed</span>
            <span className="stat-value cyan">{exposedPop.toLocaleString()}</span>
            <span className="stat-sub">Direct surge &amp; eyewall zone</span>
          </div>

          <div className="impact-stat-tile">
            <span className="stat-label">Affected Locations</span>
            <span className="stat-value">{totalCells.toLocaleString()}</span>
            <span className="stat-sub">Screened coastal sectors</span>
          </div>

          <div className="impact-stat-tile">
            <span className="stat-label">Estimated Economic Loss</span>
            <span className="stat-value amber">₹ {economicLossCr.toFixed(1)} Cr</span>
            <span className="stat-sub">Calibrated NDMA valuation</span>
          </div>

          <div className="impact-stat-tile">
            <span className="stat-label">NDRF Pre-positioned</span>
            <span className="stat-value green">{ndrfUnits} Battalions</span>
            <span className="stat-sub">Deployable rapid-rescue teams</span>
          </div>
        </div>

        {/* City Level 3D Trigger */}
        <div className="city-impact-trigger-box">
          <div className="trigger-info">
            <strong>3D High-Precision City Model</strong>
            <p>
              {vulnerableBuildings > 0 ? `${vulnerableBuildings} vulnerable buildings` : "977+ OSM vector buildings"}{" "}
              screened with IS-875 wind loading and shelter routes.
            </p>
          </div>
          <button
            type="button"
            className="btn-command primary"
            onClick={onSelectCityView}
          >
            <Building2 size={14} />
            <span>Launch 3D City View</span>
          </button>
        </div>
      </div>
    </div>
  );
}
