"""Regression coverage for production data provenance and failure behavior."""
import base64
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import xml.etree.ElementTree as ET

import numpy as np
import requests
from PIL import Image
from fastapi.testclient import TestClient

import storage
import ai_cyclone_service as ai
import building_service
import news_service
import routing_service
import ocean_service
from gemini_resilience_service import DroneDamageInspectionEngine, generate_cap_alert_xml
from risk_service import ScenarioInput, create_risk_grid, _classify_land_array, _is_land
from main import app


def image64(value=100):
    buffer = io.BytesIO()
    Image.new("L", (16, 16), value).save(buffer, "PNG")
    return base64.b64encode(buffer.getvalue()).decode()


class FunctionalityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = patch.object(storage, "DB_PATH", Path(self.temp.name) / "test.db")
        self.db.start()
        storage.init_db()
        self.client = TestClient(app)
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.db.stop)
        self.ai = ai.AICycloneService()
        self.ai.detection_model = self.ai.pattern_model = self.ai.ri_model = self.ai.intensity_model = None

    def test_zero_motion_and_shear_preserved(self):
        result = self.ai.analyze_cyclone(ai.CycloneAnalysisRequest(latitude=20, longitude=86, heading=0, speed=0, shear=0))
        self.assertEqual(result["current_conditions"]["shear_kt"], 0)
        for point in result["track_forecast"]:
            self.assertEqual((point["latitude"], point["longitude"]), (20, 86))

    def test_missing_models_never_claim_ready_or_grid_update(self):
        result = self.ai.analyze_cyclone(ai.CycloneAnalysisRequest(latitude=20, longitude=86))
        self.assertEqual(set(result["model_status"].values()), {"HEURISTIC_FALLBACK"})
        self.assertFalse(any(result["risk_integration"].values()))
        self.assertEqual(result["explainability"]["attention_grid_28x28"], [])

    def test_uploaded_pixels_reach_correct_model_channels(self):
        captured = []
        fake_torch = Mock()
        fake_torch.tensor.side_effect = lambda value, **kwargs: captured.append(np.array(value)) or Mock()
        supplied = ai.SatelliteImageInput(infrared=image64(255), visible=image64(0))
        with patch.object(ai, "HAS_TORCH", True), patch.object(ai, "torch", fake_torch), patch.object(self.ai, "generate_grad_cam", return_value=[]):
            result = self.ai.analyze_cyclone(ai.CycloneAnalysisRequest(latitude=20, longitude=86, satellite_images=supplied))
        self.assertTrue(np.all(captured[0][0] == 1))
        self.assertTrue(np.all(captured[0][3] == 0))
        self.assertEqual(result["provenance"]["imagery"], "MIXED_USER_AND_SYNTHETIC")
        self.assertEqual(result["classification"]["dvorak"], {})

    def test_invalid_satellite_image_rejected(self):
        result = self.client.post("/api/ai/analyze-cyclone", json={"latitude": 20, "longitude": 86, "satellite_images": {"infrared": "invalid"}})
        self.assertEqual(result.status_code, 422)

    def test_single_analysis_route_registration(self):
        routes = [r for r in app.routes if getattr(r, "path", "") == "/api/ai/analyze-cyclone"]
        self.assertEqual(len(routes), 1)

    def test_true_200m_detail_and_honest_overview(self):
        base = dict(name="Audit", center_lat=20, center_lon=86, max_wind_kph=150, central_pressure_hpa=960, include_ocean_node=False)
        detail = create_risk_grid(ScenarioInput(**base, field_radius_km=1, grid_resolution_m=200))
        overview = create_risk_grid(ScenarioInput(**base, field_radius_km=25))
        self.assertEqual(detail["metadata"]["grid_size_m"], 200)
        self.assertGreater(overview["metadata"]["grid_size_m"], 200)
        self.assertEqual(overview["metadata"]["resolution_mode"], "OVERVIEW")
        self.assertTrue(all(f["properties"]["grid_size_m"] == 200 for f in detail["features"]))

    def test_excessive_detail_returns_validation_error(self):
        result = self.client.post("/api/v2/scenarios", json={"name":"Too large", "center_lat":20,"center_lon":86,"max_wind_kph":150,"central_pressure_hpa":960,"include_ocean_node":False,"field_radius_km":100,"grid_resolution_m":200})
        self.assertEqual(result.status_code, 422)

    def test_cell_trace_matches_the_rendered_cell(self):
        result = self.client.post("/api/v2/scenarios", json={"name":"Cell trace", "center_lat":20,"center_lon":86,"max_wind_kph":150,"central_pressure_hpa":960,"include_ocean_node":False,"field_radius_km":1}).json()
        feature = result["risk_grid"]["features"][0]
        trace = self.client.get(f"/api/v2/scenarios/{result['id']}/cells/{feature['id']}").json()
        self.assertEqual(trace["damage"]["damage_score"], feature["properties"]["damage_score"])
        self.assertEqual(trace["hazard"]["wind_kph"], feature["properties"]["wind_kph"])
        self.assertEqual(self.client.get(f"/api/v2/scenarios/{result['id']}/cells/cell-999-999").status_code, 404)

    def test_land_classifier_preserves_ocean_exclusions(self):
        lat, lon = np.array([18., 12., 21.62, 20.]), np.array([88., 70., 87.51, 60.])
        values = _classify_land_array(lat, lon, np.full(4, 100000), 25000)
        self.assertEqual([v != "OCEAN" for v in values], [_is_land(a,b) for a,b in zip(lat,lon)])

    def test_weather_failure_is_503_not_fake_live_weather(self):
        with patch("main.requests.get", side_effect=requests.Timeout):
            result = self.client.get("/api/v2/realtime-weather?lat=20&lon=86")
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("wind_speed_kph", result.json())

    def test_news_rss_leaf_nodes_and_source_publication_time(self):
        news_service.init_news_tables()
        response = Mock(status_code=200, headers={"Content-Type":"application/rss+xml"}, text="<rss><channel><item><title>Tropical cyclone warning</title><link>https://example.org/bulletin</link><description>Storm update</description><pubDate>Wed, 28 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>")
        with patch("news_service.requests.get", return_value=response):
            self.assertEqual(news_service.scrape_source("fixture", "Fixture", "https://example.org/feed", "rss"), 1)
            self.assertEqual(news_service.scrape_source("fixture", "Fixture", "https://example.org/feed", "rss"), 1)
        articles = news_service.get_news_articles()
        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0]["title"], "Tropical cyclone warning")
        self.assertTrue(articles[0]["published_at"].startswith("2026-10-28"))

    def test_news_no_match_never_fabricates_bulletin(self):
        news_service.init_news_tables()
        response = Mock(status_code=200, headers={}, text="<html>" + "Ordinary website content " * 30 + "</html>")
        with patch("news_service.requests.get", return_value=response):
            self.assertEqual(news_service.scrape_source("fixture", "Fixture", "https://example.org/", "html"), 0)
        self.assertEqual(news_service.get_news_articles(), [])

    def test_building_provider_failure_does_not_fabricate_geometry(self):
        building_service._MEMORY_BUILDING_CACHE.clear()
        with patch("building_service.requests.post", side_effect=requests.Timeout), patch("building_service._get_bundled_buildings", return_value=[]):
            result = building_service.fetch_buildings(10, 70, 10.01, 70.01)
        self.assertEqual(result["features"], [])
        self.assertEqual(result["metadata"]["status"], "UNAVAILABLE")

    def test_buildings_bundle_survives_provider_outage(self):
        building_service._MEMORY_BUILDING_CACHE.clear()
        with patch("building_service.requests.post", side_effect=requests.Timeout):
            result = building_service.fetch_buildings(21.5, 87.4, 21.75, 87.65)
        self.assertGreater(len(result["features"]), 0)
        self.assertEqual(result["metadata"]["status"], "CACHED")

    def test_route_provider_payload_is_used_without_safety_claim(self):
        routing_service._CACHE.clear()
        response = Mock()
        response.json.return_value = {"code":"Ok", "waypoints":[{"distance":1},{"distance":2}], "routes":[{"distance":12340,"duration":1800,"geometry":{"type":"LineString","coordinates":[[87.51,21.62],[87.52,21.63]]}}]}
        with patch("routing_service.requests.get", return_value=response):
            result = routing_service.road_routes(21.62, 87.51)
        self.assertEqual(result["status"], "AVAILABLE")
        self.assertEqual(result["routes"][0]["distance_km"], 12.34)
        self.assertEqual(result["routes"][0]["flood_risk_level"], "UNKNOWN")

    def test_invalid_drone_image_is_rejected(self):
        result = self.client.post("/api/resilience/inspect-drone-damage", json={"asset_id":"pwr-01","image_base64":"not-an-image"})
        self.assertEqual(result.status_code, 422)

    def test_valid_drone_image_without_provider_is_unavailable(self):
        with patch("gemini_resilience_service.GEMINI_API_KEY", ""):
            result = self.client.post("/api/resilience/inspect-drone-damage", json={"asset_id":"pwr-01","image_base64":image64()})
        self.assertEqual(result.status_code, 503)

    def test_explicit_drone_sample_is_labelled(self):
        report = DroneDamageInspectionEngine.inspect_drone_damage("pwr-01", sample_id="sample-substation-flood")
        self.assertEqual(report["engine"], "DEMONSTRATION_SAMPLE")
        self.assertIsNone(report["drone_telemetry"]["altitude_agl_m"])

    def test_cap_xml_is_escaped_and_exercise_only(self):
        root = ET.fromstring(generate_cap_alert_xml(storm_name="A&B <test>"))
        ns = {"c":"urn:oasis:names:tc:emergency:cap:1.2"}
        self.assertEqual(root.findtext("c:status", namespaces=ns), "Exercise")
        self.assertIn("A&B <test>", root.findtext("c:info/c:headline", namespaces=ns))

    def test_deleted_default_feed_stays_deleted(self):
        news_service.init_news_tables()
        news_service.delete_news_source("src_bbc_rss")
        self.assertNotIn("src_bbc_rss", [s["id"] for s in news_service.get_news_sources()])

    def test_current_hycom_adapter_parses_profile_csv(self):
        def provider(*args, **kwargs):
            depth = dict(kwargs["params"])["vertCoord"]
            response = Mock()
            response.text = f'time,latitude[unit="degrees_north"],longitude[unit="degrees_east"],vertCoord[unit="m"],water_temp[unit="degC"],salinity[unit="psu"]\n2026-10-30T18:00:00Z,18.5,88.2,{depth},{29-depth*.02},34.5\n'
            return response
        with patch("ocean_service.requests.get", side_effect=provider):
            result = ocean_service._fetch_ncss_profile(18.5, 88.2)
        self.assertEqual(result["source"], "LIVE")
        self.assertEqual(result["temperature_c"][700], 15)
        self.assertEqual(result["observation_time"], "2026-10-30T18:00:00Z")

    def test_ocean_fallback_has_depth_and_provenance(self):
        ocean_service._OCEAN_CACHE.clear()
        with patch("ocean_service.fetch_live_profile", return_value=None):
            result = ocean_service.get_ocean_node(18.5, 88.2, "BAY_OF_BENGAL")
        self.assertEqual(result["meta"]["source"], "ESTIMATED_CLIMATOLOGY")
        self.assertEqual(result["meta"]["profile_depth_m"], 700)
        self.assertIn(700, result["TB"])


if __name__ == "__main__":
    unittest.main()
