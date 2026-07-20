import Foundation

nonisolated struct InterpretedSearch: Sendable, Equatable {
    let doctorSlug: String?
    let specialty: String?
    let city: String?
    let insurance: String?
    let modality: SavedSearchModality?

    init(doctorSlug: String? = nil, specialty: String? = nil, city: String? = nil,
         insurance: String? = nil, modality: SavedSearchModality? = nil) {
        self.doctorSlug = doctorSlug
        self.specialty = specialty
        self.city = city
        self.insurance = insurance
        self.modality = modality
    }

    var isEmpty: Bool {
        doctorSlug == nil && specialty == nil && city == nil
            && insurance == nil && modality == nil
    }
}

nonisolated enum SearchInterpretation: Sendable, Equatable {
    case matched(InterpretedSearch)
    case needsClarification
    case unsupported
}