import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer, useMap as useLeafletMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { BuildingFeature, RiskFeature } from "./api";

type RiskMapProps = {
  center: { lat: number; lng: number };
  features: RiskFeature[];
  buildings: BuildingFeature[];
  trajectory?: { lat: number; lng: number; label: string }[];
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
      fillOpacity: kind === "risk" ? 0.56 : 0.88,
      strokeColor:
        kind === "building" && feature.getProperty("is_locally_taller") ? "#ffffff" : "#0a2a57",
      strokeOpacity: kind === "risk" ? 0.52 : 1,
      strokeWeight: kind === "risk" ? 0.6 : 1.5,
      clickable: true,
    }));
    return () => added.forEach((feature) => map.data.remove(feature));
  }, [map, features]);

  return null;
}

function LeafletRecenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useLeafletMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], 10);
  }, [map, center]);
  return null;
}

function LeafletRiskMap({ center, features, buildings, trajectory }: RiskMapProps) {
  const polylineCoords = (trajectory || []).map((t) => [t.lat, t.lng] as [number, number]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={10}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%", minHeight: "680px" }}
    >
      <LeafletRecenter center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Storm Centre Marker */}
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={12}
        pathOptions={{ fillColor: "#d4483b", color: "#ffffff", weight: 2, fillOpacity: 0.9 }}
      >
        <Popup>
          <strong>Storm Eye Centre</strong>
          <br />
          Lat: {center.lat}°N, Lon: {center.lng}°E
        </Popup>
      </CircleMarker>

      {/* Forecast Trajectory Line */}
      {polylineCoords.length > 1 && (
        <Polyline
          positions={polylineCoords}
          pathOptions={{ color: "#75c9f1", weight: 3, dashArray: "6, 6" }}
        />
      )}

      {/* Forecast Trajectory Points */}
      {(trajectory || []).map((t, idx) => (
        <CircleMarker
          key={`traj-${idx}`}
          center={[t.lat, t.lng]}
          radius={6}
          pathOptions={{ fillColor: "#ed8a28", color: "#081729", weight: 1.5, fillOpacity: 0.9 }}
        >
          <Popup>
            <strong>{t.label}</strong>
            <br />
            Lat: {t.lat}°N, Lon: {t.lng}°E
          </Popup>
        </CircleMarker>
      ))}

      {/* Risk Grid Cells */}
      {features.length > 0 && (
        <GeoJSON
          key={`risk-${features.length}-${center.lat}-${center.lng}`}
          data={{ type: "FeatureCollection", features } as never}
          style={(feature) => ({
            fillColor: String(feature?.properties?.colour || "#75c9f1"),
            fillOpacity: 0.56,
            color: "#0a2a57",
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
            fillColor: String(feature?.properties?.display_colour || "#0a2a57"),
            fillOpacity: 0.88,
            color: feature?.properties?.is_locally_taller ? "#ffffff" : "#0a2a57",
            weight: 1.5,
          })}
        />
      )}
    </MapContainer>
  );
}

export default function RiskMap({ center, features, buildings, trajectory }: RiskMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <LeafletRiskMap center={center} features={features} buildings={buildings} trajectory={trajectory} />;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        center={center}
        zoom={10}
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
