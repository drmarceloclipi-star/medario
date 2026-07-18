import XCTest
@testable import Medario

final class SavedItemsRepositoryTests: XCTestCase {
    @MainActor
    func testFavoriteTogglePersistsProfileSnapshotLocally() throws {
        let store = MemorySavedItemsLocalStore()
        let repository = DefaultSavedItemsRepository(localStore: store, gateway: MockSavedItemsCallableGateway())

        let added = try repository.toggleFavorite(PublicProfileFixture.mariana)
        XCTAssertEqual(added.favorites.first?.doctorID, PublicProfileFixture.mariana.id)
        XCTAssertEqual(added.favorites.first?.name, PublicProfileFixture.mariana.name)

        let removed = try repository.toggleFavorite(PublicProfileFixture.mariana)
        XCTAssertTrue(removed.favorites.isEmpty)
    }

    @MainActor
    func testSearchStoresOnlyObjectiveTypedCriteriaAndDeduplicates() throws {
        let store = MemorySavedItemsLocalStore()
        let repository = DefaultSavedItemsRepository(localStore: store, gateway: MockSavedItemsCallableGateway())
        let criteria = SavedSearchCriteria(specialty: "Psiquiatria", city: "Joinville", insurance: "Unimed", modality: .telemedicine)

        _ = try repository.saveSearch(criteria)
        let items = try repository.saveSearch(criteria)

        XCTAssertEqual(items.searches.count, 1)
        XCTAssertEqual(items.searches[0].criteria.callablePayload, [
            "specialty": "Psiquiatria", "city": "Joinville", "insurance": "Unimed", "modality": "telemedicine"
        ])
    }

    @MainActor
    func testEmptyCriteriaIsNeverPersisted() throws {
        let store = MemorySavedItemsLocalStore()
        let repository = DefaultSavedItemsRepository(localStore: store, gateway: MockSavedItemsCallableGateway())
        XCTAssertThrowsError(try repository.saveSearch(SavedSearchCriteria()))
        XCTAssertTrue(store.items.searches.isEmpty)
    }

    @MainActor
    func testExplicitSyncUploadsOnlyMissingItemsThenReloads() async throws {
        let store = MemorySavedItemsLocalStore()
        store.items = LocalSavedItems(
            favorites: [LocalFavorite(profile: PublicProfileFixture.mariana)],
            searches: [LocalSavedSearch(criteria: SavedSearchCriteria(city: "Joinville"))]
        )
        let gateway = MockSavedItemsCallableGateway()
        gateway.listed = AccountSavedItems(favorites: [AccountFavorite(doctorID: PublicProfileFixture.mariana.id)], searches: [])
        let repository = DefaultSavedItemsRepository(localStore: store, gateway: gateway)

        _ = try await repository.synchronizeLocalItems(expectedUserID: "user-1")

        XCTAssertTrue(gateway.favoriteIDs.isEmpty)
        XCTAssertEqual(gateway.savedCriteria, [SavedSearchCriteria(city: "Joinville")])
        XCTAssertEqual(gateway.listCount, 2)
    }

    @MainActor
    func testUserDefaultsRoundTripAndRejectsCorruptPayload() throws {
        let suite = "SavedItemsRepositoryTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = UserDefaultsSavedItemsLocalStore(defaults: defaults)
        let expected = LocalSavedItems(favorites: [LocalFavorite(profile: PublicProfileFixture.mariana)], searches: [])
        try store.save(expected)
        XCTAssertEqual(store.load(), expected)
        defaults.set(Data("invalid".utf8), forKey: "medario.saved-items.v1")
        XCTAssertEqual(store.load(), LocalSavedItems())
    }

    @MainActor
    func testLegacyUnknownSensitiveFieldsAreDiscardedOnDecode() throws {
        let suite = "SavedItemsSensitiveFields.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = UserDefaultsSavedItemsLocalStore(defaults: defaults)
        let json = """
        {"favorites":[],"searches":[{"id":"one","createdAt":0,"criteria":{"city":"Joinville"},"rawQuery":"dor rara","exactLocation":{"lat":1}}]}
        """
        defaults.set(Data(json.utf8), forKey: "medario.saved-items.v1")

        let items = store.load()

        XCTAssertEqual(items.searches.first?.criteria, SavedSearchCriteria(city: "Joinville"))
        let persisted = try XCTUnwrap(defaults.data(forKey: "medario.saved-items.v1"))
        let persistedText = try XCTUnwrap(String(data: persisted, encoding: .utf8))
        XCTAssertFalse(persistedText.contains("dor rara"))
        XCTAssertFalse(persistedText.contains("exactLocation"))
    }
}
