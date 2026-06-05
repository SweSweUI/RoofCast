# Supabase Backend — Altis Cashflow Platform

## Overview

The Altis platform uses a Supabase project (hosted Postgres) as its cloud data
store and auth provider. All Altis objects are namespaced `altis_*` inside the
`public` schema so they coexist safely with the owner's existing personal app
(which uses `public.profiles` and `public.workouts`).

---

## Project structure

```
public schema
├── altis_* tables / views / functions   ← Altis (hackathon data)
├── public.profiles                      ← owner's personal app (untouched by purge)
└── public.workouts                      ← owner's personal app (untouched by purge)

auth schema
├── @altis.demo users (5 demo accounts)  ← created by push_supabase.py
└── owner's own account(s)              ← untouched by purge
```

---

## Schema

Tables are loaded in FK-dependency order by `pipeline/push_supabase.py`. The
canonical definition is `supabase/schema.sql`.

| Table | Description |
|---|---|
| `altis_companies` | Four operating companies in the roofing portfolio |
| `altis_weather_locations` | Weather proxy locations (Brunssum, Maastricht) |
| `altis_source_files` | Registry of ingested Excel source files |
| `altis_accounts` | GL account → normalised category mapping |
| `altis_transactions` | Ledger transactions (debit/credit, week-bucketed) |
| `altis_weekly_financials` | Aggregated weekly revenue/cashflow per company |
| `altis_monthly_revenue` | Monthly revenue roll-up per company |
| `altis_weather_daily` | Daily weather (Open-Meteo) per location |
| `altis_weather_weekly` | Weekly weather aggregates + delay score |
| `altis_covenants` | PE covenant thresholds per company |
| `altis_assumptions` | Modelling assumptions (payment lag, drivers, weather) |
| `altis_forecast_weeks` | 13-week cashflow forecast rows (scenario × company × week) |
| `altis_trace_links` | Audit trail linking forecast weeks to source transactions |
| `altis_pipeline_runs` | Pipeline run metadata + data-quality inventory (jsonb) |
| `altis_profiles` | Auth-linked RBAC profiles (one row per demo user) |

**View**: `altis_accounts_summary` — joins accounts/companies/transactions for
the data-quality page.

---

## Row-Level Security (RLS) model

| Actor | Access |
|---|---|
| Unauthenticated | No access (RLS blocks all reads) |
| Any authenticated user | `SELECT` on all `altis_*` tables and the summary view |
| `admin` role (via `altis_is_admin()`) | Can also read other users' `altis_profiles` rows |
| Service role (`SUPABASE_SERVICE_ROLE_KEY`) | Bypasses RLS — used only by server/pipeline |

The helper function `altis_is_admin()` is a `security definer` SQL function that
checks whether the calling user's `user_id` has `role = 'admin'` in `altis_profiles`.

Writes go exclusively through the service role key on the server side; the anon
key (exposed to the browser via Next.js `NEXT_PUBLIC_SUPABASE_URL`) never has
write access to any Altis table.

---

## Loading data

Run the full pipeline from the repo root:

```bash
npm run pipeline          # ingest + push (runs run_all.py then push_supabase.py)
```

Or push to Supabase only (SQLite must already exist):

```bash
python3 pipeline/push_supabase.py
```

The script:
1. Applies `supabase/schema.sql` (drops and recreates all `altis_*` objects).
2. Streams data from `data/altis.db` into Supabase via the PostgREST API in
   1 000-row chunks, preserving integer PKs so foreign keys match.
3. Creates (or upserts) the 5 demo auth users and their `altis_profiles` rows.

---

## Environment variables

All credentials live in `.env.local` (gitignored, never committed).

| Variable | Used by | Description |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | `push_supabase.py`, `purge_supabase.py` | Personal access token for the Management API |
| `SUPABASE_PROJECT_REF` | `push_supabase.py`, `purge_supabase.py` | Project reference ID (e.g. `abcxyzabcxyz`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js app, iOS app | Public project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `push_supabase.py`, `purge_supabase.py`, Next.js API routes | Service role JWT — server-only, never client-exposed |

---

## Demo accounts

All five accounts share the password **`AltisDemo!2026`**.

| Email | Role | Display name |
|---|---|---|
| `cfo@altis.demo` | `cfo` | Casey CFO |
| `board@altis.demo` | `board` | Bo Board |
| `opco@altis.demo` | `opco` | Olen Opco-MD |
| `project@altis.demo` | `project` | Pat Project-Lead |
| `admin@altis.demo` | `admin` | Ada Admin |

Sign in at the web app (`npm run dev`) or the iOS app.
The `admin` role unlocks the admin panel and can read all `altis_profiles` rows.

Accounts are created by `push_supabase.py` and deleted by `purge_supabase.py`.

---

## Purging the Supabase backend

Run the purge script (see `DATA_HANDLING.md` for the full policy):

```bash
bash scripts/purge.sh           # removes local data and calls purge_supabase.py
python3 pipeline/purge_supabase.py   # cloud only, if you need to run it standalone
```

The purge drops every `altis_*` object and the 5 `@altis.demo` users.
`public.profiles`, `public.workouts`, and non-demo users are never touched.
