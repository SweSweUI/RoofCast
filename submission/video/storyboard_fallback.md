# Altis Platform Demo Video — Storyboard

**File:** `submission/video/altis_demo.mp4`  
**Spec:** 1920×1080, 30 fps, 2460 frames = 82 seconds  
**Composition:** `AltisDemo` (single Remotion composition)  
**Palette:** Ink `#0f172a` · Teal `#0d9488` · Amber `#b45309` · Risk-red `#b91c1c`

---

## Scene Map

| Beat | Time | Frames | Label |
|------|------|--------|-------|
| Intro | 0–3 s | 0–90 | Title card |
| Beat 1 | 3–15 s | 90–450 | Fragmented data |
| Beat 2 | 15–27 s | 450–810 | One source of truth |
| Beat 3 | 27–40 s | 810–1200 | Weather insight |
| Beat 4 | 40–54 s | 1200–1620 | 13-week forecast |
| Beat 5 | 54–66 s | 1620–1980 | Role dashboards |
| Beat 6 | 66–76 s | 1980–2280 | Risk + traceability |
| Beat 7 | 76–82 s | 2280–2460 | Honest close |

Cross-fades: 12 frames (0.4 s) between each scene. Progress bar runs the full width of the screen.

---

## Beat-by-Beat Storyboard

### INTRO — 0–3 s (frames 0–90)

**Background:** Dark radial gradient, ink `#0f172a` → deep navy.

**Animation sequence:**
- Frame 0–30: Altis logo (teal rounded square with A-frame/peak SVG icon) springs in from scale 0→1 with spring damping 14.
- Frame 20–40: Tagline fades in: "FINANCIAL INTELLIGENCE PLATFORM" (teal, uppercase, tracked).
- Frame 40–60: Subtitle fades in: "Weather-aware billing-to-cash forecasting for construction portfolios" (slate-gray, 18px).

**On-screen text:**
> ALTIS
> Financial Intelligence Platform
> Weather-aware billing-to-cash forecasting for construction portfolios

**Narration (voice-over concept):** "Meet Altis — a financial intelligence platform purpose-built for multi-entity construction portfolios."

---

### BEAT 1 — Fragmented Data — 3–15 s (frames 90–450)

**Background:** Flat ink `#0f172a`.

**Animation sequence:**
- Frame 0–20 (local): Title block fades in.
- Frame 15–50 (local): 4 system cards spring-in staggered (0, 8, 16, 24 frame delays), scale 0→1, spring damping 12.
- Frame 50–70 (local): Red separator line + disclaimer text fades in.

**On-screen text:**
> THE CHALLENGE
> 4 Operating Companies.
> 4 Separate Accounting Systems.
> No unified view. No shared model. No cash visibility.

**System cards (4 columns):**
| System | Opco | Transactions |
|--------|------|-------------|
| Snelstart (teal border) | Roofing NL | 2,841 |
| Exact GL (amber border) | Infra BE | 3,102 |
| Gilde ERP (purple border) | Civil NL | 2,417 |
| Invoice DB (blue border) | Maintenance | 1,598 |

**Bottom callout (risk-red):** "No shared data model — reconciliation done manually in Excel"

**Narration:** "Four operating companies. Four separate accounting systems. Snelstart, Exact-style GL, Gilde ERP, and a standalone invoice database — none talking to each other."

---

### BEAT 2 — One Source of Truth — 15–27 s (frames 450–810)

**Background:** Gradient ink → deep navy.

**Animation sequence:**
- Frame 0–20 (local): Title and header fade in.
- Frame 20–40 (local): Pipeline diagram animates — four source boxes → animated connecting line grows → "ALTIS MODEL" pill springs in.
- Frame 30–60 (local): Three KPI counters animate from 0 up (spring easing, damping 20):
  - Transactions: **9,958** (teal, large)
  - Volume: **€36.7M** (amber)
  - Opcos: **4** (white)

**On-screen text:**
> ONE SOURCE OF TRUTH
> All 4 companies reconciled into one unified data model
>
> 9,958 transactions reconciled — Peter Ummels, lead reconciler
> €36.7M total volume modelled — across all 4 opcos
> 4 opcos integrated — single ledger, single model

**Narration:** "Altis ingests, normalizes, and reconciles all four sources into one unified model. Nine thousand nine hundred and fifty-eight transactions. Thirty-six point seven million euros. One ledger."

---

### BEAT 3 — Weather Insight — 27–40 s (frames 810–1200)

**Background:** Radial gradient, dark blue-navy.

**Animation sequence:**
- Frame 0–20 (local): Header and subtitle fade in.
- Frame 20–40 (local): Chart area fades in.
- Frame 30–65 (local): 6 lag-profile bars animate up/down from baseline, staggered (5 frame delay each), spring damping 18.
- Right panel: Two callout cards fade in with mechanism + statistical note.

**Lag profile chart — billing delta vs. rain workdays:**
| Lag | Delta | Note |
|-----|-------|------|
| t+1 | −3 pp | |
| t+2 | −7 pp | |
| t+3 | −12 pp | Peak delay (risk-red bar) |
| t+4 | +16 pp | Catch-up surge (teal bar) |
| t+5 | −7 pp | Fade-out |
| t+6 | +2 pp | |

**On-screen text:**
> WEATHER × CASH — CAUSAL INSIGHT
> Rain workdays delay roofing milestones
> → delayed billing → delayed cash-in
> Correlation suggestive, **not causal** (p ≈ 0.07–0.19)
>
> MECHANISM: Roofing cannot proceed on wet days → milestone completion slips
> → invoice trigger delays → cash receipt lags 3–5 weeks
>
> STATISTICAL NOTE: p ≈ 0.07–0.19 across lag windows.
> Pattern is suggestive — incorporated as scenario driver, flagged as uncertain.

**Narration:** "Here's the insight: rain workdays correlate with billing delays. The mechanism is intuitive — roofing can't proceed in wet conditions, milestones slip, invoices are late, and cash comes in three to five weeks later. The correlation is suggestive, p between zero-point-oh-seven and zero-point-nineteen — we flag it as uncertain in every output."

---

### BEAT 4 — 13-Week Forecast — 40–54 s (frames 1200–1620)

**Background:** Flat ink.

**Animation sequence:**
- Frame 0–20 (local): Header and top-right covenant badge fade in.
- Frame 20–60 (local): 13 bar-pair columns animate up staggered (3 frame delay per column), spring damping 20.
- Colored dot above each column: teal (positive net) or risk-red (negative).
- Frame 50–70 (local): 4 assumption tiles slide up (fade in).

**Chart:** 13 weekly columns, each with two bars:
- Teal bar = cash in (peaks at €455k week 13)
- Risk-red bar = cash out (stable ~€300–320k)
- Net dot color indicates week health

**On-screen text:**
> 13-WEEK BILLING-TO-CASH FORECAST
> Portfolio Base Scenario — Net ≈ **€2.29M**
> Min liquidity floor: €2.1M
>
> [Chart — 13 weeks, cash in vs cash out bars]
>
> Explicit assumptions:
> Payment terms: Net 30–45 days
> Cash-out drivers: Wages, materials, subcon
> Opening cash: €2.4M (modelled)
> Covenant floor: €2.1M minimum
>
> *(€k per week — model output, not real bank cashflow)*

**Narration:** "The thirteen-week forecast. Base scenario net: two-point-two-nine million euros. Minimum liquidity floor: two-point-one million. Every input is explicit — payment terms, cash-out drivers, covenant floor, opening cash. This is a model output. Not real bank cashflow."

---

### BEAT 5 — Role Dashboards — 54–66 s (frames 1620–1980)

**Background:** Flat ink.

**Animation sequence:**
- Frame 0–20 (local): Header fades in.
- Frame 20–50 (local): 4 role cards slide up from y+30 staggered (6 frame delay), opacity 0→1.
- Frame 40–60 (local): Scenario comparison bar chart animates in (3 bars, staggered).

**Role cards:**
| Role | Color | Access | Key stats | Scenarios |
|------|-------|--------|-----------|-----------|
| CFO (briefcase) | Teal | Full portfolio | Net 13w: €2.29M / Covenant margin: +€0.19M | base / wet / dry |
| PE Board (chart) | Amber | Portfolio + risk | Weeks at risk (wet): 7/13 / Coverage ratio: 1.09× | base / wet / dry |
| Opco MD (hard hat) | Purple | Own opco only | Billing this week: €445k / Cash in W+2: €360k | base only |
| Project Lead (clipboard) | Blue | Own projects | Milestone delay: −3 days / Invoice risk: Medium | milestone view |

**Scenario comparison (weeks at covenant risk):**
| Scenario | Weeks at risk |
|----------|--------------|
| Dry quarter | 2 |
| Base case | 3 |
| Wet quarter | 7 |

**On-screen text:**
> ROLE-BASED DASHBOARDS — LOGIN + RBAC
> Every stakeholder sees exactly their view
>
> SCENARIO IMPACT — weeks at covenant risk
> Wet quarter: weeks-at-risk 3 → 7 (+133% vs base)
> Scenario driver: rain workday forecasts from KNMI

**Narration:** "Four role-based views behind login and RBAC. The CFO sees the full portfolio. The PE board sees risk. The opco MD sees their own numbers only. The project lead sees milestones. In a wet quarter, weeks-at-risk triples from three to seven."

---

### BEAT 6 — Risk + Traceability — 66–76 s (frames 1980–2280)

**Background:** Flat ink.

**Animation sequence:**
- Frame 0–20 (local): Header fades in.
- Frame 20–52 (local): 8 risk signal cards scale in staggered (4 frame delay each), spring damping 16.
- Frame 50–70 (local): Right-side audit trail chain fades + slides in (5 items, 5 frame stagger).

**8 Risk signals:**
| # | Signal | Category | Confidence |
|---|--------|----------|-----------|
| 1 | Rain forecast >3 days next week | Weather | 82% (teal) |
| 2 | Milestone slip >5 days (Roofing NL) | Operations | 74% (teal) |
| 3 | Invoice trigger delay ≥2 weeks | Billing | 68% (amber) |
| 4 | Cash-in lag exceeds 45 days (Exact GL) | Receivables | 71% (amber) |
| 5 | Covenant floor breach W5–W7 | Liquidity | 61% (amber) |
| 6 | Subcontractor payroll pressure (Gilde) | Cash-out | 56% (risk-red) |
| 7 | Wet workdays t+3 catch-up spike | Weather | 77% (teal) |
| 8 | Material cost overrun >8% | Cost | 48% (risk-red) |

**Audit trail chain (right column):**
1. Source txns — 9,958 reconciled
2. Drivers — Rain, milestones, terms
3. Assumptions — Net 30–45, floor €2.1M
4. Forecast — 13-week per week
5. Audit trail — Every number sourced

**On-screen text:**
> RISK SIGNALS + FULL TRACEABILITY
> 8 weather-to-cash risk signals.
> Every number traces to source.
>
> AUDIT TRAIL: Source txns → Drivers → Assumptions → Forecast → Audit trail

**Narration:** "Eight weather-to-cash risk signals, each with a per-week confidence score. And full traceability: every number in every dashboard traces back through drivers, assumptions, and source transactions. Nothing is a black box."

---

### BEAT 7 — Honest Close — 76–82 s (frames 2280–2460)

**Background:** Deep gradient ink → near-black.

**Animation sequence:**
- Frame 0–15 (local): Background opacity fades in.
- Frame 5–20 (local): Main statement springs in (scale 0→1, damping 14).
- Frame 20–35 (local): Sub-statement fades in.
- Frame 35–50 (local): "Decision-support layer" line fades in (teal).
- Frame 50–70 (local): Amber disclaimer box fades in.
- Frame 65–85 (local): Teal governance box fades in.
- Frame 80–100 (local): Altis logo footer fades in.

**On-screen text:**
> A **weather-aware** billing-to-cash forecast
> on **explicit, auditable assumptions**
>
> Not a replacement for your accountant or bank.
> Not real bank cashflow data.
>
> A decision-support layer that makes the invisible, visible.
>
> IMPORTANT NOTE:
> All forecasts are model outputs built on explicit assumptions (payment terms, cash-out
> drivers, covenant floors). Weather correlation is suggestive (p ≈ 0.07–0.19), not causal.
> Altis does not report real bank cashflow data.
>
> DATA GOVERNANCE:
> Demo data is deleted within 3 days of hackathon evaluation.
> No financial data is retained beyond the agreed window.
>
> ALTIS — Financial Intelligence Platform

**Narration:** "Altis is a weather-aware billing-to-cash forecast built on explicit, auditable assumptions. Not a replacement for your bank or accountant. Not real bank cashflow data. A decision-support layer that makes what was invisible, visible. Demo data deleted within three days."

---

## Technical Notes

- **Render command:** `cd video && npx remotion render AltisDemo ../submission/video/altis_demo.mp4 --concurrency 2`
- **Render result:** SUCCESS — 2460/2460 frames rendered and encoded
- **Output file:** `/Users/sweder/hackaton v2/submission/video/altis_demo.mp4`
- **File size:** 6.8 MB
- **Duration:** 82.00 seconds at 30 fps
- **Resolution:** 1920×1080 (full HD)
- **Codec:** H.264

## Project Structure

```
video/
├── .gitignore          (ignores node_modules/, out/, .remotion/)
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts         (registerRoot)
    ├── Root.tsx         (Composition: AltisDemo, 2460 frames, 30fps, 1920×1080)
    ├── AltisDemo.tsx    (sequencer: 8 scene layers with cross-fades + progress bar)
    ├── theme.ts         (COLORS, BEATS, s() helper)
    └── scenes/
        ├── Intro.tsx
        ├── Beat1FragmentedData.tsx
        ├── Beat2OneSource.tsx
        ├── Beat3Weather.tsx
        ├── Beat4Forecast.tsx
        ├── Beat5Dashboards.tsx
        ├── Beat6Risk.tsx
        └── Beat7Close.tsx
```

## Data Integrity Statement

All figures in the video are **model outputs** derived from data provided during the hackathon:
- 9,958 transactions and €36.7M volume: reconciled by Peter Ummels across 4 opcos
- Weather lag profile: suggestive correlation only, p ≈ 0.07–0.19, not causal
- 13-week cash forecast: built on explicit assumptions, not real bank cashflow
- Risk confidence scores: model-generated, not actuarial guarantees
- Demo data will be deleted within 3 days per DATA_HANDLING.md governance
