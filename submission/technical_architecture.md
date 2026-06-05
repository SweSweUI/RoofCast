# Technical Architecture

---

## System Overview

The platform is a **billing-to-cash forecast** built on a single shared Supabase backend, served by a Next.js 14 web app and a native iOS SwiftUI app. A Python pipeline ingests, reconciles, and enriches the accounting data; a pure TypeScript forecast engine runs on every page load.

---

## ASCII Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ DATA SOURCES (gitignored — never committed)                         │
│                                                                     │
│  portfolio company 2 data/*.xlsx   ← Peter Ummels (Snelstart)       │
│  portfolio company data/*.xlsx     ← Opco A (Exact-style GL)        │
│  datasets/Altis dataset 2.xlsx     ← Opco C (Gilde) + Company E     │
│  datasets/Altis dataset 1.xlsx     ← monthly summary (recon only)   │
└──────────────────┬──────────────────────────────────────────────────┘
                   │ npm run pipeline
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PYTHON PIPELINE (pipeline/)                                         │
│                                                                     │
│  ingest.py  — Excel parsing, account normalisation, content-hash   │
│               dedup (4,616 cross-file duplicates removed), weekly   │
│               aggregation → data/altis.db (SQLite)                  │
│                                                                     │
│  weather.py — Open-Meteo ERA5 archive + 16-day live forecast;      │
│               bad-workday classification; weekly aggregates;        │
│               12-hour on-disk cache + stale/fallback logic          │
│                                                                     │
│  stats.py   — Lag correlation (Pearson r, lags 0–8); wet/dry       │
│               comparison; permutation tests;                        │
│               → data/artifacts/stats.json                           │
│                                                                     │
│  push_supabase.py — applies supabase/schema.sql; streams SQLite    │
│               → Supabase Postgres in 1,000-row chunks; creates      │
│               5 demo auth users                                     │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DATA STORE                                                          │
│                                                                     │
│  SQLite  data/altis.db   ← local / offline / test                  │
│  Supabase Postgres       ← cloud (altis_* tables, RLS)              │
│                                                                     │
│  Async data layer (lib/data/) — single query surface; lazy-loads   │
│  Supabase OR SQLite depending on DATA_BACKEND env var              │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ TYPESCRIPT FORECAST ENGINE (lib/forecast/)                          │
│                                                                     │
│  engine.ts   — pure function, no I/O, fully unit-testable           │
│  6 layers:                                                          │
│    1. Seasonal baseline (8-week trailing median × ISO-week index)   │
│    2. Driver decomposition (cash-out = driver% × lagged production) │
│    3. Weather timing shift (25% high / 12% medium bad-workdays)     │
│    4. Payment-lag convolution (debtor profile, mean ≈ 4 weeks)      │
│    5. Scenario variants (wet ×1.5 / base ×1.0 / dry ×0.5 intensity)│
│    6. Covenant headroom (closing cash vs configured floor)           │
│                                                                     │
│  risks.ts  — 8 risk signals computed from forecast result + context │
│  snapshot.ts — persists 13×3×4 forecast rows to forecast_weeks /   │
│                trace_links tables                                    │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ NEXT.JS 14 APP ROUTER (app/(dash)/*)                                │
│                                                                     │
│  /cfo          CFO — operating cash forecast + risk signals         │
│  /board        PE Board — portfolio liquidity + covenant story       │
│  /opco         Opco MD — single-company + weather calendar          │
│  /project      Project Lead — weather calendar + billing shifts     │
│  /methodology  Assumptions panel (all from assumptions table)       │
│  /data-quality Data lineage, reconciliation, pipeline provenance    │
│  /login        Supabase Auth email/password (Supabase mode only)    │
│  Admin panel   User management + purge trigger                      │
│                                                                     │
│  API routes (app/api/) — server components read DB via lib/db.ts;  │
│  client components receive typed JSON; Recharts renders charts      │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐  ┌──────────────────────────────────────────────┐
│ Web browser      │  │ iOS app (ios/)                               │
│ (Next.js SSR +   │  │                                              │
│  client charts)  │  │  SwiftUI + supabase-swift                    │
│                  │  │  PostgREST reads: altis_forecast_weeks,       │
│                  │  │  altis_weather_weekly, altis_companies,       │
│                  │  │  altis_profiles                              │
│                  │  │  Same auth, same tables, same RLS            │
└──────────────────┘  └──────────────────────────────────────────────┘
```

---

## Supabase / Auth / RLS

All Altis objects are namespaced `altis_*` in the Supabase `public` schema, coexisting safely with the project owner's unrelated personal tables (`public.profiles`, `public.workouts`).

**RLS model:**

| Actor | Access |
|---|---|
| Unauthenticated | Blocked by RLS on all `altis_*` tables |
| Any authenticated user (`cfo`, `board`, `opco`, `project`) | `SELECT` on all `altis_*` tables |
| `admin` role (via `altis_is_admin()` security-definer function) | Can also read all `altis_profiles` rows |
| Service role (`SUPABASE_SERVICE_ROLE_KEY`) | Bypasses RLS — used only by pipeline and Next.js API routes (server-only) |

The anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is exposed to the browser in the Next.js `NEXT_PUBLIC_` namespace but is RLS-protected — it cannot read or write any Altis data without a valid user JWT.

**5 demo roles:** `cfo`, `board`, `opco`, `project`, `admin`. Each role gates its own route group and navigation items in `middleware.ts` + `lib/rbac.ts`.

---

## Async Data Layer

`lib/data/` is an async dispatcher that presents a single query surface (`query`, `queryOne`) to the rest of the app. It lazy-loads the active backend:

- `DATA_BACKEND=supabase` → Supabase JS client via PostgREST
- `DATA_BACKEND=sqlite` (default) → Node's built-in `node:sqlite` (zero-dependency, requires Node >= 22.5)

No page or component ever imports a database driver directly. The swap between backends requires no changes to application code.

---

## Database Tables (SQLite / Supabase Postgres)

15 tables total. Key tables for the forecast:

| Table | Purpose |
|---|---|
| `transactions` | 32,278 deduplicated billing lines — the fact table |
| `weekly_financials` | Weekly revenue aggregates + 8-week trailing-median baseline per company |
| `weather_weekly` | Weekly weather features (bad_workdays, delay_score, risk classification) |
| `forecast_weeks` | Persisted 13-week forecast snapshot (scenario × company × week) |
| `trace_links` | Audit trail linking every forecast week back to driver + amount + explanation |
| `assumptions` | All modelling assumptions — displayed in the Methodology panel |
| `covenants` | Covenant floors per company (all marked `is_assumption = 1`) |
| `altis_profiles` | Auth-linked RBAC role per user |

Full schema: `docs/schema.md` and `pipeline/schema.sql`.

---

## Deployment Shape

| Mode | Command | Notes |
|---|---|---|
| Local dev (SQLite) | `npm run dev` | No Supabase config needed; no auth gate |
| Local prod (SQLite) | `npm run build && npm start` | Same; production Next.js |
| Vercel + Supabase | `vercel deploy` | Requires `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel env; swap `lib/db.ts` to `pg` (documented in `docs/deployment.md`) |
| iOS simulator | `cd ios && xcodegen generate && xcodebuild ...` | Requires Supabase backend + `Secrets.swift` generated from `.env.local` |

Weather data: Open-Meteo (free, no API key). 12-hour on-disk cache with stale/fallback for offline use.

---

## Test Coverage

| Suite | Command | Count |
|---|---|---|
| TypeScript forecast engine | `npm run test:forecast` | 7 tests |
| Python pipeline | `npm run test:py` | 8 tests |

The forecast engine is a pure function — it is fully testable without a database. Pipeline tests cover ingest dedup logic, weather aggregation, and stats computation.
