import XCTest
@testable import Medario

@MainActor
final class FakeSearchInterpreter: SearchInterpreter {
    var result: SearchInterpretation
    var secondResult: SearchInterpretation?
    private(set) var receivedQuery: String?
    private(set) var receivedCatalog: DirectorySearchCatalog?
    private(set) var callCount = 0
    private(set) var prewarmCalled = false

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

    func prewarm() async { prewarmCalled = true }
}

@MainActor
final class SlowFakeInterpreter: SearchInterpreter {
    let delay: Duration
    let result: SearchInterpretation
    private(set) var prewarmCalled = false

    init(delay: Duration, result: SearchInterpretation) {
        self.delay = delay
        self.result = result
    }

    func interpret(_ query: String, catalog: DirectorySearchCatalog) async -> SearchInterpretation {
        try? await Task.sleep(for: delay)
        if Task.isCancelled { return .unsupported }
        return result
    }

    func prewarm() async { prewarmCalled = true }
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

        viewModel.retry()
        await viewModel.awaitCompletion()

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

        viewModel.dismissUrgency()
        await viewModel.awaitCompletion()

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(repository.receivedQueries, [""])
    }

    // MARK: - Interpretation tests

    @MainActor
    func testInterpretedSpecialtyAppliesDerivedFilter() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia")))
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
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Cardiologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Mariana", criteria: SavedSearchCriteria(specialty: "Dermatologia"))

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(interpreter.callCount, 0)
        XCTAssertNil(viewModel.derivedCriteria.specialty)
    }

    @MainActor
    func testEmptyQuerySkipsInterpretation() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load()

        XCTAssertEqual(interpreter.callCount, 0)
        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    @MainActor
    func testRemoveDerivedSpecialtyReloads() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia")), secondResult: .unsupported)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Mariana")
        XCTAssertEqual(viewModel.derivedCriteria.specialty, "Dermatologia")

        viewModel.removeDerivedSpecialty()
        await viewModel.awaitCompletion()

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

        viewModel.dismissClarification()
        await viewModel.awaitCompletion()

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    @MainActor
    func testSearchTextNotPersistedInDerivedCriteria() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "texto livre não salvo")

        XCTAssertNil(viewModel.derivedCriteria.callablePayload["query"])
        XCTAssertNil(viewModel.lastCriteria.callablePayload["query"])
    }

    // MARK: - Doctor / city / insurance / modality

    @MainActor
    func testInterpretedDoctorSlugFiltersToSpecificDoctor() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(doctorSlug: "dra-mariana-andrade")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Mariana")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.derivedCriteria.doctorSlug, "dra-mariana-andrade")
    }

    @MainActor
    func testInterpretedCityFiltersByCity() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(city: "Joinville")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Joinville")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.derivedCriteria.city, "Joinville")
    }

    @MainActor
    func testInterpretedInsuranceFiltersByInsurance() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(insurance: "Unimed")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Unimed")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.derivedCriteria.insurance, "Unimed")
    }

    @MainActor
    func testInterpretedModalityFiltersByModality() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(modality: .inPerson)))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "consulta presencial")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.derivedCriteria.modality, .inPerson)
    }

    @MainActor
    func testInterpretedCombinationUsesIntersection() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia", city: "Joinville")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "dermatologia em Joinville")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(viewModel.derivedCriteria.specialty, "Dermatologia")
        XCTAssertEqual(viewModel.derivedCriteria.city, "Joinville")
    }

    @MainActor
    func testManualDoctorSlugSkipsInterpretation() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Cardiologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Mariana", criteria: SavedSearchCriteria(doctorSlug: "dra-mariana-andrade"))

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertEqual(interpreter.callCount, 0)
    }

    @MainActor
    func testRemoveDerivedCityReloads() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(city: "Joinville")), secondResult: .unsupported)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Joinville")
        XCTAssertEqual(viewModel.derivedCriteria.city, "Joinville")

        viewModel.removeDerivedCity()
        await viewModel.awaitCompletion()

        XCTAssertNil(viewModel.derivedCriteria.city)
        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
    }

    // MARK: - Timeout / cancellation / prewarm tests

    @MainActor
    func testInterpretationTimeoutFallsBackToTextSearch() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = SlowFakeInterpreter(delay: .seconds(1), result: .matched(InterpretedSearch(specialty: "Dermatologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter, interpretationTimeout: .seconds(0.1))

        await viewModel.load(query: "Mariana")

        XCTAssertEqual(viewModel.state, .loaded([PublicProfileFixture.mariana]))
        XCTAssertNil(viewModel.derivedCriteria.specialty)
    }

    @MainActor
    func testNewSubmissionCancelsPreviousTask() async {
        let repository = ControlledPublicDirectoryRepository()
        let interpreter = FakeSearchInterpreter(result: .unsupported)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        viewModel.submit(query: "primeira")
        await waitForRequestCount(1, repository: repository)
        viewModel.submit(query: "segunda")
        await waitForRequestCount(2, repository: repository)

        repository.complete(index: 1, profiles: [PublicProfileFixture.mariana])
        await viewModel.awaitCompletion()
        repository.complete(index: 0, profiles: [])

        XCTAssertEqual(viewModel.lastQuery, "segunda")
        XCTAssertEqual(viewModel.state, .loaded([]))
    }

    @MainActor
    func testPrewarmCallsInterpreterPrewarm() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .unsupported)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        viewModel.prewarm()
        try? await Task.sleep(for: .seconds(0.1))

        XCTAssertTrue(interpreter.prewarmCalled)
    }

    @MainActor
    func testRepositoryFailureShowsDirectoryUnavailableMessage() async {
        let repository = MockPublicDirectoryRepository(result: .failure(TestError.unavailable))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "dermatologia")

        if case .failed(let message) = viewModel.state {
            XCTAssertTrue(message.contains("Verifique sua conexão"))
        } else {
            XCTFail("Expected .failed state for repository failure")
        }
    }

    @MainActor
    func testInterpreterUnsupportedShowsResultsNotError() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .unsupported)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "dermatologia")

        if case .loaded = viewModel.state {
            // correct — fallback shows results, not error
        } else {
            XCTFail("Expected .loaded state for interpreter fallback, not .failed")
        }
    }

    // MARK: - Effective criteria / promotion tests

    @MainActor
    func testEffectiveCriteriaMergesManualAndDerived() {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)
        viewModel.derivedCriteria = SavedSearchCriteria(specialty: "Dermatologia")
        viewModel.lastCriteria = SavedSearchCriteria(city: "Joinville")

        let effective = viewModel.effectiveCriteria
        XCTAssertEqual(effective.specialty, "Dermatologia")
        XCTAssertEqual(effective.city, "Joinville")
    }

    @MainActor
    func testEffectiveCriteriaManualOverridesDerived() {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)
        viewModel.derivedCriteria = SavedSearchCriteria(specialty: "Dermatologia")
        viewModel.lastCriteria = SavedSearchCriteria(specialty: "Cardiologia")

        XCTAssertEqual(viewModel.effectiveCriteria.specialty, "Cardiologia")
    }

    @MainActor
    func testPromoteDerivedToManualCopiesAndClears() {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)
        viewModel.derivedCriteria = SavedSearchCriteria(specialty: "Dermatologia")
        viewModel.lastCriteria = SavedSearchCriteria(city: "Joinville")

        viewModel.promoteDerivedToManual()

        XCTAssertEqual(viewModel.lastCriteria.specialty, "Dermatologia")
        XCTAssertEqual(viewModel.lastCriteria.city, "Joinville")
        XCTAssertTrue(viewModel.derivedCriteria.isEmpty)
    }

    @MainActor
    func testClearSearchRemovesDerivedAndManual() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "Dermatologia")
        XCTAssertFalse(viewModel.derivedCriteria.isEmpty)

        viewModel.submit(query: "", criteria: SavedSearchCriteria())
        await viewModel.awaitCompletion()

        XCTAssertTrue(viewModel.derivedCriteria.isEmpty)
        XCTAssertTrue(viewModel.lastCriteria.isEmpty)
    }

    @MainActor
    func testEffectiveCriteriaArePersistable() {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let viewModel = DirectoryViewModel(repository: repository)
        viewModel.derivedCriteria = SavedSearchCriteria(specialty: "Dermatologia")
        viewModel.lastCriteria = SavedSearchCriteria()

        XCTAssertTrue(viewModel.effectiveCriteria.isPersistable)
        XCTAssertNil(viewModel.effectiveCriteria.callablePayload["query"])
    }

    @MainActor
    func testNeedsClarificationDoesNotApplyResult() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .needsClarification)
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "algo")

        XCTAssertEqual(viewModel.state, .needsClarification)
        XCTAssertTrue(viewModel.derivedCriteria.isEmpty)
    }

    @MainActor
    func testRawTextNotPersistedAnywhere() async {
        let repository = MockPublicDirectoryRepository(result: .success([PublicProfileFixture.mariana]))
        let interpreter = FakeSearchInterpreter(result: .matched(InterpretedSearch(specialty: "Dermatologia")))
        let viewModel = DirectoryViewModel(repository: repository, interpreter: interpreter)

        await viewModel.load(query: "texto livre com sintomas")

        XCTAssertNil(viewModel.derivedCriteria.callablePayload["query"])
        XCTAssertNil(viewModel.lastCriteria.callablePayload["query"])
        XCTAssertNil(viewModel.effectiveCriteria.callablePayload["query"])
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