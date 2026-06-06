import SwiftUI

struct CompaniesView: View {
    private let scenario: Scenario = .base
    @State private var companies: [Company] = []
    /// Cached per-company weeks for the current scenario, keyed by company id.
    @State private var weeksByCompany: [Int: [ForecastWeek]] = [:]
    @State private var loading = false
    @State private var error: String?

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
        List {
            Section("Operating companies") {
                ForEach(companies) { company in
                    NavigationLink {
                        CompanyDetailView(company: company,
                                          scenario: scenario,
                                          preloaded: weeksByCompany[company.id])
                    } label: {
                        row(for: company)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await load() }
    }

    @ViewBuilder
    private func row(for company: Company) -> some View {
        let weeks = weeksByCompany[company.id] ?? []
        let kpis = ForecastKpis(weeks: weeks)
        HStack(spacing: 12) {
            RiskDot(risk: worstRisk(weeks))
            VStack(alignment: .leading, spacing: 2) {
                Text(company.displayName)
                    .font(.subheadline.weight(.semibold))
                if let loc = company.locationName {
                    Text(loc)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(weeks.isEmpty ? "–" : Format.eurCompact(kpis.netCash))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(kpis.netCash < 0 ? .red : .green)
                Text("13-wk net")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }

    private func worstRisk(_ weeks: [ForecastWeek]) -> RiskLevel {
        weeks.map(\.risk).max(by: { $0.severity < $1.severity }) ?? .low
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
            // Fetch each company's weeks for this scenario concurrently.
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

/// One company's 13-week list for the selected scenario.
struct CompanyDetailView: View {
    let company: Company
    let scenario: Scenario
    let preloaded: [ForecastWeek]?

    @State private var weeks: [ForecastWeek] = []
    @State private var loading = false
    @State private var error: String?

    private var kpis: ForecastKpis { ForecastKpis(weeks: weeks) }

    var body: some View {
        List {
            if let error, weeks.isEmpty {
                ErrorState(message: error) { Task { await load(force: true) } }
            } else {
                Section {
                    LabeledContent("Forecast", value: "Live weather")
                    LabeledContent("13-week net") {
                        Text(Format.signedEur(kpis.netCash))
                            .foregroundStyle(kpis.netCash < 0 ? .red : .green)
                    }
                    LabeledContent("Min closing",
                                   value: "\(Format.eurCompact(kpis.minClosingCash))"
                                   + (kpis.minClosingWeek.isEmpty ? "" : " · wk \(Format.weekShort(kpis.minClosingWeek))"))
                    LabeledContent("Weeks at risk", value: "\(kpis.weeksAtRisk) of \(weeks.count)")
                } header: {
                    Text(company.name)
                } footer: {
                    if let system = company.sourceSystem {
                        Text("Source: \(system)")
                    }
                }

                WeekListSection(title: "Weeks", weeks: weeks)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(company.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if loading && weeks.isEmpty { ProgressView() }
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
