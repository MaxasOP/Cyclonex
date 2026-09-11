import React, { useState, useRef, useEffect } from "react";
import { Layers, X, Check, Eye } from "lucide-react";

export interface LayerState {
  baseMap: "satellite" | "terrain" | "streets" | "dark";
  atmosphere: {
    cloud: boolean;
    wind: boolean;
    pressure: boolean;
    rainfall: boolean;
  };
  impact: {
    risk: boolean;
    population: boolean;
    infrastructure: boolean;
  };
  advanced: {
    physicsGrid: boolean;
    aiSegmentation: boolean;
  };
}

export interface GlobalLayersMenuProps {
  layers: LayerState;
  onChangeLayers: (next: LayerState) => void;
}

export default function GlobalLayersMenu({ layers, onChangeLayers }: GlobalLayersMenuProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleAtmosphere = (key: keyof LayerState["atmosphere"]) => {
    onChangeLayers({
      ...layers,
      atmosphere: { ...layers.atmosphere, [key]: !layers.atmosphere[key] },
    });
  };

  const toggleImpact = (key: keyof LayerState["impact"]) => {
    onChangeLayers({
      ...layers,
      impact: { ...layers.impact, [key]: !layers.impact[key] },
    });
  };

  const toggleAdvanced = (key: keyof LayerState["advanced"]) => {
    onChangeLayers({
      ...layers,
      advanced: { ...layers.advanced, [key]: !layers.advanced[key] },
    });
  };

  const setBaseMap = (base: LayerState["baseMap"]) => {
    onChangeLayers({ ...layers, baseMap: base });
  };

  return (
    <div className="global-layers-controller" ref={menuRef}>
      <button
        type="button"
        className={`btn-layers-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Layer Overlays"
      >
        <Layers size={14} />
        <span>LAYERS</span>
      </button>

      {isOpen && (
        <div className="layers-floating-popover">
          <div className="popover-header">
            <span className="popover-title">GEOSPATIAL DISPLAY LAYERS</span>
            <button
              type="button"
              className="popover-close-btn"
              onClick={() => setIsOpen(false)}
            >
              <X size={13} />
            </button>
          </div>

          <div className="popover-sections">
            {/* BASE MAP */}
            <div className="layer-group">
              <span className="group-heading">BASE MAP</span>
              <div className="radio-options-grid">
                {(["satellite", "terrain", "streets", "dark"] as const).map((bm) => (
                  <button
                    key={bm}
                    type="button"
                    className={`radio-pill ${layers.baseMap === bm ? "selected" : ""}`}
                    onClick={() => setBaseMap(bm)}
                  >
                    <span className="radio-indicator" />
                    <span>{bm.charAt(0).toUpperCase() + bm.slice(1)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ATMOSPHERE */}
            <div className="layer-group">
              <span className="group-heading">ATMOSPHERE</span>
              <div className="checkboxes-list">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.atmosphere.cloud}
                    onChange={() => toggleAtmosphere("cloud")}
                  />
                  <span>Cloud Texture &amp; Eye Structure</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.atmosphere.wind}
                    onChange={() => toggleAtmosphere("wind")}
                  />
                  <span>Surface Wind Vector Field</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.atmosphere.pressure}
                    onChange={() => toggleAtmosphere("pressure")}
                  />
                  <span>Isobaric Pressure Contours</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.atmosphere.rainfall}
                    onChange={() => toggleAtmosphere("rainfall")}
                  />
                  <span>GPM IMERG Rain Rate Bands</span>
                </label>
              </div>
            </div>

            {/* IMPACT */}
            <div className="layer-group">
              <span className="group-heading">IMPACT &amp; VULNERABILITY</span>
              <div className="checkboxes-list">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.impact.risk}
                    onChange={() => toggleImpact("risk")}
                  />
                  <span>Compound Damage Probability</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.impact.population}
                    onChange={() => toggleImpact("population")}
                  />
                  <span>Exposed Population Wards</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.impact.infrastructure}
                    onChange={() => toggleImpact("infrastructure")}
                  />
                  <span>Substations, Rails &amp; MPCS Shelters</span>
                </label>
              </div>
            </div>

            {/* ADVANCED */}
            <div className="layer-group">
              <span className="group-heading">ADVANCED RESEARCH</span>
              <div className="checkboxes-list">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.advanced.physicsGrid}
                    onChange={() => toggleAdvanced("physicsGrid")}
                  />
                  <span>200m Physics Raster Grid (Advanced)</span>
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={layers.advanced.aiSegmentation}
                    onChange={() => toggleAdvanced("aiSegmentation")}
                  />
                  <span>Neural Eyewall Segmentation Mask</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
