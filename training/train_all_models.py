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

class ConvBlock(nn.Module):
    """Standard Convolutional Block with BatchNorm and LeakyReLU."""
    def __init__(self, in_c: int, out_c: int, stride: int = 1):
        super().__init__()
        self.conv = nn.Conv2d(in_c, out_c, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn = nn.BatchNorm2d(out_c)
        self.act = nn.LeakyReLU(0.1, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.act(self.bn(self.conv(x)))


class PyTorchDetectionAndLocator(nn.Module):
    """Detection of cyclone presence and eye/center localization in satellite scene."""
    def __init__(self, in_channels: int = 4):
        super().__init__()
        self.features = nn.Sequential(
            ConvBlock(in_channels, 16, stride=2),  # 112x112
            ConvBlock(16, 32, stride=2),           # 56x56
            ConvBlock(32, 64, stride=2),           # 28x28
            ConvBlock(64, 128, stride=2),          # 14x14
            nn.AdaptiveAvgPool2d((2, 2)),
            nn.Flatten(),
        )
        # Binary presence logit
        self.fc_presence = nn.Linear(128 * 4, 1)
        # Normalized (dx, dy) center offset relative to frame center [-1.0, 1.0]
        self.fc_center = nn.Linear(128 * 4, 2)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        feat = self.features(x)
        presence = self.fc_presence(feat)
        center_offset = torch.tanh(self.fc_center(feat))
        return presence, center_offset


class PyTorchPatternClassifier(nn.Module):
    """Deep CNN for 6-class Dvorak morphological pattern classification with Grad-CAM support."""
    def __init__(self, in_channels: int = 4, num_classes: int = len(PATTERN_CLASSES)):
        super().__init__()
        self.layer1 = ConvBlock(in_channels, 24, stride=2)   # 112x112
        self.layer2 = ConvBlock(24, 48, stride=2)            # 56x56
        self.layer3 = ConvBlock(48, 96, stride=2)            # 28x28
        self.layer4 = ConvBlock(96, 160, stride=2)           # 14x14
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(0.25)
        self.fc = nn.Linear(160, num_classes)

        # Hook placeholders for Grad-CAM
        self.gradients = None
        self.activations = None

    def activations_hook(self, grad):
        self.gradients = grad

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        if x.requires_grad:
            h = x.register_hook(self.activations_hook)
        self.activations = x

        pooled = self.pool(x)
        flattened = torch.flatten(pooled, 1)
        out = self.fc(self.dropout(flattened))
        return out


class PyTorchRapidIntensificationModel(nn.Module):
    """Predicts probability of Rapid Intensification (RI >= 30 kt / 24h)."""
    def __init__(self, in_channels: int = 4):
        super().__init__()
        self.image_encoder = nn.Sequential(
            ConvBlock(in_channels, 16, stride=2),
            ConvBlock(16, 32, stride=2),
            ConvBlock(32, 64, stride=2),
            nn.AdaptiveAvgPool2d((2, 2)),
            nn.Flatten(),
        )
        # Combined with ocean heat & atmospheric shear features (4 scalar features)
        self.fc = nn.Sequential(
            nn.Linear(64 * 4 + 4, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 1),
        )

    def forward(self, img_tensor: torch.Tensor, ocean_telemetry: torch.Tensor) -> torch.Tensor:
        img_feat = self.image_encoder(img_tensor)
        combined = torch.cat([img_feat, ocean_telemetry], dim=1)
        return self.fc(combined)


class PyTorchIntensityRegressor(nn.Module):
    """Multi-horizon intensity changes and track displacements (+6h, +12h, +24h, +48h)."""
    def __init__(self, in_channels: int = 4):
        super().__init__()
        self.encoder = nn.Sequential(
            ConvBlock(in_channels, 16, stride=2),
            ConvBlock(16, 32, stride=2),
            ConvBlock(32, 64, stride=2),
            nn.AdaptiveAvgPool2d((2, 2)),
            nn.Flatten(),
        )
        # Telemetry: [lat, lon, wind, pressure, heading, speed, sst, shear] (8 features)
        self.fc_intensity = nn.Sequential(
            nn.Linear(64 * 4 + 8, 128),
            nn.ReLU(),
            nn.Linear(128, 8),  # 8 outputs: (+6h, +12h, +24h, +48h d_wind, d_pressure)
        )
        self.fc_track = nn.Sequential(
            nn.Linear(64 * 4 + 8, 128),
            nn.ReLU(),
            nn.Linear(128, 8),  # 8 outputs: (+6h, +12h, +24h, +48h d_lat, d_lon)
        )

    def forward(self, img_tensor: torch.Tensor, telemetry: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        feat = self.encoder(img_tensor)
        combined = torch.cat([feat, telemetry], dim=1)
        intensity_deltas = self.fc_intensity(combined)
        track_deltas = self.fc_track(combined)
        return intensity_deltas, track_deltas


# =========================================================
# DATASET GENERATOR WITH AUTHENTIC SATELLITE PROFILES
# =========================================================

def build_training_dataset(num_samples: int = 360) -> list[dict]:
    """Synthesize representative North Indian Ocean storm samples across various lifecycle stages."""
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
        wind = float(np.clip(arch[1] + np.random.normal(0, 8.0), 30.0, 260.0))
        pressure = float(np.clip(arch[2] + np.random.normal(0, 5.0), 900.0, 1006.0))
        heading = float((315.0 + np.random.normal(0, 25.0)) % 360.0)
        speed = float(np.clip(18.0 + np.random.normal(0, 4.0), 8.0, 38.0))
        lat = float(np.clip(14.0 + np.random.normal(0, 4.0), 5.0, 24.0))
        lon = float(np.clip(85.0 + np.random.normal(0, 6.0), 65.0, 95.0))
        sst = float(np.clip(28.5 + np.random.normal(0, 1.2), 26.0, 32.0))
        shear = float(np.clip(12.0 + np.random.normal(0, 5.0), 4.0, 35.0))

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
        dw_6h = 12.0 if is_ri else (6.0 if wind < 160 else -4.0)
        dp_6h = -8.0 if is_ri else (-4.0 if wind < 160 else 3.0)
        dw_12h = dw_6h * 1.9
        dp_12h = dp_6h * 1.9
        dw_24h = dw_6h * 3.4
        dp_24h = dp_6h * 3.4
        dw_48h = dw_6h * 4.2
        dp_48h = dp_6h * 4.2

        heading_rad = math.radians(heading)
        dist_deg_6h = (speed * 6.0) / 111.0
        dist_deg_12h = (speed * 12.0) / 111.0
        dist_deg_24h = (speed * 24.0) / 111.0
        dist_deg_48h = (speed * 48.0) / 111.0

        samples.append({
            "tensor": tensor_4ch,
            "presence": 1.0 if wind >= 50.0 else 0.0,
            "center_offset": np.array([np.random.normal(0, 0.03), np.random.normal(0, 0.03)], dtype=np.float32),
            "pattern_idx": PATTERN_CLASSES.index(pattern),
            "is_ri": is_ri,
            "telemetry": np.array([lat, lon, wind, pressure, heading, speed, sst, shear], dtype=np.float32),
            "ocean_telemetry": np.array([sst, shear, sst - 26.5, wind / 200.0], dtype=np.float32),
            "intensity_deltas": np.array([dw_6h, dp_6h, dw_12h, dp_12h, dw_24h, dp_24h, dw_48h, dp_48h], dtype=np.float32),
            "track_deltas": np.array([
                dist_deg_6h * math.cos(heading_rad), dist_deg_6h * math.sin(heading_rad),
                dist_deg_12h * math.cos(heading_rad), dist_deg_12h * math.sin(heading_rad),
                dist_deg_24h * math.cos(heading_rad), dist_deg_24h * math.sin(heading_rad),
                dist_deg_48h * math.cos(heading_rad), dist_deg_48h * math.sin(heading_rad),
            ], dtype=np.float32),
        })

    return samples


# =========================================================
# TRAINING ROUTINE
# =========================================================

def train_and_export_all_models():
    """Train all 4 models and save weights to models/."""
    print("[CYCLONEX TRAINING] Synthesizing calibrated multi-channel satellite dataset...", flush=True)
    samples = build_training_dataset(num_samples=320)

    tensors = torch.tensor(np.stack([s["tensor"] for s in samples]), dtype=torch.float32)
    presences = torch.tensor([s["presence"] for s in samples], dtype=torch.float32).unsqueeze(1)
    center_offsets = torch.tensor(np.stack([s["center_offset"] for s in samples]), dtype=torch.float32)
    pattern_labels = torch.tensor([s["pattern_idx"] for s in samples], dtype=torch.long)
    ri_labels = torch.tensor([s["is_ri"] for s in samples], dtype=torch.float32).unsqueeze(1)
    telemetries = torch.tensor(np.stack([s["telemetry"] for s in samples]), dtype=torch.float32)
    ocean_telemetries = torch.tensor(np.stack([s["ocean_telemetry"] for s in samples]), dtype=torch.float32)
    intensity_deltas = torch.tensor(np.stack([s["intensity_deltas"] for s in samples]), dtype=torch.float32)
    track_deltas = torch.tensor(np.stack([s["track_deltas"] for s in samples]), dtype=torch.float32)

    epochs = 15
    batch_size = 16
    n_batches = len(samples) // batch_size

    # 1. Train Detection & Localization Model
    print("[CYCLONEX TRAINING] (1/4) Training Cyclone Detection & Eye Locator Model...", flush=True)
    det_model = PyTorchDetectionAndLocator(in_channels=4)
    opt_det = torch.optim.AdamW(det_model.parameters(), lr=0.002, weight_decay=1e-4)
    bce_loss = nn.BCEWithLogitsLoss()
    mse_loss = nn.MSELoss()

    det_model.train()
    for ep in range(epochs):
        perm = torch.randperm(len(samples))
        for b in range(n_batches):
            idx = perm[b * batch_size : (b + 1) * batch_size]
            opt_det.zero_grad()
            p_pred, c_pred = det_model(tensors[idx])
            loss = bce_loss(p_pred, presences[idx]) + 3.0 * mse_loss(c_pred, center_offsets[idx])
            loss.backward()
            opt_det.step()
    det_path = MODELS_DIR / "cyclone_detection_model.pt"
    torch.save(det_model.state_dict(), det_path)
    print(f"  -> Saved detection model to {det_path} ({os.path.getsize(det_path) // 1024} KB)")

    # 2. Train Dvorak Pattern Classifier
    print("[CYCLONEX TRAINING] (2/4) Training 6-Class Dvorak Pattern Classifier...", flush=True)
    pat_model = PyTorchPatternClassifier(in_channels=4, num_classes=len(PATTERN_CLASSES))
    opt_pat = torch.optim.AdamW(pat_model.parameters(), lr=0.002, weight_decay=1e-4)
    ce_loss = nn.CrossEntropyLoss()

    pat_model.train()
    for ep in range(epochs):
        perm = torch.randperm(len(samples))
        for b in range(n_batches):
            idx = perm[b * batch_size : (b + 1) * batch_size]
            opt_pat.zero_grad()
            logits = pat_model(tensors[idx])
            loss = ce_loss(logits, pattern_labels[idx])
            loss.backward()
            opt_pat.step()
    pat_path = MODELS_DIR / "cyclone_pattern_model.pt"
    torch.save(pat_model.state_dict(), pat_path)
    print(f"  -> Saved pattern classifier to {pat_path} ({os.path.getsize(pat_path) // 1024} KB)")

    # 3. Train Rapid Intensification (RI) Model
    print("[CYCLONEX TRAINING] (3/4) Training Rapid Intensification (RI) Predictor...", flush=True)
    ri_model = PyTorchRapidIntensificationModel(in_channels=4)
    opt_ri = torch.optim.AdamW(ri_model.parameters(), lr=0.002, weight_decay=1e-4)

    ri_model.train()
    for ep in range(epochs):
        perm = torch.randperm(len(samples))
        for b in range(n_batches):
            idx = perm[b * batch_size : (b + 1) * batch_size]
            opt_ri.zero_grad()
            pred_ri = ri_model(tensors[idx], ocean_telemetries[idx])
            loss = bce_loss(pred_ri, ri_labels[idx])
            loss.backward()
            opt_ri.step()
    ri_path = MODELS_DIR / "cyclone_ri_model.pt"
    torch.save(ri_model.state_dict(), ri_path)
    print(f"  -> Saved RI model to {ri_path} ({os.path.getsize(ri_path) // 1024} KB)")

    # 4. Train Intensity & Track Regressor
    print("[CYCLONEX TRAINING] (4/4) Training Multi-Horizon Intensity & Track Regressor...", flush=True)
    int_model = PyTorchIntensityRegressor(in_channels=4)
    opt_int = torch.optim.AdamW(int_model.parameters(), lr=0.002, weight_decay=1e-4)

    int_model.train()
    for ep in range(epochs):
        perm = torch.randperm(len(samples))
        for b in range(n_batches):
            idx = perm[b * batch_size : (b + 1) * batch_size]
            opt_int.zero_grad()
            p_int, p_trk = int_model(tensors[idx], telemetries[idx])
            loss = mse_loss(p_int, intensity_deltas[idx]) + 15.0 * mse_loss(p_trk, track_deltas[idx])
            loss.backward()
            opt_int.step()
    int_path = MODELS_DIR / "cyclone_intensity_model.pt"
    torch.save(int_model.state_dict(), int_path)
    print(f"  -> Saved intensity regressor to {int_path} ({os.path.getsize(int_path) // 1024} KB)")

    print("[CYCLONEX TRAINING] All 4 PyTorch AI/ML models trained and exported successfully!", flush=True)


if __name__ == "__main__":
    train_and_export_all_models()
