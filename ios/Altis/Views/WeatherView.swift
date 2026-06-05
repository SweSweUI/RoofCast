import SwiftUI

struct WeatherView: View {
    /// Brunssum.
    private let locationId = 1
    private let locationName = "Brunssum"

    @State private var weeks: [WeatherWeek] = []
    @State private var loading = false
    @State private var error: String?

    private var forecastWeeks: [WeatherWeek] { weeks.filter(\.isForecastFlag) }
    private var historyWeeks: [WeatherWeek] { weeks.filter { !$0.isForecastFlag } }

    var body: some View {
        NavigationStack {
            Group {
                if let error, weeks.isEmpty {
                    ErrorState(message: error) { Task { await load() } }
                } else if loading && weeks.isEmpty {
                    ProgressView("Loading weather…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content
                }
            }
            .navigationTitle("Weather")
        }
        .task { await load() }
    }

    private var content: some View {
        List {
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
        .refreshable { await load() }
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
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
