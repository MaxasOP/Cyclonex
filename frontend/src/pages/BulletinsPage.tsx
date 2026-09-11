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
    ports: ["Paradip Major Port", "Dhamra Port", "Gopalpur Port"],
    meaning: "Severe cyclonic storm expected to cross coast over or very close to the port. Extreme winds (>120 km/h) & surge imminent.",
    severity: "critical",
  },
  {
    signalNumber: 8,
    name: "Great Danger Signal No. VIII",
    flagCode: "GD-VIII",
    ports: ["Visakhapatnam Port", "Gangavaram Port"],
    meaning: "Severe cyclonic storm expected to cross coast keeping port to the left of its track.",
    severity: "high",
  },
  {
    signalNumber: 4,
    name: "Local Warning Signal No. IV",
    flagCode: "LW-IV",
    ports: ["Kolkata / Haldia Dock Complex", "Chennai Port", "Ennore Port"],
    meaning: "Port threatened by squally weather / cyclonic storm, but not expected to be directly crossed.",
    severity: "medium",
  },
  {
    signalNumber: 2,
    name: "Distant Warning Signal No. II",
    flagCode: "DW-II",
    ports: ["Mormugao Port", "Mumbai Port Trust", "Kandla Port"],
    meaning: "Cyclonic storm in deep open sea. Ships leaving port advised to exercise caution.",
    severity: "low",
  },
];

const DISTRICT_ALERTS = [
  {
    district: "Jagatsinghpur",
    state: "Odisha",
    color: "RED",
    windGustKph: "135–150",
    surgeM: "3.2m – 4.1m",
    action: "Mandatory In-Shelter Curfew. Complete evacuation of 0-3 km belt.",
    vulnerablePop: "185,000",
  },
  {
    district: "Kendrapara",
    state: "Odisha",
    color: "RED",
    windGustKph: "120–140",
    surgeM: "2.8m – 3.6m",
    action: "Evacuation of low-lying riverine delta villages to MPCS shelters.",
    vulnerablePop: "210,000",
  },
  {
    district: "Bhadrak",
    state: "Odisha",
    color: "ORANGE",
    windGustKph: "100–120",
    surgeM: "1.8m – 2.5m",
    action: "Pre-position NDRF boats and power restoration taskforces.",
    vulnerablePop: "140,000",
  },
  {
    district: "East Medinipur (Digha)",
    state: "West Bengal",
    color: "ORANGE",
    windGustKph: "90–115",
    surgeM: "1.5m – 2.2m",
    action: "Beachfront access prohibited. Coastal tourist resorts evacuated.",
    vulnerablePop: "165,000",
  },
  {
    district: "Puri",
    state: "Odisha",
    color: "YELLOW",
    windGustKph: "75–90",
    surgeM: "0.8m – 1.4m",
    action: "Continuous monitoring; fishermen banned from entering sea.",
    vulnerablePop: "95,000",
  },
];

export default function BulletinsPage({
  stormName,
  lat,
  lon,
  windKph,
  pressureHpa,
  headingDeg,
  speedKph,
  mlResult,
  onNavigateToCommand,
}: BulletinsPageProps) {
  const [activeTab, setActiveTab] = useState<"sitrep" | "ports" | "fishermen" | "districts">("sitrep");
  const bulletinTimestamp = new Date().toUTCString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-tag">
            <AlertOctagon size={14} className="text-red-400 animate-pulse" />
            <span>OFFICIAL EMERGENCY BULLETINS & SITREP</span>
          </div>
          <h1 className="page-title">National Warning Bulletins & Port Signals</h1>
          <p className="page-subtitle">
            Synchronized coastal disaster advisories, port warning signal flags, deep-sea marine warnings, and printable incident situation reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
          >
            <Printer size={14} />
            <span>Print SITREP</span>
          </button>
          <button
            onClick={onNavigateToCommand}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-900/50"
          >
            <MapPin size={14} />
            <span>Open Tactical Map</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 mb-6 max-w-xl">
        <button
          onClick={() => setActiveTab("sitrep")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "sitrep" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText size={14} />
          <span>Official SITREP</span>
        </button>
        <button
          onClick={() => setActiveTab("ports")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "ports" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Anchor size={14} />
          <span>Port Warning Flags</span>
        </button>
        <button
          onClick={() => setActiveTab("districts")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "districts" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldAlert size={14} />
          <span>District Alerts</span>
        </button>
        <button
          onClick={() => setActiveTab("fishermen")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "fishermen" ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Fish size={14} />
          <span>Fishermen Marine</span>
        </button>
      </div>

      {/* SITREP VIEW */}
      {activeTab === "sitrep" && (
        <div className="analytics-card print:border-none print:shadow-none bg-slate-950/90 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div>
              <div className="text-[11px] font-mono text-cyan-400 tracking-wider">CYCLONEX NATIONAL CYCLONE WARNING CENTRE (RSMC)</div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
                CYCLONE SITUATION REPORT (SITREP) — {stormName.toUpperCase()}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-slate-300">BULLETIN NO: CX-NIO-04</div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 justify-end">
                <Clock size={11} /> {bulletinTimestamp}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 mb-6 text-xs">
            <div>
              <span className="text-slate-400 block">Observed Center</span>
              <span className="text-white font-mono font-bold text-sm">
                {lat.toFixed(2)}°N, {lon.toFixed(2)}°E
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Sustained Wind Speed</span>
              <span className="text-cyan-400 font-mono font-bold text-sm">
                {windKph} km/h ({Math.round(windKph / 1.852)} knots)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Central Pressure</span>
              <span className="text-white font-mono font-bold text-sm">{pressureHpa} hPa</span>
            </div>
            <div>
              <span className="text-slate-400 block">Track Movement</span>
              <span className="text-emerald-400 font-mono font-bold text-sm">
                {headingDeg}° @ {speedKph} km/h
              </span>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1 text-cyan-400">1. Intensity & Synoptic Assessment</h3>
              <p>
                The Severe Cyclonic Storm <strong>&quot;{stormName}&quot;</strong> over the North-Western Bay of Bengal has maintained steady rapid intensification, exhibiting well-defined CDO cloud curvature with Dvorak T-Number {mlResult?.dvorak_t_number ?? "4.5"}. The Holland pressure deficit indicates central pressure of {pressureHpa} hPa surrounded by strong pressure gradient forces.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1 text-cyan-400">2. Track & Landfall Trajectory</h3>
              <p>
                The system is forecast to continue tracking north-northwestward at ~{speedKph} km/h. Coastal landfall is projected between Paradip and Dhamra Port within the next 18 to 24 hours with peak sustained wind speeds reaching 130–145 km/h gusting to 160 km/h.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1 text-cyan-400">3. Storm Surge Inundation Warning</h3>
              <p>
                Storm surge of height about <strong>2.5 to 4.2 metres</strong> above astronomical tide is likely to inundate low-lying coastal areas of Jagatsinghpur, Kendrapara, and Bhadrak districts during the time of landfall.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1 text-cyan-400">4. Action Triggered for Disaster Management Authorities</h3>
              <p>
                • Total suspension of maritime shipping, fishing, and port cargo handling operations.<br />
                • Mandatory evacuation of coastal wards within 5 km zone to designated Multipurpose Cyclone Shelters (MPCS).<br />
                • Pre-positioning of NDRF/SDRF teams with satellite phones and flood rescue zodiac boats.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PORT SIGNALS VIEW */}
      {activeTab === "ports" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-300 mb-2">
            Standard port warning signals hoisted across Indian Maritime Board and Port Trust harbors in accordance with IMD/MoS guidelines.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PORT_SIGNALS.map((port) => (
              <div
                key={port.signalNumber}
                className={`p-4 rounded-xl border ${
                  port.severity === "critical"
                    ? "bg-red-950/20 border-red-500/40"
                    : port.severity === "high"
                    ? "bg-orange-950/20 border-orange-500/40"
                    : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                        port.severity === "critical"
                          ? "bg-red-500/20 text-red-400"
                          : port.severity === "high"
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      SIGNAL {port.signalNumber} ({port.flagCode})
                    </span>
                    <h3 className="text-sm font-semibold text-white">{port.name}</h3>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-3 leading-relaxed">{port.meaning}</p>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block mb-1">Affected Ports:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {port.ports.map((p) => (
                      <span key={p} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DISTRICT ALERTS VIEW */}
      {activeTab === "districts" && (
        <div className="analytics-card">
          <h2 className="text-base font-bold text-white mb-4">District-Level Cyclone Hazard Matrix</h2>
          <div className="overflow-x-auto">
            <table className="forecast-table">
              <thead>
                <tr>
                  <th>District / State</th>
                  <th>Alert Level</th>
                  <th>Wind Gusts</th>
                  <th>Expected Surge</th>
                  <th>Vulnerable Population</th>
                  <th>Mandated Response</th>
                </tr>
              </thead>
              <tbody>
                {DISTRICT_ALERTS.map((dist) => (
                  <tr key={dist.district}>
                    <td className="font-semibold text-white">
                      {dist.district}, <span className="text-slate-400 font-normal">{dist.state}</span>
                    </td>
                    <td>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          dist.color === "RED"
                            ? "bg-red-500/20 text-red-400 border border-red-500/40"
                            : dist.color === "ORANGE"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                            : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                        }`}
                      >
                        {dist.color} ALERT
                      </span>
                    </td>
                    <td className="font-mono text-cyan-400">{dist.windGustKph} km/h</td>
                    <td className="font-mono text-amber-400">{dist.surgeM}</td>
                    <td className="font-mono text-slate-200">{dist.vulnerablePop}</td>
                    <td className="text-xs text-slate-300 max-w-xs">{dist.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FISHERMEN VIEW */}
      {activeTab === "fishermen" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/20 flex items-start gap-3">
            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-bold text-red-300">TOTAL PROHIBITION OF SEA VENTURING (ODISHA & WEST BENGAL COASTS)</h3>
              <p className="text-xs text-slate-300 mt-1">
                Sea condition will be <strong>HIGH to PHENOMENAL</strong> over North and adjoining Central Bay of Bengal. Fishermen are strictly advised not to venture into North and Westcentral Bay of Bengal. Those out at deep sea are advised to return to coast immediately.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">North Bay of Bengal</h4>
              <div className="text-sm font-bold text-red-400 mb-1">PHENOMENAL (Wave Ht &gt; 9.0m)</div>
              <p className="text-xs text-slate-400">Zero maritime navigation permitted. Heavy rolling and extreme spray.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">Westcentral Bay of Bengal</h4>
              <div className="text-sm font-bold text-orange-400 mb-1">VERY HIGH (Wave Ht 6.0m – 9.0m)</div>
              <p className="text-xs text-slate-400">Dangerous squalls with wind force 9 to 11 on Beaufort Scale.</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">South Andhra Coast</h4>
              <div className="text-sm font-bold text-yellow-400 mb-1">ROUGH (Wave Ht 2.5m – 4.0m)</div>
              <p className="text-xs text-slate-400">Small craft advisory in effect. Caution advised near harbor entrances.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
