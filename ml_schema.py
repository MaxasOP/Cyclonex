"""Versioned data contracts for satellite-based cyclone ML training/inference."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, HttpUrl, field_validator, model_validator


def _as_utc(value: datetime) -> datetime:
    # IBTrACS and HURSAT use UTC, including source strings without an offset.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


UtcDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class SatelliteSource(StrEnum):
    HURSAT_B1 = "HURSAT_B1"
    INSAT = "INSAT"
    GPM_IMERG = "GPM_IMERG"
    SENTINEL_1 = "SENTINEL_1"
    HYCOM = "HYCOM"


class LifecyclePattern(StrEnum):
    FORMATION = "FORMATION"
    INTENSIFYING = "INTENSIFYING"
    MATURE = "MATURE"
    WEAKENING = "WEAKENING"
    LANDFALLING = "LANDFALLING"


class CyclonePresence(StrEnum):
    NO_CYCLONE = "NO_CYCLONE"
    TROPICAL_DISTURBANCE = "TROPICAL_DISTURBANCE"
    TROPICAL_CYCLONE = "TROPICAL_CYCLONE"


class SatelliteObservation(BaseModel):
    """One source product that can join a storm-centred ML sample."""

    source: SatelliteSource
    product: str = Field(min_length=2, max_length=100)
    acquired_at: UtcDateTime
    storm_id: str | None = Field(default=None, min_length=2, max_length=80)
    asset_url: HttpUrl
    checksum_sha256: str | None = Field(default=None, pattern=r"^[a-fA-F0-9]{64}$")
    west: float = Field(ge=-180, le=180)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    north: float = Field(ge=-90, le=90)
    spatial_resolution_km: float = Field(gt=0, le=100)
    channels: list[str] = Field(min_length=1, max_length=20)
    preprocessing_version: str = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def validate_extent(self) -> "SatelliteObservation":
        if self.south >= self.north:
            raise ValueError("south must be below north")
        if self.west >= self.east:
            raise ValueError("west must be west of east; antimeridian products must be split")
        return self


class BestTrackLabel(BaseModel):
    """Supervised truth label from an authoritative best-track dataset."""

    storm_id: str = Field(min_length=2, max_length=80)
    valid_at: UtcDateTime
    centre_lat: float = Field(ge=-90, le=90)
    centre_lon: float = Field(ge=-180, le=180)
    max_sustained_wind_kph: float = Field(ge=0, le=400)
    central_pressure_hpa: float | None = Field(default=None, ge=800, le=1050)
    presence: CyclonePresence
    lifecycle_pattern: LifecyclePattern | None = None
    intensity_authority: Literal["IMD", "JTWC", "IBTRACS"]
    source_url: HttpUrl

    @field_validator("lifecycle_pattern")
    @classmethod
    def lifecycle_requires_cyclone(
        cls, value: LifecyclePattern | None, info
    ) -> LifecyclePattern | None:
        if value is not None and info.data.get("presence") != CyclonePresence.TROPICAL_CYCLONE:
            raise ValueError("lifecycle_pattern is valid only for TROPICAL_CYCLONE labels")
        return value


class TrainingSample(BaseModel):
    """A storm-centred, time-aligned sample. Images must be registered first."""

    sample_id: str = Field(min_length=8, max_length=100)
    storm_id: str = Field(min_length=2, max_length=80)
    target_time: UtcDateTime
    source_kind: Literal["SATELLITE_SEQUENCE", "BEST_TRACK_STATE"] = "SATELLITE_SEQUENCE"
    observation_ids: list[str] = Field(max_length=12)
    label: BestTrackLabel
    split: Literal["train", "validation", "test"]
    sequence_hours: int = Field(ge=6, le=48)
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def ensure_same_storm(self) -> "TrainingSample":
        if self.storm_id != self.label.storm_id:
            raise ValueError("sample storm_id must match its best-track label")
        if self.target_time != self.label.valid_at:
            raise ValueError("target_time must match the label timestamp")
        if self.source_kind == "SATELLITE_SEQUENCE" and not self.observation_ids:
            raise ValueError("a satellite sequence requires registered observations")
        if self.source_kind == "BEST_TRACK_STATE" and self.observation_ids:
            raise ValueError("a best-track state contains only its label")
        if len(set(self.observation_ids)) != len(self.observation_ids):
            raise ValueError("observation_ids must be unique within a sample")
        return self


class IBTracsCsvImport(BaseModel):
    """A bounded CSV extract, normally the North Indian IBTrACS subset."""

    csv_text: str = Field(min_length=50, max_length=5_000_000)
    basin: Literal["NI"] = "NI"
    source_url: HttpUrl
