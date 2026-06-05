import SwiftUI

@main
struct AltisApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .task { await appState.bootstrap() }
        }
    }
}

/// Switches between Login and the signed-in shell based on auth phase.
struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        switch appState.phase {
        case .loading:
            ProgressView("Restoring session…")
                .controlSize(.large)
        case .signedOut:
            LoginView()
        case .signedIn:
            MainTabView()
        }
    }
}
