# Data Governance

Full policy: [DATA_HANDLING.md](../DATA_HANDLING.md)

---

## Summary

Altis source data is anonymised accounting exports provided for the hackathon only. This document summarises the key governance controls. The authoritative policy, deletion checklist, and purge instructions are in `DATA_HANDLING.md`.

---

## What Data Exists and Where

### Local (this machine)

| Path | Contents | Gitignored |
|---|---|---|
| `data/raw/` | Excel source files (raw company financials) | Yes |
| `data/altis.db` (+ `-shm`, `-wal`) | SQLite database produced by the pipeline | Yes |
| `data/cache/` | Open-Meteo API response cache | Yes |
| `data/artifacts/` | Derived JSON summaries (committed for demo) | Mostly yes (`.gitkeep` tracked) |
| `.env.local` | Supabase credentials and keys | Yes |
| `ios/Altis/Secrets.swift` | Generated Swift credentials file | Yes |

### Cloud (Supabase Postgres)

All Altis objects are namespaced `altis_*` inside the Supabase `public` schema. They coexist with the project owner's unrelated personal tables and are fully isolated from them.

**Tables:** `altis_transactions`, `altis_weekly_financials`, `altis_weather_daily`, `altis_weather_weekly`, `altis_forecast_weeks`, `altis_trace_links`, and 9 others.

**Auth users (5 demo accounts):** `cfo@altis.demo`, `board@altis.demo`, `opco@altis.demo`, `project@altis.demo`, `admin@altis.demo`

---

## What Is NOT Committed to the Repository

The following are excluded by `.gitignore` and must never be committed:

- `data/raw/` — raw Excel source files
- `data/altis.db`, `data/altis.db-shm`, `data/altis.db-wal` — the SQLite database
- `data/cache/` — API caches and intermediate downloads
- `data/artifacts/*` — derived data files (`.gitkeep` placeholder is tracked)
- `.env`, `.env*.local`, `.env.local` — all environment files
- `*.xlsx`, `*.xls` — any Excel files anywhere in the tree
- `ios/Altis/Secrets.swift` — generated credentials file

The repository contains no raw accounting or portfolio data. The `data/artifacts/` directory contains only generated statistical summaries (lag correlations, data inventory counts) with no transaction-level financial data.

---

## The 3-Day Deletion Rule

All copies of Altis data — local and cloud — must be deleted within 3 days after the event.

### Purge command

```bash
bash scripts/purge.sh
```

Type `DELETE` when prompted. To skip the prompt:

```bash
bash scripts/purge.sh --yes
```

### What `scripts/purge.sh` removes

**Local:**
- `data/raw/` — entire directory
- `data/altis.db`, `-shm`, `-wal`
- `data/cache/` — entire directory
- `data/artifacts/*` — all files except `.gitkeep`
- `ios/build/` — compiled iOS build output
- `ios/Altis/Secrets.swift`

**Cloud (via `pipeline/purge_supabase.py`):**
- Drops the view `altis_accounts_summary`
- Drops every `altis_*` table with `CASCADE`
- Drops the function `altis_is_admin()`
- Deletes the 5 `@altis.demo` auth users from `auth.users`
- Verifies by querying `pg_tables` that no `altis_*` tables remain
- Does NOT touch `public.profiles`, `public.workouts`, or any non-demo user

In the app, the Admin view also provides an in-app "purge portfolio data" button.

---

## API Key and Credential Handling

- No API keys or credentials are hardcoded anywhere in the codebase.
- Supabase credentials live exclusively in `.env.local` (gitignored).
- The **personal access token** (`SUPABASE_ACCESS_TOKEN`) has Management API privileges and must be **rotated (invalidated) in the Supabase dashboard** immediately after the event, regardless of whether the purge has been run.
- The anon key (exposed to the browser via `NEXT_PUBLIC_SUPABASE_ANON_KEY`) is protected by Postgres Row-Level Security — no read or write access without a valid user JWT.
- The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is server-only — it is never sent to the browser or included in client bundles.
- Open-Meteo does not require an API key; no credentials need to be stored for weather data.

---

## Anonymisation

The source data is accounting exports from a PE portfolio and is provided in anonymised form for the hackathon. Company identities not present in the source files are represented by anonymised codes (`opco-a`, `opco-gilde`, `opco-e`). Only Peter Ummels is identifiable from file metadata; the company's publicly registered address (Boschstraat 28C, 6442 PB Brunssum) is used solely as the weather proxy location.

---

## Responsible-Deletion Checklist

Before sign-off, confirm all of the following (see `DATA_HANDLING.md` for the full list):

- [ ] `scripts/purge.sh` ran and reported success for all local paths
- [ ] `pipeline/purge_supabase.py` printed "0 altis_ tables remain"
- [ ] No `altis_*` tables visible in the Supabase table editor
- [ ] No `*@altis.demo` users in the Supabase Auth dashboard
- [ ] `data/altis.db` no longer exists on disk
- [ ] `data/raw/` no longer exists on disk
- [ ] Personal access token (`SUPABASE_ACCESS_TOKEN`) rotated in Supabase dashboard
- [ ] `.env.local` deleted from all machines that had a copy
- [ ] Any backup copies of the raw Excel files deleted from local drives / cloud storage
