import XCTest
@testable import Medario

@MainActor
final class SearchInterpretationTests: XCTestCase {

    private let dermatologiaCatalog = DirectorySearchCatalog(specialties: ["Cardiologia", "Dermatologia"])

    func testMatchedSpecialtyExact() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("Dermatologia", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .matched(specialty: "Dermatologia"))
    }

    func testMatchedSpecialtySubstring() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("dermato", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .matched(specialty: "Dermatologia"))
    }

    func testMatchedSpecialtyCaseInsensitive() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("CARDIOLOGIA", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .matched(specialty: "Cardiologia"))
    }

    func testMatchedSpecialtyAccentInsensitive() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("cardiologia", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .matched(specialty: "Cardiologia"))
    }

    func testMatchedSpecialtyEmbeddedInText() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("preciso de dermatologia", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .matched(specialty: "Dermatologia"))
    }

    func testNoMatchReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("xyzabc", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    func testEmptyQueryReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    func testWhitespaceQueryReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let result = await interpreter.interpret("   ", catalog: dermatologiaCatalog)
        XCTAssertEqual(result, .unsupported)
    }

    func testEmptyCatalogReturnsUnsupported() async {
        let interpreter = FallbackSearchInterpreter()
        let emptyCatalog = DirectorySearchCatalog(specialties: [])
        let result = await interpreter.interpret("Dermatologia", catalog: emptyCatalog)
        XCTAssertEqual(result, .unsupported)
    }
}