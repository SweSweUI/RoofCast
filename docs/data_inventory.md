# Data Inventory

Generated from `data/artifacts/data_inventory.json` (last run: 2026-06-05T20:14:05Z). Rerun `npm run pipeline` to refresh.

---

## Portfolio Summary

| Metric | Value |
|---|---|
| Total transactions (after dedup) | 32,278 |
| Source files loaded | 26 |
| Duplicate rows removed (cross-file re-exports) | 4,616 |
| Duplicate row-hashes remaining after dedup | 0 |
| Accounts detected | 11 |
| Modelling assumptions created | 8 |
| Covenants configured | 4 |

---

## Operating Companies

### 1. Dakdekkersbedrijf Peter Ummels

| Field | Value |
|---|---|
| Code | `ummels` |
| Source system | Snelstart / FinTransactions export |
| Source confidence | High |
| Location | Brunssum, NL (Boschstraat 28C, 6442 PB) — confirmed in file metadata |
| Weather proxy | Brunssum (lat 50.9472, lon 5.9714) |
| Transactions (after dedup) | 9,958 |
| Date range | 2023-01-15 to 2026-06-02 |
| Net revenue total | ~€36.7M (€36,668,632) |

This company is the **reconciliation anchor**: the company name appears directly in the source filenames (`Dakdekkersbedrijf_Peter_Ummels`) and the admin number (82604) is consistent across all files. It has the highest source confidence, the longest date range, and the most complete weather-location data.

**Files (17 loaded):**

| Filename | Rows |
|---|---|
| 82604-2023-...-FinTransactions.xlsx | 3,196 |
| 82604-2023.2-...-FinTransactions.xlsx | 2 |
| 82604-2023.3-...-Fintransactions.xlsx | 1,100 |
| 82604-2024-...-FinTransactions (1).xlsx | 3,340 |
| 82604-2024.2-...-Fintransactions.xlsx | 1,638 |
| 82604-2025-...-FinTransactions.xlsx | 2,466 |
| 82604-2025.2-...-Fintransactions.xlsx | 26 |
| 82604-2025.3-...-Fintransactions.xlsx | 1,080 |
| 82604-2026-...-FinTransactions.xlsx | 822 |
| 82604-2026.2-...-FinTransactions.xlsx | 106 |
| 82604-2026.3-...-Fintransactions.xlsx | 798 |

Row counts above reflect pre-dedup ingested rows (some rows are subsequently removed by content-hash dedup).

---

### 2. Opco A (GL 8000-series)

| Field | Value |
|---|---|
| Code | `opco-a` |
| Source system | Exact-style general-ledger export |
| Source confidence | Medium |
| Location | South Limburg, NL (assumed) |
| Weather proxy | Maastricht (lat 50.8514, lon 5.6910) |
| Transactions | 9,673 |
| Date range | 2023-01-05 to 2026-05-29 |
| Net revenue total | ~€44.4M (€44,403,031) |

Anonymised GL exports from an Exact-style system. Company identity is not present in the files; location is assumed to be South Limburg based on portfolio context.

**Files (8 loaded):**

| Filename | Rows |
|---|---|
| GB 8000 jan-dec 23.xlsx | 1,096 |
| GB 8000 jan-dec 24.xlsx | 1,036 |
| GB 8000 jan-dec 25.xlsx | 939 |
| GB 8000 jan-mei 26.xlsx | 356 |
| GB 8001 jan-dec 23.xlsx | 1,847 |
| GB 8001 jan-dec 24.xlsx | 2,024 |
| GB 8001 jan-dec 25.xlsx | 1,650 |
| GB 8001 jan-mei 26.xlsx | 724 |
| GB 8002 jan-dec 23.xlsx | 1 |

---

### 3. Opco C (Gilde)

| Field | Value |
|---|---|
| Code | `opco-gilde` |
| Source system | Gilde (Verkoopboek Gilde) |
| Source confidence | Medium |
| Location | NL (assumed South Limburg) |
| Weather proxy | Maastricht |
| Transactions | 12,318 |
| Date range | 2023-01-09 to 2026-04-30 |
| Net revenue total | ~€25.5M (€25,466,017) |

Transaction data from `Altis dataset 2.xlsx`, yearly sheets. Journal entries include `Verkoopboek Gilde` as the journal identifier. Company identity not in files; location assumed.

**Sheets (4 loaded):**

| Sheet | Rows |
|---|---|
| 2023 | 3,609 |
| 2024 | 3,812 |
| 2025 | 3,929 |
| 2026 (partial) | 968 |

---

### 4. Company E

| Field | Value |
|---|---|
| Code | `opco-e` |
| Source system | Invoice register |
| Source confidence | Low |
| Location | NL (assumed South Limburg) |
| Weather proxy | Maastricht |
| Transactions | 329 |
| Date range | 2026-01-20 to 2026-05-29 |
| Net revenue total | ~€1.2M (€1,171,252) |

From the `Company E 2026` sheet in `Altis dataset 2.xlsx`. Partial data (2026 only); invoice register format rather than full GL.

---

## Dedup Story

The Ummels FinTransactions exports contain `.3` files that are **exact re-exports** of account 8005 from the same period — they appear under a different filename but contain identical business content. The `.2` files are **different accounts** (kept).

The pipeline uses a **content-based hash** (SHA-1 of company_id + date + document_number + account_code + rounded debit/credit + intra-file occurrence index) rather than any filename-based skip. This means:

- `.3` files are loaded and parsed normally.
- Rows with the same business identity as a row already seen (from any file) are discarded.
- **4,616 duplicate rows were removed** in the latest run.
- After dedup, zero duplicate hashes remain.

Filename-based skipping would incorrectly retain or discard rows; only content hashing is correct here.

---

## Account Mapping

| Source Code | Normalised Category | Description | Confidence | Method |
|---|---|---|---|---|
| 8000 | revenue_high | Omzet hoog (high VAT revenue) | High | exact_code |
| 8001 | revenue_reverse_charge | Omzet verlegd (reverse-charge) | High | exact_code |
| 8002 | revenue_other | Omzet overig | High | exact_code |
| 8005 | revenue_reverse_charge | Omzet waarbij de heffing naar u is verlegd | High | exact_code |
| verkoop / factuur | revenue_other | Gilde/Company E journal heuristic | Medium–Low | journal_heuristic / fallback |

Revenue is the **credit side** of sales journals; `amount_net = credit − debit`. Source data is revenue-only.

---

## Reconciliation

The `Altis dataset 1.xlsx` monthly summary is used for cross-check only. It is not merged into the transaction table; it feeds `monthly_revenue` for the data-quality panel.

The table below shows the `weekly_credit_total` (sum of all credit transactions for the year, from the transaction-level data) vs the `monthly_summary_netto` (sum of Netto rows from the monthly summary). The monthly summary appears to cover the whole portfolio rather than individual companies, so direct per-company reconciliation is not possible; it is shown as a plausibility check only.

| Company | Year | Weekly credit total | Monthly summary netto |
|---|---|---|---|
| Opco A | 2023 | €13,162,807 | €13,419,543 |
| Opco A | 2024 | €12,456,186 | €15,805,322 |
| Opco A | 2025 | €12,790,075 | €15,117,845 |
| Opco A | 2026 | €6,844,735 | €6,583,148 |
| Peter Ummels | 2023 | €8,385,250 | €13,419,543 |
| Peter Ummels | 2024 | €11,959,617 | €15,805,322 |
| Peter Ummels | 2025 | €13,611,165 | €15,117,845 |
| Peter Ummels | 2026 | €4,068,288 | €6,583,148 |
| Opco C | 2023 | €7,988,313 | €13,419,543 |
| Opco C | 2024 | €8,258,475 | €15,805,322 |
| Opco C | 2025 | €9,025,209 | €15,117,845 |
| Opco C | 2026 | €2,179,044 | €6,583,148 |
| Company E | 2026 | €1,171,252 | €6,583,148 |

The monthly summary `netto` figures appear to be portfolio-level aggregates repeated across company rows, not per-company splits. Treat the reconciliation as a plausibility check rather than a line-by-line match.

---

## Missing Fields

The following data is not present in the source exports and is modelled as configurable assumptions:

- **Cash-out GL** (materials, subcontractor, payroll): not in revenue-only exports; modelled as driver percentages of revenue.
- **Bank/cash balances**: not present; opening cash per company is a configured assumption.
- **Covenant terms**: not supplied; covenant floor amounts and metrics are assumptions, labelled as such in the UI.
- **Project/WIP detail**: not present at line level; the project view derives billing signals from transaction patterns and weather.
- **Company location for non-Ummels opcos**: inferred as South Limburg / Maastricht proxy.
