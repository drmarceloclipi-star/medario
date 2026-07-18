import Foundation

@MainActor
protocol PublicDirectoryRepository {
    func profiles(matching query: String) async throws -> [PublicProfile]
}
