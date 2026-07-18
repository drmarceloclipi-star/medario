import XCTest
@testable import Medario

@MainActor
final class AccountProfileMapperTests: XCTestCase {
    func testMapsBackendFieldNamesAndDefaults() {
        let profile = AccountProfileMapper.profile(
            from: [
                "email": "patient@example.com",
                "cidade": " Joinville ",
                "convenio": "Unimed",
                "tipo_atendimento": "Telemedicina",
                "idioma": "",
                "acessibilidade": true,
                "consent_preferences": true,
            ],
            fallbackEmail: "fallback@example.com"
        )

        XCTAssertEqual(profile.email, "patient@example.com")
        XCTAssertEqual(profile.preferences.city, "Joinville")
        XCTAssertEqual(profile.preferences.insurance, "Unimed")
        XCTAssertEqual(profile.preferences.modality, "Telemedicina")
        XCTAssertEqual(profile.preferences.language, "Português")
        XCTAssertTrue(profile.preferences.accessibilitySupport)
        XCTAssertTrue(profile.healthConsent)
    }

    func testUsesFallbackEmailAndSafeFalseDefaultsForMissingProfile() {
        let profile = AccountProfileMapper.profile(from: [:], fallbackEmail: "fallback@example.com")

        XCTAssertEqual(profile.email, "fallback@example.com")
        XCTAssertEqual(profile.preferences, AccountPreferences())
        XCTAssertFalse(profile.healthConsent)
    }

    func testFirestoreFieldsTrimValuesAndClearEmptyOptionalFields() {
        let fields = AccountProfileMapper.firestoreFields(
            from: AccountPreferences(
                city: "  Joinville ",
                insurance: "",
                modality: " Presencial ",
                language: "  ",
                accessibilitySupport: true
            )
        )

        XCTAssertEqual(fields["cidade"] as? String, "Joinville")
        XCTAssertTrue(fields["convenio"] is NSNull)
        XCTAssertEqual(fields["tipo_atendimento"] as? String, "Presencial")
        XCTAssertEqual(fields["idioma"] as? String, "Português")
        XCTAssertEqual(fields["acessibilidade"] as? Bool, true)
    }

    func testRejectsWrongBackendTypesInsteadOfCoercingSensitivePreferences() {
        let profile = AccountProfileMapper.profile(
            from: [
                "cidade": 123,
                "convenio": true,
                "acessibilidade": "true",
                "consent_preferences": 1,
            ],
            fallbackEmail: "patient@example.com"
        )

        XCTAssertEqual(profile.preferences.city, "")
        XCTAssertEqual(profile.preferences.insurance, "")
        XCTAssertFalse(profile.preferences.accessibilitySupport)
        XCTAssertFalse(profile.healthConsent)
    }
}
