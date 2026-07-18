import Foundation
@testable import Medario

@MainActor
final class MemorySavedItemsLocalStore: SavedItemsLocalStore {
    var items = LocalSavedItems()
    var saveError: Error?
    func load() -> LocalSavedItems { items }
    func save(_ items: LocalSavedItems) throws {
        if let saveError { throw saveError }
        self.items = items
    }
}

@MainActor
final class MockSavedItemsCallableGateway: SavedItemsCallableGateway {
    var listed = AccountSavedItems(favorites: [], searches: [])
    var error: Error?
    private(set) var listCount = 0
    private(set) var favoriteIDs: [String] = []
    private(set) var unfavoriteIDs: [String] = []
    private(set) var savedCriteria: [SavedSearchCriteria] = []
    private(set) var removedSearchIDs: [String] = []
    private(set) var alerts: [(String, Bool)] = []

    func list(expectedUserID: String) async throws -> AccountSavedItems { listCount += 1; if let error { throw error }; return listed }
    func favorite(doctorID: String, expectedUserID: String) async throws { if let error { throw error }; favoriteIDs.append(doctorID) }
    func unfavorite(doctorID: String, expectedUserID: String) async throws { if let error { throw error }; unfavoriteIDs.append(doctorID) }
    func saveSearch(criteria: SavedSearchCriteria, alertEnabled: Bool, expectedUserID: String) async throws -> AccountSavedSearch {
        if let error { throw error }; savedCriteria.append(criteria)
        return AccountSavedSearch(id: "new", criteria: criteria, alertEnabled: alertEnabled)
    }
    func removeSearch(id: String, expectedUserID: String) async throws { if let error { throw error }; removedSearchIDs.append(id) }
    func setAlert(searchID: String, enabled: Bool, expectedUserID: String) async throws { if let error { throw error }; alerts.append((searchID, enabled)) }
}

@MainActor
final class MockSavedItemsRepository: SavedItemsRepository {
    var local = LocalSavedItems()
    var account = AccountSavedItems(favorites: [], searches: [])
    var error: Error?
    var controlledAccountLoad = false
    private var accountContinuation: CheckedContinuation<AccountSavedItems, any Error>?
    private(set) var accountLoadCount = 0
    private(set) var syncCount = 0

    func localItems() -> LocalSavedItems { local }
    func toggleFavorite(_ profile: PublicProfile) throws -> LocalSavedItems {
        if local.favorites.contains(where: { $0.doctorID == profile.id }) { local.favorites.removeAll { $0.doctorID == profile.id } }
        else { local.favorites.append(LocalFavorite(profile: profile)) }
        return local
    }
    func saveSearch(_ criteria: SavedSearchCriteria) throws -> LocalSavedItems { local.searches.append(LocalSavedSearch(criteria: criteria)); return local }
    func removeLocalFavorite(doctorID: String) throws -> LocalSavedItems { local.favorites.removeAll { $0.doctorID == doctorID }; return local }
    func removeLocalSearch(id: String) throws -> LocalSavedItems { local.searches.removeAll { $0.id == id }; return local }
    func accountItems(expectedUserID: String) async throws -> AccountSavedItems {
        accountLoadCount += 1
        if controlledAccountLoad { return try await withCheckedThrowingContinuation { accountContinuation = $0 } }
        if let error { throw error }; return account
    }
    func completeAccountLoad(_ items: AccountSavedItems) { accountContinuation?.resume(returning: items); accountContinuation = nil }
    func synchronizeLocalItems(expectedUserID: String) async throws -> AccountSavedItems { syncCount += 1; if let error { throw error }; return account }
    func removeAccountFavorite(doctorID: String, expectedUserID: String) async throws { account = .init(favorites: account.favorites.filter { $0.doctorID != doctorID }, searches: account.searches) }
    func removeAccountSearch(id: String, expectedUserID: String) async throws { account = .init(favorites: account.favorites, searches: account.searches.filter { $0.id != id }) }
    func setAccountSearchAlert(id: String, enabled: Bool, expectedUserID: String) async throws {}
}
