import Foundation

@MainActor
final class UserDefaultsSavedItemsLocalStore: SavedItemsLocalStore {
    private let defaults: UserDefaults
    private let key: String
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard, key: String = "medario.saved-items.v1") {
        self.defaults = defaults
        self.key = key
    }

    func load() -> LocalSavedItems {
        guard let data = defaults.data(forKey: key),
              let items = try? decoder.decode(LocalSavedItems.self, from: data) else {
            defaults.removeObject(forKey: key)
            return LocalSavedItems()
        }
        let sanitized = LocalSavedItems(
            favorites: Array(uniqueFavorites(items.favorites).prefix(100)),
            searches: Array(items.searches.filter { $0.criteria.isPersistable }.prefix(50))
        )
        if let sanitizedData = try? encoder.encode(sanitized), sanitizedData != data {
            defaults.set(sanitizedData, forKey: key)
        }
        return sanitized
    }

    func save(_ items: LocalSavedItems) throws {
        defaults.set(try encoder.encode(items), forKey: key)
    }

    private func uniqueFavorites(_ favorites: [LocalFavorite]) -> [LocalFavorite] {
        var seen = Set<String>()
        return favorites.filter { seen.insert($0.doctorID).inserted }
    }
}
