import SwiftUI

struct WeatherView: View {
    @EnvironmentObject private var settings: ForecastSettings
    @State private var companies: [Company] = []
    @State private var selectedCompanyId: Int?
    @State private var weeks: [WeatherWeek] = []
    @State private var loading = false
    @State private var error: String?

    private var forecastWeeks: [WeatherWeek] { weeks.filter(\.isForecastFlag) }
    private var historyWeeks: [WeatherWeek] { Array(weeks.filter { !$0.isForecastFlag }.suffix(16)) }
    private var companyOptions: [Company] { companies.filter { $0.weatherLocationId != nil } }
    private var selectedCompany: Company? {
        companyOptions.first { $0.id == selectedCompanyId } ?? companyOptions.first
    }
    private var locationName: String {
        selectedCompany?.locationName ?? selectedCompany?.displayName ?? "Weather location"
    }

    var body: some View {
        NavigationStack {
            Group {
                if let error, companies.isEmpty {
                    ErrorState(message: error) { Task { await loadCompaniesAndWeather() } }
                } else if loading && companies.isEmpty {
                    ProgressView("Loading weather…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content
                }
            }
            .navigationTitle("Weather")
        }
        .task { await loadCompaniesAndWeather() }
        .onChange(of: selectedCompanyId) { _, _ in
            Task { await loadWeatherOnly() }
        }
    }

    private var content: some View {
        List {
            Section {
                Picker("Company", selection: $selectedCompanyId) {
                    ForEach(companyOptions) { company in
                        Text(company.displayName).tag(Optional(company.id))
                    }
                }
                .pickerStyle(.menu)
                LabeledContent("Rule", value: settings.weatherRule.label)
            } footer: {
                if selectedCompany?.usesProxyLocation == true {
                    Text("This is a dataset-level weather proxy, not a confirmed project coordinate.")
                }
            }

            if !forecastWeeks.isEmpty {
                Section {
                    ForEach(forecastWeeks) { WeatherRow(week: $0, rule: settings.weatherRule) }
                } header: {
                    Text("Forecast · \(locationName)")
                } footer: {
                    Text(settings.weatherRule.explanation + " Change the rule in Settings.")
                }
            }

            if !historyWeeks.isEmpty {
                Section("Recent (actuals)") {
                    ForEach(historyWeeks) { WeatherRow(week: $0, rule: settings.weatherRule) }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await loadCompaniesAndWeather(forceCompanies: true) }
    }

    private func loadCompaniesAndWeather(forceCompanies: Bool = false) async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let service = SupabaseService.shared
            if companies.isEmpty || forceCompanies {
                companies = try await service.companies()
                selectedCompanyId = selectedCompanyId ?? companyOptions.first?.id
            }
            try await loadWeatherOnly()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadWeatherOnly() async {
        guard let locationId = selectedCompany?.weatherLocationId else {
            weeks = []
            return
        }
        do {
            weeks = try await SupabaseService.shared.weather(locationId: locationId)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// One week in the weather risk calendar, classified by the active rule and
/// showing rain workdays, rainfall, heavy-rain days and the delay score.
struct WeatherRow: View {
    let week: WeatherWeek
    let rule: WeatherRule

    private var risk: RiskLevel { rule.risk(for: week) }

    var body: some View {
        HStack(spacing: 12) {
            RiskDot(risk: risk)
            VStack(alignment: .leading, spacing: 3) {
                Text(Format.weekRange(week.weekStart))
                    .font(.subheadline.weight(.semibold))
                Text(detailLine)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(Format.score(week.delayScore))
                    .font(.subheadline.weight(.medium).monospacedDigit())
                Text("delay")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            RiskBadge(risk: risk)
        }
        .padding(.vertical, 2)
    }

    private var detailLine: String {
        var parts = ["\(rule.value(for: week)) \(rule.unitLabel)"]
        if let mm = week.rainSum { parts.append("\(Format.score(mm))mm") }
        if let heavy = week.rainDays5mm, heavy > 0 { parts.append("\(heavy)× ≥5mm") }
        parts.append("\(week.badWorkdays) bad")
        return parts.joined(separator: " · ")
    }
}
