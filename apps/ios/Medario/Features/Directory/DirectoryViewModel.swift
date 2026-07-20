import Foundation
import Observation

@MainActor
@Observable
final class DirectoryViewModel {
    private let repository: any PublicDirectoryRepository
    private let urgencyProtocol: UrgencyProtocol
    private let interpreter: any SearchInterpreter
    private let interpretationTimeout: Duration
    private(set) var state: DirectoryLoadState = .idle
    internal(set) var lastQuery = ""
    internal(set) var lastCriteria = SavedSearchCriteria()
    internal(set) var derivedCriteria = SavedSearchCriteria()
    private var generation = 0
    private var skipNextInterpretation = false
    private var currentTask: Task<Void, Never>?

    init(repository: any PublicDirectoryRepository,
         urgencyProtocol: UrgencyProtocol = .default,
         interpreter: any SearchInterpreter = FallbackSearchInterpreter(),
         interpretationTimeout: Duration = .seconds(15)) {
        self.repository = repository
        self.urgencyProtocol = urgencyProtocol
        self.interpreter = interpreter
        self.interpretationTimeout = interpretationTimeout
    }

    func submit(query: String, criteria: SavedSearchCriteria = SavedSearchCriteria()) {
        currentTask?.cancel()
        currentTask = Task { @MainActor in
            await load(query: query, criteria: criteria)
        }
    }

    func prewarm() {
        Task { await interpreter.prewarm() }
    }

    func awaitCompletion() async {
        await currentTask?.value
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

            let needsInterpretation = !query.isEmpty && criteria.specialty == nil
                && criteria.doctorSlug == nil && !skipNextInterpretation
            skipNextInterpretation = false

            if needsInterpretation {
                let catalog = DirectorySearchCatalog.from(profiles: profiles, query: query)
                let interpretation = await interpretWithTimeout(query: query, catalog: catalog)
                guard requestGeneration == generation else { return }

                switch interpretation {
                case .matched(let interpreted):
                    derivedCriteria = SavedSearchCriteria(
                        doctorSlug: interpreted.doctorSlug,
                        specialty: interpreted.specialty,
                        city: interpreted.city,
                        insurance: interpreted.insurance,
                        modality: interpreted.modality
                    )
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

    func dismissUrgency() {
        submit(query: "", criteria: SavedSearchCriteria())
    }

    func dismissClarification() {
        submit(query: "", criteria: SavedSearchCriteria())
    }

    var effectiveCriteria: SavedSearchCriteria {
        mergeCriteria(manual: lastCriteria, derived: derivedCriteria)
    }

    func promoteDerivedToManual() {
        lastCriteria = effectiveCriteria
        derivedCriteria = SavedSearchCriteria()
    }

    func removeDerivedSpecialty() {
        derivedCriteria.specialty = nil
        skipNextInterpretation = true
        submit(query: lastQuery, criteria: lastCriteria)
    }

    func removeDerivedDoctor() {
        derivedCriteria.doctorSlug = nil
        skipNextInterpretation = true
        submit(query: lastQuery, criteria: lastCriteria)
    }

    func removeDerivedCity() {
        derivedCriteria.city = nil
        skipNextInterpretation = true
        submit(query: lastQuery, criteria: lastCriteria)
    }

    func removeDerivedInsurance() {
        derivedCriteria.insurance = nil
        skipNextInterpretation = true
        submit(query: lastQuery, criteria: lastCriteria)
    }

    func removeDerivedModality() {
        derivedCriteria.modality = nil
        skipNextInterpretation = true
        submit(query: lastQuery, criteria: lastCriteria)
    }

    func retry() {
        submit(query: lastQuery, criteria: lastCriteria)
    }

    private func interpretWithTimeout(query: String, catalog: DirectorySearchCatalog) async -> SearchInterpretation {
        let task = Task { @MainActor in
            await self.interpreter.interpret(query, catalog: catalog)
        }
        let timeout = Task { @MainActor in
            try? await Task.sleep(for: self.interpretationTimeout)
            task.cancel()
        }
        let result = await task.value
        timeout.cancel()
        return result
    }

    private func mergeCriteria(manual: SavedSearchCriteria, derived: SavedSearchCriteria) -> SavedSearchCriteria {
        var merged = derived
        if manual.doctorSlug != nil { merged.doctorSlug = manual.doctorSlug }
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
        if let slug = criteria.doctorSlug, self.slug != slug { return false }
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