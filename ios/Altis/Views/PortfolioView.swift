import SwiftUI

struct PortfolioView: View {
    @EnvironmentObject private var settings: ForecastSettings
    private let scenario: Scenario = .base
    @State private var weeks: [ForecastWeek] = []
    @State private var loading = false
    @State private var error: String?
    @State private var selectedMetric: PortfolioMetric?

    private var adjusted: AdjustedForecast { ForecastEngine.adjust(weeks, settings: settings) }

    var body: some View {
        NavigationStack {
            Group {
                if let error, weeks.isEmpty {
                    ErrorState(message: error) { Task { await load() } }
                } else if loading && weeks.isEmpty {
                    ProgressView("Loading forecast…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content
                }
            }
            .navigationTitle("Portfolio")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if loading && !weeks.isEmpty { ProgressView() }
                }
            }
        }
        .task { await load() }
    }

    private var content: some View {
        let forecast = adjusted
        return List {
            Section {
                ForecastKpiGrid(forecast: forecast, floor: settings.warningFloor) { selectedMetric = $0 }
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowBackground(Color.clear)
            } header: {
                Text("\(forecast.weeks.count)-week outlook · tap a tile")
            } footer: {
                Text(covenantFooter(forecast.kpis))
            }

            WeekListSection(title: "Weeks", weeks: forecast.weeks)
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
        .navigationDestination(item: $selectedMetric) { metric in
            KpiDetailView(metric: metric, forecast: adjusted, title: "Portfolio", floor: settings.warningFloor)
        }
    }

    private func covenantFooter(_ k: AdjustedKpis) -> String {
        let floor = Format.eurCompact(settings.warningFloor)
        if k.covenantBreach {
            return "Closing cash breaches the \(floor) warning floor — min headroom \(Format.signedEur(k.minHeadroom))."
        }
        return "Min headroom \(Format.eurCompact(k.minHeadroom)) above the \(floor) floor. Opening cash \(Format.eurCompact(k.openingCash))."
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            weeks = try await SupabaseService.shared.portfolioWeeks(scenario: scenario)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
