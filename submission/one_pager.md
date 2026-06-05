# Altis — Weather-Aware Billing-to-Cash Forecast
### One-Page Pitch

---

## The Problem

A PE-backed roofing portfolio runs four operating companies on four different accounting systems. The CFO cannot answer a simple question: *how much cash will be in the account in eight weeks?* Billing slips when it rains. Payment terms add another four-week lag. Covenant floors are fixed. None of these systems talk to each other.

---

## The Insight

Weather delays roofing execution. Execution delay causes milestone delay. Milestone delay causes billing delay. Billing delay — convolved with 30–45 day debtor terms — means cash arrives late exactly when liquidity is tightest (wet winters, early spring). The chain is:

> **weather risk → work/milestone delay → billing delay → cash-in delay through payment terms**

Historical data confirms a directional timing signal: wet weeks (3+ rain workdays) are followed, on average, 3–5 weeks later by below-baseline billing; a partial catch-up appears around week 7. The signal is **suggestive, not causal** (strongest Pearson |r| ≈ 0.17–0.22 across three companies; permutation p ≈ 0.07–0.19). It is used exclusively to shift the *timing* of projected billing — not to predict permanent revenue loss.

---

## The Solution

A **weather-aware billing-to-cash forecast platform** for the full roofing portfolio, built in 48 hours:

- **One reconciled model** from four accounting systems (Snelstart, Exact-style GL, Gilde, invoice register) — 32,278 transactions after content-hash dedup of 4,616 cross-file re-exports
- **13-week forward forecast** per company and portfolio, refreshed live on every page load
- **Three scenarios**: base (live Open-Meteo forecast), wet quarter (1.5× intensity), dry quarter (0.5× intensity)
- **8 risk signals** covering weather billing, cash-in delay, payment terms, cost assumptions, covenant headroom, data quality, forecast confidence, and opco underperformance
- **Role-specific dashboards**: CFO, PE Board, Opco MD, Project Lead, Data Quality, Methodology, Admin
- **Full traceability**: click any forecast week to see every number traced back to a source transaction, formula, and assumption
- **Native iOS app** (SwiftUI) sharing the same Supabase backend and demo accounts

---

## What is Real vs Assumed

| Real (from source data) | Assumed / configurable |
|---|---|
| 32,278 deduplicated billing/revenue transactions across 4 opcos | Opening cash balances (no bank statements) |
| Transaction-level date, amount, account, journal | Covenant floors (no loan documentation) |
| 3+ years of weekly billing history per company | Cash-out drivers (no AP/cost ledger) — materials 32%, subcontractor 18%, labour 22%, overhead 10% |
| Open-Meteo daily weather (ERA5 archive + 16-day live forecast) | Company locations for 3 of 4 opcos (South Limburg / Maastricht proxy) |
| Statistical lag profile (p ≈ 0.07–0.19, directional) | Debtor payment terms (~4-week mean) — industry default |

The platform clearly labels every assumption in the Methodology panel and in the UI.

---

## Impact

In the **wet-quarter scenario**, approximately €281k of billing is pushed beyond the 13-week horizon, minimum portfolio liquidity falls, and three of four companies enter medium or high covenant-headroom risk territory. The CFO can see this in 10 seconds — and can drill from portfolio to opco to individual week to source transaction in three clicks.

---

## Technology

Next.js 14 + TypeScript + Tailwind + Recharts · Supabase (Postgres + Auth + RLS) · SQLite local fallback · Python 3 pipeline (pandas, openpyxl, Open-Meteo) · Native iOS (SwiftUI + supabase-swift) · Node >= 22.5 (built-in `node:sqlite`) · `npm run build` passes · 15 tests green

One-command deploy: `vercel deploy` (Vercel + Supabase, credentials required).
