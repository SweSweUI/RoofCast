# Altis Working Prompt

You are working in the existing Altis codebase, a weather-aware 13-week billing-to-cash forecasting platform for a PE-backed roofing portfolio in the Netherlands. Read the repository before making changes. Preserve the current product direction, data model, and honest framing.

## Product Goal

Build and polish a simple, credible app that lets a CFO answer:

> If the weather is bad now, what will happen to revenue, billing, cash-in, and liquidity over the next 13 weeks?

The business is a roofing portfolio. Bad weather does not permanently reduce revenue. It delays work, milestones, invoices, and cash collection. The app must make this timing effect easy to understand for a non-AI CFO.

## Core Story

Four operating companies use different accounting systems. Their transaction data must be reconciled into one model. Historical weather and live weather forecasts are used as a timing overlay on top of normal billing patterns.

The key chain is:

weather risk -> roofing work delay -> milestone delay -> billing delay -> cash-in delay through payment terms

A wet week should show a dip later, usually around 3 to 5 weeks after the bad-weather window, followed by catch-up. The app must clearly say this is a timing shift, not lost revenue.

## Current Codebase Context

Use and improve the existing implementation. Do not rebuild the app from scratch.

- Next.js 14 App Router, TypeScript, Tailwind, Recharts
- Supabase backend with SQLite local fallback
- Python data pipeline in `pipeline/`
- Pure TypeScript forecast engine in `lib/forecast/`
- Weather integration through Open-Meteo
- Role dashboards for CFO, PE Board, Opco MD, Project Lead, Methodology, Data Quality, and Admin
- Native iOS app sharing the same Supabase backend

Important commands:

- `npm run pipeline` rebuilds the local data store
- `npm run weather` refreshes weather data
- `npm run stats` recomputes lag statistics
- `npm run snapshot` persists forecast rows
- `npm run test` runs TypeScript and Python tests
- `npm run build` verifies production build

## What Already Exists

The repository already contains a working Altis platform. Build on these files and patterns:

- Web shell/navigation: `components/AppShell.tsx`
- CFO dashboard: `app/(dash)/cfo/page.tsx`
- PE Board dashboard: `app/(dash)/board/page.tsx`
- Opco MD dashboard: `app/(dash)/opco/page.tsx`
- Project Lead dashboard: `app/(dash)/project/page.tsx`
- Methodology page: `app/(dash)/methodology/page.tsx`
- Data Quality page: `app/(dash)/data-quality/page.tsx`
- Admin/governance page: `app/(dash)/admin/page.tsx`
- Forecast API: `app/api/forecast/route.ts`
- Weather API: `app/api/weather/route.ts`
- Risk API: `app/api/risks/route.ts`
- Trace API: `app/api/trace/route.ts`
- Company API: `app/api/companies/route.ts`
- Risk cards: `components/RiskOverview.tsx`
- Trace drawer: `components/TracePanel.tsx`
- Weekly forecast table: `components/WeekTable.tsx`
- Weather calendar widget: `components/charts/WeatherCalendar.tsx`
- Forecast engine: `lib/forecast/engine.ts`
- Weather risk classifier: `lib/forecast/weather.ts`
- Risk signal computation: `lib/forecast/risks.ts`
- Shared types: `lib/types.ts`
- SQLite/Supabase data abstraction: `lib/data/`
- Pipeline schema and ingest: `pipeline/schema.sql`, `pipeline/ingest.py`, `pipeline/weather.py`, `pipeline/stats.py`
- iOS app tabs: `ios/Altis/Views/MainTabView.swift`
- iOS portfolio/company/weather screens: `ios/Altis/Views/PortfolioView.swift`, `CompaniesView.swift`, `WeatherView.swift`
- iOS Supabase reads: `ios/Altis/Services/SupabaseService.swift`

Existing capabilities:

- 13-week cash forecast per company and portfolio
- Base / wet-quarter / dry-quarter scenarios
- Weather timing shift model
- Open-Meteo historical + live weather data
- Weather-risk calendar in web Opco and Project views
- Risk cards for 8 weather-to-cash signals
- Trace drawer for weekly forecast explainability
- Company comparison, covenant headroom, scenario comparison, cashflow charts
- Data-quality and methodology pages
- Supabase Auth/RBAC with local SQLite fallback
- Native iOS app with Portfolio, Companies, Weather, and About tabs
- Company tables already include `latitude`, `longitude`, `location_name`, `weather_location_id`
- Weather proxy locations already exist in `weather_locations`

Existing iOS app capabilities:

- The native app lives under `ios/Altis/` and is SwiftUI, not a webview.
- `ios/project.yml` is the XcodeGen source of truth. Bundle id is `com.altis.cashflow`; target is iPhone, iOS 17+, portrait.
- `ios/Altis/AltisApp.swift` uses `RootView` to switch between login and the signed-in tab shell.
- `ios/Altis/Services/AppState.swift` restores Supabase sessions, signs users in/out, fetches `altis_profiles`, and exposes email/role/full name.
- `ios/Altis/Views/LoginView.swift` has email/password Supabase login and the data-handling notice.
- `ios/Altis/Views/MainTabView.swift` currently has four tabs: Portfolio, Companies, Weather, About.
- `PortfolioView.swift` shows portfolio forecast for base/wet/dry scenarios with KPI cards and a 13-week week list.
- `CompaniesView.swift` lists operating companies, loads each company's forecast concurrently, and has a company detail view with KPIs and week list.
- `WeekViews.swift` provides reusable week rows and week detail/explanation screens.
- `WeatherView.swift` shows weekly weather forecast/history for a hardcoded Brunssum location (`locationId = 1`).
- `AboutView.swift` shows signed-in user info, role badge, data handling note, app purpose, and sign out.
- `SupabaseService.swift` reads `altis_profiles`, `altis_forecast_weeks`, `altis_companies`, and `altis_weather_weekly` directly through Supabase PostgREST.
- `Models.swift` has Swift models for `Scenario`, `RiskLevel`, `Profile`, `Company`, `ForecastWeek`, `WeatherWeek`, and derived `ForecastKpis`.

Current iOS limitations to address:

- No Map tab yet.
- `Company` does not yet include latitude/longitude in the Swift model or Supabase select.
- Weather tab is tied to Brunssum instead of letting the user choose company/weather location.
- iOS has no CFO/Board/Opco/Project role-specific tab structure yet; it has simpler Portfolio/Companies/Weather/About tabs.
- iOS has no risk overview cards matching the web `RiskOverview`.
- iOS week detail shows the explanation text but does not fetch full trace links/source transactions like the web trace drawer.
- iOS has no LTM EBITDA risk, normal-weather variance bridge, waterfall chart, connector status, or admin purge UI yet.
- If richer iOS screenshots are needed, build those screens first; do not rely on the app-store prep notes alone.

Missing or incomplete capabilities to add next:

- A dedicated web Map page with company/project markers and weather-risk overlay
- A native iOS Map tab using the same company/weather data
- A shared map/location API returning companies, coordinates, proxy-location status, and current/forecast weather risk
- LTM EBITDA / normalized earnings risk overlay
- Normal-weather baseline versus actual-weather variance comparison
- Stakeholder waterfall/bridge chart isolating weather impact from other/unexplained variance
- Accounting connector/API plumbing for Exact, Snelstart, Gilde, and Excel/import sources
- Connector status UI: not configured, connected, sync failed, last synced
- Collapsible/clickable widgets that route from high-level overview cards into the existing detail pages

## Build-On-Top Instructions

Preserve the current architecture:

- Keep the forecast engine pure and testable.
- Keep database access behind `lib/data/`.
- Keep web API routes as the bridge between UI and forecast/data logic.
- Keep the SQLite fallback working; do not make Supabase mandatory for web development.
- Keep Supabase as the shared backend for web + iOS production/demo mode.
- Extend existing types in `lib/types.ts` and Swift models rather than creating unrelated parallel models.
- Reuse `Card`, `Kpi`, `Pill`, `RiskBadge`, `WeatherCalendar`, `RiskOverview`, `TracePanel`, and existing chart patterns.
- Add new pages/components in the same visual language: dense, calm, finance-operating-tool UI.
- Do not remove existing dashboards or rewrite them into a landing page.

Recommended build order:

1. Add a shared location/weather map data contract.
   - Extend `/api/companies` or add `/api/map`.
   - Return company id/code/name, source system, location name, latitude, longitude, whether the location is assumed, weather location id, current horizon risk, live/seasonal weather source, and estimated weather cash impact.
   - Use existing `companies` and `weather_locations` tables first.
   - Add project-level location support later only if project coordinates become available.

2. Add the web Map page.
   - Create `app/(dash)/map/page.tsx`.
   - Add it to `components/AppShell.tsx` navigation.
   - Show company markers over a Netherlands/South Limburg map.
   - Marker color should reflect weather/cash risk: low, medium, high.
   - Marker detail should show company, source system, location/proxy assumption, rain/bad-workday outlook, and estimated cash timing impact.
   - The map should link to the Opco or Project view for deeper action.

3. Add the iOS Map tab.
   - Add a `MapView` tab in `ios/Altis/Views/MainTabView.swift`.
   - Preserve the existing Portfolio, Companies, Weather, and About tabs.
   - Extend `Company` in `ios/Altis/Models/Models.swift` to include latitude/longitude.
   - Extend `SupabaseService.companies()` to select latitude/longitude and any needed location fields.
   - Use native MapKit and the same risk/location logic as the web UI where possible.
   - Reuse `RiskBadge`, `RiskDot`, `KpiCard`, and existing `Format` helpers for marker details and summary cards.
   - Make WeatherView company/location-aware after the map data model exists; remove the hardcoded Brunssum-only assumption when practical.

4. Add LTM EBITDA / normalized earnings risk.
   - Start with a proxy if true EBITDA is not available.
   - Clearly label proxy EBITDA as an assumption.
   - Add a 5% medium-risk flag and configurable 10% high-risk flag.
   - Implement this as an additional risk signal and a visible CFO/Board card.

5. Add the normal-weather vs actual-weather variance bridge.
   - Compute normal-weather expectation by neutralizing the weather timing overlay.
   - Compare it with actual/live-weather forecast.
   - Show weather-explained variance, known non-weather drivers where data exists, and "unexplained / requires management input" for the remainder.
   - Add a waterfall chart for CFO and Board stakeholder communication.

6. Add accounting connector plumbing.
   - Add connector metadata/config types and API routes or service modules.
   - Do not put real credentials in client-side code.
   - Keep manual Excel ingestion working.
   - Show connector status in Admin or Data Quality.

## Data Requirements

Use the existing source-data concept:

- Multiple Excel exports from four operating companies
- Different systems, including Exact-style GL, Snelstart/FinTransactions, Gilde, and invoice-register style data
- Deduplicate repeated exports by content hash
- Aggregate billing/revenue by company and week
- Keep raw data out of git
- Label missing data clearly: no bank balances, no AP ledger, no real covenant documentation, no complete project locations

The model must continue to work in local SQLite mode without Supabase credentials.

The web dashboard and native iOS app should share the same location/weather data model so the map experience stays consistent across surfaces.

## Weather Model Requirements

Use Open-Meteo:

- Historical archive for past weather
- Live forecast for the near-term horizon
- Seasonal climatology for weeks beyond live forecast availability

Classify roofing delay risk by workday weather:

- Low: 0 to 1 bad workday
- Medium: 2 bad workdays
- High: 3 or more bad workdays

A bad roofing workday can be caused by heavy rain, high wind gusts, or snow. The first version may be rain-first, but wind and heat should be easy to add.

Because company-specific project locations are incomplete, use sensible proxy locations and label them as assumptions. Peter Ummels can use Brunssum. Other opcos can use a South Limburg or Maastricht proxy until real project locations are available.

## Forecast Requirements

The forecast horizon is 13 weeks.

The base forecast should use:

- Recent run-rate
- Weekly seasonality
- Historical billing patterns
- Debtor payment lag
- Weather-driven billing timing shift
- Company-level and portfolio-level aggregation

Scenarios:

- Base: live weather plus seasonal climatology
- Wet quarter: higher weather intensity, more delay
- Dry quarter: lower weather intensity, less delay

The model should shift billing timing, not destroy revenue:

- Medium weather risk shifts part of billing later
- High weather risk shifts more billing later
- Catch-up appears several weeks later
- Any shifted billing beyond week 13 is tracked as spillover beyond the horizon

Keep all assumptions configurable and visible in the UI.

## Risk Flagging and LTM EBITDA Requirements

Be specific about when the app flags risk. The user should not only see a forecast; they should see which weeks/months require attention and why.

Core flagging rules:

- Cash/liquidity risk is flagged when forecast closing cash approaches or breaches the configured covenant/liquidity floor.
- Medium cash risk: closing cash headroom is positive but within 25% of the configured floor.
- High cash risk: closing cash is below the configured floor.
- Weather timing risk is flagged when medium or high bad-workday risk shifts material billing or cash-in outside the expected week.
- Stakeholder communication risk is flagged when LTM EBITDA is expected to deviate by more than 5% versus the normal-weather expectation or prior reporting expectation.
- High stakeholder communication risk can be shown at 10%+ LTM EBITDA deviation, or should remain configurable if the actual bank/investor governance threshold is not provided.

LTM EBITDA is important for bank and investor communication. The actual bank covenant settings are sensitive and not provided, so the app must not invent them. Instead, show a configurable LTM EBITDA risk overlay:

- LTM EBITDA means the last 12 months of EBITDA.
- Each new reporting month replaces the same month from the prior year.
- If a strong month from last year drops out and a weak current month enters, the LTM EBITDA movement can be large even if the short-term weekly forecast looks acceptable.
- Example logic: when reporting May 2026, May 2025 drops out of the 12-month window and May 2026 enters. If May 2025 was strong and May 2026 is weak, flag the deviation.
- Because source data may not include actual EBITDA or cost detail, EBITDA can start as a normalized/proxy metric based on available revenue and assumptions. Clearly label this until real EBITDA data is connected.

The app should compare:

- Normal-weather expectation: what earnings/cash timing would look like under typical weather conditions.
- Actual-weather forecast: what changes when live/forecast weather is applied.
- Variance: actual-weather forecast minus normal-weather expectation.

The key question to answer is:

> How much of the expected variance is explained by weather, and how much remains unexplained or driven by other factors?

Where data exists, split non-weather variance into other drivers such as price/mix, labour capacity, material shortages, project delays, and collection/payment terms. Where data does not exist, show it as "unexplained / requires management input" rather than guessing.

## Dashboard Requirements

The CFO should be able to understand the main risk within 10 seconds.

Extend the existing role navigation instead of replacing it. The current web navigation already has CFO, PE Board, Opco MD, Project Lead, Data Quality, Methodology, and Admin. Treat the existing CFO page as the main overview unless a separate Overview route is explicitly needed later.

The dashboard should feel modular: key blocks can be built as reusable widgets/cards, with collapsible detail sections where useful. Important cards should be clickable and route to the deeper existing page behind that signal.

High-level surfaces to preserve and extend:

1. CFO / Overview
   - Use existing `app/(dash)/cfo/page.tsx`
   - Main 13-week cash and risk summary
   - The most important KPIs and forecast charts
   - Clickable risk cards/widgets that route to deeper views
   - Existing graph section for cash-in, cash-out, net cash, and covenant headroom
   - Add clear visual flags on weeks or months with medium/high risk
   - Add LTM EBITDA deviation card with normal-weather vs actual-weather variance
   - Add waterfall/bridge chart for stakeholder communication: normal-weather expectation -> weather impact -> other known drivers -> unexplained variance -> actual/latest forecast

2. Weather
   - Build on existing weather widgets in `app/(dash)/opco/page.tsx`, `app/(dash)/project/page.tsx`, `components/charts/WeatherCalendar.tsx`, and `app/api/weather/route.ts`
   - Weather-driven delay forecast
   - Rain/bad-workday outlook by week
   - Weather risk explanation in plain language
   - Company-level exposure to weather delays
   - Normal-weather baseline versus actual-weather forecast
   - Quantified weather impact in EUR and percentage where possible
   - A separate `/weather` route is optional; do not duplicate the existing Opco/Project weather functionality unless it improves clarity

3. Map
   - This is the biggest missing UI surface
   - Add a web map route, preferably `app/(dash)/map/page.tsx`, and add it to `components/AppShell.tsx`
   - Add a native iOS map tab in `ios/Altis/Views/MainTabView.swift`
   - Map view must have weather overlay in both the web UI and the native iOS app
   - Company or project locations on the map
   - Location markers should show company name, location assumption/source, local weather risk, and expected cash timing impact
   - For now, use available company-level proxy locations where project locations are missing
   - Design the data model so project-level coordinates can be added later without rewriting the UI
   - Web UI can use an embedded interactive map component
   - iOS app should include a native MapKit view using the same company/project location and weather-risk data from Supabase

Detailed role views:

1. CFO view
   - 13-week cash forecast
   - Cash-in, cash-out, net cash, closing cash
   - Minimum closing cash and covenant headroom
   - LTM EBITDA deviation and stakeholder communication risk
   - Scenario switcher: base, wet quarter, dry quarter
   - Risk cards with EUR impact and confidence
   - Company comparison
   - Clickable week table with trace/explanation drawer
   - Waterfall chart that isolates weather impact from other/explained and unexplained variance

2. PE Board view
   - Portfolio-level cash outlook
   - Companies at risk, sorted worst-first
   - Covenant and liquidity story
   - Plain-English takeaway for the selected scenario
   - Investor/bank-ready explanation of EBITDA or cash variance without exposing sensitive covenant details

3. Opco MD view
   - Single-company view
   - Weather-risk calendar
   - Operational recommendations
   - Weeks with material billing timing shifts

4. Project Lead view
   - Upcoming bad-weather windows
   - Weather calendar
   - Expected milestone or billing timing impact
   - Clear labels that outputs are model estimates, not confirmed schedules

5. Methodology view
   - Every assumption
   - Weather signal caveats
   - Payment lag logic
   - Cost driver assumptions
   - Explain that weak statistical signal is used only as a risk overlay

6. Data Quality view
   - Source systems and file counts
   - Deduplication results
   - Reconciliation status
   - Missing fields and limitations

7. Admin view
   - User management
   - Pipeline status
   - Data purge action for the 3-day hackathon deletion rule

## Explainability Requirements

Every forecast number should be explainable.

When a user clicks a week, show:

- Baseline cash-in
- Weather timing shift
- Payment-lag effect
- Materials, subcontractor, labour, and overhead cash-out drivers
- Covenant headroom
- LTM EBITDA or normalized earnings impact if applicable
- Whether the week/month is flagged and which threshold triggered the flag
- Whether the weather data is live or seasonal
- The assumptions and source tables behind the number

Use plain language. Avoid making the model sound more certain than it is.

## Risk Signals

Keep or implement these risk signals:

- Weather billing risk
- Cash-in delay risk
- Payment terms risk
- Cash-out assumption risk
- Covenant headroom risk
- Data quality risk
- Forecast confidence risk
- Opco underperformance risk
- LTM EBITDA deviation / stakeholder communication risk

Each signal should have:

- Level: low, medium, high
- EUR impact where applicable
- Confidence score
- Human-readable reason
- Trace back to source data, formula, or assumption

Risk cards should visually answer three questions:

- What is flagged?
- Why is it flagged?
- What should the CFO communicate or investigate next?

Use clear status colors and labels, but do not rely on color alone. Each flagged item should include a concise explanation, threshold, and confidence level.

## Optional Assistant Feature

If time allows, add a simple CFO chat or question-answer panel. It should not pretend to be a general internet-connected agent. It should answer questions from known internal data, assumptions, and forecast outputs, for example:

- "Why is cash lower in week 5?"
- "Which company is most exposed in the wet scenario?"
- "How much billing is pushed beyond the 13-week horizon?"
- "What assumptions drive cash-out?"
- "Why was this month flagged for LTM EBITDA risk?"
- "How much of the variance is weather versus unexplained?"

The chat can be retrieval-style over local tables, docs, and forecast outputs. Keep it small and auditable.

## Future Integration Direction

Leave clear extension points and basic plumbing for real accounting integrations. Even if the hackathon version uses uploaded/exported Excel files, the app should make it clear how live API connections would keep the model updated.

- Exact API keys
- Snelstart API
- Gilde or other accounting exports
- Recurring data refresh
- Project-level locations once available
- Real AP ledger, bank balances, debtor days, and covenant terms

API plumbing requirements:

- Add a connector/config concept per accounting system
- Show connection status per source system: not configured, connected, sync failed, last synced
- Store only safe metadata in the UI; keep credentials server-side
- Create placeholder server routes or service modules for Exact, Snelstart, Gilde, and generic Excel/import sources
- Keep the ingestion pipeline compatible with both manual exports and future live sync
- Make it clear which data currently comes from uploaded files and which data would come from APIs in production

## UX Principles

- Make the product feel like a CFO operating tool, not a marketing page
- Keep screens dense, readable, and calm
- Use charts only when they answer a clear question
- Prefer plain-English labels over AI jargon
- Show uncertainty and assumptions directly
- Do not overcomplicate the interface
- Do not hide that some inputs are assumptions
- The app should be useful even if the user knows nothing about AI
- The same insight should work for two audiences: finance stakeholders need covenant/EBITDA/cash language, while local roofing management needs practical project/weather/capacity language

## Non-Goals

- Do not claim causal certainty from weather statistics
- Do not claim revenue is lost because of bad weather
- Do not build a generic chatbot as the main product
- Do not require Supabase for local development
- Do not commit raw source data, secrets, caches, or generated databases
- Do not make untraceable black-box forecasts

## Success Criteria

The final result is successful when:

- The CFO can see the 13-week cash outlook per company and portfolio
- Wet and dry scenarios visibly change cash timing
- Weather-driven delays are explained as timing shifts
- Company-level differences are visible
- Every major number can be traced to source data, formula, or assumption
- Assumptions are documented in the UI
- Tests and build pass
- The demo can be explained in 3 to 4 minutes
- The product feels credible, simple, and honest

## Suggested Demo Narrative

"This is a weather-aware billing-to-cash forecast for a roofing portfolio. We combine four accounting systems into one 13-week forecast. Rain and bad roofing weather delay execution, which delays milestones, billing, and eventually cash collection. The model does not say revenue disappears. It shows when cash arrives later and where covenant headroom becomes tight. The CFO can switch between base, wet, and dry scenarios, compare operating companies, and click any week to see exactly why the number changed."
