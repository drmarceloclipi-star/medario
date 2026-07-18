import Observation

@MainActor
@Observable
final class NativeNotificationViewModel {
    enum State: Equatable { case idle, loading, loaded, failed }

    private let repository: any NativeNotificationRepository
    private let permissionService: any NativeNotificationPermissionProviding
    @ObservationIgnored private var subscription: (any AccountSessionSubscription)?
    @ObservationIgnored private var generation = 0
    private(set) var session: AccountSession
    private(set) var state: State = .idle
    private(set) var preferences = NativeNotificationPreferences()
    private(set) var busyEvent: NativeNotificationEvent?
    private(set) var feedback: String?

    init(
        repository: any NativeNotificationRepository,
        permissionService: any NativeNotificationPermissionProviding,
        sessionSource: any SavedItemsSessionSource
    ) {
        self.repository = repository
        self.permissionService = permissionService
        session = sessionSource.currentSession
        subscription = sessionSource.subscribe { [weak self] session in
            self?.receive(session)
        }
    }

    func load() async {
        guard case let .signedIn(user) = session, state != .loading else { return }
        generation += 1
        let current = generation
        state = .loading
        do {
            let loaded = try await repository.preferences()
            guard isCurrent(userID: user.id, generation: current) else { return }
            preferences = loaded
            if loaded.hasEnabledPush, let token = NativePushTokenStore.shared.token {
                try await repository.register(token: token, installationID: NativePushInstallationID.current, expectedUserID: user.id)
            }
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .loaded
        } catch {
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .failed
        }
    }

    func setPush(_ enabled: Bool, for event: NativeNotificationEvent) async {
        guard busyEvent == nil, case let .signedIn(user) = session else { return }
        generation += 1
        let current = generation
        busyEvent = event
        feedback = nil
        defer { busyEvent = nil }
        let previous = preferences
        do {
            if enabled {
                let token = try await permissionService.requestToken()
                try await repository.register(token: token, installationID: NativePushInstallationID.current, expectedUserID: user.id)
            }
            preferences.setPush(enabled, for: event)
            let updated = try await repository.update(preferences, expectedUserID: user.id)
            guard isCurrent(userID: user.id, generation: current) else { return }
            preferences = updated
            if !updated.hasEnabledPush {
                do {
                    try await repository.unregister(expectedUserID: user.id)
                } catch {
                    feedback = "Notificações desativadas. A limpeza do token será repetida ao sair da conta."
                    state = .loaded
                    return
                }
            }
            guard isCurrent(userID: user.id, generation: current) else { return }
            state = .loaded
            feedback = enabled ? "Notificação ativada." : "Notificação desativada."
        } catch {
            guard isCurrent(userID: user.id, generation: current) else { return }
            if enabled, !previous.hasEnabledPush {
                try? await repository.unregister(expectedUserID: user.id)
            }
            guard isCurrent(userID: user.id, generation: current) else { return }
            preferences = previous
            feedback = enabled
                ? "Permissão não concedida ou serviço indisponível. Nada foi ativado."
                : "Não foi possível desativar agora. A preferência anterior foi mantida."
        }
    }

    func registerRefreshedToken(_ token: String) async {
        guard preferences.hasEnabledPush, case let .signedIn(user) = session else { return }
        do {
            try await repository.register(
                token: token,
                installationID: NativePushInstallationID.current,
                expectedUserID: user.id
            )
        } catch {
            feedback = "Token de notificação será atualizado na próxima tentativa."
        }
    }

    private func receive(_ next: AccountSession) {
        session = next
        generation += 1
        state = .idle
        preferences = NativeNotificationPreferences()
        busyEvent = nil
        feedback = nil
    }

    private func isCurrent(userID: String, generation: Int) -> Bool {
        guard self.generation == generation, case let .signedIn(user) = session else { return false }
        return user.id == userID
    }
}
