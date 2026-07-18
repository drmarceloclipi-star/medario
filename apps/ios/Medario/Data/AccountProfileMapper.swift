import Foundation

enum AccountProfileMapper {
    static func profile(from data: [String: Any], fallbackEmail: String) -> AccountProfile {
        let email = normalizedString(data["email"]) ?? fallbackEmail
        let preferences = AccountPreferences(
            city: normalizedString(data["cidade"]) ?? "",
            insurance: normalizedString(data["convenio"]) ?? "",
            modality: normalizedString(data["tipo_atendimento"]) ?? "",
            language: normalizedString(data["idioma"]) ?? "Português",
            accessibilitySupport: data["acessibilidade"] as? Bool == true
        )
        return AccountProfile(
            email: email,
            preferences: preferences,
            healthConsent: data["consent_preferences"] as? Bool == true
        )
    }

    static func firestoreFields(from preferences: AccountPreferences) -> [String: Any] {
        [
            "cidade": nullableString(preferences.city),
            "convenio": nullableString(preferences.insurance),
            "tipo_atendimento": nullableString(preferences.modality),
            "idioma": normalizedString(preferences.language) ?? "Português",
            "acessibilidade": preferences.accessibilitySupport,
        ]
    }

    private static func normalizedString(_ value: Any?) -> String? {
        guard let string = value as? String else { return nil }
        let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    private static func nullableString(_ value: String) -> Any {
        normalizedString(value) ?? NSNull()
    }
}
