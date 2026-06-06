import SwiftUI

struct WeatherView: View {
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
            } footer: {
                if selectedCompany?.usesProxyLocation == true {
                    Text("This is a dataset-level weather proxy, not a confirmed project coordinate.")
                }
            }

            if !forecastWeeks.isEmpty {
                Section {
                    ForEach(forecastWeeks) { WeatherRow(week: $0) }
                } header: {
                    Text("Forecast · \(locationName)")
                } footer: {
                    Text("Risk from rain workdays (≥2 mm): ≥3 high, 2 medium, else low.")
                }
            }

            if !historyWeeks.isEmpty {
                Section("Recent (actuals)") {
                    ForEach(historyWeeks) { WeatherRow(week: $0) }
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

/// One week in the weather risk calendar.
struct WeatherRow: View {
    let week: WeatherWeek

    var body: some View {
        HStack(spacing: 12) {
            RiskDot(risk: week.risk)
            VStack(alignment: .leading, spacing: 2) {
                Text(Format.weekRange(week.weekStart))
                    .font(.subheadline.weight(.semibold))
                Text("\(week.rainDays2mm) rain workday\(week.rainDays2mm == 1 ? "" : "s") · \(week.badWorkdays) bad")
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
            RiskBadge(risk: week.risk)
        }
        .padding(.vertical, 2)
    }
}
