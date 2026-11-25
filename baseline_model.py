"""Machine Learning Track, Intensity & Pattern Prediction Pipeline for CYCLONEX.

Implements an ensemble of Scikit-Learn Gradient-Boosted & Random Forest regressors
and classifiers trained on historical North Indian Ocean cyclone sequences with
strict storm-separated train/test splits.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import f1_score
from sklearn.multioutput import MultiOutputRegressor
from sklearn.preprocessing import StandardScaler

from feature_extractor import extract_sample_features, extract_targets, in_forecast_domain
from geo import destination, distance_km
from ml_schema import BestTrackLabel, CyclonePresence, TrainingSample

MODEL_STATUS = "TRAINED_AI_ML"
VALIDATION_STATUS = "VALIDATED_ON_STORM_SEPARATED_TEST_SPLIT"
UNCERTAINTY_STATUS = "HELD_OUT_MEAN_ERROR_NOT_A_CONFIDENCE_INTERVAL"
HEURISTIC_UNCERTAINTY_KM = {6: 9.6, 12: 19.2, 24: 38.5}

class CycloneMLPipeline:
    """Production ML Pipeline for Cyclone Tracking & Intensity Forecasting."""

    def __init__(self) -> None:
        self.is_trained: bool = False
        self.trained_at: datetime | None = None
        self.training_sample_count: int = 0
        self.algorithm: str = "GradientBoostedMultiOutputEnsemble"
        self.scaler = StandardScaler()
        self.has_pattern_labels = False
        self.has_presence_labels = False

        # Multi-output regressors for (d_lat, d_lon) track displacements
        self.track_regressor_6h = MultiOutputRegressor(
            GradientBoostingRegressor(n_estimators=50, learning_rate=0.08, max_depth=3, subsample=0.85, random_state=42)
        )
        self.track_regressor_12h = MultiOutputRegressor(
            GradientBoostingRegressor(n_estimators=50, learning_rate=0.08, max_depth=3, subsample=0.85, random_state=42)
        )
        self.track_regressor_24h = MultiOutputRegressor(
            GradientBoostingRegressor(n_estimators=60, learning_rate=0.08, max_depth=3, subsample=0.85, random_state=42)
        )

        # Regressors for (d_wind, d_pressure) intensity changes
        self.intensity_regressor_6h = MultiOutputRegressor(
            GradientBoostingRegressor(n_estimators=50, learning_rate=0.08, max_depth=3, subsample=0.85, random_state=42)
        )
        self.intensity_regressor_12h = MultiOutputRegressor(
            GradientBoostingRegressor(n_estimators=50, learning_rate=0.08, max_depth=3, subsample=0.85, random_state=42)
        )
        self.intensity_regressor_24h = MultiOutputRegressor(
            GradientBoostingRegressor(n_estimators=60, learning_rate=0.08, max_depth=3, subsample=0.85, random_state=42)
        )

        # Classifiers for presence & lifecycle pattern
        self.presence_classifier = RandomForestClassifier(n_estimators=40, max_depth=5, random_state=42)
        self.pattern_classifier = RandomForestClassifier(n_estimators=40, max_depth=5, random_state=42)

        self.metrics: dict[str, Any] = {
            "status": "NOT_TRAINED",
        }

    def _features_to_vector(self, feat: dict[str, float]) -> list[float]:
        lat = float(feat.get("centre_lat", 15.0))
        lon = float(feat.get("centre_lon", 85.0))
        wind = float(feat.get("max_sustained_wind_kph", 100.0))
        pressure = float(feat.get("central_pressure_hpa", 960.0))
        heading = float(feat.get("heading_deg", 315.0) % 360.0)
        speed = float(feat.get("speed_kph", 25.0))
        tb = float(feat.get("tb_deg_c", 0.0))
        vf = float(feat.get("vf_m", 0.0))

        heading_rad = math.radians(heading)
        u_trans = speed * math.sin(heading_rad)
        v_trans = speed * math.cos(heading_rad)

        from risk_service import _is_land
        is_land_flag = 1.0 if _is_land(lat, lon) else 0.0

        p_def = max(0.0, 1013.25 - pressure)
        grad_w = math.sqrt(p_def) * 14.5
        coriolis = 2.0 * 7.2921e-5 * math.sin(math.radians(max(1.0, abs(lat)))) * 1e4

        return [
            lat,
            lon,
            wind,
            pressure,
            u_trans,
            v_trans,
            is_land_flag,
            tb,
            vf,
            p_def,
            grad_w,
            coriolis,
        ]

    def train(self, samples: list[TrainingSample]) -> dict[str, Any]:
        """Train models on storm-separated training split and evaluate on test split."""
        if not samples:
            raise ValueError("Cannot train model with 0 training samples.")

        X_train_raw: list[list[float]] = []
        y_track_6h: list[list[float]] = []
        y_track_12h: list[list[float]] = []
        y_track_24h: list[list[float]] = []
        y_int_6h: list[list[float]] = []
        y_int_12h: list[list[float]] = []
        y_int_24h: list[list[float]] = []
        y_presence: list[str] = []
        y_pattern: list[str] = []

        storm_splits: dict[str, str] = {}
        test_samples = []
        train_samples = []
        for sample in samples:
            split = storm_splits.setdefault(sample.storm_id, sample.split)
            if split != sample.split:
                raise ValueError(f"Storm {sample.storm_id} occurs in multiple splits.")
            if split == "validation" or not in_forecast_domain(sample.label.centre_lat, sample.label.centre_lon):
                continue
            targets = extract_targets(sample)
            if targets is not None:
                (train_samples if split == "train" else test_samples).append((sample, targets))
        if not train_samples:
            raise ValueError("Training needs at least one train-split sample with observed track, wind and pressure at +6, +12 and +24 hours.")

        for s, tgt in train_samples:
            feat = extract_sample_features(s)
            vec = self._features_to_vector(feat)
            X_train_raw.append(vec)

            # Targets
            y_track_6h.append([tgt["delta_lat_6h"], tgt["delta_lon_6h"]])
            y_track_12h.append([tgt["delta_lat_12h"], tgt["delta_lon_12h"]])
            y_track_24h.append([tgt["delta_lat_24h"], tgt["delta_lon_24h"]])
            y_int_6h.append([tgt["delta_wind_6h"], tgt["delta_pressure_6h"]])
            y_int_12h.append([tgt["delta_wind_12h"], tgt["delta_pressure_12h"]])
            y_int_24h.append([tgt["delta_wind_24h"], tgt["delta_pressure_24h"]])
            y_presence.append(tgt["presence"])
            y_pattern.append(tgt["lifecycle_pattern"])

        # Fit Scaler
        X_scaled = self.scaler.fit_transform(X_train_raw)

        # Fit models
        self.track_regressor_6h.fit(X_scaled, y_track_6h)
        self.track_regressor_12h.fit(X_scaled, y_track_12h)
        self.track_regressor_24h.fit(X_scaled, y_track_24h)

        self.intensity_regressor_6h.fit(X_scaled, y_int_6h)
        self.intensity_regressor_12h.fit(X_scaled, y_int_12h)
        self.intensity_regressor_24h.fit(X_scaled, y_int_24h)

        self.presence_classifier.fit(X_scaled, y_presence)
        labelled = [idx for idx, value in enumerate(y_pattern) if value is not None]
        self.has_pattern_labels = len({y_pattern[idx] for idx in labelled}) > 1
        if self.has_pattern_labels:
            self.pattern_classifier.fit(X_scaled[labelled], [y_pattern[idx] for idx in labelled])
        self.has_presence_labels = set(y_presence) == {p.value for p in CyclonePresence}

        self.is_trained = True
        self.trained_at = datetime.now(timezone.utc)
        self.training_sample_count = len(train_samples)

        # Evaluate on held-out test split
        eval_set = test_samples
        y_presence_true, y_presence_pred = [], []
        y_pattern_true, y_pattern_pred = [], []
        persistence_errors = []
        motion_errors = {6: [], 12: [], 24: []}
        wind_persistence_errors = []
        wind_errors = {6: [], 12: [], 24: []}
        pressure_persistence_errors = []
        track_errors_24h = []
        track_errors_12h = []
        track_errors_6h = []
        wind_maes = []
        pres_maes = []

        for s, tgt in eval_set:
            feat = extract_sample_features(s)
            pred = self.predict(feat)

            if self.has_presence_labels:
                y_presence_true.append(tgt["presence"])
                y_presence_pred.append(pred["identification"]["presence"])
            if self.has_pattern_labels and tgt["lifecycle_pattern"] is not None:
                y_pattern_true.append(tgt["lifecycle_pattern"])
                y_pattern_pred.append(pred["pattern_classification"]["lifecycle_pattern"] or "UNCLASSIFIED")
            persistence_errors.append(distance_km(tgt["target_lat"], tgt["target_lon"],
                tgt["target_lat"] + tgt["delta_lat_24h"], tgt["target_lon"] + tgt["delta_lon_24h"]))
            for hours in (6, 12, 24):
                motion_lat, motion_lon = destination(feat["centre_lat"], feat["centre_lon"], feat["heading_deg"], feat["speed_kph"] * hours)
                motion_errors[hours].append(distance_km(motion_lat, motion_lon,
                    tgt["target_lat"] + tgt[f"delta_lat_{hours}h"], tgt["target_lon"] + tgt[f"delta_lon_{hours}h"]))
                wind_persistence_errors.append(abs(tgt[f"delta_wind_{hours}h"]))
                pressure_persistence_errors.append(abs(tgt[f"delta_pressure_{hours}h"]))

            err6 = distance_km(
                pred["forecast_6h"]["centre_lat"],
                pred["forecast_6h"]["centre_lon"],
                tgt["target_lat"] + tgt["delta_lat_6h"],
                tgt["target_lon"] + tgt["delta_lon_6h"],
            )
            err12 = distance_km(
                pred["forecast_12h"]["centre_lat"],
                pred["forecast_12h"]["centre_lon"],
                tgt["target_lat"] + tgt["delta_lat_12h"],
                tgt["target_lon"] + tgt["delta_lon_12h"],
            )
            err24 = distance_km(
                pred["forecast_24h"]["centre_lat"],
                pred["forecast_24h"]["centre_lon"],
                tgt["target_lat"] + tgt["delta_lat_24h"],
                tgt["target_lon"] + tgt["delta_lon_24h"],
            )
            track_errors_6h.append(err6)
            track_errors_12h.append(err12)
            track_errors_24h.append(err24)

            w_mae_6 = abs(pred["forecast_6h"]["max_sustained_wind_kph"] - (tgt["target_wind_kph"] + tgt["delta_wind_6h"]))
            w_mae_12 = abs(pred["forecast_12h"]["max_sustained_wind_kph"] - (tgt["target_wind_kph"] + tgt["delta_wind_12h"]))
            w_mae_24 = abs(pred["forecast_24h"]["max_sustained_wind_kph"] - (tgt["target_wind_kph"] + tgt["delta_wind_24h"]))
            for hours, error in zip((6, 12, 24), (w_mae_6, w_mae_12, w_mae_24)):
                wind_errors[hours].append(error)
            wind_maes.append((w_mae_6 + w_mae_12 + w_mae_24) / 3.0)

            p_mae_6 = abs(pred["forecast_6h"]["central_pressure_hpa"] - (tgt["target_pressure_hpa"] + tgt["delta_pressure_6h"]))
            p_mae_12 = abs(pred["forecast_12h"]["central_pressure_hpa"] - (tgt["target_pressure_hpa"] + tgt["delta_pressure_12h"]))
            p_mae_24 = abs(pred["forecast_24h"]["central_pressure_hpa"] - (tgt["target_pressure_hpa"] + tgt["delta_pressure_24h"]))
            pres_maes.append((p_mae_6 + p_mae_12 + p_mae_24) / 3.0)

        def mean(values):
            return round(sum(values) / len(values), 2) if values else None

        self.metrics = {
            "status": VALIDATION_STATUS if eval_set else "NO_HELD_OUT_TARGETS",
            "track_error_6h_km_mean": mean(track_errors_6h),
            "track_error_12h_km_mean": mean(track_errors_12h),
            "track_error_24h_km_mean": mean(track_errors_24h),
            "wind_mae_kph_mean": mean(wind_maes),
            "wind_mae_kph_by_hour": {str(h): mean(values) for h, values in wind_errors.items()},
            "pressure_mae_hpa_mean": mean(pres_maes),
            "constant_motion_track_error_km_by_hour": {str(h): mean(values) for h, values in motion_errors.items()},
            "persistence_track_error_24h_km_mean": mean(persistence_errors),
            "persistence_wind_mae_kph_mean": mean(wind_persistence_errors),
            "persistence_pressure_mae_hpa_mean": mean(pressure_persistence_errors),
            "identification_f1": float(f1_score(y_presence_true, y_presence_pred, average="macro"))
                if len(set(y_presence_true)) == len(CyclonePresence) else None,
            "pattern_f1": float(f1_score(y_pattern_true, y_pattern_pred, average="macro"))
                if len(set(y_pattern_true)) > 1 else None,
            "classification_note": "Presence F1 requires held-out no-storm and storm categories. Lifecycle F1 requires independent lifecycle labels.",
            "n_train_samples": len(train_samples),
            "n_train_storms": len({s.storm_id for s, _ in train_samples}),
            "n_test_samples": len(eval_set),
            "n_test_storms": len({s.storm_id for s, _ in eval_set}),
            "test_storm_ids": sorted({s.storm_id for s, _ in eval_set}),
            "evaluated_at": self.trained_at.isoformat(),
        }

        return {
            "status": "TRAINED",
            "model_status": MODEL_STATUS,
            "validation_status": self.metrics["status"],
            "algorithm": self.algorithm,
            "samples_registered": len(samples),
            "samples_used_for_fit": self.training_sample_count,
            "metrics": self.metrics,
        }

    def predict(self, features: dict[str, float]) -> dict[str, Any]:
        """Run ML prediction with physical steering kinematics, beta drift & Kaplan-DeMaria inland decay."""
        lat = float(features.get("centre_lat", 15.0))
        lon = float(features.get("centre_lon", 85.0))
        wind = float(features.get("max_sustained_wind_kph", 100.0))
        pressure = float(features.get("central_pressure_hpa", 965.0))
        heading_deg = float(features.get("heading_deg", 315.0) % 360.0)
        speed_kph = float(features.get("speed_kph", 25.0))
        tb = features.get("tb_deg_c")
        vf = features.get("vf_m")
        in_domain = in_forecast_domain(lat, lon)
        use_fit = self.is_trained and in_domain

        from risk_service import _is_land

        def kinematic_drift(hours: float) -> tuple[float, float]:
            target_lat, target_lon = destination(lat, lon, heading_deg, speed_kph * hours)
            return target_lat - lat, (target_lon - lon + 180) % 360 - 180

        def beta_drift(hours: float) -> tuple[float, float]:
            if not in_domain:
                return 0.0, 0.0
            dlat = 0.018 * hours * math.cos(math.radians(lat))
            dlon = -0.014 * hours
            return dlat, dlon

        k6_lat, k6_lon = kinematic_drift(6.0)
        k12_lat, k12_lon = kinematic_drift(12.0)
        k24_lat, k24_lon = kinematic_drift(24.0)

        b6_lat, b6_lon = beta_drift(6.0)
        b12_lat, b12_lon = beta_drift(12.0)
        b24_lat, b24_lon = beta_drift(24.0)

        if use_fit:
            vec = self._features_to_vector(features)
            X = self.scaler.transform([vec])

            ml_t6 = self.track_regressor_6h.predict(X)[0]
            ml_t12 = self.track_regressor_12h.predict(X)[0]
            ml_t24 = self.track_regressor_24h.predict(X)[0]

            ml_i6 = self.intensity_regressor_6h.predict(X)[0]
            ml_i12 = self.intensity_regressor_12h.predict(X)[0]
            ml_i24 = self.intensity_regressor_24h.predict(X)[0]

            # Harmonize kinematics (70%) with empirical ML steering corrections (30%)
            d_lat_6 = 0.70 * (k6_lat + b6_lat) + 0.30 * ml_t6[0]
            d_lon_6 = 0.70 * (k6_lon + b6_lon) + 0.30 * ml_t6[1]
            d_lat_12 = 0.70 * (k12_lat + b12_lat) + 0.30 * ml_t12[0]
            d_lon_12 = 0.70 * (k12_lon + b12_lon) + 0.30 * ml_t12[1]
            d_lat_24 = 0.70 * (k24_lat + b24_lat) + 0.30 * ml_t24[0]
            d_lon_24 = 0.70 * (k24_lon + b24_lon) + 0.30 * ml_t24[1]
        else:
            d_lat_6, d_lon_6 = k6_lat + b6_lat, k6_lon + b6_lon
            d_lat_12, d_lon_12 = k12_lat + b12_lat, k12_lon + b12_lon
            d_lat_24, d_lon_24 = k24_lat + b24_lat, k24_lon + b24_lon

        def project(d_lat, d_lon):
            return round(max(-90.0, min(90.0, float(lat + d_lat))), 4), round((float(lon + d_lon) + 180) % 360 - 180, 4)

        lat_6, lon_6 = project(d_lat_6, d_lon_6)
        lat_12, lon_12 = project(d_lat_12, d_lon_12)
        lat_24, lon_24 = project(d_lat_24, d_lon_24)

        # Thermodynamic parameters
        sst_excess = max(-3.0, min(4.0, tb - 26.5)) if tb is not None and in_domain else 0.0
        vf_norm = max(-1.0, min(1.0, (vf - 45.0) / 25.0)) if vf is not None and in_domain else 0.0

        # Check land boundaries across time steps
        land_now = _is_land(lat, lon)
        land_6 = _is_land(lat_6, lon_6)
        land_12 = _is_land(lat_12, lon_12)
        land_24 = _is_land(lat_24, lon_24)

        def physics_intensity(hours: float, is_land_future: bool) -> tuple[float, float]:
            if not in_domain:
                return 0.0, 0.0
            if land_now:
                # Cyclone already inland: continuous exponential dissipation
                v_floor = 35.0
                decay = math.exp(-0.058 * hours)
                v_decayed = v_floor + (wind - v_floor) * decay
                dw = v_decayed - wind
                # Central pressure fills exponentially toward environmental 1010 hPa
                p_env = 1010.0
                dp = (p_env - pressure) * (1.0 - math.exp(-0.050 * hours))
                return dw, dp
            elif is_land_future and hours >= 18.0:
                # Approaching landfall: marine intensification prior to coast, then initial dissipation
                ocean_scale = min(1.5, hours / 16.0)
                dw_ocean = (3.2 * sst_excess + 1.8 * vf_norm) * ocean_scale
                v_peak = wind + dw_ocean
                decay_hours = max(0.0, hours - 16.0)
                v_decayed = 35.0 + (v_peak - 35.0) * math.exp(-0.058 * decay_hours)
                dw = v_decayed - wind
                dp = -(2.2 * sst_excess + 1.2 * vf_norm) * ocean_scale + 5.0 * (decay_hours / 6.0)
                return dw, dp
            else:
                scale = hours / 12.0
                dw = (3.2 * sst_excess + 1.8 * vf_norm) * scale
                dp = -(2.2 * sst_excess + 1.2 * vf_norm) * scale
                return dw, dp

        pi6_w, pi6_p = physics_intensity(6.0, land_6)
        pi12_w, pi12_p = physics_intensity(12.0, land_12)
        pi24_w, pi24_p = physics_intensity(24.0, land_24)

        if use_fit:
            d_w_6 = 0.35 * pi6_w + 0.65 * ml_i6[0]
            d_p_6 = 0.35 * pi6_p + 0.65 * ml_i6[1]
            d_w_12 = 0.35 * pi12_w + 0.65 * ml_i12[0]
            d_p_12 = 0.35 * pi12_p + 0.65 * ml_i12[1]
            d_w_24 = 0.35 * pi24_w + 0.65 * ml_i24[0]
            d_p_24 = 0.35 * pi24_p + 0.65 * ml_i24[1]

            algorithm_note = "Scikit-learn gradient boosting with kinematic and intensity heuristics"
            model_flag = MODEL_STATUS
            val_flag = self.metrics["status"]
        else:
            d_w_6, d_p_6 = pi6_w, pi6_p
            d_w_12, d_p_12 = pi12_w, pi12_p
            d_w_24, d_p_24 = pi24_w, pi24_p
            algorithm_note = "Kinematic and intensity heuristics"
            model_flag = "HEURISTIC"
            val_flag = "NOT_VALIDATED"

        # A catalogue of known storms cannot train a no-storm detector.
        pred_presence = "TROPICAL_CYCLONE" if wind >= 34 * 1.852 else ("TROPICAL_DISTURBANCE" if wind >= 17 * 1.852 else "NO_CYCLONE")
        presence_method = "Wind-threshold screening"
        prob_presence = None
        if use_fit and self.has_presence_labels:
            pred_presence = self.presence_classifier.predict(X)[0]
            prob_presence = round(float(max(self.presence_classifier.predict_proba(X)[0])), 3)
            presence_method = "Random forest (uncalibrated vote share)"
        pred_pattern = None
        prob_pattern = None
        if pred_presence == "TROPICAL_CYCLONE" and use_fit and self.has_pattern_labels:
            pred_pattern = self.pattern_classifier.predict(X)[0]
            prob_pattern = round(float(max(self.pattern_classifier.predict_proba(X)[0])), 3)

        wind_6 = round(float(min(400.0, max(0.0, wind + d_w_6))), 1)
        pres_6 = round(float(max(800.0, min(1050.0, pressure + d_p_6))), 1)

        wind_12 = round(float(min(400.0, max(0.0, wind + d_w_12))), 1)
        pres_12 = round(float(max(800.0, min(1050.0, pressure + d_p_12))), 1)

        wind_24 = round(float(min(400.0, max(0.0, wind + d_w_24))), 1)
        pres_24 = round(float(max(800.0, min(1050.0, pressure + d_p_24))), 1)

        empirical = use_fit and bool(self.metrics.get("n_test_samples"))
        uncertainty = UNCERTAINTY_STATUS if empirical else "NOT_MEASURED"
        def track_error(hours):
            return self.metrics[f"track_error_{hours}h_km_mean"] if empirical else None
        def wind_error(hours):
            return self.metrics["wind_mae_kph_by_hour"][str(hours)] if empirical else None

        return {
            "model_provenance": {
                "model_name": "CYCLONEX Multi-Target Gradient Boosted Ensemble",
                "model_version": "v2.1.0-gbdt",
                "model_status": model_flag,
                "validation_status": val_flag,
                "uncertainty_status": uncertainty,
                "is_trained_ml_model": use_fit,
                "is_trained_on_samples": use_fit,
                "algorithm": algorithm_note,
                "warning": (
                    "Best-track state model using observed positions and intensity, prior motion and estimated ocean climatology. Held-out mean errors describe this sample only."
                    if use_fit
                    else ("Experimental kinematic fallback." if in_domain else "Outside the North Indian training domain. Constant motion and intensity persistence.")
                ),
            },
            "identification": {
                "presence": pred_presence,
                "confidence": prob_presence,
                "method": presence_method,
                "centre_lat": lat,
                "centre_lon": lon,
                "max_sustained_wind_kph": wind,
                "central_pressure_hpa": pressure,
                "heading_deg": heading_deg,
                "speed_kph": speed_kph,
                "data_status": "ML_INFERRED" if use_fit and self.has_presence_labels else "HEURISTIC",
            },
            "pattern_classification": {
                "lifecycle_pattern": pred_pattern,
                "confidence": prob_pattern,
                "method": "Random forest (uncalibrated vote share)" if pred_pattern else "Lifecycle unavailable",
                "data_status": "ML_INFERRED" if pred_pattern else "UNAVAILABLE",
            },
            "forecast_6h": {
                "centre_lat": lat_6,
                "centre_lon": lon_6,
                "max_sustained_wind_kph": wind_6,
                "central_pressure_hpa": pres_6,
                "horizon_hours": 6,
                "track_uncertainty_km": track_error(6),
                "wind_uncertainty_kph": wind_error(6),
                "uncertainty_status": uncertainty,
                "method": algorithm_note,
            },
            "forecast_12h": {
                "centre_lat": lat_12,
                "centre_lon": lon_12,
                "max_sustained_wind_kph": wind_12,
                "central_pressure_hpa": pres_12,
                "horizon_hours": 12,
                "track_uncertainty_km": track_error(12),
                "wind_uncertainty_kph": wind_error(12),
                "uncertainty_status": uncertainty,
                "method": algorithm_note,
            },
            "forecast_24h": {
                "centre_lat": lat_24,
                "centre_lon": lon_24,
                "max_sustained_wind_kph": wind_24,
                "central_pressure_hpa": pres_24,
                "horizon_hours": 24,
                "track_uncertainty_km": track_error(24),
                "wind_uncertainty_kph": wind_error(24),
                "uncertainty_status": uncertainty,
                "method": algorithm_note,
            },
            "ocean_context": {
                "tb_deg_c": tb if in_domain and not land_now else None,
                "vf_m": vf if in_domain and not land_now else None,
                "data_status": ("OUTSIDE_DOMAIN" if not in_domain else "OVER_LAND" if land_now else
                                "ESTIMATED_CLIMATOLOGY" if tb is not None and vf is not None else "UNAVAILABLE"),
            },
        }


BASELINE_PIPELINE = CycloneMLPipeline()


def seed_historical_training_samples() -> None:
    """Seed the offline best-track baseline with an extract of NOAA IBTrACS v04r01."""
    import csv
    from pathlib import Path
    from ml_registry import register_best_track_labels, register_sample

    source_url = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NI.list.v04r01.csv"
    samples = []
    with (Path(__file__).parent / "training" / "ibtracs_ni_reference.csv").open(newline="") as source:
        for row in csv.DictReader(source):
            valid_at = datetime.fromisoformat(row["ISO_TIME"]).replace(tzinfo=timezone.utc)
            label = BestTrackLabel(
                storm_id=row["SID"], valid_at=valid_at,
                centre_lat=float(row["NEWDELHI_LAT"]), centre_lon=float(row["NEWDELHI_LON"]),
                max_sustained_wind_kph=float(row["NEWDELHI_WIND"]) * 1.852,
                central_pressure_hpa=float(row["NEWDELHI_PRES"]),
                presence=(CyclonePresence.TROPICAL_DISTURBANCE if row["NEWDELHI_GRADE"] in ("D", "DD")
                          else CyclonePresence.TROPICAL_CYCLONE),
                intensity_authority="IMD", source_url=source_url,
            )
            register_best_track_labels([label])
            sample = TrainingSample(
                sample_id=f"track_{label.storm_id}_{valid_at:%Y%m%dT%H%MZ}",
                storm_id=label.storm_id, target_time=valid_at, label=label,
                source_kind="BEST_TRACK_STATE", observation_ids=[], split=("train" if int(row["SID"][:4]) < 2020 else "validation" if int(row["SID"][:4]) < 2022 else "test"),
                sequence_hours=6, notes=f"IBTrACS v04r01, New Delhi best track, {row['NAME']}",
            )
            samples.append(register_sample(sample))
    BASELINE_PIPELINE.train(samples)


try:
    seed_historical_training_samples()
except Exception as exc:
    print(f"[CYCLONEX ML INIT WARNING] {exc}", flush=True)
