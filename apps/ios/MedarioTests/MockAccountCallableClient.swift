@testable import Medario

@MainActor
final class MockAccountCallableClient: AccountCallableClient {
    var error: Error?
    private(set) var names: [String] = []
    private(set) var payloads: [[String: String]?] = []

    func call(_ name: String, data: [String: String]?) async throws {
        names.append(name)
        payloads.append(data)
        if let error { throw error }
    }
}
