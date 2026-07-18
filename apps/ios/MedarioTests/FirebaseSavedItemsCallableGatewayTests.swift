import XCTest
@testable import Medario

final class FirebaseSavedItemsCallableGatewayTests: XCTestCase {
    @MainActor
    func testRoutesAllCallableNamesAndObjectivePayloads() async throws {
        let client = MockSavedItemsCallableClient()
        let gateway = FirebaseSavedItemsCallableGateway(client: client)
        client.responses = [.emptyList, .ack, .ack, .savedSearch, .ack, .ack]

        _ = try await gateway.list(expectedUserID: "user-1")
        try await gateway.favorite(doctorID: "doctor-1", expectedUserID: "user-1")
        try await gateway.unfavorite(doctorID: "doctor-1", expectedUserID: "user-1")
        _ = try await gateway.saveSearch(criteria: SavedSearchCriteria(city: "Joinville"), alertEnabled: false, expectedUserID: "user-1")
        try await gateway.removeSearch(id: "search-1", expectedUserID: "user-1")
        try await gateway.setAlert(searchID: "search-1", enabled: true, expectedUserID: "user-1")

        XCTAssertEqual(client.names, ["listSavedItems", "favoriteDoctor", "unfavoriteDoctor", "saveAccountSearch", "removeAccountSearch", "setSavedSearchAlert"])
        XCTAssertTrue(client.payloads.allSatisfy { $0?["expectedUid"] as? String == "user-1" })
        XCTAssertEqual(client.payloads[3]?["criteria"] as? [String: String], ["city": "Joinville"])
        XCTAssertNil((client.payloads[3]?["criteria"] as? [String: String])?["query"])
    }

    @MainActor
    func testListDropsMalformedOrEmptySavedSearches() async throws {
        let client = MockSavedItemsCallableClient()
        client.responses = [.malformedList]

        let result = try await FirebaseSavedItemsCallableGateway(client: client).list(expectedUserID: "user-1")

        XCTAssertEqual(result.favorites, [AccountFavorite(doctorID: "doctor-1")])
        XCTAssertEqual(result.searches, [AccountSavedSearch(
            id: "valid",
            criteria: SavedSearchCriteria(specialty: "Psiquiatria", modality: .telemedicine),
            alertEnabled: true
        )])
    }
}

@MainActor
private final class MockSavedItemsCallableClient: SavedItemsCallableClient {
    enum Response: Sendable { case emptyList, malformedList, savedSearch, ack }
    var responses: [Response] = []
    private(set) var names: [String] = []
    private(set) var payloads: [[String: Any]?] = []

    func call(_ name: String, data: sending [String: Any]?) async throws -> sending Any {
        names.append(name)
        payloads.append(data)
        switch responses.removeFirst() {
        case .emptyList:
            return ["favorites": [], "searches": []]
        case .malformedList:
            return [
                "favorites": [["doctorId": "doctor-1"], ["bad": true]],
                "searches": [
                    ["id": "valid", "criteria": ["specialty": "Psiquiatria", "modality": "telemedicine"], "alertEnabled": true],
                    ["id": "empty", "criteria": [:]],
                    ["criteria": ["city": "Joinville"]]
                ]
            ]
        case .savedSearch:
            return ["id": "search-1", "criteria": ["city": "Joinville"], "alertEnabled": false]
        case .ack:
            return ["ok": true]
        }
    }
}
