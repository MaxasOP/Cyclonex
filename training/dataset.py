"""PyTorch Dataset & DataLoader for CYCLONEX Satellite Cyclone Models."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch
from torch.utils.data import Dataset

# Ensure root directory is on sys.path
ROOT_DIR = Path(__file__).parent.parent.resolve()
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

CONFIG_PATH = ROOT_DIR / "config" / "ai_config.json"
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    AI_CONFIG = json.load(f)

PATTERN_CLASSES = AI_CONFIG.get("pattern_classes", [])
IMAGE_SIZE = AI_CONFIG.get("image_size", 224)


class SatelliteCycloneDataset(Dataset):
    """PyTorch Dataset for multi-channel satellite image tensors and target labels."""

    def __init__(self, samples: List[Dict], is_train: bool = True):
        self.samples = samples
        self.is_train = is_train

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, Dict]:
        sample = self.samples[idx]

        # 4-channel tensor shape (4, 224, 224)
        tensor = torch.zeros((4, IMAGE_SIZE, IMAGE_SIZE), dtype=torch.float32)
        
        # Populate mock/synthetic data if image tensor array present
        if "channels_data" in sample:
            tensor = torch.tensor(sample["channels_data"], dtype=torch.float32)
        else:
            # Generate deterministic synthetic spatial pattern for dataset baseline
            lat = sample.get("centre_lat", 15.0)
            lon = sample.get("centre_lon", 85.0)
            wind = sample.get("wind_speed", 120.0)
            tensor[0] = (wind / 300.0) * torch.ones((IMAGE_SIZE, IMAGE_SIZE))
            tensor[1] = (1.0 - wind / 300.0) * torch.ones((IMAGE_SIZE, IMAGE_SIZE))

        # Target pattern class index
        pattern_str = sample.get("pattern", "mature_eye")
        pattern_idx = PATTERN_CLASSES.index(pattern_str) if pattern_str in PATTERN_CLASSES else 0
        target_class = torch.tensor(pattern_idx, dtype=torch.long)

        # Regressor targets: (+6h, +12h, +24h wind & pressure)
        targets = {
            "wind": torch.tensor([sample.get("wind_6h", 120.0), sample.get("wind_12h", 130.0), sample.get("wind_24h", 140.0)], dtype=torch.float32),
            "pressure": torch.tensor([sample.get("pressure_6h", 965.0), sample.get("pressure_12h", 955.0), sample.get("pressure_24h", 945.0)], dtype=torch.float32),
            "telemetry": torch.tensor([sample.get("centre_lat", 15.0), sample.get("centre_lon", 85.0), sample.get("wind_speed", 110.0), sample.get("pressure", 975.0)], dtype=torch.float32),
        }

        return tensor, target_class, targets
