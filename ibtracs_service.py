"""Parser for bounded IBTrACS CSV extracts.

IBTrACS CSV has a first row of names and a second row of units. This parser
uses only traceable position/intensity columns and preserves the source URL.
"""

from __future__ import annotations

import csv
from io import StringIO

from ml_schema import BestTrackLabel, CyclonePresence, IBTracsCsvImport


def _number(row: dict[str, str], *columns: str) -> float | None:
    for column in columns:
        value = (row.get(column) or "").strip()
        if value:
            try:
                return float(value)
            except ValueError:
                continue
    return None


def parse_ibtracs_csv(import_request: IBTracsCsvImport) -> list[BestTrackLabel]:
    rows = list(csv.DictReader(StringIO(import_request.csv_text)))
    if rows and (rows[0].get("SID") or "").strip().lower() in {"units", ""}:
        rows = rows[1:]

    labels: list[BestTrackLabel] = []
    for row in rows:
        if import_request.basin not in (row.get("BASIN") or ""):
            continue
        storm_id = (row.get("SID") or "").strip()
        valid_at = (row.get("ISO_TIME") or "").strip()
        lat = _number(row, "LAT")
        lon = _number(row, "LON")
        wind = _number(row, "WMO_WIND", "USA_WIND")
        if not storm_id or not valid_at or lat is None or lon is None or wind is None:
            continue
        pressure = _number(row, "WMO_PRES", "USA_PRES")
        normalized_time = valid_at.replace(" ", "T")
        if not normalized_time.endswith("Z") and "+" not in normalized_time[10:]:
            normalized_time += "Z"
        labels.append(
            BestTrackLabel(
                storm_id=storm_id,
                valid_at=normalized_time,
                centre_lat=lat,
                centre_lon=lon,
                max_sustained_wind_kph=wind * 1.852,
                central_pressure_hpa=pressure,
                presence=CyclonePresence.TROPICAL_CYCLONE,
                intensity_authority="IBTRACS",
                source_url=import_request.source_url,
            )
        )
    return labels
