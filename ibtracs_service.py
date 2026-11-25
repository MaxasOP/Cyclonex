"""Parser for bounded IBTrACS CSV extracts.

IBTrACS CSV has a first row of names and a second row of units. This parser
uses only traceable position/intensity columns and preserves the source URL.
"""

from __future__ import annotations

import csv
import math
from io import StringIO

from ml_schema import BestTrackLabel, CyclonePresence, IBTracsCsvImport


def _number(row: dict[str, str], *columns: str) -> float | None:
    for column in columns:
        value = (row.get(column) or "").strip()
        if value:
            try:
                number = float(value)
                if math.isfinite(number) and number != -9999:
                    return number
            except ValueError:
                continue
    return None


def parse_ibtracs_csv(import_request: IBTracsCsvImport) -> list[BestTrackLabel]:
    rows = csv.DictReader(StringIO(import_request.csv_text.lstrip("\ufeff")))
    required = {"SID", "BASIN", "ISO_TIME", "LAT", "LON"}
    if not required.issubset(rows.fieldnames or ()):
        raise ValueError("IBTrACS extract requires SID, BASIN, ISO_TIME, LAT and LON columns")

    labels: list[BestTrackLabel] = []
    for row in rows:
        if import_request.basin != (row.get("BASIN") or "").strip():
            continue
        storm_id = (row.get("SID") or "").strip()
        valid_at = (row.get("ISO_TIME") or "").strip()
        lat = _number(row, "LAT")
        lon = _number(row, "LON")
        imd_wind = _number(row, "NEWDELHI_WIND")
        wmo_wind = _number(row, "WMO_WIND")
        if imd_wind is not None:
            wind, pressure, authority = imd_wind, _number(row, "NEWDELHI_PRES"), "IMD"
        elif wmo_wind is not None:
            wind, pressure, authority = wmo_wind, _number(row, "WMO_PRES"), "IBTRACS"
        else:
            wind, pressure, authority = _number(row, "USA_WIND"), _number(row, "USA_PRES"), "IBTRACS"
        if not storm_id or not valid_at or lat is None or lon is None or wind is None:
            continue
        nature = (row.get("NATURE") or "").strip()
        if nature in {"ET", "SS", "MX", "NR"}:
            continue  # No unambiguous tropical label at this time.
        depression = (row.get("NEWDELHI_GRADE") or "").strip() in {"D", "DD"}
        disturbance = nature == "DS" or depression or wind < 34
        labels.append(
            BestTrackLabel(
                storm_id=storm_id,
                valid_at=valid_at,
                centre_lat=lat,
                centre_lon=lon,
                max_sustained_wind_kph=wind * 1.852,
                central_pressure_hpa=pressure,
                presence=CyclonePresence.TROPICAL_DISTURBANCE if disturbance else CyclonePresence.TROPICAL_CYCLONE,
                intensity_authority=authority,
                source_url=import_request.source_url,
            )
        )
    return labels
