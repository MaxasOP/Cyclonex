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
    modeled_wind_loading_n_m2?: number;
    building_count?: number;
    building_density?: number;
    avg_building_height_m?: number;
    max_building_height_m?: number;
    avg_upwind_height_m?: number;
    obstruction_level?: string;
    shelter_factor?: number;
    estimated_class?: string;
    estimated_resistance_pa?: number;
    vulnerability_score?: number;
    hazard_score?: number;
    exposure_score?: number;
    load_to_resistance_ratio?: number;
    primary_driver?: string;
    secondary_driver?: string;
    description?: string;
    grid_size_m?: number;
    pressure_hpa?: number;
    pressure_deficit_hpa?: number;
    rain_rate_mm_hr?: number;
    storm_surge_m?: number;
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
  actual_grid_size_m?: number;
  grid_auto_scaled?: boolean;
  estimated_loss_crores_inr?: number;
  estimated_population_affected?: number;
  ndma_directives?: {
    evacuation_urgency?: string;
    ndrf_battalions_recommended?: number;
    port_warning_signal?: string;
    power_grid_advisory?: string;
    rail_traffic_directive?: string;
  };
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
  risk_grid: {
    type?: string;
    features: RiskFeature[];
    summary?: RiskSummary;
    metadata?: {
      grid_size_m?: number;
      crs?: string;
      model_type?: string;
      limitation?: string;
    };
  };
  model: { data_quality: string };
  ml_provenance?: {
    source_storm_id: string;
    forecast_horizon_hours: number;
    predicted_centre: { lat: number; lon: number };
    predicted_wind_kph: number;
    model_algorithm: string;
  };
};

export type ZoneFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    zone_type: string;
    zone_label: string;
    zone_vulnerability: number;
    zone_colour: string;
    area_m2: number;
    centroid_lon: number;
    centroid_lat: number;
    osm_name: string;
    combined_damage_score?: number | null;
  };
};

export type CycloneShelter = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  current_occupancy?: number;
  district: string;
  state: string;
  facility_type: string;
  backup_generator: boolean;
  helipad: boolean;
  distance_km?: number;
  evacuation_priority?: "IMMEDIATE" | "ADVISORY" | "STANDBY";
};

export type EvacuationPlan = {
  total_shelters_active: number;
  total_capacity: number;
  estimated_population_at_risk: number;
  immediate_evacuation_count: number;
  shelters: CycloneShelter[];
  ward_priorities: Array<{
    ward_id: string;
    name: string;
    lat: number;
    lon: number;
    risk_level: string;
    color: string;
    action: string;
    nearest_shelter: string;
    distance_km: number;
  }>;
};

export type BuildingFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    display_colour?: string;
    is_locally_taller?: boolean;
    height_m?: number;
    name?: string;
    building_type?: string;
    damage_score?: number | null;
    classification?: string;
    wind_kph?: number;
    dynamic_pressure_pa?: number;
    load_to_resistance_ratio?: number;
    effective_wind_loading_n_m2?: number;
    material?: string;
    structural_class?: string;
    floors?: number;
    data_provenance?: {
      building_footprint?: string;
      material?: string;
      height?: string;
      resistance_pa?: string;
      structural_class?: string;
      modeled?: string[];
      note?: string;
      observed?: string[];
      inferred?: string[];
    };
    capacity?: number;
    cell_id?: string;
    adjacent_taller_highlight?: string | null;
  };
};

export type ForecastHorizon = {
  horizon_hours: number;
  centre_lat: number;
  centre_lon: number;
  max_sustained_wind_kph: number;
  max_wind_kph?: number;
  central_pressure_hpa: number;
  track_uncertainty_km: number;
  wind_uncertainty_kph: number;
  uncertainty_status?: string;
  method?: string;
};

export type MLInferenceResult = {
  dvorak_t_number?: number;
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

export async function fetchRiskGrid(
  scenarioId: string
): Promise<{ type: string; features: RiskFeature[]; summary?: RiskSummary }> {
  const response = await fetch(`${apiBaseUrl}/api/v2/scenarios/${scenarioId}/risk-grid`);
  if (!response.ok) {
    throw new Error("Failed to fetch risk grid");
  }
  return response.json() as Promise<{ type: string; features: RiskFeature[]; summary?: RiskSummary }>;
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
    metrics?: {
      status?: string;
      track_error_6h_km_mean?: number;
      track_error_12h_km_mean?: number;
      track_error_24h_km_mean?: number;
      wind_mae_kph_mean?: number;
      pressure_mae_hpa_mean?: number;
      identification_f1?: number;
      pattern_f1?: number;
      n_test_samples?: number;
      evaluated_at?: string;
    } | null;
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

export async function fetchZones(scenarioId: string): Promise<ZoneFeature[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v2/scenarios/${scenarioId}/zones`);
    if (!response.ok) return [];
    const result = await response.json();
    return (result.features || []) as ZoneFeature[];
  } catch {
    return [];
  }
}

export async function fetchSheltersAndEvacuation(scenarioId: string): Promise<EvacuationPlan | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v2/scenarios/${scenarioId}/shelters-evacuation`);
    if (!response.ok) return null;
    return response.json() as Promise<EvacuationPlan>;
  } catch {
    return null;
  }
}

export type NewsSource = {
  id: string;
  name: string;
  url: string;
  scrape_type: string;
  active: number;
  created_at: string;
};

export type NewsArticle = {
  id: string;
  source_id: string;
  source_name: string;
  title: string;
  url: string;
  snippet: string;
  published_at: string;
  impact_level: "CRITICAL" | "SEVERE" | "HIGH" | "MODERATE";
  cyclone_tag: string;
  scraped_at: string;
};

export type RealtimeWeather = {
  source: string;
  lat: number;
  lon: number;
  timestamp: string;
  wind_speed_kph: number;
  wind_gusts_kph: number;
  wind_direction_deg: number;
  surface_pressure_hpa: number;
  precipitation_mm: number;
  temperature_c: number;
  humidity_pct: number;
  status: string;
};

export async function fetchNewsSources(): Promise<NewsSource[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v2/news/sources`);
    if (!response.ok) return [];
    return response.json() as Promise<NewsSource[]>;
  } catch {
    return [];
  }
}

export async function addNewsSource(name: string, url: string, scrape_type = "html"): Promise<NewsSource> {
  const response = await fetch(`${apiBaseUrl}/api/v2/news/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, url, scrape_type }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to add news source");
  }
  return response.json() as Promise<NewsSource>;
}

export async function deleteNewsSource(sourceId: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v2/news/sources/${sourceId}`, {
      method: "DELETE",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function triggerNewsScrape(): Promise<any> {
  const response = await fetch(`${apiBaseUrl}/api/v2/news/scrape`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to scrape news sources");
  return response.json();
}

export async function fetchNewsArticles(query?: string, cycloneTag?: string): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (cycloneTag && cycloneTag !== "ALL") params.set("cyclone_tag", cycloneTag);

    const response = await fetch(`${apiBaseUrl}/api/v2/news/articles?${params.toString()}`);
    if (!response.ok) return [];
    return response.json() as Promise<NewsArticle[]>;
  } catch {
    return [];
  }
}

export async function fetchRealtimeWeather(lat: number, lon: number): Promise<RealtimeWeather | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v2/realtime-weather?lat=${lat}&lon=${lon}`);
    if (!response.ok) return null;
    return response.json() as Promise<RealtimeWeather>;
  } catch {
    return null;
  }
}

export interface AICycloneAnalysisRequest {
  satellite_images?: {
    visible?: string;
    infrared?: string;
    water_vapor?: string;
    microwave?: string;
  };
  latitude: number;
  longitude: number;
  wind_speed: number;
  pressure: number;
  timestamp?: string;
}

export interface AICycloneAnalysisResponse {
  status: string;
  active_channels: string[];
  identification: {
    cyclone_detected: boolean;
    confidence: number;
    center: { latitude: number; longitude: number };
    method?: string;
  };
  classification: {
    pattern: string;
    confidence: number;
    probabilities: Record<string, number>;
    dvorak?: {
      warmest_eye_k?: number;
      coldest_eyewall_k?: number;
      eye_eyewall_contrast_k?: number;
      cdo_circularity?: number;
      automated_dvorak_ci?: number;
      dvorak_t_number?: string;
    };
    method?: string;
  };
  rapid_intensification?: {
    probability: number;
    is_ri_expected: boolean;
    threshold_knots_24h: number;
    warning_level: string;
    drivers?: string[];
  };
  current_conditions: {
    wind_speed_kmh: number;
    pressure_hpa: number;
    sst_c?: number;
    shear_kt?: number;
  };
  prediction: {
    "6h": { wind_speed_kmh: number; pressure_hpa: number };
    "12h": { wind_speed_kmh: number; pressure_hpa: number };
    "24h": { wind_speed_kmh: number; pressure_hpa: number };
    "48h"?: { wind_speed_kmh: number; pressure_hpa: number };
  };
  track_forecast: Array<{
    hours: number;
    latitude: number;
    longitude: number;
    wind_speed_kmh: number;
    pressure_hpa: number;
    uncertainty_km: number;
  }>;
  explainability?: {
    method: string;
    target_class: string;
    attention_grid_28x28?: number[][];
  };
  risk_integration: {
    grid_updated: boolean;
    building_risk_updated: boolean;
    storm_surge_updated: boolean;
  };
  model_status: {
    detection: string;
    classification: string;
    rapid_intensification?: string;
    intensity: string;
  };
  scenario_id?: string;
}

export async function analyzeAICyclone(data: AICycloneAnalysisRequest): Promise<AICycloneAnalysisResponse | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/analyze-cyclone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) return null;
    return response.json() as Promise<AICycloneAnalysisResponse>;
  } catch {
    return null;
  }
}

export async function fetchAIModelsStatus(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/models-status`);
    if (!response.ok) return null;
    return response.json() as Promise<Record<string, unknown>>;
  } catch {
    return null;
  }
}


