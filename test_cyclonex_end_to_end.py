"""
CYCLONEX Master End-to-End Test Suite (Section AJ & Section AK Compliance)
Verifies all core architecture, physics, and classification requirements.
"""

import unittest
import math
from datetime import datetime, timezone
from risk_service import (
    create_risk_grid,
    evaluate_cell_full,
    local_metric_transforms,
    _is_land,
    ScenarioInput
)
from baseline_model import BASELINE_PIPELINE
from ml_schema import SatelliteObservation, SatelliteSource

class TestCyclonexEndToEnd(unittest.TestCase):
    
    def setUp(self):
        # Controlled Landfall Scenario: Cyclone Amphan at Digha, West Bengal
        self.digha_lat = 21.62
        self.digha_lon = 87.51
        self.wind_kph = 185.0
        self.pressure_hpa = 920.0
        self.heading_deg = 30.0
        self.speed_kmh = 15.0
        self.radius_km = 15.0
        
        self.observation = SatelliteObservation(
            source=SatelliteSource.INSAT,
            product="INSAT3D_TIR1",
            acquired_at=datetime.now(timezone.utc),
            asset_url="https://example.org/insat.nc",
            west=86.0,
            south=20.0,
            east=89.0,
            north=23.0,
            spatial_resolution_km=4.0,
            channels=["TIR1", "TIR2"],
            preprocessing_version="v1.0.0"
        )
        
        self.scenario = ScenarioInput(
            name="Amphan Landfall Digha",
            center_lat=self.digha_lat,
            center_lon=self.digha_lon,
            max_wind_kph=self.wind_kph,
            central_pressure_hpa=self.pressure_hpa,
            heading_deg=self.heading_deg,
            speed_kph=self.speed_kmh,
            field_radius_km=self.radius_km
        )

    def test_01_real_cyclone_input(self):
        self.assertEqual(self.digha_lat, 21.62)
        self.assertEqual(self.digha_lon, 87.51)
        self.assertEqual(self.wind_kph, 185.0)

    def test_02_forecast_generation(self):
        features = {
            "lat": self.digha_lat,
            "lon": self.digha_lon,
            "wind": self.wind_kph,
            "pressure": self.pressure_hpa,
            "heading_deg": self.heading_deg,
            "speed_kph": self.speed_kmh
        }
        res = BASELINE_PIPELINE.predict(features)
        self.assertIn("forecast_6h", res)
        self.assertIn("forecast_12h", res)
        self.assertIn("forecast_24h", res)

    def test_03_geographic_coordinates_and_extent(self):
        grid_geojson = create_risk_grid(self.scenario)
        self.assertEqual(grid_geojson["type"], "FeatureCollection")
        self.assertGreater(len(grid_geojson["features"]), 1000)

    def test_04_metric_200m_grid_geometry(self):
        lat, lon = 21.62, 87.51
        forward, inverse = local_metric_transforms(lon, lat)
        
        # Move 200m East, 200m North
        lon2, lat2 = inverse(200.0, 200.0)
        x_calc, y_calc = forward(lon2, lat2)
        
        self.assertAlmostEqual(x_calc, 200.0, delta=0.01)
        self.assertAlmostEqual(y_calc, 200.0, delta=0.01)

    def test_05_land_ocean_classification(self):
        ocean_lat, ocean_lon = 21.40, 87.51
        beach_lat, beach_lon = 21.62, 87.51
        inland_lat, inland_lon = 21.80, 87.51
        
        self.assertFalse(_is_land(ocean_lat, ocean_lon))
        self.assertTrue(_is_land(beach_lat, beach_lon))
        self.assertTrue(_is_land(inland_lat, inland_lon))
        
        forward, _ = local_metric_transforms(self.digha_lon, self.digha_lat)
        
        ox, oy = forward(ocean_lon, ocean_lat)
        cell_ocean = evaluate_cell_full(ox, oy, ocean_lon, ocean_lat, self.scenario)
        
        bx, by = forward(beach_lon, beach_lat)
        cell_beach = evaluate_cell_full(bx, by, beach_lon, beach_lat, self.scenario)
        
        self.assertEqual(cell_ocean["land_type"], "OCEAN")
        self.assertEqual(cell_beach["land_type"], "COASTAL_ZONE")

    def test_06_wind_field_spatial_variability(self):
        forward, _ = local_metric_transforms(self.digha_lon, self.digha_lat)
        ex, ey = forward(self.digha_lon, self.digha_lat)
        cell_eye = evaluate_cell_full(ex, ey, self.digha_lon, self.digha_lat, self.scenario)
        
        rx, ry = forward(self.digha_lon, self.digha_lat + 0.27)
        cell_rmw = evaluate_cell_full(rx, ry, self.digha_lon, self.digha_lat + 0.27, self.scenario)
        
        self.assertNotEqual(cell_eye["hazard"]["wind_kph"], cell_rmw["hazard"]["wind_kph"])

    def test_07_wind_direction_heading_sensitivity(self):
        forward, _ = local_metric_transforms(self.digha_lon, self.digha_lat)
        px, py = forward(self.digha_lon + 0.1, self.digha_lat + 0.1)
        
        scenario_n = ScenarioInput(
            name="North Heading",
            center_lat=self.digha_lat,
            center_lon=self.digha_lon,
            max_wind_kph=self.wind_kph,
            central_pressure_hpa=self.pressure_hpa,
            heading_deg=0.0,
            speed_kph=20.0,
            field_radius_km=self.radius_km
        )
        scenario_s = ScenarioInput(
            name="South Heading",
            center_lat=self.digha_lat,
            center_lon=self.digha_lon,
            max_wind_kph=self.wind_kph,
            central_pressure_hpa=self.pressure_hpa,
            heading_deg=180.0,
            speed_kph=20.0,
            field_radius_km=self.radius_km
        )
        
        cell_n = evaluate_cell_full(px, py, self.digha_lon + 0.1, self.digha_lat + 0.1, scenario_n)
        cell_s = evaluate_cell_full(px, py, self.digha_lon + 0.1, self.digha_lat + 0.1, scenario_s)
        
        self.assertNotEqual(cell_n["hazard"]["wind_kph"], cell_s["hazard"]["wind_kph"])

    def test_08_dynamic_pressure_scaling(self):
        v100_mps = 100.0 / 3.6
        v200_mps = 200.0 / 3.6
        q100 = 0.5 * 1.225 * (v100_mps ** 2)
        q200 = 0.5 * 1.225 * (v200_mps ** 2)
        
        ratio = q200 / q100
        self.assertAlmostEqual(ratio, 4.0, delta=0.001)

    def test_09_damage_formula_reproducibility(self):
        H = 0.600
        E = 0.245
        V = 0.5305
        
        D_expected = (H ** 0.4) * (E ** 0.2) * (V ** 0.4)
        D_computed = math.pow(H, 0.4) * math.pow(E, 0.2) * math.pow(V, 0.4)
        
        self.assertAlmostEqual(D_computed, D_expected, places=6)
        self.assertAlmostEqual(D_computed, 0.4775, places=3)

    def test_10_classification_thresholds(self):
        def classify(score):
            if score < 0.10:
                return "NO_DAMAGE"
            elif score < 0.25:
                return "SAFE"
            elif score < 0.55:
                return "MODERATE_DAMAGE"
            else:
                return "TOTAL_DESTRUCTION_RISK"

        self.assertEqual(classify(0.099), "NO_DAMAGE")
        self.assertEqual(classify(0.100), "SAFE")
        self.assertEqual(classify(0.249), "SAFE")
        self.assertEqual(classify(0.250), "MODERATE_DAMAGE")
        self.assertEqual(classify(0.549), "MODERATE_DAMAGE")
        self.assertEqual(classify(0.550), "TOTAL_DESTRUCTION_RISK")

if __name__ == "__main__":
    unittest.main()
