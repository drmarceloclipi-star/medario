import Foundation
@testable import Medario

@MainActor
final class ControlledPublicDirectoryRepository: PublicDirectoryRepository {
    private var pending: [String: CheckedContinuation<[PublicProfile], any Error>] = [:]
    private(set) var requestedQueries: [String] = []

    func profiles(matching query: String) async throws -> [PublicProfile] {
        requestedQueries.append(query)
        return try await withCheckedThrowingContinuation { continuation in
            pending[query] = continuation
        }
    }

    func complete(query: String, profiles: [PublicProfile]) {
        pending.removeValue(forKey: query)?.resume(returning: profiles)
    }
}
