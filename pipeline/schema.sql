-- ============================================================================
-- Altis Weather-Aware Cashflow — unified data model
-- ----------------------------------------------------------------------------
-- Written for SQLite (the local-first store) but deliberately Postgres-portable:
--   * ISO-8601 TEXT for all dates/timestamps (no DB-specific date types)
--   * INTEGER PRIMARY KEY (SQLite rowid alias)  ->  use IDENTITY/SERIAL on PG
--   * REAL for money (display rounding done in the app)  ->  NUMERIC on PG
-- The Postgres DDL variant lives in docs/schema.md. The ingestion pipeline
-- DROPs and re-creates everything for a deterministic rebuild.
-- ============================================================================

DROP TABLE IF EXISTS trace_links;
DROP TABLE IF EXISTS forecast_weeks;
DROP TABLE IF EXISTS weekly_financials;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS monthly_revenue;
DROP TABLE IF EXISTS weather_weekly;
DROP TABLE IF EXISTS weather_daily;
DROP TABLE IF EXISTS weather_locations;
DROP TABLE IF EXISTS covenants;
DROP TABLE IF EXISTS assumptions;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS source_files;
DROP TABLE IF EXISTS pipeline_runs;

-- ---------------------------------------------------------------------------
-- Provenance: every ingested workbook/sheet is recorded here for traceability.
-- ---------------------------------------------------------------------------
CREATE TABLE source_files (
  id               INTEGER PRIMARY KEY,
  filename         TEXT NOT NULL,
  source_group     TEXT,            -- folder the file came from
  sheet_name       TEXT,
  extracted_at     TEXT,            -- ISO timestamp of ingestion
  file_type        TEXT,           -- xlsx / csv
  row_count        INTEGER,         -- rows ingested from this sheet
  detected_company TEXT,
  detected_system  TEXT,            -- Gilde / Exact-style GL / Snelstart-FinTransactions / ...
  notes            TEXT
);

-- ---------------------------------------------------------------------------
-- Operating companies (opcos) in the portfolio + their weather proxy location.
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  id                  INTEGER PRIMARY KEY,
  code                TEXT UNIQUE,  -- short stable handle, e.g. 'ummels'
  name                TEXT NOT NULL,
  short_name          TEXT,
  location_name       TEXT,
  latitude            REAL,
  longitude           REAL,
  weather_location_id INTEGER,      -- -> weather_locations.id
  source_system       TEXT,
  source_confidence   TEXT,         -- high / medium / low / assumption
  is_assumption       INTEGER DEFAULT 0,
  notes               TEXT
);

-- ---------------------------------------------------------------------------
-- Weather proxy locations (one per geography; companies point at one).
-- ---------------------------------------------------------------------------
CREATE TABLE weather_locations (
  id        INTEGER PRIMARY KEY,
  code      TEXT UNIQUE,            -- 'brunssum' / 'maastricht'
  name      TEXT NOT NULL,
  latitude  REAL NOT NULL,
  longitude REAL NOT NULL,
  notes     TEXT
);

-- ---------------------------------------------------------------------------
-- Chart-of-accounts normalization: source account -> normalized category.
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
  id                     INTEGER PRIMARY KEY,
  company_id             INTEGER REFERENCES companies(id),
  source_account_code    TEXT,
  source_account_name    TEXT,
  normalized_account_code TEXT,     -- e.g. '8000-revenue'
  normalized_category    TEXT,      -- revenue_high / revenue_reverse_charge / revenue_other / ...
  mapping_confidence     TEXT,      -- high / medium / low
  mapping_method         TEXT       -- exact_code / journal_heuristic / filename / manual
);

-- ---------------------------------------------------------------------------
-- Normalized transaction lines. amount_net = credit - debit (revenue positive).
-- ---------------------------------------------------------------------------
CREATE TABLE transactions (
  id              INTEGER PRIMARY KEY,
  company_id      INTEGER REFERENCES companies(id),
  source_file_id  INTEGER REFERENCES source_files(id),
  account_id      INTEGER REFERENCES accounts(id),
  date            TEXT,             -- ISO date (booking/document date)
  week_start      TEXT,             -- ISO Monday of that week
  document_number TEXT,
  journal         TEXT,
  account_code    TEXT,
  debit           REAL DEFAULT 0,
  credit          REAL DEFAULT 0,
  amount_net      REAL DEFAULT 0,   -- credit - debit
  description     TEXT,
  source_row_hash TEXT              -- stable hash of the raw row for dedup/trace
);
CREATE INDEX idx_tx_company_week ON transactions(company_id, week_start);
CREATE INDEX idx_tx_week ON transactions(week_start);
CREATE INDEX idx_tx_hash ON transactions(source_row_hash);

-- ---------------------------------------------------------------------------
-- Weekly financial aggregates per company (the forecast baseline input).
-- ---------------------------------------------------------------------------
CREATE TABLE weekly_financials (
  company_id        INTEGER REFERENCES companies(id),
  week_start        TEXT,
  revenue_net       REAL DEFAULT 0,   -- credit_total - debit_total
  credit_total      REAL DEFAULT 0,   -- gross facturation
  debit_total       REAL DEFAULT 0,   -- corrections / credit notes
  transaction_count INTEGER DEFAULT 0,
  baseline_revenue  REAL,             -- rolling baseline (filled by engine/pipeline)
  baseline_credit   REAL,
  PRIMARY KEY (company_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Monthly revenue summary (Altis dataset 1) — used for reconciliation only.
-- ---------------------------------------------------------------------------
CREATE TABLE monthly_revenue (
  id            INTEGER PRIMARY KEY,
  company_id    INTEGER REFERENCES companies(id),
  month         TEXT,                -- ISO first-of-month
  account_label TEXT,
  amount        REAL
);

-- ---------------------------------------------------------------------------
-- Daily + weekly weather per location.
-- ---------------------------------------------------------------------------
CREATE TABLE weather_daily (
  location_id        INTEGER REFERENCES weather_locations(id),
  date               TEXT,
  rain_sum           REAL,
  precipitation_hours REAL,
  temperature_min    REAL,
  temperature_max    REAL,
  wind_gust_max      REAL,
  snow_sum           REAL,
  source             TEXT,           -- open-meteo-archive / open-meteo-forecast / csv-cache
  fetched_at         TEXT,
  PRIMARY KEY (location_id, date)
);

CREATE TABLE weather_weekly (
  location_id     INTEGER REFERENCES weather_locations(id),
  week_start      TEXT,
  rain_sum        REAL,
  workday_rain_sum REAL,            -- Mon-Fri rain
  rain_days_2mm   INTEGER,          -- workdays with >= 2mm
  rain_days_5mm   INTEGER,          -- workdays with >= 5mm
  bad_workdays    INTEGER,          -- strict bad roofing days
  delay_score     REAL,             -- composite 0..~40 weather-delay risk score
  source          TEXT,             -- historical / live-forecast / seasonal
  is_forecast     INTEGER DEFAULT 0,
  PRIMARY KEY (location_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Covenant terms. If real terms are unavailable these are configurable
-- assumptions (is_assumption = 1) and the UI labels them as such.
-- ---------------------------------------------------------------------------
CREATE TABLE covenants (
  id            INTEGER PRIMARY KEY,
  company_id    INTEGER REFERENCES companies(id),  -- NULL = portfolio level
  name          TEXT,
  metric        TEXT,             -- min_cash_balance / min_13w_liquidity / dscr / leverage
  threshold     REAL,
  direction     TEXT,             -- 'min' (>= threshold ok) or 'max' (<= threshold ok)
  unit          TEXT,
  basis         TEXT,             -- description of how it is measured
  is_assumption INTEGER DEFAULT 1,
  notes         TEXT
);

-- ---------------------------------------------------------------------------
-- Central registry of every modelling assumption surfaced in the app.
-- ---------------------------------------------------------------------------
CREATE TABLE assumptions (
  id         INTEGER PRIMARY KEY,
  key        TEXT,
  scope      TEXT,                -- global / company / scenario
  company_id INTEGER,
  category   TEXT,                -- payment_lag / drivers / weather / covenant / location
  value_num  REAL,
  value_text TEXT,
  unit       TEXT,
  rationale  TEXT,
  source     TEXT                 -- data / brief / industry-default / inferred
);

-- ---------------------------------------------------------------------------
-- Forecast output snapshot (engine is the source of truth; this is the
-- persisted base/wet/dry snapshot so the tables are queryable + auditable).
-- Mirrors the TypeScript ForecastWeek contract exactly.
-- ---------------------------------------------------------------------------
CREATE TABLE forecast_weeks (
  id                    INTEGER PRIMARY KEY,
  scenario              TEXT,        -- base / wet_quarter / dry_quarter
  company_id            INTEGER REFERENCES companies(id),
  week_start            TEXT,
  week_index            INTEGER,     -- 1..13
  is_live_weather       INTEGER,     -- 1 = live forecast window, 0 = seasonal
  baseline_cash_in      REAL,
  baseline_cash_out     REAL,
  weather_adjustment    REAL,        -- signed € shifted out of / into this week
  payment_lag_adjustment REAL,
  forecast_cash_in      REAL,
  forecast_cash_out     REAL,
  net_cash_flow         REAL,
  closing_cash          REAL,
  covenant_headroom     REAL,
  risk_level            TEXT,        -- low / medium / high
  explanation           TEXT
);
CREATE INDEX idx_fw_scope ON forecast_weeks(scenario, company_id, week_start);

-- ---------------------------------------------------------------------------
-- Traceability: links a forecast week back to source transactions / drivers /
-- adjustments. Every forecast number is explainable through these rows.
-- ---------------------------------------------------------------------------
CREATE TABLE trace_links (
  id                 INTEGER PRIMARY KEY,
  forecast_week_id   INTEGER REFERENCES forecast_weeks(id),
  scenario           TEXT,
  company_id         INTEGER,
  week_start         TEXT,
  transaction_id     INTEGER REFERENCES transactions(id),
  driver             TEXT,          -- baseline / materials / subcontractor / labour / overhead / weather_delay / payment_lag / catch_up
  contribution_amount REAL,
  adjustment_reason  TEXT
);
CREATE INDEX idx_trace_fw ON trace_links(forecast_week_id);
CREATE INDEX idx_trace_scope ON trace_links(scenario, company_id, week_start);

-- ---------------------------------------------------------------------------
-- Pipeline run log (data-quality panel reads the latest run).
-- ---------------------------------------------------------------------------
CREATE TABLE pipeline_runs (
  id          INTEGER PRIMARY KEY,
  started_at  TEXT,
  finished_at TEXT,
  status      TEXT,
  summary     TEXT               -- JSON blob with counts + reconciliation
);
