import Foundation
import Supabase

/// App-wide auth/session state. Drives the root switch between Login and the
/// signed-in TabView, and exposes the current user's email + role.
@MainActor
final class AppState: ObservableObject {

    enum Phase {
        case loading       // restoring a persisted session at launch
        case signedOut
        case signedIn
    }

    @Published private(set) var phase: Phase = .loading
    @Published private(set) var email: String?
    @Published private(set) var role: String?
    @Published private(set) var fullName: String?

    @Published var isAuthenticating = false
    @Published var authError: String?

    private let service = SupabaseService.shared

    /// Restore any persisted session on launch.
    func bootstrap() async {
        let defaults = UserDefaults.standard
        let autoEmail = (defaults.string(forKey: "autologinEmail") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let autoPassword = defaults.string(forKey: "autologinPassword") ?? ""

        // 1) Reuse a persisted session — but ONLY if it is still valid.
        //    supabase-swift emits the stored session even when expired
        //    (supabase/supabase-swift#822); an expired token then reads as
        //    ANONYMOUS under RLS, returning EMPTY data with no error and
        //    stranding the app on a blank "0-week" dashboard. Reject it.
        if let session = await service.currentSession(), !session.isExpired {
            await loadProfile(for: session.user)
            phase = .signedIn
            return
        }

        // 2) Automation / demo affordance: when launched with -autologinEmail /
        //    -autologinPassword (UI tests or demo capture), sign in headlessly.
        if !autoEmail.isEmpty, !autoPassword.isEmpty {
            await signIn(email: autoEmail, password: autoPassword)
            if phase == .signedIn { return }
        }

        // 3) Stale/invalid session and no autologin → drop it and show login so
        //    the user can re-authenticate (e.g. the "Explore the demo" button).
        try? await service.signOut()
        phase = .signedOut
    }

    func signIn(email: String, password: String) async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !password.isEmpty else {
            authError = "Enter your email and password."
            return
        }
        isAuthenticating = true
        authError = nil
        defer { isAuthenticating = false }
        do {
            let session = try await service.signIn(email: trimmed, password: password)
            await loadProfile(for: session.user)
            phase = .signedIn
        } catch {
            authError = Self.friendlyMessage(error)
        }
    }

    func signOut() async {
        try? await service.signOut()
        email = nil
        role = nil
        fullName = nil
        phase = .signedOut
    }

    /// Role formatted for the badge, e.g. "CFO", "Board", "Admin".
    var roleBadge: String {
        guard let role, !role.isEmpty else { return "—" }
        switch role.lowercased() {
        case "cfo": return "CFO"
        case "opco": return "OpCo"
        default: return role.prefix(1).uppercased() + role.dropFirst()
        }
    }

    // MARK: - Private

    private func loadProfile(for user: User) async {
        email = user.email
        do {
            if let profile = try await service.fetchProfile(userId: user.id) {
                role = profile.role
                fullName = profile.fullName
                if let e = profile.email { email = e }
            } else {
                role = "unknown"
            }
        } catch {
            // Reading the profile failed but auth succeeded — stay signed in.
            role = "unknown"
        }
    }

    private static func friendlyMessage(_ error: Error) -> String {
        let text = error.localizedDescription
        if text.localizedCaseInsensitiveContains("invalid")
            || text.localizedCaseInsensitiveContains("credentials") {
            return "Invalid email or password."
        }
        return text
    }
}
