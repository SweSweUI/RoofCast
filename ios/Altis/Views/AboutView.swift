import SwiftUI

struct AboutView: View {
    @EnvironmentObject private var appState: AppState
    @State private var signingOut = false

    var body: some View {
        NavigationStack {
            List {
                Section("Signed in") {
                    LabeledContent("Email", value: appState.email ?? "—")
                    if let name = appState.fullName, !name.isEmpty {
                        LabeledContent("Name", value: name)
                    }
                    LabeledContent("Role") {
                        Text(appState.roleBadge)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.accentColor.opacity(0.15), in: Capsule())
                            .foregroundStyle(Color.accentColor)
                    }
                }

                Section("Data handling") {
                    DataHandlingNotice()
                        .padding(.vertical, 4)
                }

                Section("About") {
                    LabeledContent("App", value: "Altis")
                    LabeledContent("Purpose", value: "Weather-aware cashflow")
                    Text("Reads precomputed 13-week forecasts from the shared Supabase backend. Any authenticated user may read; row-level security applies.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button(role: .destructive) {
                        signingOut = true
                        Task {
                            await appState.signOut()
                            signingOut = false
                        }
                    } label: {
                        HStack {
                            if signingOut { ProgressView().controlSize(.small) }
                            Text("Sign out")
                            Spacer()
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                        }
                    }
                    .disabled(signingOut)
                }
            }
            .navigationTitle("About")
        }
    }
}
