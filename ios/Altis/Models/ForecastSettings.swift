import Foundation
import SwiftUI

// MARK: - Weather rule

/// The bad-weather definition used to classify a week's weather-delay risk.
/// Mirrors the web app's CFO `weatherRiskMode` options so iOS and web agree.
enum WeatherRule: String, CaseIterable, Identifiable, Sendable {
    case rain2mm        // workdays with >= 2mm rain
    case heavy5mm       // workdays with >= 5mm rain
    case badWorkdays    // operational bad-weather workdays

    var id: String { rawValue }

    var label: String {
        switch self {
        case .rain2mm: return "Rain workdays (≥2mm)"
        case .heavy5mm: return "Heavy rain (≥5mm)"
        case .badWorkdays: return "Bad workdays"
        }
    }

    /// Plain-language threshold description for the methodology / settings copy.
    var explanation: String {
        switch self {
        case .rain2mm: return "High when 3+ workdays in a week see at least 2mm of rain."
        case .heavy5mm: return "High when 2+ workdays see 5mm of rain or more."
        case .badWorkdays: return "High when 2+ workdays meet the operational bad-weather definition."
        }
    }

    /// Short basis label used in week rows, e.g. "3 rain workdays (≥2mm)".
    var unitLabel: String {
        switch self {
        case .rain2mm: return "rain workdays (≥2mm)"
        case .heavy5mm: return "heavy-rain workdays (≥5mm)"
        case .badWorkdays: return "bad workdays"
        }
    }

    private var highThreshold: Int { self == .rain2mm ? 3 : 2 }
    private var mediumThreshold: Int { self == .rain2mm ? 2 : 1 }

    /// The metric value this rule reads off a weather week.
    func value(for week: WeatherWeek) -> Int {
        switch self {
        case .rain2mm: return week.rainDays2mm
        case .heavy5mm: return week.rainDays5mm ?? 0
        case .badWorkdays: return week.badWorkdays
        }
    }

    /// Classify a weather week's delay risk under this rule.
    func risk(for week: WeatherWeek) -> RiskLevel {
        let v = value(for: week)
        if v >= highThreshold { return .high }
        if v >= mediumThreshold { return .medium }
        return .low
    }
}

// MARK: - Settings store

/// User-tunable forecast assumptions. This is the single "Settings page" model:
/// the dashboards read these and recompute on-device, so changing a value here
/// immediately moves every KPI, chart and risk badge. Persisted to UserDefaults.
@MainActor
final class ForecastSettings: ObservableObject {

    /// Number of forecast weeks to display (slices the snapshot horizon).
    @Published var horizonWeeks: Int { didSet { persist(horizonWeeks, .horizon) } }
    /// Covenant / liquidity warning floor in euros (assumption — no bank data).
    @Published var warningFloor: Double { didSet { persist(warningFloor, .floor) } }
    /// + / − adjustment applied to the modelled opening cash (assumption).
    @Published var openingCashDelta: Double { didSet { persist(openingCashDelta, .openingDelta) } }
    /// Weekly dividend / other cash-out not present in the revenue-only source data.
    @Published var weeklyDividend: Double { didSet { persist(weeklyDividend, .dividend) } }
    /// Weather impact sensitivity (1.0 = model; >1 amplifies, <1 dampens).
    @Published var weatherSensitivity: Double { didSet { persist(weatherSensitivity, .sensitivity) } }
    /// The bad-weather definition driving weather-delay risk.
    @Published var weatherRule: WeatherRule { didSet { persist(weatherRule.rawValue, .rule) } }

    static let horizonOptions = [4, 8, 13]

    init() {
        let d = UserDefaults.standard
        horizonWeeks = Key.horizon.int(d) ?? 13
        warningFloor = Key.floor.double(d) ?? 750_000
        openingCashDelta = Key.openingDelta.double(d) ?? 0
        weeklyDividend = Key.dividend.double(d) ?? 0
        weatherSensitivity = Key.sensitivity.double(d) ?? 1.0
        weatherRule = WeatherRule(rawValue: Key.rule.string(d) ?? "") ?? .rain2mm
    }

    var isDefault: Bool {
        horizonWeeks == 13 && warningFloor == 750_000 && openingCashDelta == 0
            && weeklyDividend == 0 && weatherSensitivity == 1.0 && weatherRule == .rain2mm
    }

    func reset() {
        horizonWeeks = 13
        warningFloor = 750_000
        openingCashDelta = 0
        weeklyDividend = 0
        weatherSensitivity = 1.0
        weatherRule = .rain2mm
    }

    // MARK: persistence

    private enum Key: String {
        case horizon = "settings.horizonWeeks"
        case floor = "settings.warningFloor"
        case openingDelta = "settings.openingCashDelta"
        case dividend = "settings.weeklyDividend"
        case sensitivity = "settings.weatherSensitivity"
        case rule = "settings.weatherRule"

        func int(_ d: UserDefaults) -> Int? { d.object(forKey: rawValue) as? Int }
        func double(_ d: UserDefaults) -> Double? { d.object(forKey: rawValue) as? Double }
        func string(_ d: UserDefaults) -> String? { d.string(forKey: rawValue) }
    }

    private func persist(_ value: Any, _ key: Key) {
        UserDefaults.standard.set(value, forKey: key.rawValue)
    }
}

// MARK: - Adjusted forecast (on-device recompute)

/// Roll-up KPIs after applying the settings. Includes covenant outcome, which
/// the raw `ForecastKpis` does not (it has no floor).
struct AdjustedKpis: Sendable {
    let netCash: Double
    let totalCashIn: Double
    let totalCashOut: Double
    let minClosingCash: Double
    let minClosingWeek: String
    let endingCash: Double
    let weeksAtRisk: Int
    let covenantBreach: Bool
    let minHeadroom: Double
    let openingCash: Double
}

/// Result of applying settings to a raw snapshot: adjusted weeks (ready for the
/// existing week rows) plus the recomputed KPIs.
struct AdjustedForecast: Sendable {
    let weeks: [ForecastWeek]
    let kpis: AdjustedKpis
}

enum ForecastEngine {

    /// Apply the user's settings to a company/portfolio snapshot on-device.
    ///
    /// - opening cash is recovered from the snapshot (`closing₀ − net₀`) then
    ///   shifted by `openingCashDelta`;
    /// - weather sensitivity scales each week's embedded weather cash impact;
    /// - the weekly dividend is an extra cash-out;
    /// - closing cash, covenant headroom and risk are recomputed against the
    ///   warning floor and re-emitted as `ForecastWeek` values.
    @MainActor
    static func adjust(_ raw: [ForecastWeek], settings: ForecastSettings) -> AdjustedForecast {
        let ordered = raw.sorted { $0.weekIndex < $1.weekIndex }
        let sliced = Array(ordered.prefix(max(1, settings.horizonWeeks)))
        guard let first = sliced.first else {
            return AdjustedForecast(weeks: [], kpis: .empty)
        }

        let bakedOpening = first.closingCash - first.netCashFlow
        let opening = bakedOpening + settings.openingCashDelta
        let s = settings.weatherSensitivity
        let floor = settings.warningFloor

        var running = opening
        var weeks: [ForecastWeek] = []
        weeks.reserveCapacity(sliced.count)
        var totalIn = 0.0, totalOut = 0.0
        var minClosing = Double.greatestFiniteMagnitude
        var minWeek = first.weekStart
        var minHeadroom = Double.greatestFiniteMagnitude
        var breach = false
        var risky = 0

        for w in sliced {
            // More weather sensitivity = more cash pushed out of the week.
            let weatherExtra = (s - 1.0) * w.weatherAdjustment
            let cashIn = w.forecastCashIn + weatherExtra
            let cashOut = w.forecastCashOut + settings.weeklyDividend
            let net = cashIn - cashOut
            running += net
            let closing = running
            let headroom = closing - floor

            let liquidityRisk: RiskLevel = closing < floor ? .high
                : closing < floor * 1.25 ? .medium : .low
            // Combine the snapshot's model risk (weather + base) with the
            // settings-driven liquidity risk; the worse of the two wins.
            let combined: RiskLevel = liquidityRisk.severity >= w.risk.severity ? liquidityRisk : w.risk

            totalIn += cashIn
            totalOut += cashOut
            if closing < minClosing { minClosing = closing; minWeek = w.weekStart }
            minHeadroom = min(minHeadroom, headroom)
            if closing < floor { breach = true }
            if combined != .low { risky += 1 }

            weeks.append(ForecastWeek(
                id: w.id,
                scenario: w.scenario,
                companyId: w.companyId,
                weekStart: w.weekStart,
                weekIndex: w.weekIndex,
                isLiveWeather: w.isLiveWeather,
                forecastCashIn: cashIn,
                forecastCashOut: cashOut,
                weatherAdjustment: w.weatherAdjustment * s,
                netCashFlow: net,
                closingCash: closing,
                covenantHeadroom: headroom,
                riskLevelRaw: combined.rawValue,
                explanation: w.explanation
            ))
        }

        let kpis = AdjustedKpis(
            netCash: totalIn - totalOut,
            totalCashIn: totalIn,
            totalCashOut: totalOut,
            minClosingCash: minClosing == .greatestFiniteMagnitude ? 0 : minClosing,
            minClosingWeek: minWeek,
            endingCash: running,
            weeksAtRisk: risky,
            covenantBreach: breach,
            minHeadroom: minHeadroom == .greatestFiniteMagnitude ? 0 : minHeadroom,
            openingCash: opening
        )
        return AdjustedForecast(weeks: weeks, kpis: kpis)
    }
}

private extension AdjustedKpis {
    static let empty = AdjustedKpis(
        netCash: 0, totalCashIn: 0, totalCashOut: 0, minClosingCash: 0,
        minClosingWeek: "", endingCash: 0, weeksAtRisk: 0, covenantBreach: false,
        minHeadroom: 0, openingCash: 0
    )
}
