# Database Schema

The schema is defined in `pipeline/schema.sql`. SQLite is the local-first store; the design is deliberately Postgres-portable. See the portability notes at the end of this document.

The pipeline runs `DROP TABLE IF EXISTS` followed by `CREATE TABLE` for every table, making every rebuild deterministic.

---

## Tables

### `pipeline_runs`

One row per invocation of `pipeline/run_all.py`. Read by the data-quality panel.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| started_at | TEXT | ISO timestamp of run start |
| finished_at | TEXT | ISO timestamp of run end |
| status | TEXT | `running` / `ok` / `error` |
| summary | TEXT | JSON blob: `{"rows": N, "files": N}` |

---

### `source_files`

One row per Excel workbook sheet loaded by the ingestion pipeline. Provides full data provenance.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| filename | TEXT | Base filename of the workbook |
| source_group | TEXT | Subfolder: `portfolio company data`, `portfolio company 2 data`, `datasets` |
| sheet_name | TEXT | Sheet name within the workbook |
| extracted_at | TEXT | ISO timestamp of ingestion |
| file_type | TEXT | `xlsx` / `csv` |
| row_count | INTEGER | Rows ingested from this sheet (after parsing, before dedup) |
| detected_company | TEXT | Company name inferred from file/folder |
| detected_system | TEXT | Accounting system: `Gilde`, `Exact-style GL`, `Snelstart / FinTransactions`, `Invoice register`, `summary` |
| notes | TEXT | Free-text notes, e.g. account code found in header |

---

### `companies`

One row per operating company in the portfolio. Seeded from `pipeline/config.py COMPANIES`.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| code | TEXT UNIQUE | Stable handle: `ummels`, `opco-a`, `opco-gilde`, `opco-e` |
| name | TEXT | Full name, e.g. `Dakdekkersbedrijf Peter Ummels` |
| short_name | TEXT | Display name, e.g. `Peter Ummels` |
| location_name | TEXT | Human-readable location, e.g. `Brunssum, NL` |
| latitude | REAL | Weather proxy latitude (copied from `weather_locations`) |
| longitude | REAL | Weather proxy longitude |
| weather_location_id | INTEGER | FK → `weather_locations.id` |
| source_system | TEXT | Source accounting system description |
| source_confidence | TEXT | `high` / `medium` / `low` |
| is_assumption | INTEGER | 1 if company identity is assumed |
| notes | TEXT | Provenance notes |

---

### `weather_locations`

One row per geographic proxy location. Currently: Brunssum (Ummels HQ) and Maastricht (all other companies).

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| code | TEXT UNIQUE | `brunssum` / `maastricht` |
| name | TEXT | Display name |
| latitude | REAL | Open-Meteo latitude |
| longitude | REAL | Open-Meteo longitude |
| notes | TEXT | Source / rationale for this location |

---

### `accounts`

Chart-of-accounts normalisation. One row per (company, source account code) pair, inserted on first sight during ingestion.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| company_id | INTEGER | FK → `companies.id` |
| source_account_code | TEXT | Raw code from the source file, e.g. `8001` |
| source_account_name | TEXT | Raw name, e.g. `Omzet verlegd` |
| normalized_account_code | TEXT | Stable code, e.g. `8001-revenue_reverse_charge` |
| normalized_category | TEXT | `revenue_high` / `revenue_reverse_charge` / `revenue_other` |
| mapping_confidence | TEXT | `high` / `medium` / `low` |
| mapping_method | TEXT | `exact_code` / `journal_heuristic` / `fallback` |

---

### `transactions`

Normalised transaction lines. The central fact table. `amount_net = credit − debit` (positive = revenue credit).

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| company_id | INTEGER | FK → `companies.id` |
| source_file_id | INTEGER | FK → `source_files.id` — full provenance trace |
| account_id | INTEGER | FK → `accounts.id` |
| date | TEXT | ISO date of booking/document date |
| week_start | TEXT | ISO Monday of the week containing `date` |
| document_number | TEXT | Source document/booking number |
| journal | TEXT | Source journal name, e.g. `Verkoopboek Gilde` |
| account_code | TEXT | Source account code (denormalised for query convenience) |
| debit | REAL | Debit amount (corrections/credit notes) |
| credit | REAL | Credit amount (revenue) |
| amount_net | REAL | `credit − debit` |
| description | TEXT | Account name or booking text |
| source_row_hash | TEXT | 16-char SHA-1 content hash for dedup |

**Indexes:** `(company_id, week_start)`, `(week_start)`, `(source_row_hash)`

---

### `weekly_financials`

Weekly revenue aggregates per company. The primary input to the forecast engine. Keyed on `(company_id, week_start)`.

| Column | Type | Purpose |
|---|---|---|
| company_id | INTEGER | FK → `companies.id` |
| week_start | TEXT | ISO Monday |
| revenue_net | REAL | `SUM(amount_net)` = `credit_total − debit_total` |
| credit_total | REAL | Gross facturation (credit sum) |
| debit_total | REAL | Corrections/credit notes (debit sum) |
| transaction_count | INTEGER | Number of source lines in the week |
| baseline_revenue | REAL | 8-week trailing-median of `revenue_net` |
| baseline_credit | REAL | 8-week trailing-median of `credit_total` |

The 8-week trailing-median baseline is computed by the pipeline and stored here for audit. The live forecast engine also computes it dynamically from the same window.

---

### `monthly_revenue`

Monthly revenue summary from `Altis dataset 1.xlsx`. Used for reconciliation only; not consumed by the forecast engine.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| company_id | INTEGER | FK → `companies.id` |
| month | TEXT | ISO first-of-month, e.g. `2023-01-01` |
| account_label | TEXT | Row label from the summary, e.g. `Netto` |
| amount | REAL | Amount for that month/label |

---

### `weather_daily`

Daily weather observations and forecasts per location. Primary key `(location_id, date)` — `INSERT OR REPLACE` makes re-runs idempotent.

| Column | Type | Purpose |
|---|---|---|
| location_id | INTEGER | FK → `weather_locations.id` |
| date | TEXT | ISO date |
| rain_sum | REAL | Daily rain sum in mm (uses `rain_sum` from Open-Meteo; falls back to `precipitation_sum`) |
| precipitation_hours | REAL | Hours with precipitation |
| temperature_min | REAL | Min temperature °C |
| temperature_max | REAL | Max temperature °C |
| wind_gust_max | REAL | Max wind gust km/h |
| snow_sum | REAL | Snow in mm (converted from Open-Meteo cm) |
| source | TEXT | `open-meteo-archive` / `open-meteo-forecast` / `csv-cache` |
| fetched_at | TEXT | ISO timestamp of the fetch |

---

### `weather_weekly`

Weekly weather aggregates per location. Derived from `weather_daily` by the pipeline. Primary key `(location_id, week_start)`.

| Column | Type | Purpose |
|---|---|---|
| location_id | INTEGER | FK → `weather_locations.id` |
| week_start | TEXT | ISO Monday |
| rain_sum | REAL | Total rain for the full week (all days) |
| workday_rain_sum | REAL | Rain sum for Mon–Fri workdays only |
| rain_days_2mm | INTEGER | Workdays with rain >= 2.0mm |
| rain_days_5mm | INTEGER | Workdays with rain >= 5.0mm |
| bad_workdays | INTEGER | Workdays meeting bad-roofing threshold: rain >= 5mm OR gust >= 60 km/h OR snow >= 1mm |
| delay_score | REAL | Composite delay risk: `2·rain_days_2mm + 2·rain_days_5mm + 3·bad_workdays + 0.15·workday_rain_sum` |
| source | TEXT | `historical` / `live-forecast` / `seasonal` |
| is_forecast | INTEGER | 1 if any day in the week is after today |

---

### `covenants`

Covenant terms. When real terms are not available, `is_assumption = 1` and the UI labels them accordingly.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| company_id | INTEGER | FK → `companies.id`; NULL for portfolio-level covenants |
| name | TEXT | Display name, e.g. `Min cash balance` |
| metric | TEXT | `min_cash_balance` / `min_13w_liquidity` / `dscr` / `leverage` |
| threshold | REAL | Threshold value in EUR |
| direction | TEXT | `min` (closing cash must stay above threshold) or `max` |
| unit | TEXT | `EUR` |
| basis | TEXT | Description of how the metric is measured |
| is_assumption | INTEGER | 1 = assumed; 0 = from actual loan documentation |
| notes | TEXT | Additional notes |

Current configured covenants: portfolio min 13-week liquidity (€750,000), Ummels min cash balance (€250,000), Opco A min cash balance (€400,000), Opco C min cash balance (€200,000). All are assumptions (`is_assumption = 1`).

---

### `assumptions`

Central registry of every modelling assumption surfaced in the app. Read by the `/methodology` panel.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| key | TEXT | Machine-readable key, e.g. `driver_materials_pct` |
| scope | TEXT | `global` / `company` / `scenario` |
| company_id | INTEGER | FK → `companies.id`; NULL for global assumptions |
| category | TEXT | `payment_lag` / `drivers` / `weather` / `covenant` / `location` |
| value_num | REAL | Numeric value |
| value_text | TEXT | Text value (for non-numeric assumptions) |
| unit | TEXT | `weeks`, `share_of_revenue`, `share`, etc. |
| rationale | TEXT | Human-readable explanation |
| source | TEXT | `data` / `brief` / `industry-default` / `inferred` |

---

### `forecast_weeks`

Persisted forecast output snapshot. Written by `npx tsx lib/forecast/snapshot.ts`. The live TypeScript engine is the source of truth; this table makes the output queryable and auditable.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| scenario | TEXT | `base` / `wet_quarter` / `dry_quarter` |
| company_id | INTEGER | FK → `companies.id`; NULL for portfolio |
| week_start | TEXT | ISO Monday |
| week_index | INTEGER | 1..13 |
| is_live_weather | INTEGER | 1 = live Open-Meteo forecast; 0 = seasonal |
| baseline_cash_in | REAL | Cash-in without weather adjustment |
| baseline_cash_out | REAL | Cash-out (driver percentages × baseline production) |
| weather_adjustment | REAL | Signed EUR shifted into or out of this week by the weather model |
| payment_lag_adjustment | REAL | Difference: cash collected minus work billed this week |
| forecast_cash_in | REAL | Final forecast cash-in |
| forecast_cash_out | REAL | Final forecast cash-out |
| net_cash_flow | REAL | `forecast_cash_in − forecast_cash_out` |
| closing_cash | REAL | Running closing cash balance |
| covenant_headroom | REAL | `closing_cash − covenant_threshold`; NULL if no covenant |
| risk_level | TEXT | `low` / `medium` / `high` |
| explanation | TEXT | Natural-language explanation of this week's numbers |

Written by `npx tsx lib/forecast/snapshot.ts`. The live TypeScript engine is the source of truth; this table makes the output queryable and auditable.

**Index:** `(scenario, company_id, week_start)`

---

### `trace_links`

Traceability rows linking each forecast week back to its components. Every number in `forecast_weeks` is explainable through these rows.

| Column | Type | Purpose |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| forecast_week_id | INTEGER | FK → `forecast_weeks.id` |
| scenario | TEXT | Denormalised for direct query convenience |
| company_id | INTEGER | Denormalised |
| week_start | TEXT | Denormalised |
| transaction_id | INTEGER | FK → `transactions.id`; NULL for non-transaction drivers |
| driver | TEXT | `baseline_cash_in` / `materials` / `subcontractor` / `labour` / `overhead` / `weather_delay` / `payment_lag` / `catch_up` |
| contribution_amount | REAL | Signed EUR contribution of this driver to the week's cash |
| adjustment_reason | TEXT | Human-readable explanation |

**Indexes:** `(forecast_week_id)`, `(scenario, company_id, week_start)`

---

## Postgres Portability

The schema is written for SQLite but is designed to be portable. To run on Postgres:

1. Replace `INTEGER PRIMARY KEY` with `SERIAL PRIMARY KEY` (or `BIGSERIAL`) — SQLite's `INTEGER PRIMARY KEY` is its rowid alias; Postgres needs an explicit sequence.
2. Replace `REAL` with `NUMERIC(18,2)` for monetary columns. SQLite `REAL` is an IEEE 754 double; Postgres `NUMERIC` avoids floating-point rounding in financial arithmetic.
3. ISO-8601 `TEXT` dates can stay as `TEXT` or be converted to `DATE` / `TIMESTAMPTZ` — no behaviour change is required by the app since all date comparison is string-based (ISO dates sort lexicographically).
4. Remove the `DROP TABLE IF EXISTS ... CASCADE` workaround if you add foreign-key constraints to Postgres (SQLite ignores FK constraints unless `PRAGMA foreign_keys = ON`).
5. In `lib/db.ts`, replace `DatabaseSync` from `node:sqlite` with the `pg` client and convert `?` placeholders to `$1`, `$2`, … — the comments in `lib/db.ts` document this swap explicitly. See `docs/deployment.md` for the full migration path.

**Minimal Postgres DDL delta:**

```sql
-- Replace INTEGER PRIMARY KEY with SERIAL in every CREATE TABLE.
-- Replace REAL with NUMERIC(18,2) for money columns.
-- Example:
CREATE TABLE transactions (
  id              SERIAL PRIMARY KEY,
  ...
  debit           NUMERIC(18,2) DEFAULT 0,
  credit          NUMERIC(18,2) DEFAULT 0,
  amount_net      NUMERIC(18,2) DEFAULT 0,
  ...
);
```
