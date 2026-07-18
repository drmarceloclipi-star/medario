import Foundation

@MainActor
final class FirebaseAccountRepository: AccountRepository {
    private let backendGateway: any AccountBackendGateway
    private let callableGateway: any AccountCallableGateway

    init(
        backendGateway: any AccountBackendGateway = FirebaseAccountBackendGateway(),
        callableGateway: any AccountCallableGateway = FirebaseAccountCallableGateway()
    ) {
        self.backendGateway = backendGateway
        self.callableGateway = callableGateway
    }

    var currentSession: AccountSession {
        backendGateway.currentSession
    }

    func subscribe(_ listener: @escaping @MainActor (AccountSession) -> Void) -> any AccountSessionSubscription {
        backendGateway.subscribe(listener)
    }

    func signIn(email: String, password: String) async throws {
        try await backendGateway.signIn(email: normalizedEmail(email), password: password)
    }

    func createPatientAccount(email: String, password: String) async throws {
        try await backendGateway.createPatientAccount(email: normalizedEmail(email), password: password)
    }

    func signOut() async throws {
        if case let .signedIn(user) = currentSession {
            try await callableGateway.unregisterNativePushEndpoint(expectedUserID: user.id)
        }
        try await backendGateway.signOut()
    }

    func profile() async throws -> AccountProfile {
        try await backendGateway.profile()
    }

    func updatePreferences(_ preferences: AccountPreferences) async throws {
        try await backendGateway.updatePreferences(preferences)
    }

    func setHealthConsent(_ value: Bool) async throws {
        if value {
            try await backendGateway.grantHealthConsent()
        } else {
            try await callableGateway.revokeHealthConsent()
        }
    }

    func refreshEmailVerification() async throws {
        guard case .signedIn = currentSession else {
            throw AccountRepositoryError.authenticationRequired
        }
        _ = try await backendGateway.reloadCurrentUser()
    }

    func deleteAccount() async throws {
        guard case .signedIn = currentSession else {
            throw AccountRepositoryError.authenticationRequired
        }
        try await callableGateway.deleteMyAccount()
        try? await backendGateway.signOut()
    }

    func reauthenticateAndDelete(password: String) async throws {
        guard !password.isEmpty else { throw AccountRepositoryError.passwordRequired }
        guard case .signedIn = currentSession else {
            throw AccountRepositoryError.authenticationRequired
        }
        try await backendGateway.reauthenticate(password: password)
        try await backendGateway.refreshIDToken()
        try await callableGateway.deleteMyAccount()
        try? await backendGateway.signOut()
    }

    private func normalizedEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
