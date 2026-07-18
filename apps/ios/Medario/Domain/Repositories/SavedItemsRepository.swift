import Foundation

@MainActor
protocol SavedItemsRepository: AnyObject {
    func localItems() -> LocalSavedItems
    func toggleFavorite(_ profile: PublicProfile) throws -> LocalSavedItems
    func saveSearch(_ criteria: SavedSearchCriteria) throws -> LocalSavedItems
    func removeLocalFavorite(doctorID: String) throws -> LocalSavedItems
    func removeLocalSearch(id: String) throws -> LocalSavedItems

    func accountItems(expectedUserID: String) async throws -> AccountSavedItems
    func synchronizeLocalItems(expectedUserID: String) async throws -> AccountSavedItems
    func removeAccountFavorite(doctorID: String, expectedUserID: String) async throws
    func removeAccountSearch(id: String, expectedUserID: String) async throws
    func setAccountSearchAlert(id: String, enabled: Bool, expectedUserID: String) async throws
}

@MainActor
protocol SavedItemsLocalStore: AnyObject {
    func load() -> LocalSavedItems
    func save(_ items: LocalSavedItems) throws
}

@MainActor
protocol SavedItemsCallableGateway: AnyObject {
    func list(expectedUserID: String) async throws -> AccountSavedItems
    func favorite(doctorID: String, expectedUserID: String) async throws
    func unfavorite(doctorID: String, expectedUserID: String) async throws
    func saveSearch(criteria: SavedSearchCriteria, alertEnabled: Bool, expectedUserID: String) async throws -> AccountSavedSearch
    func removeSearch(id: String, expectedUserID: String) async throws
    func setAlert(searchID: String, enabled: Bool, expectedUserID: String) async throws
}
