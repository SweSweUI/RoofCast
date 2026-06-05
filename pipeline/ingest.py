"""
Ingestion pipeline — parses the three source accounting systems into the
unified schema, normalizes debit/credit/dates, derives weekly aggregates, and
emits a data-quality inventory.

Run:  python3 pipeline/ingest.py
"""
from __future__ import annotations

import glob
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config as C  # noqa: E402
from db import apply_schema, connect  # noqa: E402

NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")

TX_COLS = [
    "company_id", "source_file_id", "account_id", "date", "week_start",
    "document_number", "journal", "account_code", "debit", "credit",
    "amount_net", "description", "source_row_hash",
]


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def week_start(ts: pd.Timestamp) -> str:
    """ISO Monday of the week containing ts."""
    d = ts.normalize()
    return (d - pd.Timedelta(days=int(d.weekday()))).date().isoformat()


def num(x) -> float:
    if x is None:
        return 0.0
    try:
        if isinstance(x, str):
            x = x.replace(" ", "").replace(" ", "").replace(",", ".")
        v = float(x)
        return 0.0 if pd.isna(v) else v
    except (TypeError, ValueError):
        return 0.0


def doc_str(x) -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return str(x).strip()


def row_hash(*parts) -> str:
    h = hashlib.sha1("|".join(str(p) for p in parts).encode("utf-8"))
    return h.hexdigest()[:16]


def biz_hash(occ: dict, company_id, date_iso, doc, code, debit, credit) -> str:
    """
    Content-based hash that is independent of which file a row came from, so the
    same business line re-exported across files (e.g. Ummels '.3' files re-export
    account 8005) collapses to one. An intra-file occurrence index preserves
    genuinely repeated identical lines *within* a single export.
    """
    bkey = (company_id, date_iso, doc, code, round(debit, 2), round(credit, 2))
    idx = occ.get(bkey, 0)
    occ[bkey] = idx + 1
    return row_hash(*bkey, idx)


def normalize_account(code: str, name: str, journal: str):
    """Return (normalized_code, normalized_category, confidence, method)."""
    code = (code or "").strip()
    if code in C.ACCOUNT_MAP:
        cat, _ = C.ACCOUNT_MAP[code]
        return f"{code}-{cat}", cat, "high", "exact_code"
    blob = f"{name} {journal}".lower()
    if "verleg" in blob:
        return f"{code}-revenue_reverse_charge", "revenue_reverse_charge", "medium", "journal_heuristic"
    if "hoog" in blob:
        return f"{code}-revenue_high", "revenue_high", "medium", "journal_heuristic"
    if "verkoop" in blob or "omzet" in blob or "factu" in blob or "verkoopboek" in blob:
        return f"{code}-revenue_other", "revenue_other", "medium", "journal_heuristic"
    return f"{code}-revenue_other", "revenue_other", "low", "fallback"


# --------------------------------------------------------------------------- #
# DB seed helpers
# --------------------------------------------------------------------------- #
def seed_reference(conn):
    cur = conn.cursor()
    loc_id = {}
    for L in C.WEATHER_LOCATIONS:
        cur.execute(
            "INSERT INTO weather_locations (code,name,latitude,longitude,notes) VALUES (?,?,?,?,?)",
            (L["code"], L["name"], L["latitude"], L["longitude"], L["notes"]),
        )
        loc_id[L["code"]] = cur.lastrowid

    comp_id = {}
    for co in C.COMPANIES:
        cur.execute(
            """INSERT INTO companies
               (code,name,short_name,location_name,latitude,longitude,
                weather_location_id,source_system,source_confidence,is_assumption,notes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (co["code"], co["name"], co["short_name"], co["location_name"],
             next((w["latitude"] for w in C.WEATHER_LOCATIONS if w["code"] == co["weather_code"]), None),
             next((w["longitude"] for w in C.WEATHER_LOCATIONS if w["code"] == co["weather_code"]), None),
             loc_id[co["weather_code"]], co["source_system"], co["source_confidence"],
             co["is_assumption"], co["notes"]),
        )
        comp_id[co["code"]] = cur.lastrowid

    for a in C.ASSUMPTIONS:
        cur.execute(
            """INSERT INTO assumptions
               (key,scope,company_id,category,value_num,value_text,unit,rationale,source)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (a["key"], a["scope"], None, a["category"], a.get("value_num"),
             a.get("value_text"), a.get("unit"), a["rationale"], a["source"]),
        )
    for cov in C.COVENANTS:
        cur.execute(
            """INSERT INTO covenants
               (company_id,name,metric,threshold,direction,unit,basis,is_assumption,notes)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (comp_id.get(cov["company_code"]) if cov["company_code"] else None,
             cov["name"], cov["metric"], cov["threshold"], cov["direction"],
             cov["unit"], cov["basis"], cov["is_assumption"], cov.get("basis")),
        )
    conn.commit()
    return loc_id, comp_id


def register_source_file(cur, filename, group, sheet, ftype, rows, company, system, notes=""):
    cur.execute(
        """INSERT INTO source_files
           (filename,source_group,sheet_name,extracted_at,file_type,row_count,
            detected_company,detected_system,notes)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (filename, group, sheet, NOW, ftype, rows, company, system, notes),
    )
    return cur.lastrowid


class AccountResolver:
    """Insert accounts on first sight; return account_id for a (company, code)."""
    def __init__(self, cur):
        self.cur = cur
        self.cache: dict[tuple, int] = {}

    def get(self, company_id, code, name, journal):
        key = (company_id, code)
        if key in self.cache:
            return self.cache[key]
        ncode, ncat, conf, method = normalize_account(code, name, journal)
        self.cur.execute(
            """INSERT INTO accounts
               (company_id,source_account_code,source_account_name,
                normalized_account_code,normalized_category,mapping_confidence,mapping_method)
               VALUES (?,?,?,?,?,?,?)""",
            (company_id, code, name, ncode, ncat, conf, method),
        )
        aid = self.cur.lastrowid
        self.cache[key] = aid
        return aid


# --------------------------------------------------------------------------- #
# source parsers — each returns (list_of_tx_dicts, file_meta)
# --------------------------------------------------------------------------- #
def parse_company1_gl(path, company_id, cur, acc: AccountResolver):
    """Clean Exact-style GL: header on row 0."""
    df = pd.read_excel(path, dtype={"Boeknummer": "object"})
    df = df.dropna(how="all")
    fname = Path(path).name
    sfid = register_source_file(cur, fname, "portfolio company data", "Blad1", "xlsx",
                                len(df), "Opco A (GL 8000-series)", "Exact-style GL")
    rows, occ = [], {}
    for _, r in df.iterrows():
        dt = pd.to_datetime(r.get("Datum"), errors="coerce")
        if pd.isna(dt):
            continue
        code = doc_str(r.get("Rekening"))
        name = C.ACCOUNT_MAP.get(code, (None, ""))[1]
        journal = str(r.get("Dagboek") or "")
        debit, credit = num(r.get("Debet")), num(r.get("Credit"))
        desc = str(r.get("Boekingstekst") or "")
        aid = acc.get(company_id, code, name or desc, journal)
        doc = doc_str(r.get("Boeknummer"))
        di = dt.date().isoformat()
        rows.append({
            "company_id": company_id, "source_file_id": sfid, "account_id": aid,
            "date": di, "week_start": week_start(dt),
            "document_number": doc, "journal": journal, "account_code": code,
            "debit": debit, "credit": credit, "amount_net": credit - debit,
            "description": desc,
            "source_row_hash": biz_hash(occ, company_id, di, doc, code, debit, credit),
        })
    return rows


def parse_ummels(path, company_id, cur, acc: AccountResolver):
    """Snelstart FinTransactions: metadata block on top, table header lower down."""
    raw = pd.read_excel(path, header=None)
    fname = Path(path).name

    # find table header row (contains Datum + Debet/Credit)
    hdr = None
    for i in range(min(20, len(raw))):
        cells = [str(x) for x in raw.iloc[i].tolist()]
        joined = " ".join(cells)
        if "Datum" in joined and ("Debet" in joined or "Credit" in joined):
            hdr = i
            break
    if hdr is None:
        register_source_file(cur, fname, "portfolio company 2 data", "Sheet1", "xlsx",
                             0, "Peter Ummels", "Snelstart / FinTransactions",
                             "header not found — skipped")
        return []

    # extract account code+name from metadata cells above header
    acc_code, acc_name = "", ""
    for i in range(hdr):
        for cell in raw.iloc[i].tolist():
            m = re.match(r"\s*(\d{3,5})\s*-\s*([A-Za-z].+)", str(cell))
            if m and 8000 <= int(m.group(1)) <= 8999:
                acc_code, acc_name = m.group(1), m.group(2).strip()
                break
        if acc_code:
            break

    df = pd.read_excel(path, header=hdr)
    df = df.dropna(how="all")
    sfid = register_source_file(cur, fname, "portfolio company 2 data", "Sheet1", "xlsx",
                                0, "Peter Ummels", "Snelstart / FinTransactions",
                                f"account {acc_code or '?'} {acc_name}".strip())
    rows, occ = [], {}
    for _, r in df.iterrows():
        nr = str(r.get("Nr.") or "").strip()
        if nr in ("Totaal", "Eindsaldo", "Beginsaldo"):  # footer rows
            continue
        dt = pd.to_datetime(r.get("Datum"), errors="coerce")
        if pd.isna(dt):
            continue
        journal = str(r.get("Dagboek") or "")
        debit, credit = num(r.get("Debet")), num(r.get("Credit"))
        aid = acc.get(company_id, acc_code, acc_name, journal)
        doc = doc_str(r.get("Bkst.nr."))
        di = dt.date().isoformat()
        rows.append({
            "company_id": company_id, "source_file_id": sfid, "account_id": aid,
            "date": di, "week_start": week_start(dt),
            "document_number": doc, "journal": journal, "account_code": acc_code,
            "debit": debit, "credit": credit, "amount_net": credit - debit,
            "description": acc_name,
            "source_row_hash": biz_hash(occ, company_id, di, doc, acc_code, debit, credit),
        })
    # patch row_count
    cur.execute("UPDATE source_files SET row_count=? WHERE id=?", (len(rows), sfid))
    return rows


def parse_dataset2_year(path, sheet, company_id, cur, acc: AccountResolver):
    """Altis dataset 2 yearly transaction sheets (Gilde co.)."""
    df = pd.read_excel(path, sheet_name=sheet)
    df = df.dropna(how="all")
    sfid = register_source_file(cur, "Altis dataset 2.xlsx", "datasets", sheet, "xlsx",
                                len(df), "Opco C (Gilde)", "Gilde")
    rows, occ = [], {}
    for _, r in df.iterrows():
        dt = pd.to_datetime(r.get("Datum"), errors="coerce")
        if pd.isna(dt):
            continue
        journal = str(r.get("Dagboek") or "")
        # account code derived from journal prefix (e.g. '60 - Verkoopboek Gilde')
        m = re.match(r"\s*(\w+)\s*-\s*(.+)", journal)
        code = (m.group(1) if m else "verkoop")
        name = (m.group(2).strip() if m else journal)
        debit, credit = num(r.get("Debet")), num(r.get("Credit"))
        aid = acc.get(company_id, code, name, journal)
        doc = doc_str(r.get("Bkst.nr."))
        di = dt.date().isoformat()
        rows.append({
            "company_id": company_id, "source_file_id": sfid, "account_id": aid,
            "date": di, "week_start": week_start(dt),
            "document_number": doc, "journal": journal, "account_code": code,
            "debit": debit, "credit": credit, "amount_net": credit - debit,
            "description": name,
            "source_row_hash": biz_hash(occ, company_id, di, doc, code, debit, credit),
        })
    cur.execute("UPDATE source_files SET row_count=? WHERE id=?", (len(rows), sfid))
    return rows


def parse_company_e(path, company_id, cur, acc: AccountResolver):
    """Altis dataset 2 'Company E 2026' invoice register."""
    raw = pd.read_excel(path, sheet_name="Company E 2026", header=None)
    sfid = register_source_file(cur, "Altis dataset 2.xlsx", "datasets", "Company E 2026",
                                "xlsx", 0, "Company E", "Invoice register")
    aid = acc.get(company_id, "factuur", "Invoice", "Facturen")
    rows, occ = [], {}
    for _, r in raw.iterrows():
        dt = pd.to_datetime(r.iloc[0], errors="coerce")
        if pd.isna(dt):
            continue
        amount = num(r.iloc[5])
        if amount == 0:
            continue
        doc = doc_str(r.iloc[2])
        di = dt.date().isoformat()
        rows.append({
            "company_id": company_id, "source_file_id": sfid, "account_id": aid,
            "date": di, "week_start": week_start(dt),
            "document_number": doc, "journal": "Facturen", "account_code": "factuur",
            "debit": 0.0, "credit": amount, "amount_net": amount,
            "description": "Invoice (Company E)",
            "source_row_hash": biz_hash(occ, company_id, di, doc, "factuur", 0.0, amount),
        })
    cur.execute("UPDATE source_files SET row_count=? WHERE id=?", (len(rows), sfid))
    return rows


def parse_dataset1_monthly(path, company_id, cur):
    """Altis dataset 1 — monthly revenue summary, for reconciliation."""
    MONTHS = {"Jan": 1, "Feb": 2, "Mrt": 3, "Apr": 4, "Mei": 5, "Jun": 6,
              "Jul": 7, "Aug": 8, "Sep": 9, "Okt": 10, "Nov": 11, "Dec": 12}
    xl = pd.ExcelFile(path)
    out = []
    for sheet in xl.sheet_names:
        year = int(re.match(r"(\d{4})", sheet).group(1))
        df = xl.parse(sheet)
        first = df.columns[0]
        for _, r in df.iterrows():
            label = str(r.get(first) or "").strip()
            if not label or label.lower() == "nan":
                continue
            for mname, mnum in MONTHS.items():
                if mname in df.columns:
                    amt = num(r.get(mname))
                    if amt:
                        out.append((company_id, f"{year}-{mnum:02d}-01", label, amt))
    register_source_file(cur, "Altis dataset 1.xlsx", "datasets", ",".join(xl.sheet_names),
                         "xlsx", len(out), "Opco A (monthly summary)", "summary")
    cur.executemany(
        "INSERT INTO monthly_revenue (company_id,month,account_label,amount) VALUES (?,?,?,?)",
        out,
    )
    return len(out)


# --------------------------------------------------------------------------- #
# aggregates + inventory
# --------------------------------------------------------------------------- #
def build_weekly(conn):
    conn.execute("DELETE FROM weekly_financials")
    conn.execute(
        """INSERT INTO weekly_financials
           (company_id, week_start, revenue_net, credit_total, debit_total, transaction_count)
           SELECT company_id, week_start,
                  ROUND(SUM(amount_net),2), ROUND(SUM(credit),2),
                  ROUND(SUM(debit),2), COUNT(*)
           FROM transactions
           GROUP BY company_id, week_start"""
    )
    # 8-week trailing-median baseline per company (stored for audit; engine also computes live)
    rows = conn.execute(
        "SELECT company_id, week_start, revenue_net, credit_total FROM weekly_financials "
        "ORDER BY company_id, week_start"
    ).fetchall()
    from statistics import median
    byco: dict[int, list] = {}
    for cid, ws, rev, cred in rows:
        byco.setdefault(cid, []).append((ws, rev, cred))
    for cid, series in byco.items():
        for i, (ws, rev, cred) in enumerate(series):
            window = series[max(0, i - 8):i] or series[i:i + 1]
            bl_rev = median([x[1] for x in window])
            bl_cred = median([x[2] for x in window])
            conn.execute(
                "UPDATE weekly_financials SET baseline_revenue=?, baseline_credit=? "
                "WHERE company_id=? AND week_start=?",
                (round(bl_rev, 2), round(bl_cred, 2), cid, ws),
            )
    conn.commit()


def build_inventory(conn) -> dict:
    cur = conn.cursor()
    files = cur.execute(
        "SELECT filename, source_group, detected_company, detected_system, row_count "
        "FROM source_files ORDER BY source_group, filename"
    ).fetchall()
    total_tx = cur.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    dup = cur.execute(
        "SELECT COUNT(*) FROM (SELECT source_row_hash FROM transactions "
        "GROUP BY source_row_hash HAVING COUNT(*)>1)"
    ).fetchone()[0]
    companies = cur.execute(
        """SELECT c.name, c.source_system, c.source_confidence,
                  COUNT(t.id), MIN(t.date), MAX(t.date),
                  ROUND(SUM(t.amount_net),0)
           FROM companies c LEFT JOIN transactions t ON t.company_id=c.id
           GROUP BY c.id ORDER BY c.id"""
    ).fetchall()
    accounts = cur.execute(
        "SELECT company_id, source_account_code, normalized_category, mapping_confidence "
        "FROM accounts ORDER BY company_id"
    ).fetchall()

    # reconciliation: a company's weekly credit vs ITS OWN monthly summary.
    # Only Opco A has a monthly summary (Altis dataset 1); other companies have
    # none, so they correctly show "no summary" rather than being compared to a
    # different company's totals.
    recon = []
    wk = cur.execute(
        "SELECT company_id, substr(week_start,1,4) y, SUM(credit_total) "
        "FROM weekly_financials GROUP BY company_id, y"
    ).fetchall()
    mo = {
        (cid, y): amt
        for cid, y, amt in cur.execute(
            "SELECT company_id, substr(month,1,4) y, ROUND(SUM(amount),0) "
            "FROM monthly_revenue WHERE account_label LIKE 'Netto%' GROUP BY company_id, y"
        ).fetchall()
    }
    for cid, y, cred in wk:
        recon.append({"company_id": cid, "year": y, "weekly_credit_total": round(cred or 0, 0),
                      "monthly_summary_netto": mo.get((cid, y))})  # None unless company has a summary

    inv = {
        "generated_at": NOW,
        "files_loaded": len(files),
        "rows_loaded": total_tx,
        "duplicate_row_hashes_retained": dup,
        "files": [
            {"filename": f[0], "group": f[1], "company": f[2], "system": f[3], "rows": f[4]}
            for f in files
        ],
        "companies": [
            {"name": c[0], "system": c[1], "confidence": c[2], "transactions": c[3],
             "date_min": c[4], "date_max": c[5], "net_revenue_total": c[6]}
            for c in companies
        ],
        "accounts_detected": len(accounts),
        "assumptions_created": cur.execute("SELECT COUNT(*) FROM assumptions").fetchone()[0],
        "covenants_configured": cur.execute("SELECT COUNT(*) FROM covenants").fetchone()[0],
        "missing_fields": [
            "Cash-out GL (materials/subcontractor/payroll) — not in revenue-only exports; modelled as configurable driver assumptions.",
            "Bank/cash balances — not present; opening cash is an assumption.",
            "Covenant terms — not supplied; configurable assumptions used.",
            "Project / WIP detail — not present at line level; project view derives from transaction + weather patterns.",
            "Company location for non-Ummels opcos — inferred (South Limburg / Maastricht proxy).",
        ],
        "reconciliation": recon,
    }
    return inv


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main():
    C.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    conn = connect()
    apply_schema(conn)
    cur = conn.cursor()
    cur.execute("INSERT INTO pipeline_runs (started_at,status) VALUES (?,?)", (NOW, "running"))
    run_id = cur.lastrowid

    loc_id, comp_id = seed_reference(conn)
    acc = AccountResolver(cur)
    all_tx = []

    # Company A — GL 8000-series
    for p in sorted(glob.glob(str(C.RAW_DIR / "portfolio company data" / "*.xlsx"))):
        all_tx += parse_company1_gl(p, comp_id["opco-a"], cur, acc)

    # Peter Ummels — FinTransactions
    for p in sorted(glob.glob(str(C.RAW_DIR / "portfolio company 2 data" / "*.xlsx"))):
        all_tx += parse_ummels(p, comp_id["ummels"], cur, acc)

    # Altis dataset 2 — Gilde co. yearly sheets + Company E
    ds2 = C.RAW_DIR / "datasets" / "Altis dataset 2.xlsx"
    if ds2.exists():
        xl = pd.ExcelFile(ds2)
        for sheet in xl.sheet_names:
            if re.fullmatch(r"\d{4}", str(sheet).strip()):
                all_tx += parse_dataset2_year(str(ds2), sheet, comp_id["opco-gilde"], cur, acc)
        if "Company E 2026" in xl.sheet_names:
            all_tx += parse_company_e(str(ds2), comp_id["opco-e"], cur, acc)

    # Altis dataset 1 — monthly summary (reconciliation only)
    ds1 = C.RAW_DIR / "datasets" / "Altis dataset 1.xlsx"
    if ds1.exists():
        parse_dataset1_monthly(str(ds1), comp_id["opco-a"], cur)

    # content-based dedup across files (collapses re-exported lines, e.g. Ummels
    # '.3' files that re-export account 8005). Keeps first occurrence.
    seen, deduped, removed = set(), [], 0
    for r in all_tx:
        h = r["source_row_hash"]
        if h in seen:
            removed += 1
            continue
        seen.add(h)
        deduped.append(r)
    all_tx = deduped

    # bulk insert transactions
    cur.executemany(
        f"INSERT INTO transactions ({','.join(TX_COLS)}) VALUES ({','.join('?' for _ in TX_COLS)})",
        [[r[c] for c in TX_COLS] for r in all_tx],
    )
    conn.commit()

    build_weekly(conn)
    inv = build_inventory(conn)
    inv["duplicate_rows_removed"] = removed

    (C.ARTIFACTS_DIR / "data_inventory.json").write_text(json.dumps(inv, indent=2))
    cur.execute("UPDATE pipeline_runs SET finished_at=?, status=?, summary=? WHERE id=?",
                (datetime.now(timezone.utc).isoformat(timespec="seconds"), "ok",
                 json.dumps({"rows": inv["rows_loaded"], "files": inv["files_loaded"]}), run_id))
    conn.commit()

    print(f"Ingested {inv['rows_loaded']} transactions from {inv['files_loaded']} files.")
    for c in inv["companies"]:
        print(f"  - {c['name']:38s} tx={c['transactions']:>6} "
              f"{c['date_min']}..{c['date_max']}  net=EUR {c['net_revenue_total']:,}")
    print(f"Duplicate rows removed (cross-file re-exports): {removed}")
    print(f"Duplicate row-hashes remaining: {inv['duplicate_row_hashes_retained']}")
    conn.close()


if __name__ == "__main__":
    main()
