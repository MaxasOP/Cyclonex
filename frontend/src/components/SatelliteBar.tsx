import React from "react";

type SatelliteBarProps = {
  selectedSource: string;
  setSelectedSource: (source: string) => void;
  onOpenSatelliteModal: () => void;
};

const satelliteSources = [
  { id: "HURSAT_B1", label: "NOAA HURSAT-B1", type: "Geostationary IR", res: "8 km / 30 min" },
  { id: "INSAT", label: "INSAT-3D/3DR", type: "Multispectral IR/Vis", res: "1 km / 15 min" },
  { id: "GPM_IMERG", label: "GPM IMERG", type: "Precipitation Radar", res: "0.1° / 30 min" },
  { id: "SENTINEL_1", label: "Sentinel-1 SAR", type: "C-band Backscatter", res: "10 m SAR" },
];

export default function SatelliteBar({
  selectedSource,
  setSelectedSource,
  onOpenSatelliteModal,
}: SatelliteBarProps) {
  return (
    <div className="eng-card">
      <div className="corner-marker" />
      <div className="panel-header">
        <div className="panel-title">
          <i>SATELLITE INGESTION SYSTEM</i>
        </div>
        <span className="badge badge-signal">MULTI-SOURCE SATELLITE</span>
      </div>

      <div className="panel-body">
        <div className="eng-form-group">
          <label className="eng-label">ACTIVE SATELLITE SENSOR CONSTELLATION</label>
          <select
            className="eng-select"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            {satelliteSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.type} - {s.res})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn-secondary"
          style={{ width: "100%", marginTop: 2 }}
          onClick={onOpenSatelliteModal}
        >
          👁️ INSPECT CINEMATIC SATELLITE SCENE
        </button>
      </div>
    </div>
  );
}
