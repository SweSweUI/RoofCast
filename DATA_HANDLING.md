# Data Handling & Governance — Altis Hackathon Platform

> **DELETION RULE**
> Altis source data is anonymised and provided for the hackathon only.
> **All copies — local and cloud — must be deleted within 3 days after the event.**
> Run `scripts/purge.sh` to remove everything in one step.

---

## 1. What data exists and where it lives

### Local (this machine)

| Path | Contents | Gitignored |
|---|---|---|
| `data/raw/` | Extracted Excel files from the Altis dataset (raw company financials) | Yes |
| `data/altis.db` (+ `-shm`, `-wal`) | SQLite database produced by the pipeline | Yes |
| `data/cache/` | Open-Meteo API response cache and other intermediate downloads | Yes |
| `data/artifacts/` | Derived JSON/CSV exports, data-quality inventory | Yes (except `.gitkeep`) |
| `.env.local` | Supabase credentials and API keys | Yes |

### Cloud (Supabase project)

All Altis objects in the Supabase Postgres project are namespaced `altis_*`:

**Tables** (loaded by `pipeline/push_supabase.py`):
`altis_source_files`, `altis_companies`, `altis_weather_locations`, `altis_accounts`,
`altis_transactions`, `altis_weekly_financials`, `altis_monthly_revenue`,
`altis_weather_daily`, `altis_weather_weekly`, `altis_covenants`, `altis_assumptions`,
`altis_forecast_weeks`, `altis_trace_links`, `altis_pipeline_runs`, `altis_profiles`

**Views**: `altis_accounts_summary`

**Functions**: `altis_is_admin()`

**Auth users** (5 demo accounts created under `auth.users`):
`cfo@altis.demo`, `board@altis.demo`, `opco@altis.demo`, `project@altis.demo`, `admin@altis.demo`

The same Supabase project contains unrelated personal data (`public.profiles`,
`public.workouts`). The purge script is scoped exclusively to `altis_*` objects and
`@altis.demo` users — it never touches any other table, view, function, or user.

---

## 2. What is NOT committed to the repository

The following are excluded by `.gitignore` and must never be committed:

- `data/raw/` — raw Excel source files
- `data/altis.db`, `data/altis.db-shm`, `data/altis.db-wal` — the SQLite database
- `data/cache/` — API caches
- `data/artifacts/*` — derived data (`.gitkeep` placeholder is committed)
- `.env`, `.env*.local`, `.env.local` — all environment files containing credentials
- `*.xlsx`, `*.xls` — any Excel files anywhere in the tree
- `ios/Altis/Secrets.swift` — generated Swift credentials file

Enforcement: `.gitignore` covers all of the above. Pre-commit hooks are not currently
configured; treat the gitignore as the authoritative boundary.

---

## 3. API key and credential handling

- **No hardcoded keys** anywhere in the codebase.
- Supabase credentials live exclusively in `.env.local` (gitignored):
  - `SUPABASE_ACCESS_TOKEN` — personal access token for the Management API
  - `SUPABASE_PROJECT_REF` — project reference ID
  - `NEXT_PUBLIC_SUPABASE_URL` — public project URL (safe to expose in-browser, but RLS-protected)
  - `SUPABASE_SERVICE_ROLE_KEY` — server-only service role key; never sent to the client
- The **anon key** (exposed to the browser via Next.js) is protected by Postgres Row-Level
  Security (RLS). Authenticated users may only read; writes go through the service role on
  the server.
- The **personal access token** (`SUPABASE_ACCESS_TOKEN`) has Management API privileges.
  It must be rotated (invalidated in the Supabase dashboard) immediately after the event,
  regardless of whether the purge has been run.
- The iOS app reads credentials from `ios/Altis/Secrets.swift`, which is generated from
  `.env.local` and is gitignored.

---

## 4. How to purge everything (the 3-day requirement)

Run the single purge script from the repo root:

```bash
bash scripts/purge.sh
```

You will be prompted to type `DELETE` to confirm. To skip the prompt in automation:

```bash
bash scripts/purge.sh --yes
```

### What `scripts/purge.sh` removes

**Local:**
- `data/raw/` — entire directory
- `data/altis.db`, `data/altis.db-shm`, `data/altis.db-wal`
- `data/cache/` — entire directory
- `data/artifacts/*` — all files except `.gitkeep`
- `ios/build/` — compiled iOS build output
- `ios/Altis/Secrets.swift` — generated credentials file

The script does NOT delete source code, Next.js pages, pipeline scripts, or
the `supabase/schema.sql` definition file.

**Cloud (Supabase) — run via `pipeline/purge_supabase.py`:**
- Drops the view `altis_accounts_summary`
- Drops every `altis_*` table (`altis_profiles` included) with `CASCADE`
- Drops the function `altis_is_admin()`
- Deletes the 5 `@altis.demo` auth users from `auth.users`
- Verifies by querying `pg_tables` that no `altis_*` tables remain
- **Does NOT touch** `public.profiles`, `public.workouts`, or any non-demo user

The cloud purge runs only if `.env.local` is present. If it is missing, the script
warns and skips the Supabase step — you must run `pipeline/purge_supabase.py` manually
once credentials are restored.

---

## 5. Responsible-deletion checklist

Use this before and after the purge to confirm nothing has been missed.

- [ ] `scripts/purge.sh` has been run and reported success for all local paths.
- [ ] `pipeline/purge_supabase.py` printed "0 altis_ tables remain" in its verification step.
- [ ] No `altis_*` tables visible in the Supabase table editor.
- [ ] No `*@altis.demo` users listed in the Supabase Auth dashboard.
- [ ] `data/altis.db` no longer exists on disk.
- [ ] `data/raw/` directory no longer exists on disk.
- [ ] `data/cache/` directory no longer exists on disk.
- [ ] Personal access token (`SUPABASE_ACCESS_TOKEN`) rotated in the Supabase dashboard.
- [ ] `.env.local` deleted from all machines that had a copy.
- [ ] Any backup copies of the raw Excel files deleted from local drives / cloud storage.
- [ ] No Altis data in any CI/CD secrets or deployment environment variables.
