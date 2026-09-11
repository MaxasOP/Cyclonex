"""Training pipeline for Cyclone Intensity Regressor model in CYCLONEX."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Dict, List

# Ensure root directory is on sys.path
ROOT_DIR = Path(__file__).parent.parent.resolve()
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from ai_cyclone_service import PyTorchIntensityRegressor
from training.dataset import SatelliteCycloneDataset

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def generate_intensity_dataset(num_samples: int = 120) -> List[Dict]:
    """Generate training sample metadata for intensity forecasting."""
    samples = []
    for i in range(num_samples):
        wind = 80.0 + (i % 8) * 15.0
        pressure = 980.0 - (i % 8) * 6.0
        samples.append({
            "sample_id": f"intensity_{i+1:03d}",
            "centre_lat": 14.0 + (i % 8) * 0.5,
            "centre_lon": 84.0 + (i % 8) * 0.5,
            "wind_speed": wind,
            "pressure": pressure,
            "wind_6h": wind + 8.0,
            "pressure_6h": pressure - 6.0,
            "wind_12h": wind + 16.0,
            "pressure_12h": pressure - 12.0,
            "wind_24h": wind + 24.0,
            "pressure_24h": pressure - 18.0,
        })
    return samples


def compute_regression_metrics(y_true: List[List[float]], y_pred: List[List[float]]) -> Dict:
    """Compute Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE)."""
    n = len(y_true)
    if n == 0:
        return {"mae": 0.0, "rmse": 0.0}

    num_targets = len(y_true[0])
    maes = []
    rmses = []

    for t_idx in range(num_targets):
        errors = [y_true[i][t_idx] - y_pred[i][t_idx] for i in range(n)]
        mae = sum(abs(e) for e in errors) / n
        rmse = math.sqrt(sum(e * e for e in errors) / n)
        maes.append(round(mae, 3))
        rmses.append(round(rmse, 3))

    return {
        "mae_wind_6h": maes[0],
        "mae_pressure_6h": maes[1],
        "mae_wind_12h": maes[2],
        "mae_pressure_12h": maes[3],
        "mae_wind_24h": maes[4],
        "mae_pressure_24h": maes[5],
        "overall_mae": round(sum(maes) / len(maes), 3),
        "overall_rmse": round(sum(rmses) / len(rmses), 3),
    }


def train_intensity_model(epochs: int = 5, lr: float = 0.001):
    print("=== CYCLONEX INTENSITY & TRACK REGRESSOR TRAINING ===")
    samples = generate_intensity_dataset(150)

    n_train = int(len(samples) * 0.8)
    train_data = samples[:n_train]
    test_data = samples[n_train:]

    train_loader = DataLoader(SatelliteCycloneDataset(train_data), batch_size=8, shuffle=True)
    test_loader = DataLoader(SatelliteCycloneDataset(test_data), batch_size=1)

    model = PyTorchIntensityRegressor()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    model.train()
    for epoch in range(epochs):
        total_loss = 0.0
        for tensors, _, targets in train_loader:
            optimizer.zero_grad()
            telemetry = targets["telemetry"]
            target_out = torch.cat([targets["wind"], targets["pressure"]], dim=1)

            intensity_out, _ = model(tensors, telemetry)
            loss = criterion(intensity_out, target_out)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        print(f"Epoch [{epoch+1}/{epochs}] - Loss: {total_loss/len(train_loader):.4f}")

    # Save model checkpoint
    save_path = MODELS_DIR / "cyclone_intensity_model.pt"
    torch.save(model.state_dict(), save_path)
    print(f"[OK] Intensity model saved to {save_path}")

    # Evaluate on test set
    model.eval()
    y_true, y_pred = [], []
    with torch.no_grad():
        for tensors, _, targets in test_loader:
            telemetry = targets["telemetry"]
            target_out = torch.cat([targets["wind"], targets["pressure"]], dim=1)
            intensity_out, _ = model(tensors, telemetry)

            y_true.append(target_out[0].tolist())
            y_pred.append(intensity_out[0].tolist())

    metrics = compute_regression_metrics(y_true, y_pred)
    metrics_path = RESULTS_DIR / "intensity_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"[METRICS] Intensity evaluation metrics saved to {metrics_path}")
    print("Metrics:", metrics)


if __name__ == "__main__":
    train_intensity_model()
