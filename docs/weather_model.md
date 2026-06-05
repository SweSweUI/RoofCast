# Weather Model

The weather model is implemented in `pipeline/weather.py` and `lib/forecast/weather.ts`. It has two responsibilities: (1) fetching and persisting weather data per location, and (2) classifying each forecast week by delay risk for the forecast engine.

---

## Open-Meteo Integration

### APIs Used

| API | Endpoint | Purpose |
|---|---|---|
| ERA5 Archive | `https://archive-api.open-meteo.com/v1/archive` | Historical daily weather from 2023-01-01 to yesterday |
| Live Forecast | `https://api.open-meteo.com/v1/forecast` | 16-day forward forecast |

Neither API requires an API key. Both are free public APIs.

### Variables Fetched (Daily)

- `precipitation_sum` — total precipitation mm (fallback if `rain_sum` is not present)
- `rain_sum` — rain in mm (preferred; used if available)
- `precipitation_hours` — hours with precipitation
- `temperature_2m_min` — minimum temperature °C
- `temperature_2m_max` — maximum temperature °C
- `wind_gusts_10m_max` — maximum wind gusts km/h
- `snowfall_sum` — snowfall in cm (converted to mm: `snow_mm = snow_cm × 10`)

Timezone: `Europe/Amsterdam`.

### Caching and Fallback

Fetch logic follows a three-tier priority:

1. **Fresh cache** (`data/cache/weather/<location>_<kind>.json`): if the cache file is younger than 12 hours, it is returned without an API call.
2. **Live API**: if the cache is stale or absent, the API is called and the response is written to cache.
3. **Stale cache**: if the API call fails, the most recent cache file is returned regardless of age.
4. **Bundled fallback** (if all of the above fail): JSON or CSV files from a prior analysis session are loaded as a last resort. These are sourced from `PRIOR_WORK` defined in `pipeline/config.py`.

The fallback path ensures the pipeline can run in environments without internet access (e.g. air-gapped demos), at the cost of potentially stale weather data.

Archive and live-forecast data are merged into a single daily series: forecast rows overwrite archive rows for the same date.

---

## Proxy Locations

| Code | Name | Latitude | Longitude | Used For |
|---|---|---|---|---|
| `brunssum` | Brunssum (NL) | 50.9472 | 5.9714 | Peter Ummels — confirmed HQ location (Boschstraat 28C, 6442 PB Brunssum) |
| `maastricht` | Maastricht (NL) | 50.8514 | 5.6910 | Opco A, Opco C, Company E — South Limburg proxy |

Both locations are in the southern tip of the Netherlands, approximately 18 km apart. The weather at both sites is similar (same climate zone, similar orographic exposure). The location for the three non-Ummels companies is an assumption — the source files do not contain address information.

---

## Weekly Feature Engineering

After fetching daily data, the pipeline aggregates to weekly features (ISO Monday as the week key).

### Workday Definition

Workdays are Monday through Friday (`weekday in [0, 1, 2, 3, 4]`). Weekend rain is not counted in any of the below metrics.

### Features Computed

| Feature | Formula | Purpose |
|---|---|---|
| `rain_sum` | Sum of daily `rain_sum` for all 7 days | Total weekly precipitation |
| `workday_rain_sum` | Sum of `rain_sum` for Mon–Fri only | Continuous load component |
| `rain_days_2mm` | Count of workdays where `rain_sum >= 2.0mm` | Minor rain events |
| `rain_days_5mm` | Count of workdays where `rain_sum >= 5.0mm` | Heavy rain events |
| `bad_workdays` | Count of workdays where `rain >= 5mm OR gust >= 60 km/h OR snow >= 1mm` | Truly bad roofing days |

### Delay Score

```
delay_score = 2.0 × rain_days_2mm
            + 2.0 × rain_days_5mm
            + 3.0 × bad_workdays
            + 0.15 × workday_rain_sum
```

Range: 0 to approximately 40 in extreme weeks.

Rationale for each term:
- `rain_days_2mm`: minor rain events cause productivity loss; each adds 2 points.
- `rain_days_5mm`: heavy rain is stacked on top of the 2mm count — a day with >= 5mm counts for both; each adds an additional 2 points (4 total for >= 5mm days).
- `bad_workdays`: days that likely cause a full halt (rain >= 5mm OR gust >= 60 km/h OR snow >= 1mm); highest weight at 3 points per day.
- `workday_rain_sum`: a continuous load component capturing "soggy weeks" even if no single day crosses a threshold; 0.15 per mm.

### Risk Classification

Risk level is assigned in the forecast engine (`lib/forecast/weather.ts`) based on `bad_workdays` (scaled by `weatherIntensity`):

| Expected bad workdays (after intensity scaling) | Risk level |
|---|---|
| >= 3 | High |
| == 2 | Medium |
| 0–1 | Low |

In the `wet_quarter` scenario, `weatherIntensity = 1.5` scales the expected bad-workday count up by 50%, moving more weeks into the high-risk tier.

---

## Live vs Seasonal Split

The 13-week forecast horizon uses:

- **Live Open-Meteo forecast** for near-term weeks where the live API provides data (typically 2–3 weeks, up to 16 days ahead).
- **ISO-week seasonal climatology** for the remaining weeks: the median weather features for that ISO week number across all historical years (2023–).

A week is marked `is_live_weather = 1` if any day in the week is covered by the live forecast response. The UI shows a "live weather" pill on weeks with live data and a "seasonal" pill on climatology weeks.

This split is visible in `weather_weekly.source` (`live-forecast` vs `historical`) and in `forecast_weeks.is_live_weather`.

---

## Lag Analysis — Findings and Statistical Caveats

`pipeline/stats.py` computes the lagged relationship between weather predictors and subsequent revenue for Peter Ummels (Brunssum), Opco A (Maastricht), and Opco C (Maastricht).

### Methodology

1. **Lag table (lags 0–8):** Pearson r between a weather predictor in week t and raw revenue in week t+lag. Predictors: `rain_days_2mm`, `bad_workdays`. Targets: `revenue_net`, `credit_total`.

2. **Wet vs dry comparison:** Classify weeks as WET (`rain_days_2mm >= 3`, approximately the 75th percentile) or DRY (`rain_days_2mm == 0`, approximately the 25th percentile). Compare the mean revenue deviation from the rolling baseline (`rev_delta_pct = (revenue_net − baseline_revenue) / |baseline_revenue|`) at each lag. `pct_diff = wet_mean − dry_mean` is an absolute difference of deviations, not a ratio.

3. **Year-by-year robustness (lag 5):** Per-year quartile thresholds are used (not the global thresholds) to avoid small group sizes in years with few zero-rain weeks.

4. **Permutation test:** Two-sided, 5,000 shuffles, no scipy dependency. Tests H₀: the wet and dry groups are drawn from the same distribution.

### Key Findings — Peter Ummels (Brunssum)

**Lag table (Pearson r on raw weekly revenue, n = 163 weeks):**

| Lag | r (rain_days_2mm vs revenue_net) | r (bad_workdays vs revenue_net) |
|---|---|---|
| 0 | −0.026 | −0.173 |
| 1 | +0.102 | −0.102 |
| 2 | −0.030 | −0.070 |
| 3 | −0.087 | −0.016 |
| 4 | +0.010 | −0.064 |
| 5 | −0.085 | −0.117 |
| 6 | −0.046 | −0.024 |
| 7 | +0.105 | +0.062 |
| 8 | −0.039 | −0.036 |

All |r| values are well below 0.30. The strongest is r ≈ −0.173 at lag 0 for `bad_workdays` vs `revenue_net`.

**Wet vs dry comparison (rev_delta_pct, WET = rain_days_2mm >= 3, DRY = 0):**

| Lag | wet_mean | dry_mean | pct_diff | p_value | n_wet | n_dry |
|---|---|---|---|---|---|---|
| 3 | +0.211 | +0.275 | −0.064 | 0.811 | 46 | 48 |
| 4 | +0.284 | +0.396 | −0.111 | 0.615 | 45 | 48 |
| 5 | +0.179 | +0.526 | −0.347 | 0.185 | 45 | 47 |
| 7 | +0.265 | +0.468 | −0.203 | 0.500 | 45 | 45 |

**Year-by-year at lag 5:**

| Year | pct_diff | n_wet | n_dry |
|---|---|---|---|
| 2023 | −0.071 | 17 | 16 |
| 2024 | −0.485 | 17 | 19 |
| 2025 | −0.237 | 15 | 24 |

The signal is present in 2024 and 2025 but not in 2023.

### Statistical Caveats (Read Before Using)

The weather model is an honest risk signal, not a causal law. The key caveats are:

1. **Correlation is weak.** All Pearson |r| values are below 0.30 across all lags, predictors, and companies. The raw correlation between weather and revenue is small compared to other drivers.

2. **The timing signal is more reliable than the magnitude.** The directional pattern (dip ≈ lag 3–5, partial catch-up ≈ lag 7) is consistent across 2024 and 2025. The magnitude of the shift (the −0.35 pct_diff at lag 5) is data-dependent and should not be taken at face value.

3. **p-values are marginal.** The strongest finding (lag 5, pct_diff ≈ −0.35 in the latest run) has p ≈ 0.185 by permutation test. This does not clear a conventional significance threshold. The earlier analysis session found p ≈ 0.065 — the variation shows the result is sensitive to data vintage and random seed.

4. **Other factors dominate.** Project pipeline, invoicing cycles, seasonality, and client payment behaviour account for most of the revenue variance. Weather is one signal among many.

5. **Not all companies show the signal.** Opco A and Opco C (Maastricht proxy) show mixed results. Opco C has a stronger signal at lag 6 (r ≈ −0.22) rather than lag 5.

6. **The model uses the signal for timing only.** The 25%/12% shift shares applied in the forecast are inferred from the data. They shift the timing of projected billing, not the total volume of work. Delayed billing is caught up over weeks +4..+7 (or beyond the 13-week window in bad-scenario cases). This is framed explicitly in the UI as a suggestive signal, not a guarantee.

### What the Signal Is Used For

The wet/dry timing signal supports one operational decision: when to expect billing slippage and whether to accelerate collection efforts or defer discretionary spend in the weeks following a bad-weather window. It is not used to predict revenue downturns.
