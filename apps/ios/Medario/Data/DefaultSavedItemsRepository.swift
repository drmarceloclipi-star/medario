import Foundation

@MainActor
final class DefaultSavedItemsRepository: SavedItemsRepository {
    private let localStore: any SavedItemsLocalStore
    private let gateway: any SavedItemsCallableGateway

    init(
        localStore: any SavedItemsLocalStore = UserDefaultsSavedItemsLocalStore(),
        gateway: any SavedItemsCallableGateway = FirebaseSavedItemsCallableGateway()
    ) {
        self.localStore = localStore
        self.gateway = gateway
    }

    func localItems() -> LocalSavedItems { localStore.load() }

    func toggleFavorite(_ profile: PublicProfile) throws -> LocalSavedItems {
        var items = localStore.load()
        if items.favorites.contains(where: { $0.doctorID == profile.id }) {
            items.favorites.removeAll { $0.doctorID == profile.id }
        } else {
            guard items.favorites.count < 100 else { throw SavedItemsRepositoryError.favoriteLimit }
            items.favorites.insert(LocalFavorite(profile: profile), at: 0)
        }
        try localStore.save(items)
        return items
    }

    func saveSearch(_ criteria: SavedSearchCriteria) throws -> LocalSavedItems {
        guard criteria.isPersistable else { throw SavedItemsRepositoryError.invalidCriteria }
        var items = localStore.load()
        guard !items.searches.contains(where: { $0.criteria == criteria }) else { return items }
        guard items.searches.count < 50 else { throw SavedItemsRepositoryError.searchLimit }
        items.searches.insert(LocalSavedSearch(criteria: criteria), at: 0)
        try localStore.save(items)
        return items
    }

    func removeLocalFavorite(doctorID: String) throws -> LocalSavedItems {
        var items = localStore.load()
        items.favorites.removeAll { $0.doctorID == doctorID }
        try localStore.save(items)
        return items
    }

    func removeLocalSearch(id: String) throws -> LocalSavedItems {
        var items = localStore.load()
        items.searches.removeAll { $0.id == id }
        try localStore.save(items)
        return items
    }

    func accountItems(expectedUserID: String) async throws -> AccountSavedItems {
        try await gateway.list(expectedUserID: expectedUserID)
    }

    func synchronizeLocalItems(expectedUserID: String) async throws -> AccountSavedItems {
        let local = localStore.load()
        let existing = try await gateway.list(expectedUserID: expectedUserID)
        let remoteDoctorIDs = Set(existing.favorites.map(\.doctorID))
        let remoteCriteria = Set(existing.searches.map(\.criteria))
        for favorite in local.favorites where !remoteDoctorIDs.contains(favorite.doctorID) {
            try await gateway.favorite(doctorID: favorite.doctorID, expectedUserID: expectedUserID)
        }
        for search in local.searches where !remoteCriteria.contains(search.criteria) {
            _ = try await gateway.saveSearch(criteria: search.criteria, alertEnabled: false, expectedUserID: expectedUserID)
        }
        return try await gateway.list(expectedUserID: expectedUserID)
    }

    func removeAccountFavorite(doctorID: String, expectedUserID: String) async throws {
        try await gateway.unfavorite(doctorID: doctorID, expectedUserID: expectedUserID)
    }
    func removeAccountSearch(id: String, expectedUserID: String) async throws {
        try await gateway.removeSearch(id: id, expectedUserID: expectedUserID)
    }
    func setAccountSearchAlert(id: String, enabled: Bool, expectedUserID: String) async throws {
        try await gateway.setAlert(searchID: id, enabled: enabled, expectedUserID: expectedUserID)
    }
}

enum SavedItemsRepositoryError: Error {
    case favoriteLimit
    case invalidCriteria
    case searchLimit
}
