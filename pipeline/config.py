"""
Central configuration for the Altis pipeline.

Everything non-obvious about the source data — which folder maps to which
operating company, which accounting system produced it, the weather proxy for
each company, and the modelling assumptions — is declared here so it is auditable
in one place and surfaced in the app's "Assumptions" panel.
"""
from __future__ import annotations

import os
from pathlib import Path

# --- paths ------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path(os.environ.get("ALTIS_RAW_DIR", ROOT / "data" / "raw"))
DB_PATH = Path(os.environ.get("ALTIS_DB_PATH", ROOT / "data" / "altis.db"))
ARTIFACTS_DIR = ROOT / "data" / "artifacts"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

# Existing weather/stats work produced in an earlier analysis session. Used as a
# cache / fallback when the live Open-Meteo API is unreachable.
PRIOR_WORK = Path(
    "/Users/sweder/Documents/Codex/2026-06-05/vind-de-challagne-page-https-hub/work"
)

# --- weather proxy locations ------------------------------------------------
# Peter Ummels is publicly located at Boschstraat 28C, 6442 PB Brunssum, so
# Brunssum is the weather proxy. Maastricht is a second South-Limburg proxy.
WEATHER_LOCATIONS = [
    {"code": "brunssum", "name": "Brunssum (NL)", "latitude": 50.9472, "longitude": 5.9714,
     "notes": "Peter Ummels HQ proxy (Boschstraat 28C, 6442 PB Brunssum)."},
    {"code": "maastricht", "name": "Maastricht (NL)", "latitude": 50.8514, "longitude": 5.6910,
     "notes": "Second South-Limburg proxy; used for companies with unknown location."},
]

# --- operating companies ----------------------------------------------------
# Each entry describes how one opco is recognised in the raw files and which
# weather proxy + accounting system it maps to.
COMPANIES = [
    {
        "code": "ummels",
        "name": "Dakdekkersbedrijf Peter Ummels",
        "short_name": "Peter Ummels",
        "location_name": "Brunssum, NL",
        "weather_code": "brunssum",
        "source_system": "Snelstart / FinTransactions export",
        "source_confidence": "high",
        "is_assumption": 0,
        "notes": "Roofing company, named directly in the source files (admin 82604). "
                 "Primary subject of the weather-delay analysis.",
        "source_glob": "portfolio company 2 data/*.xlsx",
    },
    {
        "code": "opco-a",
        "name": "Opco A (GL 8000-series)",
        "short_name": "Opco A",
        "location_name": "South Limburg, NL (assumed)",
        "weather_code": "maastricht",
        "source_system": "Exact-style general-ledger export",
        "source_confidence": "medium",
        "is_assumption": 0,
        "notes": "Anonymised GL exports (accounts 8000/8001/8002). Company identity "
                 "not in files; location assumed South Limburg -> Maastricht proxy.",
        "source_glob": "portfolio company data/*.xlsx",
    },
    {
        "code": "opco-gilde",
        "name": "Opco C (Gilde)",
        "short_name": "Opco C",
        "location_name": "NL (assumed South Limburg)",
        "weather_code": "maastricht",
        "source_system": "Gilde (Verkoopboek Gilde)",
        "source_confidence": "medium",
        "is_assumption": 0,
        "notes": "From 'Altis dataset 2' yearly transaction sheets; journals include "
                 "'Verkoopboek Gilde'. Location assumed -> Maastricht proxy.",
        "source_glob": None,  # handled explicitly from datasets/Altis dataset 2.xlsx
    },
    {
        "code": "opco-e",
        "name": "Company E",
        "short_name": "Company E",
        "location_name": "NL (assumed South Limburg)",
        "weather_code": "maastricht",
        "source_system": "Invoice register",
        "source_confidence": "low",
        "is_assumption": 0,
        "notes": "From 'Company E 2026' invoice sheet in 'Altis dataset 2'. Partial "
                 "(2026 only). Location assumed -> Maastricht proxy.",
        "source_glob": None,
    },
]

# --- account normalization --------------------------------------------------
# Map raw GL account codes -> normalized category. Revenue is booked on the
# CREDIT side of these sales accounts; debits are corrections / credit notes.
ACCOUNT_MAP = {
    "8000": ("revenue_high", "Omzet hoog (high VAT revenue)"),
    "8001": ("revenue_reverse_charge", "Omzet verlegd (reverse-charge revenue)"),
    "8002": ("revenue_other", "Omzet overig"),
    "8005": ("revenue_reverse_charge", "Omzet waarbij de heffing naar u is verlegd"),
}

# --- weather feature parameters ---------------------------------------------
WORKDAYS = [0, 1, 2, 3, 4]  # Mon..Fri
RAIN_2MM = 2.0
RAIN_5MM = 5.0
# A "bad roofing workday": meaningful rain OR strong wind gusts OR snow.
BAD_DAY_RAIN_MM = 5.0
BAD_DAY_WIND_GUST_KMH = 60.0
BAD_DAY_SNOW_MM = 1.0

# --- modelling assumptions (mirrored by lib/forecast/config.ts) -------------
# These seed the `assumptions` table for display/audit. The live forecast engine
# (TypeScript) holds the canonical defaults and accepts API overrides.
ASSUMPTIONS = [
    {"key": "payment_lag_weeks_mean", "scope": "global", "category": "payment_lag",
     "value_num": 4.0, "unit": "weeks", "source": "industry-default",
     "rationale": "Roofing/construction debtor days ~30-45d; modelled as a spread "
                  "of facturation into cash over weeks t+2..t+8 (peak ~t+4)."},
    {"key": "driver_materials_pct", "scope": "global", "category": "drivers",
     "value_num": 0.32, "unit": "share_of_revenue", "source": "industry-default",
     "rationale": "Materials outflow ~32% of revenue (configurable)."},
    {"key": "driver_subcontractor_pct", "scope": "global", "category": "drivers",
     "value_num": 0.18, "unit": "share_of_revenue", "source": "industry-default",
     "rationale": "Subcontractor outflow ~18% of revenue (configurable)."},
    {"key": "driver_labour_pct", "scope": "global", "category": "drivers",
     "value_num": 0.22, "unit": "share_of_revenue", "source": "industry-default",
     "rationale": "Direct labour/payroll ~22% of revenue (configurable)."},
    {"key": "driver_overhead_pct", "scope": "global", "category": "drivers",
     "value_num": 0.10, "unit": "share_of_revenue", "source": "industry-default",
     "rationale": "Overhead ~10% of revenue (configurable)."},
    {"key": "weather_shift_share_high", "scope": "global", "category": "weather",
     "value_num": 0.25, "unit": "share", "source": "inferred",
     "rationale": "High weather-delay weeks (3+ rain workdays) shift ~25% of that "
                  "week's billing/cash-in later. Suggestive, not causal (p~0.065)."},
    {"key": "weather_shift_share_medium", "scope": "global", "category": "weather",
     "value_num": 0.12, "unit": "share", "source": "inferred",
     "rationale": "Medium weather-delay weeks (2 rain workdays) shift ~12% later."},
    {"key": "weather_delay_window", "scope": "global", "category": "weather",
     "value_text": "lag 3-5 out, catch-up 4-7", "source": "data",
     "rationale": "Historical lag profile: dip ~lag3, catch-up ~lag4, stronger dip "
                  "~lag5, recovery ~lag7."},
]

# --- covenant assumptions (configurable; not in source data) ----------------
COVENANTS = [
    {"company_code": None, "name": "Portfolio min 13-week liquidity", "metric": "min_13w_liquidity",
     "threshold": 750000.0, "direction": "min", "unit": "EUR", "is_assumption": 1,
     "basis": "Lowest projected closing cash across the 13-week horizon must stay above floor."},
    {"company_code": "ummels", "name": "Min cash balance", "metric": "min_cash_balance",
     "threshold": 250000.0, "direction": "min", "unit": "EUR", "is_assumption": 1,
     "basis": "Weekly closing cash floor (assumption)."},
    {"company_code": "opco-a", "name": "Min cash balance", "metric": "min_cash_balance",
     "threshold": 400000.0, "direction": "min", "unit": "EUR", "is_assumption": 1,
     "basis": "Weekly closing cash floor (assumption)."},
    {"company_code": "opco-gilde", "name": "Min cash balance", "metric": "min_cash_balance",
     "threshold": 200000.0, "direction": "min", "unit": "EUR", "is_assumption": 1,
     "basis": "Weekly closing cash floor (assumption)."},
]

# Opening cash position per company at the forecast start (assumption — no bank
# balances in the revenue-only GL exports).
OPENING_CASH = {
    "ummels": 600000.0,
    "opco-a": 900000.0,
    # Opco C deliberately tight (assumption) -> the portfolio's covenant-risk concentration.
    "opco-gilde": 200000.0,
    "opco-e": 120000.0,
}
