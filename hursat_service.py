"""HURSAT-B1 Satellite Observation Ingestion and Sequence Sample Builder.

NOAA HURSAT-B1 provides storm-centred satellite IR and visible imagery extracts.
This service parses HURSAT observation metadata, binds satellite scenes to
authoritative IBTrACS labels by storm ID and timestamp, and builds storm-centred
time-sequence samples for baseline ML model training.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal

from ml_registry import (
    BEST_TRACK_LABELS,
    OBSERVATIONS,
    register_observation,
    register_sample,
)
from ml_schema import BestTrackLabel, SatelliteObservation, SatelliteSource, TrainingSample


def create_hursat_observation(
    product: str,
    acquired_at: datetime,
    centre_lat: float,
    centre_lon: float,
    asset_url: str,
    channels: list[str] | None = None,
    box_size_deg: float = 4.0,
    spatial_resolution_km: float = 8.0,
    preprocessing_version: str = "hursat_b1_v06_cropped",
    checksum_sha256: str | None = None,
) -> SatelliteObservation:
    """Build a validated storm-centred HURSAT-B1 observation."""
    half_box = box_size_deg / 2.0
    west = max(-180.0, centre_lon - half_box)
    east = min(180.0, centre_lon + half_box)
    south = max(-90.0, centre_lat - half_box)
    north = min(90.0, centre_lat + half_box)

    if channels is None:
        channels = ["IR_WINDBAND"]

    return SatelliteObservation(
        source=SatelliteSource.HURSAT_B1,
        product=product,
        acquired_at=acquired_at,
        asset_url=asset_url, # type: ignore
        checksum_sha256=checksum_sha256,
        west=west,
        south=south,
        east=east,
        north=north,
        spatial_resolution_km=spatial_resolution_km,
        channels=channels,
        preprocessing_version=preprocessing_version,
    )


def get_labels_for_storm(storm_id: str) -> list[BestTrackLabel]:
    """Retrieve all imported best-track labels for a specific storm ID, sorted by timestamp."""
    labels = [
        label for label in BEST_TRACK_LABELS.values() if label.storm_id == storm_id
    ]
    return sorted(labels, key=lambda l: l.valid_at)


def get_observations_for_storm(
    storm_id: str, start_time: datetime, end_time: datetime
) -> list[str]:
    """Find registered observation IDs matching a storm window."""
    matching_ids: list[str] = []
    for obs_id, obs in OBSERVATIONS.items():
        if start_time <= obs.acquired_at <= end_time:
            matching_ids.append(obs_id)
    return matching_ids


def generate_storm_sequence_samples(
    storm_id: str,
    split: Literal["train", "validation", "test"],
    sequence_hours: int = 24,
    notes: str | None = None,
) -> list[TrainingSample]:
    """Generate and register storm-centred sequence samples for training/validation/testing."""
    labels = get_labels_for_storm(storm_id)
    if not labels:
        raise ValueError(f"No best-track labels found for storm ID '{storm_id}'.")

    created_samples: list[TrainingSample] = []
    window = timedelta(hours=sequence_hours)

    for label in labels:
        start_time = label.valid_at - window
        obs_ids = get_observations_for_storm(storm_id, start_time, label.valid_at)
        if not obs_ids:
            continue

        timestamp_str = label.valid_at.strftime("%Y%m%dT%H%M%SZ")
        sample_id = f"sample_{storm_id}_{timestamp_str}_{sequence_hours}h"

        # Cap at 12 observations per sample as constrained by TrainingSample schema
        selected_obs_ids = obs_ids[-12:]

        sample = TrainingSample(
            sample_id=sample_id,
            storm_id=storm_id,
            target_time=label.valid_at,
            observation_ids=selected_obs_ids,
            label=label,
            split=split,
            sequence_hours=sequence_hours,
            notes=notes or f"Generated {sequence_hours}h sequence for storm {storm_id}",
        )
        stored_sample = register_sample(sample)
        created_samples.append(stored_sample)

    return created_samples
