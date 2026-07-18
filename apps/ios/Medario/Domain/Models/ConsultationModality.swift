import Foundation

enum ConsultationModality: String, Codable, Hashable, Sendable {
    case inPerson = "Presencial"
    case externalTelemedicine = "Teleconsulta externa"
}
