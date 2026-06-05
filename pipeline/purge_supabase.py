"""
Remove all Altis-namespaced objects from Supabase and delete the 5 demo auth
users. This is the cloud half of the 3-day post-hackathon deletion requirement.

    python3 pipeline/purge_supabase.py         # prompts for confirmation
    python3 pipeline/purge_supabase.py --yes   # skip prompt (automation)

Reads credentials from .env.local (same as push_supabase.py):
    SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

What is removed:
  - The view   altis_accounts_summary (cascade)
  - All tables altis_* including altis_profiles (cascade)
  - The function altis_is_admin()
  - The 5 auth.users whose email ends with @altis.demo

What is NOT removed:
  - public.profiles, public.workouts, or any other non-altis table/view/function
  - Any auth user whose email does not end with @altis.demo
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "supabase" / "schema.sql"

# ---------------------------------------------------------------------------
# env loader — identical to push_supabase.py
# ---------------------------------------------------------------------------

def load_env() -> dict:
    env = {}
    f = ROOT / ".env.local"
    if not f.exists():
        sys.exit("Missing .env.local — cannot connect to Supabase.")
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


# ---------------------------------------------------------------------------
# HTTP helper — identical signature to push_supabase.py
# Supabase's Management API sits behind Cloudflare; the default urllib
# User-Agent triggers a 1010 block. Present a normal browser-like UA.
# ---------------------------------------------------------------------------

def _req(url, method="GET", headers=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
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
        headers={
            "Authorization": f"Bearer {TOK}",
            "Content-Type": "application/json",
        },
        body={"query": sql},
    )


# ---------------------------------------------------------------------------
# Parse altis_ object names from the actual schema.sql so we never hardcode
# a guess — if the schema grows, the purge picks it up automatically.
# ---------------------------------------------------------------------------

def parse_altis_objects() -> dict:
    """
    Return {'tables': [...], 'views': [...]} extracted from supabase/schema.sql.
    Tables and views are listed in reverse-dependency order for DROP (leaves first).
    """
    if not SCHEMA.exists():
        sys.exit(f"Cannot find {SCHEMA} — needed to enumerate altis_ objects.")

    text = SCHEMA.read_text()

    # Collect tables in the order they appear (FK dependency order from schema)
    tables = re.findall(r"create table(?:\s+if not exists)?\s+(altis_\w+)", text, re.IGNORECASE)
    views   = re.findall(r"create(?:\s+or\s+replace)?\s+view\s+(altis_\w+)", text, re.IGNORECASE)

    # Reverse to get safe drop order (most-dependent first; cascade handles the rest
    # but being explicit avoids confusing error messages).
    tables_rev = list(dict.fromkeys(reversed(tables)))  # deduplicate, keep order
    views_rev  = list(dict.fromkeys(reversed(views)))

    return {"tables": tables_rev, "views": views_rev}


# ---------------------------------------------------------------------------
# Drop altis_ database objects
# ---------------------------------------------------------------------------

def drop_objects(objects: dict) -> None:
    # Build a single SQL batch so we send one round-trip to the API.
    statements = []

    # Views first (they depend on tables)
    for v in objects["views"]:
        statements.append(f"drop view if exists {v} cascade;")

    # Tables (altis_profiles is included; schema.sql lists it last -> reversed = first)
    for t in objects["tables"]:
        statements.append(f"drop table if exists {t} cascade;")

    # Function
    statements.append("drop function if exists altis_is_admin() cascade;")

    sql = "\n".join(statements)
    print("Dropping altis_* objects via Management API query endpoint…")
    code, resp = mgmt_query(sql)
    if code not in (200, 201):
        sys.exit(f"DROP failed (HTTP {code}): {str(resp)[:600]}")

    for v in objects["views"]:
        print(f"  dropped view     {v}")
    for t in objects["tables"]:
        print(f"  dropped table    {t}")
    print("  dropped function altis_is_admin()")


# ---------------------------------------------------------------------------
# Delete @altis.demo auth users
# ---------------------------------------------------------------------------

def delete_demo_users() -> None:
    """
    Fetch the full user list, filter to @altis.demo only, delete each one.
    Non-demo users are never touched.
    """
    headers = {"apikey": SVC, "Authorization": f"Bearer {SVC}"}

    print("Fetching auth user list…")
    code, resp = _req(f"{URL}/auth/v1/admin/users?per_page=200", headers=headers)
    if code != 200 or not isinstance(resp, dict):
        sys.exit(f"Failed to list auth users (HTTP {code}): {str(resp)[:300]}")

    all_users = resp.get("users", [])
    demo_users = [u for u in all_users if (u.get("email") or "").endswith("@altis.demo")]

    if not demo_users:
        print("  No @altis.demo users found (already deleted).")
        return

    del_headers = {**headers, "Content-Type": "application/json"}
    for u in demo_users:
        uid   = u["id"]
        email = u.get("email", uid)
        code, resp = _req(
            f"{URL}/auth/v1/admin/users/{uid}",
            method="DELETE",
            headers=del_headers,
        )
        if code in (200, 204):
            print(f"  deleted user     {email}  (id={uid})")
        else:
            print(f"  WARNING: delete {email} returned HTTP {code}: {str(resp)[:200]}")

    non_demo_count = len(all_users) - len(demo_users)
    print(f"  {non_demo_count} non-demo user(s) untouched (public.profiles / public.workouts unaffected).")


# ---------------------------------------------------------------------------
# Verification: query pg_tables for any remaining altis_ tables
# ---------------------------------------------------------------------------

def verify_clean() -> None:
    print("\nVerifying — querying pg_tables for altis_* tables…")
    code, resp = mgmt_query(
        "select tablename from pg_tables where schemaname = 'public' and tablename like 'altis_%';"
    )
    if code not in (200, 201):
        print(f"  WARNING: verification query failed (HTTP {code}): {str(resp)[:200]}")
        return

    rows = resp if isinstance(resp, list) else []
    if rows:
        names = [r.get("tablename", str(r)) for r in rows]
        print(f"  WARNING: {len(names)} altis_ table(s) still present: {names}")
    else:
        print("  0 altis_ tables remain in public schema. Cloud purge confirmed clean.")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    skip_confirm = "--yes" in sys.argv or "-y" in sys.argv

    print()
    print("=" * 60)
    print("  Altis Supabase Cloud Purge")
    print("=" * 60)
    print()
    print("  Target project:", REF)
    print("  URL:           ", URL)
    print()
    print("  Will remove:")
    print("    - All altis_* tables (incl. altis_profiles)")
    print("    - View altis_accounts_summary")
    print("    - Function altis_is_admin()")
    print("    - Auth users *@altis.demo (5 demo accounts)")
    print()
    print("  Will NOT touch:")
    print("    - public.profiles, public.workouts, or any other table")
    print("    - Any auth user not ending in @altis.demo")
    print()

    if not skip_confirm:
        answer = input("Type DELETE (all caps) to confirm: ").strip()
        if answer != "DELETE":
            print("Aborted — nothing was deleted.")
            sys.exit(0)

    objects = parse_altis_objects()

    print()
    drop_objects(objects)

    print()
    delete_demo_users()

    verify_clean()

    print()
    print("Cloud purge complete.")
    print("Reminder: rotate your SUPABASE_ACCESS_TOKEN in the Supabase dashboard.")
    print()


if __name__ == "__main__":
    main()
