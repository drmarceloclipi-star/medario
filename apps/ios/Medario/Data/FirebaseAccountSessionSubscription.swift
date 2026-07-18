@preconcurrency import FirebaseAuth

@MainActor
final class FirebaseAccountSessionSubscription: AccountSessionSubscription {
    private var handle: AuthStateDidChangeListenerHandle?
    private weak var auth: Auth?

    init(auth: Auth, handle: AuthStateDidChangeListenerHandle) {
        self.auth = auth
        self.handle = handle
    }

    func cancel() {
        guard let handle else { return }
        auth?.removeStateDidChangeListener(handle)
        self.handle = nil
    }

    deinit {
        if let handle {
            auth?.removeStateDidChangeListener(handle)
        }
    }
}
