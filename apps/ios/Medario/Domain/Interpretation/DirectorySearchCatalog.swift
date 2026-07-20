import Foundation

nonisolated struct DirectorySearchCatalog: Sendable, Equatable {
    let specialties: [String]

    static func from(profiles: [PublicProfile]) -> DirectorySearchCatalog {
        let specialties = Set(profiles.map(\.specialty))
            .filter { !$0.isEmpty }
            .sorted()
        return DirectorySearchCatalog(specialties: specialties)
    }

    func contains(_ specialty: String) -> Bool {
        specialties.contains(specialty)
    }
}