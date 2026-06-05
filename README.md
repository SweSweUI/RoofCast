# Altis — Weather-Aware 13-Week Cashflow Platform

A financial-operations platform for a PE-backed roofing portfolio (Altis Groep challenge). It answers one question:

> **How will cash move over the next 13 weeks, how does weather delay billing and cash timing, and where does covenant or operational risk appear?**

Four operating companies from four different accounting systems are reconciled into one model. A weather-delay signal (Open-Meteo) shifts the timing of projected billing. Role-specific dashboards — CFO, PE Board, Opco MD, Project Lead (+ Admin) — present the same reconciled numbers at different levels of detail.

---

## Platform surfaces

This is a full multi-surface platform on **one Supabase backend**:

- **Web dashboard** — Next.js, 6 role views + Admin, behind Supabase Auth login with role-based access.
- **Supabase (Postgres)** — system of record. All objects are namespaced `altis_*`, protected by Row-Level Security (authenticated users read; only the service role writes). See [docs/supabase.md](docs/supabase.md).
- **Native iOS app (SwiftUI)** — signs in with the same accounts and reads the same `altis_*` tables via PostgREST. See [docs/ios.md](docs/ios.md).
- **Auth & RBAC** — 5 roles (`cfo`, `board`, `opco`, `project`, `admin`). Each role's navigation and routes are gated; the Admin view manages users and triggers data purge.
- **Data governance** — the app shows a persistent deletion reminder; [DATA_HANDLING.md](DATA_HANDLING.md) + `scripts/purge.sh` enforce the 3-day deletion rule.

The platform also runs **local-first** without Supabase: set `DATA_BACKEND=sqlite` (or omit Supabase env) and it reads the local SQLite store with no auth gate — handy for offline development and the test suite.

> **Data handling:** Altis data is anonymised and for the hackathon only. Copies must be deleted within 3 days after the event. Nothing sensitive is committed (raw data, the SQLite DB, caches, `.env*`, and keys are all gitignored). See [DATA_HANDLING.md](DATA_HANDLING.md).

---

## Architecture

```
data/raw/          (gitignored — never committed)
  portfolio company data/*.xlsx          Opco A — Exact-style GL 8000-series
  portfolio company 2 data/*.xlsx        Peter Ummels — Snelstart/FinTransactions
  datasets/Altis dataset 2.xlsx          Opco C (Gilde) + Company E
  datasets/Altis dataset 1.xlsx          monthly summary (reconciliation only)
        |
        v
pipeline/ingest.py  ──►  data/altis.db (SQLite)
pipeline/weather.py ──►  weather_daily / weather_weekly tables
pipeline/stats.py   ──►  data/artifacts/stats*.json (lag analysis)
        |
        v
lib/forecast/engine.ts  (pure TypeScript — no DB, fully testable)
        |
        v
Next.js App Router (app/(dash)/*)
  /cfo          CFO — Operating Cash Forecast
  /board        PE Board — Portfolio Cash Outlook
  /opco         Opco MD — single-company operating view
  /project      Project Lead — weather & schedule risk
  /methodology  Assumptions & methodology panel
  /data-quality Data lineage and reconciliation panel
```

Data flows top-to-bottom. The forecast engine is a pure function that reads from the database only at the API layer; it has no side effects and is fully covered by unit tests.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind, Recharts) | Single app, server components for DB reads, client for interactive charts |
| Cloud backend | Supabase (Postgres + Auth + PostgREST), `altis_*` tables, RLS | One backend shared by web + iOS; auth, RBAC, RLS |
| Local DB | SQLite (`data/altis.db`) via Node's built-in `node:sqlite` | Zero-friction offline/dev fallback (`DATA_BACKEND=sqlite`) |
| Data layer | Async dispatcher (`lib/data/`) — Supabase or SQLite | One query surface; lazy-loads only the active backend |
| Auth / RBAC | Supabase Auth + `lib/rbac.ts` + `middleware.ts` | Email/password login, 5 roles, route + nav gating |
| Mobile | Native iOS (SwiftUI + supabase-swift), `ios/` | Same backend, same accounts, xcodegen + Xcode build |
| Data pipeline | Python 3 (pandas, openpyxl, requests) | Excel parsing, dedup, weather fetch, Supabase push |
| Forecast engine | TypeScript (`lib/forecast/`) | Pure function, co-located with app, testable with `tsx --test` |
| Weather | Open-Meteo archive + forecast APIs | Free, no API key, 16-day live forecast + historical ERA5 back to 2023 |

Node >= 22.5.0 is required (`node:sqlite` is built in from Node 22.5). The iOS app needs Xcode 16+ and `xcodegen`.

---

## Quickstart

### 1. Install dependencies

```bash
npm install
pip install -r pipeline/requirements.txt
```

### 2. Stage raw data

Place the accounting exports in `data/raw/` (this directory is gitignored and never committed):

```
data/raw/
  portfolio company data/          # Opco A GL files
  portfolio company 2 data/        # Peter Ummels FinTransactions files
  datasets/
    Altis dataset 1.xlsx
    Altis dataset 2.xlsx
```

Copy `.env.example` to `.env.local` (for the Next.js app) and `.env` (for the pipeline). The defaults work out of the box with no changes required unless you change the data path.

### 3. Run the data pipeline

```bash
npm run pipeline
```

This runs `python3 pipeline/run_all.py`, which executes ingest → weather → stats in sequence. It creates `data/altis.db` and writes artifacts to `data/artifacts/`.

Individual steps can also be run separately:

```bash
npm run ingest    # python3 pipeline/ingest.py
npm run weather   # python3 pipeline/weather.py
npm run stats     # python3 pipeline/stats.py
```

### 4. Persist the forecast snapshot (optional)

```bash
npx tsx lib/forecast/snapshot.ts
```

Runs the TypeScript engine for all three scenarios and all companies and writes the output into `forecast_weeks` and `trace_links` tables. Required for the traceability panel and the `/methodology` view to show persisted data.

### 5. (Optional) Push to Supabase + enable auth

To run the cloud backend (Supabase Auth + RBAC + the iOS app), configure `.env.local` with your Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `DATA_BACKEND=supabase`), then:

```bash
python3 pipeline/push_supabase.py
```

This applies `supabase/schema.sql` (namespaced `altis_*` tables + RLS + `altis_profiles`), bulk-loads the data, and creates 5 demo role accounts. With Supabase configured, the web app requires login; without it, the app runs locally on SQLite with no auth. See [docs/supabase.md](docs/supabase.md). Skip this step to stay local-only (`DATA_BACKEND=sqlite`).

**Demo accounts** (password `AltisDemo!2026`): `cfo@`, `board@`, `opco@`, `project@`, `admin@` `altis.demo`.

### 6. Start the development server

```bash
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000). In Supabase mode you land on `/login` (use a demo account or the quick-login buttons); each role is routed to its default view. In local mode the home route redirects straight to `/cfo`. Switch companies and scenarios using the global selector in the navigation bar.

### 7. (Optional) Run the iOS app

```bash
cd ios && xcodegen generate
xcodebuild -project Altis.xcodeproj -scheme Altis \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Generate `ios/Altis/Secrets.swift` from `.env.local` first (see [docs/ios.md](docs/ios.md)). The app signs in with the same demo accounts and reads the same Supabase backend.

### Deleting the data (3-day rule)

```bash
scripts/purge.sh        # removes local data + all altis_* cloud objects + demo users
```

See [DATA_HANDLING.md](DATA_HANDLING.md). The Admin view also has an in-app "purge portfolio data" button.

---

## Role Views

### CFO — `/cfo`

Operating cash forecast for the selected company. 13-week KPI strip (net cash, cash-in/out totals, minimum closing cash, covenant headroom, weeks at risk), cashflow bar+line chart, driver split (materials/subcontractor/labour/overhead), scenario comparison (base/wet/dry), covenant headroom chart, and a company comparison chart. Click any week in the weekly table to open the traceability panel explaining every number back to its components.

### PE Board — `/board`

Portfolio-level view aggregating all operating companies. Companies-at-risk table sorted worst-first (covenant breach → weeks at risk → minimum closing cash). Scenario summary table with a plain-English board takeaway. Portfolio cashflow chart and liquidity vs covenant floor.

### Opco MD — `/opco`

Single-company operating view with the source system badge, a weather-risk calendar (colour-coded by delay risk level), operational recommendations derived from weather and liquidity signals, and a project/transaction risk signal table showing the top weeks by absolute billing-timing shift.

### Project Lead — `/project`

Execution-oriented view centred on the weather calendar. Upcoming bad-weather windows table with site notes, a billing-timing shift table (weeks where rain materially defers or accelerates cash-in), and indicative next-four-weeks milestone billing derived from historical transaction patterns. Clearly labelled as model outputs, not a confirmed invoicing schedule.

---

## How-To

### Ingest new data / refresh after new Excel files arrive

```bash
npm run pipeline
```

Drop the updated Excel files into `data/raw/` first. The pipeline drops and rebuilds all tables deterministically.

### Refresh weather only

```bash
npm run weather
```

Weather data is cached for 12 hours (`data/cache/weather/`). If the Open-Meteo API is unreachable, the pipeline falls back to the on-disk cache (stale), then to bundled CSV/JSON fallback files.

### Recompute the forecast

The forecast engine runs on every page load from the live database — there is no separate recompute step. To persist a snapshot:

```bash
npx tsx lib/forecast/snapshot.ts
```

### Switch scenario

Use the scenario selector in the navigation bar (base / wet quarter / dry quarter). Scenarios change the `weatherIntensity` parameter (1.0 / 1.5 / 0.5), which shifts the timing of projected billing but does not change the total volume of work.

### Inspect traceability

1. Click any week row in the weekly table on any dashboard.
2. The trace panel opens and shows the driver decomposition: baseline cash-in, weather timing shift, payment-lag convolution, and each cash-out driver.
3. The same data is queryable directly in the database via the `forecast_weeks` and `trace_links` tables.

### Build for production

```bash
npm run build
npm start
```

---

## Project Structure

```
.
├── app/
│   ├── (dash)/
│   │   ├── cfo/page.tsx          CFO view
│   │   ├── board/page.tsx        PE Board view
│   │   ├── opco/page.tsx         Opco MD view
│   │   ├── project/page.tsx      Project Lead view
│   │   ├── data-quality/page.tsx Data quality panel
│   │   └── methodology/page.tsx  Assumptions panel
│   └── api/                      Route handlers
├── components/                   UI components + charts (Recharts)
├── lib/
│   ├── db.ts                     SQLite read-only layer (node:sqlite)
│   ├── forecast/
│   │   ├── config.ts             Default params + scenario intensity
│   │   ├── engine.ts             Core forecast pure function
│   │   ├── engine.test.ts        Unit tests
│   │   ├── seasonality.ts        ISO-week seasonal profile builder
│   │   ├── weather.ts            Weather series builder
│   │   ├── snapshot.ts           DB persistence script
│   │   └── dates.ts              ISO week helpers
│   └── types.ts                  Shared TypeScript types
├── pipeline/
│   ├── config.py                 Companies, locations, assumptions, covenants
│   ├── schema.sql                Full database DDL
│   ├── ingest.py                 Excel parsing + dedup + weekly aggregates
│   ├── weather.py                Open-Meteo fetch + weekly aggregation
│   ├── stats.py                  Lag correlation + wet/dry analysis
│   ├── run_all.py                Orchestrator (ingest → weather → stats)
│   ├── db.py                     SQLite connect + schema apply helper
│   └── requirements.txt          pandas, openpyxl, requests, pytest
├── data/
│   ├── raw/                      Gitignored — never committed
│   ├── altis.db                  Gitignored — generated by pipeline
│   ├── cache/weather/            12-hour Open-Meteo cache (gitignored)
│   └── artifacts/                Generated summaries (committed)
│       ├── data_inventory.json
│       ├── stats.json
│       ├── stats_summary.txt
│       └── weather_summary.json
├── docs/                         This documentation set
│   ├── data_inventory.md
│   ├── schema.md
│   ├── forecast_model.md
│   ├── weather_model.md
│   └── deployment.md
├── .env.example                  Environment variable reference
└── package.json
```

---

## Testing

```bash
npm test
```

Runs both the TypeScript engine unit tests and the Python pipeline tests:

```bash
npm run test:forecast    # tsx --test lib/forecast/*.test.ts
npm run test:py          # python3 -m pytest pipeline/tests -q
```

---

## Known Assumptions

All assumptions are stored in the `assumptions` table and displayed in the `/methodology` panel. The most significant are:

| Assumption | Value | Source |
|---|---|---|
| Debtor payment lag (peak) | ~4 weeks; spread t+2..t+8 with weights [0, 0, 0.10, 0.20, 0.30, 0.20, 0.12, 0.05, 0.03] | Industry default (~30–45 debtor days) |
| Materials cash-out | 32% of revenue | Industry default |
| Subcontractor cash-out | 18% of revenue | Industry default |
| Labour cash-out | 22% of revenue | Industry default |
| Overhead cash-out | 10% of revenue | Industry default |
| Weather shift (high, 3+ rain workdays) | 25% of billing deferred | Inferred from lag analysis |
| Weather shift (medium, 2 rain workdays) | 12% of billing deferred | Inferred from lag analysis |
| Opening cash — Peter Ummels | €600,000 | Assumption (no bank data) |
| Opening cash — Opco A | €900,000 | Assumption (no bank data) |
| Opening cash — Opco C | €450,000 | Assumption (no bank data) |
| Opening cash — Company E | €120,000 | Assumption (no bank data) |
| Covenant floor — portfolio | €750,000 | Assumption |
| Covenant floor — Peter Ummels | €250,000 | Assumption |
| Covenant floor — Opco A | €400,000 | Assumption |
| Covenant floor — Opco C | €200,000 | Assumption |

Driver payment lags: materials paid ≈ 2 weeks after production, subcontractors ≈ 3 weeks, labour and overhead same week.

---

## Known Limitations

- **Revenue-only data.** The source accounting exports contain revenue (credit-side of sales journals) only. Cash-out drivers (materials, subcontractor, payroll, overhead) are configured assumptions, not observed GL data. There are no bank or balance-sheet figures.
- **Weak weather signal.** The statistical relationship between wet weeks and subsequent revenue is suggestive, not causal. The strongest Pearson r is approximately −0.17 at lag 0 (Ummels). The wet/dry timing signal (dip ≈ lag 3–5, partial recovery ≈ lag 7) is more reliable than any magnitude estimate. Permutation p ≈ 0.06–0.19 (marginal). Do not over-interpret.
- **Inferred locations.** Peter Ummels is publicly located at Boschstraat 28C, 6442 PB Brunssum. The other three companies' locations are assumed to be South Limburg, mapped to the Maastricht weather proxy. If the companies are in different locations the weather signal will be less accurate.
- **Synthetic covenants and opening cash.** No loan agreements, covenant schedules, or bank statements were supplied. The covenant floors and opening balances in the model are configurable assumptions, clearly labelled in the UI.
- **No WIP or project-level data.** The source data contains no work-in-progress, milestone, or project-line items. The Project Lead view derives billing signals entirely from historical transaction patterns and the weather model.
- **Single fiscal entity per opco.** Each company is modelled independently. Intercompany flows are not modelled.

---

## Data Governance

### Raw accounting data is never committed

The `data/raw/` directory, `data/altis.db`, and all Excel files are listed in `.gitignore`. The repository contains no raw accounting or portfolio data. The `data/artifacts/` directory contains only generated statistical summaries and is committed for demo purposes.

### How to delete all data

```bash
rm -rf data/raw/
rm -f data/altis.db data/altis.db-shm data/altis.db-wal
rm -rf data/cache/
```

### API keys

Open-Meteo does not require an API key. The forecast and archive endpoints are free and public. No credentials need to be stored for weather data. See `.env.example` for the full environment variable reference.

---

## Documentation

- [docs/data_inventory.md](docs/data_inventory.md) — companies, file counts, row counts, dedup story, account mapping
- [docs/schema.md](docs/schema.md) — full database schema with column-by-column notes
- [docs/forecast_model.md](docs/forecast_model.md) — the 6-layer forecast model with formulas
- [docs/weather_model.md](docs/weather_model.md) — Open-Meteo integration, delay score, lag analysis
- [docs/deployment.md](docs/deployment.md) — local, self-hosted, and Vercel/Supabase deployment
