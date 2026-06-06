import SwiftUI

struct CompaniesView: View {
    @EnvironmentObject private var settings: ForecastSettings
    private let scenario: Scenario = .base
    @State private var companies: [Company] = []
    /// Cached raw per-company weeks for the current scenario, keyed by company id.
    @State private var weeksByCompany: [Int: [ForecastWeek]] = [:]
    @State private var loading = false
    @State private var error: String?

    private let columns = [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]

    var body: some View {
        NavigationStack {
            Group {
                if let error, companies.isEmpty {
                    ErrorState(message: error) { Task { await load() } }
                } else if loading && companies.isEmpty {
                    ProgressView("Loading companies…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content
                }
            }
            .navigationTitle("Companies")
        }
        .task { await load() }
    }

    private var content: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 14) {
                ForEach(companies) { company in
                    let forecast = ForecastEngine.adjust(weeksByCompany[company.id] ?? [], settings: settings)
                    NavigationLink {
                        CompanyDetailView(company: company, scenario: scenario,
                                          preloaded: weeksByCompany[company.id])
                    } label: {
                        CompanyWidgetCard(company: company, forecast: forecast)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .refreshable { await load() }
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let service = SupabaseService.shared
            if companies.isEmpty {
                companies = try await service.companies()
            }
            var map: [Int: [ForecastWeek]] = [:]
            try await withThrowingTaskGroup(of: (Int, [ForecastWeek]).self) { group in
                for company in companies {
                    group.addTask {
                        (company.id, try await service.companyWeeks(companyId: company.id, scenario: scenario))
                    }
                }
                for try await (id, weeks) in group {
                    map[id] = weeks
                }
            }
            weeksByCompany = map
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// A tappable company widget showing its headline forecast under the current settings.
private struct CompanyWidgetCard: View {
    let company: Company
    let forecast: AdjustedForecast

    private var risk: RiskLevel {
        forecast.weeks.map(\.risk).max(by: { $0.severity < $1.severity }) ?? .low
    }

    var body: some View {
        let k = forecast.kpis
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                RiskDot(risk: risk)
                Spacer()
                if k.covenantBreach {
                    Image(systemName: "exclamationmark.shield.fill").foregroundStyle(.red).font(.caption)
                }
                RiskBadge(risk: risk, compact: true)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(company.displayName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(company.locationName ?? "No location")
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Divider()
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(Format.eurCompact(k.netCash))
                        .font(.headline.monospacedDigit())
                        .foregroundStyle(k.netCash < 0 ? .red : .green)
                    Text("net · \(forecast.weeks.count)wk").font(.caption2).foregroundStyle(.tertiary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text(Format.eurCompact(k.minClosingCash))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(k.covenantBreach ? .red : .primary)
                    Text("min cash").font(.caption2).foregroundStyle(.tertiary)
                }
            }
            Label("\(k.weeksAtRisk) week\(k.weeksAtRisk == 1 ? "" : "s") at risk", systemImage: "exclamationmark.triangle")
                .font(.caption2)
                .foregroundStyle(k.weeksAtRisk > 0 ? .orange : .secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

/// One company's forecast for the selected scenario, honouring Settings.
struct CompanyDetailView: View {
    @EnvironmentObject private var settings: ForecastSettings
    let company: Company
    let scenario: Scenario
    let preloaded: [ForecastWeek]?

    @State private var weeks: [ForecastWeek] = []
    @State private var loading = false
    @State private var error: String?
    @State private var selectedMetric: PortfolioMetric?

    private var adjusted: AdjustedForecast { ForecastEngine.adjust(weeks, settings: settings) }

    var body: some View {
        Group {
            if let error, weeks.isEmpty {
                List { ErrorState(message: error) { Task { await load(force: true) } } }
            } else {
                let forecast = adjusted
                List {
                    Section {
                        ForecastKpiGrid(forecast: forecast, floor: settings.warningFloor) { selectedMetric = $0 }
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowBackground(Color.clear)
                    } header: {
                        Text("\(forecast.weeks.count)-week forecast · tap a tile")
                    } footer: {
                        if let system = company.sourceSystem {
                            Text("Source: \(system)")
                        }
                    }

                    WeekListSection(title: "Weeks", weeks: forecast.weeks)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle(company.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .overlay { if loading && weeks.isEmpty { ProgressView() } }
        .navigationDestination(item: $selectedMetric) { metric in
            KpiDetailView(metric: metric, forecast: adjusted, title: company.displayName, floor: settings.warningFloor)
        }
        .task { await load() }
    }

    private func load(force: Bool = false) async {
        if !force, let preloaded, !preloaded.isEmpty {
            weeks = preloaded
            return
        }
        loading = true
        error = nil
        defer { loading = false }
        do {
            weeks = try await SupabaseService.shared.companyWeeks(companyId: company.id, scenario: scenario)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
