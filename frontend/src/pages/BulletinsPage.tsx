import { useState } from "react";
import {
  AlertOctagon,
  Printer,
  Share2,
  Anchor,
  Fish,
  ShieldAlert,
  Clock,
  MapPin,
  Wind,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  Activity
} from "lucide-react";
import type { MLInferenceResult } from "../api";

interface BulletinsPageProps {
  stormName: string;
  lat: number;
  lon: number;
  windKph: number;
  pressureHpa: number;
  headingDeg: number;
  speedKph: number;
  mlResult: MLInferenceResult | null;
  onNavigateToCommand: () => void;
}

interface PortSignal {
  signalNumber: number;
  name: string;
  flagCode: string;
  ports: string[];
  meaning: string;
  severity: "low" | "medium" | "high" | "critical";
}

const PORT_SIGNALS: PortSignal[] = [
  {
    signalNumber: 10,
    name: "Great Danger Signal No. X",
    flagCode: "GD-X",
    ports: ["Jawaharlal Nehru Port (JNPT)", "Mumbai Port Trust", "Dharamtar Port"],
    meaning: "Severe cyclonic storm expected to cross coast over or very close to the port. Extreme winds (>120 km/h) & surge imminent.",
    severity: "critical",
  },
  {
    signalNumber: 8,
    name: "Great Danger Signal No. VIII",
    flagCode: "GD-VIII",
    ports: ["Dighi Port", "Jaigad Port"],
    meaning: "Severe cyclonic storm expected to cross coast keeping port to the left of its track.",
    severity: "high",
  },
  {
    signalNumber: 4,
    name: "Local Warning Signal No. IV",
    flagCode: "LW-IV",
    ports: ["Kandla Port", "Mormugao Port"],
    meaning: "Port threatened by squally weather / cyclonic storm, but not expected to be directly crossed.",
    severity: "medium",
  },
  {
    signalNumber: 2,
    name: "Distant Warning Signal No. II",
    flagCode: "DW-II",
    ports: ["Cochin Port", "Mangalore Port"],
    meaning: "Cyclonic storm in deep open sea. Ships leaving port advised to exercise caution.",
    severity: "low",
  },
];

interface OperationalEvent {
  id: string;
  time: string;
  source: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  title: string;
  summary: string;
  details: string;
}

const OPERATIONAL_EVENTS: OperationalEvent[] = [
  {
    id: "ev-1",
    time: "06:00 UTC · T-0H (NOW)",
    source: "IMD Cyclone Warning Division",
    severity: "CRITICAL",
    title: "Very Severe Cyclonic Storm NISARGA — Landfall Warning (Red Alert)",
    summary: "Eye located at 18.35°N 72.98°E. Landfall expected within 2 hours near Alibaug coast.",
    details: "Sustained winds 120 km/h gusting to 135 km/h. Astronomical high tide of 4.2m combined with 1.5m storm surge will inundate low-lying coastal belts of Raigad district. Total suspension of marine fishing operations enforced.",
  },
  {
    id: "ev-2",
    time: "03:30 UTC · T-2.5H",
    source: "Maharashtra Maritime Board",
    severity: "HIGH",
    title: "Great Danger Signal No. X Hoisted at JNPT and Mumbai Anchorage",
    summary: "All cargo handling, pilotage, and container crane operations suspended indefinitely.",
    details: "Vessels at berth directed to double mooring hawsers. Outer anchorage vessels directed to heave anchor and steam to open deep-sea waters to avoid dragging anchor.",
  },
  {
    id: "ev-3",
    time: "01:00 UTC · T-5H",
    source: "INCOIS / NDMA",
    severity: "HIGH",
    title: "Storm Surge Inundation Watch Issued for Revdanda & Alibag Creeks",
    summary: "Hydrodynamic surge modeling projects water runup penetrating 1.8 km inland.",
    details: "Evacuation of 4,820 residents from Kutcha coastal housing to designated MPCS facilities in Ward 1 and Ward 2 completed by SDRF/NDRF 5th Battalion.",
  },
  {
    id: "ev-4",
    time: "21:00 UTC (T-9H)",
    source: "District Disaster Management Authority (Raigad)",
    severity: "MEDIUM",
    title: "Pre-Evacuation Advisory and Highway Traffic Diversion Notice",
    summary: "Coastal causeway Beta closed to vehicular traffic; Route Alpha designated primary corridor.",
    details: "Medical triage centers activated at Alibag Civil Hospital and Pen Sub-district Hospital. Emergency diesel generation reserves confirmed at 100% across all 28 shelters.",
  },
];

export default function BulletinsPage({
  stormName,
  lat,
  lon,
  windKph,
  pressureHpa,
  onNavigateToCommand,
}: BulletinsPageProps) {
  const [expandedEventId, setExpandedEventId] = useState<string>("ev-1");
  const [activeSignalFilter, setActiveSignalFilter] = useState<string>("ALL");

  const handlePrintSitrep = () => {
    window.print();
  };

  return (
    <div className="op-showcase-root">
      <div className="op-showcase-container">

        {/* Editorial Header */}
        <div className="op-editorial-header" style={{ marginBottom: "20px" }}>
          <div>
            <div className="op-section-kicker">
              <AlertOctagon size={12} style={{ display: "inline", marginRight: "6px" }} />
              OPERATIONAL SITUATION LOG &middot; NDMA SITREP
            </div>
            <h1 className="op-section-title" style={{ fontSize: "28px" }}>
              Port Warnings &amp; Operational Stream
            </h1>
            <p className="op-section-desc" style={{ marginBottom: "0" }}>
              Real-time maritime advisory stream, Indian Maritime Board Port Warning Signals (1–11),
              and official printable NDMA Situation Reports (SITREP).
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="op-btn-secondary"
              onClick={onNavigateToCommand}
              style={{ fontSize: "12px", padding: "8px 14px" }}
            >
              <Activity size={13} />
              <span>Tactical Map Console</span>
            </button>
            <button
              type="button"
              className="op-btn-primary"
              onClick={handlePrintSitrep}
              style={{ fontSize: "12px", padding: "8px 14px" }}
            >
              <Printer size={13} />
              <span>Print Official SITREP</span>
            </button>
          </div>
        </div>

        {/* Top Active Port Signal Banner */}
        <div style={{
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "4px",
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "44px",
              height: "44px",
              background: "#ef4444",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "16px",
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              X
            </div>
            <div>
              <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#ffffff" }}>
                GREAT DANGER SIGNAL NO. 10 ACTIVE
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                Ports of JNPT &amp; Mumbai Anchorage under direct landfall trajectory &middot; All marine operations suspended
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
            <div>Vmax: <strong style={{ color: "#38bdf8" }}>{windKph} km/h</strong></div>
            <div>Pressure: <strong style={{ color: "#f59e0b" }}>{pressureHpa} hPa</strong></div>
            <div>Status: <strong style={{ color: "#ef4444" }}>RED ALERT</strong></div>
          </div>
        </div>

        {/* Main Grid: Operational Timeline Stream (Left) & Port Warning Signals (Right) */}
        <div className="op-split-grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", gap: "28px" }}>
          
          {/* Left: Operational Situation Stream Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Clock size={14} style={{ color: "#38bdf8" }} />
                  <span>CHRONOLOGICAL SITUATION STREAM</span>
                </div>
                <span className="op-tech-panel-badge">LIVE FEED</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {OPERATIONAL_EVENTS.map(ev => {
                  const isExpanded = ev.id === expandedEventId;
                  const sevColor = ev.severity === "CRITICAL" ? "#ef4444" : ev.severity === "HIGH" ? "#f59e0b" : "#38bdf8";

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setExpandedEventId(isExpanded ? "" : ev.id)}
                      style={{
                        padding: "12px 14px",
                        background: isExpanded ? "rgba(56, 189, 248, 0.05)" : "rgba(255, 255, 255, 0.02)",
                        border: "1px solid",
                        borderColor: isExpanded ? "#38bdf8" : "rgba(255, 255, 255, 0.06)",
                        borderLeft: `3px solid ${sevColor}`,
                        borderRadius: "3px",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#64748b" }}>
                          {ev.time} &middot; {ev.source}
                        </span>
                        <span style={{ fontSize: "9px", fontFamily: "'JetBrains Mono', monospace", color: sevColor, fontWeight: 700 }}>
                          {ev.severity}
                        </span>
                      </div>

                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: isExpanded ? "#ffffff" : "#cbd5e1", marginBottom: "4px" }}>
                        {ev.title}
                      </div>

                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {ev.summary}
                      </div>

                      {isExpanded && (
                        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "11px", color: "#64748b", lineHeight: 1.55 }}>
                          {ev.details}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Port Warning Signals Matrix & Marine Directives */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Port Signals Matrix */}
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Anchor size={14} style={{ color: "#38bdf8" }} />
                  <span>PORT WARNING SIGNALS (1–11)</span>
                </div>
                <span className="op-tech-panel-badge">MARITIME BOARD</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {PORT_SIGNALS.map(ps => {
                  const sevColor = ps.severity === "critical" ? "#ef4444" : ps.severity === "high" ? "#f59e0b" : ps.severity === "medium" ? "#38bdf8" : "#10b981";

                  return (
                    <div
                      key={ps.signalNumber}
                      className="op-port-signal-card"
                      style={{ borderLeft: `3px solid ${sevColor}` }}
                    >
                      <div className="op-port-signal-flag" style={{ background: sevColor, color: "#ffffff" }}>
                        {ps.signalNumber}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#ffffff", marginBottom: "2px" }}>
                          {ps.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "4px" }}>
                          Ports: {ps.ports.join(", ")}
                        </div>
                        <div style={{ fontSize: "10.5px", color: "#64748b", lineHeight: 1.4 }}>
                          {ps.meaning}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Marine Prohibition Notice */}
            <div className="op-technical-panel">
              <div className="op-tech-panel-header">
                <div className="op-tech-panel-title">
                  <Fish size={14} style={{ color: "#ef4444" }} />
                  <span>FISHERIES MARINE PROHIBITION</span>
                </div>
                <span className="op-tech-panel-badge" style={{ color: "#ef4444", borderColor: "#ef4444" }}>ENFORCED</span>
              </div>

              <div style={{ fontSize: "11.5px", color: "#94a3b8", lineHeight: 1.5, marginBottom: "10px" }}>
                Complete ban on deep-sea and coastal mechanized fishing along Maharashtra and South Gujarat coasts
                until further notice.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ padding: "6px", background: "#03060a", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b" }}>HARBOR RECALL</div>
                  <div style={{ color: "#10b981", fontWeight: 700 }}>100% BOATS IN PORT</div>
                </div>
                <div style={{ padding: "6px", background: "#03060a", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#64748b" }}>COAST GUARD PATROL</div>
                  <div style={{ color: "#38bdf8", fontWeight: 700 }}>ACTIVE AIR/SEA</div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
