import Foundation

struct PublicProfile: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let slug: String
    let name: String
    let specialty: String
    let crm: String
    let rqe: String?
    let bio: String
    let verified: Bool
    let claimed: Bool
    let updatedAt: Date?
    let pendingChange: String?
    let location: ProfileLocation
    let insurances: [ProfileInsurance]
    let modalities: [ConsultationModality]
    let availability: String
    let contacts: ProfileContacts

    var searchableText: String {
        ([name, specialty, location.city, location.district] + insurances.map(\.name))
            .joined(separator: " ")
    }
}
