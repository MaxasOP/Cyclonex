"""Canonical Data Models & Central Resilience Assessment Object for CYCLONEX.

Defines the single source of truth for:
- CycloneState
- Hazards & Spatial Inundation
- Infrastructure Vulnerability (Power, Roads, Shelters, Buildings)
- Evacuation & Shelter Assignment
- Gemini Decision Intelligence (Evidence -> Reasoning -> Action)
- RuleEngine Fallback
- Multilingual Advisories
- Parametric Liquidity Simulation
- Data Provenance & System Health Status
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. Canonical Cyclone Data Model
# ---------------------------------------------------------------------------

class ForecastPoint(BaseModel):
    hour: int
    lat: float
    lon: float
    max_wind_kmh: float
    central_pressure_hpa: float
    uncertainty_radius_km: float


class LandfallEstimate(BaseModel):
    eta_hours: float
    location_name: str
    lat: float
    lon: float
    confidence_interval: str = "±3.5 hours"


class RainfallForecast(BaseModel):
    rate_mm_hr: float
    projected_24h_rainfall_mm: float
    soil_saturation_index: str  # "MODERATE", "HIGH", "SATURATED"
    runoff_coefficient: float
    drainage_utilization_pct: float
    flash_flood_risk_level: str  # "LOW", "MODERATE", "HIGH", "EXTREME"


class SurgeAssessment(BaseModel):
    peak_surge_height_m: float
    inverted_barometer_component_m: float
    wind_stress_component_m: float
    inundation_reach_km: float
    astronomical_tide_phase: str = "SPRING_HIGH_TIDE (+1.4m)"
    composite_peak_water_level_m: float
    model_type: str = "Physics-informed storm surge estimation (Inverted Barometer + Bathymetric Wind Stress)"
    uncertainty_range_m: str = "±0.4m"


class PredictionConfidence(BaseModel):
    score: float = 0.94
    uncertainty_description: str = "Model uncertainty estimate based on multi-source track consensus"
    prediction_interval: str = "90% ensemble track corridor"


class DataSourceStatus(BaseModel):
    meteorological: Literal["LIVE", "CACHED", "SIMULATION"] = "LIVE"
    storm_track: Literal["LIVE", "CACHED", "SIMULATION"] = "CACHED"
    satellite_feeds: Literal["LIVE", "CACHED", "SIMULATION"] = "CACHED"
    terrain_srtm: Literal["LIVE", "CACHED"] = "CACHED"
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    provider: str = "IMD / JTWC / GEE Multi-Sensor Ingest"


class CycloneState(BaseModel):
    id: str
    name: str
    basin: str  # "BAY_OF_BENGAL" | "ARABIAN_SEA"
    center: Dict[str, float]  # {"lat": float, "lon": float}
    intensity: Dict[str, Any]  # {"maxWindKmh": float, "centralPressureHpa": float, "category": str}
    motion: Dict[str, float]  # {"headingDeg": float, "forwardSpeedKmh": float}
    forecast: List[ForecastPoint]
    landfall: LandfallEstimate
    rainfall: RainfallForecast
    surge: SurgeAssessment
    confidence: PredictionConfidence
    source: DataSourceStatus


# ---------------------------------------------------------------------------
# 2. Hazard & Inundation Spatial Assessment
# ---------------------------------------------------------------------------

class HazardAssessment(BaseModel):
    hazard_type: str
    severity: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    peak_value: str
    affected_spatial_extent_km2: float
    description: str


class InundationAssessment(BaseModel):
    maximum_flood_depth_m: float
    total_affected_area_km2: float
    inland_saline_reach_km: float
    affected_administrative_blocks: List[str]
    critical_drainage_bottlenecks: List[Dict[str, str]]
    spatial_raster_status: str = "Generated 200m spatial flood raster"


# ---------------------------------------------------------------------------
# 3. Infrastructure Vulnerability Model
# ---------------------------------------------------------------------------

class InfrastructureRisk(BaseModel):
    asset_id: str
    name: str
    category: Literal["POWER_GRID", "ARTERIAL_ROAD", "MEDICAL_SHELTER", "BUILDING_CLUSTER"]
    lat: float
    lon: float
    elevation_m: float
    design_threshold_wind_kmh: float
    flood_threshold_m: float
    distance_to_coast_km: float
    
    # Detailed Exposure Sub-scores
    wind_exposure_pct: float
    flood_exposure_pct: float
    salt_spray_exposure_pct: float
    
    # Passability / Operational Status
    overall_vulnerability: Literal["LOW", "ELEVATED", "CRITICAL"]
    estimated_failure_risk: str
    passability_status: Optional[str] = None  # for roads: "PASSABLE", "CAUTION", "IMPASSABLE_FLOODED"
    alternate_route: Optional[Dict[str, Any]] = None  # for roads: {"name": str, "additional_km": float}
    
    # Specific attributes
    shelter_readiness: Optional[Dict[str, Any]] = None  # for shelters
    details: Dict[str, Any] = Field(default_factory=dict)
    hardening_directive: str


# ---------------------------------------------------------------------------
# 4. Evacuation Assessment & Shelter Assignment
# ---------------------------------------------------------------------------

class EvacuationRouteOption(BaseModel):
    route_id: str
    name: str
    distance_km: float
    travel_time_minutes: int
    flood_risk_level: Literal["LOW", "MODERATE", "HIGH"]
    passability: str
    route_type: Literal["Fastest", "Safest", "Flood-avoiding", "Capacity-aware"]
    trade_off_explanation: str


class ShelterReadinessIndex(BaseModel):
    physical_safety_score: float  # elevation, structural wind tolerance
    operational_readiness_score: float  # generator, water, fuel
    accessibility_score: float  # road status
    capacity_score: float  # bed margin
    overall_index: float  # 0.0 to 1.0


class EvacuationAssessment(BaseModel):
    recommended_routes: List[EvacuationRouteOption]
    estimated_evacuee_target: int
    assigned_shelter_count: int
    shelter_capacity_margin_pct: float
    bottleneck_warnings: List[str]
    transit_evacuation_window_hours: float


# ---------------------------------------------------------------------------
# 5. Gemini 3.7 Flash Decision Intelligence & RuleEngine Fallback
# ---------------------------------------------------------------------------

class RecommendationEvidenceAction(BaseModel):
    domain: str
    evidence: List[str]
    reasoning: str
    action: str
    deadline: str
    priority: Literal["CRITICAL", "HIGH", "MODERATE"]


class GeminiDecisionIntelligence(BaseModel):
    engine_source: str  # "Gemini 3.7 Flash Multimodal Reasoning" or "Disaster-management-aligned rule-based fallback"
    confidence_score: float
    resilience_rating: str  # "RED_HIGH_CONSEQUENCE", "ORANGE_ELEVATED", "YELLOW_WATCH"
    urgency_level: str  # "MANDATORY_EVACUATION", "HIGH_ALERT", "WATCH"
    executive_summary: str
    evidence_reasoning_actions: List[RecommendationEvidenceAction]
    hardening_directives: List[Dict[str, str]]
    reasoning_steps: List[str]


# ---------------------------------------------------------------------------
# 6. Multilingual Advisories
# ---------------------------------------------------------------------------

class Advisory(BaseModel):
    lang_code: str
    language_name: str
    headline: str
    full_dispatch: str
    speech_voice_code: str


# ---------------------------------------------------------------------------
# 7. Parametric Liquidity Simulation (Fintech / Resilience)
# ---------------------------------------------------------------------------

class FinancialTrigger(BaseModel):
    trigger_name: str
    threshold: str
    recorded_metric: str
    status: Literal["TRIGGER_MET", "TRIGGER_PENDING", "MONITORING"]
    payout_percentage: float


class ParametricLiquiditySimulation(BaseModel):
    facility_name: str = "Coastal Municipal Parametric Resilience Facility (Simulation)"
    policy_coverage_inr_cr: float = 100.0
    triggers: List[FinancialTrigger]
    total_payout_percentage: float
    disbursed_liquidity_inr_cr: float
    payout_status: str
    time_to_settlement_estimate: str = "< 12 Minutes (Pre-Landfall Automated Liquidity Allocation)"
    allocated_funds_use: List[Dict[str, Any]]
    disclaimer: str = "Parametric Liquidity Simulation: Demonstrates pre-agreed smart covenant trigger and resource allocation. Genuine banking wire settlement requires Core Banking / RBI e-Kuber integration."


# ---------------------------------------------------------------------------
# 8. Data Provenance & System Status
# ---------------------------------------------------------------------------

class ProvenanceRecord(BaseModel):
    output_domain: str
    data_sources: List[str]
    dataset_collection: str
    observation_timestamp: str
    model_version: str
    processing_latency_ms: int
    status: Literal["LIVE", "CACHED", "SIMULATION", "MODEL_ESTIMATE"]


class SystemStatus(BaseModel):
    meteorology: Literal["LIVE", "CACHED", "SIMULATION"] = "LIVE"
    gee_sentinel1: Literal["CONNECTED", "CACHED", "SIMULATION"] = "CACHED"
    gee_srtm: Literal["CONNECTED", "CACHED", "SIMULATION"] = "CACHED"
    gee_dynamic_world: Literal["CONNECTED", "CACHED", "SIMULATION"] = "CACHED"
    gee_viirs: Literal["CONNECTED", "CACHED", "SIMULATION"] = "CACHED"
    ml_engine: Literal["ACTIVE", "STANDBY", "FALLBACK"] = "ACTIVE"
    gemini_ai: Literal["ACTIVE", "STANDBY", "FALLBACK"] = "ACTIVE"
    rule_engine: Literal["ACTIVE", "STANDBY"] = "STANDBY"
    database: Literal["ACTIVE", "CACHED"] = "ACTIVE"
    routing_engine: Literal["ACTIVE", "FALLBACK"] = "ACTIVE"
    tts_speech: Literal["READY", "UNSUPPORTED"] = "READY"


# ---------------------------------------------------------------------------
# 9. Post-Landfall Rapid Assessment (Lifecycle Completion)
# ---------------------------------------------------------------------------

class PostLandfallAssessment(BaseModel):
    phase: Literal["PRE_LANDFALL", "LANDFALL", "POST_LANDFALL"] = "PRE_LANDFALL"
    sar_flood_observation_notes: str
    viirs_nightlight_blackout_status: str
    power_outage_risk_area_km2: float
    restoration_priority_manifest: List[Dict[str, str]]


# ---------------------------------------------------------------------------
# 10. Central Resilience Assessment Object
# ---------------------------------------------------------------------------

class CentralResilienceAssessment(BaseModel):
    status: str = "success"
    cyclone: CycloneState
    hazards: Dict[str, Any]  # wind, rainfall, runoff, stormSurge, inundation
    infrastructure: Dict[str, List[InfrastructureRisk]]  # power, roads, shelters, buildings
    evacuation: EvacuationAssessment
    recommendations: List[RecommendationEvidenceAction]
    gemini_intelligence: GeminiDecisionIntelligence
    advisories: Dict[str, str]  # en, hi, or, bn, gu, mr
    financial_triggers: ParametricLiquiditySimulation
    provenance: List[ProvenanceRecord]
    system_status: SystemStatus
    post_landfall: PostLandfallAssessment
