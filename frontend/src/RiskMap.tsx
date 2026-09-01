import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import type { BuildingFeature, RiskFeature } from "./api";

type RiskMapProps = {
  center: { lat: number; lng: number };
  features: RiskFeature[];
  buildings: BuildingFeature[];
};

function DataLayer({ features, kind }: { features: RiskFeature[] | BuildingFeature[]; kind: "risk" | "building" }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !features.length) return;
    const added = map.data.addGeoJson({ type: "FeatureCollection", features } as never);
    map.data.setStyle((feature: google.maps.Data.Feature) => ({
      fillColor: String(feature.getProperty(kind === "risk" ? "colour" : "display_colour")),
      fillOpacity: kind === "risk" ? 0.56 : 0.88,
      strokeColor: kind === "building" && feature.getProperty("is_locally_taller") ? "#ffffff" : "#0a2a57",
      strokeOpacity: kind === "risk" ? 0.52 : 1,
      strokeWeight: kind === "risk" ? 0.6 : 1.5,
      clickable: true,
    }));
    return () => added.forEach((feature) => map.data.remove(feature));
  }, [map, features]);

  return null;
}

export default function RiskMap({ center, features, buildings }: RiskMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return <div className="map-message">Add VITE_GOOGLE_MAPS_API_KEY in Vercel to render the map.</div>;
  }
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        center={center}
        zoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeId="hybrid"
        mapId={import.meta.env.VITE_GOOGLE_MAP_ID || undefined}
      >
        <DataLayer features={features} kind="risk" />
        <DataLayer features={buildings} kind="building" />
      </Map>
    </APIProvider>
  );
}
