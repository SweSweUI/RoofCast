import Foundation
import Supabase

/// Thin wrapper over the supabase-swift client. One shared instance; the SDK
/// persists the auth session to the keychain automatically.
///
/// All reads go through PostgREST. RLS grants `select` to any authenticated
/// user (`using (true)`), so once signed in every table below is readable.
struct SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        guard let url = URL(string: Secrets.supabaseURL) else {
            fatalError("Invalid Secrets.supabaseURL — check Altis/Secrets.swift")
        }
        client = SupabaseClient(supabaseURL: url, supabaseKey: Secrets.supabaseAnonKey)
    }

    // MARK: - Auth

    @discardableResult
    func signIn(email: String, password: String) async throws -> Session {
        try await client.auth.signIn(email: email, password: password)
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    /// Restore a persisted session on launch, if one exists.
    func currentSession() async -> Session? {
        try? await client.auth.session
    }

    // MARK: - Profile (RBAC)

    /// The signed-in user's `altis_profiles` row (carries their role).
    func fetchProfile(userId: UUID) async throws -> Profile? {
        let rows: [Profile] = try await client
            .from("altis_profiles")
            .select("user_id,email,role,full_name")
            .eq("user_id", value: userId.uuidString)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    // MARK: - Forecast

    /// Portfolio forecast (company_id IS NULL) for a scenario, ordered by week.
    func portfolioWeeks(scenario: Scenario) async throws -> [ForecastWeek] {
        try await client
            .from("altis_forecast_weeks")
            .select()
            .eq("scenario", value: scenario.rawValue)
            .is("company_id", value: nil)
            .order("week_index")
            .execute()
            .value
    }

    /// A single company's forecast for a scenario, ordered by week.
    func companyWeeks(companyId: Int, scenario: Scenario) async throws -> [ForecastWeek] {
        try await client
            .from("altis_forecast_weeks")
            .select()
            .eq("scenario", value: scenario.rawValue)
            .eq("company_id", value: companyId)
            .order("week_index")
            .execute()
            .value
    }

    // MARK: - Companies

    func companies() async throws -> [Company] {
        try await client
            .from("altis_companies")
            .select("id,code,short_name,name,location_name,source_system,weather_location_id")
            .order("id")
            .execute()
            .value
    }

    // MARK: - Weather

    /// Weekly weather for a location, forecast rows first then by week.
    func weather(locationId: Int) async throws -> [WeatherWeek] {
        try await client
            .from("altis_weather_weekly")
            .select("location_id,week_start,rain_days_2mm,bad_workdays,delay_score,is_forecast")
            .eq("location_id", value: locationId)
            .order("is_forecast", ascending: false)
            .order("week_start")
            .execute()
            .value
    }
}
