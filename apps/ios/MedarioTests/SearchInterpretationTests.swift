import XCTest
@testable import Medario

@MainActor
final class SearchInterpretationTests: XCTestCase {

    private let fullCatalog: DirectorySearchCatalog = {
        let profiles = [PublicProfileFixture.mariana]
        return DirectorySearchCatalog.from(profiles: profiles, query: "")
    }()

    private var catalogWithDoctor: DirectorySearchCatalog {
        DirectorySearchCatalog.from(profiles: [PublicProfileFixture.mariana], query: "Mariana")
    }

    // MARK: - Specialty

    func testMatchedSpecialtyExact() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("Dermatologia", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(specialty: "Dermatologia")))
    }

    func testMatchedSpecialtySubstring() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("dermato", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(specialty: "Dermatologia")))
    }

    func testMatchedSpecialtyCaseInsensitive() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("CARDIOLOGIA", catalog: fullCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    func testMatchedSpecialtyEmbeddedInText() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("preciso de dermatologia", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(specialty: "Dermatologia")))
    }

    // MARK: - City

    func testMatchedCity() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("Joinville", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(city: "Joinville")))
    }

    func testMatchedCityCaseInsensitive() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("joinville", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(city: "Joinville")))
    }

    // MARK: - Insurance

    func testMatchedInsurance() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("Unimed", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(insurance: "Unimed")))
    }

    // MARK: - Modality

    func testMatchedModalityInPerson() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("consulta presencial", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(modality: .inPerson)))
    }

    func testMatchedModalityTelemedicine() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("teleconsulta", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(modality: .telemedicine)))
    }

    // MARK: - Doctor

    func testMatchedDoctor() async {
        let interpreter = FallbackSearchInterpreter()
        let catalog = catalogWithDoctor
        let result = await interpreter.interpret("Mariana", catalog: catalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(doctorSlug: "dra-mariana-andrade")))
    }

    // MARK: - Combinations

    func testMatchedSpecialtyAndCity() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("Dermatologia em Joinville", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(specialty: "Dermatologia", city: "Joinville")))
    }

    func testMatchedSpecialtyAndInsurance() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("Dermatologia Unimed", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(specialty: "Dermatologia", insurance: "Unimed")))
    }

    func testMatchedSpecialtyAndModality() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("Dermatologia teleconsulta", catalog: fullCatalog)
        XCTAssertEqual(result, .matched(InterpretedSearch(specialty: "Dermatologia", modality: .telemedicine)))
    }

    // MARK: - Edge cases

    func testNoMatchReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("xyzabc", catalog: fullCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    func testEmptyQueryReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("", catalog: fullCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    func testWhitespaceQueryReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("   ", catalog: fullCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    func testEmptyCatalogReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let emptyCatalog = DirectorySearchCatalog(specialties: [], cities: [], insurances: [], doctorCandidates: [])
        let result = await interpreter.interpret("Dermatologia", catalog: emptyCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    // MARK: - Similar names

    func testSimilarDoctorNameDoesNotMatchWrongDoctor() async {
        let interpreter = FallbackSearchInterpreter()
        let catalog = DirectorySearchCatalog.from(
            profiles: [PublicProfileFixture.mariana], query: "Mariano"
        )
        let result = await interpreter.interpret("Mariano", catalog: catalog)
        XCTAssertEqual(result, .unsupported)
    }
}