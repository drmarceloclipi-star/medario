import Foundation
import Observation

@MainActor
@Observable
final class DirectoryViewModel {
    private let repository: any PublicDirectoryRepository
    private let urgencyProtocol: UrgencyProtocol
    private(set) var state: DirectoryLoadState = .idle
    private(set) var lastQuery = ""
    private(set) var lastCriteria = SavedSearchCriteria()
    private var generation = 0

    init(repository: any PublicDirectoryRepository,
         urgencyProtocol: UrgencyProtocol = .default) {
        self.repository = repository
        self.urgencyProtocol = urgencyProtocol
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
            let profiles = try await repository.profiles(matching: query).filter { $0.matches(criteria) }
            guard requestGeneration == generation else { return }
            state = .loaded(profiles)
        } catch {
            guard requestGeneration == generation else { return }
            state = .failed("Não foi possível carregar o diretório. Verifique sua conexão e tente novamente.")
        }
    }

    func dismissUrgency() async {
        await load()
    }

    func retry() async {
        await load(query: lastQuery, criteria: lastCriteria)
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
