import FirebaseFirestore
import Foundation

enum FirestorePublicProfileMapper {
    static func map(id: String, data: [String: Any]) -> PublicProfile {
        let location = dictionary(data["location"])
        let contacts = dictionary(data["contacts"])
        let availability = dictionary(data["availability"])
        let locationAuthorized = boolean(location["authorized"])

        return PublicProfile(
            id: id,
            slug: string(data["slug"], fallback: id),
            name: string(data["name"], fallback: "Perfil médico"),
            specialty: firstString(data["specialty"] ?? data["specialties"], fallback: "Especialidade não informada"),
            crm: string(data["crm"]),
            rqe: optionalString(data["rqe"]),
            bio: string(data["bio"]),
            verified: boolean(data["verified"], fallback: string(data["verificationStatus"]) == "verified"),
            claimed: boolean(data["claimed"]),
            updatedAt: date(data["updatedAt"] ?? data["updated_at"]),
            pendingChange: optionalString(data["pendingChange"] ?? data["pending_change"]),
            location: ProfileLocation(
                name: string(location["name"], fallback: "Local de atendimento"),
                address: locationAuthorized ? optionalString(location["address"] ?? location["addressLine"]) : nil,
                district: string(location["district"]),
                city: string(location["city"], fallback: "Joinville"),
                state: string(location["state"], fallback: "SC"),
                authorized: locationAuthorized,
                latitude: locationAuthorized ? number(location["latitude"]) : nil,
                longitude: locationAuthorized ? number(location["longitude"]) : nil
            ),
            insurances: insurances(data["insurances"]),
            modalities: modalities(data["modalities"] ?? data["appointmentTypes"]),
            availability: safeAvailability(data: data, availability: availability),
            contacts: ProfileContacts(
                whatsApp: contact(contacts["whatsApp"] ?? contacts["whatsapp"] ?? data["whatsApp"], kind: .whatsApp),
                phone: contact(contacts["phone"] ?? data["phone"], kind: .phone)
            )
        )
    }

    private enum ContactKind {
        case whatsApp
        case phone
    }

    private static func dictionary(_ value: Any?) -> [String: Any] {
        value as? [String: Any] ?? [:]
    }

    private static func string(_ value: Any?, fallback: String = "") -> String {
        (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? fallback
    }

    private static func optionalString(_ value: Any?) -> String? {
        string(value).nonEmpty
    }

    private static func firstString(_ value: Any?, fallback: String) -> String {
        if let value = value as? String { return value }
        if let values = value as? [String], let first = values.first { return first }
        if let value = value as? [String: Any] { return string(value["name"], fallback: fallback) }
        return fallback
    }

    private static func boolean(_ value: Any?, fallback: Bool = false) -> Bool {
        value as? Bool ?? fallback
    }

    private static func number(_ value: Any?) -> Double? {
        if let value = value as? Double { return value }
        if let value = value as? NSNumber { return value.doubleValue }
        return nil
    }

    private static func date(_ value: Any?) -> Date? {
        if let value = value as? Timestamp { return value.dateValue() }
        if let value = value as? Date { return value }
        if let value = value as? String { return try? Date(value, strategy: .iso8601) }
        return nil
    }

    private static func insurances(_ value: Any?) -> [ProfileInsurance] {
        guard let values = value as? [Any] else { return [] }
        return values.compactMap { value in
            if let name = value as? String, !name.isEmpty {
                return ProfileInsurance(name: name, confirmed: false)
            }
            let item = dictionary(value)
            guard let name = optionalString(item["name"]) else { return nil }
            return ProfileInsurance(
                name: name,
                confirmed: boolean(item["confirmed"], fallback: string(item["status"]) == "confirmed")
            )
        }
    }

    private static func modalities(_ value: Any?) -> [ConsultationModality] {
        guard let values = value as? [String] else { return [] }
        return values.map {
            $0 == "telemedicine" || $0 == ConsultationModality.externalTelemedicine.rawValue
                ? .externalTelemedicine
                : .inPerson
        }
    }

    private static func safeAvailability(data: [String: Any], availability: [String: Any]) -> String {
        let freshness = date(availability["updatedAt"] ?? availability["updated_at"] ?? data["availabilityUpdatedAt"] ?? data["availability_updated_at"])
        guard let freshness, Date.now.timeIntervalSince(freshness) <= 300 else {
            return "Disponibilidade a confirmar"
        }
        if boolean(availability["confirmed"]), let next = optionalString(availability["nextAvailableAt"]) {
            return "Vaga confirmada · \(next)"
        }
        if boolean(availability["acceptsNewPatients"]) { return "Aceita novos pacientes" }
        return "Disponibilidade a confirmar"
    }

    private static func contact(_ value: Any?, kind: ContactKind) -> VerifiedContact? {
        let record = dictionary(value)
        let isVerified = boolean(record["verified"])
        let raw = record.isEmpty ? string(value) : firstString(record["href"] ?? record["value"], fallback: "")
        guard isVerified, !raw.isEmpty else { return nil }

        let href: String
        switch kind {
        case .whatsApp:
            let digits = raw.filter(\.isNumber)
            href = raw.hasPrefix("https://") ? raw : "https://wa.me/\(digits)"
        case .phone:
            let digits = raw.filter { $0.isNumber || $0 == "+" }
            href = raw.hasPrefix("tel:") ? raw : "tel:\(digits)"
        }
        guard let url = URL(string: href), allowed(url: url, kind: kind) else { return nil }
        return VerifiedContact(url: url)
    }

    private static func allowed(url: URL, kind: ContactKind) -> Bool {
        switch kind {
        case .whatsApp:
            url.scheme == "https" && ["wa.me", "api.whatsapp.com"].contains(url.host ?? "")
        case .phone:
            url.scheme == "tel"
        }
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
