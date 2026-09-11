"""Training pipeline for Cyclone Pattern Classifier model in CYCLONEX."""

from __future__ import annotations

import json
import os
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

from ai_cyclone_service import PyTorchPatternClassifier, PATTERN_CLASSES
from training.dataset import SatelliteCycloneDataset

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def generate_synthetic_dataset(num_samples: int = 120) -> List[Dict]:
    """Generate training sample metadata across configured pattern classes."""
    samples = []
    for i in range(num_samples):
        cls_name = PATTERN_CLASSES[i % len(PATTERN_CLASSES)]
        wind = 60.0 + (i % 6) * 30.0
        samples.append({
            "sample_id": f"sample_{i+1:03d}",
            "centre_lat": 12.5 + (i % 10) * 0.8,
            "centre_lon": 82.0 + (i % 12) * 0.6,
            "wind_speed": wind,
            "pressure": 985.0 - (i % 6) * 10.0,
            "pattern": cls_name,
        })
    return samples


def compute_metrics(y_true: List[int], y_pred: List[int]) -> Dict:
    """Compute classification evaluation metrics (Accuracy, Precision, Recall, F1, Confusion Matrix)."""
    num_classes = len(PATTERN_CLASSES)
    conf_matrix = [[0] * num_classes for _ in range(num_classes)]
    for t, p in zip(y_true, y_pred):
        if 0 <= t < num_classes and 0 <= p < num_classes:
            conf_matrix[t][p] += 1

    correct = sum(conf_matrix[i][i] for i in range(num_classes))
    total = len(y_true)
    accuracy = round(correct / total, 4) if total > 0 else 0.0

    # Macro-averaged Precision, Recall, F1
    precisions, recalls = [], []
    for c in range(num_classes):
        tp = conf_matrix[c][c]
        fp = sum(conf_matrix[r][c] for r in range(num_classes) if r != c)
        fn = sum(conf_matrix[c][p] for p in range(num_classes) if p != c)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        precisions.append(prec)
        recalls.append(rec)

    avg_prec = round(sum(precisions) / num_classes, 4)
    avg_rec = round(sum(recalls) / num_classes, 4)
    f1 = round((2 * avg_prec * avg_rec) / (avg_prec + avg_rec), 4) if (avg_prec + avg_rec) > 0 else 0.0

    return {
        "accuracy": accuracy,
        "precision_macro": avg_prec,
        "recall_macro": avg_rec,
        "f1_macro": f1,
        "confusion_matrix": conf_matrix,
        "classes": PATTERN_CLASSES
    }


def train_pattern_classifier(epochs: int = 5, lr: float = 0.001):
    print("=== CYCLONEX PATTERN CLASSIFIER TRAINING ===")
    all_samples = generate_synthetic_dataset(150)
    
    # Train / Val / Test Split (70% / 15% / 15%)
    n_train = int(len(all_samples) * 0.70)
    n_val = int(len(all_samples) * 0.15)
    
    train_data = all_samples[:n_train]
    val_data = all_samples[n_train:n_train+n_val]
    test_data = all_samples[n_train+n_val:]

    train_ds = SatelliteCycloneDataset(train_data, is_train=True)
    test_ds = SatelliteCycloneDataset(test_data, is_train=False)

    train_loader = DataLoader(train_ds, batch_size=8, shuffle=True)

    model = PyTorchPatternClassifier()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    model.train()
    for epoch in range(epochs):
        total_loss = 0.0
        for tensors, targets, _ in train_loader:
            optimizer.zero_grad()
            outputs = model(tensors)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        print(f"Epoch [{epoch+1}/{epochs}] - Loss: {total_loss/len(train_loader):.4f}")

    # Save model checkpoint
    save_path = MODELS_DIR / "cyclone_pattern_model.pt"
    torch.save(model.state_dict(), save_path)
    print(f"[OK] Pattern model saved to {save_path}")

    # Evaluate on test set
    model.eval()
    y_true, y_pred = [], []
    with torch.no_grad():
        for tensors, targets, _ in DataLoader(test_ds, batch_size=1):
            logits = model(tensors)
            pred = torch.argmax(logits, dim=1).item()
            y_true.append(targets.item())
            y_pred.append(pred)

    metrics = compute_metrics(y_true, y_pred)
    metrics_path = RESULTS_DIR / "pattern_metrics.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"[METRICS] Pattern evaluation metrics saved to {metrics_path}")
    print("Metrics:", metrics)


if __name__ == "__main__":
    train_pattern_classifier()
