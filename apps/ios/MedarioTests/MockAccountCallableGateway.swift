@testable import Medario

@MainActor
final class MockAccountCallableGateway: AccountCallableGateway {
    var revokeError: Error?
    var deleteError: Error?
    private(set) var revokeCallCount = 0
    private(set) var deleteCallCount = 0
    private(set) var unregisterInputs: [String] = []

    func revokeHealthConsent() async throws {
        revokeCallCount += 1
        if let revokeError { throw revokeError }
    }

    func deleteMyAccount() async throws {
        deleteCallCount += 1
        if let deleteError { throw deleteError }
    }

    func unregisterNativePushEndpoint(expectedUserID: String) async throws {
        unregisterInputs.append(expectedUserID)
    }
}
