"""Local persistence and caching engine for CYCLONEX.

Stores scenarios, GeoJSON risk grids, OpenStreetMap building footprints,
and land-use zone polygons in an embedded SQLite database.
Prevents in-memory eviction 404s and protects against Overpass API rate limits.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent / "cyclonex_data.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize database tables with WAL mode for fast concurrent reads."""
    with get_connection() as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS scenarios (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                name TEXT,
                center_lat REAL,
                center_lon REAL,
                input_json TEXT NOT NULL,
                basin TEXT,
                ocean_node_json TEXT,
                model_json TEXT,
                summary_json TEXT,
                risk_grid_json TEXT,
                ml_provenance_json TEXT
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS building_cache (
                bbox_key TEXT PRIMARY KEY,
                geojson_str TEXT NOT NULL,
                cached_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS zone_cache (
                bbox_key TEXT PRIMARY KEY,
                geojson_str TEXT NOT NULL,
                cached_at TEXT NOT NULL
            );
            """
        )
        conn.commit()


def save_scenario(record: dict[str, Any]) -> None:
    scenario_id = record["id"]
    created_at = record.get("created_at", datetime.now(timezone.utc).isoformat())
    inp = record.get("input", {})
    name = inp.get("name", "")
    center_lat = inp.get("center_lat")
    center_lon = inp.get("center_lon")
    basin = record.get("basin")
    ocean_node = record.get("ocean_node")
    model = record.get("model", {})
    risk_grid = record.get("risk_grid", {})
    summary = risk_grid.get("summary", {})
    ml_provenance = record.get("ml_provenance")

    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO scenarios (
                id, created_at, name, center_lat, center_lon,
                input_json, basin, ocean_node_json, model_json,
                summary_json, risk_grid_json, ml_provenance_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                scenario_id,
                created_at,
                name,
                center_lat,
                center_lon,
                json.dumps(inp),
                basin,
                json.dumps(ocean_node) if ocean_node else None,
                json.dumps(model) if model else None,
                json.dumps(summary),
                json.dumps(risk_grid),
                json.dumps(ml_provenance) if ml_provenance else None,
            ),
        )
        conn.commit()


def get_scenario(scenario_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT id, created_at, input_json, basin, ocean_node_json,
                   model_json, summary_json, risk_grid_json, ml_provenance_json
            FROM scenarios WHERE id = ?;
            """,
            (scenario_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        risk_grid = json.loads(row["risk_grid_json"]) if row["risk_grid_json"] else {}
        return {
            "id": row["id"],
            "created_at": row["created_at"],
            "input": json.loads(row["input_json"]) if row["input_json"] else {},
            "basin": row["basin"],
            "ocean_node": json.loads(row["ocean_node_json"]) if row["ocean_node_json"] else None,
            "model": json.loads(row["model_json"]) if row["model_json"] else {},
            "risk_grid": risk_grid,
            "ml_provenance": json.loads(row["ml_provenance_json"]) if row["ml_provenance_json"] else None,
        }


def get_scenario_risk_grid(scenario_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT risk_grid_json FROM scenarios WHERE id = ?;", (scenario_id,)
        )
        row = cursor.fetchone()
        if not row or not row["risk_grid_json"]:
            return None
        return json.loads(row["risk_grid_json"])


def _bbox_key(south: float, west: float, north: float, east: float) -> str:
    return f"{round(south, 3)}_{round(west, 3)}_{round(north, 3)}_{round(east, 3)}"


def get_cached_buildings(south: float, west: float, north: float, east: float) -> dict[str, Any] | None:
    key = _bbox_key(south, west, north, east)
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT geojson_str FROM building_cache WHERE bbox_key = ?;", (key,)
        )
        row = cursor.fetchone()
        if row and row["geojson_str"]:
            return json.loads(row["geojson_str"])
    return None


def save_cached_buildings(south: float, west: float, north: float, east: float, data: dict[str, Any]) -> None:
    key = _bbox_key(south, west, north, east)
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO building_cache (bbox_key, geojson_str, cached_at) VALUES (?, ?, ?);",
            (key, json.dumps(data), now),
        )
        conn.commit()


def get_cached_zones(south: float, west: float, north: float, east: float) -> dict[str, Any] | None:
    key = _bbox_key(south, west, north, east)
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT geojson_str FROM zone_cache WHERE bbox_key = ?;", (key,)
        )
        row = cursor.fetchone()
        if row and row["geojson_str"]:
            return json.loads(row["geojson_str"])
    return None


def save_cached_zones(south: float, west: float, north: float, east: float, data: dict[str, Any]) -> None:
    key = _bbox_key(south, west, north, east)
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO zone_cache (bbox_key, geojson_str, cached_at) VALUES (?, ?, ?);",
            (key, json.dumps(data), now),
        )
        conn.commit()


# Initialize on import
init_db()
