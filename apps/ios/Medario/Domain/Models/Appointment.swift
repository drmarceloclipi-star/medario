import Foundation

enum AppointmentModality: String, Sendable {
    case inPerson = "in_person"
    case telemedicine

    var displayName: String { self == .telemedicine ? "Teleconsulta" : "Presencial" }
}

enum AppointmentStatus: String, Sendable {
    case requested
    case confirmed
    case declined
    case rescheduleProposed = "reschedule_proposed"
    case rescheduleRequested = "reschedule_requested"
    case cancelRequested = "cancel_requested"
    case cancelled
    case completed
    case noShow = "no_show"

    var displayName: String {
        switch self {
        case .requested: "Aguardando confirmação"
        case .confirmed: "Confirmado"
        case .declined: "Recusado"
        case .rescheduleProposed: "Novo horário proposto"
        case .rescheduleRequested: "Remarcação solicitada"
        case .cancelRequested: "Cancelamento solicitado"
        case .cancelled: "Cancelado"
        case .completed: "Realizado"
        case .noShow: "Não compareceu"
        }
    }

    var canCancel: Bool { self == .requested || self == .confirmed }
}

struct AppointmentTypeOption: Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let modality: AppointmentModality
    let locationLabel: String
    let confirmationPolicy: String
    let cancellationPolicy: String
    let priceCents: Int?
}

struct AppointmentSlot: Identifiable, Hashable, Sendable {
    let id: String
    let typeID: String
    let startsAt: Date
    let endsAt: Date
}

struct AppointmentOptions: Sendable {
    let doctorID: String
    let doctorName: String
    let doctorSlug: String
    let calendarAvailable: Bool
    let types: [AppointmentTypeOption]
    let slots: [AppointmentSlot]
}

struct PatientAppointment: Identifiable, Hashable, Sendable {
    let id: String
    let doctorID: String
    let doctorName: String
    let doctorSlug: String
    let typeLabel: String
    let typeID: String
    let modality: AppointmentModality
    let startsAt: Date?
    let endsAt: Date?
    let timezone: String
    let locationLabel: String
    let cancellationPolicy: String
    let priceCents: Int?
    let confirmationPolicy: String
    let status: AppointmentStatus
    let requestedAt: Date?
    let proposedStartsAt: Date?
    let proposedEndsAt: Date?
}

struct AppointmentPage: Sendable {
    let items: [PatientAppointment]
}

struct AppointmentRequestResult: Sendable {
    let appointmentID: String
    let status: AppointmentStatus
    let replayed: Bool
}
