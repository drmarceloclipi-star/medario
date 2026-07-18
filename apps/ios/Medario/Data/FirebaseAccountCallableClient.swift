@preconcurrency import FirebaseFunctions

@MainActor
final class FirebaseAccountCallableClient: AccountCallableClient {
    private let functions: Functions

    init(functions: Functions = .functions()) {
        self.functions = functions
    }

    func call(_ name: String, data: [String: String]? = nil) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            functions.httpsCallable(name).call(data) { _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }
}
