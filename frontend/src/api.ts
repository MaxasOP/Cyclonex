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
  ml_provenance?: {
    source_storm_id: string;
    forecast_horizon_hours: number;
    predicted_centre: { lat: number; lon: number };
    predicted_wind_kph: number;
    model_algorithm: string;
  };
};

export type BuildingFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: { display_colour: string; is_locally_taller: boolean };
};

export type ForecastHorizon = {
  centre_lat: number;
  centre_lon: number;
  max_sustained_wind_kph: number;
  central_pressure_hpa: number;
  track_uncertainty_km: number;
  wind_uncertainty_kph: number;
};

export type MLInferenceResult = {
  identification: {
    presence: "NO_CYCLONE" | "TROPICAL_DISTURBANCE" | "TROPICAL_CYCLONE";
    confidence: number;
    centre_lat: number;
    centre_lon: number;
  };
  pattern_classification: {
    lifecycle_pattern: "FORMATION" | "INTENSIFYING" | "MATURE" | "WEAKENING" | "LANDFALLING" | null;
    confidence: number | null;
  };
  forecast_6h: ForecastHorizon;
  forecast_12h: ForecastHorizon;
  forecast_24h: ForecastHorizon;
  ocean_context: { tb_deg_c: number; vf_m: number };
  model_provenance: { model_version: string; algorithm: string; is_trained: boolean };
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "https://cyclonex.onrender.com").replace(/\/$/, "");

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

export async function runMLInference(input: Record<string, unknown>): Promise<MLInferenceResult> {
  const response = await fetch(`${apiBaseUrl}/api/v3/inference`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "ML inference failed.");
  }
  return response.json() as Promise<MLInferenceResult>;
}

export async function runMLStormImpact(stormId: string, horizon: number): Promise<ScenarioResult> {
  const response = await fetch(`${apiBaseUrl}/api/v3/storms/${stormId}/impact-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forecast_horizon_hours: horizon }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "ML storm impact run failed.");
  }
  return response.json() as Promise<ScenarioResult>;
}

export type DatasetSummary = {

  observations: number;
  best_track_labels: number;
  training_samples: number;
  splits: {
    train: { samples: number; storms: number };
    validation: { samples: number; storms: number };
    test: { samples: number; storms: number };
  };
  model_status: string;
  baseline_model?: {
    is_trained: boolean;
    algorithm: string;
    metrics: Record<string, number> | null;
  };
};

export async function fetchDatasetSummary(): Promise<DatasetSummary | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v3/dataset-summary`);
    if (!response.ok) return null;
    return response.json() as Promise<DatasetSummary>;
  } catch {
    return null;
  }
}

