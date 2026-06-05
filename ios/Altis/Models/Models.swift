import Foundation
import SwiftUI

// MARK: - Scenario

/// Forecast scenario. Mirrors `altis_forecast_weeks.scenario`.
enum Scenario: String, CaseIterable, Identifiable, Sendable {
    case base
    case wetQuarter = "wet_quarter"
    case dryQuarter = "dry_quarter"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .base: return "Base"
        case .wetQuarter: return "Wet quarter"
        case .dryQuarter: return "Dry quarter"
        }
    }
}

// MARK: - Risk

/// Risk band. Mirrors the `risk_level` text column ('low'|'medium'|'high').
/// Unknown / null values degrade gracefully to `.low`.
enum RiskLevel: String, Sendable {
    case low
    case medium
    case high

    init(_ raw: String?) {
        switch raw?.lowercased() {
        case "high": self = .high
        case "medium": self = .medium
        default: self = .low
        }
    }

    var color: Color {
        switch self {
        case .low: return .green
        case .medium: return .orange
        case .high: return .red
        }
    }

    var label: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        }
    }

    /// Sort weight so high-risk items can be surfaced first.
    var severity: Int {
        switch self {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        }
    }
}

// MARK: - Profile

/// Row from `altis_profiles` for the signed-in user.
struct Profile: Decodable, Sendable {
    let userId: String
    let email: String?
    let role: String
    let fullName: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case email
        case role
        case fullName = "full_name"
    }
}

// MARK: - Company

/// Row from `altis_companies` (only the columns the app reads).
struct Company: Decodable, Identifiable, Sendable {
    let id: Int
    let code: String?
    let shortName: String?
    let name: String
    let locationName: String?
    let sourceSystem: String?
    let weatherLocationId: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case code
        case shortName = "short_name"
        case name
        case locationName = "location_name"
        case sourceSystem = "source_system"
        case weatherLocationId = "weather_location_id"
    }

    /// Display name preferring the short label.
    var displayName: String { shortName?.isEmpty == false ? shortName! : name }
}

// MARK: - Forecast week

/// Row from `altis_forecast_weeks`. Money columns are numeric -> Double.
/// `covenantHeadroom` is nullable; `companyId == nil` means the portfolio roll-up.
struct ForecastWeek: Decodable, Identifiable, Sendable {
    let id: Int
    let scenario: String
    let companyId: Int?
    let weekStart: String
    let weekIndex: Int
    let isLiveWeather: Int
    let forecastCashIn: Double
    let forecastCashOut: Double
    let netCashFlow: Double
    let closingCash: Double
    let covenantHeadroom: Double?
    let riskLevelRaw: String?
    let explanation: String?

    enum CodingKeys: String, CodingKey {
        case id
        case scenario
        case companyId = "company_id"
        case weekStart = "week_start"
        case weekIndex = "week_index"
        case isLiveWeather = "is_live_weather"
        case forecastCashIn = "forecast_cash_in"
        case forecastCashOut = "forecast_cash_out"
        case netCashFlow = "net_cash_flow"
        case closingCash = "closing_cash"
        case covenantHeadroom = "covenant_headroom"
        case riskLevelRaw = "risk_level"
        case explanation
    }

    var risk: RiskLevel { RiskLevel(riskLevelRaw) }
    var isLive: Bool { isLiveWeather != 0 }
}

// MARK: - Weather week

/// Row from `altis_weather_weekly`. `is_forecast` ordered first in the UI.
struct WeatherWeek: Decodable, Identifiable, Sendable {
    let locationId: Int
    let weekStart: String
    let rainDays2mm: Int
    let badWorkdays: Int
    let delayScore: Double
    let isForecast: Int

    enum CodingKeys: String, CodingKey {
        case locationId = "location_id"
        case weekStart = "week_start"
        case rainDays2mm = "rain_days_2mm"
        case badWorkdays = "bad_workdays"
        case delayScore = "delay_score"
        case isForecast = "is_forecast"
    }

    // Stable identity: location + week is the table's composite PK.
    var id: String { "\(locationId)-\(weekStart)" }

    var isForecastFlag: Bool { isForecast != 0 }

    /// Risk derived from rain workdays: >=3 high, ==2 medium, else low.
    var risk: RiskLevel {
        if rainDays2mm >= 3 { return .high }
        if rainDays2mm == 2 { return .medium }
        return .low
    }
}

// MARK: - Derived portfolio KPIs

/// 13-week KPIs computed client-side from a set of forecast weeks.
struct ForecastKpis: Sendable {
    let netCash: Double
    let totalCashIn: Double
    let totalCashOut: Double
    let minClosingCash: Double
    let minClosingWeek: String
    let weeksAtRisk: Int

    /// Compute roll-ups over an ordered set of weeks (any company or portfolio).
    init(weeks: [ForecastWeek]) {
        netCash = weeks.reduce(0) { $0 + $1.netCashFlow }
        totalCashIn = weeks.reduce(0) { $0 + $1.forecastCashIn }
        totalCashOut = weeks.reduce(0) { $0 + $1.forecastCashOut }
        weeksAtRisk = weeks.filter { $0.risk != .low }.count
        if let trough = weeks.min(by: { $0.closingCash < $1.closingCash }) {
            minClosingCash = trough.closingCash
            minClosingWeek = trough.weekStart
        } else {
            minClosingCash = 0
            minClosingWeek = ""
        }
    }
}
