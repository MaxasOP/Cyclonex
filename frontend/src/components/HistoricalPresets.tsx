import React from "react";

export type PresetKey = "landfall_amphan" | "amphan" | "fani" | "bulbul" | "nisarga" | "custom";

type HistoricalPresetsProps = {
  presets: Record<
    PresetKey,
    { name: string; lat: string; lon: string; wind: string; pressure: string; source: string }
  >;
  selectedPreset: PresetKey;
  onSelectPreset: (key: PresetKey) => void;
};

export default function HistoricalPresets({
  presets,
  selectedPreset,
  onSelectPreset,
}: HistoricalPresetsProps) {
  return (
    <div className="eng-card">
      <div className="corner-marker" />
      <div className="panel-header">
        <div className="panel-title">
          <i>IBTRACS HISTORICAL STORM PRESETS</i>
        </div>
        <span className="badge badge-info">NORTH INDIAN OCEAN</span>
      </div>

      <div className="panel-body">
        <div className="preset-list">
          {(Object.keys(presets) as PresetKey[]).map((key) => {
            const p = presets[key];
            const isSelected = selectedPreset === key;
            return (
              <div
                key={key}
                className={`preset-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectPreset(key)}
              >
                <div>
                  <div className="preset-name" style={{ color: isSelected ? "#76B900" : "#FFFFFF" }}>
                    {isSelected && "▶ "}
                    {p.name.split("(")[0]}
                  </div>
                  <div className="preset-meta">
                    {p.lat}°N, {p.lon}°E · {p.wind} km/h · {p.pressure} hPa
                  </div>
                </div>

                <span className="badge badge-info" style={{ fontSize: "0.6rem" }}>
                  {p.source}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
