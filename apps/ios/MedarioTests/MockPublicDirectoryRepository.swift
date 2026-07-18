import Foundation
@testable import Medario

@MainActor
final class MockPublicDirectoryRepository: PublicDirectoryRepository {
    var result: Result<[PublicProfile], Error>
    private(set) var receivedQueries: [String] = []

    init(result: Result<[PublicProfile], Error>) {
        self.result = result
    }

    func profiles(matching query: String) async throws -> [PublicProfile] {
        receivedQueries.append(query)
        return try result.get()
    }
}
