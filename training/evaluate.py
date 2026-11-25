"""Evaluate bundled checkpoints on reproducible synthetic scenarios without changing weights."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from torch.utils.data import DataLoader

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from training.train_all_models import MODEL_TYPES, MODELS_DIR, PATTERN_CLASSES, build_training_dataset
from geo import distance_km

RESULTS_DIR = Path(__file__).parent / "results"


def run_evaluation(model_dir=MODELS_DIR, results_dir=RESULTS_DIR, num_samples=80):
    seed = 2026
    loader = DataLoader(build_training_dataset(num_samples, seed=seed), batch_size=8)
    metadata = {"evaluation_data": "SYNTHETIC_SCENARIOS", "seed": seed, "sample_count": num_samples}
    networks = {}
    digests = {}
    for name, model_type in MODEL_TYPES.items():
        path = Path(model_dir) / f"cyclone_{name}_model.pt"
        model = model_type()
        model.load_state_dict(torch.load(path, weights_only=True, map_location="cpu"))
        networks[name] = model.eval()
        digests[name] = hashlib.sha256(path.read_bytes()).hexdigest()

    predicted = {"pattern": [], "presence": [], "ri": []}
    targets = {key: [] for key in predicted}
    absolute_errors = []
    track_errors = []
    with torch.inference_mode():
        for batch in loader:
            images = batch["tensor"]
            presence, _ = networks["detection"](images)
            pattern = networks["pattern"](images).argmax(dim=1)
            ri = networks["ri"](images, batch["ocean_telemetry"])
            intensity, track = networks["intensity"](images, batch["telemetry"])
            for key, output, truth in (("pattern", pattern, "pattern_idx"), ("presence", presence[:,0] >= 0, "presence"), ("ri", ri[:,0] >= 0, "is_ri")):
                predicted[key].extend(output.tolist())
                targets[key].extend(batch[truth].tolist())
            absolute_errors.extend((intensity - batch["intensity_deltas"]).abs().tolist())
            for state, actual, estimate in zip(batch["telemetry"].tolist(), batch["track_deltas"].tolist(), track.tolist()):
                lat, lon = state[:2]
                track_errors.append([distance_km(lat + actual[i], lon + actual[i+1], lat + estimate[i], lon + estimate[i+1])
                                     for i in range(0, 8, 2)])

    y, pred = targets["pattern"], predicted["pattern"]
    classes = list(range(len(PATTERN_CLASSES)))
    pattern_result = {
        **metadata, "checkpoint_sha256": digests["pattern"], "classes": PATTERN_CLASSES,
        "accuracy": accuracy_score(y, pred),
        "precision_macro": precision_score(y, pred, labels=classes, average="macro", zero_division=0),
        "recall_macro": recall_score(y, pred, labels=classes, average="macro", zero_division=0),
        "f1_macro": f1_score(y, pred, labels=classes, average="macro", zero_division=0),
        "confusion_matrix": confusion_matrix(y, pred, labels=classes).tolist(),
    }
    maes, distances = np.mean(absolute_errors, axis=0), np.mean(track_errors, axis=0)
    intensity_result = {**metadata, "checkpoint_sha256": digests["intensity"], "by_horizon": {
        f"{hours}h": {"wind_mae_kph": round(maes[2*i], 3), "pressure_mae_hpa": round(maes[2*i+1], 3),
                       "mean_track_error_km": round(distances[i], 3)}
        for i, hours in enumerate((6, 12, 24, 48))
    }}
    summary = {**metadata, "checkpoint_sha256": digests, "pattern_classification": pattern_result,
               "intensity_prediction": intensity_result,
               "detection_f1": f1_score(targets["presence"], predicted["presence"], zero_division=0),
               "ri_f1": f1_score(targets["ri"], predicted["ri"], zero_division=0)}
    results_dir = Path(results_dir)
    results_dir.mkdir(exist_ok=True, parents=True)
    for filename, result in (("evaluation_summary", summary), ("pattern_metrics", pattern_result), ("intensity_metrics", intensity_result)):
        (results_dir / f"{filename}.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Evaluated {num_samples} synthetic scenarios. Results: {results_dir}")
    return summary


if __name__ == "__main__":
    run_evaluation()
