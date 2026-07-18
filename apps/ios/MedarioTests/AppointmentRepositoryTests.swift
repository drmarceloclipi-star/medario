import XCTest
@testable import Medario

final class AppointmentRepositoryTests: XCTestCase {
    @MainActor
    func testMapperBuildsSafeOptionsAndAppointmentDTOs() throws {
        let mapper = AppointmentCallableMapper()
        let options = try mapper.options(from: [
            "doctorId": "doctor-1",
            "doctorName": "Dra. Mariana",
            "doctorSlug": "mariana",
            "calendarAvailable": true,
            "types": [[
                "id": "type-1",
                "label": "Consulta",
                "modality": "telemedicine",
                "locationLabel": "Teleconsulta segura",
                "confirmationPolicy": "manual",
                "cancellationPolicy": "Até 24 horas antes.",
                "priceCents": 25000,
            ]],
            "slots": [[
                "id": "slot-1",
                "typeId": "type-1",
                "startsAt": "2030-01-10T12:00:00Z",
                "endsAt": "2030-01-10T12:30:00Z",
            ]],
        ])
        XCTAssertEqual(options.doctorID, "doctor-1")
        XCTAssertEqual(options.types.first?.modality, .telemedicine)
        XCTAssertEqual(options.types.first?.locationLabel, "Teleconsulta segura")
        XCTAssertEqual(options.types.first?.priceCents, 25000)
        XCTAssertEqual(options.slots.first?.typeID, "type-1")

        let page = try mapper.page(from: ["items": [[
            "id": "appointment-1",
            "doctorId": "doctor-1",
            "doctorName": "Dra. Mariana",
            "doctorSlug": "mariana",
            "typeLabel": "Consulta",
            "typeId": "type-1",
            "modality": "telemedicine",
            "startsAt": "2030-01-10T12:00:00Z",
            "endsAt": "2030-01-10T12:30:00Z",
            "timezone": "America/Sao_Paulo",
            "locationLabel": "Teleconsulta",
            "cancellationPolicy": "Até 24 horas antes.",
            "confirmationPolicy": "manual",
            "status": "confirmed",
            "requestedAt": "2030-01-01T12:00:00Z",
        ]]])
        XCTAssertEqual(page.items.first?.status, .confirmed)
        XCTAssertEqual(page.items.first?.doctorName, "Dra. Mariana")
    }

    @MainActor
    func testFirebaseRepositoryPinsPatientEffectsToExpectedUID() async throws {
        let client = MockAppointmentCallableClient()
        client.responses = [.request, .emptyPage, .cancellation, .reschedule]
        let repository = FirebaseAppointmentRepository(client: client)
        _ = try await repository.request(doctorID: "d1", typeID: "t1", slotID: "s1", expectedUserID: "user-1")
        _ = try await repository.myAppointments(expectedUserID: "user-1")
        _ = try await repository.cancel(appointmentID: "a1", expectedUserID: "user-1")
        _ = try await repository.reschedule(appointmentID: "a1", slotID: "s2", expectedUserID: "user-1")

        XCTAssertEqual(client.names, ["createNativeAppointmentRequest", "listMyNativeAppointments", "requestNativeAppointmentCancellation", "requestNativeAppointmentReschedule"])
        XCTAssertTrue(client.payloads.allSatisfy { $0["expectedUid"] as? String == "user-1" })
    }
}

@MainActor
private final class MockAppointmentCallableClient: AppointmentCallableClient {
    enum Response: Sendable { case request, emptyPage, cancellation, reschedule }
    var responses: [Response] = []
    private(set) var names: [String] = []
    private(set) var payloads: [[String: Any]] = []

    func call(_ name: String, data: sending [String: Any]) async throws -> sending Any {
        names.append(name)
        payloads.append(data)
        switch responses.removeFirst() {
        case .request: return ["appointmentId": "a1", "status": "requested", "replayed": false]
        case .emptyPage: return ["items": []]
        case .cancellation: return ["appointmentId": "a1", "status": "cancelled", "replayed": false]
        case .reschedule: return ["appointmentId": "a1", "status": "reschedule_requested", "replayed": false]
        }
    }
}
