import XCTest
@testable import Medario

final class UrgencyProtocolTests: XCTestCase {

    func testProtocolHasExplicitVersionAndReviewer() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.version, "2026-07")
        XCTAssertEqual(protocol_.reviewedBy, "Responsável clínica do Medário")
        XCTAssertFalse(protocol_.signals.isEmpty)
    }

    func testEachSignalTriggersUrgent() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.evaluate("dor no peito"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("falta de ar"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("desmaio"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("sangramento intenso"), .urgent(message: protocol_.message))
    }

    func testCaseInsensitive() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.evaluate("DOR NO PEITO"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("FALTA DE AR"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("Desmaio"), .urgent(message: protocol_.message))
    }

    func testAccentInsensitive() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.evaluate("dór no peito"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("SANGRAMENTO INTENSO"), .urgent(message: protocol_.message))
    }

    func testExtraWhitespace() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.evaluate("dor  no  peito"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("  dor no peito  "), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("\tfalta de ar\n"), .urgent(message: protocol_.message))
    }

    func testEmbeddedInLongerText() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.evaluate("estou com dor no peito forte"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("tenho falta de ar desde cedo"), .urgent(message: protocol_.message))
        XCTAssertEqual(protocol_.evaluate("meu filho desmaio agora"), .urgent(message: protocol_.message))
    }

    func testEmptyQueryNotUrgent() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.evaluate(""), .notUrgent)
        XCTAssertEqual(protocol_.evaluate("   "), .notUrgent)
        XCTAssertEqual(protocol_.evaluate("\n\t"), .notUrgent)
    }

    func testNonUrgentQuery() {
        let protocol_ = UrgencyProtocol.default
        XCTAssertEqual(protocol_.evaluate("dermatologia"), .notUrgent)
        XCTAssertEqual(protocol_.evaluate("consulta de rotina"), .notUrgent)
        XCTAssertEqual(protocol_.evaluate("Dra. Mariana Andrade"), .notUrgent)
    }

    func testUrgentMessageContains192AndImmediateCare() {
        let protocol_ = UrgencyProtocol.default
        let outcome = protocol_.evaluate("dor no peito")
        if case .urgent(let message) = outcome {
            XCTAssertTrue(message.contains("192"))
            XCTAssertTrue(message.contains("atendimento imediato"))
        } else {
            XCTFail("Expected .urgent outcome")
        }
    }

    func testUrgentMessageDoesNotDiagnose() {
        let protocol_ = UrgencyProtocol.default
        let outcome = protocol_.evaluate("dor no peito")
        if case .urgent(let message) = outcome {
            XCTAssertFalse(message.contains("infarto"))
            XCTAssertFalse(message.contains("diagnóstico"))
            XCTAssertFalse(message.contains("causa"))
            XCTAssertFalse(message.contains("prescri"))
        } else {
            XCTFail("Expected .urgent outcome")
        }
    }

    func testCustomProtocolSignals() {
        let custom = UrgencyProtocol(
            version: "test",
            reviewedBy: "test",
            signals: ["convulsão"],
            message: "Alerta de teste"
        )
        XCTAssertEqual(custom.evaluate("minha filha teve convulsão"), .urgent(message: "Alerta de teste"))
        XCTAssertEqual(custom.evaluate("dor no peito"), .notUrgent)
    }
}