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

// =========================================================
// CHALLENGE 05: TRACK-BASED INFRASTRUCTURE VULNERABILITY FORECASTER
// =========================================================

export interface InfrastructureItem {
  id: string;
  asset_id?: string;
  name: string;
  category: "POWER_GRID" | "ARTERIAL_ROAD" | "MEDICAL_SHELTER" | string;
  lat: number;
  lon: number;
  elevation_m: number;
  design_wind_tolerance_kmh: number;
  flood_threshold_m: number;
  status: "OPERATIONAL" | "ELEVATED_VULNERABILITY" | "CRITICAL_RISK" | "SHUTDOWN_RECOMMENDED" | string;
  overall_vulnerability?: "LOW" | "ELEVATED" | "CRITICAL" | string;
  wind_exposure_pct?: number;
  flood_exposure_pct?: number;
  salt_spray_exposure_pct?: number;
  passability_status?: string;
  alternate_route?: { name: string; additional_km: number; passability?: string };
  shelter_readiness?: {
    physical_safety_score: number;
    operational_readiness_score: number;
    accessibility_score: number;
    capacity_score: number;
    overall_readiness_index: number;
  };
  hardening_directive?: string;
  details: Record<string, any>;
}

export interface GEELayer {
  id: string;
  name: string;
  gee_collection: string;
  resolution: string;
  frequency: string;
  status: string;
  utility: string;
}

export interface ParametricInsuranceData {
  policy_name: string;
  insured_entity: string;
  total_coverage_inr_cr: number;
  wind_trigger: { threshold_kmh: number; recorded_kmh: number; status: string };
  surge_trigger: { threshold_m: number; recorded_m: number; status: string };
  total_payout_percentage: number;
  disbursed_liquidity_inr_cr: number;
  payout_status: string;
  time_to_settlement: string;
  allocated_funds_use: Array<{ item: string; allocation_cr: number }>;
  disclaimer?: string;
}

export interface GeminiAdvisory {
  source: string;
  confidence_score: number;
  resilience_rating: string;
  urgency_level: string;
  input_streams_connected?: {
    real_time_met: string;
    gee_satellite: string;
    storm_surge_sim: string;
    rainfall_damage_pathways: string;
    critical_infra_vulnerability: string;
  };
  action_synthesis?: {
    power_hardening_action: string;
    road_diversion_action: string;
    medical_shelter_action: string;
    automated_advisory_action: string;
    parametric_liquidity_action: string;
  };
  executive_summary: string;
  early_warning_advisory_dispatch: string;
  multilingual_advisories?: Record<string, string>;
  infrastructure_hardening_plan: Array<{ domain: string; action: string; deadline: string; priority: string }>;
  reasoning_steps: string[];
}

export interface RecommendationEvidenceAction {
  domain: string;
  evidence: string[];
  reasoning: string;
  action: string;
  deadline: string;
  priority: "CRITICAL" | "HIGH" | "MODERATE";
}

export interface EvacuationRouteOption {
  route_id: string;
  name: string;
  distance_km: number;
  travel_time_minutes: number;
  flood_risk_level: "LOW" | "MODERATE" | "HIGH";
  passability: string;
  route_type: "Fastest" | "Safest" | "Flood-avoiding" | "Capacity-aware";
  trade_off_explanation: string;
}

export interface EvacuationAssessment {
  recommended_routes: EvacuationRouteOption[];
  estimated_evacuee_target: number;
  assigned_shelter_count: number;
  shelter_capacity_margin_pct: number;
  bottleneck_warnings: string[];
  transit_evacuation_window_hours: number;
}

export interface ProvenanceRecord {
  output_domain: string;
  data_sources: string[];
  dataset_collection: string;
  observation_timestamp: string;
  model_version: string;
  processing_latency_ms: number;
  status: "LIVE" | "CACHED" | "SIMULATION" | "MODEL_ESTIMATE";
}

export interface SystemStatus {
  meteorology: "LIVE" | "CACHED" | "SIMULATION";
  gee_sentinel1: "CONNECTED" | "CACHED" | "SIMULATION";
  gee_srtm: "CONNECTED" | "CACHED";
  gee_dynamic_world: "CONNECTED" | "CACHED" | "SIMULATION";
  gee_viirs: "CONNECTED" | "CACHED" | "SIMULATION";
  ml_engine: "ACTIVE" | "STANDBY" | "FALLBACK";
  gemini_ai: "ACTIVE" | "STANDBY" | "FALLBACK";
  rule_engine: "ACTIVE" | "STANDBY";
  database: "ACTIVE" | "CACHED";
  routing_engine: "ACTIVE" | "FALLBACK";
  tts_speech: "READY" | "UNSUPPORTED";
}

export interface PostLandfallAssessment {
  phase: "PRE_LANDFALL" | "LANDFALL" | "POST_LANDFALL";
  sar_flood_observation_notes: string;
  viirs_nightlight_blackout_status: string;
  power_outage_risk_area_km2: number;
  restoration_priority_manifest: Array<{ priority: string; target: string; action: string }>;
}

export interface ResilienceAssessmentResult {
  status: string;
  challenge_meta: { challenge_id: string; challenge_title: string; theme: string; domain: string };
  storm_telemetry: {
    name: string;
    eye_lat: number;
    eye_lon: number;
    max_wind_kmh: number;
    central_pressure_hpa: number;
    heading_deg: number;
    forward_speed_kmh: number;
  };
  surge_and_runoff: {
    peak_surge_height_m: number;
    inverted_barometer_component_m: number;
    wind_stress_component_m: number;
    astronomical_tide_phase?: string;
    composite_peak_water_level_m?: number;
    inundation_reach_km: number;
    max_flood_depth_m?: number;
    total_affected_area_km2?: number;
    affected_administrative_blocks?: string[];
    projected_24h_rainfall_mm: number;
    soil_saturation_index?: string;
    runoff_coefficient?: number;
    flash_flood_risk_level: string;
    primary_drainage_pathways: Array<{
      name: string;
      capacity_utilization: string;
      risk: string;
      estimated_culvert_inundation_m?: number;
    }>;
  };
  critical_infrastructure: InfrastructureItem[];
  parametric_insurance: ParametricInsuranceData;
  gee_satellite_feeds: GEELayer[];
  gemini_multimodal_advisory: GeminiAdvisory & {
    evidence_reasoning_actions?: RecommendationEvidenceAction[];
  };
  cyclone?: any;
  evacuation?: EvacuationAssessment;
  dynamic_timeline?: Array<{ phase: string; title: string; action: string }>;
  provenance?: ProvenanceRecord[];
  system_status?: SystemStatus;
  post_landfall?: PostLandfallAssessment;
  countermeasure_deployed?: boolean;
}

export interface DroneInspectionReport {
  status: string;
  engine: string;
  inspected_asset_id: string;
  asset_name: string;
  image_caption: string;
  damage_severity: "CRITICAL" | "SEVERE" | "MODERATE" | "MINOR";
  structural_integrity_pct: number;
  detected_defects: string[];
  critical_failure_probability: number;
  repair_priority: string;
  estimated_repair_hours: number;
  emergency_dispatch_crew: string;
  mitigation_recommendation: string;
  inspection_timestamp: string;
  drone_telemetry: {
    altitude_agl_m: number;
    sensor: string;
    gimbal_pitch_deg: number;
    gps_fix: string;
    survey_flight_speed_ms?: number;
  };
}

export async function fetchResilienceAssessment(params?: {
  storm_name?: string;
  eye_lat?: number;
  eye_lon?: number;
  max_wind_kmh?: number;
  central_pressure_hpa?: number;
  heading_deg?: number;
  forward_speed_kmh?: number;
  simulate_failure_gemini?: boolean;
  simulate_failure_gee?: boolean;
  simulate_failure_weather?: boolean;
  deploy_countermeasure?: boolean;
}): Promise<ResilienceAssessmentResult | null> {
  try {
    const q = new URLSearchParams();
    if (params?.storm_name) q.set("storm_name", params.storm_name);
    if (params?.eye_lat != null) q.set("eye_lat", String(params.eye_lat));
    if (params?.eye_lon != null) q.set("eye_lon", String(params.eye_lon));
    if (params?.max_wind_kmh != null) q.set("max_wind_kmh", String(params.max_wind_kmh));
    if (params?.central_pressure_hpa != null) q.set("central_pressure_hpa", String(params.central_pressure_hpa));
    if (params?.heading_deg != null) q.set("heading_deg", String(params.heading_deg));
    if (params?.forward_speed_kmh != null) q.set("forward_speed_kmh", String(params.forward_speed_kmh));
    if (params?.simulate_failure_gemini) q.set("simulate_failure_gemini", "true");
    if (params?.simulate_failure_gee) q.set("simulate_failure_gee", "true");
    if (params?.simulate_failure_weather) q.set("simulate_failure_weather", "true");
    if (params?.deploy_countermeasure) q.set("deploy_countermeasure", "true");

    const response = await fetch(`${apiBaseUrl}/api/resilience/assess?${q.toString()}`);
    if (!response.ok) return null;
    return response.json() as Promise<ResilienceAssessmentResult>;
  } catch {
    return null;
  }
}

export async function inspectDroneDamage(params: {
  asset_id: string;
  sample_id?: string;
  image_base64?: string;
}): Promise<DroneInspectionReport | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/resilience/inspect-drone-damage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return res.json() as Promise<DroneInspectionReport>;
  } catch {
    return null;
  }
}

export async function fetchCapAlertXml(params?: {
  storm_name?: string;
  max_wind_kmh?: number;
  peak_surge_m?: number;
  eye_lat?: number;
  eye_lon?: number;
}): Promise<string> {
  try {
    const q = new URLSearchParams();
    if (params?.storm_name) q.set("storm_name", params.storm_name);
    if (params?.max_wind_kmh != null) q.set("max_wind_kmh", String(params.max_wind_kmh));
    if (params?.peak_surge_m != null) q.set("peak_surge_m", String(params.peak_surge_m));
    if (params?.eye_lat != null) q.set("eye_lat", String(params.eye_lat));
    if (params?.eye_lon != null) q.set("eye_lon", String(params.eye_lon));

    const res = await fetch(`${apiBaseUrl}/api/resilience/cap-alert.xml?${q.toString()}`);
    if (!res.ok) return "";
    return res.text();
  } catch {
    return "";
  }
}



