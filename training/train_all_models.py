"""Master Training Script for CYCLONEX Multi-Source Satellite AI/ML Models.

Trains and evaluates 4 dedicated neural network models:
1. cyclone_detection_model.pt: Satellite scene cyclone presence + center (eye) localization
2. cyclone_pattern_model.pt: 6-class Dvorak morphological pattern classifier
3. cyclone_ri_model.pt: Rapid Intensification (RI >= 30 kt / 24h) probability predictor
4. cyclone_intensity_model.pt: Multi-horizon intensity (wind/pressure) & track displacement regressor
"""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

ROOT_DIR = Path(__file__).parent.parent.resolve()
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from satellite_pipeline import MultiSourceSatelliteSynthesizer, IMAGE_SIZE

CONFIG_PATH = ROOT_DIR / "config" / "ai_config.json"
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    AI_CONFIG = json.load(f)

PATTERN_CLASSES = AI_CONFIG.get("pattern_classes", [
    "curved_band",
    "central_dense_overcast",
    "eye_formation",
    "mature_eye",
    "sheared_system",
    "weakening_system",
])

MODELS_DIR = ROOT_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)


# =========================================================
# NEURAL NETWORK ARCHITECTURES
# =========================================================

from cyclone_networks import (
    PyTorchDetectionAndLocator, PyTorchPatternClassifier,
    PyTorchRapidIntensificationModel, PyTorchIntensityRegressor,
)
from geo import destination


def build_training_dataset(num_samples: int = 360, seed: int = 42) -> list[dict]:
    """Synthesize representative North Indian Ocean storm samples across various lifecycle stages."""
    rng = np.random.default_rng(seed)
    samples = []
    
    # Representative storm archetypes: (name, base_wind, base_pres, pattern, is_ri)
    archetypes = [
        ("Curved Band Formation", 55.0, 996.0, "curved_band", False),
        ("Incipient CDO", 75.0, 990.0, "central_dense_overcast", False),
        ("Rapidly Intensifying Eyewall", 115.0, 978.0, "eye_formation", True),
        ("Super Cyclone Eyewall", 225.0, 915.0, "mature_eye", False),
        ("Extremely Severe Cyclone", 185.0, 938.0, "mature_eye", False),
        ("Sheared System", 65.0, 992.0, "sheared_system", False),
        ("Post-Landfall Weakening", 70.0, 988.0, "weakening_system", False),
        ("Weakening Inland Depression", 45.0, 1000.0, "weakening_system", False),
    ]

    for i in range(num_samples):
        arch = archetypes[i % len(archetypes)]
        # Add random variations
        wind = float(np.clip(arch[1] + rng.normal(0, 8.0), 30.0, 260.0))
        pressure = float(np.clip(arch[2] + rng.normal(0, 5.0), 900.0, 1006.0))
        heading = float((315.0 + rng.normal(0, 25.0)) % 360.0)
        speed = float(np.clip(18.0 + rng.normal(0, 4.0), 8.0, 38.0))
        lat = float(np.clip(14.0 + rng.normal(0, 4.0), 5.0, 24.0))
        lon = float(np.clip(85.0 + rng.normal(0, 6.0), 65.0, 95.0))
        sst = float(np.clip(28.5 + rng.normal(0, 1.2), 26.0, 32.0))
        shear = float(np.clip(12.0 + rng.normal(0, 5.0), 4.0, 35.0))

        pattern = arch[3]
        is_ri = 1.0 if (arch[4] or (wind >= 90.0 and sst >= 29.5 and shear <= 12.0)) else 0.0

        # Generate 4-channel satellite tensor
        scene = MultiSourceSatelliteSynthesizer.generate_calibrated_scene(
            wind_kph=wind,
            pressure_hpa=pressure,
            heading_deg=heading,
            shear_magnitude_kt=shear,
            size=IMAGE_SIZE,
        )
        tensor_4ch = scene["normalized_tensor_4ch"]

        # Calculate target forecasts
        dw_6h = 18.0 if is_ri else (6.0 if wind < 160 else -4.0)
        dp_6h = -8.0 if is_ri else (-4.0 if wind < 160 else 3.0)
        dw_12h = dw_6h * 1.9
        dp_12h = dp_6h * 1.9
        dw_24h = dw_6h * 3.4
        dp_24h = dp_6h * 3.4
        dw_48h = dw_6h * 4.2
        dp_48h = dp_6h * 4.2

        track_deltas = []
        for hours in (6, 12, 24, 48):
            future_lat, future_lon = destination(lat, lon, heading, speed * hours)
            track_deltas.extend((future_lat - lat, (future_lon - lon + 180) % 360 - 180))

        # Offsets in fractions of image width and height, in image coordinates.
        shift_x, shift_y = rng.integers(-8, 9, size=2)
        tensor_4ch = np.roll(tensor_4ch, (shift_y, shift_x), axis=(1, 2))
        samples.append({
            "tensor": tensor_4ch,
            "presence": 1.0 if wind >= 50.0 else 0.0,
            "center_offset": np.array([shift_x, shift_y], dtype=np.float32) / IMAGE_SIZE,
            "pattern_idx": PATTERN_CLASSES.index(pattern),
            "is_ri": float(dw_24h >= 30 * 1.852),
            "telemetry": np.array([lat, lon, wind, pressure, heading, speed, sst, shear], dtype=np.float32),
            "ocean_telemetry": np.array([sst, shear, sst - 26.5, wind / 200.0], dtype=np.float32),
            "intensity_deltas": np.array([dw_6h, dp_6h, dw_12h, dp_12h, dw_24h, dp_24h, dw_48h, dp_48h], dtype=np.float32),
            "track_deltas": np.array(track_deltas, dtype=np.float32),
        })

    return samples


# =========================================================
# TRAINING ROUTINE
# =========================================================

MODEL_TYPES = {
    "detection": PyTorchDetectionAndLocator,
    "pattern": PyTorchPatternClassifier,
    "ri": PyTorchRapidIntensificationModel,
    "intensity": PyTorchIntensityRegressor,
}


def train_and_export_all_models(names=None, epochs=15, lr=0.002, num_samples=320, output_dir=MODELS_DIR):
    """Fit selected experimental checkpoints on the same four-channel tensors used at inference."""
    torch.manual_seed(42)
    samples = build_training_dataset(num_samples)
    loader = DataLoader(samples, batch_size=16, shuffle=True)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    for name in (names or MODEL_TYPES):
        model = MODEL_TYPES[name]()
        optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
        model.train()
        for epoch in range(epochs):
            for data in loader:
                optimizer.zero_grad()
                images = data["tensor"]
                if name == "detection":
                    presence, offset = model(images)
                    loss = F.binary_cross_entropy_with_logits(presence[:, 0], data["presence"].float())
                    loss += 3 * F.mse_loss(offset, data["center_offset"])
                elif name == "pattern":
                    loss = F.cross_entropy(model(images), data["pattern_idx"])
                elif name == "ri":
                    logits = model(images, data["ocean_telemetry"])
                    loss = F.binary_cross_entropy_with_logits(logits[:, 0], data["is_ri"].float())
                else:
                    intensity, track = model(images, data["telemetry"])
                    loss = F.mse_loss(intensity, data["intensity_deltas"]) + 15 * F.mse_loss(track, data["track_deltas"])
                loss.backward()
                optimizer.step()
            print(f"{name} epoch {epoch + 1}/{epochs}", flush=True)
        checkpoint = output_dir / f"cyclone_{name}_model.pt"
        temporary = checkpoint.with_suffix(".pt.tmp")
        torch.save(model.state_dict(), temporary)
        temporary.replace(checkpoint)


if __name__ == "__main__":
    train_and_export_all_models()
