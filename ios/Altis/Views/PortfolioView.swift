import SwiftUI

struct PortfolioView: View {
    @State private var scenario: Scenario = .base
    @State private var weeks: [ForecastWeek] = []
    @State private var loading = false
    @State private var error: String?

    private var kpis: ForecastKpis { ForecastKpis(weeks: weeks) }

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
        .task(id: scenario) { await load() }
    }

    private var content: some View {
        List {
            Section {
                Picker("Scenario", selection: $scenario) {
                    ForEach(Scenario.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            }

            Section {
                kpiGrid
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowBackground(Color.clear)
            } header: {
                Text("13-week outlook")
            }

            WeekListSection(title: "Weeks", weeks: weeks)
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
    }

    private var kpiGrid: some View {
        let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        return LazyVGrid(columns: columns, spacing: 12) {
            KpiCard(title: "13-week net",
                    value: Format.eurCompact(kpis.netCash),
                    systemImage: "arrow.left.arrow.right",
                    tint: kpis.netCash < 0 ? .red : .green)
            KpiCard(title: "Min closing",
                    value: Format.eurCompact(kpis.minClosingCash),
                    subtitle: kpis.minClosingWeek.isEmpty ? nil : "wk \(Format.weekShort(kpis.minClosingWeek))",
                    systemImage: "arrow.down.to.line",
                    tint: kpis.minClosingCash < 0 ? .red : .primary)
            KpiCard(title: "Cash in",
                    value: Format.eurCompact(kpis.totalCashIn),
                    systemImage: "arrow.down.circle",
                    tint: .green)
            KpiCard(title: "Cash out",
                    value: Format.eurCompact(kpis.totalCashOut),
                    systemImage: "arrow.up.circle",
                    tint: .secondary)
            KpiCard(title: "Weeks at risk",
                    value: "\(kpis.weeksAtRisk)",
                    subtitle: "of \(weeks.count)",
                    systemImage: "exclamationmark.triangle",
                    tint: kpis.weeksAtRisk > 0 ? .orange : .green)
        }
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
