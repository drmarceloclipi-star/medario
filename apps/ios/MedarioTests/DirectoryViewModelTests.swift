import XCTest
@testable import Medario

@MainActor
final class FakeSearchInterpreter: SearchInterpreter {
    var result: SearchInterpretation
    var secondResult: SearchInterpretation?
    private(set) var receivedQuery: String?
    private(set) var receivedCatalog: DirectorySearchCatalog?
    private(set) var callCount = 0

    init(result: SearchInterpretation, secondResult: SearchInterpretation? = nil) {
        self.result = result
        self.secondResult = secondResult
    }

    func interpret(_ query: String, catalog: DirectorySearchCatalog) async -> SearchInterpretation {
        receivedQuery = query
        receivedCatalog = catalog
        callCount += 1
        if callCount == 2, let secondResult { return secondResult }
        return result
    }
}

final class DirectoryViewModelTests: XCTestCase {
    @MainActor
    func testLoadPublishesProfilesAndPreservesQuery() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)

        await viewModel.load(query: "Dermatologia")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.lastQuery, "Dermatologia")
        XCTAssertEqual(repository.receivedQueries, [""])
    }

    @MainActor
    func testRetryUsesLastQuery() async {
        let repository = MockPublicDirectoryRepository(result: .failure(TestError.unavailable))
        let viewModel = DirectoryViewModel(repository: repository)
        await viewModel.load(query: "Unimed")
        repository.result = .success([PublicProfileFixture.mariana])

        await viewModel.retry()

        XCTAssertEqual(repository.receivedQueries, ["", ""])
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

        repository.complete(index: 1, profiles: [PublicProfileFixture.mariana])
        await second.value
        repository.complete(index: 0, profiles: [])
        await first.value

        XCTAssertEqual(viewModel.lastQuery, "segunda")
        XCTAssertEqual(viewModel.state, .loaded([]))
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
        XCTAssertEqual(repository.receivedQueries, [""])
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

    // MARK: - Interpretation tests

    @MainActor
    func testInterpretedSpecialtyAppliesDerivedFilter() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(specialty: "Dermatologia"))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "quero ver um dermatologista")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.derivedCriteria.specialty, "Dermatologia")
        XCTAssertEqual(interpreter.receivedQuery, "quero ver um dermatologista")
        XCTAssertEqual(interpreter.callCount, 1)
        XCTAssertEqual(repository.receivedQueries, [""])
    }

    @MainActor
    func testNeedsClarificationState() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .needsClarification)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "quero algo")

        XCTAssertEqual(viewModel.state, .needsClarification)
        XCTAssertEqual(interpreter.callCount, 1)
    }

    @MainActor
    func testUnsupportedFallsBackToTextSearch() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .unsupported)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "mariana")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertNil(viewModel.derivedCriteria.specialty)
        XCTAssertEqual(interpreter.callCount, 1)
    }

    @MainActor
    func testManualSpecialtySkipsInterpretation() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(specialty: "Cardiologia"))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Mariana", criteria: SavedSearchCriteria(specialty: "Dermatologia"))

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(interpreter.callCount, 0)
        XCTAssertNil(viewModel.derivedCriteria.specialty)
    }

    @MainActor
    func testEmptyQuerySkipsInterpretation() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(specialty: "Dermatologia"))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load()

        XCTAssertEqual(interpreter.callCount, 0)
        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    @MainActor
    func testRemoveDerivedSpecialtyReloads() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(specialty: "Dermatologia"), secondResult: .unsupported)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Mariana")
        XCTAssertEqual(viewModel.derivedCriteria.specialty, "Dermatologia")

        await viewModel.removeDerivedSpecialty()

        XCTAssertNil(viewModel.derivedCriteria.specialty)
        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    @MainActor
    func testDismissClarificationReloads() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .needsClarification)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "algo")
        XCTAssertEqual(viewModel.state, .needsClarification)

        await viewModel.dismissClarification()

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    @MainActor
    func testSearchTextNotPersistedInDerivedCriteria() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(specialty: "Dermatologia"))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "texto livre não salvo")

        XCTAssertNil(viewModel.derivedCriteria.callablePayload["query"])
        XCTAssertNil(viewModel.lastCriteria.callablePayload["query"])
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