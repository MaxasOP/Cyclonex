import React, { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldAlert,
  ArrowUpRight,
  Printer,
  Radio,
  Clock,
  Compass,
} from "lucide-react";

export interface AlertItem {
  id: string;
  severity: "critical" | "high" | "moderate" | "info";
  cycloneName: string;
  location: string;
  time: string;
  title: string;
  action: string;
  lat: number;
  lon: number;
  presetKey?: string;
}

export interface AlertsOperationsWorkspaceProps {
  onViewOnMap: (lat: number, lon: number, presetKey?: string) => void;
  onExportSitrep: () => void;
  activeCycloneName: string;
  currentWindKph: number;
  currentPressureHpa: number;
}

export default function AlertsOperationsWorkspace({
  onViewOnMap,
  onExportSitrep,
  activeCycloneName,
  currentWindKph,
  currentPressureHpa,
}: AlertsOperationsWorkspaceProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const ALERTS: AlertItem[] = [
    {
      id: "ALT-01",
      severity: "critical",
      cycloneName: activeCycloneName || "Cyclone Nisarga",
      location: "Raigad / Alibag Coast, Maharashtra (18.35°N, 72.98°E)",
      time: "23:30 IST · Zero Hour -6h",
      title: "Landfall eyewall collision with peak wind speeds exceeding 120 km/h and 3.2m surge",
      action: "Mandatory coastal evacuation across wards 1–8. Instate Signal 10 Great Danger at JNPT Port.",
      lat: 18.35,
      lon: 72.98,
      presetKey: "nisarga",
    },
    {
      id: "ALT-02",
      severity: "critical",
      cycloneName: activeCycloneName || "Cyclone Nisarga",
      location: "Mumbai Coastal Highway & Harbor Substation Grid",
      time: "22:45 IST · Active Advisory",
      title: "Dynamic wind pressure loading exceeding IS-875 safety margins for transmission towers",
      action: "Trigger automatic 33kV/11kV electrical grid de-energization 2 hours prior to 100 km/h wind perimeter.",
      lat: 18.92,
      lon: 72.83,
      presetKey: "nisarga",
    },
    {
      id: "ALT-03",
      severity: "high",
      cycloneName: "Cyclone Biparjoy",
      location: "Kutch & Saurashtra Coastline, Gujarat (23.25°N, 68.80°E)",
      time: "21:15 IST · Advisory",
      title: "Extremely Severe Cyclonic Storm track approach with severe sea conditions",
      action: "Complete suspension of fishing trawlers; pre-position 12 NDRF battalions at Mandvi and Kandla.",
      lat: 23.25,
      lon: 68.8,
      presetKey: "biparjoy",
    },
    {
      id: "ALT-04",
      severity: "high",
      cycloneName: "Cyclone Amphan",
      location: "Digha & Sundarbans Delta, West Bengal (21.62°N, 87.51°E)",
      time: "19:00 IST · Benchmark Archive",
      title: "Category 5 equivalent super cyclone historical benchmark verification",
      action: "Review MPCS reinforced shelter occupancy and verify tidal surge dyke resistance.",
      lat: 21.62,
      lon: 87.51,
      presetKey: "amphan",
    },
    {
      id: "ALT-05",
      severity: "moderate",
      cycloneName: "Cyclone Dana",
      location: "Dhamra Port & Bhadrak Coast, Odisha (20.90°N, 86.95°E)",
      time: "18:20 IST · Monitoring",
      title: "Severe cyclonic system developing westward convective bandings",
      action: "Maintain standby emergency communications over satellite phones; ready diesel generator mobile units.",
      lat: 20.9,
      lon: 86.95,
      presetKey: "dana",
    },
    {
      id: "ALT-06",
      severity: "info",
      cycloneName: "INSAT-3DR / GPM Satellite Feed",
      location: "North Indian Ocean Basin (Bay of Bengal & Arabian Sea)",
      time: "23:35 IST · Telemetry Log",
      title: "Multi-spectral 15-minute rapid scan ingestion and optical co-registration verified",
      action: "Automated neural inference pipeline active; empirical uncertainty ±9.6 km at +6h horizon.",
      lat: 15.0,
      lon: 80.0,
    },
  ];

  const filtered = filterSeverity === "all" ? ALERTS : ALERTS.filter((a) => a.severity === filterSeverity);

  return (
    <div className="alerts-operations-workspace">
      <div className="workspace-header-bar">
        <div className="header-left">
          <div className="workspace-icon-pill alert-pill">
            <ShieldAlert size={15} />
            <span>OPERATIONAL ALERTS &amp; NDMA DIRECTIVES</span>
          </div>
          <span className="telemetry-badge">
            {ALERTS.filter((a) => a.severity === "critical").length} CRITICAL · {ALERTS.length} TOTAL ALERTS
          </span>
        </div>

        <div className="workspace-toggle-group">
          {(["all", "critical", "high", "moderate", "info"] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              className={`toggle-pill ${filterSeverity === sev ? "active" : ""}`}
              onClick={() => setFilterSeverity(sev)}
            >
              {sev.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="header-right">
          <button
            type="button"
            className="btn-command primary"
            onClick={onExportSitrep}
          >
            <Printer size={14} />
            <span>Export Official SITREP (PDF)</span>
          </button>
        </div>
      </div>

      {/* Alerts Feed List */}
      <div className="alerts-feed-container">
        {filtered.map((alert) => (
          <div key={alert.id} className={`alert-card-row severity-${alert.severity}`}>
            <div className="alert-severity-indicator">
              {alert.severity === "critical" && <AlertOctagon size={20} className="icon-critical" />}
              {alert.severity === "high" && <AlertTriangle size={20} className="icon-high" />}
              {alert.severity === "moderate" && <ShieldAlert size={20} className="icon-moderate" />}
              {alert.severity === "info" && <Info size={20} className="icon-info" />}
              <span className="severity-badge-text">{alert.severity.toUpperCase()}</span>
            </div>

            <div className="alert-content-body">
              <div className="alert-title-row">
                <span className="alert-cyclone-tag">{alert.cycloneName}</span>
                <span className="alert-location">{alert.location}</span>
                <span className="alert-time">
                  <Clock size={11} /> {alert.time}
                </span>
              </div>

              <div className="alert-description">{alert.title}</div>

              <div className="alert-directive-box">
                <span className="directive-label">RECOMMENDED NDMA PROTOCOL:</span>
                <p className="directive-text">{alert.action}</p>
              </div>
            </div>

            <div className="alert-action-col">
              <button
                type="button"
                className="btn-view-map"
                onClick={() => onViewOnMap(alert.lat, alert.lon, alert.presetKey)}
              >
                <span>VIEW ON MAP</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
