import XCTest
@testable import Medario

final class NativeNotificationViewModelTests: XCTestCase {
    @MainActor
    func testEnableRequestsPermissionRegistersEndpointAndPersistsPreference() async {
        let session = signedInSession()
        let repository = MockNativeNotificationRepository()
        let permission = MockNativeNotificationPermissionService()
        let viewModel = NativeNotificationViewModel(
            repository: repository,
            permissionService: permission,
            sessionSource: session
        )

        await viewModel.setPush(true, for: .appointmentConfirmed)

        XCTAssertEqual(permission.requestCount, 1)
        XCTAssertEqual(repository.registerInputs.map(\.userID), ["user-1"])
        XCTAssertTrue(repository.updatedPreferences.last?.pushEnabled(for: .appointmentConfirmed) == true)
        XCTAssertTrue(viewModel.preferences.pushEnabled(for: .appointmentConfirmed))
        XCTAssertEqual(viewModel.feedback, "Notificação ativada.")
    }

    @MainActor
    func testDeniedPermissionLeavesPreferenceDisabledAndServerUntouched() async {
        let session = signedInSession()
        let repository = MockNativeNotificationRepository()
        let permission = MockNativeNotificationPermissionService()
        permission.error = MockNativeNotificationError.failed
        let viewModel = NativeNotificationViewModel(
            repository: repository,
            permissionService: permission,
            sessionSource: session
        )

        await viewModel.setPush(true, for: .profileUpdated)

        XCTAssertTrue(repository.registerInputs.isEmpty)
        XCTAssertTrue(repository.updatedPreferences.isEmpty)
        XCTAssertFalse(viewModel.preferences.pushEnabled(for: .profileUpdated))
        XCTAssertEqual(viewModel.feedback, "Permissão não concedida ou serviço indisponível. Nada foi ativado.")
    }

    @MainActor
    func testFailedPreferenceWriteRemovesNewEndpointAndRollsBack() async {
        let session = signedInSession()
        let repository = MockNativeNotificationRepository()
        repository.updateError = MockNativeNotificationError.failed
        let viewModel = NativeNotificationViewModel(
            repository: repository,
            permissionService: MockNativeNotificationPermissionService(),
            sessionSource: session
        )

        await viewModel.setPush(true, for: .savedSearchMaterial)

        XCTAssertEqual(repository.unregisterInputs, ["user-1"])
        XCTAssertFalse(viewModel.preferences.pushEnabled(for: .savedSearchMaterial))
    }

    @MainActor
    func testFinalRevocationRemainsDisabledWhenEndpointCleanupFails() async {
        let session = signedInSession()
        let repository = MockNativeNotificationRepository()
        repository.unregisterError = MockNativeNotificationError.failed
        var enabled = NativeNotificationPreferences()
        enabled.setPush(true, for: .appointmentConfirmed)
        repository.storedPreferences = enabled
        let viewModel = NativeNotificationViewModel(
            repository: repository,
            permissionService: MockNativeNotificationPermissionService(),
            sessionSource: session
        )
        await viewModel.load()

        await viewModel.setPush(false, for: .appointmentConfirmed)

        XCTAssertFalse(viewModel.preferences.hasEnabledPush)
        XCTAssertFalse(repository.storedPreferences.hasEnabledPush)
        XCTAssertEqual(viewModel.state, .loaded)
        XCTAssertEqual(viewModel.feedback, "Notificações desativadas. A limpeza do token será repetida ao sair da conta.")
    }

    @MainActor
    func testAccountChangeClearsPreviousAccountPreferences() async {
        let session = signedInSession()
        let repository = MockNativeNotificationRepository()
        var enabled = NativeNotificationPreferences()
        enabled.setPush(true, for: .profileUpdated)
        repository.storedPreferences = enabled
        let viewModel = NativeNotificationViewModel(
            repository: repository,
            permissionService: MockNativeNotificationPermissionService(),
            sessionSource: session
        )
        await viewModel.load()

        session.emit(.signedOut)

        XCTAssertEqual(viewModel.state, .idle)
        XCTAssertFalse(viewModel.preferences.hasEnabledPush)
    }

    @MainActor
    private func signedInSession() -> MockAccountRepository {
        let session = MockAccountRepository()
        session.currentSession = .signedIn(AccountUser(id: "user-1", email: "patient@example.com", displayName: nil))
        return session
    }
}
