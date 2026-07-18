import Foundation
@testable import Medario

enum PublicProfileFixture {
    static let mariana = PublicProfile(
        id: "mariana",
        slug: "dra-mariana-andrade",
        name: "Dra. Mariana Andrade",
        specialty: "Dermatologia",
        crm: "CRM-SC 12345",
        rqe: "RQE 6789",
        bio: "Atendimento dermatológico.",
        verified: true,
        claimed: true,
        updatedAt: Date(timeIntervalSince1970: 1_700_000_000),
        pendingChange: nil,
        location: ProfileLocation(
            name: "Consultório",
            address: "Rua das Palmeiras, 10",
            district: "Centro",
            city: "Joinville",
            state: "SC",
            authorized: true,
            latitude: -26.3044,
            longitude: -48.8461
        ),
        insurances: [ProfileInsurance(name: "Unimed", confirmed: true)],
        modalities: [.inPerson],
        availability: "Disponibilidade a confirmar",
        contacts: ProfileContacts(whatsApp: nil, phone: nil)
    )
}
