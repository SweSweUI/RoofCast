# Verification Report — Altis Platform Handoff

Date: 2026-06-05 · Verifier: continuing agent (did not trust prior "done" claims).

## Commands run + results

| Command | Result |
|---|---|
| `git status --short --branch` | `## master`, working tree **clean** (all committed; data/secrets gitignored) |
| `npm test` | ✅ **7 engine tests pass, 8 pipeline tests pass**, 0 fail |
| `npm run build` | ✅ **build succeeds** — all routes compile, middleware 82 kB |

## What EXISTS and works (verified)

- **Web app** (Next.js 14): role views `/cfo /board /opco /project /methodology /data-quality /admin`, scenario toggles (base/wet/dry), traceability drawer, weather calendar, charts. Production build passes.
- **Supabase backend**: `altis_*` schema + RLS + `altis_profiles`; data loaded (32,278 txns, 195 forecasts, 1,239 trace links); 5 demo accounts. `backend:supabase` confirmed via `/api/health`.
- **Auth + RBAC**: Supabase Auth login, `middleware.ts` gating (unauth `/cfo`→307→`/login`, `/api/*`→401), 5 roles with per-role nav + route redirect. Verified in-browser.
- **iOS app** (`ios/`): SwiftUI + supabase-swift, BUILD SUCCEEDED, runs in iPhone 17 simulator.
- **Data pipeline**: ingest/weather/stats/push, dedup anchor (Ummels 9,958 / €36.7M).
- **Governance**: `DATA_HANDLING.md`, `scripts/purge.sh`, `pipeline/purge_supabase.py`, in-app banner, `.gitignore` clean.
- **Docs**: `README.md`, `docs/{data_inventory,schema,forecast_model,weather_model,deployment,supabase,ios}.md`.

## What is MISSING (the prior "done" claims that were NOT true)

| Claimed | Reality | Action |
|---|---|---|
| Risk-first dashboard / risk cards | **MISSING** — no Weather Billing / Cash-In Delay / Payment Terms / Cash-Out Assumption / Covenant / Data Quality / Forecast Confidence / Opco Underperformance cards | Build risk engine + cards (Round C) |
| Forecast confidence per week | **MISSING** | Add confidence to engine + UI (Round C) |
| `submission/` package + docs | **MISSING** (no folder) | Create all 8 submission docs (Round D) |
| Screenshots folder | **MISSING** (only `ios/screenshot.png`) | Capture 12 real screenshots via Playwright (Round D) |
| Remotion video project / MP4 | **MISSING** (no `video/`) | Build Remotion project + render or storyboard fallback (Round E) |
| `.github/workflows/ci.yml` | **MISSING** | Add CI (Round E) |
| `ios/README_APP_STORE_PREP.md` | **MISSING** | Create (Round E) |
| Public deployment / URL | Not deployed (no Vercel auth) | Prepare `vercel.json` + docs; URL needs user's Vercel login (Round E) |

## What is BROKEN

- Nothing failing tests/build. The gaps are **missing features/assets**, not regressions.

## Forecast framing (truth check)

Current framing is already honest (revenue/billing-only source data; cash-out/opening cash/covenants are configurable assumptions; weather is a "risk signal, not causal"). Round C will sharpen the **billing-to-cash** chain wording and add explicit forecast-confidence, per this prompt's "Absolute Product Truth".

## Plan

- **Round B (Repair):** none needed for tests/build; reinforce billing-to-cash framing where surfaced.
- **Round C (Risk product):** risk engine (8 signals) + risk-first cards + per-week confidence + the lag-profile numbers labelled suggestive.
- **Round D (Submission):** 8 submission docs + 12 real screenshots (Playwright, incl. mobile).
- **Round E (Video/CI/AppStore/Deploy):** Remotion project (+ storyboard fallback), CI workflow, app-store prep doc, Vercel deployment prep.
- **Round F (Final QA):** test + build, no secrets/data, assets present, docs truthful, commit.

## Resolution (all gaps closed)

| Gap | Status |
|---|---|
| Risk-first UI / 8 risk cards | ✅ `lib/forecast/risks.ts` + `RiskOverview` on CFO/Board/Opco; verified in-browser |
| Forecast confidence per week | ✅ in engine + week table + risk API |
| `submission/` package (8 docs) | ✅ created, numbers verified, honest framing |
| Screenshots (12) | ✅ real Playwright captures in `submission/screenshots/` |
| Remotion video | ✅ `submission/video/altis_demo.mp4` (82s, 1080p) + storyboard fallback; overclaiming header fixed |
| `.github/workflows/ci.yml` | ✅ green on clean checkout (TS tests + build; python skips w/o DB) |
| `ios/README_APP_STORE_PREP.md` | ✅ created |
| Public deployment | ⚠️ prepared (`vercel.json` + docs); **no live URL** — `vercel` CLI not installed / not authed, needs owner's Vercel login |
| Overclaiming check | ✅ billing-to-cash framing throughout; "no bank cashflow / suggestive not causal" in app, docs, video |

**Bug fixed during QA:** Payment Terms Risk reported a directional "falls" with an unreliable sign (pre-horizon carry-in distorts direction) → changed to sensitivity *magnitude*.

Final: `npm test` 7+8 green · `npm run build` passes · no secrets/data committed · commits `7ce5f69` (risk) + `e1f265a` (submission).
