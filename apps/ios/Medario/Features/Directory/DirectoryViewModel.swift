import Foundation
import Observation

@MainActor
@Observable
final class DirectoryViewModel {
    private let repository: any PublicDirectoryRepository
    private let urgencyProtocol: UrgencyProtocol
    private let interpreter: any SearchInterpreter
    private(set) var state: DirectoryLoadState = .idle
    private(set) var lastQuery = ""
    private(set) var lastCriteria = SavedSearchCriteria()
    private(set) var derivedCriteria = SavedSearchCriteria()
    private var generation = 0
    private var skipNextInterpretation = false

    init(repository: any PublicDirectoryRepository,
         urgencyProtocol: UrgencyProtocol = .default,
         interpreter: any SearchInterpreter = FallbackSearchInterpreter()) {
        self.repository = repository
        self.urgencyProtocol = urgencyProtocol
        self.interpreter = interpreter
    }

    func load(query: String = "", criteria: SavedSearchCriteria = SavedSearchCriteria()) async {
        if case .urgent(let message) = urgencyProtocol.evaluate(query) {
            generation += 1
            lastQuery = query
            lastCriteria = criteria
            state = .urgent(message)
            return
        }

        generation += 1
        let requestGeneration = generation
        lastQuery = query
        lastCriteria = criteria
        state = .loading

        do {
            let profiles = try await repository.profiles(matching: "")
            guard requestGeneration == generation else { return }

            let needsInterpretation = !query.isEmpty && criteria.specialty == nil && !skipNextInterpretation
            skipNextInterpretation = false

            if needsInterpretation {
                let catalog = DirectorySearchCatalog.from(profiles: profiles)
                let interpretation = await interpreter.interpret(query, catalog: catalog)
                guard requestGeneration == generation else { return }

                switch interpretation {
                case .matched(let specialty):
                    derivedCriteria = SavedSearchCriteria(specialty: specialty)
                    let effective = mergeCriteria(manual: criteria, derived: derivedCriteria)
                    let filtered = profiles.filter { $0.matches(effective) }
                    guard requestGeneration == generation else { return }
                    state = .loaded(filtered)
                case .needsClarification:
                    state = .needsClarification
                case .unsupported:
                    derivedCriteria = SavedSearchCriteria()
                    let filtered = textFilter(profiles: profiles, query: query).filter { $0.matches(criteria) }
                    guard requestGeneration == generation else { return }
                    state = .loaded(filtered)
                }
            } else {
                derivedCriteria = SavedSearchCriteria()
                let filtered = textFilter(profiles: profiles, query: query).filter { $0.matches(criteria) }
                guard requestGeneration == generation else { return }
                state = .loaded(filtered)
            }
        } catch {
            guard requestGeneration == generation else { return }
            state = .failed("Não foi possível carregar o diretório. Verifique sua conexão e tente novamente.")
        }
    }

    func dismissUrgency() async {
        await load()
    }

    func dismissClarification() async {
        await load()
    }

    func removeDerivedSpecialty() async {
        derivedCriteria.specialty = nil
        skipNextInterpretation = true
        await load(query: lastQuery, criteria: lastCriteria)
    }

    func retry() async {
        await load(query: lastQuery, criteria: lastCriteria)
    }

    private func mergeCriteria(manual: SavedSearchCriteria, derived: SavedSearchCriteria) -> SavedSearchCriteria {
        var merged = derived
        if manual.specialty != nil { merged.specialty = manual.specialty }
        if manual.city != nil { merged.city = manual.city }
        if manual.insurance != nil { merged.insurance = manual.insurance }
        if manual.modality != nil { merged.modality = manual.modality }
        return merged
    }

    private func textFilter(profiles: [PublicProfile], query: String) -> [PublicProfile] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return profiles }
        return profiles.filter { $0.searchableText.localizedStandardContains(trimmed) }
    }
}
private extension PublicProfile {
    func matches(_ criteria: SavedSearchCriteria) -> Bool {
        if let specialty = criteria.specialty,
           !self.specialty.localizedStandardContains(specialty) { return false }
        if let city = criteria.city,
           !location.city.localizedStandardContains(city) { return false }
        if let insurance = criteria.insurance,
           !insurances.contains(where: { $0.name.localizedStandardContains(insurance) }) { return false }
        if let modality = criteria.modality {
            switch modality {
            case .inPerson where !modalities.contains(.inPerson): return false
            case .telemedicine where !modalities.contains(.externalTelemedicine): return false
            default: break
            }
        }
        return true
    }
}
