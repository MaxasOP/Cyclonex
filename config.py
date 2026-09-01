"""Runtime configuration for optional CYCLONEX integrations.

Secrets are read only from environment variables. This module deliberately
contains no defaults for credentials, so missing integrations are visible.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    grid_size_m: int = int(os.getenv("GRID_SIZE_M", "200"))
    wind_incidence_angle_deg: float = float(
        os.getenv("WIND_INCIDENCE_ANGLE_DEG", "90")
    )
    google_maps_browser_api_key: str | None = os.getenv(
        "GOOGLE_MAPS_BROWSER_API_KEY"
    ) or None
    google_maps_server_api_key: str | None = os.getenv(
        "GOOGLE_MAPS_SERVER_API_KEY"
    ) or None
    cyclone_forecast_api_key: str | None = os.getenv(
        "CYCLONE_FORECAST_API_KEY"
    ) or None
    cyclone_forecast_base_url: str | None = os.getenv(
        "CYCLONE_FORECAST_BASE_URL"
    ) or None
    database_url: str | None = os.getenv("DATABASE_URL") or None
    cors_allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )

    def validate(self) -> None:
        if self.grid_size_m != 200:
            raise ValueError("GRID_SIZE_M must be exactly 200 for this release.")
        if self.wind_incidence_angle_deg != 90:
            raise ValueError(
                "WIND_INCIDENCE_ANGLE_DEG must be exactly 90 for this release."
            )


settings = Settings()
settings.validate()
