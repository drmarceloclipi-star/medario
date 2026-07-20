import Foundation

#if canImport(FoundationModels)
import FoundationModels

@available(iOS 26, *)
@Generable
struct DirectorySearchResponse {
    @Guide(description: "Slug do médico escolhido do catálogo, ou string vazia se nenhum")
    var doctorSlug: String
    @Guide(description: "Nome da especialidade médica do catálogo, ou string vazia")
    var specialty: String
    @Guide(description: "Nome da cidade do catálogo, ou string vazia")
    var city: String
    @Guide(description: "Nome do convênio do catálogo, ou string vazia")
    var insurance: String
    @Guide(description: "Modalidade: in_person ou telemedicine, ou string vazia")
    var modality: String
}
#endif

@MainActor
final class FoundationModelSearchInterpreter: SearchInterpreter {
    func interpret(_ query: String, catalog: DirectorySearchCatalog) async -> SearchInterpretation {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return .unsupported }
        guard !catalog.specialties.isEmpty || !catalog.cities.isEmpty
              || !catalog.insurances.isEmpty || !catalog.doctorCandidates.isEmpty
        else { return .unsupported }

        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            let model = SystemLanguageModel.default
            guard case .available = model.availability else { return .unsupported }
            guard Locale.current.language.languageCode?.identifier == "pt" else { return .unsupported }

            do {
                let session = LanguageModelSession(model: model)
                let specialtyList = catalog.specialties.joined(separator: ", ")
                let cityList = catalog.cities.joined(separator: ", ")
                let insuranceList = catalog.insurances.joined(separator: ", ")
                let doctorList = catalog.doctorCandidates
                    .map { "\($0.slug) (\($0.name))" }
                    .joined(separator: ", ")

                let prompt = """
                Catálogo de especialidades: \(specialtyList)
                Catálogo de cidades: \(cityList)
                Catálogo de convênios: \(insuranceList)
                Médicos candidatos (slug, nome): \(doctorList)
                Busca: \(trimmed)
                Identifique os critérios correspondentes. \
                Use exatamente os valores do catálogo. \
                Se um critério não corresponder, retorne string vazia para esse campo.
                """

                let response = try await session.respond(to: prompt, generating: DirectorySearchResponse.self)
                let content = response.content
                let doctor = content.doctorSlug.trimmingCharacters(in: .whitespaces)
                let specialty = content.specialty.trimmingCharacters(in: .whitespaces)
                let city = content.city.trimmingCharacters(in: .whitespaces)
                let insurance = content.insurance.trimmingCharacters(in: .whitespaces)
                let modalityStr = content.modality.trimmingCharacters(in: .whitespaces)

                var interpretedDoctor: String?
                var interpretedSpecialty: String?
                var interpretedCity: String?
                var interpretedInsurance: String?
                var interpretedModality: SavedSearchModality?

                if !doctor.isEmpty && catalog.containsDoctor(slug: doctor) {
                    interpretedDoctor = doctor
                }
                if !specialty.isEmpty && catalog.contains(specialty: specialty) {
                    interpretedSpecialty = specialty
                }
                if !city.isEmpty && catalog.contains(city: city) {
                    interpretedCity = city
                }
                if !insurance.isEmpty && catalog.contains(insurance: insurance) {
                    interpretedInsurance = insurance
                }
                if !modalityStr.isEmpty {
                    if modalityStr == "in_person" {
                        interpretedModality = .inPerson
                    } else if modalityStr == "telemedicine" {
                        interpretedModality = .telemedicine
                    }
                }

                let interpreted = InterpretedSearch(
                    doctorSlug: interpretedDoctor,
                    specialty: interpretedSpecialty,
                    city: interpretedCity,
                    insurance: interpretedInsurance,
                    modality: interpretedModality
                )

                guard !interpreted.isEmpty else { return .unsupported }
                return .matched(interpreted)
            } catch {
                return .unsupported
            }
        }
        #endif
        return .unsupported
    }
}