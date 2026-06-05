# Demo Script — Altis Weather-Aware Billing-to-Cash Forecast

**Total runtime: 3–4 minutes**

All accounts share password: **`AltisDemo!2026`**

---

## Beat 1 — Login (0:00–0:20)

**Action:** Navigate to the app URL (or `http://localhost:3000` in local mode). In Supabase mode you land on `/login`. Click the quick-login button for **CFO** or enter `cfo@altis.demo` / `AltisDemo!2026`.

**Say:** "This is a weather-aware billing-to-cash forecast for a PE-backed roofing portfolio. Four companies, four accounting systems, one reconciled model. The CFO lands here by default."

---

## Beat 2 — CFO Risk Overview (0:20–1:00)

**Action:** You are on `/cfo`. The KPI strip at the top shows: net cash over 13 weeks, minimum closing cash, covenant headroom, and weeks at risk.

**Say:** "The 8 risk signal cards are the heart of the CFO view. Each signal has a level — low, medium, or high — plus a EUR impact and an honest confidence rating. Cash-Out Assumption Risk is always high: we have no cost ledger, only billing data, so every cost figure is a configured assumption. That's transparent, not a flaw."

**Action:** Point to the cashflow chart and the scenario selector (base / wet / dry).

---

## Beat 3 — Scenario Toggle Wet (1:00–1:20)

**Action:** Switch the scenario selector from **Base** to **Wet Quarter**.

**Say:** "The wet-quarter scenario scales expected rain workdays up by 50%. More weeks flip to high-risk, more billing is shifted out. Watch the minimum closing cash and weeks-at-risk numbers change. A wet quarter pushes roughly €281k of billing beyond the 13-week horizon — not lost, but not in this window."

---

## Beat 4 — Trace a Week (1:20–1:40)

**Action:** Click on any week row in the weekly table (choose a week with medium or high risk).

**Say:** "Every number is traceable. The trace drawer shows the driver decomposition: baseline cash-in from the billing run-rate, the weather timing shift in euros, the payment-lag convolution, and each cash-out driver. Every euro can be followed back to a source transaction, a formula in the engine, or a named assumption."

**Action:** Close the drawer.

---

## Beat 5 — Board Covenant Story (1:40–2:00)

**Action:** In the navigation bar, switch role to **Board** (or log out and log in as `board@altis.demo`). You land on `/board`.

**Say:** "The Board view aggregates the full portfolio. The companies-at-risk table is sorted worst-first: covenant breach risk, then weeks at risk, then minimum closing cash. In the wet scenario, Opco C appears at the top — tight headroom against its covenant floor."

**Action:** Point to the scenario summary table and the plain-English board takeaway.

---

## Beat 6 — Opco C Tight Headroom (2:00–2:15)

**Action:** Switch to the **Opco** role (`opco@altis.demo`) or use the company selector to navigate to Opco C / Gilde.

**Say:** "Opco C was deliberately configured with a tight opening cash position — €200k — against a €200k covenant floor. In a wet quarter the headroom compresses to near zero. The operational view shows the weather-risk calendar and a list of actionable recommendations: accelerate invoicing, review discretionary spend, talk to the bank."

---

## Beat 7 — Project Weather Calendar (2:15–2:30)

**Action:** Switch to the **Project** role (`project@altis.demo`). You land on `/project`.

**Say:** "The project lead needs to know when to expect weather delays and how they shift billing timing. The calendar shows each week colour-coded by delay risk. Below it: the upcoming bad-weather windows, the billing-timing shift table, and indicative next-four-weeks milestone billing — all derived from historical transaction patterns and the live weather forecast."

---

## Beat 8 — Methodology Caveats (2:30–2:45)

**Action:** Navigate to `/methodology`.

**Say:** "Every assumption is documented here and in the database. The weather signal is explicitly framed as suggestive, not causal — p ≈ 0.07–0.19, strongest Pearson |r| ≈ 0.17. Opening cash, covenant floors, and cost driver percentages are all labelled as assumptions. Nothing is hidden."

---

## Beat 9 — Data Quality (2:45–2:55)

**Action:** Navigate to `/data-quality`.

**Say:** "The data quality panel shows the full data lineage: 26 source files, 4 accounting systems, 4,616 duplicate rows removed by content-hash dedup, and the reconciliation check against the monthly summary. Missing fields — bank balances, WIP, covenant terms — are listed explicitly."

---

## Beat 10 — Admin / Governance (2:55–3:05)

**Action:** Log in as `admin@altis.demo`. Show the Admin panel.

**Say:** "The admin can manage users, view pipeline run history, and trigger the data purge. All copies of the source data must be deleted within 3 days after the event — there is a one-button purge here, and a `scripts/purge.sh` script that removes everything local and cloud."

---

## Beat 11 — iOS (3:05–3:30)

**Action:** Show the iOS app on the simulator (or screenshots `mobile-cfo.png` and `mobile-board.png` in the screenshots folder).

**Say:** "The same Supabase backend powers a native iOS app built in SwiftUI. Same demo accounts, same tables, same RLS. The CFO or board member can check covenant headroom from their phone before a lender call."

---

## Wrap (3:30–3:45)

**Say:** "To summarise: four companies, four accounting systems, one reconciled 13-week billing-to-cash forecast, with a weather risk overlay and full traceability to every source transaction. `npm run build` passes; 15 tests green. Ready to deploy to Vercel with one command."

---

## Quick-Reference: Demo Account Routing

| Account | Route | Key talking point |
|---|---|---|
| `cfo@altis.demo` | `/cfo` | 8 risk signals, scenario toggle, trace drawer |
| `board@altis.demo` | `/board` | Portfolio covenant story, companies-at-risk table |
| `opco@altis.demo` | `/opco` | Weather calendar, tight headroom on Opco C |
| `project@altis.demo` | `/project` | Billing-timing shift, bad-weather windows |
| `admin@altis.demo` | Admin panel | Data purge, user management |
