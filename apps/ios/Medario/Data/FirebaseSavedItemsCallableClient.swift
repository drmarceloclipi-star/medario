@preconcurrency import FirebaseFunctions
import Foundation

@MainActor
final class FirebaseSavedItemsCallableClient: SavedItemsCallableClient {
    private let functions: Functions

    init(functions: Functions = .functions()) {
        self.functions = functions
    }

    func call(_ name: String, data: sending [String: Any]?) async throws -> sending Any {
        let result = if let data {
            try await functions.httpsCallable(name).call(data)
        } else {
            try await functions.httpsCallable(name).call()
        }
        return result.data
    }
}
