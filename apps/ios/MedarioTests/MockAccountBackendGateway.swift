import Foundation
@testable import Medario

@MainActor
final class MockAccountBackendGateway: AccountBackendGateway {
    var currentSession: AccountSession = .signedOut
    var profileResult: Result<AccountProfile, Error> = .success(
        AccountProfile(email: "patient@example.com", preferences: AccountPreferences(), healthConsent: false)
    )
    var signInError: Error?
    var createError: Error?
    var signOutError: Error?
    var updateError: Error?
    var grantConsentError: Error?
    var reauthenticateError: Error?
    var refreshTokenError: Error?
    var reloadError: Error?

    private(set) var signInInputs: [(email: String, password: String)] = []
    private(set) var createInputs: [(email: String, password: String)] = []
    private(set) var signOutCallCount = 0
    private(set) var profileCallCount = 0
    private(set) var updatedPreferences: [AccountPreferences] = []
    private(set) var grantConsentCallCount = 0
    private(set) var reauthenticationPasswords: [String] = []
    private(set) var refreshTokenCallCount = 0
    private(set) var reloadCallCount = 0
    private var listener: (@MainActor (AccountSession) -> Void)?

    func subscribe(_ listener: @escaping @MainActor (AccountSession) -> Void) -> any AccountSessionSubscription {
        self.listener = listener
        return MockAccountSessionSubscription()
    }

    func signIn(email: String, password: String) async throws {
        signInInputs.append((email, password))
        if let signInError { throw signInError }
    }

    func createPatientAccount(email: String, password: String) async throws {
        createInputs.append((email, password))
        if let createError { throw createError }
    }

    func signOut() async throws {
        signOutCallCount += 1
        if let signOutError { throw signOutError }
        currentSession = .signedOut
        listener?(.signedOut)
    }

    func profile() async throws -> AccountProfile {
        profileCallCount += 1
        return try profileResult.get()
    }

    func updatePreferences(_ preferences: AccountPreferences) async throws {
        updatedPreferences.append(preferences)
        if let updateError { throw updateError }
    }

    func grantHealthConsent() async throws {
        grantConsentCallCount += 1
        if let grantConsentError { throw grantConsentError }
    }

    func reloadCurrentUser() async throws -> AccountSession {
        reloadCallCount += 1
        if let reloadError { throw reloadError }
        return currentSession
    }

    func reauthenticate(password: String) async throws {
        reauthenticationPasswords.append(password)
        if let reauthenticateError { throw reauthenticateError }
    }

    func refreshIDToken() async throws {
        refreshTokenCallCount += 1
        if let refreshTokenError { throw refreshTokenError }
    }
}
