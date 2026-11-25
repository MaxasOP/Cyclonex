"""Independent hindcast of the deployed baseline using a NOAA IBTrACS NI CSV.

Run from the project root with python -m training.evaluate_best_track PATH.
Fits the bundled model once, then uses only earlier fixes to set storm motion.
"""
import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import fmean

from baseline_model import BASELINE_PIPELINE
from geo import destination, distance_km
from main import InferenceRequest, run_inference
from ml_registry import STORM_SPLITS


def hindcast(path, start_year, end_year):
    if not BASELINE_PIPELINE.is_trained:
        raise RuntimeError("Baseline model did not fit successfully")
    tracks = defaultdict(dict)
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            year = row["SEASON"].strip()
            if (not year.isdigit() or not start_year <= int(year) <= end_year
                    or row["BASIN"].strip() != "NI" or row["SID"] in STORM_SPLITS
                    or row["TRACK_TYPE"].strip() != "main"):
                continue
            try:
                lat, lon, wind, pressure = (float(row[k]) for k in
                    ("NEWDELHI_LAT", "NEWDELHI_LON", "NEWDELHI_WIND", "NEWDELHI_PRES"))
            except ValueError:
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180 and 0 <= wind*1.852 <= 400 and 800 <= pressure <= 1050):
                continue
            tracks[row["SID"]][datetime.fromisoformat(row["ISO_TIME"])] = (lat, lon, wind * 1.852, pressure)

    errors = defaultdict(lambda: defaultdict(list))
    storm_ids = set()
    for storm_id, fixes in tracks.items():
        for issued, (lat, lon, wind, pressure) in fixes.items():
            prior = fixes.get(issued - timedelta(hours=6))
            if prior is None or issued + timedelta(hours=24) not in fixes:
                continue
            a, b, dl = math.radians(prior[0]), math.radians(lat), math.radians(lon - prior[1])
            heading = math.degrees(math.atan2(math.sin(dl) * math.cos(b),
                math.cos(a) * math.sin(b) - math.sin(a) * math.cos(b) * math.cos(dl))) % 360
            speed = distance_km(prior[0], prior[1], lat, lon) / 6
            if speed > 120:
                continue
            forecast = run_inference(InferenceRequest(centre_lat=lat, centre_lon=lon,
                max_sustained_wind_kph=wind, central_pressure_hpa=pressure, heading_deg=heading, speed_kph=speed))
            storm_ids.add(storm_id)
            for hours in (6, 12, 24):
                actual = fixes.get(issued + timedelta(hours=hours))
                if actual is None:
                    continue
                predicted = forecast[f"forecast_{hours}h"]
                ref_lat, ref_lon = destination(lat, lon, heading, speed * hours)
                metrics = errors[hours]
                metrics["track_km"].append(distance_km(predicted["centre_lat"], predicted["centre_lon"], *actual[:2]))
                metrics["constant_motion_track_km"].append(distance_km(ref_lat, ref_lon, *actual[:2]))
                metrics["wind_kph"].append(abs(predicted["max_sustained_wind_kph"] - actual[2]))
                metrics["unchanged_wind_kph"].append(abs(wind - actual[2]))
                metrics["pressure_hpa"].append(abs(predicted["central_pressure_hpa"] - actual[3]))
    if not storm_ids:
        raise ValueError("No eligible independent storm windows in this archive and year range")
    return {"years": [start_year, end_year], "storms": sorted(storm_ids),
            "by_lead_hours": {h: {"cases": len(values["track_km"]),
                **{name: round(fmean(v), 2) for name, v in values.items()}} for h, values in sorted(errors.items())}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--start-year", type=int, default=2024)
    parser.add_argument("--end-year", type=int, default=2025)
    args = parser.parse_args()
    print(json.dumps(hindcast(args.csv_path, args.start_year, args.end_year), indent=2))
