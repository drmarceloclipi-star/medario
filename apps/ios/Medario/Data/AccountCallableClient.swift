import Foundation

@MainActor
protocol AccountCallableClient: AnyObject {
    func call(_ name: String, data: [String: String]?) async throws
}
