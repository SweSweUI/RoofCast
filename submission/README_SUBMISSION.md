# Altis — Weather-Aware Billing-to-Cash Forecast Platform
## Hackathon Submission — README

---

## Public App URL

`<PUBLIC_URL — pending Vercel deploy>`

No public URL is live yet. Deployment preparation is complete; the final deploy requires the repo owner's Vercel login (`vercel deploy` — one command, documented below).

---

## Demo Login Credentials

All accounts share password: **`AltisDemo!2026`**

| Email | Role | Default view |
|---|---|---|
| `cfo@altis.demo` | CFO | `/cfo` — 13-week operating cash forecast |
| `board@altis.demo` | PE Board | `/board` — portfolio liquidity overview |
| `opco@altis.demo` | Opco MD | `/opco` — single-company operating view |
| `project@altis.demo` | Project Lead | `/project` — weather & schedule risk |
| `admin@altis.demo` | Admin | Admin panel, data purge |

In local mode (SQLite, no Supabase) the app starts at `http://localhost:3000` and redirects directly to `/cfo` — no login required for local evaluation.

---

## GitHub Repository

`<GITHUB_URL — add when pushed>`

---

## Local Run Instructions

### Prerequisites

- Node >= 22.5.0 (built-in `node:sqlite` is available from Node 22.5)
- Python 3.11+

### Steps

```bash
# 1. Install dependencies
npm install
pip install -r pipeline/requirements.txt

# 2. Stage raw Excel data (gitignored, never committed)
# Place files in data/raw/ — see docs/data_inventory.md for the expected structure

# 3. Run the data pipeline (ingest → weather → stats)
npm run pipeline

# 4. Persist the forecast snapshot (enables trace panel and methodology view)
npm run snapshot

# 5. (Optional — cloud mode) Push to Supabase and enable auth
# Configure .env.local with your Supabase credentials, then:
python3 pipeline/push_supabase.py

# 6. Start the development server
npm run dev
# App available at http://localhost:3000
```

### Build and test

```bash
npm run build    # production build — passes
npm test         # 7 TypeScript engine tests + 8 Python pipeline tests
```

### One-command Vercel deploy (cloud)

```bash
vercel deploy
```

Requires `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` set in the Vercel project environment. See `docs/deployment.md` for the full Vercel + Supabase path (the data layer `lib/db.ts` swap from SQLite to Postgres is documented there).

---

## Build and Test Status

| Check | Status |
|---|---|
| `npm run build` | Passes |
| `npm run test:forecast` | 7 engine tests — all pass |
| `npm run test:py` | 8 pipeline tests — all pass |

---

## Challenge Requirement → Where Met

| Requirement | Where met |
|---|---|
| Multi-company data integration | 4 opcos, 4 accounting systems (Snelstart/Exact GL/Gilde/invoice register) reconciled into one model via content-hash dedup (`pipeline/ingest.py`) |
| Weather signal incorporation | Open-Meteo archive + 16-day live forecast; weekly bad-workday classification; 25%/12% billing timing shift; `pipeline/weather.py`, `lib/forecast/weather.ts` |
| 13-week cashflow forecast | `lib/forecast/engine.ts` — 6-layer pure TS function; runs on every page load |
| Scenario analysis (wet/dry/base) | `wet_quarter` (intensity 1.5) / `base` (1.0) / `dry_quarter` (0.5); scenario selector in nav bar; all three shown in `/board` summary table |
| Role-based access control | 5 roles, Supabase Auth + `lib/rbac.ts` + `middleware.ts`; route and nav gating |
| Traceability / explainability | Click any week → trace drawer; `trace_links` table links every number back to source transaction + formula + assumption |
| Covenant headroom monitoring | Configurable floors per company; headroom chart on `/cfo`; breach risk signal; Board covenant story on `/board` |
| Data quality / data lineage | `/data-quality` panel; `data_inventory.json`; source-file provenance on every transaction |
| Mobile access | Native iOS app (SwiftUI + supabase-swift) — same accounts, same backend, same tables |
| Methodology transparency | `/methodology` panel; all assumptions in `assumptions` table; `docs/forecast_model.md` |
| Data governance | `DATA_HANDLING.md`; 3-day deletion rule; `scripts/purge.sh`; gitignore enforcement; Admin purge button |

---

## Data Limitations (billing-only source)

**Important framing:** This platform produces a **weather-aware billing-to-cash forecast**, not a real bank cashflow. The source data is exclusively revenue/billing from four accounting systems. The following are **not** in the source data and are modelled as explicit, labelled, configurable assumptions:

- Cash-out costs (materials, subcontractor, labour, overhead) — no AP or cost ledger provided
- Opening cash balances — no bank statements provided
- Covenant floors and payment terms — no loan documentation provided
- Company locations for three of the four opcos — inferred as South Limburg / Maastricht proxy
- No WIP, project pipeline, or milestone data

The weather signal is **suggestive, not causal** (strongest Pearson |r| ≈ 0.17–0.22; permutation p ≈ 0.07–0.19). It is used only to shift the *timing* of projected billing, not to predict revenue loss.

See `DATA_HANDLING.md` for the full governance policy.

---

## Data Governance Summary

All raw accounting data is anonymised and provided for the hackathon only. No raw data, database, or credentials are committed to the repository. The `data/raw/` directory, `data/altis.db`, all `.xlsx` files, and `.env*` files are gitignored.

**Deletion rule:** All copies (local and cloud) must be deleted within 3 days after the event.

```bash
bash scripts/purge.sh    # removes all local data + all altis_* Supabase objects + demo users
```

Full policy: [DATA_HANDLING.md](../DATA_HANDLING.md)

---

## Screenshots

See `submission/screenshots/` and [screenshot_index.md](screenshot_index.md) for the full list with captions.

---

## Demo Video

`submission/video/altis_demo.mp4` — or see `submission/storyboard_fallback.md` if the video file is not present.

Walkthrough script: [demo_script.md](demo_script.md)

---

## Known Assumptions

See `README.md` § Known Assumptions and `README.md` § Known Limitations for the full list. Summary:

- Opening cash: Peter Ummels €600k, Opco A €900k, Opco C €200k (tight by design to show covenant risk), Company E €120k
- Covenant floors: portfolio €750k, Ummels €250k, Opco A €400k, Opco C €200k — all assumed
- Driver shares: materials 32%, subcontractor 18%, labour 22%, overhead 10% — industry defaults
- Debtor payment profile: mean ≈ 4 weeks (weights `[0,0,0.10,0.20,0.30,0.20,0.12,0.05,0.03]`) — industry default
- Weather timing shift: 25% (high, 3+ bad workdays), 12% (medium, 2 bad workdays) — inferred from lag analysis
