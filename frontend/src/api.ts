export type RiskFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    classification: string;
    colour: string;
    damage_score: number;
    wind_kph: number;
    distance_to_cyclone_m: number;
  };
};

export type ScenarioResult = {
  id: string;
  basin: string | null;
  ocean_node: { VF: { ocean_heat_content_kj_cm2: number }; meta: { source: string } } | null;
  risk_grid: { features: RiskFeature[] };
  model: { data_quality: string };
};

export type BuildingFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: { display_colour: string; is_locally_taller: boolean };
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function createScenario(input: Record<string, unknown>): Promise<ScenarioResult> {
  const response = await fetch(`${apiBaseUrl}/api/v2/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "The scenario could not be created.");
  }
  return response.json() as Promise<ScenarioResult>;
}

export async function fetchBuildings(scenarioId: string): Promise<BuildingFeature[]> {
  const response = await fetch(`${apiBaseUrl}/api/v2/scenarios/${scenarioId}/buildings`);
  if (!response.ok) return [];
  const result = await response.json();
  return result.features as BuildingFeature[];
}
