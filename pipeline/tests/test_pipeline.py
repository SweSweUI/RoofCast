"""
Pipeline validation tests (pytest). Run AFTER the pipeline has built the DB:

    npm run pipeline   # or: python3 pipeline/run_all.py
    python3 -m pytest pipeline/tests -q

These assert the data foundation is correct — most importantly the dedup
"anchor": Peter Ummels must reconcile to exactly 9,958 transactions / ~€36.7M,
matching the independent prior analysis. If that drifts, ingestion broke.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "altis.db"
ARTIFACTS = ROOT / "data" / "artifacts"


@pytest.fixture(scope="module")
def db():
    if not DB.exists():
        pytest.skip("data/altis.db not found — run `npm run pipeline` first.")
    conn = sqlite3.connect(str(DB))
    yield conn
    conn.close()


def company_id(db, code):
    row = db.execute("SELECT id FROM companies WHERE code = ?", (code,)).fetchone()
    assert row, f"company {code} missing"
    return row[0]


# --- the validation anchor --------------------------------------------------
def test_ummels_reconciles_to_prior_analysis(db):
    cid = company_id(db, "ummels")
    n = db.execute("SELECT COUNT(*) FROM transactions WHERE company_id = ?", (cid,)).fetchone()[0]
    net = db.execute("SELECT SUM(amount_net) FROM transactions WHERE company_id = ?", (cid,)).fetchone()[0]
    assert n == 9958, f"Ummels txn count {n} != 9958 (dedup regression?)"
    assert 36.4e6 < net < 36.9e6, f"Ummels net revenue {net:,.0f} outside expected ~€36.7M"


def test_no_remaining_duplicate_hashes(db):
    dup = db.execute(
        "SELECT COUNT(*) FROM (SELECT source_row_hash FROM transactions "
        "GROUP BY source_row_hash HAVING COUNT(*) > 1)"
    ).fetchone()[0]
    assert dup == 0, f"{dup} duplicate row-hashes remain after dedup"


def test_all_companies_have_transactions(db):
    rows = db.execute(
        "SELECT c.code, COUNT(t.id) FROM companies c "
        "LEFT JOIN transactions t ON t.company_id = c.id GROUP BY c.id"
    ).fetchall()
    for code, n in rows:
        assert n > 0, f"company {code} has no transactions"


# --- weekly aggregation -----------------------------------------------------
def test_weekly_financials_reconcile_to_transactions(db):
    for (cid,) in db.execute("SELECT DISTINCT company_id FROM weekly_financials").fetchall():
        wk_credit = db.execute(
            "SELECT SUM(credit_total) FROM weekly_financials WHERE company_id = ?", (cid,)
        ).fetchone()[0] or 0
        tx_credit = db.execute(
            "SELECT SUM(credit) FROM transactions WHERE company_id = ?", (cid,)
        ).fetchone()[0] or 0
        assert abs(wk_credit - tx_credit) < 1.0, f"company {cid} weekly≠tx credit"


def test_amount_net_is_credit_minus_debit(db):
    bad = db.execute(
        "SELECT COUNT(*) FROM transactions WHERE ABS(amount_net - (credit - debit)) > 0.01"
    ).fetchone()[0]
    assert bad == 0


# --- weather ----------------------------------------------------------------
def test_weather_weekly_has_history_and_forecast(db):
    bid = db.execute("SELECT id FROM weather_locations WHERE code = 'brunssum'").fetchone()[0]
    hist = db.execute(
        "SELECT COUNT(*) FROM weather_weekly WHERE location_id = ? AND is_forecast = 0", (bid,)
    ).fetchone()[0]
    fc = db.execute(
        "SELECT COUNT(*) FROM weather_weekly WHERE location_id = ? AND is_forecast = 1", (bid,)
    ).fetchone()[0]
    assert hist > 150, f"only {hist} historical weather weeks"
    assert fc >= 1, "no live-forecast weather weeks"


def test_weather_features_in_range(db):
    rows = db.execute(
        "SELECT rain_days_2mm, rain_days_5mm, bad_workdays, delay_score FROM weather_weekly"
    ).fetchall()
    for r2, r5, bad, score in rows:
        assert 0 <= r2 <= 5 and 0 <= r5 <= 5 and 0 <= bad <= 5
        assert score >= 0


# --- stats artifact ---------------------------------------------------------
def test_stats_artifact_shape():
    f = ARTIFACTS / "stats.json"
    if not f.exists():
        pytest.skip("stats.json not generated — run `npm run stats`.")
    s = json.loads(f.read_text())
    assert "companies" in s and "ummels" in s["companies"]
    um = s["companies"]["ummels"]
    assert len(um["lag_table"]) == 9, "expected lag 0..8"
    assert um["wet_dry"], "wet/dry comparison missing"
