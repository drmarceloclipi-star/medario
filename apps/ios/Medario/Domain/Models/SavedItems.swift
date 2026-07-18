import Foundation

struct LocalFavorite: Codable, Hashable, Identifiable, Sendable {
    let doctorID: String
    let name: String
    let specialty: String
    let city: String
    let createdAt: Date

    var id: String { doctorID }

    init(profile: PublicProfile, createdAt: Date = .now) {
        doctorID = profile.id
        name = profile.name
        specialty = profile.specialty
        city = profile.location.city
        self.createdAt = createdAt
    }
}

struct LocalSavedSearch: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let criteria: SavedSearchCriteria
    let createdAt: Date

    init(id: String = UUID().uuidString, criteria: SavedSearchCriteria, createdAt: Date = .now) {
        self.id = id
        self.criteria = criteria
        self.createdAt = createdAt
    }
}

struct LocalSavedItems: Codable, Equatable, Sendable {
    var favorites: [LocalFavorite] = []
    var searches: [LocalSavedSearch] = []
}

struct AccountFavorite: Hashable, Identifiable, Sendable {
    let doctorID: String
    var id: String { doctorID }
}

struct AccountSavedSearch: Hashable, Identifiable, Sendable {
    let id: String
    let criteria: SavedSearchCriteria
    let alertEnabled: Bool
}

struct AccountSavedItems: Equatable, Sendable {
    let favorites: [AccountFavorite]
    let searches: [AccountSavedSearch]
}
