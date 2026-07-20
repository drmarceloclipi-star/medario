import XCTest
@testable import Medario

final class DirectoryViewModelTests: XCTestCase {
    @MainActor
    func testLoadPublishesProfilesAndPreservesQuery() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)

        await viewModel.load(query: "Dermatologia")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.lastQuery, "Dermatologia")
        XCTAssertEqual(repository.receivedQueries, ["Dermatologia"])
    }

    @MainActor
    func testRetryUsesLastQuery() async {
        let repository = MockPublicDirectoryRepository(result: .failure(TestError.unavailable))
        let viewModel = DirectoryViewModel(repository: repository)
        await viewModel.load(query: "Unimed")
        repository.result = .success([PublicProfileFixture.mariana])

        await viewModel.retry()

        XCTAssertEqual(repository.receivedQueries, ["Unimed", "Unimed"])
        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    @MainActor
    func testFailureUsesSafeUserFacingMessage() async {
        let repository = MockPublicDirectoryRepository(result: .failure(TestError.unavailable))
        let viewModel = DirectoryViewModel(repository: repository)

        await viewModel.load()

        XCTAssertEqual(
            viewModel.state,
            .failed("Não foi possível carregar o diretório. Verifique sua conexão e tente novamente.")
        )
    }

    @MainActor
    func testObjectiveCriteriaFilterWithoutPersistingFreeText() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)
        let criteria = SavedSearchCriteria(
            specialty: PublicProfileFixture.mariana.specialty,
            city: PublicProfileFixture.mariana.location.city,
            insurance: PublicProfileFixture.mariana.insurances.first?.name
        )

        await viewModel.load(query: "texto livre não salvo", criteria: criteria)

        XCTAssertEqual(viewModel.lastCriteria, criteria)
        XCTAssertEqual(viewModel.lastCriteria.callablePayload["query"], nil)
    }

    @MainActor
    func testObjectiveCriteriaExcludeNonMatchingProfiles() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)

        await viewModel.load(criteria: SavedSearchCriteria(city: "Florianópolis"))

        XCTAssertEqual(viewModel.state, .loaded([]))
    }

    @MainActor
    func testOnlyLatestOutOfOrderRequestPublishes() async {
        let repository = ControlledPublicDirectoryRepository()
        let viewModel = DirectoryViewModel(repository: repository)

        let first = Task { await viewModel.load(query: "primeira") }
        await waitForRequestCount(1, repository: repository)
        let second = Task { await viewModel.load(query: "segunda") }
        await waitForRequestCount(2, repository: repository)

        repository.complete(query: "segunda", profiles: [PublicProfileFixture.mariana])
        await second.value
        repository.complete(query: "primeira", profiles: [])
        await first.value

        XCTAssertEqual(viewModel.lastQuery, "segunda")
        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    @MainActor
    func testUrgentQueryStopsBeforeRepository() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)

        await viewModel.load(query: "dor no peito")

        if case .urgent(let message) = viewModel.state {
            XCTAssertTrue(message.contains("192"))
        } else {
            XCTFail("Expected .urgent state")
        }
        XCTAssertTrue(repository.receivedQueries.isEmpty, "Repository must not be called when urgency barrier blocks")
    }

    @MainActor
    func testNonUrgentQueryProceedsToRepository() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)

        await viewModel.load(query: "dermatologia")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(repository.receivedQueries, ["dermatologia"])
    }

    @MainActor
    func testDismissUrgencyReloadsDirectory() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)

        await viewModel.load(query: "dor no peito")
        if case .urgent = viewModel.state {} else {
            XCTFail("Expected .urgent state before dismiss")
        }

        await viewModel.dismissUrgency()

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(repository.receivedQueries, [""])
    }

    @MainActor
    private func waitForRequestCount(
        _ count: Int,
        repository: ControlledPublicDirectoryRepository
    ) async {
        while repository.requestedQueries.count < count {
            await Task.yield()
        }
    }
}
