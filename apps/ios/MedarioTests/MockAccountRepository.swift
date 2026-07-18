import Foundation
@testable import Medario

@MainActor
final class MockAccountRepository: AccountRepository {
    var currentSession: AccountSession = .signedOut
    var profileResult: Result<AccountProfile, Error> = .success(
        AccountProfile(email: "patient@example.com", preferences: AccountPreferences(), healthConsent: false)
    )
    var signInError: Error?
    var createError: Error?
    var signOutError: Error?
    var updatePreferencesError: Error?
    var setConsentError: Error?
    var deleteError: Error?
    var reauthenticateError: Error?
    var refreshEmailError: Error?
    var refreshedSession: AccountSession?
    var usesControlledProfileResults = false

    private(set) var signInInputs: [(email: String, password: String)] = []
    private(set) var createInputs: [(email: String, password: String)] = []
    private(set) var signOutCallCount = 0
    private(set) var profileCallCount = 0
    private(set) var updatedPreferences: [AccountPreferences] = []
    private(set) var consentValues: [Bool] = []
    private(set) var deleteCallCount = 0
    private(set) var reauthenticationPasswords: [String] = []
    private(set) var refreshEmailCallCount = 0
    private var pendingProfileRequests: [Int: CheckedContinuation<AccountProfile, any Error>] = [:]

    private var listener: (@MainActor (AccountSession) -> Void)?

    func subscribe(_ listener: @escaping @MainActor (AccountSession) -> Void) -> any AccountSessionSubscription {
        self.listener = listener
        return MockAccountSessionSubscription()
    }

    func emit(_ session: AccountSession) {
        currentSession = session
        listener?(session)
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
    }

    func profile() async throws -> AccountProfile {
        profileCallCount += 1
        if usesControlledProfileResults {
            let request = profileCallCount
            return try await withCheckedThrowingContinuation { continuation in
                pendingProfileRequests[request] = continuation
            }
        }
        return try profileResult.get()
    }

    func completeProfileRequest(_ request: Int, with profile: AccountProfile) {
        pendingProfileRequests.removeValue(forKey: request)?.resume(returning: profile)
    }

    func updatePreferences(_ preferences: AccountPreferences) async throws {
        updatedPreferences.append(preferences)
        if let updatePreferencesError { throw updatePreferencesError }
    }

    func setHealthConsent(_ value: Bool) async throws {
        consentValues.append(value)
        if let setConsentError { throw setConsentError }
    }

    func refreshEmailVerification() async throws {
        refreshEmailCallCount += 1
        if let refreshEmailError { throw refreshEmailError }
        if let refreshedSession { currentSession = refreshedSession }
    }

    func deleteAccount() async throws {
        deleteCallCount += 1
        if let deleteError { throw deleteError }
    }

    func reauthenticateAndDelete(password: String) async throws {
        reauthenticationPasswords.append(password)
        if let reauthenticateError { throw reauthenticateError }
    }
}
