"""Unit tests for HURSAT observation ingestion and sequence sample builder."""

from datetime import datetime, timezone
import unittest

from hursat_service import create_hursat_observation, generate_storm_sequence_samples
from ibtracs_service import parse_ibtracs_csv
from ml_registry import (
    BEST_TRACK_LABELS,
    OBSERVATIONS,
    SAMPLES,
    STORM_SPLITS,
    get_split_summary,
    register_best_track_labels,
    register_observation,
)
from ml_schema import IBTracsCsvImport, SatelliteSource


class TestHursatIngestion(unittest.TestCase):
    def setUp(self):
        OBSERVATIONS.clear()
        SAMPLES.clear()
        BEST_TRACK_LABELS.clear()
        STORM_SPLITS.clear()

    def test_hursat_observation_creation(self):
        obs = create_hursat_observation(
            product="HURSAT_B1_IR",
            acquired_at=datetime(2020, 5, 18, 12, 0, tzinfo=timezone.utc),
            centre_lat=15.5,
            centre_lon=87.5,
            asset_url="https://noaa.hursat.gov/b1/2020/NI_AMPHAN.nc",
            box_size_deg=4.0,
            spatial_resolution_km=8.0,
        )
        self.assertEqual(obs.source, SatelliteSource.HURSAT_B1)
        self.assertEqual(obs.west, 85.5)
        self.assertEqual(obs.east, 89.5)
        self.assertEqual(obs.south, 13.5)
        self.assertEqual(obs.north, 17.5)

        obs_id, stored = register_observation(obs)
        self.assertIn(obs_id, OBSERVATIONS)
        self.assertEqual(stored.product, "HURSAT_B1_IR")

    def test_sequence_sample_generation_and_split_protection(self):
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
        self.assertEqual(len(BEST_TRACK_LABELS), 1)

        # Ingest a matching observation
        obs = create_hursat_observation(
            product="HURSAT_B1_IR",
            acquired_at=datetime(2020, 5, 18, 12, 0, tzinfo=timezone.utc),
            centre_lat=15.5,
            centre_lon=87.5,
            asset_url="https://noaa.hursat.gov/b1/2020/AMPHAN_1200Z.nc",
        )
        register_observation(obs)

        # Generate train split samples
        samples = generate_storm_sequence_samples("2020138N10086", split="train", sequence_hours=24)
        self.assertEqual(len(samples), 1)
        self.assertEqual(samples[0].storm_id, "2020138N10086")
        self.assertEqual(samples[0].split, "train")

        # Split protection: re-generating under a different split for the same storm must raise ValueError
        with self.assertRaises(ValueError):
            generate_storm_sequence_samples("2020138N10086", split="test", sequence_hours=24)

    def test_split_summary_calculation(self):
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
            asset_url="https://noaa.hursat.gov/b1/2020/AMPHAN_1200Z.nc",
        )
        register_observation(obs)

        generate_storm_sequence_samples("2020138N10086", split="train", sequence_hours=24)
        summary = get_split_summary()

        self.assertEqual(summary["train"]["samples"], 1)
        self.assertEqual(summary["train"]["storms"], 1)
        self.assertEqual(summary["validation"]["samples"], 0)


if __name__ == "__main__":
    unittest.main()
