import Foundation

@MainActor
final class FirebaseAccountCallableGateway: AccountCallableGateway {
    private let client: any AccountCallableClient

    init(client: any AccountCallableClient = FirebaseAccountCallableClient()) {
        self.client = client
    }

    func revokeHealthConsent() async throws {
        do {
            try await client.call("revokeHealthConsent", data: nil)
        } catch {
            throw AccountCallableErrorMapper.map(error)
        }
    }

    func deleteMyAccount() async throws {
        do {
            try await client.call("deleteMyAccount", data: nil)
        } catch {
            throw AccountCallableErrorMapper.map(error)
        }
    }

    func unregisterNativePushEndpoint(expectedUserID: String) async throws {
        do {
            try await client.call("unregisterNativePushEndpoint", data: ["expectedUid": expectedUserID])
        } catch {
            throw AccountCallableErrorMapper.map(error)
        }
    }
}
