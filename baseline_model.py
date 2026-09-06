"""Baseline Heuristic Track Forecast Pipeline for CYCLONEX.

STATUS: HEURISTIC / NOT VALIDATED FROM REAL HISTORICAL TEST SPLIT.

This module implements a simplified cyclone track and intensity
extrapolation using advection drift physics. It is NOT a trained
machine-learning model and must NOT be presented as one.

All outputs carry explicit model_status = "HEURISTIC" provenance.

Genuine AI/ML training requires:
  - Real IBTrACS storm sequences (T-24h to T0h)
  - Storm-based train/test split (no storm leaks across splits)
  - Independent held-out test set evaluation
  - Reproduced geodesic track error, wind MAE, pressure MAE

Until that training occurs, all forecast outputs are
BASELINE HEURISTIC EXTRAPOLATIONS, not AI/ML predictions.
"""

from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any

from feature_extractor import extract_sample_features, extract_targets
from ml_schema import TrainingSample

# ---------------------------------------------------------------------------
# Model provenance constants — must appear in every prediction response
# ---------------------------------------------------------------------------
MODEL_STATUS = "HEURISTIC"
VALIDATION_STATUS = "NOT_VALIDATED_FROM_REAL_HISTORICAL_TEST_SPLIT"
UNCERTAINTY_STATUS = "UNCERTAINTY_NOT_CALIBRATED"

# Heuristic uncertainty radii (NOT statistically calibrated from real errors)
# These are approximate historical NWP-class baseline references only.
HEURISTIC_UNCERTAINTY_KM = {
    "6h": 40.0,    # Placeholder — real validation pending
    "12h": 80.0,   # Placeholder — real validation pending
    "24h": 150.0,  # Placeholder — real validation pending
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in km."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _build_provenance(is_trained: bool) -> dict[str, Any]:
    """Return standard provenance block to attach to every prediction."""
    return {
        "model_name": "BaselineHeuristicExtrapolator",
        "model_version": "v1.0.0-baseline",
        "model_status": MODEL_STATUS,
        "validation_status": VALIDATION_STATUS,
        "uncertainty_status": UNCERTAINTY_STATUS,
        "is_trained_ml_model": False,
        "is_trained_on_samples": is_trained,
        "warning": (
            "This forecast uses simplified advection drift, not a trained AI/ML model. "
            "Track errors are NOT validated against real held-out storms. "
            "Do not treat uncertainty radii as statistically calibrated confidence intervals."
        ),
    }


class BaselineCyclonePipeline:
    """Heuristic Cyclone Track & Intensity Extrapolator.

    STATUS: HEURISTIC — Not a trained AI/ML model.

    Uses simplified advection drift extrapolation from current
    cyclone position, heading, speed, and intensity. Intensity
    change uses an empirical SST-based modulation factor.

    This pipeline will be replaced by a genuine ML model
    (ConvLSTM or gradient-boosted sequence model) once
    real IBTrACS training data is ingested with storm-based splits.
    """

    def __init__(self) -> None:
        self.is_trained: bool = False
        self.trained_at: datetime | None = None
        self.training_sample_count: int = 0
        self.algorithm: str = "HeuristicAdvectionDrift"
        # Metrics are only meaningful after genuine held-out test evaluation
        self.metrics: dict[str, Any] = {
            "status": "NOT_VALIDATED",
            "note": (
                "No metrics computed. Metrics require real storm-separated "
                "train/test splits and geodesic track error evaluation."
            ),
        }

    def train(self, samples: list[TrainingSample]) -> dict[str, Any]:
        """Register training samples. Marks pipeline as sample-trained.

        NOTE: Even after calling train(), this pipeline uses heuristic
        advection rules for prediction. It is NOT a fitted statistical model.
        Genuine ML training with feature matrices and gradient boosting
        is not implemented in this version.
        """
        if not samples:
            raise ValueError("Cannot train baseline model with 0 training samples.")

        features_list = [extract_sample_features(s) for s in samples]
        targets_list = [extract_targets(s) for s in samples]

        # Separate train vs test splits
        test_indices = [i for i, s in enumerate(samples) if s.split == "test"]
        train_indices = [i for i, s in enumerate(samples) if s.split != "test"]
        if not train_indices:
            train_indices = list(range(len(samples)))

        self.training_sample_count = len(samples)
        self.is_trained = True
        self.trained_at = datetime.now(timezone.utc)

        # Evaluate heuristic prediction errors on held-out test set
        eval_indices = test_indices if test_indices else train_indices
        track_errors_24h: list[float] = []
        wind_maes: list[float] = []

        for idx in eval_indices:
            feat = features_list[idx]
            tgt = targets_list[idx]
            pred = self.predict(feat)

            pred_24h_lat = pred["forecast_24h"]["centre_lat"]
            pred_24h_lon = pred["forecast_24h"]["centre_lon"]
            tgt_24h_lat = tgt["target_lat"] + tgt["delta_lat_24h"]
            tgt_24h_lon = tgt["target_lon"] + tgt["delta_lon_24h"]

            err = haversine_km(pred_24h_lat, pred_24h_lon, tgt_24h_lat, tgt_24h_lon)
            track_errors_24h.append(err)

            wind_diff = abs(
                pred["forecast_24h"]["max_sustained_wind_kph"]
                - (tgt["target_wind_kph"] + tgt["delta_wind_24h"])
            )
            wind_maes.append(wind_diff)

        # Only report metrics if evaluated on genuine held-out TEST storms
        if test_indices:
            avg_track_24h = sum(track_errors_24h) / len(track_errors_24h)
            avg_wind_mae = sum(wind_maes) / len(wind_maes)
            self.metrics = {
                "status": "EVALUATED_ON_HEURISTIC_HOLDOUT",
                "note": (
                    "Errors computed on held-out test samples using heuristic drift model. "
                    "Not validated against independent real-world IMD/JTWC observations."
                ),
                "track_error_24h_km_mean": round(avg_track_24h, 2),
                "wind_mae_kph_mean": round(avg_wind_mae, 2),
                "n_test_samples": len(test_indices),
            }
        else:
            self.metrics = {
                "status": "NOT_VALIDATED",
                "note": "No held-out test samples available. All samples used for training.",
            }

        return {
            "status": "REGISTERED",
            "model_status": MODEL_STATUS,
            "validation_status": VALIDATION_STATUS,
            "samples_registered": self.training_sample_count,
            "algorithm": self.algorithm,
            "metrics": self.metrics,
            "warning": (
                "This is a heuristic advection drift model. "
                "Calling train() registers samples but does NOT fit a statistical model."
            ),
        }

    def predict(self, features: dict[str, float]) -> dict[str, Any]:
        """Heuristic track and intensity extrapolation.

        IMPORTANT: This is NOT a trained AI/ML prediction.
        It uses simplified advection drift (position) and
        empirical SST-based modulation (intensity).

        Returns:
            Forecast dict with explicit model_status = "HEURISTIC" provenance.
        """
        # Accept both canonical keys and legacy shorthand keys
        wind = features.get("max_sustained_wind_kph",
               features.get("wind", 50.0))
        pressure = features.get("central_pressure_hpa",
                   features.get("pressure", 1000.0))
        tb = features.get("tb_deg_c", 27.5)
        vf = features.get("vf_m", 45.0)
        lat = features.get("centre_lat",
              features.get("lat", 15.0))
        lon = features.get("centre_lon",
              features.get("lon", 85.0))
        heading_deg = features.get("heading_deg", 315.0)
        speed_kph = features.get("speed_kph", 25.0)

        # --- Identification (rule-based, not ML) ---
        if wind >= 63.0:
            presence = "TROPICAL_CYCLONE"
            presence_note = "RULE_BASED: wind >= 63 km/h"
        elif wind >= 30.0:
            presence = "TROPICAL_DISTURBANCE"
            presence_note = "RULE_BASED: wind >= 30 km/h"
        else:
            presence = "NO_CYCLONE"
            presence_note = "RULE_BASED: wind < 30 km/h"

        # --- Pattern classification (rule-based, not ML) ---
        if presence != "TROPICAL_CYCLONE":
            pattern = None
            pattern_note = "N/A: not a tropical cyclone"
        elif wind >= 120.0:
            pattern = "MATURE"
            pattern_note = "RULE_BASED: wind >= 120 km/h"
        elif wind >= 85.0:
            pattern = "INTENSIFYING"
            pattern_note = "RULE_BASED: wind >= 85 km/h"
        elif tb < 26.0:
            pattern = "WEAKENING"
            pattern_note = "RULE_BASED: SST proxy tb < 26°C"
        else:
            pattern = "FORMATION"
            pattern_note = "RULE_BASED: default"

        # --- Track extrapolation (advection drift, not ML) ---
        # heading_rad converts meteorological heading to math angle
        heading_rad = math.radians((90.0 - heading_deg) % 360.0)
        cos_lat = max(0.2, math.cos(math.radians(lat)))

        def project_pos(hours: float) -> tuple[float, float]:
            dist_km = speed_kph * hours
            d_lat = (dist_km * math.sin(heading_rad)) / 111.0
            d_lon = (dist_km * math.cos(heading_rad)) / (111.0 * cos_lat)
            return round(lat + d_lat, 4), round(lon + d_lon, 4)

        lat_6h, lon_6h = project_pos(6.0)
        lat_12h, lon_12h = project_pos(12.0)
        lat_24h, lon_24h = project_pos(24.0)

        # --- Intensity extrapolation (empirical SST modulation, not ML) ---
        # intensification_factor is a heuristic modifier from SST proxy
        intensification_factor = 1.0 + (tb - 26.0) * 0.05 + (vf / 100.0) * 0.1

        wind_6h = round(min(300.0, wind + 4.5 * intensification_factor), 1)
        pressure_6h = round(max(880.0, pressure - 2.8 * intensification_factor), 1)

        wind_12h = round(min(300.0, wind + 9.0 * intensification_factor), 1)
        pressure_12h = round(max(880.0, pressure - 6.5 * intensification_factor), 1)

        wind_24h = round(min(300.0, wind + 14.0 * intensification_factor), 1)
        pressure_24h = round(max(880.0, pressure - 11.5 * intensification_factor), 1)

        provenance = _build_provenance(self.is_trained)

        return {
            "model_provenance": provenance,
            "identification": {
                "presence": presence,
                "method": presence_note,
                "centre_lat": lat,
                "centre_lon": lon,
                "data_status": "RULE_BASED_NOT_ML",
            },
            "pattern_classification": {
                "lifecycle_pattern": pattern,
                "method": pattern_note,
                "data_status": "RULE_BASED_NOT_ML",
            },
            "forecast_6h": {
                "centre_lat": lat_6h,
                "centre_lon": lon_6h,
                "max_sustained_wind_kph": wind_6h,
                "central_pressure_hpa": pressure_6h,
                "track_uncertainty_km": HEURISTIC_UNCERTAINTY_KM["6h"],
                "wind_uncertainty_kph": 15.0,
                "uncertainty_status": UNCERTAINTY_STATUS,
                "method": "HEURISTIC_ADVECTION_DRIFT",
            },
            "forecast_12h": {
                "centre_lat": lat_12h,
                "centre_lon": lon_12h,
                "max_sustained_wind_kph": wind_12h,
                "central_pressure_hpa": pressure_12h,
                "track_uncertainty_km": HEURISTIC_UNCERTAINTY_KM["12h"],
                "wind_uncertainty_kph": 25.0,
                "uncertainty_status": UNCERTAINTY_STATUS,
                "method": "HEURISTIC_ADVECTION_DRIFT",
            },
            "forecast_24h": {
                "centre_lat": lat_24h,
                "centre_lon": lon_24h,
                "max_sustained_wind_kph": wind_24h,
                "central_pressure_hpa": pressure_24h,
                "track_uncertainty_km": HEURISTIC_UNCERTAINTY_KM["24h"],
                "wind_uncertainty_kph": 40.0,
                "uncertainty_status": UNCERTAINTY_STATUS,
                "method": "HEURISTIC_ADVECTION_DRIFT",
            },
            "ocean_context": {
                "tb_deg_c": tb,
                "vf_m": vf,
                "data_status": "OBSERVED_OR_CLIMATOLOGY",
            },
        }


# Global pipeline instance — model_status is HEURISTIC until genuine training
BASELINE_PIPELINE = BaselineCyclonePipeline()
