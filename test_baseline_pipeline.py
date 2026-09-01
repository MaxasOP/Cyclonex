"""Unit tests for Baseline ML Pipeline, feature extraction, inference, and impact grid coupling."""

from datetime import datetime, timezone
import unittest

from baseline_model import BASELINE_PIPELINE
from feature_extractor import extract_sample_features, extract_targets
from hursat_service import create_hursat_observation, generate_storm_sequence_samples
from ibtracs_service import parse_ibtracs_csv
from main import (
    InferenceRequest,
    StormImpactRunInput,
    dataset_summary,
    generate_storm_impact_grid,
    get_storm_forecast,
    import_ibtracs_labels,
    ingest_hursat_observation,
    run_inference,
    train_baseline_model,
)
from ml_registry import (
    BEST_TRACK_LABELS,
    OBSERVATIONS,
    SAMPLES,
    STORM_SPLITS,
    register_best_track_labels,
    register_observation,
)
from ml_schema import IBTracsCsvImport, SatelliteSource


class TestBaselinePipeline(unittest.TestCase):
    def setUp(self):
        OBSERVATIONS.clear()
        SAMPLES.clear()
        BEST_TRACK_LABELS.clear()
        STORM_SPLITS.clear()
        BASELINE_PIPELINE.is_trained = False
        BASELINE_PIPELINE.training_sample_count = 0

    def _ingest_sample_data(self):
        csv_text = """SID,SEASON,NUMBER,BASIN,SUBBASIN,NAME,ISO_TIME,NATURE,LAT,LON,WMO_WIND,WMO_PRES
units,1848,,,,,,deg_N,deg_E,kts,mb
2020138N10086,2020,01,NI,BB,AMPHAN,2020-05-18 12:00:00,TS,15.5,87.5,120,920
"""
        import_req = IBTracsCsvImport(
            csv_text=csv_text,
            basin="NI",
            source_url="https://noaa.ibtracs.gov/ni_sample.csv",
        )
        labels = parse_ibtracs_csv(import_req)
        register_best_track_labels(labels)

        obs = create_hursat_observation(
            product="HURSAT_B1_IR",
            acquired_at=datetime(2020, 5, 18, 12, 0, tzinfo=timezone.utc),
            centre_lat=15.5,
            centre_lon=87.5,
            asset_url="https://noaa.hursat.gov/b1/2020/AMPHAN.nc",
        )
        register_observation(obs)
        generate_storm_sequence_samples("2020138N10086", split="train", sequence_hours=24)

    def test_feature_extraction(self):
        self._ingest_sample_data()
        sample = list(SAMPLES.values())[0]
        features = extract_sample_features(sample)
        targets = extract_targets(sample)

        self.assertEqual(features["centre_lat"], 15.5)
        self.assertEqual(features["centre_lon"], 87.5)
        self.assertIn("tb_deg_c", features)
        self.assertIn("vf_m", features)
        self.assertEqual(targets["presence"], "TROPICAL_CYCLONE")

    def test_baseline_training_and_inference(self):
        self._ingest_sample_data()
        train_res = train_baseline_model()
        self.assertEqual(train_res["status"], "SUCCESS")
        self.assertTrue(BASELINE_PIPELINE.is_trained)

        # Inference from explicit input
        inf_req = InferenceRequest(
            centre_lat=15.5,
            centre_lon=87.5,
            max_sustained_wind_kph=180.0,
            central_pressure_hpa=930.0,
        )
        inf_res = run_inference(inf_req)
        self.assertEqual(inf_res["identification"]["presence"], "TROPICAL_CYCLONE")
        self.assertIn("forecast_24h", inf_res)
        self.assertEqual(inf_res["model_provenance"]["is_trained"], True)

    def test_storm_forecast_and_impact_coupling(self):
        self._ingest_sample_data()
        train_baseline_model()

        forecast_res = get_storm_forecast("2020138N10086")
        self.assertEqual(forecast_res["storm_id"], "2020138N10086")
        self.assertIn("forecast", forecast_res)

        impact_input = StormImpactRunInput(forecast_horizon_hours=24)
        impact_res = generate_storm_impact_grid("2020138N10086", impact_input)
        self.assertIn("risk_grid", impact_res)
        self.assertEqual(impact_res["ml_provenance"]["source_storm_id"], "2020138N10086")
        self.assertEqual(impact_res["ml_provenance"]["forecast_horizon_hours"], 24)

    def test_dataset_summary_status(self):
        self._ingest_sample_data()
        summary_before = dataset_summary()
        self.assertEqual(summary_before["model_status"], "READY_FOR_BASELINE")

        train_baseline_model()
        summary_after = dataset_summary()
        self.assertEqual(summary_after["model_status"], "TRAINED_BASELINE")
        self.assertIsNotNone(summary_after["baseline_model"]["metrics"])


if __name__ == "__main__":
    unittest.main()
