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

        var doctorSlug: String?
        var specialty: String?
        var city: String?
        var insurance: String?
        var modality: SavedSearchModality?

        // Doctor: match query against candidate names
        if !catalog.doctorCandidates.isEmpty {
            for candidate in catalog.doctorCandidates {
                let normalizedName = candidate.name.folding(options: options, locale: locale)
                if normalized.localizedStandardContains(normalizedName)
                    || normalizedName.localizedStandardContains(normalized) {
                    doctorSlug = candidate.slug
                    break
                }
            }
        }

        // Specialty
        if !catalog.specialties.isEmpty {
            for spec in catalog.specialties {
                let normalizedSpec = spec.folding(options: options, locale: locale)
                if normalized.localizedStandardContains(normalizedSpec)
                    || normalizedSpec.localizedStandardContains(normalized) {
                    specialty = spec
                    break
                }
            }
        }

        // City
        if !catalog.cities.isEmpty {
            for c in catalog.cities {
                let normalizedCity = c.folding(options: options, locale: locale)
                if normalized.localizedStandardContains(normalizedCity)
                    || normalizedCity.localizedStandardContains(normalized) {
                    city = c
                    break
                }
            }
        }

        // Insurance
        if !catalog.insurances.isEmpty {
            for ins in catalog.insurances {
                let normalizedIns = ins.folding(options: options, locale: locale)
                if normalized.localizedStandardContains(normalizedIns)
                    || normalizedIns.localizedStandardContains(normalized) {
                    insurance = ins
                    break
                }
            }
        }

        // Modality: detect keywords
        if normalized.contains("presencial") || normalized.contains("presencia") {
            modality = .inPerson
        } else if normalized.contains("teleconsulta") || normalized.contains("telemedicina")
                    || normalized.contains("online") || normalized.contains("remoto") {
            modality = .telemedicine
        }

        let result = InterpretedSearch(
            doctorSlug: doctorSlug, specialty: specialty, city: city,
            insurance: insurance, modality: modality
        )

        return result.isEmpty ? .unsupported : .matched(result)
    }
}