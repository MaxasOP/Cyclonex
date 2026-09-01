"""In-memory registry for the first ML data-ingestion milestone.

The API is deliberately storage-agnostic; this module will be swapped for
Postgres/object storage when production credentials are provisioned.
"""

from ml_schema import BestTrackLabel, SatelliteObservation, TrainingSample

OBSERVATIONS: dict[str, SatelliteObservation] = {}
SAMPLES: dict[str, TrainingSample] = {}
BEST_TRACK_LABELS: dict[str, BestTrackLabel] = {}
STORM_SPLITS: dict[str, str] = {}


def observation_id(observation: SatelliteObservation) -> str:
    return f"{observation.source}:{observation.product}:{observation.acquired_at.isoformat()}"


def register_observation(observation: SatelliteObservation) -> tuple[str, SatelliteObservation]:
    identifier = observation_id(observation)
    OBSERVATIONS[identifier] = observation
    return identifier, observation


def register_sample(sample: TrainingSample) -> TrainingSample:
    missing = [identifier for identifier in sample.observation_ids if identifier not in OBSERVATIONS]
    if missing:
        raise KeyError(f"Unknown observation IDs: {', '.join(missing)}")
    assigned_split = STORM_SPLITS.get(sample.storm_id)
    if assigned_split is not None and assigned_split != sample.split:
        raise ValueError(
            f"Storm {sample.storm_id} is already assigned to the {assigned_split} split."
        )
    STORM_SPLITS[sample.storm_id] = sample.split
    SAMPLES[sample.sample_id] = sample
    return sample


def register_best_track_labels(labels: list[BestTrackLabel]) -> int:
    for label in labels:
        identifier = f"{label.storm_id}:{label.valid_at.isoformat()}"
        BEST_TRACK_LABELS[identifier] = label
    return len(labels)
