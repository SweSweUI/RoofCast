"""
Push the local SQLite data foundation up to Supabase (Postgres) and create the
demo role accounts. Namespaced (`altis_*`) and non-destructive to anything else
in the project.

    python3 pipeline/push_supabase.py

Reads credentials from .env.local (SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF,
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
"""
from __future__ import annotations

import json
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "altis.db"
SCHEMA = ROOT / "supabase" / "schema.sql"
INVENTORY = ROOT / "data" / "artifacts" / "data_inventory.json"

DEMO_PASSWORD = "AltisDemo!2026"
DEMO_USERS = [
    ("cfo@altis.demo", "cfo", "Casey CFO"),
    ("board@altis.demo", "board", "Bo Board"),
    ("opco@altis.demo", "opco", "Olen Opco-MD"),
    ("project@altis.demo", "project", "Pat Project-Lead"),
    ("admin@altis.demo", "admin", "Ada Admin"),
]

# (sqlite table, altis_ table) in FK-dependency order
TABLES = [
    ("weather_locations", "altis_weather_locations"),
    ("companies", "altis_companies"),
    ("source_files", "altis_source_files"),
    ("accounts", "altis_accounts"),
    ("transactions", "altis_transactions"),
    ("weekly_financials", "altis_weekly_financials"),
    ("monthly_revenue", "altis_monthly_revenue"),
    ("weather_daily", "altis_weather_daily"),
    ("weather_weekly", "altis_weather_weekly"),
    ("covenants", "altis_covenants"),
    ("assumptions", "altis_assumptions"),
    ("forecast_weeks", "altis_forecast_weeks"),
    ("trace_links", "altis_trace_links"),
]


def load_env() -> dict:
    env = {}
    f = ROOT / ".env.local"
    if not f.exists():
        sys.exit("Missing .env.local — run the Supabase bootstrap first.")
    for line in f.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


ENV = load_env()
REF = ENV["SUPABASE_PROJECT_REF"]
URL = ENV["NEXT_PUBLIC_SUPABASE_URL"]
SVC = ENV["SUPABASE_SERVICE_ROLE_KEY"]
TOK = ENV["SUPABASE_ACCESS_TOKEN"]


def _req(url, method="GET", headers=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    # Supabase's Management API sits behind Cloudflare, which 1010-bans the
    # default urllib User-Agent. Present a normal UA.
    hdrs = {"User-Agent": "altis-pipeline/1.0 (+https://supabase.com)"}
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def mgmt_query(sql: str):
    return _req(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        method="POST",
        headers={"Authorization": f"Bearer {TOK}", "Content-Type": "application/json"},
        body={"query": sql},
    )


def rest_insert(table: str, rows: list[dict], chunk=1000, upsert=False):
    if not rows:
        return 0
    headers = {
        "apikey": SVC,
        "Authorization": f"Bearer {SVC}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal" + (",resolution=merge-duplicates" if upsert else ""),
    }
    n = 0
    for i in range(0, len(rows), chunk):
        batch = rows[i:i + chunk]
        code, resp = _req(f"{URL}/rest/v1/{table}", method="POST", headers=headers, body=batch)
        if code not in (200, 201, 204):
            sys.exit(f"insert {table} failed ({code}): {str(resp)[:400]}")
        n += len(batch)
    return n


def admin_find_user(email: str):
    headers = {"apikey": SVC, "Authorization": f"Bearer {SVC}"}
    code, resp = _req(f"{URL}/auth/v1/admin/users?per_page=200", headers=headers)
    if code == 200 and isinstance(resp, dict):
        for u in resp.get("users", []):
            if u.get("email") == email:
                return u.get("id")
    return None


def admin_create_user(email: str, password: str, role: str, full_name: str):
    headers = {"apikey": SVC, "Authorization": f"Bearer {SVC}", "Content-Type": "application/json"}
    code, resp = _req(
        f"{URL}/auth/v1/admin/users", method="POST", headers=headers,
        body={"email": email, "password": password, "email_confirm": True,
              "user_metadata": {"role": role, "full_name": full_name}},
    )
    if code in (200, 201) and isinstance(resp, dict):
        return resp.get("id")
    # already exists -> look it up
    uid = admin_find_user(email)
    if uid:
        return uid
    sys.exit(f"create user {email} failed ({code}): {str(resp)[:300]}")


def main():
    if not DB.exists():
        sys.exit("data/altis.db missing — run `npm run pipeline` first.")

    print("1) Applying Supabase schema (altis_* tables, RLS, profiles)…")
    code, resp = mgmt_query(SCHEMA.read_text())
    if code not in (200, 201):
        sys.exit(f"schema apply failed ({code}): {str(resp)[:600]}")
    print("   schema applied ✓")

    print("2) Loading data (SQLite → Supabase, ids/FKs preserved)…")
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    for src, dst in TABLES:
        rows = [dict(r) for r in conn.execute(f"SELECT * FROM {src}")]
        n = rest_insert(dst, rows)
        print(f"   {dst:28s} {n:>6} rows")
    conn.close()

    # push the data-quality inventory into pipeline_runs.summary (jsonb)
    if INVENTORY.exists():
        inv = json.loads(INVENTORY.read_text())
        rest_insert("altis_pipeline_runs", [{
            "id": 1, "started_at": inv.get("generated_at"),
            "finished_at": inv.get("generated_at"), "status": "ok", "summary": inv,
        }], upsert=True)
        print("   altis_pipeline_runs           1 rows (inventory summary)")

    print("3) Creating demo role accounts + profiles…")
    profiles = []
    for email, role, name in DEMO_USERS:
        uid = admin_create_user(email, DEMO_PASSWORD, role, name)
        profiles.append({"user_id": uid, "email": email, "role": role, "full_name": name})
        print(f"   {email:20s} role={role}")
    rest_insert("altis_profiles", profiles, upsert=True)

    print(f"\n✅ Supabase loaded. Demo login password for all accounts: {DEMO_PASSWORD}")
    print("   Sign in at the web app or iOS app with e.g. cfo@altis.demo / admin@altis.demo")


if __name__ == "__main__":
    main()
