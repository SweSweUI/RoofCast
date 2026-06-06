import SwiftUI

/// A portfolio / company KPI tile the user can drill into.
enum PortfolioMetric: String, Identifiable, Hashable {
    case netCash, minClosing, cashIn, cashOut, covenant, weeksAtRisk
    var id: String { rawValue }

    var title: String {
        switch self {
        case .netCash: return "Net cash flow"
        case .minClosing: return "Closing cash"
        case .cashIn: return "Cash in"
        case .cashOut: return "Cash out"
        case .covenant: return "Covenant headroom"
        case .weeksAtRisk: return "Weeks at risk"
        }
    }

    var blurb: String {
        switch self {
        case .netCash: return "Weekly cash in minus cash out, after weather timing and assumptions."
        case .minClosing: return "Running closing cash from opening cash. The low point drives covenant risk."
        case .cashIn: return "Facturation collected on the debtor-payment profile, shifted by weather."
        case .cashOut: return "Modelled cost drivers plus the weekly dividend / other-outflow assumption."
        case .covenant: return "Closing cash minus the warning floor. Negative is a breach."
        case .weeksAtRisk: return "Weeks that are tight on liquidity or carry weather-delay risk."
        }
    }

    /// The per-week value to plot (nil for the non-numeric weeks-at-risk view).
    func value(_ w: ForecastWeek) -> Double? {
        switch self {
        case .netCash: return w.netCashFlow
        case .minClosing: return w.closingCash
        case .cashIn: return w.forecastCashIn
        case .cashOut: return w.forecastCashOut
        case .covenant: return w.covenantHeadroom
        case .weeksAtRisk: return nil
        }
    }

    /// Whether negative values are meaningful (signed) for this metric.
    var signed: Bool { self == .netCash || self == .covenant }
}

/// Per-week breakdown for one KPI tile: a headline, a metric-specific detail
/// section ("more info about that data"), and a proportional per-week bar chart.
struct KpiDetailView: View {
    let metric: PortfolioMetric
    let forecast: AdjustedForecast
    let title: String
    var floor: Double = 0

    var body: some View {
        List {
            Section {
                LabeledContent(headlineLabel, value: headlineValue)
                    .font(.headline)
            } footer: {
                Text(metric.blurb)
            }

            Section("Breakdown") {
                ForEach(summaryRows, id: \.0) { row in
                    LabeledContent(row.0, value: row.1)
                }
            }

            Section(metric == .weeksAtRisk ? "Risk by week" : "By week") {
                ForEach(forecast.weeks) { week in
                    if metric == .weeksAtRisk {
                        riskRow(week)
                    } else {
                        barRow(week)
                    }
                }
            }
        }
        .navigationTitle(metric.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: headline

    private var headlineLabel: String { "\(title) · \(forecast.weeks.count) wk" }

    private var headlineValue: String {
        let k = forecast.kpis
        switch metric {
        case .netCash: return Format.signedEur(k.netCash)
        case .minClosing: return Format.eur(k.minClosingCash)
        case .cashIn: return Format.eur(k.totalCashIn)
        case .cashOut: return Format.eur(k.totalCashOut)
        case .covenant: return Format.signedEur(k.minHeadroom)
        case .weeksAtRisk: return "\(k.weeksAtRisk) of \(forecast.weeks.count)"
        }
    }

    // MARK: metric-specific detail rows

    private var summaryRows: [(String, String)] {
        let k = forecast.kpis
        let n = Double(max(1, forecast.weeks.count))
        switch metric {
        case .netCash:
            return [("Opening cash", Format.eur(k.openingCash)),
                    ("Cash in", Format.eur(k.totalCashIn)),
                    ("Cash out", Format.eur(k.totalCashOut)),
                    ("Net", Format.signedEur(k.netCash)),
                    ("Ending cash", Format.eur(k.endingCash))]
        case .minClosing:
            return [("Lowest week", k.minClosingWeek.isEmpty ? "–" : Format.dateLong(k.minClosingWeek)),
                    ("Lowest closing", Format.eur(k.minClosingCash)),
                    ("Opening cash", Format.eur(k.openingCash)),
                    ("Ending cash", Format.eur(k.endingCash)),
                    ("Covenant", k.covenantBreach ? "Breaches floor" : "Headroom \(Format.eurCompact(k.minHeadroom))")]
        case .cashIn:
            let peak = forecast.weeks.max(by: { $0.forecastCashIn < $1.forecastCashIn })
            return [("Total", Format.eur(k.totalCashIn)),
                    ("Weekly average", Format.eur(k.totalCashIn / n)),
                    ("Peak week", peak.map { "\(Format.weekShort($0.weekStart)) · \(Format.eurCompact($0.forecastCashIn))" } ?? "–"),
                    ("Live-weather weeks", "\(forecast.weeks.filter(\.isLive).count) of \(Int(n))")]
        case .cashOut:
            let peak = forecast.weeks.max(by: { $0.forecastCashOut < $1.forecastCashOut })
            return [("Total", Format.eur(k.totalCashOut)),
                    ("Weekly average", Format.eur(k.totalCashOut / n)),
                    ("Peak week", peak.map { "\(Format.weekShort($0.weekStart)) · \(Format.eurCompact($0.forecastCashOut))" } ?? "–"),
                    ("Includes", "Modelled drivers + dividend assumption")]
        case .covenant:
            let breaches = forecast.weeks.filter { $0.closingCash < floor }.count
            return [("Warning floor", Format.eur(floor)),
                    ("Min headroom", Format.signedEur(k.minHeadroom)),
                    ("Breach weeks", "\(breaches) of \(Int(n))"),
                    ("Status", k.covenantBreach ? "Breaches floor" : "Within headroom")]
        case .weeksAtRisk:
            let high = forecast.weeks.filter { $0.risk == .high }.count
            let med = forecast.weeks.filter { $0.risk == .medium }.count
            return [("At risk", "\(k.weeksAtRisk) of \(Int(n))"),
                    ("High risk", "\(high)"),
                    ("Medium risk", "\(med)"),
                    ("Drivers", "Liquidity vs floor + weather delay")]
        }
    }

    private var maxMagnitude: Double {
        let values = forecast.weeks.compactMap { metric.value($0) }.map(abs)
        return max(values.max() ?? 1, 1)
    }

    // MARK: rows

    private func barRow(_ week: ForecastWeek) -> some View {
        let value = metric.value(week) ?? 0
        let fraction = min(1, abs(value) / maxMagnitude)
        let isLow = metric == .minClosing && week.weekStart == forecast.kpis.minClosingWeek
        let negative = value < 0
        let color: Color = negative ? .red : (isLow ? .orange : .accentColor)
        return VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(Format.weekRange(week.weekStart))
                    .font(.subheadline.weight(.medium))
                if week.isLive {
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                Text(metric.signed ? Format.signedEur(value) : Format.eur(value))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(negative ? .red : .primary)
            }
            BarTrack(fraction: fraction, color: color)
        }
        .padding(.vertical, 3)
    }

    private func riskRow(_ week: ForecastWeek) -> some View {
        HStack(spacing: 12) {
            RiskDot(risk: week.risk)
            Text(Format.weekRange(week.weekStart)).font(.subheadline.weight(.medium))
            Spacer()
            Text("closing \(Format.eurCompact(week.closingCash))")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            RiskBadge(risk: week.risk)
        }
        .padding(.vertical, 2)
    }
}

/// Six tappable KPI widgets for a forecast (portfolio or one company). Tapping a
/// tile reports the chosen metric to the parent, which drives a single
/// `navigationDestination` — so exactly one detail opens, with no list chevrons.
struct ForecastKpiGrid: View {
    let forecast: AdjustedForecast
    let floor: Double
    let onSelect: (PortfolioMetric) -> Void

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        let k = forecast.kpis
        LazyVGrid(columns: columns, spacing: 12) {
            tile(.netCash) {
                KpiCard(title: "Net cash", value: Format.eurCompact(k.netCash),
                        systemImage: "arrow.left.arrow.right", tint: k.netCash < 0 ? .red : .green)
            }
            tile(.minClosing) {
                KpiCard(title: "Min closing", value: Format.eurCompact(k.minClosingCash),
                        subtitle: k.minClosingWeek.isEmpty ? nil : "wk \(Format.weekShort(k.minClosingWeek))",
                        systemImage: "arrow.down.to.line", tint: k.covenantBreach ? .red : .primary)
            }
            tile(.cashIn) {
                KpiCard(title: "Cash in", value: Format.eurCompact(k.totalCashIn),
                        systemImage: "arrow.down.circle", tint: .green)
            }
            tile(.cashOut) {
                KpiCard(title: "Cash out", value: Format.eurCompact(k.totalCashOut),
                        systemImage: "arrow.up.circle", tint: .secondary)
            }
            tile(.covenant) {
                KpiCard(title: "Covenant", value: k.covenantBreach ? "Breach" : "Headroom",
                        subtitle: "floor \(Format.eurCompact(floor))",
                        systemImage: "checkmark.shield", tint: k.covenantBreach ? .red : .green)
            }
            tile(.weeksAtRisk) {
                KpiCard(title: "Weeks at risk", value: "\(k.weeksAtRisk)",
                        subtitle: "of \(forecast.weeks.count)",
                        systemImage: "exclamationmark.triangle",
                        tint: k.weeksAtRisk > 0 ? .orange : .green)
            }
        }
    }

    private func tile<Content: View>(_ metric: PortfolioMetric,
                                     @ViewBuilder label: () -> Content) -> some View {
        Button { onSelect(metric) } label: { label() }
            .buttonStyle(.plain)
    }
}

/// A thin proportional bar used in the KPI breakdown.
private struct BarTrack: View {
    let fraction: Double
    let color: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color(.quaternaryLabel).opacity(0.4))
                Capsule().fill(color)
                    .frame(width: max(2, geo.size.width * fraction))
            }
        }
        .frame(height: 7)
    }
}
