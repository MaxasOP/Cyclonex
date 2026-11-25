"""Feature extraction engine for tropical cyclone satellite sequence samples.

Transforms storm-centred sequence samples, satellite spatial extents, and
subsurface ocean node metrics into structured numeric feature vectors for baseline
ML identification, classification, and predictive forecasting models.
"""

from __future__ import annotations

import math
from datetime import timedelta
from typing import Any

from ml_registry import OBSERVATIONS, BEST_TRACK_LABELS
from ml_schema import BestTrackLabel, TrainingSample
from ocean_service import get_ocean_node


def infer_basin(lat: float, lon: float) -> str:
    if lon >= 77.5 or (lat < 8.0 and lon >= 76.0):
        return "BAY_OF_BENGAL"
    return "ARABIAN_SEA"


def in_forecast_domain(lat: float, lon: float) -> bool:
    return 0 <= lat <= 30 and 45 <= lon <= 100


def ocean_features(lat: float, lon: float) -> dict[str, float]:
    from geo import land_mask

    if not in_forecast_domain(lat, lon) or land_mask(lat, lon).item():
        return {}
    ocean = get_ocean_node(lat, lon, infer_basin(lat, lon), live_first=False)
    return {
        "tb_deg_c": float(ocean["TB"][0]),
        "vf_m": float(ocean["VF"]["depth_of_26c_isotherm_m"]),
    }


def previous_motion(label: BestTrackLabel) -> tuple[float, float]:
    """Estimate motion only from reports available before forecast issuance."""
    for hours in (6, 3, 9, 12):
        when = label.valid_at - timedelta(hours=hours)
        previous = BEST_TRACK_LABELS.get(f"{label.storm_id}:{when.isoformat()}")
        if previous is None:
            continue
        phi1, phi2 = map(math.radians, (previous.centre_lat, label.centre_lat))
        dlon = math.radians(label.centre_lon - previous.centre_lon)
        east = math.sin(dlon) * math.cos(phi2)
        north = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlon)
        arc = math.atan2(math.hypot(east, north), math.sin(phi1) * math.sin(phi2) + math.cos(phi1) * math.cos(phi2) * math.cos(dlon))
        return math.degrees(math.atan2(east, north)) % 360, 6371.0088 * arc / hours
    return 0.0, 0.0


def extract_sample_features(sample: TrainingSample) -> dict[str, float]:
    """Extract a 14-dimensional feature vector from a storm sequence sample."""
    label = sample.label
    lat = label.centre_lat
    lon = label.centre_lon
    wind_kph = label.max_sustained_wind_kph
    pressure = label.central_pressure_hpa if label.central_pressure_hpa is not None else 1008.0

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
        else 0.0
    )
    avg_box_width = (
        sum(abs(o.east - o.west) for o in sample_obs) / obs_count
        if obs_count > 0
        else 0.0
    )
    avg_box_height = (
        sum(abs(o.north - o.south) for o in sample_obs) / obs_count
        if obs_count > 0
        else 0.0
    )

    # Calculate temporal span of observations in sequence
    if len(sample_obs) >= 2:
        timestamps = sorted([o.acquired_at for o in sample_obs])
        duration_hours = max(
            0.1, (timestamps[-1] - timestamps[0]).total_seconds() / 3600.0
        )
    else:
        duration_hours = 0.0

    # Derived physics features
    # Estimated Coriolis parameter f = 2 * omega * sin(lat)
    f_coriolis = 2.0 * 7.2921e-5 * math.sin(math.radians(abs(lat))) * 1e4

    # Estimated pressure deficit (1013.25 - P_central)
    pressure_deficit = max(0.0, 1013.25 - pressure)

    # Estimated gradient wind indicator ~ sqrt(max(0, pressure_deficit)) * scale
    gradient_wind_proxy = math.sqrt(pressure_deficit) * 14.5

    heading_val, speed_val = previous_motion(label)

    from risk_service import _is_land
    is_land_val = 1.0 if _is_land(lat, lon) else 0.0

    heading_rad = math.radians(heading_val % 360.0)
    u_trans = speed_val * math.sin(heading_rad)
    v_trans = speed_val * math.cos(heading_rad)

    return {
        "centre_lat": lat,
        "centre_lon": lon,
        "max_sustained_wind_kph": wind_kph,
        "central_pressure_hpa": pressure,
        "heading_deg": heading_val,
        "speed_kph": speed_val,
        "u_trans_kph": u_trans,
        "v_trans_kph": v_trans,
        "is_land_flag": is_land_val,
        **ocean_features(lat, lon),
        "obs_count": obs_count,
        "avg_spatial_resolution_km": avg_resolution,
        "avg_box_width_deg": avg_box_width,
        "avg_box_height_deg": avg_box_height,
        "sequence_duration_hours": duration_hours,
        "coriolis_proxy": f_coriolis,
        "pressure_deficit": pressure_deficit,
        "gradient_wind_proxy": gradient_wind_proxy,
    }


def extract_targets(sample: TrainingSample) -> dict[str, Any] | None:
    """Use same-storm observations at the exact forecast horizons; skip incomplete cases."""
    current = sample.label
    if current.central_pressure_hpa is None:
        return None
    targets = {
        "presence": current.presence.value,
        "lifecycle_pattern": current.lifecycle_pattern.value if current.lifecycle_pattern else None,
        "target_lat": current.centre_lat,
        "target_lon": current.centre_lon,
        "target_wind_kph": current.max_sustained_wind_kph,
        "target_pressure_hpa": current.central_pressure_hpa,
    }
    for hours in (6, 12, 24):
        when = current.valid_at + timedelta(hours=hours)
        future = BEST_TRACK_LABELS.get(f"{current.storm_id}:{when.isoformat()}")
        if future is None or future.central_pressure_hpa is None:
            return None
        targets[f"delta_lat_{hours}h"] = future.centre_lat - current.centre_lat
        targets[f"delta_lon_{hours}h"] = (future.centre_lon - current.centre_lon + 180) % 360 - 180
        targets[f"delta_wind_{hours}h"] = future.max_sustained_wind_kph - current.max_sustained_wind_kph
        targets[f"delta_pressure_{hours}h"] = future.central_pressure_hpa - current.central_pressure_hpa
    return targets
