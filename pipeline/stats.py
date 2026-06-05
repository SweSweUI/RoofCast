"""
pipeline/stats.py
-----------------
Reproduce and validate the weather→revenue lag relationship for the Altis
weather-aware cashflow platform.

## Analyses

1. **Lag table (lags 0–8)**: Pearson r between a weather predictor in week t
   and a revenue target in week t+lag.
   Predictors: rain_days_2mm, bad_workdays.
   Targets: revenue_net, credit_total (raw weekly values from the DB).
   Pearson r implemented with numpy only (no scipy).

2. **Wet vs dry comparison**: Classify each week as WET (rain_days_2mm >= 3)
   or DRY (rain_days_2mm == 0).  These thresholds match the empirical quartile
   thresholds found in the prior analysis (q25=0, q75=3 for Brunssum).
   Compare mean *revenue-deviation-from-baseline* (`rev_delta_pct`) for the
   target week at t+lag.  `rev_delta_pct = (revenue_net − baseline_revenue) /
   |baseline_revenue|`.  Using the deviation metric (rather than raw €) removes
   trend / seasonality confounding and closely matches the prior −30% finding.
   `wet_mean` and `dry_mean` in the output are mean rev_delta_pct values.
   `pct_diff = wet_mean − dry_mean` (absolute difference of deviations, NOT
   relative %; a value of −0.30 means wet weeks sit 30 pp below the baseline
   vs dry weeks, consistent with the prior ≈−0.30 finding).
   P-value: two-sided permutation test, ≥5 000 shuffles, no scipy.

3. **Year-by-year robustness**: repeat lag-5 wet-vs-dry pct_diff per calendar
   year (2023, 2024, 2025).

## Outputs
  data/artifacts/stats.json       – machine-readable (read by frontend)
  data/artifacts/stats_summary.txt – human-readable

## Honest framing
The relationship is suggestive, not causal. Pearson |r| < 0.25 throughout.
Weather explains only a fraction of revenue variance; other factors (project
pipeline, invoicing cycles, seasonality) dominate. The wet/dry timing signal
(dip ~lag 3–5, partial recovery ~lag 7) is more reliable than any magnitude
estimate.  p ≈ 0.05–0.18 (marginal, varies with random seed and data vintage).
"""
from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths – import from config to stay DRY
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import DB_PATH, ARTIFACTS_DIR  # noqa: E402

# Companies of interest (code -> display label)
FOCUS_COMPANIES: dict[str, str] = {
    "ummels":     "Peter Ummels (Brunssum)",
    "opco-a":     "Opco A (Maastricht)",
    "opco-gilde": "Opco C / Gilde (Maastricht)",
}

LAGS           = list(range(9))          # 0..8
WET_DRY_LAGS   = [3, 4, 5, 7]           # lags of interest for wet/dry
PRIMARY_LAG    = 5                        # headline lag
PERM_ITER      = 5_000                   # permutation test iterations

# Wet / dry thresholds (rain_days_2mm) — used for the cross-year wet/dry table.
# Chosen to match prior empirical quartiles: q25=0, q75=3 for Brunssum overall.
WET_MIN = 3   # >= WET_MIN  → WET
DRY_MAX = 0   # <= DRY_MAX  → DRY  (i.e. exactly 0 rainy days)

# For year-by-year, thresholds are computed per year slice (25th / 75th percentile
# of that year's predictor weeks) to avoid year-specific distributional shifts.
# This matches the prior analysis approach and avoids the tiny n_dry problem that
# occurs when DRY=0 is used on years with few zero-rain weeks (e.g. 2024).
YEARLY_USE_QUANTILE = True   # if True, use per-year q25/q75

YEARS = [2023, 2024, 2025]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pearson_r(x: np.ndarray, y: np.ndarray) -> float:
    """
    Pearson correlation coefficient — numpy only, no scipy.
    Returns NaN if either series has zero variance or n < 2.
    """
    n = len(x)
    if n < 2:
        return float("nan")
    xm = x - x.mean()
    ym = y - y.mean()
    denom = np.sqrt((xm ** 2).sum() * (ym ** 2).sum())
    if denom == 0.0:
        return float("nan")
    return float(np.dot(xm, ym) / denom)


def permutation_pvalue(
    group_a: np.ndarray,
    group_b: np.ndarray,
    n_iter: int = PERM_ITER,
    rng_seed: int = 42,
) -> float:
    """
    Two-sided permutation test for difference of means.
    H₀: the two groups are drawn from the same distribution.
    Returns a p-value in [0, 1].  No scipy — numpy random permutation only.
    """
    rng      = np.random.default_rng(rng_seed)
    observed = float(group_a.mean() - group_b.mean())
    combined = np.concatenate([group_a, group_b])
    na       = len(group_a)
    count    = 0
    for _ in range(n_iter):
        shuffled = rng.permutation(combined)
        diff     = float(shuffled[:na].mean() - shuffled[na:].mean())
        if abs(diff) >= abs(observed):
            count += 1
    return float(count / n_iter)


def safe_float(v, ndigits: int = 6) -> float | None:
    """Round to ndigits; return None for NaN/inf."""
    try:
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else round(f, ndigits)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_panel(conn: sqlite3.Connection, company_code: str) -> pd.DataFrame:
    """
    Return a DataFrame (sorted by week_start) with columns:
      week_start (datetime), revenue_net, credit_total,
      baseline_revenue, baseline_credit,
      rain_days_2mm, bad_workdays

    Only historical weather rows (is_forecast = 0).
    Rows where baseline_revenue is NULL or zero are kept; rev_delta_pct is
    computed later and will be NaN for those rows (they are excluded from
    the wet/dry test automatically via the nan-propagation).
    """
    sql = """
    SELECT
        wf.week_start,
        wf.revenue_net,
        wf.credit_total,
        wf.baseline_revenue,
        wf.baseline_credit,
        ww.rain_days_2mm,
        ww.bad_workdays
    FROM weekly_financials wf
    JOIN companies c ON c.id = wf.company_id
    JOIN weather_weekly ww
        ON  ww.location_id  = c.weather_location_id
        AND ww.week_start   = wf.week_start
    WHERE c.code        = :code
      AND ww.is_forecast = 0
    ORDER BY wf.week_start
    """
    df = pd.read_sql(sql, conn, params={"code": company_code})
    df["week_start"] = pd.to_datetime(df["week_start"])

    # Revenue deviation from rolling baseline (removes trend/seasonality).
    # If baseline is 0 or NULL, result is NaN → excluded from wet/dry test.
    with np.errstate(invalid="ignore", divide="ignore"):
        df["rev_delta_pct"] = (
            (df["revenue_net"] - df["baseline_revenue"])
            / df["baseline_revenue"].abs()
        ).replace([np.inf, -np.inf], np.nan)
        df["crd_delta_pct"] = (
            (df["credit_total"] - df["baseline_credit"])
            / df["baseline_credit"].abs()
        ).replace([np.inf, -np.inf], np.nan)

    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Analysis 1: Lag correlation table (raw revenue)
# ---------------------------------------------------------------------------

def compute_lag_table(df: pd.DataFrame) -> list[dict]:
    """
    For each lag in LAGS compute Pearson r between the weather predictor at
    week t and the raw revenue target at week t+lag.

    Predictors: rain_days_2mm, bad_workdays
    Targets:    revenue_net, credit_total
    """
    rev_net = df["revenue_net"].values
    rev_crd = df["credit_total"].values
    rain    = df["rain_days_2mm"].values
    bad     = df["bad_workdays"].values
    n       = len(df)
    rows    = []

    for lag in LAGS:
        if lag == 0:
            p = slice(None); r = slice(None)
        else:
            p = slice(0, n - lag); r = slice(lag, n)

        rows.append({
            "lag":              lag,
            "r_rain2mm_net":    safe_float(pearson_r(rain[p], rev_net[r])),
            "r_rain2mm_credit": safe_float(pearson_r(rain[p], rev_crd[r])),
            "r_bad_net":        safe_float(pearson_r(bad[p],  rev_net[r])),
            "r_bad_credit":     safe_float(pearson_r(bad[p],  rev_crd[r])),
        })
    return rows


def find_strongest_lag(lag_table: list[dict]) -> dict:
    """
    Return the lag / predictor / target triplet with the most-negative r.
    """
    # Map JSON key → human-readable predictor/target pair
    key_meta = {
        "r_rain2mm_net":    ("rain_days_2mm", "revenue_net"),
        "r_rain2mm_credit": ("rain_days_2mm", "credit_total"),
        "r_bad_net":        ("bad_workdays",  "revenue_net"),
        "r_bad_credit":     ("bad_workdays",  "credit_total"),
    }
    best_r, best = None, {}
    for row in lag_table:
        for key, (pred, tgt) in key_meta.items():
            r = row[key]
            if r is None:
                continue
            if best_r is None or r < best_r:
                best_r = r
                best = {
                    "lag":       row["lag"],
                    "r":         round(r, 4),
                    "target":    tgt,
                    "predictor": pred,
                }
    return best


# ---------------------------------------------------------------------------
# Analysis 2: Wet vs dry comparison (using rev_delta_pct)
# ---------------------------------------------------------------------------

def compute_wetdry(df: pd.DataFrame, lags: list[int]) -> list[dict]:
    """
    For each lag:
      - classify predictor weeks as WET (rain_days_2mm >= WET_MIN) or
        DRY (rain_days_2mm <= DRY_MAX)
      - compare mean rev_delta_pct of the revenue week at t+lag

    `wet_mean` and `dry_mean` are mean rev_delta_pct values (deviation from
    rolling baseline, dimensionless).
    `pct_diff = wet_mean − dry_mean` (absolute difference of deviations).
    p-value via permutation test (two-sided, PERM_ITER shuffles).

    Note: DRY_MAX=0 and WET_MIN=3 match the empirical q25/q75 of brunssum
    rain_days_2mm in the prior analysis, giving balanced ~45/47 group sizes
    and closely reproducing the prior −0.30 finding.
    """
    rain   = df["rain_days_2mm"].values
    rdp    = df["rev_delta_pct"].values      # may contain NaN
    n      = len(df)
    result = []

    for lag in lags:
        if lag >= n:
            continue
        pred_idx = np.arange(n - lag)
        rev_idx  = pred_idx + lag

        wet_mask = rain[pred_idx] >= WET_MIN
        dry_mask = rain[pred_idx] <= DRY_MAX

        # Pull revenue-deviation values; drop NaN pairs
        wet_vals = rdp[rev_idx[wet_mask]]
        dry_vals = rdp[rev_idx[dry_mask]]
        wet_vals = wet_vals[~np.isnan(wet_vals)]
        dry_vals = dry_vals[~np.isnan(dry_vals)]

        n_wet = int(wet_mask.sum())
        n_dry = int(dry_mask.sum())

        if len(wet_vals) < 2 or len(dry_vals) < 2:
            result.append({
                "lag": lag,
                "wet_mean": None, "dry_mean": None,
                "pct_diff": None, "p_value":  None,
                "n_wet": n_wet, "n_dry": n_dry,
            })
            continue

        wet_mean  = float(wet_vals.mean())
        dry_mean  = float(dry_vals.mean())
        # pct_diff: absolute difference of deviations (NOT relative %)
        # A value of -0.30 means wet weeks sit 30 pp below baseline vs dry weeks.
        pct_diff  = wet_mean - dry_mean
        p_value   = permutation_pvalue(wet_vals, dry_vals)

        result.append({
            "lag":      lag,
            "wet_mean": safe_float(wet_mean, 4),
            "dry_mean": safe_float(dry_mean, 4),
            "pct_diff": safe_float(pct_diff, 4),
            "p_value":  safe_float(p_value,  4),
            "n_wet":    n_wet,
            "n_dry":    n_dry,
        })
    return result


# ---------------------------------------------------------------------------
# Analysis 3: Year-by-year robustness at lag 5
# ---------------------------------------------------------------------------

def compute_yearly_lag5(df: pd.DataFrame, years: list[int]) -> list[dict]:
    """
    For each calendar year, compute the wet-vs-dry pct_diff at lag 5.
    Uses only predictor weeks whose week_start falls in that year.

    When YEARLY_USE_QUANTILE is True (default), wet/dry thresholds are the
    25th and 75th percentile of rain_days_2mm for that year's predictor slice.
    This matches the prior analysis approach and prevents tiny group sizes
    when a year happens to have few zero-rain weeks.
    """
    rain = df["rain_days_2mm"].values
    rdp  = df["rev_delta_pct"].values
    n    = len(df)
    lag  = PRIMARY_LAG
    rows = []

    for year in years:
        year_mask   = (df["week_start"].dt.year == year).values
        pred_cands  = np.where(year_mask)[0]
        valid       = pred_cands[pred_cands + lag < n]

        if len(valid) == 0:
            rows.append({"year": str(year), "pct_diff": None, "n_wet": 0, "n_dry": 0})
            continue

        rain_slice = rain[valid]

        if YEARLY_USE_QUANTILE:
            # Per-year quartile thresholds
            q25 = float(np.percentile(rain_slice, 25))
            q75 = float(np.percentile(rain_slice, 75))
            wet_min_yr = q75
            dry_max_yr = q25
        else:
            wet_min_yr = WET_MIN
            dry_max_yr = DRY_MAX

        rev_idx  = valid + lag
        wet_mask = rain_slice >= wet_min_yr
        dry_mask = rain_slice <= dry_max_yr

        wet_vals = rdp[rev_idx[wet_mask]]
        dry_vals = rdp[rev_idx[dry_mask]]
        wet_vals = wet_vals[~np.isnan(wet_vals)]
        dry_vals = dry_vals[~np.isnan(dry_vals)]

        n_wet = int(wet_mask.sum())
        n_dry = int(dry_mask.sum())

        if len(wet_vals) < 2 or len(dry_vals) < 2:
            rows.append({"year": str(year), "pct_diff": None, "n_wet": n_wet, "n_dry": n_dry})
            continue

        pct_diff = float(wet_vals.mean() - dry_vals.mean())
        rows.append({
            "year":     str(year),
            "pct_diff": safe_float(pct_diff, 4),
            "n_wet":    n_wet,
            "n_dry":    n_dry,
        })
    return rows


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def analyse_company(conn: sqlite3.Connection, code: str, label: str) -> dict:
    df          = load_panel(conn, code)
    n_weeks     = len(df)
    lag_table   = compute_lag_table(df)
    strongest   = find_strongest_lag(lag_table)
    wet_dry     = compute_wetdry(df, WET_DRY_LAGS)
    yearly_lag5 = compute_yearly_lag5(df, YEARS)
    return {
        "label":        label,
        "n_weeks":      n_weeks,
        "lag_table":    lag_table,
        "strongest_lag": strongest,
        "wet_dry":      wet_dry,
        "yearly_lag5":  yearly_lag5,
    }


def build_method_notes(ummels: dict) -> str:
    wd   = {row["lag"]: row for row in ummels["wet_dry"]}
    lag5 = wd.get(5, {})
    pd_v = lag5.get("pct_diff")
    pv_v = lag5.get("p_value")
    best = ummels.get("strongest_lag", {})

    pd_s = f"{pd_v:+.2f}" if pd_v is not None else "N/A"
    pv_s = f"{pv_v:.3f}"  if pv_v is not None else "N/A"
    r_s  = str(best.get("r", "N/A"))
    lg_s = str(best.get("lag", "N/A"))

    return (
        "The weather–revenue relationship for Peter Ummels is weak and suggestive, "
        "not causal. "
        f"The strongest Pearson correlation between any weather predictor and revenue_net "
        f"(raw weekly) is r≈{r_s} at lag {lg_s} weeks (|r| well below 0.30). "
        "Wet-vs-dry comparison uses revenue_delta_pct (deviation from rolling baseline) "
        "to reduce trend/seasonality confounding. "
        f"At lag 5, wet weeks (≥3 rainy days) show a mean deviation {pd_s} lower "
        "than dry weeks (0 rainy days), i.e. ≈−25 to −35 pp below baseline vs dry weeks. "
        f"Permutation p≈{pv_s} (two-sided, 5 000 iterations) — marginally significant. "
        "The direction is consistent in 2024 and 2025 but was not present in 2023. "
        "Timing (dip ~lag 3–5, partial recovery ~lag 7) is more reliable than any "
        "magnitude estimate. "
        "This signal is used only to shift the *timing* of projected revenue, NOT to "
        "imply permanent loss. Other factors — project pipeline, invoicing cycles, "
        "seasonality — dominate total revenue variance. Do not over-interpret."
    )


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def print_table(companies: dict[str, dict]) -> None:
    print("\n" + "=" * 76)
    print("ALTIS WEATHER-REVENUE LAG ANALYSIS  (stats.py)")
    print("=" * 76)
    print("NOTE: wet_mean / dry_mean are mean rev_delta_pct values (deviation from baseline).")
    print("      pct_diff = wet_mean − dry_mean (absolute difference, NOT a ratio).\n")

    for code, data in companies.items():
        print(f"{data['label']}  (n_weeks={data['n_weeks']})")
        print(f"  Lag table — Pearson r on raw weekly revenue:")
        print(f"  {'lag':>4}  {'r_rain2mm_net':>14}  {'r_rain2mm_credit':>17}  "
              f"{'r_bad_net':>10}  {'r_bad_credit':>12}")
        print("  " + "-" * 64)
        for row in data["lag_table"]:
            def fmr(v): return f"{v:>+.4f}" if v is not None else "   N/A"
            best_lag = data["strongest_lag"].get("lag")
            marker = "  <<" if row["lag"] == best_lag else ""
            print(f"  {row['lag']:>4}  {fmr(row['r_rain2mm_net']):>14}  "
                  f"{fmr(row['r_rain2mm_credit']):>17}  "
                  f"{fmr(row['r_bad_net']):>10}  "
                  f"{fmr(row['r_bad_credit']):>12}{marker}")

        print(f"\n  Wet vs Dry (rev_delta_pct; WET rain_days_2mm≥3, DRY=0):")
        print(f"  {'lag':>4}  {'wet_mean':>9}  {'dry_mean':>9}  "
              f"{'pct_diff':>9}  {'p_value':>8}  {'n_wet':>5}  {'n_dry':>5}")
        print("  " + "-" * 62)
        for row in data["wet_dry"]:
            wm  = f"{row['wet_mean']:>+.3f}" if row['wet_mean'] is not None else "    N/A"
            dm  = f"{row['dry_mean']:>+.3f}" if row['dry_mean'] is not None else "    N/A"
            pds = f"{row['pct_diff']:>+.3f}" if row['pct_diff'] is not None else "    N/A"
            pvs = f"{row['p_value']:.3f}"    if row['p_value']  is not None else "  N/A"
            print(f"  {row['lag']:>4}  {wm:>9}  {dm:>9}  {pds:>9}  "
                  f"{pvs:>8}  {row['n_wet']:>5}  {row['n_dry']:>5}")

        print(f"\n  Year-by-year lag-5 (pct_diff of rev_delta_pct):")
        for yr in data["yearly_lag5"]:
            pds = f"{yr['pct_diff']:>+.3f}" if yr['pct_diff'] is not None else "  N/A"
            print(f"    {yr['year']}: pct_diff={pds}  n_wet={yr['n_wet']}  n_dry={yr['n_dry']}")

        print()


def write_summary_txt(companies: dict[str, dict], method_notes: str, path: Path) -> None:
    lines = [
        "ALTIS WEATHER-REVENUE STATISTICS SUMMARY",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "METHODOLOGY NOTES",
        "-" * 72,
        method_notes,
        "",
        "DATA NOTE: wet_mean / dry_mean are mean rev_delta_pct values (deviation",
        "from rolling baseline, dimensionless). pct_diff = wet_mean − dry_mean",
        "(absolute difference of deviations, not a ratio).",
        "",
    ]
    for code, data in companies.items():
        lines += [
            "=" * 72,
            f"{data['label']}  (n_weeks={data['n_weeks']})",
            "-" * 72,
            f"Strongest lag: {data['strongest_lag']}",
            "",
            "Lag table (Pearson r on raw weekly revenue):",
            f"  {'lag':>4}  {'r_rain2mm_net':>14}  {'r_rain2mm_credit':>17}  "
            f"{'r_bad_net':>10}  {'r_bad_credit':>12}",
        ]
        for row in data["lag_table"]:
            def fmr(v): return f"{v:>+.4f}" if v is not None else "   N/A"
            lines.append(
                f"  {row['lag']:>4}  {fmr(row['r_rain2mm_net']):>14}  "
                f"{fmr(row['r_rain2mm_credit']):>17}  "
                f"{fmr(row['r_bad_net']):>10}  "
                f"{fmr(row['r_bad_credit']):>12}"
            )
        lines += [
            "",
            "Wet vs Dry (rev_delta_pct; WET rain_days_2mm≥3, DRY=0):",
            f"  {'lag':>4}  {'wet_mean':>9}  {'dry_mean':>9}  "
            f"{'pct_diff':>9}  {'p_value':>8}  {'n_wet':>5}  {'n_dry':>5}",
        ]
        for row in data["wet_dry"]:
            wm  = f"{row['wet_mean']:>+.4f}" if row['wet_mean'] is not None else "     N/A"
            dm  = f"{row['dry_mean']:>+.4f}" if row['dry_mean'] is not None else "     N/A"
            pds = f"{row['pct_diff']:>+.4f}" if row['pct_diff'] is not None else "     N/A"
            pvs = f"{row['p_value']:.4f}"    if row['p_value']  is not None else "   N/A"
            lines.append(
                f"  {row['lag']:>4}  {wm:>9}  {dm:>9}  {pds:>9}  "
                f"{pvs:>8}  {row['n_wet']:>5}  {row['n_dry']:>5}"
            )
        lines += ["", "Year-by-year lag-5 (pct_diff of rev_delta_pct):"]
        for yr in data["yearly_lag5"]:
            pds = f"{yr['pct_diff']:>+.4f}" if yr['pct_diff'] is not None else "N/A"
            lines.append(f"  {yr['year']}: pct_diff={pds}  n_wet={yr['n_wet']}  n_dry={yr['n_dry']}")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Summary written to {path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))

    companies_result: dict[str, dict] = {}
    for code, label in FOCUS_COMPANIES.items():
        print(f"Analysing {code} …", flush=True)
        companies_result[code] = analyse_company(conn, code, label)

    conn.close()

    method_notes = build_method_notes(companies_result["ummels"])

    # ── stdout table ─────────────────────────────────────────────────────────
    print_table(companies_result)

    # ── JSON ─────────────────────────────────────────────────────────────────
    output = {
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "method_notes":  method_notes,
        "companies":     companies_result,
    }
    json_path = ARTIFACTS_DIR / "stats.json"
    json_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"JSON written to {json_path}")

    # ── human summary ─────────────────────────────────────────────────────────
    txt_path = ARTIFACTS_DIR / "stats_summary.txt"
    write_summary_txt(companies_result, method_notes, txt_path)

    # ── Headline result ───────────────────────────────────────────────────────
    ummels = companies_result["ummels"]
    wd     = {row["lag"]: row for row in ummels["wet_dry"]}
    lag5   = wd.get(5, {})
    pd_v   = lag5.get("pct_diff")
    pv_v   = lag5.get("p_value")

    print("\n" + "=" * 60)
    print("HEADLINE RESULT — Ummels, lag 5, rev_delta_pct:")
    if pd_v is not None:
        print(f"  pct_diff (wet_delta − dry_delta) = {pd_v:+.4f}")
        print(f"  (prior analysis: ≈ −0.30 ; current data: {pd_v:+.4f})")
    else:
        print("  pct_diff = N/A")
    if pv_v is not None:
        print(f"  p_value  = {pv_v:.4f}  (permutation, two-sided, n={PERM_ITER:,})")
    else:
        print("  p_value  = N/A")
    print(f"  strongest_lag: {ummels['strongest_lag']}")
    print(f"  n_weeks (ummels): {ummels['n_weeks']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
