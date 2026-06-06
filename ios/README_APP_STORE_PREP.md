# App Store Preparation — Altis Cashflow

This document covers the metadata, privacy disclosures, screenshot requirements, TestFlight checklist, and native-app notes needed before submitting to the Apple App Store. App Store submission itself is out of scope for the hackathon; this checklist is here so it can be completed quickly after the event.

---

## App metadata

| Field | Value |
|---|---|
| App name | Altis Cashflow |
| Subtitle | Weather-aware cash forecasting |
| Bundle identifier | `com.altis.cashflow` |
| Category | Finance (primary) |
| Age rating | 4+ (no objectionable content; no user-generated content) |
| Supported platforms | iPhone (iOS 17.0+) |
| Device orientation | Portrait only |

### App Store description

**Short description (170 chars)**

Altis Cashflow gives portfolio operations teams a 13-week cash forecast that adjusts for weather delay — presented as a native, role-aware dashboard.

**Full description**

Altis Cashflow is an internal portfolio analytics platform for PE-backed roofing businesses. It reconciles accounting exports from multiple operating companies into a single cashflow model, layers in a weather-delay signal derived from Open-Meteo historical and live forecast data, and presents the results as role-specific dashboards — CFO, PE Board, Opco MD, and Project Lead.

Key capabilities:
- 13-week rolling cashflow forecast driven by live weather data and seasonal climatology
- Weather delay signal that shifts the timing of projected billing based on historical rain patterns
- Portfolio-level covenant headroom and liquidity-at-risk indicators
- Role-based access: each login is scoped to CFO, Board, Opco MD, Project Lead, or Admin
- Live sync with the Supabase backend — the same data as the web dashboard, read in real time via PostgREST

IMPORTANT: This is not a banking app, payment app, or financial data aggregator. It does not connect to any bank, card network, or financial institution. It reads anonymised portfolio analytics data from a private Supabase backend that the user's organisation operates. It is an internal operations tool for a defined set of known users within the Altis portfolio.

---

## Privacy policy requirements

### What the app collects

| Data type | Details |
|---|---|
| Account credentials | Email address and password, used only for Supabase Auth login. Stored by Supabase; never stored locally on device beyond the session token. |
| Anonymised portfolio analytics | Weekly financial aggregates, weather data, and forecast outputs. Contains no personal or individually identifiable financial data. Company-level data only. |

### What the app does NOT collect

- No location data
- No contacts, photos, camera, or microphone access
- No advertising identifiers (IDFA)
- No third-party analytics SDKs
- No tracking of any kind (App Tracking Transparency is not triggered)

### Data handling and retention

All data is anonymised before it enters the platform. Raw accounting data is processed locally by the Python pipeline and only aggregated summaries are pushed to Supabase. Per the project data governance policy (see `DATA_HANDLING.md` in the web app repository), all copies of Altis data must be deleted within 3 days after the hackathon event. The Admin view in both the web and iOS apps provides an in-app "purge portfolio data" button that removes all `altis_*` tables and demo accounts from the Supabase project.

The privacy policy must state:
- Data is anonymised portfolio analytics; no personal financial data
- Session tokens are stored in-memory and cleared on sign-out
- No data is sold or shared with third parties
- 3-day deletion schedule (see DATA_HANDLING.md)
- Account-based app: users must sign in with credentials issued by the Altis organisation
- No tracking, no ads

### Authentication

The app uses **Supabase Auth** (email/password). There are no Sign in with Apple or social login flows. For review and demo purposes, use the following demo accounts (password: `AltisDemo!2026`):

| Role | Email |
|---|---|
| CFO | `cfo@altis.demo` |
| PE Board | `board@altis.demo` |
| Opco MD | `opco@altis.demo` |
| Project Lead | `project@altis.demo` |
| Admin | `admin@altis.demo` |

These accounts must be active in the Supabase project before App Review begins. They are created by `python3 pipeline/push_supabase.py`.

---

## Screenshot requirements

App Review requires screenshots for every device size on which the app is available. Capture these screens:

### Screens to capture

1. **Login screen** (`LoginView`) — shows the Altis branding and demo login buttons
2. **CFO dashboard** — 13-week cashflow bar/line chart, KPI strip, covenant headroom
3. **PE Board dashboard** — companies-at-risk table, portfolio cashflow chart
4. **Opco MD view** — weather-risk calendar, operational recommendations
5. **Project Lead view** — bad-weather windows, billing-timing shift table
6. **Weather calendar close-up** — colour-coded week grid showing delay risk levels

### Required device sizes

| Size | Device proxy |
|---|---|
| 6.7" (1290 × 2796 px) | iPhone 15 Pro Max / iPhone 16 Pro Max |
| 6.5" (1242 × 2688 px) | iPhone 11 Pro Max / iPhone XS Max |
| 5.5" (1242 × 2208 px) | iPhone 8 Plus |

Apple requires at minimum the 6.7" set; 6.5" and 5.5" are needed if you want to support those screen sizes in search results. iPad screenshots are not required unless `TARGETED_DEVICE_FAMILY` includes iPad (currently set to `"1"` — iPhone only).

Capture in the iOS Simulator using `xcrun simctl io booted screenshot` or the Screenshot tool in Xcode.

---

## TestFlight checklist

### Before uploading a build

- [ ] `PRODUCT_BUNDLE_IDENTIFIER` is `com.altis.cashflow` (set in `project.yml`)
- [ ] `MARKETING_VERSION` bumped (currently `1.0`)
- [ ] `CURRENT_PROJECT_VERSION` bumped (currently `1`; must be monotonically increasing)
- [ ] `ios/Altis/Secrets.swift` generated from `.env.local` (gitignored; contains the Supabase URL and anon key pointing at the **deployed** Supabase project, not localhost)
- [ ] App builds without warnings on Xcode 16+ for a physical device target
- [ ] `CODE_SIGNING_REQUIRED` set to `YES` and a valid Distribution provisioning profile selected (currently `NO` for simulator-only builds)
- [ ] `DEVELOPMENT_TEAM` set to your Apple Developer Team ID

### Export compliance

The app uses standard HTTPS/TLS for all network traffic (Supabase REST API). It does not implement or use any proprietary encryption algorithms. In App Store Connect, answer:

- Does the app use encryption? **Yes** (HTTPS/TLS)
- Does the app qualify for an exemption? **Yes** — uses only standard OS networking (URLSession / TLS); no additional export compliance documentation is required under EAR 740.17(b)(1)

### Capabilities and entitlements

No special capabilities are required:
- No Push Notifications
- No Background Fetch
- No Sign in with Apple
- No HealthKit, HomeKit, or other restricted APIs
- Network access only (via URLSession through the Supabase Swift SDK)

### Uploading to TestFlight

```bash
# Generate the Xcode project
cd ios && xcodegen generate

# Archive for distribution (requires a Distribution certificate + provisioning profile)
xcodebuild archive \
  -project Altis.xcodeproj \
  -scheme Altis \
  -archivePath build/Altis.xcarchive \
  -destination "generic/platform=iOS"

# Export the IPA
xcodebuild -exportArchive \
  -archivePath build/Altis.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/

# Upload to App Store Connect
xcrun altool --upload-app \
  -f build/Altis.ipa \
  -t ios \
  -u your@apple.id \
  -p "@keychain:APP_STORE_PASSWORD"
```

Or use Xcode Organizer: Product → Archive → Distribute App → App Store Connect → Upload.

---

## Native app status

A **native SwiftUI app exists under `ios/`**. It is not a webview wrapper.

- Built with SwiftUI and the official `supabase-swift` SDK (added as a Swift Package in `project.yml`).
- Signs in with the same Supabase Auth accounts as the web dashboard.
- Reads the same `altis_*` tables via PostgREST (Supabase's auto-generated REST layer) — no separate API is needed.
- Targets iOS 17.0+; tested on the iPhone 17 Pro simulator.
- `ios/Altis/Secrets.swift` (gitignored) holds the Supabase URL and anon key. The app points at the deployed Supabase project URL, not localhost — no configuration change is needed when the Supabase project is live.
- The `project.yml` file drives `xcodegen`; the `.xcodeproj` itself is gitignored (it is regenerated on each checkout).

App Store submission itself is out of scope for the hackathon. The checklist above is here so the process can be completed quickly post-event if desired.
