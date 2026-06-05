-- ============================================================================
-- Altis Weather-Aware Cashflow — Supabase (Postgres) schema
-- ----------------------------------------------------------------------------
-- NAMESPACED: every object is prefixed `altis_` and lives in `public`, so this
-- coexists with anything already in the project and is fully removable with the
-- purge script (drops only altis_* objects + demo users). Integer PKs are
-- preserved exactly as in the local SQLite store so foreign keys line up when
-- data is bulk-loaded. Dates are ISO-8601 TEXT (the forecast engine speaks
-- ISO strings); money is NUMERIC.
--
-- Security model: RLS on. Any authenticated user may READ portfolio data.
-- WRITES happen only via the service role (server/pipeline), which bypasses RLS.
-- The Admin view + destructive actions are gated server-side by role.
-- ============================================================================

drop view  if exists altis_accounts_summary cascade;
drop table if exists altis_trace_links cascade;
drop table if exists altis_forecast_weeks cascade;
drop table if exists altis_weekly_financials cascade;
drop table if exists altis_transactions cascade;
drop table if exists altis_accounts cascade;
drop table if exists altis_monthly_revenue cascade;
drop table if exists altis_weather_weekly cascade;
drop table if exists altis_weather_daily cascade;
drop table if exists altis_weather_locations cascade;
drop table if exists altis_covenants cascade;
drop table if exists altis_assumptions cascade;
drop table if exists altis_companies cascade;
drop table if exists altis_source_files cascade;
drop table if exists altis_pipeline_runs cascade;
-- NB: altis_profiles is intentionally NOT dropped here (keeps user roles across
-- data reloads). The purge script drops it explicitly.

-- ---------------------------------------------------------------------------
create table altis_source_files (
  id integer primary key, filename text not null, source_group text,
  sheet_name text, extracted_at text, file_type text, row_count integer,
  detected_company text, detected_system text, notes text
);
create table altis_companies (
  id integer primary key, code text unique, name text not null, short_name text,
  location_name text, latitude numeric, longitude numeric, weather_location_id integer,
  source_system text, source_confidence text, is_assumption integer default 0, notes text
);
create table altis_weather_locations (
  id integer primary key, code text unique, name text not null,
  latitude numeric not null, longitude numeric not null, notes text
);
create table altis_accounts (
  id integer primary key, company_id integer references altis_companies(id),
  source_account_code text, source_account_name text, normalized_account_code text,
  normalized_category text, mapping_confidence text, mapping_method text
);
create table altis_transactions (
  id integer primary key, company_id integer references altis_companies(id),
  source_file_id integer references altis_source_files(id),
  account_id integer references altis_accounts(id),
  date text, week_start text, document_number text, journal text, account_code text,
  debit numeric default 0, credit numeric default 0, amount_net numeric default 0,
  description text, source_row_hash text
);
create index altis_tx_company_week on altis_transactions(company_id, week_start);
create index altis_tx_week on altis_transactions(week_start);
create table altis_weekly_financials (
  company_id integer references altis_companies(id), week_start text,
  revenue_net numeric default 0, credit_total numeric default 0, debit_total numeric default 0,
  transaction_count integer default 0, baseline_revenue numeric, baseline_credit numeric,
  primary key (company_id, week_start)
);
create table altis_monthly_revenue (
  id integer primary key, company_id integer references altis_companies(id),
  month text, account_label text, amount numeric
);
create table altis_weather_daily (
  location_id integer references altis_weather_locations(id), date text,
  rain_sum numeric, precipitation_hours numeric, temperature_min numeric,
  temperature_max numeric, wind_gust_max numeric, snow_sum numeric, source text, fetched_at text,
  primary key (location_id, date)
);
create table altis_weather_weekly (
  location_id integer references altis_weather_locations(id), week_start text,
  rain_sum numeric, workday_rain_sum numeric, rain_days_2mm integer, rain_days_5mm integer,
  bad_workdays integer, delay_score numeric, source text, is_forecast integer default 0,
  primary key (location_id, week_start)
);
create table altis_covenants (
  id integer primary key, company_id integer references altis_companies(id),
  name text, metric text, threshold numeric, direction text, unit text, basis text,
  is_assumption integer default 1, notes text
);
create table altis_assumptions (
  id integer primary key, key text, scope text, company_id integer, category text,
  value_num numeric, value_text text, unit text, rationale text, source text
);
create table altis_forecast_weeks (
  id integer primary key, scenario text, company_id integer, week_start text,
  week_index integer, is_live_weather integer, baseline_cash_in numeric,
  baseline_cash_out numeric, weather_adjustment numeric, payment_lag_adjustment numeric,
  forecast_cash_in numeric, forecast_cash_out numeric, net_cash_flow numeric,
  closing_cash numeric, covenant_headroom numeric, risk_level text, explanation text
);
create index altis_fw_scope on altis_forecast_weeks(scenario, company_id, week_start);
create table altis_trace_links (
  id integer primary key, forecast_week_id integer references altis_forecast_weeks(id),
  scenario text, company_id integer, week_start text, transaction_id integer,
  driver text, contribution_amount numeric, adjustment_reason text
);
create table altis_pipeline_runs (
  id integer primary key, started_at text, finished_at text, status text, summary jsonb
);

-- ---------------------------------------------------------------------------
-- Auth-linked profiles: one row per app user, carrying their RBAC role.
-- (Not dropped on reload — see note above.)
-- ---------------------------------------------------------------------------
create table if not exists altis_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'project' check (role in ('cfo','board','opco','project','admin')),
  full_name text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- accounts summary view (the GROUP BY the data-quality page needs)
-- ---------------------------------------------------------------------------
create view altis_accounts_summary as
  select c.short_name as company, a.source_account_code as code,
         a.source_account_name as name, a.normalized_category as category,
         a.mapping_confidence as confidence, a.mapping_method as method,
         count(t.id) as txns
  from altis_accounts a
  join altis_companies c on c.id = a.company_id
  left join altis_transactions t on t.account_id = a.id
  group by c.short_name, a.source_account_code, a.source_account_name,
           a.normalized_category, a.mapping_confidence, a.mapping_method;

-- ---------------------------------------------------------------------------
-- RLS — authenticated may read; writes only via service role (bypasses RLS).
-- ---------------------------------------------------------------------------
create or replace function altis_is_admin() returns boolean
  language sql security definer stable as $$
    select exists (select 1 from altis_profiles where user_id = auth.uid() and role = 'admin');
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'altis_source_files','altis_companies','altis_weather_locations','altis_accounts',
    'altis_transactions','altis_weekly_financials','altis_monthly_revenue',
    'altis_weather_daily','altis_weather_weekly','altis_covenants','altis_assumptions',
    'altis_forecast_weeks','altis_trace_links','altis_pipeline_runs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists altis_read on %I', t);
    execute format($p$create policy altis_read on %I for select to authenticated using (true)$p$, t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;

grant select on altis_accounts_summary to authenticated;

alter table altis_profiles enable row level security;
drop policy if exists altis_profiles_self on altis_profiles;
create policy altis_profiles_self on altis_profiles for select to authenticated
  using (user_id = auth.uid() or altis_is_admin());
grant select on altis_profiles to authenticated;
