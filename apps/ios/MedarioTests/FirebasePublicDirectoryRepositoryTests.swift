import XCTest
@testable import Medario

final class FirebasePublicDirectoryRepositoryTests: XCTestCase {
    @MainActor
    func testCachesFirstReadAndFiltersSubsequentSearchesLocally() async throws {
        let source = MockPublicProfileDocumentsSource(documents: [
            PublicProfileDocument(
                id: "doctor-1",
                data: [
                    "name": "Dra. Mariana Andrade",
                    "specialty": "Dermatologia",
                    "location": ["city": "Joinville", "authorized": false],
                ]
            ),
        ])
        let repository = FirebasePublicDirectoryRepository(source: source)

        let allProfiles = try await repository.profiles(matching: "")
        let filteredProfiles = try await repository.profiles(matching: "Dermatologia")

        XCTAssertEqual(source.callCount, 1)
        XCTAssertEqual(allProfiles.map(\.id), ["doctor-1"])
        XCTAssertEqual(filteredProfiles.map(\.id), ["doctor-1"])
    }

    @MainActor
    func testInvalidationForcesNextRead() async throws {
        let source = MockPublicProfileDocumentsSource(documents: [])
        let repository = FirebasePublicDirectoryRepository(source: source)
        _ = try await repository.profiles(matching: "")

        repository.invalidateCache()
        _ = try await repository.profiles(matching: "")

        XCTAssertEqual(source.callCount, 2)
    }
}
