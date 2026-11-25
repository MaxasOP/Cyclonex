"""Train the pattern checkpoint using the shared experimental dataset and architecture."""

from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from training.train_all_models import train_and_export_all_models


def train_pattern_classifier(epochs: int = 5, lr: float = 0.001, **kwargs):
    train_and_export_all_models(["pattern"], epochs=epochs, lr=lr, **kwargs)


if __name__ == "__main__":
    train_pattern_classifier()
