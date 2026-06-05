# Forecast Backtest Summary

---

## What "Backtest" Means Here

This is not a classical out-of-sample backtest of a predictive model. The forecast engine produces a *forward-looking* billing-to-cash projection; there is no historical cash-flow series to compare it against (no bank statements were provided).

What the statistics module (`pipeline/stats.py`) does instead is reproduce the **historical lag profile** between weather events and subsequent billing: does a wet week at time t predict lower billing at t+lag? The answer is: **directionally yes at lags 3–5, but the signal is weak and only marginally statistically significant.** This lag profile is what justifies using weather as a *timing risk signal*, not a causal forecasting variable.

---

## Methodology

1. **Lag table:** Pearson r between a weather predictor in week t and raw revenue (`revenue_net`, `credit_total`) in week t+lag, for lags 0–8. Two predictors: `rain_days_2mm` (workdays with ≥2mm rain) and `bad_workdays` (workdays meeting the bad-roofing threshold: rain ≥5mm OR gust ≥60 km/h OR snow ≥1mm).

2. **Wet vs dry comparison:** Classify weeks as WET (`rain_days_2mm >= 3`, approximately the 75th percentile) or DRY (`rain_days_2mm == 0`, approximately the 25th percentile). Compute the mean revenue deviation from the 8-week rolling baseline (`rev_delta_pct`) at each lag for each group. `pct_diff = wet_mean − dry_mean` is an absolute difference of deviations (dimensionless), not a ratio.

3. **Year-by-year robustness at lag 5:** Per-year quartile thresholds (not global) to avoid small group sizes. Tests whether the lag-5 signal is consistent across years.

4. **Permutation test:** Two-sided, 5,000 shuffles. Tests H₀: the wet and dry groups are drawn from the same distribution.

---

## Peter Ummels (Brunssum) — n = 163 weeks

### Lag Table (Pearson r, raw weekly revenue)

| Lag | r (rain_days_2mm vs revenue_net) | r (bad_workdays vs revenue_net) |
|---|---|---|
| 0 | −0.026 | **−0.173** |
| 1 | +0.102 | −0.102 |
| 2 | −0.030 | −0.070 |
| 3 | −0.087 | −0.016 |
| 4 | +0.010 | −0.064 |
| 5 | −0.085 | −0.117 |
| 6 | −0.046 | −0.024 |
| 7 | +0.105 | +0.062 |
| 8 | −0.039 | −0.036 |

Strongest: r = −0.173 at lag 0 (`bad_workdays` vs `revenue_net`). All |r| values well below 0.30.

### Wet vs Dry Comparison (rev_delta_pct)

WET = `rain_days_2mm >= 3`; DRY = `rain_days_2mm == 0`

| Lag | wet_mean | dry_mean | pct_diff | p_value | n_wet | n_dry |
|---|---|---|---|---|---|---|
| 3 | +0.211 | +0.275 | −0.064 | 0.811 | 46 | 48 |
| 4 | +0.284 | +0.396 | −0.111 | 0.615 | 45 | 48 |
| **5** | **+0.179** | **+0.526** | **−0.347** | **0.185** | **45** | **47** |
| 7 | +0.265 | +0.468 | −0.203 | 0.500 | 45 | 45 |

The lag-5 finding (pct_diff ≈ −0.35) is the strongest signal: wet weeks are followed by billing approximately 35 percentage points below the rolling baseline compared to dry weeks. However, p = 0.185 — this does not clear a conventional significance threshold.

### Year-by-Year at Lag 5

| Year | pct_diff | n_wet | n_dry |
|---|---|---|---|
| 2023 | −0.071 | 17 | 16 |
| 2024 | **−0.485** | 17 | 19 |
| 2025 | −0.237 | 15 | 24 |

The signal was present in 2024 (strong) and 2025 (moderate) but near zero in 2023. This year-to-year inconsistency is a material caveat.

---

## Opco A (Maastricht) — n = 172 weeks

Strongest lag: r = −0.186 at lag 1 (`bad_workdays` vs `revenue_net`). Wet/dry comparison at lag 5 shows pct_diff = +0.035 (p = 0.827) — no signal. Lag 7 shows pct_diff = +0.295 (p = 0.048), which is significant but in the *opposite* direction to Peter Ummels, suggesting opco-specific invoicing cycles dominate. Year-by-year lag-5 is inconsistent (2023: +0.484; 2024: −0.252; 2025: −0.095).

---

## Opco C / Gilde (Maastricht) — n = 170 weeks

Strongest lag: r = −0.217 at lag 6 (`bad_workdays` vs `revenue_net`). Wet/dry at lag 5: pct_diff = −0.188 (p = 0.269). Year-by-year lag-5 is more consistent than Ummels (2023: −0.171; 2024: −0.166; 2025: −0.020) but still not statistically significant. The strongest signal is at lag 6, not lag 5 — consistent with a different billing cycle.

---

## Statistical Caveats (Read Before Using)

1. **All |r| values are below 0.30.** The Pearson correlations are uniformly weak across all lags, predictors, and companies. Weather explains a small fraction of weekly revenue variance.

2. **p-values are marginal.** The strongest finding (Ummels lag 5, pct_diff ≈ −0.35) has p ≈ 0.185. The earlier analysis session found p ≈ 0.065 — variation with data vintage and random seed shows sensitivity. Neither clears p < 0.05.

3. **The timing direction is more reliable than the magnitude.** The directional pattern — dip at lags 3–5, partial catch-up at lag 7 — is consistent across 2024 and 2025 for Ummels. The magnitude (−0.35 pct_diff) should not be taken at face value for planning purposes.

4. **Year-to-year inconsistency.** The signal was absent in 2023 for Ummels and inconsistent for Opco A. This suggests that project pipeline, invoicing cycles, and seasonal effects dominate in some years.

5. **Not all companies show the same signal.** Opco A and Opco C have different lag structures; Opco A's significant result at lag 7 is in the opposite direction. A single timing shift applied uniformly across all companies is a simplification.

6. **This is not a guarantee.** The permutation test result cannot be used to guarantee future billing behaviour. It supports one operational use case: when to expect *possible* billing slippage and whether to take pre-emptive collection or spending action.

---

## How the Signal Is Used in the Forecast

The lag profile supports one operational decision: the **timing shift** applied to projected billing in weeks with high or medium weather risk.

- **High risk** (3+ bad workdays): 25% of that week's billing is deferred
- **Medium risk** (2 bad workdays): 12% of that week's billing is deferred
- Deferred billing catches up over weeks +4..+7 (catch-up weights: [0.30, 0.25, 0.25, 0.20])

These shares were inferred from the lag analysis (the pct_diff figures above, adjusted for the difference between raw deviations and the billing shift share). They shift the *timing* of cash — not the total volume of work. Delayed billing that lands beyond week 13 is tracked as `spillBeyondHorizon`.

The UI explicitly labels this as a suggestive risk signal (`lib/forecast/risks.ts`, LAG_PROFILE constant) and the Methodology panel displays the statistical caveats.

---

## Summary

The historical lag analysis reproduces a **directional timing signal**: wet weeks tend to be followed by below-baseline billing at lags 3–5, with partial catch-up around lag 7. The signal is consistent in 2024 and 2025 for the most data-rich company (Peter Ummels) but is not statistically robust (p ≈ 0.07–0.19), is absent in 2023, and is inconsistent or reversed for the other two companies.

**The weather model is a risk overlay for timing decisions, not a revenue prediction engine.** It provides a structured way to ask: "if weather is bad this week, when should we expect billing to be tight?" — not "how much revenue will we lose?"
