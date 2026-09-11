import React, { useState, useRef, useEffect } from "react";
import { Search, Compass, MapPin, Satellite, ArrowRight, X } from "lucide-react";

export interface CommandPaletteProps {
  onSelectPreset: (presetKey: string) => void;
  onSelectCoordinates?: (lat: number, lon: number, name: string) => void;
}

export default function CommandPalette({
  onSelectPreset,
  onSelectCoordinates,
}: CommandPaletteProps) {
  const [query, setQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const SEARCH_ITEMS = [
    { type: "cyclone", name: "Cyclone Nisarga", detail: "Maharashtra / Raigad Landfall (18.35°N, 72.98°E)", presetKey: "nisarga" },
    { type: "cyclone", name: "Cyclone Biparjoy", detail: "Gujarat / Kutch Landfall (23.25°N, 68.80°E)", presetKey: "biparjoy" },
    { type: "cyclone", name: "Cyclone Dana", detail: "Odisha Coast / Dhamra (20.90°N, 86.95°E)", presetKey: "dana" },
    { type: "cyclone", name: "Cyclone Amphan", detail: "West Bengal / Digha (21.62°N, 87.51°E)", presetKey: "amphan" },
    { type: "cyclone", name: "Cyclone Fani", detail: "Odisha / Puri Landfall (19.81°N, 85.83°E)", presetKey: "fani" },
    { type: "cyclone", name: "Cyclone Hudhud", detail: "Andhra Pradesh / Visakhapatnam (17.68°N, 83.21°E)", presetKey: "hudhud" },
    { type: "city", name: "Mumbai Metropolitan Region", detail: "Maharashtra Coastline (18.92°N, 72.83°E)", lat: 18.92, lon: 72.83 },
    { type: "city", name: "Puri Coastal District", detail: "Odisha Landfall Corridor (19.81°N, 85.83°E)", lat: 19.81, lon: 85.83 },
    { type: "city", name: "Digha Coastal Corridor", detail: "West Bengal Coastal Zone (21.62°N, 87.51°E)", lat: 21.62, lon: 87.51 },
    { type: "sensor", name: "INSAT-3DR Geostationary", detail: "74.0°E Rapid-Scan Optical Sensor", channel: "IR" },
    { type: "sensor", name: "NASA GPM IMERG Microwave", detail: "0.1° Calibrated Precipitation Sensor", channel: "MW" },
  ];

  const filtered = SEARCH_ITEMS.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.detail.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: (typeof SEARCH_ITEMS)[0]) => {
    if (item.presetKey) {
      onSelectPreset(item.presetKey);
    } else if (item.lat && item.lon) {
      onSelectCoordinates?.(item.lat, item.lon, item.name);
    }
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="global-command-palette-wrapper" ref={containerRef}>
      <div className="command-input-container">
        <Search size={14} className="palette-search-icon" />
        <input
          type="text"
          className="palette-search-input"
          placeholder="Search cyclone, city, coordinates, satellite..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button
            type="button"
            className="palette-clear-btn"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="palette-results-dropdown">
          <div className="dropdown-category-label">SEARCH RESULTS</div>
          {filtered.map((item) => (
            <div
              key={item.name}
              className="palette-result-item"
              onClick={() => handleSelect(item)}
            >
              <div className="result-item-icon">
                {item.type === "cyclone" && <Compass size={13} />}
                {item.type === "city" && <MapPin size={13} />}
                {item.type === "sensor" && <Satellite size={13} />}
              </div>
              <div className="result-item-meta">
                <span className="result-name">{item.name}</span>
                <span className="result-detail">{item.detail}</span>
              </div>
              <ArrowRight size={12} className="result-jump-arrow" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
