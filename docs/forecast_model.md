# Forecast Model

The forecast engine is a pure TypeScript function in `lib/forecast/engine.ts`. It has no database access or I/O — it receives pre-loaded data and returns a typed result, making it fully unit-testable with `npm run test:forecast`.

Default parameters are defined in `lib/forecast/config.ts` and mirrored into the `assumptions` table by the Python pipeline. All values are configurable — the API layer merges user overrides on top of the defaults.

---

## The Question the Model Answers

> Given historical billing patterns, expected debtor payment timing, and weather-driven execution risk, what will weekly cash-in and cash-out look like over the next 13 weeks, and where does closing cash come closest to — or breach — the covenant floor?

---

## The 6-Layer Pipeline

The forecast is computed week by week (w = 1..13) in a single forward pass. Each layer builds on the previous one.

---

### Layer 1: Seasonal Baseline

**What:** Estimate the "normal" production/billing level for each forecast week, accounting for both the recent run-rate and ISO-week seasonality.

**How (`lib/forecast/seasonality.ts`):**

1. Compute the median weekly `credit_total` over the 8 most recent weeks of actual data (`baselineLookbackWeeks = 8`). This is the **level** — the deseasonalised run-rate.
2. Build a **seasonal index** for each ISO week number (1..53) from the historical weekly data: `seasonal_index(w) = median(revenue_in_that_iso_week) / overall_median`. Weeks with no history get index 1.0.
3. **Baseline production for forecast week w:**

```
baseline_production(w) = level × seasonal_index(iso_week(w))
```

For weeks before the forecast horizon (needed for the payment-lag carry-in), actual actuals are used where available:

```
production(w) = actual.get(week_key) ?? baseline_production(w)   if w <= 0
production(w) = baseline_production(w)                             if 1 <= w <= 13
```

**Assumption:** The 8-week rolling median is a sufficient deseasonalised baseline. Revenue-only source data; no WIP pipeline, no project backlog.

---

### Layer 2: Driver Decomposition (Cash-Out)

**What:** Decompose production into cash-out components. No cash-out GL data exists in the source exports, so drivers are configured percentages of production.

**Driver parameters (`lib/forecast/config.ts`):**

| Driver | Share of production | Payment lag |
|---|---|---|
| Materials | 32% | 2 weeks |
| Subcontractor | 18% | 3 weeks |
| Labour | 22% | 0 weeks (same week) |
| Overhead | 10% | 0 weeks (same week) |

**Formula:**

```
cash_out_driver(d, w) = adjusted_production(w − driver_lag[d]) × driver_share[d]
total_cash_out(w) = sum over d of cash_out_driver(d, w)
```

Driver lags mean materials paid in week w were produced in week w-2, subcontractors in week w-3.

---

### Layer 3: Weather-Delay Timing Shift

**What:** Shift a share of each forecast week's production/billing into future weeks when weather risk is high or medium. This models the causal chain: bad weather → execution delay → milestone delay → billing delay → cash-in delay.

**Weather risk classification (from `weather_weekly.bad_workdays`):**

| Risk level | Condition | Billing share shifted |
|---|---|---|
| High | 3+ bad roofing workdays | 25% (`weatherShiftHigh = 0.25`) |
| Medium | 2 bad workdays | 12% (`weatherShiftMedium = 0.12`) |
| Low | 0–1 bad workdays | 0% |

**Shift mechanics:**

```
shift_out(w) = baseline_production(w) × shift_share(risk_level(w))
adjusted_production(w) -= shift_out(w)

# Shifted work reappears as catch-up, spread over +4..+7 weeks:
# catchUpStartLag = 4, catchUpWeights = [0.30, 0.25, 0.25, 0.20]
for k in 0..3:
    target = w + 4 + k
    adjusted_production(target) += shift_out(w) × catchUpWeights[k]
```

Catch-up that lands beyond week 13 is tracked as `spillBeyondHorizon` — it reduces in-horizon total cash-in but represents real work that will be paid eventually.

**Honest framing:** The timing-shift shares (25% / 12%) are inferred from the lag analysis (see `docs/weather_model.md`). The statistical relationship is suggestive, not causal (p ≈ 0.065–0.19). The model shifts the *timing* of cash, not the total volume of work.

---

### Layer 4: Payment-Lag Cash-In

**What:** Convert the adjusted production/billing schedule into actual cash received, accounting for debtor payment terms.

**Debtor collection profile** (`paymentLagWeights`):

```
index:   [0,    1,    2,    3,    4,    5,    6,    7,    8   ]
weight:  [0.00, 0.00, 0.10, 0.20, 0.30, 0.20, 0.12, 0.05, 0.03]
sum = 1.00 (mean lag ≈ 4 weeks, ~30 working days)
```

**Formula:**

```
cash_in(w) = sum over lag=0..8 of:
    adjusted_production(w − lag) × paymentLagWeights[lag]
```

This is a convolution of the billing schedule with the payment profile. Pre-horizon actuals are used for w-lag values that fall before the forecast start, ensuring week 1 is realistic.

**Assumption:** Roofing/construction debtor days 30–45 days, industry default. No actual debtors-ledger data is available.

---

### Layer 5: Scenario Variants

**What:** Apply scenario-specific weather intensity to stress-test timing.

**Scenarios (`lib/forecast/config.ts`):**

| Scenario | `weatherIntensity` | Effect |
|---|---|---|
| `base` | 1.0 | Live Open-Meteo forecast for near-term weeks; ISO-week seasonal climatology beyond the live window |
| `wet_quarter` | 1.5 | ~50% more rain workdays than normal → more high-risk weeks → more billing shifted out |
| `dry_quarter` | 0.5 | ~50% fewer rain workdays → fewer risk weeks → billing received earlier |

`weatherIntensity` scales the expected rain workdays used for risk classification. It does not change the seasonal pattern of rain — it intensifies or reduces it.

**Scenarios change cash timing, not total work.** A wet quarter pushes billing beyond the 13-week window; that billing is not lost, but it dents in-horizon liquidity.

---

### Layer 6: Covenant Headroom

**What:** Compare closing cash each week against the configured covenant floor (if any).

**Formula:**

```
closing_cash(1) = opening_cash + net_cash_flow(1)
closing_cash(w) = closing_cash(w−1) + net_cash_flow(w)
covenant_headroom(w) = closing_cash(w) − covenant_threshold
risk_level = high   if headroom < 0
           = medium  if headroom < 0.25 × threshold (within 25% of breach)
           = low     otherwise
```

Risk level is also elevated by weather: a low-headroom week with high weather risk is marked medium.

**Covenant floors are configurable assumptions** — no actual loan documentation was supplied. Opening cash balances are also assumptions (no bank data in the source exports).

---

## The Trace/Explainability Contract

Every forecast week produces a `TraceLink[]` array stored in `trace_links`. The drivers are:

| Driver | Meaning |
|---|---|
| `baseline_cash_in` | Collections from baseline facturation, spread over the payment profile |
| `weather_delay` | Net EUR shifted into or out of this week by the weather timing model |
| `payment_lag` | Difference between cash collected and work billed this week |
| `materials` | Materials cash-out (negative contribution) |
| `subcontractor` | Subcontractor cash-out (negative contribution) |
| `labour` | Labour cash-out (negative contribution) |
| `overhead` | Overhead cash-out (negative contribution) |

Clicking any week in the dashboard opens the trace panel, which shows these contributions and the natural-language `explanation` string. Every number on screen can be traced to: (1) a historical transaction in the same ISO week in prior years, (2) an assumption in `pipeline/config.py`, and (3) a formula in `lib/forecast/engine.ts`.

---

## Worked Example

Peter Ummels, base scenario, week of 2026-06-09 (a representative week in the live-forecast window).

**Inputs:**
- 8-week trailing-median production level: ~€100,000/week (approximate from the ~€36.7M net revenue over ~3.5 years)
- ISO week 24 seasonal index: approximately 1.0 (mid-year, not a peak or trough)
- Weather forecast for Brunssum that week: 2 bad workdays → medium risk
- Opening cash: €600,000

**Computation:**

```
baseline_production(w) = €100,000 × 1.0 = €100,000

# Medium risk: shift 12% of billing
shift_out = €100,000 × 0.12 = €12,000
adjusted_production(w) = €100,000 − €12,000 = €88,000
# Catch-up: €12,000 split [30%, 25%, 25%, 20%] over weeks w+4..w+7

# Cash-in: payment-lag convolution of adjusted_production series
# (dominant term: 30% of week w−4 production)
forecast_cash_in ≈ €28,000 (from t−2..t−8 billings, peaking at t−4)

# Cash-out: drivers on adjusted production with lags
materials     = €88,000 × 0.32 (from week w−2) ≈ €28,160  (but uses w−2 production)
subcontractor = €88,000 × 0.18 (from week w−3) ≈ €16,560
labour        = €88,000 × 0.22 (same week)     ≈ €19,360
overhead      = €88,000 × 0.10 (same week)     ≈ €8,800
total_cash_out ≈ €72,880

net_cash_flow = €28,000 − €72,880 = −€44,880 (net negative: typical mid-payment-lag week)
closing_cash  = €600,000 − €44,880 = €555,120
covenant_headroom = €555,120 − €250,000 = €305,120  (above floor — no breach)
risk_level = medium (weather)
```

The trace panel would show:
- `baseline_cash_in`: +€28,000 — "Collections from baseline facturation (8-week run-rate × seasonal index), spread over debtor profile (peak ≈ t+4)."
- `weather_delay`: −€X,XXX — "2 expected rain workdays (live forecast) → medium delay risk; €12,000 of billing shifted to weeks +4..+7."
- `materials`, `subcontractor`, `labour`, `overhead`: negative contributions summing to −€72,880.

---

## Key Parameters Reference

All parameters are in `lib/forecast/config.ts` and mirrored to the `assumptions` table:

```typescript
horizonWeeks: 13
baselineLookbackWeeks: 8
drivers: { materials: 0.32, subcontractor: 0.18, labour: 0.22, overhead: 0.10 }
driverLagWeeks: { materials: 2, subcontractor: 3, labour: 0, overhead: 0 }
paymentLagWeights: [0, 0, 0.10, 0.20, 0.30, 0.20, 0.12, 0.05, 0.03]
weatherShiftHigh: 0.25       // 3+ bad workdays
weatherShiftMedium: 0.12     // 2 bad workdays
catchUpStartLag: 4
catchUpWeights: [0.30, 0.25, 0.25, 0.20]  // spread over w+4..w+7
weatherIntensity: 1.0 (base), 1.5 (wet_quarter), 0.5 (dry_quarter)
```

Opening cash per company (assumptions, no bank data):
- Peter Ummels: €600,000
- Opco A: €900,000
- Opco C: €450,000
- Company E: €120,000
