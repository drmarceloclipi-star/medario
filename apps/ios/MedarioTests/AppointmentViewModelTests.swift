import XCTest
@testable import Medario

final class AppointmentViewModelTests: XCTestCase {
    @MainActor
    func testBookingRequiresAccountAndUsesSelectedSlot() async {
        let repository = MockAppointmentRepository()
        let account = MockAccountRepository()
        let viewModel = AppointmentOptionsViewModel(repository: repository, sessionSource: account)
        let type = AppointmentTypeOption(id: "type-1", label: "Consulta", modality: .inPerson, locationLabel: "Clínica", confirmationPolicy: "manual", cancellationPolicy: "Até o início.", priceCents: nil)
        let slot = AppointmentSlot(id: "slot-1", typeID: type.id, startsAt: .now.addingTimeInterval(3600), endsAt: .now.addingTimeInterval(5400))
        let options = AppointmentOptions(doctorID: "doctor-1", doctorName: "Dra.", doctorSlug: "dra", calendarAvailable: true, types: [type], slots: [slot])

        await viewModel.book(slot: slot, type: type, options: options)
        XCTAssertEqual(repository.requestCount, 0)

        account.currentSession = .signedIn(AccountUser(id: "user-1", email: "u@m.test", displayName: nil))
        await viewModel.book(slot: slot, type: type, options: options)
        XCTAssertEqual(repository.requestCount, 0)
        XCTAssertEqual(viewModel.feedback, "Confirme seu e-mail na aba Conta antes de reservar.")

        account.currentSession = .signedIn(AccountUser(id: "user-1", email: "u@m.test", displayName: nil, emailVerified: true))
        await viewModel.book(slot: slot, type: type, options: options)
        XCTAssertEqual(repository.requestCount, 1)
        XCTAssertEqual(repository.lastExpectedUserID, "user-1")
        XCTAssertEqual(repository.lastSlotID, "slot-1")
    }

    @MainActor
    func testAppointmentsResetWhenAccountChanges() async {
        let repository = MockAppointmentRepository()
        repository.page = AppointmentPage(items: [Self.appointment])
        let account = MockAccountRepository()
        account.currentSession = .signedIn(AccountUser(id: "user-1", email: "u@m.test", displayName: nil, emailVerified: true))
        let viewModel = MyAppointmentsViewModel(repository: repository, sessionSource: account)

        await viewModel.load()
        if case let .loaded(items) = viewModel.state { XCTAssertEqual(items.count, 1) } else { XCTFail("expected loaded") }
        account.emit(.signedIn(AccountUser(id: "user-2", email: "b@m.test", displayName: nil, emailVerified: true)))
        if case .idle = viewModel.state {} else { XCTFail("expected reset") }
    }

    private static let appointment = PatientAppointment(
        id: "a1", doctorID: "d1", doctorName: "Dra.", doctorSlug: "dra", typeLabel: "Consulta", typeID: "type-1",
        modality: .inPerson, startsAt: .now.addingTimeInterval(3600), endsAt: .now.addingTimeInterval(5400),
        timezone: "America/Sao_Paulo", locationLabel: "Clínica", cancellationPolicy: "Até o início.",
        priceCents: nil, confirmationPolicy: "manual", status: .confirmed, requestedAt: .now,
        proposedStartsAt: nil, proposedEndsAt: nil
    )
}

@MainActor
private final class MockAppointmentRepository: AppointmentRepository {
    var options = AppointmentOptions(doctorID: "doctor-1", doctorName: "Dra.", doctorSlug: "dra", calendarAvailable: false, types: [], slots: [])
    var page = AppointmentPage(items: [])
    private(set) var requestCount = 0
    private(set) var lastExpectedUserID: String?
    private(set) var lastSlotID: String?

    func publicOptions(slug: String) async throws -> AppointmentOptions { options }
    func request(doctorID: String, typeID: String, slotID: String, expectedUserID: String) async throws -> AppointmentRequestResult {
        requestCount += 1
        lastExpectedUserID = expectedUserID
        lastSlotID = slotID
        return AppointmentRequestResult(appointmentID: "a1", status: .requested, replayed: false)
    }
    func myAppointments(expectedUserID: String) async throws -> AppointmentPage { page }
    func cancel(appointmentID: String, expectedUserID: String) async throws -> AppointmentRequestResult {
        AppointmentRequestResult(appointmentID: appointmentID, status: .cancelled, replayed: false)
    }
    func reschedule(appointmentID: String, slotID: String, expectedUserID: String) async throws -> AppointmentRequestResult {
        AppointmentRequestResult(appointmentID: appointmentID, status: .rescheduleRequested, replayed: false)
    }
}
