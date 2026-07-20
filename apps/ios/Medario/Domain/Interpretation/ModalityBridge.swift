import Foundation

nonisolated enum ModalityBridge {
    static func toSaved(_ consultation: ConsultationModality) -> SavedSearchModality {
        switch consultation {
        case .inPerson: .inPerson
        case .externalTelemedicine: .telemedicine
        }
    }

    static func toConsultation(_ saved: SavedSearchModality) -> ConsultationModality {
        switch saved {
        case .inPerson: .inPerson
        case .telemedicine: .externalTelemedicine
        }
    }
}