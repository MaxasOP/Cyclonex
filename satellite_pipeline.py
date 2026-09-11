"""Multi-Source Satellite Preprocessing, Calibration & Feature Pipeline for CYCLONEX.

Supports NOAA HURSAT-B1, ISRO INSAT-3D/3DR (TIR-1, TIR-2, WV, VIS), and NASA GPM/IMERG.
Transforms raw satellite imagery and sensor counts into calibrated physical quantities:
- Thermal IR (10.8 µm): Brightness Temperature Tb (Kelvin / °C)
- Water Vapor (6.7 µm): Mid-to-upper tropospheric moisture flux
- Microwave (89 GHz): Deep convective precipitation structure
- Visible (0.65 µm): Cloud albedo and texture
"""

from __future__ import annotations

import io
import math
import numpy as np
from typing import Dict, List, Optional, Tuple, Union

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


IMAGE_SIZE = 224

# Calibration constants for Satellite Infrared Radiometry
PLANCK_C1 = 1.191042e-5  # mW / (m^2 * sr * cm^-4)
PLANCK_C2 = 1.4387752    # cm * K
CENTRAL_WAVENUMBER_IR = 925.925  # cm^-1 for 10.8 µm (TIR-1)


def counts_to_brightness_temp_k(counts: np.ndarray, gain: float = 0.05, offset: float = 180.0) -> np.ndarray:
    """Calibrate raw 8-bit/10-bit radiometer digital counts to Brightness Temperature in Kelvin."""
    tb_k = counts.astype(np.float32) * gain + offset
    return np.clip(tb_k, 180.0, 310.0)


def normalize_channel_tensor(channel_data: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    """Normalize physical sensor values to standardized neural network range [0.0, 1.0]."""
    clipped = np.clip(channel_data, vmin, vmax)
    return (clipped - vmin) / max(1e-5, (vmax - vmin))


class MultiSourceSatelliteSynthesizer:
    """Atmospheric physics-informed satellite scene synthesizer for testing and operational fallback.
    
    Constructs multi-channel 224x224 storm-centered scenes reflecting:
    - Logarithmic spiral rainbands (r = a * exp(b * theta))
    - Central Dense Overcast (CDO) with cold convective core (Tb down to -82°C)
    - Distinct eyewall ring and warm eye clearing for mature storms
    - Environmental vertical wind shear displacement
    """

    @staticmethod
    def generate_calibrated_scene(
        wind_kph: float,
        pressure_hpa: float,
        heading_deg: float = 315.0,
        shear_magnitude_kt: float = 12.0,
        size: int = IMAGE_SIZE,
    ) -> Dict[str, np.ndarray]:
        """Generate physically consistent 4-channel satellite scene arrays."""
        y, x = np.ogrid[:size, :size]
        center = size / 2.0
        x_norm = (x - center) / center
        y_norm = (y - center) / center
        r = np.sqrt(x_norm ** 2 + y_norm ** 2)
        theta = np.arctan2(y_norm, x_norm)

        # 1. Storm morphology parameters derived from wind & pressure
        is_mature = wind_kph >= 120.0
        eye_radius_norm = 0.07 if is_mature else 0.03
        cdo_radius_norm = 0.35 + min(0.3, wind_kph / 500.0)

        # 2. Logarithmic spiral bands (2-arm spiral)
        b = 0.42  # Pitch angle factor
        spiral_phase_1 = (np.log(np.maximum(r, 0.01)) / b - theta) % (np.pi)
        spiral_phase_2 = (np.log(np.maximum(r, 0.01)) / b - theta + np.pi / 2.0) % (np.pi)
        spiral_intensity = np.exp(-spiral_phase_1 * 2.2) + 0.7 * np.exp(-spiral_phase_2 * 2.5)

        # 3. Channel 0: Thermal Infrared (10.8 µm) - Brightness Temperature in Kelvin
        tb_k = np.full((size, size), 296.0, dtype=np.float32)

        # CDO core
        cdo_mask = r <= cdo_radius_norm
        cdo_decay = np.maximum(0.0, 1.0 - (r / cdo_radius_norm)) ** 0.8
        tb_k[cdo_mask] = 230.0 - 25.0 * cdo_decay[cdo_mask]

        # Eyewall ring
        if is_mature:
            eyewall_mask = (r >= eye_radius_norm * 0.7) & (r <= eye_radius_norm * 2.2)
            tb_k[eyewall_mask] = 195.0 + 15.0 * np.random.normal(0, 0.2, size=tb_k[eyewall_mask].shape)
            # Warm eye core
            eye_mask = r < eye_radius_norm * 0.7
            eye_warmth = 288.0 + (wind_kph / 250.0) * 12.0
            tb_k[eye_mask] = np.clip(eye_warmth - 30.0 * (r[eye_mask] / (eye_radius_norm * 0.7)), 245.0, 302.0)

        # Outer spiral bands
        outer_mask = (r > eye_radius_norm * 2.2) & (r < 0.95)
        tb_k[outer_mask] -= spiral_intensity[outer_mask] * 45.0
        tb_k = np.clip(tb_k + np.random.normal(0, 1.5, size=(size, size)), 185.0, 305.0)

        # 4. Channel 1: Water Vapor (6.7 µm)
        wv_k = tb_k * 0.92 + 12.0
        dry_slot_angle = math.radians(225.0)
        angle_diff = np.abs(np.arctan2(np.sin(theta - dry_slot_angle), np.cos(theta - dry_slot_angle)))
        dry_slot = (angle_diff < 0.6) & (r > 0.25) & (r < 0.85)
        wv_k[dry_slot] += 28.0
        wv_k = np.clip(wv_k, 195.0, 265.0)

        # 5. Channel 2: Microwave (89 GHz) Convective Slicing
        mw_convection = np.zeros((size, size), dtype=np.float32)
        if is_mature:
            eyewall_ring = (r >= eye_radius_norm * 0.8) & (r <= eye_radius_norm * 2.0)
            mw_convection[eyewall_ring] = 0.90 + 0.10 * np.sin(theta[eyewall_ring] * 4.0)
        mw_convection[cdo_mask] += 0.45 * spiral_intensity[cdo_mask]
        mw_convection = np.clip(mw_convection + np.random.normal(0, 0.05, size=(size, size)), 0.0, 1.0)

        # 6. Channel 3: Visible Albedo (0.65 µm)
        vis_albedo = np.clip(1.0 - (tb_k - 185.0) / 115.0, 0.05, 0.98)
        if is_mature:
            vis_albedo[r < eye_radius_norm * 0.7] = 0.12

        # Normalize all channels to standard float32 [0.0, 1.0]
        norm_ir = 1.0 - normalize_channel_tensor(tb_k, 185.0, 305.0)
        norm_wv = 1.0 - normalize_channel_tensor(wv_k, 195.0, 265.0)
        norm_mw = mw_convection.astype(np.float32)
        norm_vis = vis_albedo.astype(np.float32)

        return {
            "ir_tb_k": tb_k,
            "wv_k": wv_k,
            "mw": mw_convection,
            "vis": vis_albedo,
            "normalized_tensor_4ch": np.stack([norm_ir, norm_wv, norm_mw, norm_vis], axis=0),
        }


class SatelliteFeatureExtractor:
    """Extracts atmospheric features used in Automated Dvorak Technique (ADT)."""

    @staticmethod
    def extract_dvorak_features(tb_k: np.ndarray) -> Dict[str, Union[float, str]]:
        """Calculate quantitative Dvorak metrics from infrared Brightness Temperature grid."""
        size = tb_k.shape[0]
        center = size // 2
        
        eye_patch = tb_k[center - 7 : center + 8, center - 7 : center + 8]
        warmest_eye_tb = float(np.max(eye_patch))

        y, x = np.ogrid[:size, :size]
        r = np.sqrt((x - center) ** 2 + (y - center) ** 2)
        eyewall_mask = (r >= 12) & (r <= 42)
        coldest_eyewall_tb = float(np.min(tb_k[eyewall_mask])) if np.any(eyewall_mask) else float(np.min(tb_k))

        tb_contrast = round(warmest_eye_tb - coldest_eyewall_tb, 1)

        cdo_mask = tb_k <= 225.0
        circularity = 0.85
        if np.any(cdo_mask):
            area = float(np.sum(cdo_mask))
            perimeter = float(np.sum(np.diff(cdo_mask.astype(int), axis=0) != 0) + np.sum(np.diff(cdo_mask.astype(int), axis=1) != 0))
            if perimeter > 0:
                circularity = round(min(1.0, (4 * np.pi * area) / (perimeter ** 2)), 3)

        ci_score = 1.0
        if coldest_eyewall_tb <= 200.0 and tb_contrast >= 40.0:
            ci_score = 5.5 + min(2.5, (tb_contrast - 40.0) / 20.0)
        elif coldest_eyewall_tb <= 215.0:
            ci_score = 4.0 + (215.0 - coldest_eyewall_tb) / 15.0
        elif coldest_eyewall_tb <= 235.0:
            ci_score = 2.5 + (235.0 - coldest_eyewall_tb) / 20.0
        else:
            ci_score = 1.5 + max(0.0, (260.0 - coldest_eyewall_tb) / 25.0)

        ci_number = round(min(8.0, max(1.0, ci_score)), 1)

        return {
            "warmest_eye_k": round(warmest_eye_tb, 1),
            "coldest_eyewall_k": round(coldest_eyewall_tb, 1),
            "eye_eyewall_contrast_k": tb_contrast,
            "cdo_circularity": circularity,
            "automated_dvorak_ci": ci_number,
            "dvorak_t_number": f"T{ci_number}",
        }
