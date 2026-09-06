import unittest
import math
from risk_service import ScenarioInput, create_risk_grid, RISK_BANDS, local_metric_transforms


class TestRiskGridSpacingAndEngine(unittest.TestCase):
    def setUp(self):
        self.scenario = ScenarioInput(
            name="Test Grid Spacing Scenario",
            center_lat=20.0,
            center_lon=85.0,
            max_wind_kph=180.0,
            central_pressure_hpa=940.0,
            heading_deg=315.0,
            speed_kph=25.0,
            field_radius_km=10.0,
        )
        self.grid_result = create_risk_grid(self.scenario)

    def test_geojson_feature_structure(self):
        features = self.grid_result["features"]
        self.assertGreater(len(features), 100)
        first_feature = features[0]
        self.assertEqual(first_feature["type"], "Feature")
        self.assertEqual(first_feature["geometry"]["type"], "Polygon")
        coords = first_feature["geometry"]["coordinates"][0]
        self.assertEqual(len(coords), 5)
        self.assertEqual(coords[0], coords[-1])  # Closed polygon

    def test_200m_grid_spacing_validation(self):
        """Validate that adjacent grid cell corners are approximately 200m apart in meters and degrees."""
        features = self.grid_result["features"]
        first_polygon = features[0]["geometry"]["coordinates"][0]
        sw = first_polygon[0]  # [lon, lat]
        se = first_polygon[1]  # [lon, lat]
        nw = first_polygon[3]  # [lon, lat]

        forward, _ = local_metric_transforms(self.scenario.center_lon, self.scenario.center_lat)
        sw_x, sw_y = forward(sw[0], sw[1])
        se_x, se_y = forward(se[0], se[1])
        nw_x, nw_y = forward(nw[0], nw[1])

        dx = math.hypot(se_x - sw_x, se_y - sw_y)
        dy = math.hypot(nw_x - sw_x, nw_y - sw_y)

        self.assertAlmostEqual(dx, 200.0, delta=1.0)
        self.assertAlmostEqual(dy, 200.0, delta=1.0)

        # Degree spacing validation at 20°N
        d_lat = abs(nw[1] - sw[1])
        d_lon = abs(se[0] - sw[0])

        self.assertAlmostEqual(d_lat, 0.0017986, delta=0.0002)
        self.assertAlmostEqual(d_lon, 0.001914, delta=0.0003)

    def test_damage_scores_and_classifications(self):
        features = self.grid_result["features"]
        valid_classes = {"NO_DAMAGE", "SAFE", "MODERATE_DAMAGE", "TOTAL_DESTRUCTION_RISK"}
        for f in features:
            props = f["properties"]
            score = props["damage_score"]
            self.assertGreaterEqual(score, 0.0)
            self.assertLessEqual(score, 1.0)
            self.assertIn(props["classification"], valid_classes)
            self.assertIn("full_cell_analysis", props)
            self.assertIn("wind_ms", props)
            self.assertIn("dynamic_pressure_pa", props)
            self.assertIn("effective_wind_loading_n_m2", props)


if __name__ == "__main__":
    unittest.main()
