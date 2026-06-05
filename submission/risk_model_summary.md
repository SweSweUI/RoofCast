# Risk Model Summary

---

## The Billing-to-Cash Chain

The platform models cash risk through one causal chain:

> **weather risk → work/milestone delay → billing delay → cash-in delay through payment terms**

Weather is a **risk/scenario overlay** applied to a standard run-rate + seasonality forecast. It shifts the *timing* of projected billing — it does not predict revenue loss. The statistical relationship is **suggestive, not causal** (see `forecast_backtest_summary.md`).

---

## The 8 Risk Signals

Computed by `lib/forecast/risks.ts` from the forecast result and a context object supplied by the API layer. Each signal has a key, title, level, impacted weeks, EUR impact, confidence percentage, human-readable reason, and a trace string linking back to the source data.

---

### 1. Weather Billing Risk

**Key:** `weather_billing`

**Definition:** The number of forecast weeks carrying medium or high weather-delay risk, and the total EUR of billing shifted later in those weeks.

**How computed:** Count weeks where `weatherRisk !== 'low'` (high = 3+ bad workdays after intensity scaling; medium = 2 bad workdays). Sum `|weatherAdjustment|` over those weeks.

**Level thresholds:**
- `high` — any week has high weather risk
- `medium` — weeks with medium risk only
- `low` — no medium or high risk weeks

**EUR:** Total absolute billing shift (deferred, not lost) across all at-risk weeks.

**Confidence:** 70% if any at-risk week uses live Open-Meteo data; 55% if all weeks use seasonal climatology.

**Trace:** `weather_weekly (rain workdays) → billing timing shift. Rain workdays t→t+3 ≈ −12pp, t+4 ≈ +16pp catch-up, t+5 ≈ −7pp, t+6 ≈ −10pp; rainfall total t+1 ≈ −15pp, t+3 ≈ −18pp, t+4 ≈ +9pp, t+5/6 ≈ −16pp. Suggestive signal, not causal (p ≈ 0.07–0.19).`

---

### 2. Cash-In Delay Risk

**Key:** `cash_in_delay`

**Definition:** How much billing earned in weeks 1–4 will be collected *after* the horizon due to debtor payment terms (mean ≈ 4 weeks).

**How computed:** Sum `max(0, −paymentLagAdjustment)` for the first 4 forecast weeks. Level is `medium` if this exceeds 40% of the weekly average cash-in, otherwise `low`.

**Level thresholds:**
- `medium` — early-period deferred cash-in > 40% of mean weekly cash-in × 4
- `low` — below threshold

**EUR:** Total cash-in deferred from weeks 1–4 into later weeks or beyond the horizon.

**Confidence:** 65% (assumption-driven; no actual debtors ledger).

**Trace:** `Assumption: debtor-payment profile, mean ≈ 4 weeks (configurable).`

---

### 3. Payment Terms Risk

**Key:** `payment_terms`

**Definition:** Sensitivity of in-horizon total cash-in to an extension of debtor days by ~2 weeks.

**How computed:** Compare `totalCashIn` from the base forecast against a stress forecast with the payment-lag profile shifted +2 weeks. The delta is the EUR at risk if debtors pay later than assumed.

**Level thresholds:**
- `high` — stress delta > 10% of total cash-in
- `medium` — delta 5–10%
- `low` — delta < 5%

**EUR:** Reduction in 13-week cash-in if debtor days extend ~2 weeks.

**Confidence:** 55% (modelled sensitivity; no actual payment-terms data).

**Trace:** `Assumption sensitivity: payment-lag profile shifted +2 weeks.`

---

### 4. Cash-Out Assumption Risk

**Key:** `cash_out_assumption`

**Definition:** The risk that actual cash-out differs materially from the driver-percentage model, because no AP or cost ledger exists in the source data.

**How computed:** Always `high`. The EUR impact is the total forecast cash-out over 13 weeks. Confidence is 45% — the lowest of all signals — because this is pure assumption.

**Level:** Always `high`.

**EUR:** Total 13-week forecast cash-out (materials + subcontractor + labour + overhead, all modelled as % of production).

**Driver assumptions:** materials 32%, subcontractor 18%, labour 22%, overhead 10% of weekly production. Driver payment lags: materials 2 weeks, subcontractor 3 weeks, labour and overhead same week.

**Confidence:** 45%.

**Trace:** `Assumptions: materials/subcontractor/labour/overhead shares. Replace with real AP to remove this risk.`

---

### 5. Covenant Headroom Risk

**Key:** `covenant_headroom`

**Definition:** Whether closing cash comes within 25% of the covenant floor in any week, or breaches it.

**How computed:** Compare `covenantHeadroom` (closing cash minus configured floor) for each week. A week is "tight" if headroom < 25% of the floor.

**Level thresholds:**
- `high` — any week has negative headroom (breach)
- `medium` — any week is tight (headroom < 25% of floor) without full breach
- `low` — headroom comfortable in all weeks

**EUR:** Minimum headroom across the 13-week horizon.

**Confidence:** 60% (covenant floors and opening cash are assumptions; no actual bank or loan data).

**Trace:** `Assumption: covenant floor + opening cash (no bank balances in source data).`

**Configured covenant floors (all assumed):**
- Portfolio: €750,000 (min 13-week liquidity)
- Peter Ummels: €250,000
- Opco A: €400,000
- Opco C: €200,000

---

### 6. Data Quality Risk

**Key:** `data_quality`

**Definition:** Risk that the forecast is built on incomplete or mis-mapped source data.

**How computed:** Floored at `medium` because the source is billing-only (no bank cashflow). Elevated to `high` if the worst weekly-vs-monthly-summary reconciliation variance exceeds 20%.

**Level thresholds:**
- `high` — worst recon variance > 20%, or billing-only source with high missing data
- `medium` — billing-only source (default floor); variance 5–20%
- `low` — would require full bank + AP data (not possible with current source)

**EUR:** null (data quality is a qualitative signal).

**Confidence:** 60%.

**Trace:** `data_inventory reconciliation + missing-fields list (Data Quality view).`

---

### 7. Forecast Confidence Risk

**Key:** `forecast_confidence`

**Definition:** Mean per-week forecast confidence across the 13-week horizon.

**How computed:** Each forecast week is assigned a confidence score (higher for live-weather weeks, lower for seasonal-climatology weeks, lower still for thin history). The mean is compared against thresholds.

**Level thresholds:**
- `high` — mean confidence < 60%
- `medium` — mean confidence 60–72%, or any company has < 26 weeks of history
- `low` — mean confidence >= 72%

**EUR:** null (confidence is unitless).

**Confidence:** equal to the mean weekly confidence itself.

**Trace:** `Live-vs-seasonal weather split + history depth.`

---

### 8. Opco Underperformance Risk

**Key:** `opco_underperformance`

**Definition:** Whether any operating company is running materially below its recent billing run-rate.

**How computed:** Compare the last-8-week actual billing to the prior 18-week period. Companies running >8% below the prior-period baseline are flagged.

**Level thresholds:**
- `high` — worst company >15% below prior run-rate
- `medium` — worst company 8–15% below
- `low` — all companies within 8% of run-rate

**EUR:** Sum of the run-rate shortfall in EUR for all underperforming companies.

**Confidence:** 65%.

**Trace:** `Last-8-week actual facturation vs the prior 18 weeks (weekly_financials).`

---

## Per-Week Forecast Confidence

Each `forecast_weeks` row carries an individual `confidence` score (0–100) in addition to the aggregate signal. Factors that lower per-week confidence:

- Week is beyond the live Open-Meteo forecast window (uses seasonal climatology instead of live data)
- Company has fewer than 26 weeks of historical data (thin history)
- Week falls more than 8 weeks into the horizon (compounding uncertainty)

The UI shows a "live weather" or "seasonal" pill on each week row to indicate the weather source.

---

## Honest Framing

The 8 signals are diagnostic — they highlight where assumptions are weakest, where billing timing is most exposed to weather, and where covenant headroom is tightest. They are not predictions. The correct interpretation is:

- **Cash-Out Assumption Risk (high, always):** Do not take the cash-out numbers at face value without real AP data.
- **Weather Billing Risk:** The timing signal is directionally consistent but statistically weak. Use it to trigger operational conversations (accelerate invoicing, defer discretionary spend), not to calculate precise EUR outcomes.
- **Covenant Headroom Risk:** The floors and opening balances are assumptions. The signal shows *structural* risk if the assumptions are approximately right — but verify against actual bank statements and loan documentation before acting.
