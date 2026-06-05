import SwiftUI

/// A single 13-week list row: week range, cash-in/out, net, closing, risk.
/// Tapping pushes the explanation detail for traceability.
struct WeekRow: View {
    let week: ForecastWeek

    var body: some View {
        NavigationLink {
            WeekDetailView(week: week)
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(Format.weekRange(week.weekStart))
                        .font(.subheadline.weight(.semibold))
                    if week.isLive {
                        Image(systemName: "dot.radiowaves.left.and.right")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel("Live weather")
                    }
                    Spacer()
                    RiskBadge(risk: week.risk)
                }
                HStack(spacing: 12) {
                    metric("In", Format.eurCompact(week.forecastCashIn), .secondary)
                    metric("Out", Format.eurCompact(week.forecastCashOut), .secondary)
                    metric("Net", Format.signedEur(week.netCashFlow),
                           week.netCashFlow < 0 ? .red : .green)
                    Spacer()
                    metric("Closing", Format.eurCompact(week.closingCash), .primary)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func metric(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.tertiary)
            Text(value)
                .font(.caption.weight(.medium))
                .foregroundStyle(tint)
        }
    }
}

/// Explanation + full numbers for one forecast week (traceability view).
struct WeekDetailView: View {
    let week: ForecastWeek

    var body: some View {
        List {
            Section {
                LabeledContent("Cash in", value: Format.eur(week.forecastCashIn))
                LabeledContent("Cash out", value: Format.eur(week.forecastCashOut))
                LabeledContent("Net cash flow", value: Format.signedEur(week.netCashFlow))
                LabeledContent("Closing cash", value: Format.eur(week.closingCash))
                if let headroom = week.covenantHeadroom {
                    LabeledContent("Covenant headroom", value: Format.eur(headroom))
                }
                LabeledContent("Risk") { RiskBadge(risk: week.risk) }
                LabeledContent("Live weather", value: week.isLive ? "Yes" : "No")
            } header: {
                Text("Week \(week.weekIndex) · \(Format.weekRange(week.weekStart))")
            }

            if let explanation = week.explanation, !explanation.isEmpty {
                Section("Explanation") {
                    Text(explanation)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                }
            }
        }
        .navigationTitle(Format.weekShort(week.weekStart))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The shared 13-week section used by both Portfolio and Company detail.
struct WeekListSection: View {
    let title: String
    let weeks: [ForecastWeek]

    var body: some View {
        Section(title) {
            ForEach(weeks) { WeekRow(week: $0) }
        }
    }
}
