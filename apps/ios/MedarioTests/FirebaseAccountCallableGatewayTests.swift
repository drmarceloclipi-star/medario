import FirebaseFunctions
import XCTest
@testable import Medario

final class FirebaseAccountCallableGatewayTests: XCTestCase {
    @MainActor
    func testUsesExpectedCallableNames() async throws {
        let client = MockAccountCallableClient()
        let gateway = FirebaseAccountCallableGateway(client: client)

        try await gateway.revokeHealthConsent()
        try await gateway.deleteMyAccount()
        try await gateway.unregisterNativePushEndpoint(expectedUserID: "user-1")

        XCTAssertEqual(client.names, ["revokeHealthConsent", "deleteMyAccount", "unregisterNativePushEndpoint"])
        XCTAssertEqual(client.payloads.last.flatMap { $0 }?["expectedUid"], "user-1")
    }

    @MainActor
    func testMapsCallableRecentLoginRequirement() async {
        let client = MockAccountCallableClient()
        client.error = NSError(domain: FunctionsErrorDomain, code: FunctionsErrorCode.failedPrecondition.rawValue)
        let gateway = FirebaseAccountCallableGateway(client: client)

        do {
            try await gateway.deleteMyAccount()
            XCTFail("Expected reauthenticationRequired")
        } catch {
            XCTAssertEqual(error as? AccountRepositoryError, .reauthenticationRequired)
        }
    }

    @MainActor
    func testMapsCallableNetworkFailure() async {
        let client = MockAccountCallableClient()
        client.error = NSError(domain: FunctionsErrorDomain, code: FunctionsErrorCode.unavailable.rawValue)
        let gateway = FirebaseAccountCallableGateway(client: client)

        do {
            try await gateway.revokeHealthConsent()
            XCTFail("Expected networkUnavailable")
        } catch {
            XCTAssertEqual(error as? AccountRepositoryError, .networkUnavailable)
        }
    }
}
