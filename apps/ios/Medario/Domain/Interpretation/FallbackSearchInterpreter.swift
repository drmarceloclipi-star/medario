import Foundation

@MainActor
final class FallbackSearchInterpreter: SearchInterpreter {
    func interpret(_ query: String, catalog: DirectorySearchCatalog) async -> SearchInterpretation {
        let options: NSString.CompareOptions = [.diacriticInsensitive, .caseInsensitive]
        let locale = Locale(identifier: "pt-BR")
        let normalized = query
            .folding(options: options, locale: locale)
            .trimmingCharacters(in: .whitespaces)
        guard !normalized.isEmpty else { return .unsupported }
        guard !catalog.specialties.isEmpty else { return .unsupported }
        for specialty in catalog.specialties {
            let normalizedSpecialty = specialty.folding(options: options, locale: locale)
            if normalized.localizedStandardContains(normalizedSpecialty)
                || normalizedSpecialty.localizedStandardContains(normalized) {
                return .matched(specialty: specialty)
            }
        }
        return .unsupported
    }
}