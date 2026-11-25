"""AI/ML Cyclone Identification, Pattern Classification, Rapid Intensification & Prediction Service for CYCLONEX.

Implements multi-source satellite preprocessing, multi-channel tensor fusion,
4 PyTorch deep vision/temporal neural networks, eye localization, Dvorak analysis,
Grad-CAM explainability, and direct integration with the CYCLONEX risk engine.
"""

from __future__ import annotations

import base64
import io
import json
import math
import os
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field

# Try importing PyTorch & PIL gracefully
HAS_TORCH = False
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    torch = None
    nn = None
    F = None

HAS_PIL = False
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    Image = None

from satellite_pipeline import (
    MultiSourceSatelliteSynthesizer,
    SatelliteFeatureExtractor,
    IMAGE_SIZE,
)

# Load AI Config
CONFIG_PATH = Path(__file__).parent / "config" / "ai_config.json"
DEFAULT_CONFIG = {
    "image_size": 224,
    "sequence_length": 1,
    "forecast_hours": [6, 12, 24, 48],
    "pattern_classes": [
        "curved_band",
        "central_dense_overcast",
        "eye_formation",
        "mature_eye",
        "sheared_system",
        "weakening_system"
    ],
    "satellite_channels": ["infrared", "water_vapor", "microwave", "visible"]
}

def load_ai_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_CONFIG

AI_CONFIG = load_ai_config()
PATTERN_CLASSES = AI_CONFIG.get("pattern_classes", DEFAULT_CONFIG["pattern_classes"])


# Input & Output Schemas
class SatelliteImageInput(BaseModel):
    visible: Optional[str] = None
    infrared: Optional[str] = None
    water_vapor: Optional[str] = None
    microwave: Optional[str] = None


class CycloneAnalysisRequest(BaseModel):
    satellite_images: Optional[SatelliteImageInput] = None
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    wind_speed: float = Field(default=110.0, ge=0.0, le=350.0)
    pressure: float = Field(default=975.0, ge=800.0, le=1050.0)
    heading: Optional[float] = Field(default=315.0, ge=0.0, le=360.0)
    speed: Optional[float] = Field(default=22.0, ge=0.0, le=120.0)
    sst: Optional[float] = Field(default=29.2, ge=20.0, le=36.0)
    shear: Optional[float] = Field(default=10.5, ge=0.0, le=60.0)
    timestamp: Optional[str] = None


class SatelliteDataPreprocessor:
    """Preprocessing pipeline for multi-source satellite imagery."""

    def __init__(self, image_size: int = IMAGE_SIZE):
        self.image_size = image_size

    def decode_and_resize(self, img_data: Optional[str]) -> Optional[List[List[float]]]:
        """Decode base64/URL string to normalized 2D grayscale float grid [0.0, 1.0]."""
        if not img_data or not HAS_PIL:
            return None
        try:
            if img_data.startswith("data:image"):
                img_data = img_data.split(",")[1]
            raw_bytes = base64.b64decode(img_data, validate=True)
            if len(raw_bytes) > 10 * 1024 * 1024:
                return None
            img = Image.open(io.BytesIO(raw_bytes)).convert("L")
            img = img.resize((self.image_size, self.image_size))
            pixels = np.asarray(img).reshape(-1).tolist()
            grid = [
                [pixels[r * self.image_size + c] / 255.0 for c in range(self.image_size)]
                for r in range(self.image_size)
            ]
            return grid
        except Exception:
            return None


# =========================================================
# PYTORCH NEURAL NETWORK DEFINITIONS (MATCHING TRAINED WEIGHTS)
# =========================================================

if HAS_TORCH:
    from cyclone_networks import (
        PyTorchDetectionAndLocator, PyTorchPatternClassifier,
        PyTorchRapidIntensificationModel, PyTorchIntensityRegressor,
    )

else:
    PyTorchDetectionAndLocator = None
    PyTorchPatternClassifier = None
    PyTorchRapidIntensificationModel = None
    PyTorchIntensityRegressor = None


class AICycloneService:
    """Master AI Service handling multi-model PyTorch inference, Dvorak analysis, and Grad-CAM explainability."""

    def __init__(self):
        self.preprocessor = SatelliteDataPreprocessor()
        self.models_dir = Path(__file__).parent / "models"
        self.models_dir.mkdir(exist_ok=True)

        self.detection_model_path = self.models_dir / "cyclone_detection_model.pt"
        self.pattern_model_path = self.models_dir / "cyclone_pattern_model.pt"
        self.ri_model_path = self.models_dir / "cyclone_ri_model.pt"
        self.intensity_model_path = self.models_dir / "cyclone_intensity_model.pt"

        self.detection_model = None
        self.pattern_model = None
        self.ri_model = None
        self.intensity_model = None

        self._load_models()

    def _load_models(self):
        """Load trained PyTorch checkpoints if present on disk."""
        if not HAS_TORCH:
            return

        if self.detection_model_path.exists():
            try:
                model = PyTorchDetectionAndLocator(in_channels=4)
                model.load_state_dict(torch.load(self.detection_model_path, map_location="cpu", weights_only=True))
                model.eval()
                self.detection_model = model
                print(f"[AI SERVICE] Loaded Detection & Eye Locator model ({self.detection_model_path.name})", flush=True)
            except Exception as e:
                print(f"[AI SERVICE WARN] Failed to load detection model: {e}", flush=True)

        if self.pattern_model_path.exists():
            try:
                model = PyTorchPatternClassifier(in_channels=4, num_classes=len(PATTERN_CLASSES))
                model.load_state_dict(torch.load(self.pattern_model_path, map_location="cpu", weights_only=True))
                model.eval()
                self.pattern_model = model
                print(f"[AI SERVICE] Loaded Dvorak Pattern Classifier ({self.pattern_model_path.name})", flush=True)
            except Exception as e:
                print(f"[AI SERVICE WARN] Failed to load pattern model: {e}", flush=True)

        if self.ri_model_path.exists():
            try:
                model = PyTorchRapidIntensificationModel(in_channels=4)
                model.load_state_dict(torch.load(self.ri_model_path, map_location="cpu", weights_only=True))
                model.eval()
                self.ri_model = model
                print(f"[AI SERVICE] Loaded Rapid Intensification (RI) model ({self.ri_model_path.name})", flush=True)
            except Exception as e:
                print(f"[AI SERVICE WARN] Failed to load RI model: {e}", flush=True)

        if self.intensity_model_path.exists():
            try:
                model = PyTorchIntensityRegressor(in_channels=4)
                model.load_state_dict(torch.load(self.intensity_model_path, map_location="cpu", weights_only=True))
                model.eval()
                self.intensity_model = model
                print(f"[AI SERVICE] Loaded Multi-Horizon Intensity Regressor ({self.intensity_model_path.name})", flush=True)
            except Exception as e:
                print(f"[AI SERVICE WARN] Failed to load intensity model: {e}", flush=True)

    def get_models_status(self) -> Dict[str, Any]:
        """Report live loading status and metadata of all 4 PyTorch AI models."""
        return {
            "torch_available": HAS_TORCH,
            "validation": "EXPERIMENTAL_SYNTHETIC_TRAINING_ONLY",
            "missing_runtime_notice": None if HAS_TORCH else "Optional PyTorch runtime is not installed; analysis uses explicitly labelled heuristics.",
            "device": "cpu",
            "models": {
                "detection_and_locator": {
                    "loaded": self.detection_model is not None,
                    "file": self.detection_model_path.name,
                    "classes": ["NO_CYCLONE", "TROPICAL_CYCLONE"],
                    "locator": "2D Center (dx, dy) Offset Regressor",
                },
                "pattern_classifier": {
                    "loaded": self.pattern_model is not None,
                    "file": self.pattern_model_path.name,
                    "classes": PATTERN_CLASSES,
                    "architecture": "4-Channel Deep CNN with BatchNorm & Adaptive Pooling",
                },
                "rapid_intensification": {
                    "loaded": self.ri_model is not None,
                    "file": self.ri_model_path.name,
                    "threshold": ">= 30 knots (55 km/h) in 24 hours",
                    "features": ["Eyewall Convection", "SST Anomaly", "Vertical Wind Shear"],
                },
                "intensity_and_track": {
                    "loaded": self.intensity_model is not None,
                    "file": self.intensity_model_path.name,
                    "horizons": ["+6h", "+12h", "+24h", "+48h"],
                    "outputs": ["wind_kph", "pressure_hpa", "delta_lat", "delta_lon"],
                },
            },
        }

    def generate_grad_cam(self, tensor: torch.Tensor, target_class_idx: int) -> List[List[float]]:
        """Generate Grad-CAM activation heatmap for pattern explainability."""
        if not HAS_TORCH or self.pattern_model is None:
            return []

        try:
            # Keep activations and gradients local to this request.
            with torch.enable_grad():
                maps = self.pattern_model.feature_maps(tensor).detach().requires_grad_(True)
                logits = self.pattern_model.classify_maps(maps)
                grads, = torch.autograd.grad(logits[0, target_class_idx], maps)
            acts = maps.detach()
            weights = torch.mean(grads, dim=(2, 3), keepdim=True)
            cam = torch.sum(weights * acts, dim=1, keepdim=True)
            cam = F.relu(cam)
            cam = F.interpolate(cam, size=(224, 224), mode="bilinear", align_corners=False)
            cam_np = cam[0, 0].detach().cpu().numpy()
            
            c_min, c_max = float(cam_np.min()), float(cam_np.max())
            norm = (cam_np - c_min) / max(1e-6, c_max - c_min)
            # Sample down to 28x28 for lightweight JSON transfer
            step = 8
            downsampled = [[round(float(norm[r, c]), 3) for c in range(0, 224, step)] for r in range(0, 224, step)]
            return downsampled
        except Exception as e:
            print(f"[GRAD-CAM WARN] Heatmap unavailable: {e}", flush=True)
            return []

    def analyze_cyclone(self, req: CycloneAnalysisRequest) -> Dict[str, Any]:
        """Perform end-to-end AI Cyclone Identification, Classification, RI, and Multi-Horizon Forecast."""
        lat = req.latitude
        lon = req.longitude
        wind = req.wind_speed
        pressure = req.pressure
        heading = req.heading if req.heading is not None else 315.0
        speed = req.speed if req.speed is not None else 22.0
        sst = req.sst if req.sst is not None else 29.2
        shear = req.shear if req.shear is not None else 10.5

        # 1. Multi-Source Satellite Scene Generation & Calibration
        scene = MultiSourceSatelliteSynthesizer.generate_calibrated_scene(
            wind_kph=wind,
            pressure_hpa=pressure,
            heading_deg=heading,
            shear_magnitude_kt=shear,
            size=IMAGE_SIZE,
        )
        tensor_np = scene["normalized_tensor_4ch"]
        supplied = req.satellite_images.model_dump(exclude_none=True) if req.satellite_images else {}
        channel_order = ["infrared", "water_vapor", "microwave", "visible"]
        for channel, encoded in supplied.items():
            decoded = self.preprocessor.decode_and_resize(encoded)
            if decoded is None:
                raise ValueError(f"Invalid {channel} image: supply a base64-encoded image (maximum 10 MB).")
            tensor_np[channel_order.index(channel)] = np.asarray(decoded, dtype=np.float32)
        image_source = "USER_SUPPLIED" if len(supplied) == 4 else "MIXED_USER_AND_SYNTHETIC" if supplied else "SYNTHETIC_SCENARIO"
        tensor = torch.tensor(tensor_np, dtype=torch.float32).unsqueeze(0) if HAS_TORCH else None

        active_channels = ["infrared_10.8um", "water_vapor_6.7um", "microwave_89ghz", "visible_0.65um"]

        # 2. Identification (Detection) & Eye Localization
        cyclone_detected = wind >= 45.0 or pressure <= 1000.0
        det_conf = None
        center_lat = lat
        center_lon = lon

        if HAS_TORCH and self.detection_model and tensor is not None:
            with torch.no_grad():
                pres_logit, _ = self.detection_model(tensor)
                p_val = float(torch.sigmoid(pres_logit)[0, 0])
                cyclone_detected = p_val >= 0.50
                det_conf = round(p_val if cyclone_detected else 1.0 - p_val, 4)
                # Image uploads lack georeferencing; retain the supplied geographic centre.

        # 3. Dvorak Pattern Classification
        selected_pattern = "mature_eye" if wind >= 135 else "eye_formation" if wind >= 95 else "central_dense_overcast" if wind >= 65 else "curved_band"
        pat_conf = None
        probabilities = {}
        target_class_idx = PATTERN_CLASSES.index(selected_pattern) if selected_pattern in PATTERN_CLASSES else 0

        if HAS_TORCH and self.pattern_model and tensor is not None:
            with torch.no_grad():
                logits = self.pattern_model(tensor)
                probs = F.softmax(logits, dim=1)[0].tolist()
                target_class_idx = probs.index(max(probs))
                selected_pattern = PATTERN_CLASSES[target_class_idx]
                pat_conf = round(max(probs), 4)
                probabilities = {cls: round(p, 4) for cls, p in zip(PATTERN_CLASSES, probs)}
        # Quantitative Dvorak Feature Extraction from calibrated IR Brightness Temperature
        # Display pixels have no physical radiometric calibration. Never derive a
        # measured brightness temperature or Dvorak CI from an uploaded PNG/JPEG.
        dvorak_metrics = SatelliteFeatureExtractor.extract_dvorak_features(scene["ir_tb_k"]) if not supplied else {}

        # 4. Rapid Intensification (RI) Prediction
        is_ri = False
        ri_prob = None
        if HAS_TORCH and self.ri_model and tensor is not None:
            with torch.no_grad():
                ocean_vec = torch.tensor([[sst, shear, sst - 26.5, wind / 200.0]], dtype=torch.float32)
                ri_logit = self.ri_model(tensor, ocean_vec)
                ri_prob = round(float(torch.sigmoid(ri_logit)[0, 0]), 4)
                is_ri = ri_prob >= 0.50
        else:
            # Physics-informed fallback
            if sst >= 29.5 and shear <= 12.0 and wind >= 80.0:
                is_ri = True

        ri_warning_level = "ELEVATED SCREENING SIGNAL" if is_ri else "LOW SCREENING SIGNAL"

        # 5. Multi-Horizon Intensity & Track Forecasting (+6h, +12h, +24h, +48h)
        # Intensity persistence when a forecast model is unavailable.
        dw6 = dp6 = dw12 = dp12 = dw24 = dp24 = dw48 = dp48 = 0.0

        from geo import destination
        offsets = []
        for hours in (6, 12, 24, 48):
            target_lat, target_lon = destination(lat, lon, heading, speed * hours)
            offsets.extend((target_lat - lat, (target_lon - lon + 180) % 360 - 180))
        d_lat_6h, d_lon_6h, d_lat_12h, d_lon_12h, d_lat_24h, d_lon_24h, d_lat_48h, d_lon_48h = offsets

        if HAS_TORCH and self.intensity_model and tensor is not None:
            with torch.no_grad():
                telemetry = torch.tensor([[lat, lon, wind, pressure, heading, speed, sst, shear]], dtype=torch.float32)
                p_int, p_trk = self.intensity_model(tensor, telemetry)
                int_outs = p_int[0].tolist()
                trk_outs = p_trk[0].tolist()
                dw6, dp6 = round(int_outs[0], 1), round(int_outs[1], 1)
                dw12, dp12 = round(int_outs[2], 1), round(int_outs[3], 1)
                dw24, dp24 = round(int_outs[4], 1), round(int_outs[5], 1)
                dw48, dp48 = round(int_outs[6], 1), round(int_outs[7], 1)
                d_lat_6h, d_lon_6h = round(trk_outs[0], 4), round(trk_outs[1], 4)
                d_lat_12h, d_lon_12h = round(trk_outs[2], 4), round(trk_outs[3], 4)
                d_lat_24h, d_lon_24h = round(trk_outs[4], 4), round(trk_outs[5], 4)
                d_lat_48h, d_lon_48h = round(trk_outs[6], 4), round(trk_outs[7], 4)

        w6 = round(min(400.0, max(0.0, wind + dw6)), 1)
        p6 = round(max(800.0, min(1050.0, pressure + dp6)), 1)
        w12 = round(min(400.0, max(0.0, wind + dw12)), 1)
        p12 = round(max(800.0, min(1050.0, pressure + dp12)), 1)
        w24 = round(min(400.0, max(0.0, wind + dw24)), 1)
        p24 = round(max(800.0, min(1050.0, pressure + dp24)), 1)
        w48 = round(min(400.0, max(0.0, wind + dw48)), 1)
        p48 = round(max(800.0, min(1050.0, pressure + dp48)), 1)

        track_forecast = [
            {"hours": 6, "latitude": round(center_lat + d_lat_6h, 4), "longitude": round(center_lon + d_lon_6h, 4), "wind_speed_kmh": w6, "pressure_hpa": p6, "uncertainty_km": None},
            {"hours": 12, "latitude": round(center_lat + d_lat_12h, 4), "longitude": round(center_lon + d_lon_12h, 4), "wind_speed_kmh": w12, "pressure_hpa": p12, "uncertainty_km": None},
            {"hours": 24, "latitude": round(center_lat + d_lat_24h, 4), "longitude": round(center_lon + d_lon_24h, 4), "wind_speed_kmh": w24, "pressure_hpa": p24, "uncertainty_km": None},
            {"hours": 48, "latitude": round(center_lat + d_lat_48h, 4), "longitude": round(center_lon + d_lon_48h, 4), "wind_speed_kmh": w48, "pressure_hpa": p48, "uncertainty_km": None},
        ]

        for point in track_forecast:
            point["latitude"] = max(-90.0, min(90.0, point["latitude"]))
            point["longitude"] = (point["longitude"] + 180.0) % 360.0 - 180.0

        # 6. Grad-CAM Explainability Map
        grad_cam_map = self.generate_grad_cam(tensor, target_class_idx) if tensor is not None else []

        model_flags = {
            "detection": self.detection_model is not None,
            "classification": self.pattern_model is not None,
            "rapid_intensification": self.ri_model is not None,
            "intensity": self.intensity_model is not None,
        }
        return {
            "status": "success",
            "provenance": {
                "imagery": image_source,
                "supplied_channels": list(supplied),
                "synthetic_channels": [c for c in channel_order if c not in supplied],
                "validation": "NOT_VALIDATED_ON_OBSERVED_SATELLITE_STORMS",
                "note": "Experimental checkpoints trained on synthetic scenes. Forecasts and confidence scores are uncalibrated screening estimates.",
            },
            "active_channels": active_channels,
            "identification": {
                "cyclone_detected": cyclone_detected,
                "confidence": det_conf,
                "center": {"latitude": center_lat, "longitude": center_lon},
                "center_source": "USER_SUPPLIED_COORDINATES",
                "method": "Experimental PyTorch CNN" if model_flags["detection"] else "Wind/pressure threshold heuristic",
            },
            "classification": {
                "pattern": selected_pattern,
                "confidence": pat_conf,
                "probabilities": probabilities,
                "dvorak": dvorak_metrics,
                "method": "Experimental 4-channel PyTorch CNN" if model_flags["classification"] else "Wind-based pattern heuristic",
            },
            "rapid_intensification": {
                "probability": ri_prob,
                "is_ri_expected": is_ri,
                "threshold_knots_24h": 30,
                "warning_level": ri_warning_level,
                "method": "Uncalibrated synthetic-model score" if model_flags["rapid_intensification"] else "Wind, SST and shear threshold heuristic",
            },
            "current_conditions": {
                "wind_speed_kmh": wind,
                "pressure_hpa": pressure,
                "sst_c": sst,
                "shear_kt": shear,
            },
            "prediction": {
                "6h": {"wind_speed_kmh": w6, "pressure_hpa": p6},
                "12h": {"wind_speed_kmh": w12, "pressure_hpa": p12},
                "24h": {"wind_speed_kmh": w24, "pressure_hpa": p24},
                "48h": {"wind_speed_kmh": w48, "pressure_hpa": p48},
            },
            "track_forecast": track_forecast,
            "explainability": {
                "method": "Grad-CAM (experimental model)" if grad_cam_map else "UNAVAILABLE",
                "target_class": selected_pattern,
                "attention_grid_28x28": grad_cam_map,
            },
            "risk_integration": {
                "grid_updated": False,
                "building_risk_updated": False,
                "storm_surge_updated": False,
            },
            "model_status": {
                **{key: "LOADED_EXPERIMENTAL" if loaded else "HEURISTIC_FALLBACK" for key, loaded in model_flags.items()},
            },
        }


# Global Singleton Service
ai_service = AICycloneService()
