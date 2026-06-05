# Screenshot Index

Screenshots live in `submission/screenshots/`. They are captured separately (another process produces the actual PNG files).

The table below lists each expected screenshot, the demo account used to capture it, and a caption describing what it shows.

---

| Filename | Role / account | Caption |
|---|---|---|
| `login.png` | — | Login screen at `/login` with the five quick-login role buttons and the Altis branding. Shows the Supabase Auth entry point in cloud mode. |
| `cfo.png` | `cfo@altis.demo` | CFO view (`/cfo`) in base scenario. Shows the 13-week KPI strip (net cash, minimum closing cash, covenant headroom, weeks at risk), the 8 risk signal cards (Weather Billing Risk, Cash-In Delay, Payment Terms, Cash-Out Assumption at high, Covenant Headroom, Data Quality, Forecast Confidence, Opco Underperformance), and the cashflow bar+line chart. |
| `board.png` | `board@altis.demo` | PE Board view (`/board`). Shows the portfolio companies-at-risk table sorted worst-first, the scenario summary table (base / wet / dry) with EUR comparisons, and the portfolio liquidity vs covenant floor chart. |
| `opco.png` | `opco@altis.demo` | Opco MD view (`/opco`) for Opco C (Gilde). Shows the source system badge, the weather-risk calendar colour-coded by delay risk level, and the operational recommendations panel. Demonstrates tight covenant headroom. |
| `project.png` | `project@altis.demo` | Project Lead view (`/project`). Shows the weather calendar with upcoming bad-weather windows highlighted, the billing-timing shift table (weeks where rain defers or accelerates cash-in), and the indicative next-four-weeks milestone billing section. |
| `methodology.png` | `cfo@altis.demo` | Methodology / Assumptions panel (`/methodology`). Shows the full assumptions table: debtor payment profile (mean ≈ 4 weeks), driver percentages, weather shift shares (25% high / 12% medium), covenant floors, opening cash balances — all clearly labelled as assumptions with source and rationale. |
| `data-quality.png` | `cfo@altis.demo` | Data Quality panel (`/data-quality`). Shows the data lineage summary: 26 source files, 4 accounting systems, 4,616 duplicate rows removed, reconciliation check against monthly summary, and the missing-fields list (no bank balances, no AP, no WIP). |
| `trace-drawer.png` | `cfo@altis.demo` | Trace drawer open on a selected forecast week. Shows the driver decomposition: baseline cash-in, weather timing shift (negative EUR), payment-lag adjustment, and each cash-out driver (materials, subcontractor, labour, overhead) with natural-language explanation. |
| `scenario-compare.png` | `cfo@altis.demo` | Scenario comparison view showing base / wet quarter / dry quarter side by side. Highlights the ~€281k billing spill beyond the 13-week window in the wet scenario and the improved minimum cash in the dry scenario. |
| `risk-cards.png` | `cfo@altis.demo` | Close-up of the 8 risk signal cards on the CFO view. Clearly shows level (low/medium/high), EUR impact, confidence percentage, and the honest framing (Cash-Out Assumption Risk always high; weather signal labelled suggestive). |
| `mobile-cfo.png` | `cfo@altis.demo` (iOS) | Native iOS app — CFO view. Shows the 13-week forecast KPI strip and risk summary on the iPhone simulator. Same data as the web app via the shared Supabase backend. |
| `mobile-board.png` | `board@altis.demo` (iOS) | Native iOS app — Board view. Shows the portfolio liquidity overview and companies-at-risk table on the iPhone simulator. |

---

## Notes for Screenshot Capture

- Capture the web app at `http://localhost:3000` (local mode) or the deployed Vercel URL.
- Capture the iOS app on the iPhone 17 simulator (`xcrun simctl boot "iPhone 17"`).
- For `trace-drawer.png`: click any week row in the CFO weekly table to open the drawer.
- For `scenario-compare.png`: use the scenario selector in the navigation bar to switch between scenarios, or use the scenario comparison chart on the CFO view.
- For `risk-cards.png`: scroll to the risk cards section on the CFO view; a wet-quarter scenario will show more high/medium signals.
- Recommended viewport for web screenshots: 1440 × 900 px.
