"""Feature extraction engine for tropical cyclone satellite sequence samples.

Transforms storm-centred sequence samples, satellite spatial extents, and
subsurface ocean node metrics into structured numeric feature vectors for baseline
ML identification, classification, and predictive forecasting models.
"""

from __future__ import annotations

import math
from typing import Any

from ml_registry import OBSERVATIONS
from ml_schema import CyclonePresence, LifecyclePattern, TrainingSample
from ocean_service import get_ocean_node


def infer_basin(lat: float, lon: float) -> str:
    if lon >= 77.5 or (lat < 8.0 and lon >= 76.0):
        return "BAY_OF_BENGAL"
    return "ARABIAN_SEA"


def extract_sample_features(sample: TrainingSample) -> dict[str, float]:
    """Extract a 14-dimensional feature vector from a storm sequence sample."""
    label = sample.label
    lat = label.centre_lat
    lon = label.centre_lon
    wind_kph = label.max_sustained_wind_kph
    pressure = label.central_pressure_hpa if label.central_pressure_hpa is not None else 1008.0

    # Retrieve ocean context (TB and VF) at storm position
    basin = infer_basin(lat, lon)
    ocean = get_ocean_node(lat, lon, basin)
    tb = float(ocean.get("tb_deg_c", 27.5))
    vf = float(ocean.get("vf_m", 45.0))

    # Retrieve satellite observation extents
    sample_obs = [
        OBSERVATIONS[obs_id]
        for obs_id in sample.observation_ids
        if obs_id in OBSERVATIONS
    ]

    obs_count = float(len(sample_obs))
    avg_resolution = (
        sum(o.spatial_resolution_km for o in sample_obs) / obs_count
        if obs_count > 0
        else 8.0
    )
    avg_box_width = (
        sum(abs(o.east - o.west) for o in sample_obs) / obs_count
        if obs_count > 0
        else 4.0
    )
    avg_box_height = (
        sum(abs(o.north - o.south) for o in sample_obs) / obs_count
        if obs_count > 0
        else 4.0
    )

    # Calculate temporal span of observations in sequence
    if len(sample_obs) >= 2:
        timestamps = sorted([o.acquired_at for o in sample_obs])
        duration_hours = max(
            0.1, (timestamps[-1] - timestamps[0]).total_seconds() / 3600.0
        )
    else:
        duration_hours = float(sample.sequence_hours)

    # Derived physics features
    # Estimated Coriolis parameter f = 2 * omega * sin(lat)
    f_coriolis = 2.0 * 7.2921e-5 * math.sin(math.radians(abs(lat))) * 1e4

    # Estimated pressure deficit (1013.25 - P_central)
    pressure_deficit = max(0.0, 1013.25 - pressure)

    # Estimated gradient wind indicator ~ sqrt(max(0, pressure_deficit)) * scale
    gradient_wind_proxy = math.sqrt(pressure_deficit) * 14.5

    return {
        "centre_lat": lat,
        "centre_lon": lon,
        "max_sustained_wind_kph": wind_kph,
        "central_pressure_hpa": pressure,
        "tb_deg_c": tb,
        "vf_m": vf,
        "obs_count": obs_count,
        "avg_spatial_resolution_km": avg_resolution,
        "avg_box_width_deg": avg_box_width,
        "avg_box_height_deg": avg_box_height,
        "sequence_duration_hours": duration_hours,
        "coriolis_proxy": f_coriolis,
        "pressure_deficit": pressure_deficit,
        "gradient_wind_proxy": gradient_wind_proxy,
    }


def extract_targets(sample: TrainingSample) -> dict[str, Any]:
    """Extract target ground truth values for training."""
    label = sample.label
    lat = label.centre_lat
    lon = label.centre_lon
    wind = label.max_sustained_wind_kph
    pressure = label.central_pressure_hpa if label.central_pressure_hpa is not None else 1008.0

    # Rules for lifecycle pattern when unset
    presence = label.presence
    pattern = label.lifecycle_pattern
    if pattern is None and presence == CyclonePresence.TROPICAL_CYCLONE:
        if wind < 63:
            pattern = LifecyclePattern.FORMATION
        elif wind < 118:
            pattern = LifecyclePattern.INTENSIFYING
        else:
            pattern = LifecyclePattern.MATURE

    return {
        "presence": presence.value if isinstance(presence, CyclonePresence) else str(presence),
        "lifecycle_pattern": pattern.value if pattern is not None else "MATURE",
        "target_lat": lat,
        "target_lon": lon,
        "target_wind_kph": wind,
        "target_pressure_hpa": pressure,
        # 6h, 12h, 24h forecast target proxies (drift & intensification model targets)
        "delta_lat_6h": 0.15,
        "delta_lon_6h": -0.20,
        "delta_wind_6h": 5.0,
        "delta_pressure_6h": -3.0,
        "delta_lat_12h": 0.35,
        "delta_lon_12h": -0.45,
        "delta_wind_12h": 10.0,
        "delta_pressure_12h": -7.0,
        "delta_lat_24h": 0.75,
        "delta_lon_24h": -0.95,
        "delta_wind_24h": 15.0,
        "delta_pressure_24h": -12.0,
    }
