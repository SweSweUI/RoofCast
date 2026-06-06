import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var appState: AppState

    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Field?

    private enum Field { case email, password }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 24) {
                header

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .focused($focus, equals: .email)
                        .onSubmit { focus = .password }
                        .padding(12)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))

                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .focused($focus, equals: .password)
                        .onSubmit(submit)
                        .padding(12)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
                }

                if let error = appState.authError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .transition(.opacity)
                }

                Button(action: submit) {
                    HStack {
                        if appState.isAuthenticating {
                            ProgressView().controlSize(.small)
                        }
                        Text(appState.isAuthenticating ? "Signing in…" : "Sign in")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .disabled(appState.isAuthenticating)

                // One-tap demo: signs in with the read-only CFO demo account so
                // reviewers can see live data without typing credentials.
                Button(action: demoLogin) {
                    Text("Explore the demo")
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
                .disabled(appState.isAuthenticating)

                Text("Signs in with the CFO demo account — full live dashboard, read-only.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 28)

            Spacer(minLength: 0)

            DataHandlingNotice()
                .padding(.horizontal, 28)
                .padding(.bottom, 20)
        }
        .background(Color(.systemBackground))
        .onAppear { focus = .email }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "cloud.sun.rain")
                .font(.system(size: 44, weight: .regular))
                .foregroundStyle(.tint)
            Text("Altis")
                .font(.largeTitle.weight(.bold))
            Text("Weather-aware cashflow")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func submit() {
        focus = nil
        Task { await appState.signIn(email: email, password: password) }
    }

    private func demoLogin() {
        focus = nil
        email = DemoLogin.email
        password = DemoLogin.password
        Task { await appState.signIn(email: DemoLogin.email, password: DemoLogin.password) }
    }
}

/// Shared, read-only demo account used by the "Explore the demo" button.
/// These credentials are intentionally public (RLS restricts the data to
/// anonymised, company-level analytics).
enum DemoLogin {
    static let email = "cfo@altis.demo"
    static let password = "AltisDemo!2026"
}
