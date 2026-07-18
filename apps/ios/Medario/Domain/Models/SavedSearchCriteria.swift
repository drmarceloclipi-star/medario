import Foundation

struct SavedSearchCriteria: Codable, Hashable, Sendable {
    var specialty: String?
    var city: String?
    var insurance: String?
    var modality: SavedSearchModality?

    init(
        specialty: String? = nil,
        city: String? = nil,
        insurance: String? = nil,
        modality: SavedSearchModality? = nil
    ) {
        self.specialty = Self.clean(specialty)
        self.city = Self.clean(city)
        self.insurance = Self.clean(insurance)
        self.modality = modality
    }

    var isEmpty: Bool {
        specialty == nil && city == nil && insurance == nil && modality == nil
    }

    var isPersistable: Bool {
        !isEmpty && [specialty, city, insurance].compactMap { $0 }.allSatisfy { $0.count <= 100 }
    }

    var summary: String {
        [specialty, city, insurance, modality?.displayName]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    var callablePayload: [String: String] {
        var payload: [String: String] = [:]
        if let specialty { payload["specialty"] = specialty }
        if let city { payload["city"] = city }
        if let insurance { payload["insurance"] = insurance }
        if let modality { payload["modality"] = modality.rawValue }
        return payload
    }

    private static func clean(_ value: String?) -> String? {
        let cleaned = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return cleaned.isEmpty ? nil : cleaned
    }
}

enum SavedSearchModality: String, Codable, CaseIterable, Hashable, Sendable {
    case inPerson = "in_person"
    case telemedicine

    var displayName: String {
        switch self {
        case .inPerson: "Presencial"
        case .telemedicine: "Teleconsulta"
        }
    }
}
