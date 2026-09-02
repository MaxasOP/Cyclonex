import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer, useMap as useLeafletMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { BuildingFeature, RiskFeature } from "./api";

export type TrajectoryPoint = {
  lat: number;
  lng: number;
  label: string;
  uncertaintyKm?: number;
};

type RiskMapProps = {
  center: { lat: number; lng: number };
  features: RiskFeature[];
  buildings: BuildingFeature[];
  trajectory?: TrajectoryPoint[];
  selectedSource?: string;
};

function GoogleDataLayer({
  features,
  kind,
}: {
  features: RiskFeature[] | BuildingFeature[];
  kind: "risk" | "building";
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !features.length) return;
    const added = map.data.addGeoJson({ type: "FeatureCollection", features } as never);
    map.data.setStyle((feature: google.maps.Data.Feature) => ({
      fillColor: String(feature.getProperty(kind === "risk" ? "colour" : "display_colour")),
      fillOpacity: kind === "risk" ? 0.58 : 0.88,
      strokeColor:
        kind === "building" && feature.getProperty("is_locally_taller") ? "#76B900" : "#111111",
      strokeOpacity: kind === "risk" ? 0.6 : 1,
      strokeWeight: kind === "risk" ? 0.8 : 1.5,
      clickable: true,
    }));
    return () => added.forEach((feature) => map.data.remove(feature));
  }, [map, features]);

  return null;
}

function LeafletRecenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useLeafletMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], 9);
  }, [map, center]);
  return null;
}

function LeafletRiskMap({ center, features, buildings, trajectory, selectedSource }: RiskMapProps) {
  const polylineCoords = (trajectory || []).map((t) => [t.lat, t.lng] as [number, number]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={9}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%", minHeight: "640px", backgroundColor: "#03080F" }}
    >
      <LeafletRecenter center={center} />

      {/* High Contrast Dark Basemap Tiles */}
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Uncertainty Bounds / Prediction Corridors (Circle Radius in Meters) */}
      {(trajectory || []).map((t, idx) => {
        if (!t.uncertaintyKm) return null;
        return (
          <Circle
            key={`uncertainty-${idx}`}
            center={[t.lat, t.lng]}
            radius={t.uncertaintyKm * 1000}
            pathOptions={{
              color: "#76B900",
              fillColor: "#76B900",
              fillOpacity: 0.08,
              weight: 1,
              dashArray: "4, 6",
            }}
          />
        );
      })}

      {/* Storm Centre Marker (Eye) */}
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={14}
        pathOptions={{ fillColor: "#FF3333", color: "#FFFFFF", weight: 2.5, fillOpacity: 0.95 }}
      >
        <Popup>
          <div style={{ fontFamily: "var(--font-sans)", color: "#000" }}>
            <strong style={{ color: "#FF3333", textTransform: "uppercase" }}>STORM EYE CENTER</strong>
            <br />
            Lat: {center.lat.toFixed(3)}°N, Lon: {center.lng.toFixed(3)}°E
            <br />
            Sensor: {selectedSource || "HURSAT-B1"}
          </div>
        </Popup>
      </CircleMarker>

      {/* Trajectory Polyline */}
      {polylineCoords.length > 1 && (
        <Polyline
          positions={polylineCoords}
          pathOptions={{ color: "#76B900", weight: 2.5, dashArray: "6, 8" }}
        />
      )}

      {/* Forecast Points */}
      {(trajectory || []).map((t, idx) => (
        <CircleMarker
          key={`traj-${idx}`}
          center={[t.lat, t.lng]}
          radius={7}
          pathOptions={{ fillColor: "#FF9900", color: "#000000", weight: 2, fillOpacity: 0.9 }}
        >
          <Popup>
            <div style={{ fontFamily: "var(--font-sans)", color: "#000" }}>
              <strong>{t.label}</strong>
              <br />
              Lat: {t.lat.toFixed(3)}°N, Lon: {t.lng.toFixed(3)}°E
              {t.uncertaintyKm && (
                <>
                  <br />
                  Uncertainty Corridor: ±{t.uncertaintyKm} km
                </>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Risk Grid Cells (200m GeoJSON) */}
      {features.length > 0 && (
        <GeoJSON
          key={`risk-${features.length}-${center.lat}-${center.lng}`}
          data={{ type: "FeatureCollection", features } as never}
          style={(feature) => ({
            fillColor: String(feature?.properties?.colour || "#75c9f1"),
            fillOpacity: 0.58,
            color: "#111111",
            weight: 0.8,
          })}
        />
      )}

      {/* Building Footprints */}
      {buildings.length > 0 && (
        <GeoJSON
          key={`bldg-${buildings.length}-${center.lat}-${center.lng}`}
          data={{ type: "FeatureCollection", features: buildings } as never}
          style={(feature) => ({
            fillColor: String(feature?.properties?.display_colour || "#111111"),
            fillOpacity: 0.88,
            color: feature?.properties?.is_locally_taller ? "#76B900" : "#222222",
            weight: 1.5,
          })}
        />
      )}
    </MapContainer>
  );
}

export default function RiskMap({ center, features, buildings, trajectory, selectedSource }: RiskMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <LeafletRiskMap
        center={center}
        features={features}
        buildings={buildings}
        trajectory={trajectory}
        selectedSource={selectedSource}
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        center={center}
        zoom={9}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeId="hybrid"
        mapId={import.meta.env.VITE_GOOGLE_MAP_ID || undefined}
      >
        <GoogleDataLayer features={features} kind="risk" />
        <GoogleDataLayer features={buildings} kind="building" />
      </Map>
    </APIProvider>
  );
}
