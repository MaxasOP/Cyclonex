"""Scenario-based resilience screening, reference assets, and optional Gemini review."""
from __future__ import annotations

import json
import math
import os
from geo import destination, distance_km, projected_landfall, coast_distance_within
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
import requests
from pydantic import BaseModel, Field

from canonical_models import (
    Advisory,
    CentralResilienceAssessment,
    CycloneState,
    DataSourceStatus,
    EvacuationAssessment,
    EvacuationRouteOption,
    FinancialTrigger,
    ForecastPoint,
    GeminiDecisionIntelligence,
    HazardAssessment,
    InfrastructureRisk,
    InundationAssessment,
    LandfallEstimate,
    ParametricLiquiditySimulation,
    PostLandfallAssessment,
    PredictionConfidence,
    ProvenanceRecord,
    RainfallForecast,
    RecommendationEvidenceAction,
    ShelterReadinessIndex,
    SurgeAssessment,
    SystemStatus,
)

# API Keys & Secrets (Server-side only)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
GEE_CREDENTIALS = os.getenv("GEE_SERVICE_ACCOUNT") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or ""


# ---------------------------------------------------------------------------
# 1. Physics-Informed Storm Surge & Spatial Inundation Simulator
# ---------------------------------------------------------------------------

class StormSurgeAndRunoffModel:
    """Physics-informed hydrodynamic surge and overland rainfall drainage pathway simulator."""

    @staticmethod
    def compute_surge_and_runoff(
        eye_lat: float,
        eye_lon: float,
        max_wind_kmh: float,
        central_pressure_hpa: float,
        heading_deg: float,
        forward_speed_kmh: float,
        rain_rate_mm_hr: float = 75.0,
        deploy_countermeasure: bool = False,
    ) -> Dict[str, Any]:
        """Calculates physical storm surge, astronomical tide coupling, spatial inundation extent, and runoff drainage."""
        # 1. Inverted Barometer Effect: 1 hPa deficit ~ 1 cm sea level rise
        pressure_deficit = max(0.0, 1013.25 - central_pressure_hpa)
        ib_surge_m = pressure_deficit * 0.01

        # 2. Wind stress surge: (C_d * rho_air / rho_water * Fetch / (g * Depth)) * V^2
        # For Indian coastal shelf: fetch ~80 km, mean depth ~15m -> coefficient ~0.00155
        wind_ms = max_wind_kmh / 3.6
        wind_stress_surge_m = round(0.00155 * (wind_ms ** 2), 2)

        total_peak_surge_m = round(min(7.5, ib_surge_m + wind_stress_surge_m), 2)
        surge_inundation_radius_km = round(min(65.0, 14.0 * total_peak_surge_m), 1)

        # Astronomical tide coupling (e.g. spring high tide vs neap tide)
        astronomical_tide_m = 1.40  # Spring high tide reference for coastal India
        composite_peak_water_level_m = round(total_peak_surge_m + astronomical_tide_m, 2)

        # 3. Complete Causal Rainfall Damage Pathway
        # Forward speed modulation: slower storm dumps significantly more precipitation over a fixed basin
        projected_24h_rainfall_mm = round(rain_rate_mm_hr * (24.0 / max(1.0, forward_speed_kmh / 15.0)) * 0.9, 1)

        soil_saturation = (
            "SATURATED (scenario assumption)" if projected_24h_rainfall_mm > 300
            else "HIGH (scenario assumption)" if projected_24h_rainfall_mm > 180
            else "MODERATE" if projected_24h_rainfall_mm > 50 else "LOW"
        )
        runoff_coeff = 0.88 if projected_24h_rainfall_mm > 250 else 0.72

        flash_flood_risk_level = (
            "EXTREME" if projected_24h_rainfall_mm > 350
            else "HIGH" if projected_24h_rainfall_mm > 200
            else "MODERATE" if projected_24h_rainfall_mm > 50 else "LOW"
        )

        # Spatial Inundation Grid & Administrative Exposure
        max_flood_depth_m = round(total_peak_surge_m * 0.65, 2)
        total_affected_area_km2 = round(surge_inundation_radius_km * 28.5, 1)

        # Virtual Countermeasure Modulation (Inflatable Dam & Sandbag Barrier at Coastal Outlets)
        if deploy_countermeasure:
            surge_inundation_radius_km = round(surge_inundation_radius_km * 0.70, 1)  # 30% reduction in inundation reach
            max_flood_depth_m = round(max(0.0, max_flood_depth_m - 0.75), 2)
            total_affected_area_km2 = round(total_affected_area_km2 * 0.68, 1)

        return {
            "method": "Uncalibrated coastal scenario with assumed shelf geometry, tide, and runoff. Reach and depth are sensitivity estimates.",
            "rain_rate_mm_hr": rain_rate_mm_hr,
            "peak_surge_height_m": total_peak_surge_m,
            "inverted_barometer_component_m": round(ib_surge_m, 2),
            "wind_stress_component_m": round(wind_stress_surge_m, 2),
            "astronomical_tide_phase": "ASSUMED_HIGH_TIDE (+1.4m)",
            "composite_peak_water_level_m": composite_peak_water_level_m,
            "inundation_reach_km": surge_inundation_radius_km,
            "max_flood_depth_m": max_flood_depth_m,
            "total_affected_area_km2": total_affected_area_km2,
            "affected_administrative_blocks": [],
            "projected_24h_rainfall_mm": projected_24h_rainfall_mm,
            "soil_saturation_index": soil_saturation,
            "runoff_coefficient": runoff_coeff,
            "modeled_runoff_mm": round(projected_24h_rainfall_mm * runoff_coeff, 1),
            "flash_flood_risk_level": flash_flood_risk_level,
            "primary_drainage_pathways": [],
            "countermeasure_deployed": deploy_countermeasure,
        }


# ---------------------------------------------------------------------------
# 2. Google Earth Engine (GEE) Multi-Sensor Satellite Pipeline
# ---------------------------------------------------------------------------

class GoogleEarthEngineFeeds:
    """Earth Observation Pipeline interfacing with GEE Sentinel-1, SRTM, Dynamic World, and VIIRS."""

    @staticmethod
    def get_gee_catalog_layers(basin: str, simulate_offline: bool = False) -> List[Dict[str, Any]]:
        status = "SIMULATION" if simulate_offline else "CATALOG_ONLY"

        return [
            {
                "id": "gee-s1-sar",
                "name": "Sentinel-1 C-Band SAR Synthetic Aperture Radar",
                "gee_collection": "COPERNICUS/S1_GRD",
                "instrument": "C-SAR (5.405 GHz)",
                "polarization": "VV + VH Dual-Pol",
                "pass_direction": "Collection dependent",
                "resolution": "10m Spatial Ground Resolution",
                "observation_timestamp": None,
                "observation_age": None,
                "status": status,
                "provenance": "ESA Copernicus / Google Earth Engine catalogue",
                "processing_pipeline": "Calibrate (Sigma0) -> Lee Speckle Filter (5x5) -> Otsu Dual-Pol Water Thresholding",
                "utility": "All-weather cloud-penetrating flood water extents & tidal coastal surface roughness",
            },
            {
                "id": "gee-srtm-dem",
                "name": "SRTM Digital Elevation Model (DEM 30m)",
                "gee_collection": "USGS/SRTMGL1_003",
                "instrument": "C-band InSAR Space Shuttle Radar",
                "resolution": "30m 1-Arc-Second Global",
                "observation_timestamp": None,
                "observation_age": None,
                "status": status,
                "provenance": "NASA JPL / USGS / Google Earth Engine",
                "processing_pipeline": "Hydro-conditioned DEM -> D8 Flow Direction -> Slope Gradient Extraction -> Coastal Lowland Mask",
                "utility": "Hydrodynamic runoff slope, barrier elevations & storm surge contour limits",
            },
            {
                "id": "gee-dynamic-world",
                "name": "ESA / Google Dynamic World 10m LULC",
                "gee_collection": "GOOGLE/DYNAMICWORLD/V1",
                "instrument": "Sentinel-2 Multi-Spectral Derived 9-Class AI",
                "resolution": "10m Near Real-Time",
                "observation_timestamp": None,
                "observation_age": None,
                "status": status,
                "provenance": "World Resources Institute / Google / ESA",
                "processing_pipeline": "DeepLab-v3+ Multi-Spectral Inference -> Mangrove Bioshield Buffer & Parcel Density Classifier",
                "utility": "Parcel building density, crop vulnerability, mangrove bioshield natural wave attenuation buffer",
            },
            {
                "id": "gee-viirs-dnb",
                "name": "NOAA / VIIRS Day-Night Band (DNB)",
                "gee_collection": "NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG",
                "instrument": "VIIRS Day/Night Band Radiometer",
                "resolution": "500m Nocturnal Radiance",
                "observation_timestamp": None,
                "observation_age": None,
                "status": status,
                "provenance": "NOAA / NASA Earth Science Data / Google Earth Engine",
                "processing_pipeline": "Lunar Radiance Normalization -> Pre-event Baseline Ratio -> Potential Blackout Anomaly Mask",
                "utility": "Pre-event nocturnal radiance baseline for cross-referencing potential post-landfall power blackout zones",
            },
        ]


# ---------------------------------------------------------------------------
# 3. Critical Infrastructure Vulnerability Engine (Power, Roads, Medical)
# ---------------------------------------------------------------------------

class CriticalInfrastructureRegistry:
    """Geo-referenced critical infrastructure assets across Indian maritime coastal sectors."""

    @staticmethod
    def get_regional_infrastructure(
        eye_lat: float,
        eye_lon: float,
        max_wind_kmh: float,
        surge_height_m: float,
        deploy_countermeasure: bool = False,
    ) -> List[InfrastructureRisk]:
        is_east_coast = eye_lon >= 78.0

        if is_east_coast:
            # Odisha / West Bengal Coastal Sector (Bay of Bengal)
            raw_assets = [
                {
                    "asset_id": "pwr-01",
                    "name": "Paradip Port 220kV Main Grid Substation",
                    "category": "POWER_GRID",
                    "lat": 20.29,
                    "lon": 86.68,
                    "elevation_m": 3.2,
                    "design_threshold_wind_kmh": 165.0,
                    "flood_threshold_m": 2.4,
                    "distance_to_coast_km": 2.8,
                    "hardening_directive": "Order controlled 33kV de-energization 2h before gale onset; deploy mobile flood coffer dams and silicone spray on transformer bushings to prevent salt-arc flashovers.",
                    "details": {
                        "substation_type": "220kV Air Insulated (AIS)",
                        "downstream_consumers": "184,000 Coastal Residents & Major Port Freight Cranes",
                        "transformer_count": 3,
                        "salt_spray_vulnerability": "Severe Marine Salt-Spray Arc Hazard",
                    }
                },
                {
                    "asset_id": "pwr-02",
                    "name": "Jagatsinghpur 132kV Radial Substation Pylon Hub",
                    "category": "POWER_GRID",
                    "lat": 20.26,
                    "lon": 86.42,
                    "elevation_m": 5.8,
                    "design_threshold_wind_kmh": 150.0,
                    "flood_threshold_m": 3.8,
                    "distance_to_coast_km": 14.5,
                    "hardening_directive": "Install guy-wire diagonal reinforcements on exposed terminal transmission towers; isolate rural radial lines.",
                    "details": {
                        "substation_type": "132/33kV Step-Down Substation",
                        "downstream_consumers": "62,000 Rural Customers",
                        "transformer_count": 2,
                    }
                },
                {
                    "asset_id": "rd-01",
                    "name": "National Highway 53 (NH-53) Coastal Arterial Corridor",
                    "category": "ARTERIAL_ROAD",
                    "lat": 20.31,
                    "lon": 86.62,
                    "elevation_m": 2.6,
                    "design_threshold_wind_kmh": 200.0,
                    "flood_threshold_m": 1.8,
                    "distance_to_coast_km": 3.4,
                    "passability_status": "IMPASSABLE_FLOODED",
                    "alternate_route": {
                        "name": "Cuttack-Paradip State Highway via Elevated Ridge Bypass",
                        "additional_km": 6.4,
                        "passability": "PASSABLE (Elevated Ridge +7.2m MSL)",
                    },
                    "hardening_directive": "Pre-stage heavy excavators and tree-clearing crews at 5 km intervals; deploy sandbag dikes at Km 18.4 culvert; divert civilian traffic to Cuttack Ridge Bypass.",
                    "details": {
                        "highway_tier": "4-Lane Primary Evacuation Arterial",
                        "vulnerability": "Low-lying box culverts susceptible to +2.8m tidal surge overtopping",
                        "traffic_status": "RESTRICTED · PRIORITY EVACUATION ONLY",
                    }
                },
                {
                    "asset_id": "rd-02",
                    "name": "Dhamra Port Dedicated Heavy Logistics Link Road",
                    "category": "ARTERIAL_ROAD",
                    "lat": 20.80,
                    "lon": 86.95,
                    "elevation_m": 4.2,
                    "design_threshold_wind_kmh": 200.0,
                    "flood_threshold_m": 3.2,
                    "distance_to_coast_km": 4.1,
                    "passability_status": "CAUTION",
                    "alternate_route": {
                        "name": "Bhadrak-Basudevpur Rural Highway",
                        "additional_km": 11.2,
                        "passability": "PASSABLE",
                    },
                    "hardening_directive": "Station road clearing crews for mangrove windthrow debris; restrict high-profile commercial container vehicles.",
                    "details": {
                        "highway_tier": "Dual Carriageway Port Freight Link",
                        "vulnerability": "Cross-wind tree fall risk along 14 km mangrove adjacent stretch",
                        "traffic_status": "OPEN (MONITORED PASSAGE)",
                    }
                },
                {
                    "asset_id": "med-01",
                    "name": "Paradip District Central Civil Hospital & Emergency Hub",
                    "category": "MEDICAL_SHELTER",
                    "lat": 20.30,
                    "lon": 86.65,
                    "elevation_m": 6.5,
                    "design_threshold_wind_kmh": 180.0,
                    "flood_threshold_m": 4.0,
                    "distance_to_coast_km": 3.1,
                    "shelter_readiness": {
                        "physical_safety_score": 0.88,
                        "operational_readiness_score": 0.94,
                        "accessibility_score": 0.65,
                        "capacity_score": 0.90,
                        "overall_readiness_index": 0.84,
                    },
                    "hardening_directive": "Elevate portable oxygen concentrators and trauma drugs above +3.0m datum; verify dual Cummins diesel generators (14-day fuel capacity locked); seal basement pharmaceutical stores.",
                    "details": {
                        "bed_capacity": 320,
                        "icu_ventilator_count": 24,
                        "oxygen_plant_location": "Elevated Reinforced Roof Platform (+8.5m AGL)",
                        "backup_power": "2x 500kVA Generators (14-Day Fuel Locked)",
                    }
                },
                {
                    "asset_id": "med-02",
                    "name": "Ersama High-Elevation Multi-Purpose Cyclone Citadel (MPCS-01)",
                    "category": "MEDICAL_SHELTER",
                    "lat": 20.18,
                    "lon": 86.58,
                    "elevation_m": 9.2,
                    "design_threshold_wind_kmh": 220.0,
                    "flood_threshold_m": 6.5,
                    "distance_to_coast_km": 4.8,
                    "shelter_readiness": {
                        "physical_safety_score": 0.96,
                        "operational_readiness_score": 0.95,
                        "accessibility_score": 0.82,
                        "capacity_score": 0.92,
                        "overall_readiness_index": 0.91,
                    },
                    "hardening_directive": "Designate as Regional Tier-1 Mass Evacuation Citadel; stock emergency pediatric oral rehydration packets; verify rooftop rainwater harvesting cisterns.",
                    "details": {
                        "bed_capacity": 2500,
                        "emergency_clinic": "Level-2 Trauma & Childbirth Facility",
                        "oxygen_plant_location": "Stilted G+2 RCC Citadel",
                        "backup_power": "Dual Diesel + Solar Microgrid",
                    }
                },
            ]
        else:
            # Maharashtra / Gujarat Coastal Sector (Arabian Sea)
            raw_assets = [
                {
                    "asset_id": "pwr-01-w",
                    "name": "Alibaug-Varsoli 220kV Coastal Transmission Substation",
                    "category": "POWER_GRID",
                    "lat": 18.66,
                    "lon": 72.88,
                    "elevation_m": 3.4,
                    "design_threshold_wind_kmh": 160.0,
                    "flood_threshold_m": 2.2,
                    "distance_to_coast_km": 1.9,
                    "hardening_directive": "Deploy perimeter sandbag revetment; pre-trip coastal salt-spray sensitive feeders 2 hours prior to landfall; lower mobile pumpouts into cable trenches.",
                    "details": {
                        "substation_type": "220/33kV GIS Indoor Substation",
                        "downstream_consumers": "142,000 Konkan Belt Consumers",
                        "transformer_count": 3,
                    }
                },
                {
                    "asset_id": "rd-01-w",
                    "name": "State Highway 47 (SH-47) Alibaug-Roha Coastal Arterial",
                    "category": "ARTERIAL_ROAD",
                    "lat": 18.64,
                    "lon": 72.90,
                    "elevation_m": 2.8,
                    "design_threshold_wind_kmh": 200.0,
                    "flood_threshold_m": 1.9,
                    "distance_to_coast_km": 2.1,
                    "passability_status": "IMPASSABLE_FLOODED",
                    "alternate_route": {
                        "name": "Mumbai-Goa NH-66 via Pen Ridge Highway",
                        "additional_km": 8.7,
                        "passability": "PASSABLE (Elevated Ridge)",
                    },
                    "hardening_directive": "Activate mandatory traffic diversions at Poynad junction; place warning pylons at Amba River causeway.",
                    "details": {
                        "highway_tier": "State Highway Arterial",
                        "vulnerability": "Estuary causeway inundation at Amba River mouth",
                        "traffic_status": "STANDBY DIVERSION ACTIVE",
                    }
                },
                {
                    "asset_id": "med-01-w",
                    "name": "Alibaug District Civil Hospital & Emergency Disaster Hub",
                    "category": "MEDICAL_SHELTER",
                    "lat": 18.65,
                    "lon": 72.87,
                    "elevation_m": 7.1,
                    "design_threshold_wind_kmh": 180.0,
                    "flood_threshold_m": 4.5,
                    "distance_to_coast_km": 2.5,
                    "shelter_readiness": {
                        "physical_safety_score": 0.90,
                        "operational_readiness_score": 0.92,
                        "accessibility_score": 0.70,
                        "capacity_score": 0.88,
                        "overall_readiness_index": 0.85,
                    },
                    "hardening_directive": "Activate emergency casualty triage ward; secure glass facades with anti-shatter film; test automatic switch-over on 350kVA diesel generator.",
                    "details": {
                        "bed_capacity": 280,
                        "icu_ventilator_count": 18,
                        "oxygen_plant_location": "Reinforced G+1 Hospital Wing",
                        "backup_power": "350kVA Generator (10 Days Diesel Stored)",
                    }
                },
            ]

        # Common Vulnerability Scoring Engine
        items: List[InfrastructureRisk] = []
        for a in raw_assets:
            if distance_km(eye_lat, eye_lon, a["lat"], a["lon"]) > 100:
                continue
            details = {**a.get("details", {}), "source": "Illustrative regional asset and design assumptions; field condition unknown."}
            details.pop("traffic_status", None)
            passability = None
            if a["category"] == "ARTERIAL_ROAD":
                passability = "MODELED_FLOOD_EXPOSURE" if surge_height_m >= a["flood_threshold_m"] else "UNVERIFIED"


            # Wind exposure %: relative to design threshold
            wind_exp = min(100.0, round((max_wind_kmh / a["design_threshold_wind_kmh"]) * 100.0, 1))
            
            # Flood exposure %: relative to surge height vs flood threshold
            flood_exp = min(100.0, round(max(0.0, (surge_height_m / a["flood_threshold_m"]) * 100.0), 1))
            
            # Virtual Countermeasure Modulation (Sandbag revetments, mobile dams, silicone flashover washes)
            if deploy_countermeasure:
                if a["asset_id"] in ("rd-01", "rd-01-w"):
                    passability = "SIMULATED_BARRIER_UNVERIFIED"
                    flood_exp = min(flood_exp, 28.0)
                    details["countermeasure_status"] = "PROTECTED: Inflatable flood barrier & sandbag dikes deployed at Km 18.4 culvert. Defended against surge overtopping."
                elif a["asset_id"] in ("pwr-01", "pwr-01-w"):
                    flood_exp = min(flood_exp, 22.0)
                    details["countermeasure_status"] = "PROTECTED: Mobile coffer dam & silicone anti-arc coating active. Flood exposure suppressed to 22%."

            # Marine salt spray exposure %: exponential decay with distance from coast
            salt_exp = round(max(10.0, 100.0 * math.exp(-0.35 * a["distance_to_coast_km"])), 1)
            
            # Overall Vulnerability Level
            if flood_exp >= 90.0 or wind_exp >= 85.0:
                overall = "CRITICAL"
                fail_risk = f"Estimated failure risk: CRITICAL ({max(wind_exp, flood_exp)}% threshold breach under peak conditions)"
            elif flood_exp >= 60.0 or wind_exp >= 65.0:
                overall = "ELEVATED"
                fail_risk = "Estimated failure risk: ELEVATED (approaching structural threshold margins)"
            else:
                overall = "LOW"
                fail_risk = "Estimated failure risk: LOW (sufficient design buffer)"

            items.append(
                InfrastructureRisk(
                    asset_id=a["asset_id"],
                    name=a["name"],
                    category=a["category"],
                    lat=a["lat"],
                    lon=a["lon"],
                    elevation_m=a["elevation_m"],
                    design_threshold_wind_kmh=a["design_threshold_wind_kmh"],
                    flood_threshold_m=a["flood_threshold_m"],
                    distance_to_coast_km=a["distance_to_coast_km"],
                    wind_exposure_pct=wind_exp,
                    flood_exposure_pct=flood_exp,
                    salt_spray_exposure_pct=salt_exp,
                    overall_vulnerability=overall,
                    estimated_failure_risk=fail_risk,
                    passability_status=passability,
                    alternate_route={**a["alternate_route"], "passability": "UNVERIFIED reference alternative"} if a.get("alternate_route") else None,
                    shelter_readiness=a.get("shelter_readiness"),
                    details=details,
                    hardening_directive={
                        "POWER_GRID": "Review scenario wind and flood loading and salt-arc exposure with the asset operator.",
                        "ARTERIAL_ROAD": "Confirm road condition and any diversions with the road operator.",
                        "MEDICAL_SHELTER": "Verify access, staffing, power, supplies and available beds with the facility.",
                    }[a["category"]],
                )
            )
        return items


# ---------------------------------------------------------------------------
# 4. Disaster-Management-Aligned RuleEngine Fallback
# ---------------------------------------------------------------------------

class RuleEngine:
    """Explicit, versioned, configurable rules for deterministic disaster operations fallback."""

    RULE_VERSION = "2.4.0-NDMA-ALIGNED"

    @classmethod
    def evaluate_rules(
        cls,
        storm_name: str,
        max_wind_kmh: float,
        central_pressure_hpa: float,
        surge_data: Dict[str, Any],
        infra_items: List[InfrastructureRisk],
        parametric_data: Dict[str, Any],
    ) -> GeminiDecisionIntelligence:
        critical_count = sum(i.overall_vulnerability == "CRITICAL" for i in infra_items)
        elevated = max_wind_kmh >= 118 or surge_data["peak_surge_height_m"] >= 2.5
        urgency = "PRIORITY_REVIEW" if elevated or critical_count else "MONITOR"
        rating = "RED_HIGH_CONSEQUENCE" if critical_count >= 2 else "ORANGE_ELEVATED" if elevated or critical_count else "YELLOW_WATCH"

        evidence_actions = []
        for category, domain in (("POWER_GRID", "Electrical grid"), ("ARTERIAL_ROAD", "Road access"), ("MEDICAL_SHELTER", "Medical shelter")):
            group = [item for item in infra_items if item.category == category]
            if not group:
                continue
            worst = max(group, key=lambda item: max(item.wind_exposure_pct, item.flood_exposure_pct))
            evidence_actions.append(RecommendationEvidenceAction(
                domain=domain, evidence=[f"{len(group)} illustrative assets in the selected region.",
                    f"{worst.name}: wind {worst.wind_exposure_pct}% and surge {worst.flood_exposure_pct}% of assumed thresholds."],
                reasoning="Scenario exposure is compared with reference design values. Current operating conditions require verification.",
                action=worst.hardening_directive, deadline="During scenario review",
                priority={"CRITICAL": "CRITICAL", "ELEVATED": "HIGH", "LOW": "MODERATE"}[worst.overall_vulnerability],
            ))
        hardening_directives = [{k: getattr(ea, k) for k in ("domain", "action", "deadline", "priority")} for ea in evidence_actions]
        reasoning_steps = [
            f"Scenario wind {max_wind_kmh} km/h, modeled surge {surge_data['peak_surge_height_m']} m.",
            f"{critical_count} of {len(infra_items)} reference assets crossed a critical screening threshold.",
            f"Simulated payout is INR {parametric_data['disbursed_liquidity_inr_cr']} crore.",
        ]

        return GeminiDecisionIntelligence(
            engine_source="Disaster-management-aligned rule-based fallback (Engine v2.4)",
            confidence_score=0.0,
            resilience_rating=rating,
            urgency_level=urgency,
            executive_summary=(f"{storm_name} scenario: {max_wind_kmh} km/h, {central_pressure_hpa} hPa. "
                               f"Modeled surge {surge_data['peak_surge_height_m']} m. "
                               f"{critical_count} of {len(infra_items)} regional reference assets reach the high screening band."),
            evidence_reasoning_actions=evidence_actions,
            hardening_directives=hardening_directives,
            reasoning_steps=reasoning_steps,
        )


# ---------------------------------------------------------------------------
# 5. Gemini 3.7 Flash Multimodal Reasoning Engine
# ---------------------------------------------------------------------------

class GeminiMultimodalReasoningEngine:
    """Gemini 3.7 Flash Multimodal Reasoning Engine for Cyclone Impact & Vulnerability Forecaster."""

    @staticmethod
    def generate_resilience_intelligence(
        storm_name: str,
        eye_lat: float,
        eye_lon: float,
        max_wind_kmh: float,
        central_pressure_hpa: float,
        heading_deg: float,
        forward_speed_kmh: float,
        surge_data: Dict[str, Any],
        infra_items: List[InfrastructureRisk],
        parametric_data: Dict[str, Any],
        simulate_failure: bool = False,
    ) -> GeminiDecisionIntelligence:
        """Synthesizes high-level multimodal reasoning using Gemini 3.7 Flash or falls back to RuleEngine."""

        # 1. Developer / Evaluator Failure Simulation Flag
        if simulate_failure:
            print("[CYCLONEX REASONING] Simulated Gemini failure triggered. Executing RuleEngine fallback gracefully.")
            return RuleEngine.evaluate_rules(
                storm_name=storm_name,
                max_wind_kmh=max_wind_kmh,
                central_pressure_hpa=central_pressure_hpa,
                surge_data=surge_data,
                infra_items=infra_items,
                parametric_data=parametric_data,
            )

        # 2. Check if live Gemini API is configured
        if GEMINI_API_KEY:
            try:
                critical_count = sum(1 for i in infra_items if i.overall_vulnerability == "CRITICAL")
                prompt_text = f"""
                You draft scenario-screening recommendations for review. These are simulated hazards and reference assets, not verified observations or official directives. Never claim live satellite ingestion, actual funding or dispatch.
                Analyze the following cyclone track & infrastructure vulnerability telemetry:
                - Storm: {storm_name} at ({eye_lat}°N, {eye_lon}°E)
                - Intensity: Peak Sustained Winds {max_wind_kmh} km/h, Central Pressure {central_pressure_hpa} hPa
                - Forward Motion: Heading {heading_deg}°, Speed {forward_speed_kmh} km/h
                - Simulated Storm Surge: {surge_data['peak_surge_height_m']}m crest, inundation reach {surge_data['inundation_reach_km']} km
                - 24h Projected Runoff: {surge_data['projected_24h_rainfall_mm']}mm (Risk: {surge_data['flash_flood_risk_level']})
                - Critical Infrastructure: {critical_count} assets at CRITICAL RISK across Power, Roads, and Medical Shelters
                - Parametric Insurance: {parametric_data['payout_status']} (₹{parametric_data['disbursed_liquidity_inr_cr']} Cr simulated)

                Provide a simulation summary for human review in valid JSON with:
                1. "executive_summary": String briefing disaster commanders.
                2. "resilience_rating": "RED_HIGH_CONSEQUENCE" | "ORANGE_ELEVATED" | "YELLOW_WATCH"
                3. "urgency_level": "PRIORITY_REVIEW" | "MONITOR"
                4. "evidence_reasoning_actions": Array of objects, each containing:
                   - "domain": String
                   - "evidence": Array of 2-3 bullet point observations
                   - "reasoning": Concise explanation of physical mechanism
                   - "action": Verification step for the asset operator
                   - "deadline": String countdown
                   - "priority": "CRITICAL" | "HIGH"
                5. "reasoning_steps": Array of 3 concise XAI points
                """
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
                resp = requests.post(
                    url,
                    headers={"x-goog-api-key": GEMINI_API_KEY},
                    json={"contents": [{"parts": [{"text": prompt_text}]}], "generationConfig": {"responseMimeType": "application/json"}},
                    timeout=7.0
                )
                if resp.status_code == 200:
                    text_out = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    clean_json = text_out
                    if "```json" in clean_json:
                        clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                    elif "```" in clean_json:
                        clean_json = clean_json.split("```")[1].split("```")[0].strip()
                    parsed = json.loads(clean_json)

                    evidence_actions = [RecommendationEvidenceAction.model_validate(item) for item in parsed["evidence_reasoning_actions"]]
                    if parsed["urgency_level"] not in {"PRIORITY_REVIEW", "MONITOR"}:
                        raise ValueError("Unsupported scenario urgency")
                    hardening_directives = [
                        {"domain": ea.domain, "action": ea.action, "deadline": ea.deadline, "priority": ea.priority}
                        for ea in evidence_actions
                    ]

                    return GeminiDecisionIntelligence(
                        engine_source=f"Gemini API ({GEMINI_MODEL}; scenario inputs only)",
                        confidence_score=0.0,
                        resilience_rating=parsed["resilience_rating"],
                        urgency_level=parsed["urgency_level"],
                        executive_summary=parsed["executive_summary"],
                        evidence_reasoning_actions=evidence_actions,
                        hardening_directives=hardening_directives,
                        reasoning_steps=parsed["reasoning_steps"],
                    )
            except Exception as e:
                print(f"[CYCLONEX GEMINI WARN] Live API call failed, falling back to RuleEngine: {e}")

        # 3. Default to Disaster-Management-Aligned RuleEngine Fallback
        return RuleEngine.evaluate_rules(
            storm_name=storm_name,
            max_wind_kmh=max_wind_kmh,
            central_pressure_hpa=central_pressure_hpa,
            surge_data=surge_data,
            infra_items=infra_items,
            parametric_data=parametric_data,
        )


# ---------------------------------------------------------------------------
# 6. Parametric Liquidity Simulation (Fintech / Resilience)
# ---------------------------------------------------------------------------

class ParametricInsuranceLiquidityFacility:
    """Pre-landfall smart covenant triggers and automated contingency liquidity simulator."""

    @staticmethod
    def evaluate_parametric_triggers(
        max_wind_kmh: float,
        surge_height_m: float,
        distance_to_coast_km: float | None = None,
    ) -> Dict[str, Any]:
        policy_coverage_inr_cr = 100.0  # ₹100 Crore emergency pool

        # Trigger 1: Wind Exceedance (Cat-in-a-Circle: >= 120 km/h within 60 km)
        wind_met = max_wind_kmh >= 120.0 and distance_to_coast_km is not None and distance_to_coast_km <= 60.0
        wind_payout_pct = 40.0 if wind_met else 0.0

        # Trigger 2: Storm Surge Crest (>= 2.5m)
        surge_met = surge_height_m >= 2.5
        surge_payout_pct = 60.0 if surge_met else 0.0

        total_payout_pct = min(100.0, wind_payout_pct + surge_payout_pct)
        total_payout_inr_cr = round((total_payout_pct / 100.0) * policy_coverage_inr_cr, 2)

        status_label = (
            "100% SMART COVENANT LIQUIDITY TRIGGERED" if total_payout_pct >= 100.0
            else "PARTIAL SIMULATED PAYOUT" if total_payout_pct > 0.0
            else "MONITORING (BELOW THRESHOLDS)"
        )

        triggers = [
            {
                "trigger_name": "Cat-in-a-Circle Gale Wind Exceedance",
                "threshold": "Wind >= 120 km/h within 60 km radius",
                "recorded_metric": f"{max_wind_kmh} km/h, " + (f"{distance_to_coast_km:.1f} km from generalized coastline" if distance_to_coast_km is not None else "outside coastal search radius"),
                "status": "TRIGGER_MET (40% Payout)" if wind_met else "MONITORING",
                "payout_percentage": wind_payout_pct,
            },
            {
                "trigger_name": "Hydrodynamic Surge Crest Depth",
                "threshold": "Surge Height >= 2.5m MSL",
                "recorded_metric": f"{surge_height_m}m MSL",
                "status": "TRIGGER_MET (60% Payout)" if surge_met else "MONITORING",
                "payout_percentage": surge_payout_pct,
            },
        ]

        allocations = [
            {"item": "Emergency Diesel Generator Leases & Fuel Tanker Reserves", "allocation_cr": round(total_payout_inr_cr * 0.35, 1)},
            {"item": "Pre-Landfall Mass Evacuation Bus Fleet Logistics", "allocation_cr": round(total_payout_inr_cr * 0.30, 1)},
            {"item": "Hospital Potable Water, IV Fluids & Trauma Medical Kits", "allocation_cr": round(total_payout_inr_cr * 0.25, 1)},
            {"item": "Mobile Satellite Communications Contingency Units", "allocation_cr": round(total_payout_inr_cr * 0.10, 1)},
        ]

        return {
            "facility_name": "Indian Ocean Coastal Municipal Parametric Resilience Facility (Simulation)",
            "insured_entity": "State Disaster Management Authority & Municipal Consortia",
            "total_coverage_inr_cr": policy_coverage_inr_cr,
            "triggers": triggers,
            "total_payout_percentage": total_payout_pct,
            "disbursed_liquidity_inr_cr": total_payout_inr_cr,
            "payout_status": status_label,
            "time_to_settlement": "Simulation only",
            "allocated_funds_use": allocations,
            "disclaimer": "Parametric Liquidity Simulation: Demonstrates pre-agreed smart covenant trigger and resource allocation. Genuine banking wire settlement requires Core Banking / RBI e-Kuber integration.",
        }


# ---------------------------------------------------------------------------
# 7. Evacuation Routing & Shelter Capacity Engine
# ---------------------------------------------------------------------------

class EvacuationRoutingEngine:
    """Generates trade-off-aware evacuation routes and capacity assignment."""

    @staticmethod
    def compute_evacuation_assessment(eye_lon: float, surge_height_m: float, eye_lat: float = 20.4) -> EvacuationAssessment:
        from routing_service import road_routes
        result = road_routes(eye_lat, eye_lon)
        return EvacuationAssessment(
            status=result["status"], source=result["source"], notice=result["notice"],
            recommended_routes=[EvacuationRouteOption(**r) for r in result["routes"]],
            estimated_evacuee_target=None, assigned_shelter_count=0, shelter_capacity_margin_pct=None,
            bottleneck_warnings=[result["notice"]], transit_evacuation_window_hours=None,
        )


# ---------------------------------------------------------------------------
# 8. Master Cyclone Resilience Service
# ---------------------------------------------------------------------------

class CycloneResilienceService:
    """Master service combining GEE satellite feeds, infrastructure exposure, surge/runoff modeling, and Gemini 3.7 Flash."""

    def evaluate_resilience_assessment(
        self,
        storm_name: str = "Cyclone Dana",
        eye_lat: float = 20.4,
        eye_lon: float = 86.8,
        max_wind_kmh: float = 125.0,
        central_pressure_hpa: float = 980.0,
        heading_deg: float = 320.0,
        forward_speed_kmh: float = 18.0,
        simulate_failure_gemini: bool = False,
        simulate_failure_gee: bool = False,
        simulate_failure_weather: bool = False,
        deploy_countermeasure: bool = False,
        rain_rate_mm_hr: float = 75.0,
    ) -> Dict[str, Any]:
        """Runs the complete Track-Based Cyclone Impact & Infrastructure Vulnerability Forecaster pipeline."""

        # 1. Physics-Informed Storm Surge & Spatial Inundation Modeling
        surge_data = StormSurgeAndRunoffModel.compute_surge_and_runoff(
            eye_lat=eye_lat,
            eye_lon=eye_lon,
            max_wind_kmh=max_wind_kmh,
            central_pressure_hpa=central_pressure_hpa,
            heading_deg=heading_deg,
            forward_speed_kmh=forward_speed_kmh,
            deploy_countermeasure=deploy_countermeasure,
            rain_rate_mm_hr=rain_rate_mm_hr,
        )

        # 2. Critical Infrastructure Vulnerability Registry
        infra_items = CriticalInfrastructureRegistry.get_regional_infrastructure(
            eye_lat=eye_lat,
            eye_lon=eye_lon,
            max_wind_kmh=max_wind_kmh,
            surge_height_m=surge_data["peak_surge_height_m"],
            deploy_countermeasure=deploy_countermeasure,
        )

        # 3. Parametric Liquidity Simulation (Fintech)
        parametric_data = ParametricInsuranceLiquidityFacility.evaluate_parametric_triggers(
            max_wind_kmh=max_wind_kmh,
            surge_height_m=surge_data["peak_surge_height_m"],
            distance_to_coast_km=coast_distance_within(eye_lat, eye_lon, 60),
        )

        # 4. Google Earth Engine (GEE) Multi-Sensor Satellite Feeds
        gee_layers = GoogleEarthEngineFeeds.get_gee_catalog_layers(
            basin="BAY_OF_BENGAL" if eye_lon >= 78.0 else "ARABIAN_SEA",
            simulate_offline=simulate_failure_gee,
        )

        # 5. Evacuation Routing & Shelter Assignment
        evacuation_data = EvacuationRoutingEngine.compute_evacuation_assessment(
            eye_lon=eye_lon,
            eye_lat=eye_lat,
            surge_height_m=surge_data["peak_surge_height_m"],
        )

        # 6. Gemini 3.7 Flash Decision Intelligence (or RuleEngine Fallback)
        gemini_intel = GeminiMultimodalReasoningEngine.generate_resilience_intelligence(
            storm_name=storm_name,
            eye_lat=eye_lat,
            eye_lon=eye_lon,
            max_wind_kmh=max_wind_kmh,
            central_pressure_hpa=central_pressure_hpa,
            heading_deg=heading_deg,
            forward_speed_kmh=forward_speed_kmh,
            surge_data=surge_data,
            infra_items=infra_items,
            parametric_data=parametric_data,
            simulate_failure=simulate_failure_gemini,
        )

        # 7. Multilingual Early-Warning Advisory Dispatches (6 Coastal Languages)
        # All languages identify the source and the scope of the three modeled values.
        surge, rain = surge_data["peak_surge_height_m"], surge_data["projected_24h_rainfall_mm"]
        multilingual_advisories = {
            "en": f"Scenario exercise for {storm_name}. Wind {max_wind_kmh} km/h, modeled surge {surge} m, estimated 24-hour rain {rain} mm. Follow official local warnings.",
            "hi": f"{storm_name} का काल्पनिक परिदृश्य। हवा {max_wind_kmh} किमी/घं, अनुमानित तूफानी ज्वार {surge} मीटर और 24 घंटे की वर्षा {rain} मिमी। स्थानीय आधिकारिक चेतावनी का पालन करें।",
            "bn": f"{storm_name} নিয়ে মহড়া। বাতাস {max_wind_kmh} কিমি/ঘণ্টা, আনুমানিক জলোচ্ছ্বাস {surge} মিটার এবং ২৪ ঘণ্টার বৃষ্টি {rain} মিমি। স্থানীয় সরকারি সতর্কতা অনুসরণ করুন।",
            "or": f"{storm_name} ପାଇଁ ଅଭ୍ୟାସ। ପବନ {max_wind_kmh} କିମି/ଘଣ୍ଟା, ଆନୁମାନିକ ଜୁଆର {surge} ମିଟର ଓ ୨୪ ଘଣ୍ଟାର ବର୍ଷା {rain} ମିମି। ସ୍ଥାନୀୟ ସରକାରୀ ସତର୍କତା ଅନୁସରଣ କରନ୍ତୁ।",
            "gu": f"{storm_name} માટે કાલ્પનિક અભ્યાસ. પવન {max_wind_kmh} કિમી/કલાક, અંદાજિત દરિયાઈ ઉછાળો {surge} મીટર અને ૨૪ કલાકનો વરસાદ {rain} મિમી. સ્થાનિક સત્તાવાર ચેતવણીઓ અનુસરો.",
            "mr": f"{storm_name} साठी काल्पनिक सराव. वारा {max_wind_kmh} किमी/तास, अंदाजित वादळी भरती {surge} मीटर आणि २४ तासांचा पाऊस {rain} मिमी. स्थानिक अधिकृत इशाऱ्यांचे पालन करा.",
        }
        advisory_en = multilingual_advisories["en"]
        dynamic_timeline = [
            {"phase": "Scenario review", "title": step.domain, "action": step.action}
            for step in gemini_intel.evidence_reasoning_actions
        ]
        gee_status = "SIMULATION" if simulate_failure_gee else "CATALOG_ONLY"
        live_ai = gemini_intel.engine_source.startswith("Gemini API")
        provenance_records = [
            ProvenanceRecord(output_domain=domain, data_sources=sources, dataset_collection=collection,
                             observation_timestamp=None, model_version=version, processing_latency_ms=None, status=status)
            for domain, sources, collection, version, status in [
                ("Storm surge", ["Scenario wind and pressure", "Assumed shelf and tide"], "Scenario inputs", "Surge screening", "MODEL_ESTIMATE"),
                ("Rainfall", ["Scenario rain rate and translation speed"], "Scenario inputs", "Rain accumulation", "MODEL_ESTIMATE"),
                ("Earth observation catalogue", ["GEE collection descriptions"], "Sentinel-1, SRTM, Dynamic World, VIIRS", "Catalogue", gee_status),
                ("Decision intelligence", ["Scenario model outputs", "Regional reference assets"], "Scenario inputs",
                 GEMINI_MODEL if live_ai else RuleEngine.RULE_VERSION, "LIVE" if live_ai else "MODEL_ESTIMATE"),
            ]
        ]
        system_status = SystemStatus(
            meteorology="SIMULATION" if simulate_failure_weather else "SCENARIO_INPUT", gee_sentinel1=gee_status,
            gee_srtm=gee_status, gee_dynamic_world=gee_status, gee_viirs=gee_status, ml_engine="STANDBY",
            gemini_ai="ACTIVE" if live_ai else "FALLBACK", rule_engine="STANDBY" if live_ai else "ACTIVE",
            routing_engine="ACTIVE" if evacuation_data.status == "AVAILABLE" else "FALLBACK",
        )
        post_landfall = PostLandfallAssessment(
            phase="SCENARIO", sar_flood_observation_notes="No SAR observation has been ingested.",
            viirs_nightlight_blackout_status="No radiance or outage observation has been ingested.",
            power_outage_risk_area_km2=None, restoration_priority_manifest=[],
        )
        basin = ("BAY_OF_BENGAL" if eye_lon >= 77.5 or (eye_lat < 8 and eye_lon >= 76) else "ARABIAN_SEA") if 0 <= eye_lat <= 30 and 45 <= eye_lon <= 100 else "OUTSIDE_NORTH_INDIAN_OCEAN"
        wind_band = next(name for threshold, name in [
            (222, "Super Cyclonic Storm"), (168, "Extremely Severe Cyclonic Storm"), (118, "Very Severe Cyclonic Storm"),
            (89, "Severe Cyclonic Storm"), (62, "Cyclonic Storm"), (50, "Deep Depression"), (31, "Depression"), (0, "Low Pressure Area"),
        ] if max_wind_kmh >= threshold)
        forecast = []
        for h in (6, 12, 24, 48):
            lat, lon = destination(eye_lat, eye_lon, heading_deg, forward_speed_kmh * h)
            forecast.append(ForecastPoint(hour=h, lat=lat, lon=lon, max_wind_kmh=max_wind_kmh,
                                          central_pressure_hpa=central_pressure_hpa, uncertainty_radius_km=None))
        # Build Canonical CycloneState
        cyclone_state = CycloneState(
            id=f"storm-{storm_name.lower().replace(' ', '-')}",
            name=storm_name,
            basin=basin,
            center={"lat": eye_lat, "lon": eye_lon},
            intensity={
                "maxWindKmh": max_wind_kmh,
                "centralPressureHpa": central_pressure_hpa,
                "category": wind_band if basin != "OUTSIDE_NORTH_INDIAN_OCEAN" else "Regional scale unavailable",
            },
            motion={"headingDeg": heading_deg, "forwardSpeedKmh": forward_speed_kmh},
            forecast=forecast,
            landfall=projected_landfall(eye_lat, eye_lon, heading_deg, forward_speed_kmh),
            rainfall=RainfallForecast(
                rate_mm_hr=rain_rate_mm_hr,
                projected_24h_rainfall_mm=surge_data["projected_24h_rainfall_mm"],
                soil_saturation_index=surge_data["soil_saturation_index"],
                runoff_coefficient=surge_data["runoff_coefficient"],
                drainage_utilization_pct=None,
                flash_flood_risk_level=surge_data["flash_flood_risk_level"],
            ),
            surge=SurgeAssessment(
                peak_surge_height_m=surge_data["peak_surge_height_m"],
                inverted_barometer_component_m=surge_data["inverted_barometer_component_m"],
                wind_stress_component_m=surge_data["wind_stress_component_m"],
                inundation_reach_km=surge_data["inundation_reach_km"],
                astronomical_tide_phase=surge_data["astronomical_tide_phase"],
                composite_peak_water_level_m=surge_data["composite_peak_water_level_m"],
                model_type="Physics-informed storm surge estimation (Inverted Barometer + Bathymetric Wind Stress)",
                uncertainty_range_m="Not calibrated",
            ),
            confidence=PredictionConfidence(
                score=0.0,
                uncertainty_description="Uncalibrated scenario estimate; no measured confidence available",
                prediction_interval="NOT_CALIBRATED",
            ),
            source=DataSourceStatus(
                meteorological=system_status.meteorology, storm_track="CONSTANT_MOTION",
                satellite_feeds=gee_status, terrain_srtm="NOT_INGESTED",
                provider="User-selected scenario and static catalogue descriptions",
            ),
        )

        # Assemble Full Central Resilience Assessment Result
        return {
            "status": "success",
            "challenge_meta": {
                "challenge_id": "05",
                "challenge_title": "Track-Based Cyclone Impact & Infrastructure Vulnerability Forecaster",
                "theme": "RESILIENCE",
                "domain": "Bay of Bengal & Coastal APAC Anticipatory Disaster Mitigation",
            },
            # Backward-compatible keys for existing frontend
            "storm_telemetry": {
                "name": storm_name,
                "eye_lat": eye_lat,
                "eye_lon": eye_lon,
                "max_wind_kmh": max_wind_kmh,
                "central_pressure_hpa": central_pressure_hpa,
                "heading_deg": heading_deg,
                "forward_speed_kmh": forward_speed_kmh,
            },
            "surge_and_runoff": surge_data,
            "critical_infrastructure": [item.model_dump() for item in infra_items],
            "parametric_insurance": parametric_data,
            "gee_satellite_feeds": gee_layers,
            "gemini_multimodal_advisory": {
                "source": gemini_intel.engine_source,
                "confidence_score": gemini_intel.confidence_score,
                "resilience_rating": gemini_intel.resilience_rating,
                "urgency_level": gemini_intel.urgency_level,
                "executive_summary": gemini_intel.executive_summary,
                "early_warning_advisory_dispatch": advisory_en,
                "multilingual_advisories": multilingual_advisories,
                "infrastructure_hardening_plan": gemini_intel.hardening_directives,
                "reasoning_steps": gemini_intel.reasoning_steps,
                "evidence_reasoning_actions": [era.model_dump() for era in gemini_intel.evidence_reasoning_actions],
                "input_streams_connected": {
                    "real_time_met": f"{storm_name} ({max_wind_kmh} km/h, {central_pressure_hpa} hPa, heading {heading_deg}°, speed {forward_speed_kmh} km/h)",
                    "gee_satellite": "Static collection catalogue only",
                    "storm_surge_sim": f"+{surge_data['peak_surge_height_m']}m crest, {surge_data['inundation_reach_km']} km reach (Inverted Barometer + Wind Stress)",
                    "rainfall_damage_pathways": f"{surge_data['projected_24h_rainfall_mm']}mm modeled 24h accumulation",
                    "critical_infra_vulnerability": f"{sum(1 for i in infra_items if i.overall_vulnerability == 'CRITICAL')} critical assets across Power, Roads, and Medical Shelters",
                },
                "action_synthesis": {
                    "power_hardening_action": "Verify utility asset conditions with the operator.",
                    "road_diversion_action": "Verify road closures with local authorities.",
                    "medical_shelter_action": "Confirm facility readiness and capacity.",
                    "automated_advisory_action": "Draft scenario summary available for review.",
                    "parametric_liquidity_action": f"Simulated allocation INR {parametric_data['disbursed_liquidity_inr_cr']} crore.",
                },
            },
            # Canonical Unified Architecture
            "cyclone": cyclone_state.model_dump(),
            "evacuation": evacuation_data.model_dump(),
            "dynamic_timeline": dynamic_timeline,
            "provenance": [p.model_dump() for p in provenance_records],
            "system_status": system_status.model_dump(),
            "post_landfall": post_landfall.model_dump(),
            "countermeasure_deployed": deploy_countermeasure,
        }


# Singleton service instance
resilience_service = CycloneResilienceService()


# ---------------------------------------------------------------------------
# 9. Drone & Aerial Reconnaissance Damage Inspection Engine (Multimodal Vision)
# ---------------------------------------------------------------------------

class DroneDamageInspectionEngine:
    """Multimodal Drone & Aerial Damage Reconnaissance Engine with Computer Vision / Gemini fallback."""

    SAMPLES: Dict[str, Dict[str, Any]] = {
        "sample-substation-flood": {
            "asset_id": "pwr-01",
            "asset_name": "Paradip Port 220kV Main Grid Substation",
            "image_caption": "Substation Switchyard Aerial Survey — 1.1m Inundation & Bushing Salt Crust",
            "damage_severity": "SEVERE",
            "structural_integrity_pct": 68.0,
            "detected_defects": [
                "Inundation reaching 1.1m waterline on 220kV busbar support pylons",
                "Severe marine salt-crust deposition on porcelain bushings (flashover hazard)",
                "Minor oil seepage observed near Transformer 2 radiator cooling fin base",
                "Auxiliary switchyard cable trench flooded with brackish tidal runoff",
            ],
            "critical_failure_probability": 0.85,
            "repair_priority": "P1_URGENT",
            "estimated_repair_hours": 14.5,
            "emergency_dispatch_crew": "NDRF Urban Search & Discom High-Voltage Restoration Unit 4",
            "mitigation_recommendation": "Deploy high-volume dewatering pumps (5000 LPM); spray silicone antifouling wash on transformer bushings prior to re-energizing.",
        },
        "sample-culvert-breach": {
            "asset_id": "rd-01",
            "asset_name": "National Highway 53 (NH-53) Coastal Arterial Corridor",
            "image_caption": "NH-53 Km 18.4 Culvert Breach & Fallen Mangrove Canopy Blockade",
            "damage_severity": "CRITICAL",
            "structural_integrity_pct": 42.0,
            "detected_defects": [
                "Km 18.4 box culvert embankment undercut by 1.8m tidal surge scour",
                "Fallen Casuarina tree canopy blocking westbound dual carriageway",
                "Asphalt sub-base erosion along 120m coastal shoulder section",
                "Standing water depth measured at 0.95m across all 4 traffic lanes",
            ],
            "critical_failure_probability": 0.94,
            "repair_priority": "P1_URGENT",
            "estimated_repair_hours": 8.0,
            "emergency_dispatch_crew": "NHAI Rapid Engineering Battalion & ODRAF Tree Clearing Crew",
            "mitigation_recommendation": "Deploy gabion stone revetments at culvert wingwall; divert all emergency convoys to SH-12 Elevated Ridge Bypass.",
        },
        "sample-hospital-roof": {
            "asset_id": "med-01",
            "asset_name": "Paradip District Central Civil Hospital & Emergency Hub",
            "image_caption": "Hospital Complex Drone Oblique — Rooftop Solar Array & Trauma Wing Status",
            "damage_severity": "MODERATE",
            "structural_integrity_pct": 86.0,
            "detected_defects": [
                "Solar array panel dislodgement on western rooftop terrace (wind gust damage)",
                "Rainwater ingress in Level 3 outpatient corridor through cracked seal",
                "Backup generator radiator louvers intact; fuel tank watertight and operating",
                "Rooftop liquid oxygen tank anchor bolts secured with zero displacement",
            ],
            "critical_failure_probability": 0.22,
            "repair_priority": "P2_ELEVATED",
            "estimated_repair_hours": 4.5,
            "emergency_dispatch_crew": "Public Works Department (PWD) Structural Repair Squad",
            "mitigation_recommendation": "Clear roof drainage scuppers to prevent ponding load; apply temporary tarpaulin cladding over OPD skylights.",
        },
    }

    @classmethod
    def inspect_drone_damage(
        cls,
        asset_id: str,
        sample_id: Optional[str] = None,
        image_base64: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Analyze an actual image, or return an explicitly selected demonstration."""
        from copy import deepcopy
        import base64
        import io
        from PIL import Image
        if image_base64:
            encoded = image_base64.split(",", 1)[-1]
            try:
                if len(encoded) > 4 * ((10 * 1024 * 1024 + 2) // 3):
                    raise ValueError("Image exceeds 10 MB")
                raw = base64.b64decode(encoded, validate=True)
                if len(raw) > 10 * 1024 * 1024:
                    raise ValueError("Image exceeds 10 MB")
                with Image.open(io.BytesIO(raw)) as image:
                    if image.format not in {"JPEG", "PNG"} or image.width * image.height > 25_000_000:
                        raise ValueError("Unsupported image")
                    mime = Image.MIME[image.format]
                    image.verify()
            except Exception as exc:
                raise ValueError("Invalid image. Supply a base64 PNG or JPEG, maximum 10 MB.") from exc
            if not GEMINI_API_KEY:
                raise RuntimeError("Image analysis unavailable: configure GEMINI_API_KEY. Sample reports are available only by explicitly selecting a sample.")
            prompt = ("Inspect this image for visible damage only. Do not invent telemetry, structural capacity, failure probabilities, repair duration or deployment of crews. "
                      "Return JSON: asset_name, image_caption, damage_severity (CRITICAL/SEVERE/MODERATE/MINOR/NONE_VISIBLE/INDETERMINATE), detected_defects (array of strings), "
                      "repair_priority, mitigation_recommendation. State uncertainties and recommend an on-site inspection. Asset reference: " + asset_id)
            try:
                response = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                    headers={"x-goog-api-key": GEMINI_API_KEY},
                    json={"contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": mime, "data": encoded}}]}],
                          "generationConfig": {"responseMimeType": "application/json"}}, timeout=(3, 25))
                response.raise_for_status()
                report = json.loads(response.json()["candidates"][0]["content"]["parts"][0]["text"])
                if (not isinstance(report, dict) or not isinstance(report.get("detected_defects"), list)
                    or not all(isinstance(d, str) for d in report["detected_defects"])
                    or not all(isinstance(report.get(k), str) for k in ("asset_name", "image_caption", "repair_priority", "mitigation_recommendation"))
                    or report.get("damage_severity") not in ("CRITICAL", "SEVERE", "MODERATE", "MINOR", "NONE_VISIBLE", "INDETERMINATE")):
                    raise ValueError("Invalid vision response")
            except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as exc:
                raise RuntimeError("Image analysis provider unavailable or returned an invalid report. No sample result was substituted.") from exc
            report.update({"engine": f"Gemini API ({GEMINI_MODEL})", "provenance": "USER_IMAGE_UNVALIDATED_AI_ASSESSMENT",
                           "structural_integrity_pct": None, "critical_failure_probability": None, "estimated_repair_hours": None,
                           "emergency_dispatch_crew": "No crew dispatched"})
        elif sample_id:
            if sample_id not in cls.SAMPLES:
                raise ValueError("Unknown sample_id")
            report = deepcopy(cls.SAMPLES[sample_id])
            report.update({"engine": "DEMONSTRATION_SAMPLE", "provenance": "DEMONSTRATION_SAMPLE", "notice": "Illustrative sample report; no drone image was analyzed."})
        else:
            raise ValueError("Supply image_base64 or explicitly select a sample_id.")
        report.update({"status": "success", "inspected_asset_id": asset_id,
                       "inspection_timestamp": datetime.now(timezone.utc).isoformat(),
                       "drone_telemetry": {"altitude_agl_m": None, "sensor": "Not supplied", "gimbal_pitch_deg": None,
                                           "gps_fix": "Not supplied", "survey_flight_speed_ms": None}})
        return report


# ---------------------------------------------------------------------------
# 10. OASIS Common Alerting Protocol (CAP v1.2) Standard Exporter
# ---------------------------------------------------------------------------

def generate_cap_alert_xml(
    storm_name: str = "Cyclone Dana",
    max_wind_kmh: float = 125.0,
    peak_surge_m: float = 2.8,
    eye_lat: float = 20.4,
    eye_lon: float = 86.8,
    affected_blocks: Optional[List[str]] = None,
) -> str:
    """Generates standard OASIS Common Alerting Protocol (CAP v1.2) XML payload compliant with NDMA SACHET."""
    from uuid import uuid4
    from xml.sax.saxutils import escape
    storm_name = escape(storm_name)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    blocks_str = escape(", ".join(affected_blocks or [f"Scenario area near {eye_lat}, {eye_lon}"]))
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>CYCLONEX-EXERCISE-{uuid4()}</identifier>
  <sender>CYCLONEX-RESEARCH-PROTOTYPE</sender>
  <sent>{now_iso}</sent>
  <status>Exercise</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>Cyclone scenario exercise</event>
    <urgency>Unknown</urgency>
    <severity>Unknown</severity>
    <certainty>Possible</certainty>
    <eventCode>
      <valueName>CYCLONEX</valueName>
      <value>SCENARIO</value>
    </eventCode>
    <headline>SCENARIO EXERCISE: {storm_name} with +{peak_surge_m}m peak surge and {max_wind_kmh} km/h winds</headline>
    <description>Scenario center at latitude {eye_lat}, longitude {eye_lon}. Inputs specify wind of {max_wind_kmh} km/h and a peak surge of {peak_surge_m} m. Inundation extent is unverified.</description>
    <instruction>EXERCISE ONLY. Confirm all scenario estimates with the responsible authority before taking operational action.</instruction>
    <web>https://cyclonex.vercel.app/#resilience</web>
    <contact>Research prototype; no official alert has been issued.</contact>
    <area>
      <areaDesc>{blocks_str}</areaDesc>
    </area>
  </info>
</alert>"""
    return xml.strip()
