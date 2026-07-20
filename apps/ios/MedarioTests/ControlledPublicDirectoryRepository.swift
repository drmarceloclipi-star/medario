import Foundation
@testable import Medario

@MainActor
final class ControlledPublicDirectoryRepository: PublicDirectoryRepository {
    private var pending: [CheckedContinuation<[PublicProfile], any Error>?] = []
    private(set) var requestedQueries: [String] = []

    func profiles(matching query: String) async throws -> [PublicProfile] {
        requestedQueries.append(query)
        return try await withCheckedThrowingContinuation { continuation in
            pending.append(continuation)
        }
    }

    func complete(index: Int, profiles: [PublicProfile]) {
        guard index < pending.count, let continuation = pending[index] else { return }
        pending[index] = nil
        continuation.resume(returning: profiles)
    }
}
