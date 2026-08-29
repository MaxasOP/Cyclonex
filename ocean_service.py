"""
ocean_service.py
-----------------
Fetches real subsurface ocean temperature & salinity data for a given
lat/lon from the PacIOOS ERDDAP server (public HYCOM Global Ocean
Forecast System mirror), and
derives the "VF" (Vertical Feature) layer:

Water Column
├── TB (Temperature-Based layers): 0m, 10m, 50m, 100m, 200m
├── VF (Vertical Features): temp gradient, salinity gradient, OHC, MLD
└── Nodes: one record per (lat, lon) grid point
"""

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# PacIOOS ERDDAP griddap endpoint serving HYCOM Global Ocean Forecast System
# Variables include water_temp (°C) and salinity (psu)
ERDDAP_BASE = "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/hycom_global.json"

# Standard depths (meters)
TB_DEPTHS = [0, 10, 50, 100, 200]


HYCOM_DEPTH_LEVELS = [
    0, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
    100, 125, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000
]

REQUEST_TIMEOUT_S = 6

# Seawater physical constants used in the OHC (Tropical Cyclone Heat
# Potential) calculation — standard values used in Leipper & Volgenau (1972)
SEAWATER_DENSITY_KG_M3 = 1025
SEAWATER_SPECIFIC_HEAT_J_KGC = 3850
OHC_THRESHOLD_C = 26.0  # cyclogenesis SST/subsurface threshold


def _nearest_hycom_depth(target_m: float) -> float:
    return min(HYCOM_DEPTH_LEVELS, key=lambda d: abs(d - target_m))


def _latest_available_time_iso() -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=1)
    return dt.strftime("%Y-%m-%dT00:00:00Z")


def _fetch_hycom_point(lat: float, lon: float, depth_m: float, variable: str) -> Optional[float]:
    time_iso = _latest_available_time_iso()
    depth_snap = _nearest_hycom_depth(depth_m)

    # ERDDAP griddap query syntax: var[(time)][(depth)][(lat)][(lon)]
    query = f"{variable}[({time_iso})][({depth_snap})][({lat})][({lon})]"
    url = f"{ERDDAP_BASE}?{query}"

    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT_S)
        resp.raise_for_status()
        data = resp.json()
        # ERDDAP JSON table format: data["table"]["rows"][0][-1] is the value
        row = data["table"]["rows"][0]
        value = row[-1]
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def fetch_live_profile(lat: float, lon: float) -> Optional[dict]:
    temps = {}
    salinities = {}

    for depth in TB_DEPTHS:
        t = _fetch_hycom_point(lat, lon, depth, "water_temp")
        s = _fetch_hycom_point(lat, lon, depth, "salinity")
        if t is None:
            return None  # bail to fallback rather than return a half-real profile
        temps[depth] = round(t, 2)
        salinities[depth] = round(s, 2) if s is not None else None

    return {
        "source": "LIVE",
        "provider": "PacIOOS ERDDAP (HYCOM Global Ocean Forecast System)",
        "temperature_c": temps,
        "salinity_psu": salinities,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def climatology_fallback_profile(lat: float, lon: float, basin: str) -> dict:
    """
    Physically-motivated (but NOT live-measured) fallback profile,
    used only if the live HYCOM fetch fails. Clearly labeled as an
    estimate in the response so the frontend/demo never silently
    presents synthetic numbers as real telemetry.

    Model: warm mixed layer near-uniform down to a basin-typical
    thermocline onset depth, then a realistic exponential decay —
    calibrated against typical North Indian Ocean climatology
    (BoB thermocline shallower & sharper due to freshwater
    stratification; Arabian Sea slightly deeper mixed layer).
    """
    surface_t = 29.6 if basin == "BAY_OF_BENGAL" else 29.1
    thermocline_onset = 35 if basin == "BAY_OF_BENGAL" else 55  # meters
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

    surface_s = 33.5 if basin == "BAY_OF_BENGAL" else 36.0  # BoB is fresher (river runoff)
    salinities = {d: round(surface_s + (d / 200) * 1.5, 2) for d in TB_DEPTHS}

    return {
        "source": "ESTIMATED_CLIMATOLOGY",
        "provider": "Basin climatology fallback (not live telemetry)",
        "temperature_c": temps,
        "salinity_psu": salinities,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def compute_vertical_features(profile: dict) -> dict:
    """
    Derives the VF layer from a TB profile:
      - temperature_gradient: °C per meter, layer-by-layer + overall
      - salinity_gradient: psu per meter, overall
      - ocean_heat_content: kJ/cm² (Tropical Cyclone Heat Potential method)
      - mixed_layer_depth: meters (temperature-threshold criterion)
    """
    depths = TB_DEPTHS
    temps = [profile["temperature_c"][d] for d in depths]
    sals = [profile["salinity_psu"][d] for d in depths]

    # --- Temperature gradient (layer-by-layer, °C/m) ---
    layer_gradients = {}
    for i in range(len(depths) - 1):
        d0, d1 = depths[i], depths[i + 1]
        t0, t1 = temps[i], temps[i + 1]
        layer_gradients[f"{d0}-{d1}m"] = round((t1 - t0) / (d1 - d0), 4)
    overall_temp_gradient = round((temps[-1] - temps[0]) / (depths[-1] - depths[0]), 4)

    # --- Salinity gradient (overall, psu/m) ---
    overall_sal_gradient = round((sals[-1] - sals[0]) / (depths[-1] - depths[0]), 4) \
        if None not in sals else None

    # --- Mixed Layer Depth ---
    ref_t = temps[1] if len(temps) > 1 else temps[0]  # 10m reference
    mld = depths[-1]  # default: deeper than our deepest sampled layer
    for i, d in enumerate(depths):
        if d <= 10:
            continue
        if ref_t - temps[i] >= 0.5:
            # linear interpolate between this and previous depth for a smoother MLD
            d_prev, t_prev = depths[i - 1], temps[i - 1]
            frac = (ref_t - 0.5 - t_prev) / (temps[i] - t_prev) if temps[i] != t_prev else 0
            mld = round(d_prev + frac * (d - d_prev), 1)
            break

    # --- Ocean Heat Content (Tropical Cyclone Heat Potential, kJ/cm²) ---
    # OHC = rho * Cp * integral_0^D26 (T(z) - 26) dz
    # Numerically integrate (trapezoidal) over depths where T > 26C only,
    # interpolating the exact depth (D26) where T crosses 26C.
    z = np.array(depths, dtype=float)
    t = np.array(temps, dtype=float)
    excess = t - OHC_THRESHOLD_C

    # find D26: first depth where temp drops to/below 26C
    d26 = depths[-1]
    for i in range(len(depths) - 1):
        if t[i] > OHC_THRESHOLD_C and t[i + 1] <= OHC_THRESHOLD_C:
            frac = (t[i] - OHC_THRESHOLD_C) / (t[i] - t[i + 1])
            d26 = depths[i] + frac * (depths[i + 1] - depths[i])
            break
        if t[i] <= OHC_THRESHOLD_C:
            d26 = depths[i]
            break

    # Integrate only down to d26, clipping the profile there
    integ_depths = [d for d in depths if d <= d26] + ([d26] if d26 not in depths else [])
    integ_depths = sorted(set(integ_depths))
    integ_excess = np.interp(integ_depths, depths, excess)
    integ_excess = np.clip(integ_excess, 0, None)

    trapz_fn = getattr(np, "trapezoid", getattr(np, "trapz", None))
    heat_integral_cm = trapz_fn(integ_excess, integ_depths) if len(integ_depths) > 1 else 0.0

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
