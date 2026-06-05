import SwiftUI

// MARK: - Risk badge

/// Small colored capsule for a risk level.
struct RiskBadge: View {
    let risk: RiskLevel
    var compact = false

    var body: some View {
        Text(compact ? String(risk.label.prefix(1)) : risk.label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(risk.color)
            .padding(.horizontal, compact ? 6 : 8)
            .padding(.vertical, 3)
            .background(risk.color.opacity(0.15), in: Capsule())
            .accessibilityLabel("\(risk.label) risk")
    }
}

/// A filled dot indicator for risk (used in dense list rows).
struct RiskDot: View {
    let risk: RiskLevel
    var body: some View {
        Circle()
            .fill(risk.color)
            .frame(width: 10, height: 10)
            .accessibilityLabel("\(risk.label) risk")
    }
}

// MARK: - KPI card

/// Compact metric tile for the KPI grid.
struct KpiCard: View {
    let title: String
    let value: String
    var subtitle: String?
    var systemImage: String
    var tint: Color = .accentColor

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
                .labelStyle(.titleAndIcon)
                .lineLimit(1)
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(tint)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            if let subtitle {
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - States

/// Inline error row with a retry button.
struct ErrorState: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Retry", action: retry)
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding()
    }
}

// MARK: - Data-handling notice

/// The mandatory hackathon data-handling reminder. Shown on Login and About.
struct DataHandlingNotice: View {
    var body: some View {
        Label {
            Text("Altis data is anonymised and for the hackathon only — delete within 3 days.")
        } icon: {
            Image(systemName: "exclamationmark.shield")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.leading)
    }
}
