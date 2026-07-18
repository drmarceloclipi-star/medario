import XCTest
@testable import Medario

final class NativeNotificationPreferencesTests: XCTestCase {
    @MainActor
    func testCallableMappingDefaultsUnknownOrMissingValuesToDenied() {
        let preferences = NativeNotificationPreferences.fromCallable([
            "appointment_confirmed": ["push": true],
            "profile_updated": ["push": false],
            "unknown": ["push": true],
        ])

        XCTAssertTrue(preferences.pushEnabled(for: .appointmentConfirmed))
        XCTAssertFalse(preferences.pushEnabled(for: .profileUpdated))
        XCTAssertFalse(preferences.pushEnabled(for: .savedSearchMaterial))
    }

    @MainActor
    func testCallablePayloadIncludesEveryEventWithExplicitDenial() {
        var preferences = NativeNotificationPreferences()
        preferences.setPush(true, for: .profileUpdated)

        let payload = preferences.callablePayload

        XCTAssertEqual((payload["appointment_confirmed"] as? [String: Bool])?["push"], false)
        XCTAssertEqual((payload["profile_updated"] as? [String: Bool])?["push"], true)
        XCTAssertEqual((payload["saved_search_material"] as? [String: Bool])?["push"], false)
    }
}
