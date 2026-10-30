import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests

ERDDAP_BASE = os.getenv("HYCOM_ERDDAP_URL", "https://oos.soest.hawaii.edu/erddap/griddap/HYCOM_Global_3D.json")
HYCOM_NCSS_URL = os.getenv("HYCOM_NCSS_URL", "https://ncss.hycom.org/thredds/ncss/grid/GLBy0.08/latest")
TB_DEPTHS = [0, 10, 50, 100, 200, 300, 500, 700]
HYCOM_DEPTH_LEVELS = [
    0, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
    100, 125, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000
]
# Fast connection timeout (1s connect, 2s read) for rapid fallback
REQUEST_TIMEOUT = (1.0, 2.0)

SEAWATER_DENSITY_KG_M3 = 1025
SEAWATER_SPECIFIC_HEAT_J_KGC = 3993
OHC_THRESHOLD_C = 26.0


def _linear_interp(x_target: float, x_arr: list, y_arr: list) -> float:
    for i in range(len(x_arr) - 1):
        if x_arr[i] <= x_target <= x_arr[i + 1]:
            dx = x_arr[i + 1] - x_arr[i]
            if dx == 0:
                return float(y_arr[i])
            frac = (x_target - x_arr[i]) / dx
            return float(y_arr[i] + frac * (y_arr[i + 1] - y_arr[i]))
    return float(y_arr[-1] if x_target >= x_arr[-1] else y_arr[0])


def _trapezoidal_integral(x_arr: list, y_arr: list) -> float:
    integral = 0.0
    for i in range(len(x_arr) - 1):
        dx = x_arr[i + 1] - x_arr[i]
        integral += dx * (y_arr[i] + y_arr[i + 1]) / 2.0
    return integral


def _nearest_hycom_depth(target_m: float) -> float:
    return min(HYCOM_DEPTH_LEVELS, key=lambda d: abs(d - target_m))


def _latest_available_time_iso() -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=1)
    return dt.strftime("%Y-%m-%dT00:00:00Z")


def _fetch_hycom_point(lat: float, lon: float, depth_m: float, variable: str) -> Optional[float]:
    time_iso = _latest_available_time_iso()
    depth_snap = _nearest_hycom_depth(depth_m)
    query = f"{variable}[({time_iso})][({depth_snap})][({lat})][({lon})]"
    url = f"{ERDDAP_BASE}?{query}"

    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        value = data["table"]["rows"][0][-1]
        return float(value) if value is not None else None
    except Exception:
        return None


def _fetch_ncss_profile(lat: float, lon: float) -> Optional[dict]:
    import csv
    import io
    def fetch(depth):
        try:
            response = requests.get(HYCOM_NCSS_URL,
                params=[("var", "water_temp"), ("var", "salinity"), ("latitude", lat), ("longitude", lon),
                        ("time", "present"), ("vertCoord", depth), ("accept", "csv")], timeout=(3, 12))
            response.raise_for_status()
            rows = list(csv.reader(io.StringIO(response.text)))
            if len(rows) < 2:
                return None
            names = [h.split("[")[0].strip() for h in rows[0]]
            row = dict(zip(names, rows[1]))
            temperature, salinity = float(row["water_temp"]), float(row["salinity"])
            if not (-3 <= temperature <= 40 and 0 <= salinity <= 45):
                return None
            return depth, temperature, salinity, row["time"]
        except (requests.RequestException, ValueError, KeyError, IndexError):
            return None
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(fetch, TB_DEPTHS))
    rows = [row for row in rows if row is not None]
    if len(rows) < 4 or 0 not in {row[0] for row in rows} or 700 not in {row[0] for row in rows}:
        return None
    # A profile must come from one model time, not mixed provider updates.
    if len({row[3] for row in rows}) != 1:
        return None
    depths = [r[0] for r in rows]
    return {"source": "LIVE", "provider": "HYCOM GOFS / NCSS Global Analysis",
            "sampled_depths_m": depths, "interpolated_depths_m": [d for d in TB_DEPTHS if d not in depths],
            "temperature_c": {d: round(_linear_interp(d, depths, [r[1] for r in rows]), 2) for d in TB_DEPTHS},
            "salinity_psu": {d: round(_linear_interp(d, depths, [r[2] for r in rows]), 2) for d in TB_DEPTHS},
            "observation_time": rows[0][3], "fetched_at": datetime.now(timezone.utc).isoformat()}


def fetch_live_profile(lat: float, lon: float) -> Optional[dict]:
    if not os.getenv("HYCOM_ERDDAP_URL"):
        return _fetch_ncss_profile(lat, lon)
    # ERDDAP resolves "last" to the provider's latest available model time.
    # Retrieve the column in one request, rather than ten independent point
    # requests to a guessed date that may not exist in the dataset.
    selector = f"[(last)][(0):1:(700)][({lat})][({lon})]"
    query = ",".join(variable + selector for variable in ("water_temp", "salinity"))
    try:
        response = requests.get(ERDDAP_BASE + "?" + query, timeout=(2, 6))
        response.raise_for_status()
        table = response.json()["table"]
        columns, rows = table["columnNames"], table["rows"]
        indices = {name: columns.index(name) for name in ("depth", "water_temp", "salinity", "time")}
        valid = [r for r in rows if r[indices["water_temp"]] is not None and math.isfinite(float(r[indices["water_temp"]]))]
        if not valid:
            return None
        valid.sort(key=lambda r: float(r[indices["depth"]]))
        if float(valid[-1][indices["depth"]]) < 700:
            return None
        depths = [float(r[indices["depth"]]) for r in valid]
        temps = [float(r[indices["water_temp"]]) for r in valid]
        sals = [r[indices["salinity"]] for r in valid]
        return {"source": "LIVE", "provider": "PacIOOS ERDDAP / HYCOM",
                "temperature_c": {d: round(_linear_interp(d, depths, temps), 2) for d in TB_DEPTHS},
                "salinity_psu": {d: round(_linear_interp(d, depths, [float(v) for v in sals]), 2) if all(v is not None for v in sals) else None for d in TB_DEPTHS},
                "observation_time": valid[0][indices["time"]], "fetched_at": datetime.now(timezone.utc).isoformat()}
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError):
        return None


def climatology_fallback_profile(lat: float, lon: float, basin: str) -> dict:
    surface_t = 29.6 if basin == "BAY_OF_BENGAL" else 29.1
    thermocline_onset = 35 if basin == "BAY_OF_BENGAL" else 55
    decay_rate = 0.028 if basin == "BAY_OF_BENGAL" else 0.020

    temps = {}
    for depth in TB_DEPTHS:
        if depth <= thermocline_onset:
            temps[depth] = round(surface_t - (depth / thermocline_onset) * 0.6, 2)
        else:
            excess = depth - thermocline_onset
            temps[depth] = round(
                (surface_t - 0.6) * math.exp(-decay_rate * excess / 10), 2
            )

    surface_s = 33.5 if basin == "BAY_OF_BENGAL" else 36.0
    salinities = {d: round(surface_s + (d / 200) * 1.5, 2) for d in TB_DEPTHS}

    return {
        "source": "ESTIMATED_CLIMATOLOGY",
        "provider": "Basin climatology fallback (not live telemetry)",
        "temperature_c": temps,
        "salinity_psu": salinities,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def compute_vertical_features(profile: dict) -> dict:
    depths = TB_DEPTHS
    temps = [profile["temperature_c"][d] for d in depths]
    sals = [profile["salinity_psu"][d] for d in depths]

    layer_gradients = {}
    for i in range(len(depths) - 1):
        d0, d1 = depths[i], depths[i + 1]
        t0, t1 = temps[i], temps[i + 1]
        layer_gradients[f"{d0}-{d1}m"] = round((t1 - t0) / (d1 - d0), 4)
    overall_temp_gradient = round((temps[-1] - temps[0]) / (depths[-1] - depths[0]), 4)

    overall_sal_gradient = round((sals[-1] - sals[0]) / (depths[-1] - depths[0]), 4) \
        if None not in sals else None

    ref_t = temps[1] if len(temps) > 1 else temps[0]
    mld = depths[-1]
    for i, d in enumerate(depths):
        if d <= 10:
            continue
        if ref_t - temps[i] >= 0.5:
            d_prev, t_prev = depths[i - 1], temps[i - 1]
            frac = (ref_t - 0.5 - t_prev) / (temps[i] - t_prev) if temps[i] != t_prev else 0
            mld = round(d_prev + frac * (d - d_prev), 1)
            break

    excess = [t_val - OHC_THRESHOLD_C for t_val in temps]

    d26 = float(depths[-1])
    for i in range(len(depths) - 1):
        if temps[i] > OHC_THRESHOLD_C and temps[i + 1] <= OHC_THRESHOLD_C:
            frac = (temps[i] - OHC_THRESHOLD_C) / (temps[i] - temps[i + 1])
            d26 = depths[i] + frac * (depths[i + 1] - depths[i])
            break
        if temps[i] <= OHC_THRESHOLD_C:
            d26 = float(depths[i])
            break

    integ_depths = [float(d) for d in depths if d <= d26]
    if d26 not in integ_depths:
        integ_depths.append(d26)
    integ_depths = sorted(set(integ_depths))

    integ_excess = [max(0.0, _linear_interp(d, depths, excess)) for d in integ_depths]
    heat_integral_cm = _trapezoidal_integral(integ_depths, integ_excess) if len(integ_depths) > 1 else 0.0

    ohc_kj_cm2 = round(
        SEAWATER_DENSITY_KG_M3 * SEAWATER_SPECIFIC_HEAT_J_KGC * heat_integral_cm * 1e-7, 2
    )

    return {
        "temperature_gradient_c_per_m": {
            "by_layer": layer_gradients,
            "overall_0_to_200m": overall_temp_gradient,
        },
        "salinity_gradient_psu_per_m": overall_sal_gradient,
        "ocean_heat_content_kj_cm2": ohc_kj_cm2,
        "depth_of_26c_isotherm_m": round(d26, 1),
        "mixed_layer_depth_m": mld,
    }


_OCEAN_CACHE: dict[tuple[float, float, str, bool], tuple[float, dict]] = {}


def get_ocean_node(lat: float, lon: float, basin: str, live_first: bool = True) -> dict:
    cache_key = (round(lat, 2), round(lon, 2), basin, live_first)
    if cache_key in _OCEAN_CACHE:
        cached_at, cached = _OCEAN_CACHE[cache_key]
        ttl = 900 if cached["meta"]["source"] == "LIVE" else 60
        if time.monotonic() - cached_at < ttl:
            return cached

    profile = fetch_live_profile(lat, lon) if live_first else None
    if profile is None:
        profile = climatology_fallback_profile(lat, lon, basin)

    vf = compute_vertical_features(profile)

    res = {
        "node": {"lat": lat, "lon": lon},
        "TB": profile["temperature_c"],
        "VF": vf,
        "meta": {
            "source": profile["source"],
            "provider": profile["provider"],
            "fetched_at": profile["fetched_at"],
            "salinity_psu": profile["salinity_psu"],
            "observation_time": profile.get("observation_time"),
            "profile_depth_m": max(TB_DEPTHS),
            "sampled_depths_m": profile.get("sampled_depths_m"),
            "interpolated_depths_m": profile.get("interpolated_depths_m"),
            "fallback_reason": "Live provider unavailable or profile incomplete" if profile["source"] != "LIVE" else None,
        },
    }
    _OCEAN_CACHE[cache_key] = (time.monotonic(), res)
    if len(_OCEAN_CACHE) > 256:
        _OCEAN_CACHE.pop(next(iter(_OCEAN_CACHE)))
    return res
