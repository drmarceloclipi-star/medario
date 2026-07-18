import Foundation

@MainActor
protocol SavedItemsCallableClient: AnyObject {
    func call(_ name: String, data: sending [String: Any]?) async throws -> sending Any
}
