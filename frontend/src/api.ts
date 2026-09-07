export type FullCellAnalysis = {
  cell_id: string;
  lat?: number;
  lon?: number;
  cyclone_heading_deg?: number;
  relative_direction_deg?: number;
  land_type: string;
  hazard: {
    wind_kph: number;
    wind_ms: number;
    wind_direction_deg: number;
    distance_to_eye_m: number;
    bearing_from_eye_deg: number;
    cyclone_heading_deg?: number;
    relative_direction_deg?: number;
    pressure_hpa: number;
    pressure_deficit_hpa: number;
    rain_rate_mm_hr: number;
    storm_surge_m: number;
    hazard_score: number;
  };
  wind_force: {
    dynamic_pressure_pa: number;
    drag_coefficient?: number;
    shelter_factor?: number;
    modeled_wind_loading_n_m2: number;
    effective_wind_loading_n_m2: number;
  };
  exposure: {
    building_count: number;
    building_density: number;
    avg_building_height_m: number;
    max_building_height_m: number;
    taller_building_count: number;
    exposure_score: number;
  };
  obstacles: {
    avg_upwind_height_m: number;
    max_upwind_height_m: number;
    obstruction_level: string;
    shelter_factor: number;
  };
  structure: {
    estimated_class: string;
    vulnerability_score: number;
    estimated_resistance_pa: number;
    load_to_resistance_ratio: number;
    data_provenance: {
      // New provenance shape (v2.1)
      building_footprint?: string;
      material?: string;
      height?: string;
      resistance_pa?: string;
      structural_class?: string;
      modeled?: string[];
      note?: string;
      // Legacy shape (backwards compatible)
      observed?: string[];
      inferred?: string[];
    };
  };
  damage: {
    formula?: string;
    formula_note?: string;
    hazard_score: number;
    exposure_score: number;
    vulnerability_score: number;
    structural_response_score: number;
    damage_score: number;
    classification: string;
    colour: string;
    description: string;
  };
  drivers: {
    primary: string;
    secondary: string;
    term_contributions?: Record<string, number>;
  };
};

export type RiskFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    classification: string;
    colour: string;
    damage_score: number;
    risk_score?: number;
    lat?: number;
    lon?: number;
    cyclone_heading_deg?: number;
    relative_direction_deg?: number;
    wind_kph: number;
    wind_ms?: number;
    wind_direction_deg?: number;
    bearing_from_eye_deg?: number;
    distance_to_cyclone_m: number;
    land_type?: string;
    dynamic_pressure_pa?: number;
    effective_wind_loading_n_m2?: number;
    building_count?: number;
    building_density?: number;
    obstruction_level?: string;
    estimated_class?: string;
    load_to_resistance_ratio?: number;
    primary_driver?: string;
    secondary_driver?: string;
    description?: string;
    full_cell_analysis?: FullCellAnalysis;
  };
};

export type RiskSummary = {
  total_cells: number;
  max_risk_score: number;
  max_wind_kph?: number;
  severe_cells: number;
  moderate_cells: number;
  safe_cells: number;
  no_damage_cells: number;
  storm_heading_deg?: number;
  storm_speed_kph?: number;
};

export type ScenarioResult = {
  id: string;
  input?: {
    name: string;
    center_lat: number;
    center_lon: number;
    max_wind_kph: number;
    central_pressure_hpa: number;
    heading_deg?: number;
    speed_kph?: number;
    field_radius_km?: number;
  };
  basin: string | null;
  ocean_node: { VF: { ocean_heat_content_kj_cm2: number }; meta: { source: string } } | null;
  risk_grid: { type?: string; features: RiskFeature[]; summary?: RiskSummary };
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
  properties: { display_colour: string; is_locally_taller: boolean; height_m?: number };
};

export type ForecastHorizon = {
  centre_lat: number;
  centre_lon: number;
  max_sustained_wind_kph: number;
  central_pressure_hpa: number;
  track_uncertainty_km: number;
  wind_uncertainty_kph: number;
  uncertainty_status?: string;
  method?: string;
};

export type MLInferenceResult = {
  model_provenance: {
    model_name: string;
    model_version: string;
    model_status: string;
    validation_status: string;
    uncertainty_status: string;
    is_trained_ml_model: boolean;
    is_trained_on_samples: boolean;
    warning: string;
    algorithm?: string;
  };
  identification: {
    presence: "NO_CYCLONE" | "TROPICAL_DISTURBANCE" | "TROPICAL_CYCLONE";
    method?: string;
    data_status?: string;
    centre_lat: number;
    centre_lon: number;
    /** @deprecated use model_provenance */
    confidence?: number;
  };
  pattern_classification: {
    lifecycle_pattern: "FORMATION" | "INTENSIFYING" | "MATURE" | "WEAKENING" | "LANDFALLING" | null;
    method?: string;
    data_status?: string;
    /** @deprecated use model_provenance */
    confidence?: number | null;
  };
  forecast_6h: ForecastHorizon;
  forecast_12h: ForecastHorizon;
  forecast_24h: ForecastHorizon;
  ocean_context: { tb_deg_c: number; vf_m: number; data_status?: string };
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
