import Foundation

@MainActor
final class FirebasePublicDirectoryRepository: PublicDirectoryRepository {
    private let source: any PublicProfileDocumentsSource
    private var cachedProfiles: [PublicProfile]?

    init(source: any PublicProfileDocumentsSource = FirebasePublicProfileDocumentsSource()) {
        self.source = source
    }

    func profiles(matching query: String) async throws -> [PublicProfile] {
        let profiles: [PublicProfile]
        if let cachedProfiles {
            profiles = cachedProfiles
        } else {
            let loaded = try await source.publishedDocuments()
                .map { FirestorePublicProfileMapper.map(id: $0.id, data: $0.data) }
                .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
            cachedProfiles = loaded
            profiles = loaded
        }

        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty else { return profiles }
        return profiles.filter { $0.searchableText.localizedStandardContains(normalizedQuery) }
    }

    func invalidateCache() {
        cachedProfiles = nil
    }
}
