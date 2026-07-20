import Foundation
@testable import Medario

@MainActor
enum TestProfileFactory {

    static let profiles: [PublicProfile] = [
        makeProfile(id: "alpha", slug: "dr-alpha-cardio", name: "Dr. Alpha Cardoso", specialty: "Cardiologia",
                    city: "Joinville", state: "SC", insurance: "Unimed", modalities: [.inPerson]),
        makeProfile(id: "beta", slug: "dra-beta-dermato", name: "Dra. Beta Silva", specialty: "Dermatologia",
                    city: "Joinville", state: "SC", insurance: "Unimed", modalities: [.inPerson, .externalTelemedicine]),
        makeProfile(id: "gamma", slug: "dr-gamma-pediatra", name: "Dr. Gamma Souza", specialty: "Pediatria",
                    city: "Florianópolis", state: "SC", insurance: "Bradesco Saúde", modalities: [.inPerson]),
        makeProfile(id: "delta", slug: "dra-delta-psiqui", name: "Dra. Delta Oliveira", specialty: "Psiquiatria",
                    city: "Florianópolis", state: "SC", insurance: "SulAmérica", modalities: [.externalTelemedicine]),
        makeProfile(id: "epsilon", slug: "dr-epsilon-orto", name: "Dr. Epsilon Lima", specialty: "Ortopedia",
                    city: "Curitiba", state: "PR", insurance: "Amil", modalities: [.inPerson]),
        makeProfile(id: "zeta", slug: "dra-zeta-gineco", name: "Dra. Zeta Ferreira", specialty: "Ginecologia",
                    city: "Curitiba", state: "PR", insurance: "Unimed", modalities: [.inPerson, .externalTelemedicine]),
        makeProfile(id: "eta", slug: "dr-eta-neuro", name: "Dr. Eta Rocha", specialty: "Neurologia",
                    city: "São Paulo", state: "SP", insurance: "Bradesco Saúde", modalities: [.inPerson]),
        makeProfile(id: "theta", slug: "dra-theta-oftalmo", name: "Dra. Theta Mendes", specialty: "Oftalmologia",
                    city: "São Paulo", state: "SP", insurance: "SulAmérica", modalities: [.inPerson]),
        makeProfile(id: "iota", slug: "dr-iota-endo", name: "Dr. Iota Alves", specialty: "Endocrinologia",
                    city: "Joinville", state: "SC", insurance: "Amil", modalities: [.externalTelemedicine]),
        makeProfile(id: "kappa", slug: "dr-kappa-uro", name: "Dr. Kappa Dias", specialty: "Urologia",
                    city: "Florianópolis", state: "SC", insurance: "Unimed", modalities: [.inPerson]),
    ]

    static let catalog = DirectorySearchCatalog.from(profiles: profiles, query: "")

    static let specialties = Set(profiles.map(\.specialty)).sorted()
    static let cities = Set(profiles.map(\.location.city)).sorted()
    static let insurances = Set(profiles.flatMap { $0.insurances.map(\.name) }).sorted()

    private static func makeProfile(id: String, slug: String, name: String, specialty: String,
                                    city: String, state: String, insurance: String,
                                    modalities: [ConsultationModality]) -> PublicProfile {
        PublicProfile(
            id: id, slug: slug, name: name, specialty: specialty,
            crm: "CRM-\(state) 00000", rqe: nil, bio: "", verified: false, claimed: false,
            updatedAt: nil, pendingChange: nil,
            location: ProfileLocation(name: "Consultório", address: nil, district: "Centro",
                                      city: city, state: state, authorized: false,
                                      latitude: nil, longitude: nil),
            insurances: [ProfileInsurance(name: insurance, confirmed: true)],
            modalities: modalities, availability: "",
            contacts: ProfileContacts(whatsApp: nil, phone: nil)
        )
    }
}