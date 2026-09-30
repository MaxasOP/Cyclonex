"""Automated End-to-End Resilience Pipeline Test Suite for CYCLONEX.

Validates:
1. Physics-informed storm surge & astronomical tide coupling
2. Causal rainfall runoff accumulation & drainage overtopping
3. GEE satellite connector & authentic metadata schemas
4. Critical infrastructure vulnerability calculations (Power, Roads, Medical Shelters)
5. Gemini 3.7 Flash Decision Intelligence & RuleEngine v2.4 fallback
6. Evacuation route trade-off options (Fastest vs Safest)
7. Parametric Liquidity Simulation dual-trigger covenants
8. Graceful degradation under failure simulation (Gemini offline, GEE offline, Met offline)
"""

import sys
import unittest
from datetime import datetime

from canonical_models import (
    CentralResilienceAssessment,
    CycloneState,
    InfrastructureRisk,
    RecommendationEvidenceAction,
    SystemStatus,
)
from gemini_resilience_service import (
    CriticalInfrastructureRegistry,
    EvacuationRoutingEngine,
    GoogleEarthEngineFeeds,
    ParametricInsuranceLiquidityFacility,
    RuleEngine,
    StormSurgeAndRunoffModel,
    resilience_service,
)


class TestStormSurgeAndRunoffModel(unittest.TestCase):
    """Validates physics-informed hydrodynamic surge and causal rainfall modeling."""

    def test_inverted_barometer_and_wind_stress(self):
        # Category 3 storm: Pc = 970 hPa (43.25 hPa deficit), V = 140 km/h
        res = StormSurgeAndRunoffModel.compute_surge_and_runoff(
            eye_lat=20.4,
            eye_lon=86.8,
            max_wind_kmh=140.0,
            central_pressure_hpa=970.0,
            heading_deg=320.0,
            forward_speed_kmh=18.0,
            rain_rate_mm_hr=75.0,
        )
        # IB component should be ~0.43m
        self.assertAlmostEqual(res["inverted_barometer_component_m"], 0.43, places=1)
        # Peak surge must be positive and bounded by physics
        self.assertGreater(res["peak_surge_height_m"], 1.5)
        self.assertLessEqual(res["peak_surge_height_m"], 7.5)
        # Astronomical tide coupling check
        self.assertGreater(res["composite_peak_water_level_m"], res["peak_surge_height_m"])
        self.assertEqual(res["astronomical_tide_phase"], "SPRING_HIGH_TIDE (+1.4m)")

    def test_causal_rainfall_pathway(self):
        res = StormSurgeAndRunoffModel.compute_surge_and_runoff(
            eye_lat=20.4,
            eye_lon=86.8,
            max_wind_kmh=120.0,
            central_pressure_hpa=984.0,
            heading_deg=315.0,
            forward_speed_kmh=15.0,  # Slower speed dumps more water
            rain_rate_mm_hr=80.0,
        )
        self.assertGreater(res["projected_24h_rainfall_mm"], 250.0)
        self.assertIn("SATURATED", res["soil_saturation_index"])
        self.assertEqual(res["flash_flood_risk_level"], "EXTREME")
        self.assertEqual(len(res["primary_drainage_pathways"]), 3)
        self.assertIn("OVERTOPPING", res["primary_drainage_pathways"][0]["capacity_utilization"])


class TestGEEFeeds(unittest.TestCase):
    """Validates Earth Observation satellite connector metadata and provenance."""

    def test_gee_catalog_layers(self):
        layers = GoogleEarthEngineFeeds.get_gee_catalog_layers("BAY_OF_BENGAL", simulate_offline=False)
        self.assertEqual(len(layers), 4)
        layer_ids = [l["id"] for l in layers]
        self.assertIn("gee-s1-sar", layer_ids)
        self.assertIn("gee-srtm-dem", layer_ids)
        self.assertIn("gee-dynamic-world", layer_ids)
        self.assertIn("gee-viirs-dnb", layer_ids)

        # Check Sentinel-1 SAR specifications
        s1 = next(l for l in layers if l["id"] == "gee-s1-sar")
        self.assertEqual(s1["instrument"], "C-SAR (5.405 GHz)")
        self.assertEqual(s1["polarization"], "VV + VH Dual-Pol")
        self.assertEqual(s1["resolution"], "10m Spatial Ground Resolution")

    def test_gee_offline_simulation(self):
        layers = GoogleEarthEngineFeeds.get_gee_catalog_layers("BAY_OF_BENGAL", simulate_offline=True)
        s1 = next(l for l in layers if l["id"] == "gee-s1-sar")
        self.assertEqual(s1["status"], "SIMULATION")


class TestCriticalInfrastructureRegistry(unittest.TestCase):
    """Validates common vulnerability engine for Power, Roads, and Medical citadels."""

    def test_infrastructure_vulnerability_scoring(self):
        items = CriticalInfrastructureRegistry.get_regional_infrastructure(
            eye_lat=20.4,
            eye_lon=86.8,
            max_wind_kmh=130.0,
            surge_height_m=3.1,
        )
        self.assertGreaterEqual(len(items), 5)
        
        # Test 220kV Substation (Power Grid)
        pwr = next(i for i in items if i.category == "POWER_GRID")
        self.assertGreater(pwr.wind_exposure_pct, 70.0)
        self.assertGreater(pwr.flood_exposure_pct, 80.0)
        self.assertGreater(pwr.salt_spray_exposure_pct, 30.0)
        self.assertEqual(pwr.overall_vulnerability, "CRITICAL")
        self.assertIn("salt-arc", pwr.hardening_directive)

        # Test Arterial Road Passability & Alternate Route
        road = next(i for i in items if i.category == "ARTERIAL_ROAD")
        self.assertEqual(road.passability_status, "IMPASSABLE_FLOODED")
        self.assertIsNotNone(road.alternate_route)
        self.assertGreater(road.alternate_route["additional_km"], 0.0)

        # Test Medical Shelter Readiness Index
        shelter = next(i for i in items if i.category == "MEDICAL_SHELTER")
        readiness = shelter.shelter_readiness
        self.assertIsNotNone(readiness)
        self.assertGreater(readiness["physical_safety_score"], 0.8)
        self.assertGreater(readiness["operational_readiness_score"], 0.8)
        self.assertGreater(readiness["overall_readiness_index"], 0.8)


class TestRuleEngineAndGeminiDecisionIntelligence(unittest.TestCase):
    """Validates deterministic disaster rules and structured decision outputs."""

    def test_rule_engine_deterministic_fallback(self):
        surge_mock = {
            "peak_surge_height_m": 2.9,
            "inundation_reach_km": 36.0,
            "projected_24h_rainfall_mm": 240.0,
        }
        infra_mock = CriticalInfrastructureRegistry.get_regional_infrastructure(20.4, 86.8, 125.0, 2.9)
        param_mock = {"disbursed_liquidity_inr_cr": 100.0, "payout_status": "TRIGGERED"}

        intel = RuleEngine.evaluate_rules(
            storm_name="Cyclone Dana",
            max_wind_kmh=125.0,
            central_pressure_hpa=980.0,
            surge_data=surge_mock,
            infra_items=infra_mock,
            parametric_data=param_mock,
        )

        self.assertIn("rule-based fallback", intel.engine_source)
        self.assertEqual(intel.urgency_level, "MANDATORY_EVACUATION")
        self.assertEqual(len(intel.evidence_reasoning_actions), 3)

        # Verify Evidence -> Reasoning -> Action structure
        power_action = intel.evidence_reasoning_actions[0]
        self.assertGreaterEqual(len(power_action.evidence), 2)
        self.assertIsNotNone(power_action.reasoning)
        self.assertIsNotNone(power_action.action)
        self.assertEqual(power_action.priority, "CRITICAL")


class TestEvacuationRouting(unittest.TestCase):
    """Validates multi-strategy evacuation routing and trade-off generation."""

    def test_evacuation_routes(self):
        evac = EvacuationRoutingEngine.compute_evacuation_assessment(eye_lon=86.8, surge_height_m=2.8)
        self.assertEqual(len(evac.recommended_routes), 4)
        
        types = [r.route_type for r in evac.recommended_routes]
        self.assertIn("Fastest", types)
        self.assertIn("Safest", types)
        self.assertIn("Flood-avoiding", types)
        self.assertIn("Capacity-aware", types)

        fast = next(r for r in evac.recommended_routes if r.route_type == "Fastest")
        safe = next(r for r in evac.recommended_routes if r.route_type == "Safest")
        # Safest route must have lower flood risk than fastest
        self.assertGreater(safe.distance_km, fast.distance_km)
        self.assertEqual(safe.flood_risk_level, "LOW")


class TestParametricLiquiditySimulation(unittest.TestCase):
    """Validates fintech smart covenant triggers and pre-landfall funds allocation."""

    def test_dual_triggers_met(self):
        # Wind >= 120 km/h (40%), Surge >= 2.5m (60%) -> 100% payout
        res = ParametricInsuranceLiquidityFacility.evaluate_parametric_triggers(
            max_wind_kmh=125.0,
            surge_height_m=2.8,
            distance_to_coast_km=20.0,
        )
        self.assertEqual(res["total_payout_percentage"], 100.0)
        self.assertEqual(res["disbursed_liquidity_inr_cr"], 100.0)
        self.assertIn("100% SMART COVENANT LIQUIDITY TRIGGERED", res["payout_status"])
        self.assertEqual(len(res["allocated_funds_use"]), 4)

    def test_partial_trigger(self):
        # Wind < 120 km/h (0%), Surge >= 2.5m (60%) -> 60% payout
        res = ParametricInsuranceLiquidityFacility.evaluate_parametric_triggers(
            max_wind_kmh=105.0,
            surge_height_m=2.6,
            distance_to_coast_km=20.0,
        )
        self.assertEqual(res["total_payout_percentage"], 60.0)
        self.assertEqual(res["disbursed_liquidity_inr_cr"], 60.0)


class TestFullResilienceServiceIntegration(unittest.TestCase):
    """Validates end-to-end integration and graceful degradation."""

    def test_standard_evaluation(self):
        res = resilience_service.evaluate_resilience_assessment(
            storm_name="Cyclone Dana",
            eye_lat=20.4,
            eye_lon=86.8,
            max_wind_kmh=125.0,
            central_pressure_hpa=980.0,
        )
        self.assertEqual(res["status"], "success")
        self.assertIn("cyclone", res)
        self.assertIn("surge_and_runoff", res)
        self.assertIn("critical_infrastructure", res)
        self.assertIn("evacuation", res)
        self.assertIn("dynamic_timeline", res)
        self.assertIn("provenance", res)
        self.assertIn("system_status", res)
        self.assertIn("post_landfall", res)

    def test_graceful_degradation_failure_simulation(self):
        res = resilience_service.evaluate_resilience_assessment(
            storm_name="Cyclone Dana",
            eye_lat=20.4,
            eye_lon=86.8,
            simulate_failure_gemini=True,
            simulate_failure_gee=True,
            simulate_failure_weather=True,
        )
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["system_status"]["gemini_ai"], "FALLBACK")
        self.assertEqual(res["system_status"]["rule_engine"], "ACTIVE")
        self.assertEqual(res["system_status"]["gee_sentinel1"], "SIMULATION")
        self.assertEqual(res["system_status"]["meteorology"], "SIMULATION")


if __name__ == "__main__":
    unittest.main()
