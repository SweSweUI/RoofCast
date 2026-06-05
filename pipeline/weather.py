"""
pipeline/weather.py
-------------------
Weather Intelligence Agent for the Altis weather-aware cashflow platform.

Responsibilities:
  1. Fetch historical daily weather (2023-01-01 to yesterday) from Open-Meteo
     ARCHIVE API per location, with 12-hour on-disk cache.
  2. Fetch live 16-day FORECAST from Open-Meteo FORECAST API, with cache.
  3. Graceful fallback to prior-work CSV/JSON when both API and cache fail.
  4. Persist daily rows to weather_daily (idempotent: DELETE + re-INSERT).
  5. Aggregate to weather_weekly with delay-score composite metric.
  6. Write data/artifacts/weather_summary.json.

delay_score formula (0..~40 range):
  delay_score = 2.0*rain_days_2mm + 2.0*rain_days_5mm + 3.0*bad_workdays
                + 0.15*workday_rain_sum
  Rationale:
    - rain_days_2mm: minor rain events (each adds 2 pts)
    - rain_days_5mm: heavy rain events (each adds additional 2 pts, stacked on 2mm)
    - bad_workdays:  truly bad roofing days (rain>=5mm OR gust>=60kph OR snow>=1mm),
                     highest weight (3 pts) as they likely cause full-day halts
    - workday_rain_sum: continuous load component (0.15 per mm) capturing soggy weeks
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Path setup: allow running from repo root OR pipeline/ directory
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve().parent
_ROOT = _HERE.parent
sys.path.insert(0, str(_HERE))

import requests

from config import (
    ARTIFACTS_DIR,
    BAD_DAY_RAIN_MM,
    BAD_DAY_SNOW_MM,
    BAD_DAY_WIND_GUST_KMH,
    PRIOR_WORK,
    RAIN_2MM,
    RAIN_5MM,
    WEATHER_LOCATIONS,
    WORKDAYS,
)
from db import connect

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

DAILY_VARS = [
    "precipitation_sum",
    "rain_sum",
    "precipitation_hours",
    "temperature_2m_min",
    "temperature_2m_max",
    "wind_gusts_10m_max",
    "snowfall_sum",
]

CACHE_DIR = _ROOT / "data" / "cache" / "weather"
CACHE_MAX_AGE_SECONDS = 12 * 3600  # 12 hours

ARCHIVE_START = "2023-01-01"
TIMEZONE = "Europe/Amsterdam"

PRIOR_WEATHER_DIR = PRIOR_WORK / "weather"


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_path(code: str, kind: str) -> Path:
    """Return path for a cache file: data/cache/weather/<code>_<kind>.json"""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / f"{code}_{kind}.json"


def _cache_is_fresh(path: Path) -> bool:
    """Return True if cache file exists and is younger than CACHE_MAX_AGE_SECONDS."""
    if not path.exists():
        return False
    age = time.time() - os.path.getmtime(str(path))
    return age < CACHE_MAX_AGE_SECONDS


def _read_cache(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _write_cache(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh)


# ---------------------------------------------------------------------------
# API fetching with cache
# ---------------------------------------------------------------------------

def _fetch_or_cache(url: str, params: dict, cache_path: Path) -> tuple[dict | None, bool]:
    """
    Fetch JSON from *url* with *params*, using *cache_path* as a 12-hour cache.

    Returns (data_dict, from_cache_flag).
    Returns (None, False) on total failure.
    """
    # Try cache first if fresh
    if _cache_is_fresh(cache_path):
        print(f"    [cache] Using cached {cache_path.name}")
        return _read_cache(cache_path), True

    # Try live API
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        _write_cache(cache_path, data)
        return data, False
    except Exception as exc:
        print(f"    [WARNING] API call failed ({exc}). Trying stale cache...")

    # Try stale cache as last resort
    if cache_path.exists():
        print(f"    [fallback] Using stale cache {cache_path.name}")
        return _read_cache(cache_path), True

    return None, False


# ---------------------------------------------------------------------------
# Parse Open-Meteo JSON response into a list of row dicts
# ---------------------------------------------------------------------------

def _parse_open_meteo(data: dict, source: str) -> list[dict]:
    """
    Convert an Open-Meteo daily JSON response into a list of dicts with keys
    matching the weather_daily schema columns.
    """
    daily = data.get("daily", {})
    times = daily.get("time", [])
    if not times:
        return []

    rows = []
    n = len(times)

    def col(key: str) -> list:
        return daily.get(key, [None] * n)

    precip_sums = col("precipitation_sum")
    rain_sums = col("rain_sum")
    precip_hours = col("precipitation_hours")
    temp_mins = col("temperature_2m_min")
    temp_maxs = col("temperature_2m_max")
    gusts = col("wind_gusts_10m_max")
    # snowfall_sum is in cm in Open-Meteo; convert to mm for consistency
    snow_raw = col("snowfall_sum")

    for i, dt in enumerate(times):
        # Use rain_sum if available, fallback to precipitation_sum
        rain = rain_sums[i]
        if rain is None:
            rain = precip_sums[i]

        snow_cm = snow_raw[i]
        snow_mm = (snow_cm * 10.0) if snow_cm is not None else None

        rows.append({
            "date": dt,
            "rain_sum": rain,
            "precipitation_hours": precip_hours[i],
            "temperature_min": temp_mins[i],
            "temperature_max": temp_maxs[i],
            "wind_gust_max": gusts[i],
            "snow_sum": snow_mm,
            "source": source,
        })
    return rows


# ---------------------------------------------------------------------------
# Fallback: load from PRIOR_WORK CSV/JSON
# ---------------------------------------------------------------------------

def _load_fallback_json(code: str) -> list[dict] | None:
    """
    Load prior-work daily weather from JSON file for given location code.
    The JSON has Open-Meteo structure with a 'daily' dict of arrays.
    Returns list of row dicts or None if file not found.
    """
    path = PRIOR_WEATHER_DIR / f"{code}_daily_weather_2023_2026.json"
    if not path.exists():
        return None
    print(f"    [WARNING] Falling back to prior-work JSON: {path}")
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)

    daily = data.get("daily", {})
    times = daily.get("time", [])
    if not times:
        return []

    n = len(times)

    def col(key: str) -> list:
        return daily.get(key, [None] * n)

    precip_sums = col("precipitation_sum")
    rain_sums = col("rain_sum")
    precip_hours = col("precipitation_hours")
    temp_mins = col("temperature_2m_min")
    temp_maxs = col("temperature_2m_max")
    gusts = col("wind_gusts_10m_max")
    snow_raw = col("snowfall_sum")  # cm

    rows = []
    for i, dt in enumerate(times):
        rain = rain_sums[i]
        if rain is None:
            rain = precip_sums[i]
        snow_cm = snow_raw[i]
        snow_mm = (snow_cm * 10.0) if snow_cm is not None else None
        rows.append({
            "date": dt,
            "rain_sum": rain,
            "precipitation_hours": precip_hours[i],
            "temperature_min": temp_mins[i],
            "temperature_max": temp_maxs[i],
            "wind_gust_max": gusts[i],
            "snow_sum": snow_mm,
            "source": "csv-cache",
        })
    return rows


def _load_fallback_csv(code: str) -> list[dict] | None:
    """
    Load prior-work daily weather from CSV for brunssum.
    CSV columns: time, precipitation_sum, rain_sum, snowfall_sum (cm),
                 precipitation_hours, temperature_2m_min, temperature_2m_max,
                 wind_gusts_10m_max, bad_roofing_day, weather_delay_score
    """
    path = PRIOR_WEATHER_DIR / f"{code}_daily_weather_2023_2026.csv"
    if not path.exists():
        return None
    print(f"    [WARNING] Falling back to prior-work CSV: {path}")
    rows = []
    with path.open("r", encoding="utf-8") as fh:
        header = None
        for line in fh:
            line = line.strip()
            if not line:
                continue
            parts = line.split(",")
            if header is None:
                header = parts
                continue
            record = dict(zip(header, parts))

            def _f(key: str) -> float | None:
                v = record.get(key, "").strip()
                try:
                    return float(v)
                except (ValueError, TypeError):
                    return None

            rain = _f("rain_sum")
            if rain is None:
                rain = _f("precipitation_sum")
            snow_cm = _f("snowfall_sum")
            snow_mm = (snow_cm * 10.0) if snow_cm is not None else None

            rows.append({
                "date": record.get("time", "").strip(),
                "rain_sum": rain,
                "precipitation_hours": _f("precipitation_hours"),
                "temperature_min": _f("temperature_2m_min"),
                "temperature_max": _f("temperature_2m_max"),
                "wind_gust_max": _f("wind_gusts_10m_max"),
                "snow_sum": snow_mm,
                "source": "csv-cache",
            })
    return rows if rows else None


def _load_fallback(code: str) -> list[dict] | None:
    """Try JSON fallback first, then CSV."""
    rows = _load_fallback_json(code)
    if rows is not None:
        return rows
    rows = _load_fallback_csv(code)
    if rows is not None:
        return rows
    return None


# ---------------------------------------------------------------------------
# Fetch all daily rows for one location (archive + forecast merged)
# ---------------------------------------------------------------------------

def fetch_location_daily(
    code: str, lat: float, lon: float
) -> tuple[list[dict], dict]:
    """
    Fetch + merge archive (historical) and forecast (16-day) rows for one location.

    Returns (rows_list, meta_dict) where meta_dict has:
      archive_ok, forecast_ok, fallback_used, n_archive, n_forecast
    """
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    meta: dict[str, Any] = {
        "archive_ok": False,
        "forecast_ok": False,
        "fallback_used": False,
        "n_archive": 0,
        "n_forecast": 0,
    }

    # ---- Archive ----
    archive_params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": ARCHIVE_START,
        "end_date": yesterday,
        "daily": ",".join(DAILY_VARS),
        "timezone": TIMEZONE,
    }
    archive_cache = _cache_path(code, "archive")
    print(f"  [{code}] Fetching archive ({ARCHIVE_START} -> {yesterday})...")
    archive_data, _ = _fetch_or_cache(ARCHIVE_URL, archive_params, archive_cache)

    archive_rows: list[dict] = []
    if archive_data is not None:
        archive_rows = _parse_open_meteo(archive_data, source="open-meteo-archive")
        meta["archive_ok"] = True
        meta["n_archive"] = len(archive_rows)
        print(f"    archive rows: {len(archive_rows)}")
    else:
        print(f"    [WARNING] Archive API and cache both failed for {code}. Loading fallback...")
        fallback = _load_fallback(code)
        if fallback:
            archive_rows = fallback
            meta["fallback_used"] = True
            meta["n_archive"] = len(fallback)
            print(f"    fallback rows loaded: {len(fallback)}")
        else:
            print(f"    [WARNING] No fallback data available for {code}!")

    # ---- Forecast ----
    forecast_params = {
        "latitude": lat,
        "longitude": lon,
        "forecast_days": 16,
        "daily": ",".join(DAILY_VARS),
        "timezone": TIMEZONE,
    }
    forecast_cache = _cache_path(code, "forecast")
    print(f"  [{code}] Fetching 16-day forecast...")
    forecast_data, _ = _fetch_or_cache(FORECAST_URL, forecast_params, forecast_cache)

    forecast_rows: list[dict] = []
    if forecast_data is not None:
        forecast_rows = _parse_open_meteo(forecast_data, source="open-meteo-forecast")
        meta["forecast_ok"] = True
        meta["n_forecast"] = len(forecast_rows)
        print(f"    forecast rows: {len(forecast_rows)}")
    else:
        print(f"    [WARNING] Forecast API and cache both failed for {code}. Proceeding without forecast.")

    # ---- Merge: forecast rows overwrite/extend archive for their dates ----
    # Build date-keyed dict from archive, then overlay forecast
    merged: dict[str, dict] = {r["date"]: r for r in archive_rows}
    for r in forecast_rows:
        merged[r["date"]] = r

    all_rows = sorted(merged.values(), key=lambda r: r["date"])
    return all_rows, meta


# ---------------------------------------------------------------------------
# Weekly aggregation
# ---------------------------------------------------------------------------

def _iso_week_start(d: date) -> date:
    """Return the ISO Monday (week_start) for a given date."""
    return d - timedelta(days=d.weekday())


def aggregate_weekly(
    location_id: int,
    daily_rows: list[dict],
    today: date,
) -> list[dict]:
    """
    Aggregate daily rows into weekly rows keyed by ISO Monday.

    Weekly columns (matching weather_weekly schema):
      location_id, week_start, rain_sum, workday_rain_sum,
      rain_days_2mm, rain_days_5mm, bad_workdays, delay_score,
      source, is_forecast
    """
    # Group by week_start
    from collections import defaultdict
    weeks: dict[date, list[dict]] = defaultdict(list)
    for row in daily_rows:
        d = date.fromisoformat(row["date"])
        ws = _iso_week_start(d)
        weeks[ws].append(row)

    result = []
    for ws in sorted(weeks.keys()):
        days = weeks[ws]
        if not days:
            continue

        # All-week rain sum
        total_rain = sum(
            (r["rain_sum"] or 0.0) for r in days
        )

        # Filter to workdays only (Mon=0 .. Fri=4)
        workday_rows = [
            r for r in days
            if date.fromisoformat(r["date"]).weekday() in WORKDAYS
        ]

        workday_rain = sum((r["rain_sum"] or 0.0) for r in workday_rows)

        # rain_days_2mm: workdays with rain >= 2.0mm
        rain_days_2mm = sum(
            1 for r in workday_rows if (r["rain_sum"] or 0.0) >= RAIN_2MM
        )

        # rain_days_5mm: workdays with rain >= 5.0mm
        rain_days_5mm = sum(
            1 for r in workday_rows if (r["rain_sum"] or 0.0) >= RAIN_5MM
        )

        # bad_workdays: workdays where rain>=5mm OR wind_gust>=60kph OR snow>=1mm
        bad_workdays = sum(
            1 for r in workday_rows
            if (
                (r["rain_sum"] or 0.0) >= BAD_DAY_RAIN_MM
                or (r["wind_gust_max"] or 0.0) >= BAD_DAY_WIND_GUST_KMH
                or (r["snow_sum"] or 0.0) >= BAD_DAY_SNOW_MM
            )
        )

        # delay_score composite (0..~40):
        # = 2.0*rain_days_2mm + 2.0*rain_days_5mm + 3.0*bad_workdays
        #   + 0.15*workday_rain_sum
        # See module docstring for per-term rationale.
        delay_score = round(
            2.0 * rain_days_2mm
            + 2.0 * rain_days_5mm
            + 3.0 * bad_workdays
            + 0.15 * workday_rain,
            1,
        )

        # is_forecast: 1 if ANY day in the week is strictly after today
        is_forecast = int(
            any(date.fromisoformat(r["date"]) > today for r in days)
        )

        source = "live-forecast" if is_forecast else "historical"

        result.append({
            "location_id": location_id,
            "week_start": ws.isoformat(),
            "rain_sum": round(total_rain, 2),
            "workday_rain_sum": round(workday_rain, 2),
            "rain_days_2mm": rain_days_2mm,
            "rain_days_5mm": rain_days_5mm,
            "bad_workdays": bad_workdays,
            "delay_score": delay_score,
            "source": source,
            "is_forecast": is_forecast,
        })

    return result


# ---------------------------------------------------------------------------
# DB persistence
# ---------------------------------------------------------------------------

DAILY_COLS = [
    "location_id", "date", "rain_sum", "precipitation_hours",
    "temperature_min", "temperature_max", "wind_gust_max", "snow_sum",
    "source", "fetched_at",
]

WEEKLY_COLS = [
    "location_id", "week_start", "rain_sum", "workday_rain_sum",
    "rain_days_2mm", "rain_days_5mm", "bad_workdays", "delay_score",
    "source", "is_forecast",
]


def persist_daily(conn, location_id: int, rows: list[dict]) -> int:
    fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    tuples = []
    for r in rows:
        tuples.append((
            location_id,
            r["date"],
            r.get("rain_sum"),
            r.get("precipitation_hours"),
            r.get("temperature_min"),
            r.get("temperature_max"),
            r.get("wind_gust_max"),
            r.get("snow_sum"),
            r.get("source", "unknown"),
            fetched_at,
        ))
    conn.executemany(
        f"INSERT OR REPLACE INTO weather_daily ({','.join(DAILY_COLS)}) "
        f"VALUES ({','.join(['?']*len(DAILY_COLS))})",
        tuples,
    )
    return len(tuples)


def persist_weekly(conn, rows: list[dict]) -> int:
    tuples = []
    for r in rows:
        tuples.append((
            r["location_id"],
            r["week_start"],
            r["rain_sum"],
            r["workday_rain_sum"],
            r["rain_days_2mm"],
            r["rain_days_5mm"],
            r["bad_workdays"],
            r["delay_score"],
            r["source"],
            r["is_forecast"],
        ))
    conn.executemany(
        f"INSERT OR REPLACE INTO weather_weekly ({','.join(WEEKLY_COLS)}) "
        f"VALUES ({','.join(['?']*len(WEEKLY_COLS))})",
        tuples,
    )
    return len(tuples)


# ---------------------------------------------------------------------------
# Artifact writer
# ---------------------------------------------------------------------------

def write_artifact(summary: dict) -> Path:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    out = ARTIFACTS_DIR / "weather_summary.json"
    with out.open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)
    return out


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main() -> None:
    today = date.today()
    print(f"=== Altis Weather Pipeline — {today.isoformat()} ===\n")

    # Look up location IDs from DB
    conn = connect()

    # Load location IDs
    loc_rows = conn.execute(
        "SELECT id, code, latitude, longitude FROM weather_locations"
    ).fetchall()
    loc_map = {code: (lid, lat, lon) for lid, code, lat, lon in loc_rows}

    # ---- Clear existing weather data (idempotent) ----
    conn.execute("DELETE FROM weather_weekly")
    conn.execute("DELETE FROM weather_daily")
    conn.commit()
    print("Cleared existing weather_daily and weather_weekly rows.\n")

    artifact_data: dict[str, Any] = {}
    total_daily = 0
    total_weekly = 0

    for loc in WEATHER_LOCATIONS:
        code = loc["code"]
        if code not in loc_map:
            print(f"[WARNING] Location '{code}' not found in weather_locations table. Skipping.")
            continue

        location_id, lat, lon = loc_map[code]
        print(f"--- {code} (id={location_id}, lat={lat}, lon={lon}) ---")

        # Fetch daily data
        daily_rows, meta = fetch_location_daily(code, lat, lon)

        if not daily_rows:
            print(f"  [WARNING] No data at all for {code}. Skipping.\n")
            artifact_data[code] = {"error": "no data available"}
            continue

        # Persist daily
        n_daily = persist_daily(conn, location_id, daily_rows)
        conn.commit()
        total_daily += n_daily

        # Compute weekly aggregates
        weekly_rows = aggregate_weekly(location_id, daily_rows, today)
        n_weekly = persist_weekly(conn, weekly_rows)
        conn.commit()
        total_weekly += n_weekly

        # Build artifact summary
        dates = sorted(r["date"] for r in daily_rows)
        date_min = dates[0] if dates else None
        date_max = dates[-1] if dates else None

        source_counts: dict[str, int] = {}
        for r in daily_rows:
            src = r.get("source", "unknown")
            source_counts[src] = source_counts.get(src, 0) + 1

        n_forecast_weeks = sum(1 for w in weekly_rows if w["is_forecast"])

        artifact_data[code] = {
            "n_daily": n_daily,
            "n_weekly": n_weekly,
            "date_min": date_min,
            "date_max": date_max,
            "n_forecast_weeks": n_forecast_weeks,
            "source_breakdown": source_counts,
            "live_api_succeeded": meta["archive_ok"] or meta["forecast_ok"],
            "fallback_used": meta["fallback_used"],
            "archive_ok": meta["archive_ok"],
            "forecast_ok": meta["forecast_ok"],
        }

        print(f"  Inserted {n_daily} daily rows, {n_weekly} weekly rows.")
        print(f"  Date range: {date_min} -> {date_max}")
        print(f"  Forecast weeks: {n_forecast_weeks}")
        print(f"  Source breakdown: {source_counts}\n")

    conn.close()

    # Write artifact
    artifact_data["_meta"] = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "today": today.isoformat(),
        "total_daily_rows": total_daily,
        "total_weekly_rows": total_weekly,
        "delay_score_formula": (
            "2.0*rain_days_2mm + 2.0*rain_days_5mm + 3.0*bad_workdays + 0.15*workday_rain_sum"
        ),
    }
    art_path = write_artifact(artifact_data)

    print("=== Summary ===")
    print(f"Total daily rows inserted:  {total_daily}")
    print(f"Total weekly rows inserted: {total_weekly}")
    print(f"Artifact written to:        {art_path}")


if __name__ == "__main__":
    main()
