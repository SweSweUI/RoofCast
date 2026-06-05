# Deployment

---

## Environment Variables

Copy `.env.example` to `.env.local` (consumed by Next.js) and `.env` (consumed by the Python pipeline). The defaults work out of the box for local development with no modifications required.

Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `ALTIS_DB_PATH` | `./data/altis.db` | Path to the SQLite database (pipeline writes; app reads) |
| `ALTIS_RAW_DIR` | `./data/raw` | Where raw Excel exports are staged for ingestion (gitignored) |
| `OPEN_METEO_FORECAST_URL` | `https://api.open-meteo.com/v1/forecast` | Override only if proxying the API |
| `OPEN_METEO_ARCHIVE_URL` | `https://archive-api.open-meteo.com/v1/archive` | Override only if proxying the API |
| `WEATHER_FORECAST_DAYS` | `16` | Days of live forecast requested (Open-Meteo maximum is 16) |
| `DATABASE_URL` | _(unset)_ | Postgres/Supabase connection string (see Vercel + Supabase section) |
| `NEXT_PUBLIC_SUPABASE_URL` | _(unset)_ | Supabase project URL (optional) |
| `SUPABASE_SERVICE_ROLE_KEY` | _(unset)_ | Supabase service role key — server-side only, never expose to client |

Open-Meteo does not require an API key.

---

## Option A: Local Development

### Requirements

- Node >= 22.5.0 (`node:sqlite` is built in from Node 22.5)
- Python 3.11+ (tested on 3.14)

### Steps

```bash
# 1. Install JavaScript dependencies
npm install

# 2. Install Python pipeline dependencies
pip install -r pipeline/requirements.txt

# 3. Copy and configure environment
cp .env.example .env.local    # for Next.js
cp .env.example .env          # for Python pipeline (optional; defaults work)

# 4. Stage raw data (gitignored; never committed)
# Place Excel files in data/raw/ per the structure in docs/data_inventory.md

# 5. Run the data pipeline (ingest → weather → stats)
npm run pipeline

# 6. Optionally persist the forecast snapshot
npx tsx lib/forecast/snapshot.ts

# 7. Start the development server
npm run dev
# App available at http://localhost:3000 (home redirects to /cfo)
```

### Running Tests

```bash
npm test
# Equivalent to:
npm run test:forecast   # tsx --test lib/forecast/*.test.ts
npm run test:py         # python3 -m pytest pipeline/tests -q
```

### Building for Production

```bash
npm run build
npm start
```

---

## Option B: Self-Hosted Node Server

The app works fully on any Linux/macOS server with Node >= 22.5.0. SQLite is accessed via the built-in `node:sqlite` module — no native binaries, no separate database process.

```bash
# On the server
git clone <repo>
cd <repo>
npm install
pip install -r pipeline/requirements.txt

# Configure environment
cp .env.example .env.local

# Stage data, run pipeline, build
npm run pipeline
npx tsx lib/forecast/snapshot.ts
npm run build

# Start production server (default port 3000)
npm start
```

Set `ALTIS_DB_PATH` to an absolute path on the server if the working directory differs from the repo root.

### Weather Refresh (Cron)

The pipeline fetches fresh weather data with a 12-hour on-disk cache. To refresh weather automatically:

```bash
# Example cron: refresh weather at 06:00 every day
0 6 * * * cd /opt/altis && npm run weather && npx tsx lib/forecast/snapshot.ts
```

Or use a systemd timer, a GitHub Actions scheduled workflow, or any other cron mechanism.

---

## Option C: Vercel + Supabase (Postgres)

> **Note on `node:sqlite`:** Vercel's serverless runtime does not support `node:sqlite`. The data layer must be swapped to Postgres before deploying to Vercel.

### Why the Swap is Straightforward

`lib/db.ts` exports two functions — `query` and `queryOne` — with plain SQL and `?` placeholders. The rest of the app never imports a database driver directly. Swapping the data layer means reimplementing these two functions against `pg` or the Supabase JS client, then converting `?` placeholders to `$1`, `$2`, … (Postgres style).

The schema is designed to be Postgres-portable — see `docs/schema.md` for the DDL delta.

### Steps

**1. Provision Supabase**

Create a project at [supabase.com](https://supabase.com). Copy the project URL and service role key.

**2. Create the schema in Postgres**

Apply `pipeline/schema.sql` to your Supabase database, with the Postgres DDL adjustments from `docs/schema.md`:
- Replace `INTEGER PRIMARY KEY` with `SERIAL PRIMARY KEY`
- Replace `REAL` with `NUMERIC(18,2)` for monetary columns
- Remove SQLite-specific `DROP TABLE IF EXISTS` statements if using migrations

You can do this via the Supabase SQL editor or `psql`.

**3. Adapt the Python pipeline**

The pipeline currently writes to SQLite. For Supabase, adapt `pipeline/db.py` to connect to Postgres using `psycopg2` or `asyncpg`, or run the pipeline locally to produce `data/altis.db` and then import it into Postgres using `pgloader` or a custom ETL step.

**4. Swap the TypeScript data layer**

Install the Postgres client:

```bash
npm install pg
npm install --save-dev @types/pg
```

Replace `lib/db.ts` with a Postgres implementation:

```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  // Convert ? placeholders to $1, $2, ...
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  const { rows } = await pool.query(pgSql, params);
  return rows as T[];
}

export async function queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  const rows = await query<T>(sql, ...params);
  return rows[0];
}
```

All other files in the app use `query` and `queryOne` from `lib/db.ts` — no other changes are required.

**5. Set environment variables in Vercel**

In the Vercel project settings, add:
- `DATABASE_URL` = your Supabase Postgres connection string
- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL (if using the Supabase JS client instead of `pg`)
- `SUPABASE_SERVICE_ROLE_KEY` = service role key (server-side only)

Do **not** expose `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` to the client. They are server-only environment variables.

**6. Deploy**

```bash
vercel deploy
```

Or connect the repository to Vercel for automatic deployments on push.

### Scheduled Weather Refresh on Vercel

Vercel does not have a built-in cron scheduler in all tiers. Options:

- **Vercel Cron** (Pro plan): add a cron job in `vercel.json` that calls a serverless function endpoint to trigger the weather refresh.
- **GitHub Actions**: use a scheduled workflow (`on: schedule: cron: "0 6 * * *"`) that runs the Python pipeline against the Supabase Postgres database and redeploys.
- **External cron service** (e.g. cron-job.org): call a protected API endpoint that triggers a pipeline run.

---

## GitHub Readiness

The repository is ready for GitHub:

- `data/raw/` is gitignored — no accounting data is committed.
- `data/altis.db` and `data/altis.db-*` are gitignored.
- All Excel files (`*.xlsx`, `*.xls`) are gitignored.
- `.env`, `.env*.local`, and `.env.local` are gitignored.
- `data/artifacts/` contains only generated statistical summaries and is committed for demo purposes (`.gitkeep` is tracked).
- `data/cache/` is gitignored.

To verify nothing sensitive is staged:

```bash
git status
git diff --cached
```

If you want to delete all data from the repository entirely:

```bash
rm -rf data/raw/ data/cache/
rm -f data/altis.db data/altis.db-shm data/altis.db-wal
# Then also clear any artifacts you don't want to share:
rm -f data/artifacts/data_inventory.json data/artifacts/stats.json \
       data/artifacts/stats_summary.txt data/artifacts/weather_summary.json
```

---

## Public deployment (Vercel + Supabase)

This section covers deploying the **live public URL** with Vercel as the hosting platform and Supabase as the cloud data backend. The existing Option A (local) and Option B (self-hosted) instructions above remain unchanged.

### Why `DATA_BACKEND=supabase` is required on Vercel

Vercel's serverless runtime does not include `node:sqlite`. Setting `DATA_BACKEND=supabase` causes the lazy dispatcher in `lib/data/index.ts` to load only the Supabase backend module — `node:sqlite` is never imported and its absence causes no error. Without this variable the app defaults to whichever backend is auto-detected; on Vercel that detection will fail at runtime because the SQLite file is not present.

### Prerequisites

1. A Supabase project with the schema applied and data loaded (see Option C above and `docs/supabase.md`).
2. The Vercel CLI installed (`npm i -g vercel`) and a Vercel account.
3. Data loaded to Supabase: `python3 pipeline/push_supabase.py` (run locally against the Supabase project once the pipeline has built `data/altis.db`).

Note: Open-Meteo requires no API key; weather data is fetched live by the app at request time.

### Required environment variables

Set these in the Vercel project dashboard under **Settings → Environment Variables**, or pass them with `vercel env add` before the first deploy.

| Variable | Where | Description |
|---|---|---|
| `DATA_BACKEND` | All | Must be `supabase`. Switches the data layer away from SQLite. |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Your Supabase project URL (e.g. `https://xyzxyz.supabase.co`). Exposed to the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase anon/public key. Exposed to the browser. Used for auth and RLS-gated reads. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only — secret** | Service role key. Never expose to the client. Used for admin writes (pipeline push, data purge). |
| `SUPABASE_PROJECT_REF` | Server only | Project reference ID (e.g. `xyzxyzxyz`). Used by the management API. |
| `SUPABASE_ACCESS_TOKEN` | **Server only — secret** | Supabase personal access token. Required for programmatic project management. |

Mark `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ACCESS_TOKEN` as **Secret** in the Vercel UI so they are never logged or exposed in build output.

### One-command deploy

```bash
# 1. Authenticate with Vercel (once)
vercel login

# 2. Link to your Vercel project (first time only; creates .vercel/project.json)
vercel link

# 3. Set all required environment variables (if not already set in the dashboard)
vercel env add DATA_BACKEND
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY   # mark secret
vercel env add SUPABASE_PROJECT_REF
vercel env add SUPABASE_ACCESS_TOKEN       # mark secret

# 4. Deploy to production
vercel --prod
```

After the deploy completes, Vercel prints the public URL. Copy it into `submission/README_SUBMISSION.md`.

### Region

`vercel.json` sets `"regions": ["fra1"]` (Frankfurt) to keep the app co-located with the EU Supabase region. Change this if your Supabase project is in a different region.

### Automatic deployments

Connect the repository to your Vercel project (**Settings → Git**) to trigger a new deployment on every push to `main`. The CI workflow (`.github/workflows/ci.yml`) runs first; if it passes, Vercel deploys automatically.

### Data loading

Before the first deploy, or after re-running the pipeline with new data:

```bash
python3 pipeline/push_supabase.py
```

This applies `supabase/schema.sql`, bulk-loads all tables, and creates the 5 demo role accounts. The Supabase URL, service role key, and project ref are read from `.env.local`. Subsequent pipeline runs can push incrementally — see `pipeline/push_supabase.py` for options.
