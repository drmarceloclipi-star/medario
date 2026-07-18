import XCTest
@testable import Medario

final class AccountViewModelTests: XCTestCase {
    @MainActor
    func testSessionTransitionLoadsPrivateProfile() async {
        let repository = MockAccountRepository()
        repository.profileResult = .success(
            AccountProfile(
                email: "patient@example.com",
                preferences: AccountPreferences(city: "Joinville", insurance: "Unimed"),
                healthConsent: true
            )
        )
        let viewModel = AccountViewModel(repository: repository)

        repository.emit(.signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil)))
        await waitUntil { viewModel.profileState == .loaded }

        XCTAssertEqual(repository.profileCallCount, 1)
        XCTAssertEqual(viewModel.preferences.city, "Joinville")
        XCTAssertEqual(viewModel.preferences.insurance, "Unimed")
        XCTAssertTrue(viewModel.healthConsent)
    }

    @MainActor
    func testProfileResponseAfterLogoutIsIgnored() async {
        let repository = MockAccountRepository()
        repository.usesControlledProfileResults = true
        let viewModel = AccountViewModel(repository: repository)
        repository.emit(.signedIn(AccountUser(id: "user-1", email: "one@example.com", displayName: nil)))
        await waitUntil { repository.profileCallCount == 1 }

        repository.emit(.signedOut)
        repository.completeProfileRequest(
            1,
            with: AccountProfile(
                email: "one@example.com",
                preferences: AccountPreferences(city: "Joinville"),
                healthConsent: true
            )
        )
        await Task.yield()

        XCTAssertEqual(viewModel.session, .signedOut)
        XCTAssertEqual(viewModel.profileState, .idle)
        XCTAssertEqual(viewModel.preferences, AccountPreferences())
        XCTAssertFalse(viewModel.healthConsent)
    }

    @MainActor
    func testOlderProfileResponseCannotOverwriteNewUser() async {
        let repository = MockAccountRepository()
        repository.usesControlledProfileResults = true
        let viewModel = AccountViewModel(repository: repository)
        repository.emit(.signedIn(AccountUser(id: "user-1", email: "one@example.com", displayName: nil)))
        await waitUntil { repository.profileCallCount == 1 }
        repository.emit(.signedIn(AccountUser(id: "user-2", email: "two@example.com", displayName: nil)))
        await waitUntil { repository.profileCallCount == 2 }

        repository.completeProfileRequest(
            2,
            with: AccountProfile(
                email: "two@example.com",
                preferences: AccountPreferences(city: "Curitiba"),
                healthConsent: false
            )
        )
        await waitUntil { viewModel.profileState == .loaded }
        repository.completeProfileRequest(
            1,
            with: AccountProfile(
                email: "one@example.com",
                preferences: AccountPreferences(city: "Joinville"),
                healthConsent: true
            )
        )
        await Task.yield()

        XCTAssertEqual(viewModel.preferences.city, "Curitiba")
        XCTAssertFalse(viewModel.healthConsent)
    }

    @MainActor
    func testInvalidEmailDoesNotCallAuthentication() async {
        let repository = MockAccountRepository()
        let viewModel = AccountViewModel(repository: repository)
        viewModel.email = "invalido"
        viewModel.password = "123456"

        await viewModel.authenticate()

        XCTAssertTrue(repository.signInInputs.isEmpty)
        XCTAssertEqual(viewModel.feedback?.message, "Digite um e-mail válido.")
    }

    @MainActor
    func testSignInNormalizesEmailAndClearsPassword() async {
        let repository = MockAccountRepository()
        let viewModel = AccountViewModel(repository: repository)
        viewModel.email = " Patient@Example.COM "
        viewModel.password = "secret1"

        await viewModel.authenticate()

        XCTAssertEqual(repository.signInInputs.count, 1)
        XCTAssertEqual(repository.signInInputs.first?.email, "Patient@Example.COM")
        XCTAssertEqual(repository.signInInputs.first?.password, "secret1")
        XCTAssertEqual(viewModel.password, "")
        XCTAssertEqual(viewModel.feedback, .init(kind: .success, message: "Login realizado."))
    }

    @MainActor
    func testRegisterUsesPatientAccountPath() async {
        let repository = MockAccountRepository()
        let viewModel = AccountViewModel(repository: repository)
        viewModel.toggleMode()
        viewModel.email = "patient@example.com"
        viewModel.password = "secret1"

        await viewModel.authenticate()

        XCTAssertEqual(repository.createInputs.count, 1)
        XCTAssertTrue(repository.signInInputs.isEmpty)
        XCTAssertEqual(viewModel.feedback, .init(kind: .success, message: "Conta criada. Enviamos um link para confirmar seu e-mail antes do primeiro agendamento."))
    }

    @MainActor
    func testRefreshEmailVerificationPublishesVerifiedSession() async {
        let repository = MockAccountRepository()
        let pending = AccountUser(id: "user-1", email: "patient@example.com", displayName: nil)
        let verified = AccountUser(id: "user-1", email: "patient@example.com", displayName: nil, emailVerified: true)
        repository.currentSession = .signedIn(pending)
        repository.refreshedSession = .signedIn(verified)
        let viewModel = AccountViewModel(repository: repository)

        await viewModel.refreshEmailVerification()

        XCTAssertEqual(repository.refreshEmailCallCount, 1)
        XCTAssertEqual(viewModel.session, .signedIn(verified))
        XCTAssertEqual(viewModel.feedback?.message, "E-mail confirmado. Agendamentos liberados.")
    }

    @MainActor
    func testAuthenticationMapsSpecificErrorWithoutExposingDetails() async {
        let repository = MockAccountRepository()
        repository.signInError = AccountRepositoryError.invalidCredentials
        let viewModel = AccountViewModel(repository: repository)
        viewModel.email = "patient@example.com"
        viewModel.password = "wrong1"

        await viewModel.authenticate()

        XCTAssertEqual(viewModel.feedback?.message, "E-mail ou senha incorretos. Verifique os dados e tente novamente.")
    }

    @MainActor
    func testPreferencesSavePassesAllFields() async {
        let repository = MockAccountRepository()
        let viewModel = AccountViewModel(repository: repository)
        viewModel.preferences = AccountPreferences(
            city: "Joinville",
            insurance: "Unimed",
            modality: "Presencial",
            language: "Português",
            accessibilitySupport: true
        )

        await viewModel.savePreferences()

        XCTAssertEqual(repository.updatedPreferences, [viewModel.preferences])
        XCTAssertEqual(viewModel.feedback, .init(kind: .success, message: "Preferências salvas."))
    }

    @MainActor
    func testFailedConsentUpdateRestoresPersistedValue() async {
        let repository = MockAccountRepository()
        repository.profileResult = .success(
            AccountProfile(email: "patient@example.com", preferences: AccountPreferences(), healthConsent: false)
        )
        let viewModel = AccountViewModel(repository: repository)
        repository.emit(.signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil)))
        await waitUntil { viewModel.profileState == .loaded }
        repository.setConsentError = AccountRepositoryError.networkUnavailable
        viewModel.healthConsent = true

        await viewModel.persistHealthConsentChange()

        XCTAssertEqual(repository.consentValues, [true])
        XCTAssertFalse(viewModel.healthConsent)
        XCTAssertEqual(viewModel.feedback?.message, "Sem conexão. Verifique a internet e tente novamente.")
    }

    @MainActor
    func testDeleteRequiresReauthenticationWithoutClaimingDeletion() async {
        let repository = MockAccountRepository()
        repository.deleteError = AccountRepositoryError.reauthenticationRequired
        let viewModel = AccountViewModel(repository: repository)

        await viewModel.deleteAccount()

        XCTAssertEqual(viewModel.deletionState, .reauthenticationRequired)
        XCTAssertEqual(repository.deleteCallCount, 1)
        XCTAssertEqual(viewModel.feedback?.message, "Por segurança, confirme sua senha para excluir a conta. Nenhum dado foi apagado ainda.")
    }

    @MainActor
    func testWrongReauthenticationPasswordKeepsAccountAndFlowOpen() async {
        let repository = MockAccountRepository()
        repository.deleteError = AccountRepositoryError.reauthenticationRequired
        repository.reauthenticateError = AccountRepositoryError.invalidCredentials
        let viewModel = AccountViewModel(repository: repository)
        await viewModel.deleteAccount()
        viewModel.reauthenticationPassword = "wrong-password"

        await viewModel.reauthenticateAndDelete()

        XCTAssertEqual(viewModel.deletionState, .reauthenticationRequired)
        XCTAssertEqual(repository.reauthenticationPasswords, ["wrong-password"])
        XCTAssertEqual(viewModel.feedback?.message, "Senha incorreta. Sua conta não foi excluída.")
    }

    @MainActor
    func testSuccessfulReauthenticationConfirmsLinkedDataDeletion() async {
        let repository = MockAccountRepository()
        repository.deleteError = AccountRepositoryError.reauthenticationRequired
        let viewModel = AccountViewModel(repository: repository)
        await viewModel.deleteAccount()
        viewModel.reauthenticationPassword = "valid-password"

        await viewModel.reauthenticateAndDelete()

        XCTAssertEqual(viewModel.deletionState, .idle)
        XCTAssertEqual(viewModel.reauthenticationPassword, "")
        XCTAssertEqual(viewModel.feedback?.message, "Conta e dados vinculados excluídos.")
    }

    @MainActor
    func testSuccessfulDirectDeletionConfirmsLinkedDataDeletion() async {
        let repository = MockAccountRepository()
        let viewModel = AccountViewModel(repository: repository)

        await viewModel.deleteAccount()

        XCTAssertEqual(repository.deleteCallCount, 1)
        XCTAssertEqual(viewModel.deletionState, .idle)
        XCTAssertEqual(viewModel.feedback, .init(kind: .success, message: "Conta e dados vinculados excluídos."))
    }

    @MainActor
    func testGenericDeletionFailureAcknowledgesPossiblePartialCleanupAndSafeRetry() async {
        let repository = MockAccountRepository()
        repository.deleteError = AccountRepositoryError.operationFailed
        let viewModel = AccountViewModel(repository: repository)

        await viewModel.deleteAccount()

        XCTAssertEqual(
            viewModel.feedback?.message,
            "Não foi possível confirmar a exclusão completa. Parte da remoção pode já ter ocorrido; tentar novamente é seguro."
        )
    }

    @MainActor
    private func waitUntil(_ predicate: @escaping @MainActor () -> Bool) async {
        while !predicate() {
            await Task.yield()
        }
    }
}
