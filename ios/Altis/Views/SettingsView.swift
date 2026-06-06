import SwiftUI

/// The single Settings page. Every knob here recomputes the dashboards
/// on-device, so the Portfolio / Companies / Map / Weather screens are pure
/// displays of the result. Mirrors the web app's control + assumptions model.
struct SettingsView: View {
    @EnvironmentObject private var settings: ForecastSettings
    @EnvironmentObject private var appState: AppState
    @State private var signingOut = false

    var body: some View {
        NavigationStack {
            Form {
                horizonSection
                liquiditySection
                cashOutSection
                weatherSection
                connectorsSection
                assumptionsSection
                accountSection

                Section {
                    Button(role: .destructive) { settings.reset() } label: {
                        Label("Reset to defaults", systemImage: "arrow.counterclockwise")
                    }
                    .disabled(settings.isDefault)
                }
            }
            .navigationTitle("Settings")
        }
    }

    // MARK: forecast horizon

    private var horizonSection: some View {
        Section {
            Picker("Forecast horizon", selection: $settings.horizonWeeks) {
                ForEach(ForecastSettings.horizonOptions, id: \.self) { weeks in
                    Text("\(weeks) weeks").tag(weeks)
                }
            }
            .pickerStyle(.segmented)
        } header: {
            Text("Forecast horizon")
        } footer: {
            Text("How many forecast weeks the dashboards show. The shared snapshot covers 13 weeks of live + seasonal weather.")
        }
    }

    // MARK: liquidity & covenant

    private var liquiditySection: some View {
        Section {
            CurrencyField(title: "Warning floor", value: $settings.warningFloor, step: 50_000)
            CurrencyField(title: "Opening cash adjustment", value: $settings.openingCashDelta, step: 50_000, signed: true)
        } header: {
            Text("Liquidity & covenant")
        } footer: {
            Text("Closing cash below the warning floor is a covenant breach; within 25% is a warning. Opening cash and the floor are assumptions — the source data has no bank balances.")
        }
    }

    // MARK: cash-out assumptions

    private var cashOutSection: some View {
        Section {
            CurrencyField(title: "Weekly dividend / other cash-out", value: $settings.weeklyDividend, step: 25_000)
        } header: {
            Text("Cash-out assumptions")
        } footer: {
            Text("Dividends and other outflows aren't in the revenue-only source data, so they're a configurable weekly assumption. Cost drivers (materials, subcontractor, labour, overhead) are modelled server-side.")
        }
    }

    // MARK: weather

    private var weatherSection: some View {
        Section {
            Picker("Bad-weather rule", selection: $settings.weatherRule) {
                ForEach(WeatherRule.allCases) { rule in
                    Text(rule.label).tag(rule)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Weather sensitivity")
                    Spacer()
                    Text(sensitivityLabel)
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                Slider(value: $settings.weatherSensitivity, in: 0.5...1.5, step: 0.1)
            }
        } header: {
            Text("Weather")
        } footer: {
            Text("\(settings.weatherRule.explanation) Sensitivity scales how much weather pushes cash later — 1.0× is the model, higher amplifies the delay.")
        }
    }

    private var sensitivityLabel: String {
        String(format: "%.1f×", settings.weatherSensitivity)
    }

    // MARK: connectors & APIs

    private var connectorsSection: some View {
        Section {
            ConnectorRow(name: "SnelStart", detail: "FinTransactions — Peter Ummels", status: .active)
            ConnectorRow(name: "Exact Online", detail: "GL exports", status: .ready)
            ConnectorRow(name: "Gilde / Verkoopboek", detail: "Sales journal import", status: .active)
            ConnectorRow(name: "Excel / CSV import", detail: "Manual fallback", status: .active)
            ConnectorRow(name: "Open-Meteo", detail: "Live + seasonal weather", status: .active)
            ConnectorRow(name: "Data agent (OpenRouter)", detail: "Grounded Q&A", status: .active)
        } header: {
            Text("Connectors & APIs")
        } footer: {
            Text("Status only — API keys and OAuth tokens are managed server-side and never stored on the device. Other platforms (AFAS, Twinfield, Moneybird, QuickBooks, Xero, Business Central, NetSuite, SAP, Sage, Visma, Yuki) are ready for setup.")
        }
    }

    // MARK: assumptions & data

    private var assumptionsSection: some View {
        Section("Assumptions & data quality") {
            BulletRow("Source data is billing/revenue only — bank balances, AP and full cost ledgers are assumptions.")
            BulletRow("Weather is a risk signal that shifts cash timing, not a causal law (p≈0.07–0.19).")
            BulletRow("Cash-in is collected on a ~4-week debtor-payment profile.")
            DataHandlingNotice().padding(.vertical, 2)
        }
    }

    // MARK: account

    private var accountSection: some View {
        Section("Account") {
            LabeledContent("Email", value: appState.email ?? "—")
            LabeledContent("Role") {
                Text(appState.roleBadge)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.15), in: Capsule())
                    .foregroundStyle(Color.accentColor)
            }
            Button(role: .destructive) {
                signingOut = true
                Task { await appState.signOut(); signingOut = false }
            } label: {
                HStack {
                    if signingOut { ProgressView().controlSize(.small) }
                    Text("Sign out")
                    Spacer()
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                }
            }
            .disabled(signingOut)
        }
    }
}

// MARK: - Reusable rows

/// A euro text field with a stepper for coarse adjustment.
private struct CurrencyField: View {
    let title: String
    @Binding var value: Double
    var step: Double = 50_000
    var signed: Bool = false

    var body: some View {
        HStack {
            Text(title)
                .lineLimit(2)
            Spacer(minLength: 12)
            Text(signed ? Format.signedEur(value) : Format.eur(value))
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(value == 0 ? .secondary : .primary)
            Stepper(title, value: $value, in: bounds, step: step)
                .labelsHidden()
        }
    }

    private var bounds: ClosedRange<Double> {
        signed ? -2_000_000...2_000_000 : 0...20_000_000
    }
}

private enum ConnectorStatus {
    case active, ready
    var label: String { self == .active ? "Active" : "Ready" }
    var color: Color { self == .active ? .green : .orange }
}

private struct ConnectorRow: View {
    let name: String
    let detail: String
    let status: ConnectorStatus

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.subheadline.weight(.medium))
                Text(detail).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            Text(status.label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(status.color)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(status.color.opacity(0.15), in: Capsule())
        }
        .padding(.vertical, 2)
    }
}

private struct BulletRow: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Label(text, systemImage: "circle.fill")
            .labelStyle(BulletLabelStyle())
            .font(.caption)
            .foregroundStyle(.secondary)
    }
}

private struct BulletLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .top, spacing: 8) {
            configuration.icon.font(.system(size: 5)).padding(.top, 6)
            configuration.title
        }
    }
}
