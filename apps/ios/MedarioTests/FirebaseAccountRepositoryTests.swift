import XCTest
@testable import Medario

final class FirebaseAccountRepositoryTests: XCTestCase {
    @MainActor
    func testAuthenticationNormalizesEmailBeforeFirebaseGateway() async throws {
        let backend = MockAccountBackendGateway()
        let repository = FirebaseAccountRepository(
            backendGateway: backend,
            callableGateway: MockAccountCallableGateway()
        )

        try await repository.signIn(email: " Patient@Example.COM ", password: "secret1")
        try await repository.createPatientAccount(email: " NEW@Example.COM ", password: "secret2")

        XCTAssertEqual(backend.signInInputs.first?.email, "patient@example.com")
        XCTAssertEqual(backend.createInputs.first?.email, "new@example.com")
    }

    @MainActor
    func testHealthConsentUsesDirectWriteForGrantAndCallableForRevocation() async throws {
        let backend = MockAccountBackendGateway()
        let callable = MockAccountCallableGateway()
        let repository = FirebaseAccountRepository(backendGateway: backend, callableGateway: callable)

        try await repository.setHealthConsent(true)
        try await repository.setHealthConsent(false)

        XCTAssertEqual(backend.grantConsentCallCount, 1)
        XCTAssertEqual(callable.revokeCallCount, 1)
    }

    @MainActor
    func testSignOutUnregistersNativePushBeforeLocalSessionEnds() async throws {
        let backend = MockAccountBackendGateway()
        backend.currentSession = .signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil))
        let callable = MockAccountCallableGateway()
        let repository = FirebaseAccountRepository(backendGateway: backend, callableGateway: callable)

        try await repository.signOut()

        XCTAssertEqual(callable.unregisterInputs, ["user-1"])
        XCTAssertEqual(backend.signOutCallCount, 1)
    }

    @MainActor
    func testEmailVerificationRefreshRequiresSessionAndReloadsFirebaseUser() async throws {
        let backend = MockAccountBackendGateway()
        let repository = FirebaseAccountRepository(backendGateway: backend, callableGateway: MockAccountCallableGateway())

        do {
            try await repository.refreshEmailVerification()
            XCTFail("Expected authenticationRequired")
        } catch {
            XCTAssertEqual(error as? AccountRepositoryError, .authenticationRequired)
        }

        backend.currentSession = .signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil))
        try await repository.refreshEmailVerification()
        XCTAssertEqual(backend.reloadCallCount, 1)
    }

    @MainActor
    func testDeleteRequiresAuthenticatedSessionBeforeCallable() async {
        let backend = MockAccountBackendGateway()
        let callable = MockAccountCallableGateway()
        let repository = FirebaseAccountRepository(backendGateway: backend, callableGateway: callable)

        do {
            try await repository.deleteAccount()
            XCTFail("Expected authenticationRequired")
        } catch {
            XCTAssertEqual(error as? AccountRepositoryError, .authenticationRequired)
        }
        XCTAssertEqual(callable.deleteCallCount, 0)
    }

    @MainActor
    func testDeleteCallsServerThenSignsOutLocally() async throws {
        let backend = MockAccountBackendGateway()
        backend.currentSession = .signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil))
        let callable = MockAccountCallableGateway()
        let repository = FirebaseAccountRepository(backendGateway: backend, callableGateway: callable)

        try await repository.deleteAccount()

        XCTAssertEqual(callable.deleteCallCount, 1)
        XCTAssertEqual(backend.signOutCallCount, 1)
    }

    @MainActor
    func testCallableFailureDoesNotSignOutOrClaimLocalDeletion() async {
        let backend = MockAccountBackendGateway()
        backend.currentSession = .signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil))
        let callable = MockAccountCallableGateway()
        callable.deleteError = AccountRepositoryError.reauthenticationRequired
        let repository = FirebaseAccountRepository(backendGateway: backend, callableGateway: callable)

        do {
            try await repository.deleteAccount()
            XCTFail("Expected reauthenticationRequired")
        } catch {
            XCTAssertEqual(error as? AccountRepositoryError, .reauthenticationRequired)
        }
        XCTAssertEqual(backend.signOutCallCount, 0)
    }

    @MainActor
    func testReauthenticationRefreshesTokenBeforeServerDeletion() async throws {
        let backend = MockAccountBackendGateway()
        backend.currentSession = .signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil))
        let callable = MockAccountCallableGateway()
        let repository = FirebaseAccountRepository(backendGateway: backend, callableGateway: callable)

        try await repository.reauthenticateAndDelete(password: "valid-password")

        XCTAssertEqual(backend.reauthenticationPasswords, ["valid-password"])
        XCTAssertEqual(backend.refreshTokenCallCount, 1)
        XCTAssertEqual(callable.deleteCallCount, 1)
        XCTAssertEqual(backend.signOutCallCount, 1)
    }
}
