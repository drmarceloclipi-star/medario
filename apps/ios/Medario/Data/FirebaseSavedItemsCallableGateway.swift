import Foundation

@MainActor
final class FirebaseSavedItemsCallableGateway: SavedItemsCallableGateway {
    private let client: any SavedItemsCallableClient

    init(client: any SavedItemsCallableClient = FirebaseSavedItemsCallableClient()) {
        self.client = client
    }

    func list(expectedUserID: String) async throws -> AccountSavedItems {
        let value = try await client.call("listSavedItems", data: ["expectedUid": expectedUserID])
        guard let root = value as? [String: Any] else { throw MappingError.invalidResponse }
        let favorites = (root["favorites"] as? [[String: Any]] ?? []).compactMap { item -> AccountFavorite? in
            guard let doctorID = item["doctorId"] as? String, !doctorID.isEmpty else { return nil }
            return AccountFavorite(doctorID: doctorID)
        }
        let searches = (root["searches"] as? [[String: Any]] ?? []).compactMap(Self.search)
        return AccountSavedItems(favorites: favorites, searches: searches)
    }

    func favorite(doctorID: String, expectedUserID: String) async throws {
        _ = try await client.call("favoriteDoctor", data: ["doctorId": doctorID, "expectedUid": expectedUserID])
    }

    func unfavorite(doctorID: String, expectedUserID: String) async throws {
        _ = try await client.call("unfavoriteDoctor", data: ["doctorId": doctorID, "expectedUid": expectedUserID])
    }

    func saveSearch(criteria: SavedSearchCriteria, alertEnabled: Bool, expectedUserID: String) async throws -> AccountSavedSearch {
        let value = try await client.call(
            "saveAccountSearch",
            data: ["criteria": criteria.callablePayload, "alertEnabled": alertEnabled, "expectedUid": expectedUserID]
        )
        guard let item = value as? [String: Any], let search = Self.search(item) else {
            throw MappingError.invalidResponse
        }
        return search
    }

    func removeSearch(id: String, expectedUserID: String) async throws {
        _ = try await client.call("removeAccountSearch", data: ["searchId": id, "expectedUid": expectedUserID])
    }

    func setAlert(searchID: String, enabled: Bool, expectedUserID: String) async throws {
        _ = try await client.call(
            "setSavedSearchAlert",
            data: ["searchId": searchID, "alertEnabled": enabled, "expectedUid": expectedUserID]
        )
    }

    private static func search(_ item: [String: Any]) -> AccountSavedSearch? {
        guard let id = item["id"] as? String,
              let raw = item["criteria"] as? [String: Any] else { return nil }
        let modality = (raw["modality"] as? String).flatMap(SavedSearchModality.init(rawValue:))
        let criteria = SavedSearchCriteria(
            specialty: raw["specialty"] as? String,
            city: raw["city"] as? String,
            insurance: raw["insurance"] as? String,
            modality: modality
        )
        guard !criteria.isEmpty else { return nil }
        return AccountSavedSearch(id: id, criteria: criteria, alertEnabled: item["alertEnabled"] as? Bool == true)
    }

    private enum MappingError: Error {
        case invalidResponse
    }
}
