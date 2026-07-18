import SwiftUI

struct SignedInAccountView: View {
    @Bindable var viewModel: AccountViewModel
    @Bindable var nativeNotificationViewModel: NativeNotificationViewModel
    let user: AccountUser
    @State private var showsDeleteConfirmation = false

    var body: some View {
        Form {
            Section {
                Text(greeting)
                    .font(.title2)
                    .fontDesign(.serif)
                    .bold()
                    .foregroundStyle(MedarioTheme.navy)
                    .accessibilityAddTraits(.isHeader)
                Text("Suas preferências e buscas podem ficar vinculadas à sua conta.")
                    .foregroundStyle(.secondary)
            }

            profileContent

            NativeNotificationPreferencesView(viewModel: nativeNotificationViewModel)

            Section("E-mail") {
                Label(
                    user.emailVerified ? "E-mail confirmado" : "Confirmação pendente",
                    systemImage: user.emailVerified ? "checkmark.seal.fill" : "envelope.badge"
                )
                .foregroundStyle(user.emailVerified ? Color.green : Color.secondary)

                if !user.emailVerified {
                    Text("Confirme o link enviado para reservar ou remarcar consultas.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Já confirmei — atualizar", systemImage: "arrow.clockwise") {
                        Task { await viewModel.refreshEmailVerification() }
                    }
                    .disabled(viewModel.isRefreshingEmailVerification)
                }
            }

            if viewModel.deletionState == .reauthenticationRequired {
                ReauthenticationView(viewModel: viewModel)
            }

            if let feedback = viewModel.feedback {
                Section {
                    AccountStatusView(feedback: feedback)
                }
            }

            Section("Sessão") {
                Button("Sair", systemImage: "rectangle.portrait.and.arrow.right", action: signOut)
                    .disabled(viewModel.isSigningOut || viewModel.deletionState == .deleting)

                Button("Excluir conta", systemImage: "trash", role: .destructive) {
                    showsDeleteConfirmation = true
                }
                .disabled(viewModel.deletionState == .deleting)
                .confirmationDialog(
                    "Excluir conta e dados sincronizados?",
                    isPresented: $showsDeleteConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Excluir definitivamente", role: .destructive, action: deleteAccount)
                    Button("Cancelar", role: .cancel) {}
                } message: {
                    Text("O servidor apaga os dados vinculados e remove sua conta ao final. Esta ação não pode ser desfeita.")
                }
            }
        }
        .onChange(of: viewModel.healthConsent) {
            Task { await viewModel.persistHealthConsentChange() }
        }
    }

    @ViewBuilder
    private var profileContent: some View {
        switch viewModel.profileState {
        case .idle, .loading:
            Section {
                ProgressView("Carregando preferências…")
            }
        case .failed:
            Section {
                ContentUnavailableView {
                    Label("Preferências indisponíveis", systemImage: "wifi.exclamationmark")
                } description: {
                    Text("Sua sessão continua ativa.")
                } actions: {
                    Button("Tentar novamente", action: retryProfile)
                }
            }
        case .loaded:
            AccountPreferencesView(viewModel: viewModel)
            HealthConsentView(viewModel: viewModel)
        }
    }

    private var greeting: String {
        let preferredName = user.displayName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = user.email?.split(separator: "@").first.map(String.init)
        let name = if let preferredName, !preferredName.isEmpty {
            preferredName
        } else {
            fallback ?? "paciente"
        }
        return "Olá, \(name)."
    }

    private func retryProfile() {
        Task { await viewModel.loadProfile() }
    }

    private func signOut() {
        Task { await viewModel.signOut() }
    }

    private func deleteAccount() {
        Task { await viewModel.deleteAccount() }
    }
}
