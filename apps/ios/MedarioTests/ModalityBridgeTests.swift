import XCTest
@testable import Medario

final class ModalityBridgeTests: XCTestCase {

    func testToSavedInPerson() {
        XCTAssertEqual(ModalityBridge.toSaved(.inPerson), .inPerson)
    }

    func testToSavedTelemedicine() {
        XCTAssertEqual(ModalityBridge.toSaved(.externalTelemedicine), .telemedicine)
    }

    func testToConsultationInPerson() {
        XCTAssertEqual(ModalityBridge.toConsultation(.inPerson), .inPerson)
    }

    func testToConsultationTelemedicine() {
        XCTAssertEqual(ModalityBridge.toConsultation(.telemedicine), .externalTelemedicine)
    }

    func testRoundTripInPerson() {
        XCTAssertEqual(ModalityBridge.toConsultation(ModalityBridge.toSaved(.inPerson)), .inPerson)
    }

    func testRoundTripTelemedicine() {
        XCTAssertEqual(ModalityBridge.toConsultation(ModalityBridge.toSaved(.externalTelemedicine)), .externalTelemedicine)
    }
}