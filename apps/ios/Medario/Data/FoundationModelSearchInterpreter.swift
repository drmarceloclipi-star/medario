import Foundation

#if canImport(FoundationModels)
import FoundationModels

@available(iOS 26, *)
@Generable
struct SpecialtyResponse {
    @Guide(description: "Nome da especialidade médica exatamente como aparece no catálogo, ou string vazia se nenhuma corresponder")
    var specialty: String
}
#endif

@MainActor
final class FoundationModelSearchInterpreter: SearchInterpreter {
    func interpret(_ query: String, catalog: DirectorySearchCatalog) async -> SearchInterpretation {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !catalog.specialties.isEmpty else { return .unsupported }

        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            let model = SystemLanguageModel.default
            guard case .available = model.availability else { return .unsupported }
            guard Locale.current.language.languageCode?.identifier == "pt" else { return .unsupported }

            do {
                let session = LanguageModelSession(model: model)
                let catalogList = catalog.specialties.joined(separator: ", ")
                let prompt = """
                Catálogo de especialidades: \(catalogList)
                Busca: \(trimmed)
                Identifique a especialidade mais adequada. \
                Use exatamente o nome do catálogo. \
                Se nenhuma corresponder, retorne string vazia.
                """
                let response = try await session.respond(to: prompt, generating: SpecialtyResponse.self)
                let specialty = response.content.specialty.trimmingCharacters(in: .whitespaces)
                guard !specialty.isEmpty, catalog.contains(specialty) else { return .unsupported }
                return .matched(specialty: specialty)
            } catch {
                return .unsupported
            }
        }
        #endif
        return .unsupported
    }
}