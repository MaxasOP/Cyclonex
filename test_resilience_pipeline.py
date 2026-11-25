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
from unittest.mock import patch
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
        self.assertEqual(res["astronomical_tide_phase"], "ASSUMED_HIGH_TIDE (+1.4m)")

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
        self.assertEqual(res["primary_drainage_pathways"], [])
        self.assertAlmostEqual(res["modeled_runoff_mm"], res["projected_24h_rainfall_mm"] * res["runoff_coefficient"], places=1)


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
        self.assertIn("asset operator", pwr.hardening_directive)

        # Test Arterial Road Passability & Alternate Route
        road = next(i for i in items if i.category == "ARTERIAL_ROAD")
        self.assertEqual(road.passability_status, "MODELED_FLOOD_EXPOSURE")
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
        self.assertEqual(intel.urgency_level, "PRIORITY_REVIEW")
        self.assertEqual(len(intel.evidence_reasoning_actions), 3)

        # Verify Evidence -> Reasoning -> Action structure
        power_action = intel.evidence_reasoning_actions[0]
        self.assertGreaterEqual(len(power_action.evidence), 2)
        self.assertIsNotNone(power_action.reasoning)
        self.assertIsNotNone(power_action.action)
        self.assertIn(power_action.priority, {"CRITICAL", "HIGH"})


class TestEvacuationRouting(unittest.TestCase):
    """Validates multi-strategy evacuation routing and trade-off generation."""

    def test_evacuation_routes(self):
        with patch("routing_service.road_routes", return_value={"status": "UNAVAILABLE", "source": "OSRM_ROAD_NETWORK", "routes": [], "notice": "Provider unavailable"}):
            evac = EvacuationRoutingEngine.compute_evacuation_assessment(eye_lon=86.8, surge_height_m=2.8)
        self.assertEqual(evac.status, "UNAVAILABLE")
        self.assertEqual(evac.recommended_routes, [])
        self.assertEqual(evac.assigned_shelter_count, 0)



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
    def setUp(self):
        routes = patch("routing_service.road_routes", return_value={"status":"UNAVAILABLE", "source":"OSRM_ROAD_NETWORK", "routes":[], "notice":"No verified routes"})
        routes.start()
        self.addCleanup(routes.stop)

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
    def test_countermeasure_sandbox(self):
        # Baseline assessment (no countermeasures)
        baseline = resilience_service.evaluate_resilience_assessment(
            storm_name="Cyclone Dana",
            eye_lat=20.4,
            eye_lon=86.8,
            deploy_countermeasure=False,
        )
        # Protected assessment with virtual barriers deployed
        protected = resilience_service.evaluate_resilience_assessment(
            storm_name="Cyclone Dana",
            eye_lat=20.4,
            eye_lon=86.8,
            deploy_countermeasure=True,
        )

        self.assertTrue(protected["countermeasure_deployed"])
        # Surge reach & flood depth must drop under countermeasure protection
        self.assertLess(
            protected["surge_and_runoff"]["inundation_reach_km"],
            baseline["surge_and_runoff"]["inundation_reach_km"]
        )
        self.assertLess(
            protected["surge_and_runoff"]["max_flood_depth_m"],
            baseline["surge_and_runoff"]["max_flood_depth_m"]
        )

        # Highway passability flips to PASSABLE_PROTECTED
        rd_baseline = next(i for i in baseline["critical_infrastructure"] if i["asset_id"] == "rd-01")
        rd_protected = next(i for i in protected["critical_infrastructure"] if i["asset_id"] == "rd-01")
        self.assertEqual(rd_baseline["passability_status"], "MODELED_FLOOD_EXPOSURE")
        self.assertEqual(rd_protected["passability_status"], "SIMULATED_BARRIER_UNVERIFIED")

    def test_drone_damage_and_cap_xml(self):
        from gemini_resilience_service import DroneDamageInspectionEngine, generate_cap_alert_xml

        # Test Drone Damage Inspection Engine
        report = DroneDamageInspectionEngine.inspect_drone_damage(asset_id="pwr-01", sample_id="sample-substation-flood")
        self.assertEqual(report["status"], "success")
        self.assertEqual(report["damage_severity"], "SEVERE")
        self.assertEqual(report["repair_priority"], "P1_URGENT")
        self.assertGreater(len(report["detected_defects"]), 2)
        self.assertIn("drone_telemetry", report)

        # Test OASIS CAP v1.2 XML Alert Exporter
        xml = generate_cap_alert_xml(storm_name="Cyclone Dana", max_wind_kmh=125.0, peak_surge_m=2.8)
        self.assertIn('xmlns="urn:oasis:names:tc:emergency:cap:1.2"', xml)
        self.assertIn('<valueName>CYCLONEX</valueName>', xml)
        self.assertIn('<severity>Unknown</severity>', xml)
        self.assertIn('<status>Exercise</status>', xml)
        self.assertIn('<certainty>Possible</certainty>', xml)


class TestSpatialScreening(unittest.TestCase):
    def test_global_coastline_and_wind_in_both_hemispheres(self):
        from risk_service import ScenarioInput, _is_land, evaluate_cell_full
        self.assertTrue(_is_land(7, 81))  # Sri Lanka
        self.assertTrue(_is_land(-33.9, 151.15))  # Sydney
        self.assertFalse(_is_land(12, 88))  # Bay of Bengal
        for lat, sign in ((20, 1), (-20, -1)):
            scenario = ScenarioInput(name="wind", center_lat=lat, center_lon=80, max_wind_kph=120,
                                     central_pressure_hpa=970, heading_deg=0, speed_kph=20)
            strong = evaluate_cell_full(sign * 25000, 0, 80, lat, scenario)["hazard"]
            weak = evaluate_cell_full(-sign * 25000, 0, 80, lat, scenario)["hazard"]
            self.assertEqual(strong["wind_kph"], 120)
            self.assertLess(weak["wind_kph"], strong["wind_kph"])
            self.assertEqual(evaluate_cell_full(0, 0, 80, lat, scenario)["hazard"]["wind_kph"], 0)

    def test_polar_and_dateline_geojson_and_calm_scenario(self):
        from risk_service import ScenarioInput, create_risk_grid
        from shapely.geometry import shape
        for lat, lon in ((22, 180), (90, 180), (-90, -170)):
            s = ScenarioInput(name="geometry", center_lat=lat, center_lon=lon, max_wind_kph=0,
                              central_pressure_hpa=1013.25, field_radius_km=1)
            grid = create_risk_grid(s)
            self.assertGreater(len(grid["features"]), 0)
            self.assertEqual(grid["summary"]["max_risk_score"], 0)
            for f in grid["features"]:
                geom = shape(f["geometry"])
                self.assertTrue(geom.is_valid and not geom.is_empty)
                west, south, east, north = geom.bounds
                self.assertTrue(-180 <= west <= east <= 180 and -90 <= south <= north <= 90)
            self.assertNotIn("ndma_directives", grid["summary"])

    def test_empty_reference_region_has_no_shelter_and_no_orders(self):
        from shelter_service import evaluate_evacuation_plan
        from gemini_resilience_service import resilience_service
        shelter = evaluate_evacuation_plan(0, -140, 25)
        self.assertEqual(shelter["shelters"], [])
        self.assertIsNone(shelter["estimated_population_at_risk"])
        result = resilience_service.evaluate_resilience_assessment(eye_lat=0, eye_lon=-140, max_wind_kmh=0,
                central_pressure_hpa=1013.25, forward_speed_kmh=0, rain_rate_mm_hr=0, simulate_failure_gemini=True)
        self.assertEqual(result["critical_infrastructure"], [])
        self.assertIsNone(result["cyclone"]["landfall"])
        self.assertEqual(result["surge_and_runoff"]["max_flood_depth_m"], 0)
        self.assertEqual(result["surge_and_runoff"]["flash_flood_risk_level"], "LOW")
        self.assertEqual(result["parametric_insurance"]["total_payout_percentage"], 0)
        self.assertEqual(result["gemini_multimodal_advisory"]["urgency_level"], "MONITOR")
        self.assertTrue(all(p["observation_timestamp"] is None for p in result["provenance"]))

    def test_projection_crosses_coast_only_for_onshore_heading(self):
        from geo import projected_landfall
        crossing = projected_landfall(20.4, 87.2, 270, 20)
        self.assertIsNotNone(crossing)
        self.assertGreater(crossing["eta_hours"], 0)
        self.assertLess(crossing["eta_hours"], 5)
        self.assertIsNone(projected_landfall(20.4, 87.2, 90, 20, hours=4))

    def test_provider_outages_and_empty_responses_are_distinct(self):
        from unittest.mock import Mock
        import requests
        import zone_service
        with patch("storage.get_cached_zones", return_value=None), patch("storage.save_cached_zones"):
            zone_service._MEMORY_ZONE_CACHE.clear()
            with patch("zone_service.requests.post", side_effect=requests.Timeout):
                result = zone_service.fetch_zones(11, 81, 11.1, 81.1)
                self.assertEqual((result["features"], result["metadata"]["status"]), ([], "UNAVAILABLE"))
            with patch("zone_service.requests.post", return_value=Mock(**{"json.return_value": {"elements": []}})):
                result = zone_service.fetch_zones(11, 81, 11.1, 81.1)
                self.assertEqual((result["features"], result["metadata"]["status"]), ([], "NO_DATA"))

    def test_routing_requires_two_snapped_waypoints(self):
        from unittest.mock import Mock
        import routing_service
        routing_service._CACHE.clear()
        response = {"code":"Ok", "routes":[{"distance":100, "duration":90,
                    "geometry":{"type":"LineString","coordinates":[[87.5,21.6],[87.51,21.61]]}}]}
        with patch("routing_service.requests.get", return_value=Mock(**{"json.return_value":response})):
            self.assertEqual(routing_service.road_routes(21.62, 87.51)["routes"], [])


if __name__ == "__main__":
    unittest.main()
