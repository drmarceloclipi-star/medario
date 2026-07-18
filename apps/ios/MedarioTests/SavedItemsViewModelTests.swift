import XCTest
@testable import Medario

final class SavedItemsViewModelTests: XCTestCase {
    @MainActor
    func testSignInDoesNotLoadOrMergeAutomatically() {
        let repository = MockSavedItemsRepository()
        let session = MockAccountRepository()
        let viewModel = SavedItemsViewModel(repository: repository, sessionSource: session)

        session.emit(.signedIn(AccountUser(id: "user-1", email: "a@b.com", displayName: nil)))

        XCTAssertEqual(repository.accountLoadCount, 0)
        XCTAssertEqual(repository.syncCount, 0)
        XCTAssertEqual(viewModel.accountState, .idle)
    }

    @MainActor
    func testExplicitSyncPublishesRemoteSnapshot() async {
        let repository = MockSavedItemsRepository()
        repository.account = AccountSavedItems(favorites: [AccountFavorite(doctorID: "doctor-1")], searches: [])
        let session = MockAccountRepository()
        session.currentSession = .signedIn(AccountUser(id: "user-1", email: "a@b.com", displayName: nil))
        let viewModel = SavedItemsViewModel(repository: repository, sessionSource: session)

        await viewModel.synchronizeNow()

        XCTAssertEqual(repository.syncCount, 1)
        XCTAssertEqual(viewModel.accountState, .loaded(repository.account))
    }

    @MainActor
    func testLateAccountResponseIsIgnoredAfterLogout() async {
        let repository = MockSavedItemsRepository()
        repository.controlledAccountLoad = true
        let session = MockAccountRepository()
        session.currentSession = .signedIn(AccountUser(id: "user-1", email: "a@b.com", displayName: nil))
        let viewModel = SavedItemsViewModel(repository: repository, sessionSource: session)

        let load = Task { await viewModel.loadAccountItems() }
        while repository.accountLoadCount == 0 { await Task.yield() }
        session.emit(.signedOut)
        repository.completeAccountLoad(AccountSavedItems(favorites: [AccountFavorite(doctorID: "private")], searches: []))
        await load.value

        XCTAssertEqual(viewModel.accountState, .idle)
        XCTAssertEqual(viewModel.session, .signedOut)
    }

    @MainActor
    func testVisitorFavoriteAndSearchRemainLocal() {
        let repository = MockSavedItemsRepository()
        let session = MockAccountRepository()
        let viewModel = SavedItemsViewModel(repository: repository, sessionSource: session)

        viewModel.toggleFavorite(PublicProfileFixture.mariana)
        viewModel.saveSearch(SavedSearchCriteria(city: "Joinville"))

        XCTAssertTrue(viewModel.isFavorite(PublicProfileFixture.mariana.id))
        XCTAssertEqual(viewModel.localItems.searches.count, 1)
        XCTAssertEqual(repository.syncCount, 0)
    }

    @MainActor
    func testFailureOffersSafeRetryState() async {
        let repository = MockSavedItemsRepository()
        repository.error = TestError.unavailable
        let session = MockAccountRepository()
        session.currentSession = .signedIn(AccountUser(id: "user-1", email: "a@b.com", displayName: nil))
        let viewModel = SavedItemsViewModel(repository: repository, sessionSource: session)

        await viewModel.loadAccountItems()

        XCTAssertEqual(viewModel.accountState, .failed("Não foi possível carregar os itens da conta."))
    }
}
