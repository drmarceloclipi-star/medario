@testable import Medario

@MainActor
final class MockAccountSessionSubscription: AccountSessionSubscription {
    private(set) var isCancelled = false

    func cancel() {
        isCancelled = true
    }
}
