import React from "react";
import {
  Server,
  Database,
  Radio,
  CheckCircle2,
  Clock,
  Wifi,
  Cpu,
  Globe,
  RefreshCw,
  HardDrive,
} from "lucide-react";

export default function DataSourcesWorkspace() {
  const DATA_FEEDS = [
    {
      id: "FEED-01",
      name: "ISRO INSAT-3DR Rapid Scan",
      type: "Geostationary Satellite",
      coverage: "Bay of Bengal & Arabian Sea (74.0°E)",
      freshness: "15 min scan interval",
      lastUpdated: "3 mins ago (23:32 IST)",
      latency: "142 ms",
      status: "LIVE",
    },
    {
      id: "FEED-02",
      name: "NASA GPM IMERG Precipitation",
      type: "LEO Constellation Microwave Radar",
      coverage: "Global Tropical Precipitation Grid (0.1°)",
      freshness: "30 min calibrated update",
      lastUpdated: "12 mins ago (23:23 IST)",
      latency: "210 ms",
      status: "LIVE",
    },
    {
      id: "FEED-03",
      name: "ESA Copernicus Sentinel-1 SAR",
      type: "C-Band Synthetic Aperture Radar",
      coverage: "Coastal Landfall Surface Inundation (10m)",
      freshness: "Pass-based scheduled acquisition",
      lastUpdated: "1 hour ago (22:30 IST)",
      latency: "380 ms",
      status: "LIVE",
    },
    {
      id: "FEED-04",
      name: "NOAA IBTrACS v04 Supervised Archive",
      type: "Historical Best-Track Database",
      coverage: "North Indian Ocean (1980–2024)",
      freshness: "Verified quality-controlled best tracks",
      lastUpdated: "Sync verified",
      latency: "12 ms (Local Cache)",
      status: "CONNECTED",
    },
    {
      id: "FEED-05",
      name: "HYCOM NCODA Ocean Dynamics",
      type: "Subsurface Hydrodynamic Model",
      coverage: "Ocean Thermal Barrier (Tb) & Vertical Flow (Vf)",
      freshness: "Daily assimilated profile (0.08°)",
      lastUpdated: "2 hours ago (21:30 IST)",
      latency: "85 ms",
      status: "CONNECTED",
    },
    {
      id: "FEED-06",
      name: "CYCLONEX PyTorch Neural Inference Engine",
      type: "Deep Learning Vision & Temporal Regressor",
      coverage: "In-memory tensor processing pipeline",
      freshness: "On-demand GPU/CPU inference (<35ms)",
      lastUpdated: "Continuous standby",
      latency: "28 ms",
      status: "ACTIVE",
    },
    {
      id: "FEED-07",
      name: "Local SQLite Spatio-Temporal Database",
      type: "ACID Relational Storage Engine",
      coverage: "Storm state vectors, shelters & GIS layers",
      freshness: "Zero-latency transactional commit",
      lastUpdated: "Live synchronized",
      latency: "2 ms",
      status: "ONLINE",
    },
  ];

  return (
    <div className="data-sources-workspace-page">
      <div className="workspace-header-bar">
        <div className="header-left">
          <div className="workspace-icon-pill sources-pill">
            <Server size={15} />
            <span>DATA SOURCES &amp; SYSTEM HEALTH</span>
          </div>
          <span className="telemetry-badge">7 SENSORS &amp; MODEL SERVICES CONNECTED</span>
        </div>

        <div className="header-right">
          <button type="button" className="btn-header-action" onClick={() => window.location.reload()}>
            <RefreshCw size={12} />
            <span>Refresh Health Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Sensor Feeds Grid */}
      <div className="sources-card-grid">
        {DATA_FEEDS.map((feed) => (
          <div key={feed.id} className="source-health-card">
            <div className="source-card-top">
              <div className="source-icon-box">
                <Radio size={16} />
              </div>
              <div className="source-title-block">
                <h4 className="source-name">{feed.name}</h4>
                <span className="source-type">{feed.type}</span>
              </div>
              <span className="source-live-badge">
                <span className="pulse-green-dot" />
                {feed.status}
              </span>
            </div>

            <div className="source-meta-grid">
              <div className="meta-item">
                <span className="meta-label">Geospatial Coverage:</span>
                <span className="meta-val">{feed.coverage}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Freshness Interval:</span>
                <span className="meta-val">{feed.freshness}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Last Ingestion:</span>
                <span className="meta-val">{feed.lastUpdated}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Network Latency:</span>
                <span className="meta-val highlight">{feed.latency}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
