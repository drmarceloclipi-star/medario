import Foundation
import Observation

@MainActor
@Observable
final class SavedItemsViewModel {
    private let repository: any SavedItemsRepository
    @ObservationIgnored private var subscription: (any AccountSessionSubscription)?
    @ObservationIgnored private var accountGeneration = 0
    @ObservationIgnored private var accountOperationInFlight = false

    private(set) var localItems: LocalSavedItems
    private(set) var session: AccountSession
    private(set) var accountState: AccountSavedItemsState = .idle
    private(set) var isSynchronizing = false
    private(set) var feedback: String?

    init(repository: any SavedItemsRepository, sessionSource: any SavedItemsSessionSource) {
        self.repository = repository
        localItems = repository.localItems()
        session = sessionSource.currentSession
        subscription = sessionSource.subscribe { [weak self] session in
            self?.receive(session)
        }
    }

    func isFavorite(_ doctorID: String) -> Bool {
        localItems.favorites.contains { $0.doctorID == doctorID }
    }

    func toggleFavorite(_ profile: PublicProfile) {
        do {
            localItems = try repository.toggleFavorite(profile)
            feedback = isFavorite(profile.id) ? "Favorito salvo neste dispositivo." : "Favorito removido deste dispositivo."
        } catch SavedItemsRepositoryError.favoriteLimit {
            feedback = "Limite de 100 favoritos neste dispositivo atingido."
        } catch {
            feedback = "Não foi possível atualizar o favorito. Tente novamente."
        }
    }

    func saveSearch(_ criteria: SavedSearchCriteria) {
        guard !criteria.isEmpty else {
            feedback = "Escolha ao menos um filtro objetivo para salvar."
            return
        }
        do {
            let previousCount = localItems.searches.count
            localItems = try repository.saveSearch(criteria)
            feedback = localItems.searches.count == previousCount
                ? "Esta busca já está salva neste dispositivo."
                : "Busca salva neste dispositivo."
        } catch SavedItemsRepositoryError.invalidCriteria {
            feedback = "Cada filtro deve ter no máximo 100 caracteres."
        } catch SavedItemsRepositoryError.searchLimit {
            feedback = "Limite de 50 buscas salvas neste dispositivo atingido."
        } catch {
            feedback = "Não foi possível salvar a busca. Tente novamente."
        }
    }

    func removeLocalFavorite(_ doctorID: String) {
        do {
            localItems = try repository.removeLocalFavorite(doctorID: doctorID)
        } catch {
            feedback = "Não foi possível remover o favorito."
        }
    }

    func removeLocalSearch(_ id: String) {
        do {
            localItems = try repository.removeLocalSearch(id: id)
        } catch {
            feedback = "Não foi possível remover a busca."
        }
    }

    func loadAccountItems() async {
        guard let identity = signedInIdentity(), !accountOperationInFlight else { return }
        accountGeneration += 1
        let generation = accountGeneration
        accountOperationInFlight = true
        accountState = .loading
        defer {
            if isCurrent(identity: identity, generation: generation) { accountOperationInFlight = false }
        }
        do {
            let items = try await repository.accountItems(expectedUserID: identity)
            guard isCurrent(identity: identity, generation: generation) else { return }
            accountState = .loaded(items)
        } catch {
            guard isCurrent(identity: identity, generation: generation) else { return }
            accountState = .failed("Não foi possível carregar os itens da conta.")
        }
    }

    func synchronizeNow() async {
        guard let identity = signedInIdentity(), !accountOperationInFlight else { return }
        accountGeneration += 1
        let generation = accountGeneration
        accountOperationInFlight = true
        isSynchronizing = true
        feedback = nil
        defer {
            if isCurrent(identity: identity, generation: generation) {
                isSynchronizing = false
                accountOperationInFlight = false
            }
        }
        do {
            let items = try await repository.synchronizeLocalItems(expectedUserID: identity)
            guard isCurrent(identity: identity, generation: generation) else { return }
            accountState = .loaded(items)
            feedback = "Itens deste dispositivo sincronizados com sua conta."
        } catch {
            guard isCurrent(identity: identity, generation: generation) else { return }
            accountState = .failed("Não foi possível sincronizar agora. Tente novamente.")
        }
    }

    func removeAccountFavorite(_ doctorID: String) async {
        guard let identity = signedInIdentity(), !accountOperationInFlight else { return }
        accountGeneration += 1
        let generation = accountGeneration
        accountOperationInFlight = true
        defer {
            if isCurrent(identity: identity, generation: generation) { accountOperationInFlight = false }
        }
        do {
            try await repository.removeAccountFavorite(doctorID: doctorID, expectedUserID: identity)
            guard isCurrent(identity: identity, generation: generation), case let .loaded(items) = accountState else { return }
            accountState = .loaded(AccountSavedItems(
                favorites: items.favorites.filter { $0.doctorID != doctorID },
                searches: items.searches
            ))
        } catch {
            guard isCurrent(identity: identity, generation: generation) else { return }
            feedback = "Não foi possível remover o favorito da conta."
        }
    }

    func removeAccountSearch(_ id: String) async {
        guard let identity = signedInIdentity(), !accountOperationInFlight else { return }
        accountGeneration += 1
        let generation = accountGeneration
        accountOperationInFlight = true
        defer {
            if isCurrent(identity: identity, generation: generation) { accountOperationInFlight = false }
        }
        do {
            try await repository.removeAccountSearch(id: id, expectedUserID: identity)
            guard isCurrent(identity: identity, generation: generation), case let .loaded(items) = accountState else { return }
            accountState = .loaded(AccountSavedItems(
                favorites: items.favorites,
                searches: items.searches.filter { $0.id != id }
            ))
        } catch {
            guard isCurrent(identity: identity, generation: generation) else { return }
            feedback = "Não foi possível remover a busca da conta."
        }
    }

    func setAlert(_ enabled: Bool, searchID: String) async {
        guard let identity = signedInIdentity(), !accountOperationInFlight else { return }
        accountGeneration += 1
        let generation = accountGeneration
        accountOperationInFlight = true
        defer {
            if isCurrent(identity: identity, generation: generation) { accountOperationInFlight = false }
        }
        do {
            try await repository.setAccountSearchAlert(id: searchID, enabled: enabled, expectedUserID: identity)
            guard isCurrent(identity: identity, generation: generation), case let .loaded(items) = accountState else { return }
            accountState = .loaded(AccountSavedItems(
                favorites: items.favorites,
                searches: items.searches.map {
                    $0.id == searchID
                        ? AccountSavedSearch(id: $0.id, criteria: $0.criteria, alertEnabled: enabled)
                        : $0
                }
            ))
        } catch {
            guard isCurrent(identity: identity, generation: generation) else { return }
            feedback = "Não foi possível atualizar o alerta."
        }
    }

    func clearFeedback() { feedback = nil }

    private func receive(_ next: AccountSession) {
        session = next
        accountGeneration += 1
        isSynchronizing = false
        accountOperationInFlight = false
        accountState = .idle
    }

    private func signedInIdentity() -> String? {
        guard case let .signedIn(user) = session else {
            feedback = "Entre na conta para sincronizar. Seus itens locais continuam neste dispositivo."
            return nil
        }
        return user.id
    }

    private func isCurrent(identity: String, generation: Int) -> Bool {
        guard generation == accountGeneration, case let .signedIn(user) = session else { return false }
        return user.id == identity
    }
}
