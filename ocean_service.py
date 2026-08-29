import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests

ERDDAP_BASE = "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/hycom_global.json"
TB_DEPTHS = [0, 10, 50, 100, 200]
HYCOM_DEPTH_LEVELS = [
    0, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
    100, 125, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000
]
# Fast connection timeout (1s connect, 2s read) for rapid fallback
REQUEST_TIMEOUT = (1.0, 2.0)

SEAWATER_DENSITY_KG_M3 = 1025
SEAWATER_SPECIFIC_HEAT_J_KGC = 3850
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


def fetch_live_profile(lat: float, lon: float) -> Optional[dict]:
    temps = {}
    salinities = {}

    def _fetch_depth_data(depth: int):
        t = _fetch_hycom_point(lat, lon, depth, "water_temp")
        s = _fetch_hycom_point(lat, lon, depth, "salinity")
        return depth, t, s

    with ThreadPoolExecutor(max_workers=len(TB_DEPTHS)) as executor:
        futures = [executor.submit(_fetch_depth_data, d) for d in TB_DEPTHS]
        for future in as_completed(futures):
            try:
                depth, t, s = future.result()
                if t is None:
                    return None
                temps[depth] = round(t, 2)
                salinities[depth] = round(s, 2) if s is not None else None
            except Exception:
                return None

    if len(temps) != len(TB_DEPTHS):
        return None

    sorted_temps = {d: temps[d] for d in TB_DEPTHS}
    sorted_sals = {d: salinities[d] for d in TB_DEPTHS}

    return {
        "source": "LIVE",
        "provider": "PacIOOS ERDDAP (HYCOM Global Ocean Forecast System)",
        "temperature_c": sorted_temps,
        "salinity_psu": sorted_sals,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


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


def get_ocean_node(lat: float, lon: float, basin: str) -> dict:
    profile = fetch_live_profile(lat, lon)
    if profile is None:
        profile = climatology_fallback_profile(lat, lon, basin)

    vf = compute_vertical_features(profile)

    return {
        "node": {"lat": lat, "lon": lon},
        "TB": profile["temperature_c"],
        "VF": vf,
        "meta": {
            "source": profile["source"],
            "provider": profile["provider"],
            "fetched_at": profile["fetched_at"],
            "salinity_psu": profile["salinity_psu"],
        },
    }
