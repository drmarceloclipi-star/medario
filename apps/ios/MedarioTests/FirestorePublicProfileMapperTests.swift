import FirebaseFirestore
import XCTest
@testable import Medario

final class FirestorePublicProfileMapperTests: XCTestCase {
    @MainActor
    func testMapsPublishedProjectionAndVerifiedContacts() throws {
        let data: [String: Any] = [
            "slug": "dra-mariana-andrade",
            "name": "Dra. Mariana Andrade",
            "specialties": ["Dermatologia"],
            "crm": "CRM-SC 12345",
            "verified": true,
            "location": [
                "name": "Consultório",
                "address": "Rua das Palmeiras, 10",
                "district": "Centro",
                "city": "Joinville",
                "state": "SC",
                "authorized": true,
            ],
            "insurances": [["name": "Unimed", "status": "confirmed"]],
            "modalities": ["in_person", "telemedicine"],
            "contacts": [
                "whatsApp": ["verified": true, "href": "https://wa.me/5547999999999"],
                "phone": ["verified": true, "href": "tel:+554730000000"],
            ],
        ]

        let profile = FirestorePublicProfileMapper.map(id: "doctor-1", data: data)

        XCTAssertEqual(profile.id, "doctor-1")
        XCTAssertEqual(profile.specialty, "Dermatologia")
        XCTAssertEqual(profile.insurances, [ProfileInsurance(name: "Unimed", confirmed: true)])
        XCTAssertEqual(profile.modalities, [.inPerson, .externalTelemedicine])
        XCTAssertEqual(profile.location.address, "Rua das Palmeiras, 10")
        XCTAssertEqual(profile.location.visibleAddress, "Rua das Palmeiras, 10")
        XCTAssertEqual(try XCTUnwrap(profile.contacts.whatsApp).url.host, "wa.me")
        XCTAssertEqual(try XCTUnwrap(profile.contacts.phone).url.scheme, "tel")
    }

    @MainActor
    func testRejectsUnverifiedOrUnexpectedContactDestinations() {
        let data: [String: Any] = [
            "contacts": [
                "whatsApp": ["verified": true, "href": "https://example.com/unsafe"],
                "phone": ["verified": false, "href": "tel:+554730000000"],
            ],
        ]

        let profile = FirestorePublicProfileMapper.map(id: "doctor-1", data: data)

        XCTAssertNil(profile.contacts.whatsApp)
        XCTAssertNil(profile.contacts.phone)
    }

    @MainActor
    func testDiscardsAddressWhenLocationIsNotAuthorized() {
        let profile = FirestorePublicProfileMapper.map(
            id: "doctor-private-location",
            data: [
                "claimed": true,
                "pendingChange": "Endereço novo aguardando conferência.",
                "location": [
                    "name": "Consultório particular",
                    "address": "Rua que não pode aparecer, 99",
                    "city": "Joinville",
                    "authorized": false,
                ],
            ]
        )

        XCTAssertNil(profile.location.address)
        XCTAssertNil(profile.location.visibleAddress)
        XCTAssertTrue(profile.claimed)
        XCTAssertEqual(profile.pendingChange, "Endereço novo aguardando conferência.")
        XCTAssertEqual(profile.location.name, "Consultório particular")
    }

    @MainActor
    func testStaleAvailabilityDegradesToConfirmationRequired() {
        let data: [String: Any] = [
            "availability": [
                "confirmed": true,
                "nextAvailableAt": "2026-07-20T10:00:00-03:00",
                "updatedAt": Timestamp(date: Date.now.addingTimeInterval(-3_600)),
            ],
        ]

        let profile = FirestorePublicProfileMapper.map(id: "doctor-1", data: data)

        XCTAssertEqual(profile.availability, "Disponibilidade a confirmar")
    }
}
