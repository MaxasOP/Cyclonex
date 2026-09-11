"""Standalone evaluation runner for CYCLONEX PyTorch models."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure root directory is on sys.path
ROOT_DIR = Path(__file__).parent.parent.resolve()
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from training.train_pattern_classifier import train_pattern_classifier
from training.train_intensity_model import train_intensity_model

RESULTS_DIR = Path(__file__).parent / "results"

def run_evaluation():
    print("=== RUNNING FULL MODEL EVALUATION PIPELINE ===")
    train_pattern_classifier(epochs=3)
    train_intensity_model(epochs=3)
    
    summary = {}
    pattern_file = RESULTS_DIR / "pattern_metrics.json"
    intensity_file = RESULTS_DIR / "intensity_metrics.json"

    if pattern_file.exists():
        with open(pattern_file, "r") as f:
            summary["pattern_classification"] = json.load(f)
    if intensity_file.exists():
        with open(intensity_file, "r") as f:
            summary["intensity_prediction"] = json.load(f)

    summary_file = RESULTS_DIR / "evaluation_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    
    print(f"[OK] Full evaluation summary saved to {summary_file}")

if __name__ == "__main__":
    run_evaluation()
