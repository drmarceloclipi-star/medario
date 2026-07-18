import Foundation

@MainActor
final class FirebaseAppointmentRepository: AppointmentRepository {
    private let client: any AppointmentCallableClient
    private let decoder = AppointmentCallableMapper()

    init(client: any AppointmentCallableClient = FirebaseAppointmentCallableClient()) {
        self.client = client
    }

    func publicOptions(slug: String) async throws -> AppointmentOptions {
        try decoder.options(from: await client.call("listPublicAppointmentOptions", data: ["slug": slug]))
    }

    func request(doctorID: String, typeID: String, slotID: String, expectedUserID: String) async throws -> AppointmentRequestResult {
        try decoder.result(from: await client.call("createNativeAppointmentRequest", data: [
            "doctorId": doctorID,
            "typeId": typeID,
            "slotId": slotID,
            "idempotencyKey": UUID().uuidString,
            "expectedUid": expectedUserID,
        ]))
    }

    func myAppointments(expectedUserID: String) async throws -> AppointmentPage {
        try decoder.page(from: await client.call("listMyNativeAppointments", data: ["limit": 50, "expectedUid": expectedUserID]))
    }

    func cancel(appointmentID: String, expectedUserID: String) async throws -> AppointmentRequestResult {
        try decoder.result(from: await client.call("requestNativeAppointmentCancellation", data: [
            "appointmentId": appointmentID,
            "expectedUid": expectedUserID,
        ]))
    }

    func reschedule(appointmentID: String, slotID: String, expectedUserID: String) async throws -> AppointmentRequestResult {
        try decoder.result(from: await client.call("requestNativeAppointmentReschedule", data: [
            "appointmentId": appointmentID,
            "slotId": slotID,
            "expectedUid": expectedUserID,
        ]))
    }
}

struct AppointmentCallableMapper: Sendable {
    func options(from value: Any) throws -> AppointmentOptions {
        let root = try dictionary(value)
        let types = (root["types"] as? [[String: Any]] ?? []).compactMap { item -> AppointmentTypeOption? in
            guard let id = item["id"] as? String,
                  let label = item["label"] as? String,
                  let modalityRaw = item["modality"] as? String,
                  let modality = AppointmentModality(rawValue: modalityRaw),
                  let confirmation = item["confirmationPolicy"] as? String,
                  let cancellation = item["cancellationPolicy"] as? String else { return nil }
            return AppointmentTypeOption(
                id: id,
                label: label,
                modality: modality,
                locationLabel: item["locationLabel"] as? String ?? (modality == .telemedicine ? "Teleconsulta" : "Local de atendimento"),
                confirmationPolicy: confirmation,
                cancellationPolicy: cancellation,
                priceCents: Self.integer(item["priceCents"])
            )
        }
        let slots = (root["slots"] as? [[String: Any]] ?? []).compactMap { item -> AppointmentSlot? in
            guard let id = item["id"] as? String,
                  let typeID = item["typeId"] as? String,
                  let startsAt = Self.date(item["startsAt"]),
                  let endsAt = Self.date(item["endsAt"]) else { return nil }
            return AppointmentSlot(id: id, typeID: typeID, startsAt: startsAt, endsAt: endsAt)
        }
        guard let doctorID = root["doctorId"] as? String,
              let doctorName = root["doctorName"] as? String,
              let doctorSlug = root["doctorSlug"] as? String else { throw MappingError.invalidResponse }
        return AppointmentOptions(doctorID: doctorID, doctorName: doctorName, doctorSlug: doctorSlug, calendarAvailable: root["calendarAvailable"] as? Bool == true, types: types, slots: slots)
    }

    func page(from value: Any) throws -> AppointmentPage {
        let root = try dictionary(value)
        let items = (root["items"] as? [[String: Any]] ?? []).compactMap { appointment($0) }
        return AppointmentPage(items: items)
    }

    func result(from value: Any) throws -> AppointmentRequestResult {
        let root = try dictionary(value)
        guard let id = root["appointmentId"] as? String,
              let rawStatus = root["status"] as? String,
              let status = AppointmentStatus(rawValue: rawStatus) else { throw MappingError.invalidResponse }
        return AppointmentRequestResult(appointmentID: id, status: status, replayed: root["replayed"] as? Bool == true)
    }

    private func appointment(_ item: [String: Any]) -> PatientAppointment? {
        guard let id = item["id"] as? String,
              let doctorID = item["doctorId"] as? String,
              let rawStatus = item["status"] as? String,
              let status = AppointmentStatus(rawValue: rawStatus) else { return nil }
        return PatientAppointment(
            id: id,
            doctorID: doctorID,
            doctorName: item["doctorName"] as? String ?? "Perfil médico",
            doctorSlug: item["doctorSlug"] as? String ?? "",
            typeLabel: item["typeLabel"] as? String ?? "Consulta",
            typeID: item["typeId"] as? String ?? "",
            modality: AppointmentModality(rawValue: item["modality"] as? String ?? "") ?? .inPerson,
            startsAt: Self.date(item["startsAt"]),
            endsAt: Self.date(item["endsAt"]),
            timezone: item["timezone"] as? String ?? "America/Sao_Paulo",
            locationLabel: item["locationLabel"] as? String ?? "Local a confirmar",
            cancellationPolicy: item["cancellationPolicy"] as? String ?? "Consulte condições com o médico.",
            priceCents: Self.integer(item["priceCents"]),
            confirmationPolicy: item["confirmationPolicy"] as? String ?? "manual",
            status: status,
            requestedAt: Self.date(item["requestedAt"]),
            proposedStartsAt: Self.date(item["proposedStartsAt"]),
            proposedEndsAt: Self.date(item["proposedEndsAt"])
        )
    }

    private func dictionary(_ value: Any) throws -> [String: Any] {
        guard let root = value as? [String: Any] else { throw MappingError.invalidResponse }
        return root
    }

    private static func integer(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? NSNumber { return value.intValue }
        return nil
    }

    private static func date(_ value: Any?) -> Date? {
        guard let text = value as? String else { return nil }
        return ISO8601DateFormatter().date(from: text)
    }

    private enum MappingError: Error { case invalidResponse }
}
