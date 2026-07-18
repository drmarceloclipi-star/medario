import Foundation
import Observation

@MainActor
@Observable
final class AccountViewModel {
    private let repository: any AccountRepository
    @ObservationIgnored private var subscription: (any AccountSessionSubscription)?
    @ObservationIgnored private var loadedUserID: String?
    @ObservationIgnored private var persistedHealthConsent = false
    @ObservationIgnored private var profileLoadGeneration = 0

    private(set) var session: AccountSession
    private(set) var profileState: AccountProfileState = .idle
    private(set) var deletionState: AccountDeletionState = .idle
    private(set) var isAuthenticating = false
    private(set) var isSavingPreferences = false
    private(set) var isUpdatingConsent = false
    private(set) var isSigningOut = false
    private(set) var isRefreshingEmailVerification = false
    private(set) var feedback: AccountFeedback?

    var mode: AccountMode = .signIn
    var email = ""
    var password = ""
    var reauthenticationPassword = ""
    var preferences = AccountPreferences()
    var healthConsent = false

    init(repository: any AccountRepository) {
        self.repository = repository
        session = repository.currentSession
        subscription = repository.subscribe { [weak self] nextSession in
            self?.receive(nextSession)
        }
    }

    func toggleMode() {
        mode = mode == .signIn ? .register : .signIn
        password = ""
        feedback = nil
    }

    func authenticate() async {
        guard !isAuthenticating else { return }
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedEmail.contains("@"), normalizedEmail.contains(".") else {
            feedback = .init(kind: .error, message: "Digite um e-mail válido.")
            return
        }
        guard password.count >= 6 else {
            feedback = .init(kind: .error, message: "A senha precisa ter pelo menos 6 caracteres.")
            return
        }

        isAuthenticating = true
        feedback = nil
        defer { isAuthenticating = false }
        do {
            if mode == .register {
                try await repository.createPatientAccount(email: normalizedEmail, password: password)
                feedback = .init(kind: .success, message: "Conta criada. Enviamos um link para confirmar seu e-mail antes do primeiro agendamento.")
            } else {
                try await repository.signIn(email: normalizedEmail, password: password)
                feedback = .init(kind: .success, message: "Login realizado.")
            }
            password = ""
        } catch {
            feedback = feedback(for: error, operation: .authentication)
        }
    }

    func loadProfile() async {
        guard case let .signedIn(user) = session else { return }
        profileLoadGeneration += 1
        await loadProfile(userID: user.id, generation: profileLoadGeneration)
    }

    private func loadProfile(userID: String, generation: Int) async {
        profileState = .loading
        do {
            let profile = try await repository.profile()
            guard isCurrentProfileLoad(userID: userID, generation: generation) else { return }
            preferences = profile.preferences
            healthConsent = profile.healthConsent
            persistedHealthConsent = profile.healthConsent
            profileState = .loaded
        } catch {
            guard isCurrentProfileLoad(userID: userID, generation: generation) else { return }
            profileState = .failed
            feedback = .init(kind: .error, message: "Conta conectada; preferências indisponíveis. Tente novamente.")
        }
    }

    func savePreferences() async {
        guard !isSavingPreferences else { return }
        isSavingPreferences = true
        feedback = nil
        defer { isSavingPreferences = false }
        do {
            try await repository.updatePreferences(preferences)
            feedback = .init(kind: .success, message: "Preferências salvas.")
        } catch {
            feedback = feedback(for: error, operation: .preferences)
        }
    }

    func persistHealthConsentChange() async {
        guard profileState == .loaded,
              healthConsent != persistedHealthConsent,
              !isUpdatingConsent else { return }
        let requestedValue = healthConsent
        isUpdatingConsent = true
        feedback = nil
        defer { isUpdatingConsent = false }
        do {
            try await repository.setHealthConsent(requestedValue)
            persistedHealthConsent = requestedValue
            feedback = .init(
                kind: .success,
                message: requestedValue ? "Consentimento registrado." : "Consentimento revogado."
            )
        } catch {
            healthConsent = persistedHealthConsent
            feedback = feedback(for: error, operation: .consent)
        }
    }

    func signOut() async {
        guard !isSigningOut else { return }
        isSigningOut = true
        feedback = nil
        defer { isSigningOut = false }
        do {
            try await repository.signOut()
        } catch {
            feedback = .init(kind: .error, message: "Não foi possível sair. Tente novamente.")
        }
    }

    func refreshEmailVerification() async {
        guard !isRefreshingEmailVerification else { return }
        isRefreshingEmailVerification = true
        feedback = nil
        defer { isRefreshingEmailVerification = false }
        do {
            try await repository.refreshEmailVerification()
            receive(repository.currentSession)
            if case let .signedIn(user) = repository.currentSession, user.emailVerified {
                feedback = .init(kind: .success, message: "E-mail confirmado. Agendamentos liberados.")
            } else {
                feedback = .init(kind: .information, message: "Confirmação ainda não localizada. Abra o link recebido e tente novamente.")
            }
        } catch {
            feedback = .init(kind: .error, message: "Não foi possível atualizar a confirmação do e-mail.")
        }
    }

    func deleteAccount() async {
        guard deletionState != .deleting else { return }
        deletionState = .deleting
        feedback = nil
        do {
            try await repository.deleteAccount()
            deletionState = .idle
            feedback = .init(kind: .success, message: "Conta e dados vinculados excluídos.")
        } catch AccountRepositoryError.reauthenticationRequired {
            deletionState = .reauthenticationRequired
            feedback = .init(
                kind: .information,
                message: "Por segurança, confirme sua senha para excluir a conta. Nenhum dado foi apagado ainda."
            )
        } catch {
            deletionState = .idle
            feedback = feedback(for: error, operation: .deletion)
        }
    }

    func reauthenticateAndDelete() async {
        guard deletionState == .reauthenticationRequired else { return }
        guard !reauthenticationPassword.isEmpty else {
            feedback = .init(kind: .error, message: "Digite sua senha para confirmar a exclusão.")
            return
        }
        deletionState = .deleting
        feedback = nil
        do {
            try await repository.reauthenticateAndDelete(password: reauthenticationPassword)
            reauthenticationPassword = ""
            deletionState = .idle
            feedback = .init(kind: .success, message: "Conta e dados vinculados excluídos.")
        } catch AccountRepositoryError.invalidCredentials {
            deletionState = .reauthenticationRequired
            feedback = .init(kind: .error, message: "Senha incorreta. Sua conta não foi excluída.")
        } catch {
            deletionState = .reauthenticationRequired
            feedback = feedback(for: error, operation: .deletion)
        }
    }

    func cancelReauthentication() {
        reauthenticationPassword = ""
        deletionState = .idle
        feedback = .init(kind: .information, message: "Exclusão cancelada. Sua conta permanece ativa.")
    }

    func clearFeedback() {
        feedback = nil
    }

    private func receive(_ nextSession: AccountSession) {
        session = nextSession
        switch nextSession {
        case let .signedIn(user):
            guard loadedUserID != user.id else { return }
            loadedUserID = user.id
            profileLoadGeneration += 1
            let generation = profileLoadGeneration
            Task { await loadProfile(userID: user.id, generation: generation) }
        case .loading:
            profileLoadGeneration += 1
            profileState = .idle
        case .signedOut:
            profileLoadGeneration += 1
            loadedUserID = nil
            profileState = .idle
            deletionState = .idle
            preferences = AccountPreferences()
            healthConsent = false
            persistedHealthConsent = false
            password = ""
            reauthenticationPassword = ""
        }
    }

    private func isCurrentProfileLoad(userID: String, generation: Int) -> Bool {
        guard generation == profileLoadGeneration,
              case let .signedIn(user) = session else { return false }
        return user.id == userID
    }

    private func feedback(for error: Error, operation: Operation) -> AccountFeedback {
        guard let accountError = error as? AccountRepositoryError else {
            return .init(kind: .error, message: operation.genericFailureMessage)
        }
        let message: String
        switch accountError {
        case .invalidCredentials:
            message = "E-mail ou senha incorretos. Verifique os dados e tente novamente."
        case .emailAlreadyInUse:
            message = "Este e-mail já possui uma conta. Entre com sua senha."
        case .weakPassword:
            message = "Escolha uma senha mais forte, com pelo menos 6 caracteres."
        case .networkUnavailable:
            message = "Sem conexão. Verifique a internet e tente novamente."
        case .authenticationRequired:
            message = "Sua sessão terminou. Entre novamente para continuar."
        case .reauthenticationRequired:
            message = "Confirme sua senha antes de excluir a conta."
        case .passwordRequired:
            message = "Digite sua senha para confirmar."
        case .operationFailed:
            message = operation.genericFailureMessage
        }
        return .init(kind: .error, message: message)
    }
}

private extension AccountViewModel {
    enum Operation {
        case authentication
        case preferences
        case consent
        case deletion

        var genericFailureMessage: String {
            switch self {
            case .authentication:
                "Não foi possível concluir. Verifique os dados e tente novamente."
            case .preferences:
                "Não foi possível salvar suas preferências."
            case .consent:
                "Não foi possível atualizar o consentimento. A opção anterior foi restaurada."
            case .deletion:
                "Não foi possível confirmar a exclusão completa. Parte da remoção pode já ter ocorrido; tentar novamente é seguro."
            }
        }
    }
}
