import Foundation

nonisolated struct DirectorySearchCatalog: Sendable, Equatable {
    let specialties: [String]
    let cities: [String]
    let insurances: [String]
    let doctorCandidates: [DoctorCandidate]

    nonisolated struct DoctorCandidate: Sendable, Equatable {
        let slug: String
        let name: String
    }

    static func from(profiles: [PublicProfile], query: String = "") -> DirectorySearchCatalog {
        let specialties = Set(profiles.map(\.specialty)).filter { !$0.isEmpty }.sorted()
        let cities = Set(profiles.map(\.location.city)).filter { !$0.isEmpty }.sorted()
        let insurances = Set(profiles.flatMap { $0.insurances.map(\.name) }).filter { !$0.isEmpty }.sorted()

        let trimmed = query.trimmingCharacters(in: .whitespaces)
        let candidates: [DoctorCandidate]
        if trimmed.isEmpty {
            candidates = []
        } else {
            candidates = profiles
                .filter { $0.name.localizedStandardContains(trimmed) }
                .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
                .prefix(20)
                .map { DoctorCandidate(slug: $0.slug, name: $0.name) }
        }

        return DirectorySearchCatalog(
            specialties: specialties,
            cities: cities,
            insurances: insurances,
            doctorCandidates: candidates
        )
    }

    func contains(specialty: String) -> Bool { specialties.contains(specialty) }
    func contains(city: String) -> Bool { cities.contains(city) }
    func contains(insurance: String) -> Bool { insurances.contains(insurance) }
    func containsDoctor(slug: String) -> Bool { doctorCandidates.contains { $0.slug == slug } }
}