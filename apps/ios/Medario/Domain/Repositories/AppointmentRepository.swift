import Foundation

@MainActor
protocol AppointmentRepository: AnyObject {
    func publicOptions(slug: String) async throws -> AppointmentOptions
    func request(doctorID: String, typeID: String, slotID: String, expectedUserID: String) async throws -> AppointmentRequestResult
    func myAppointments(expectedUserID: String) async throws -> AppointmentPage
    func cancel(appointmentID: String, expectedUserID: String) async throws -> AppointmentRequestResult
    func reschedule(appointmentID: String, slotID: String, expectedUserID: String) async throws -> AppointmentRequestResult
}

@MainActor
protocol AppointmentCallableClient: AnyObject {
    func call(_ name: String, data: sending [String: Any]) async throws -> sending Any
}
