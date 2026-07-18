import XCTest
@testable import Medario

final class ReleaseConfigurationTests: XCTestCase {
    func testExportComplianceDeclarationIsBundled() {
        XCTAssertEqual(Bundle.main.object(forInfoDictionaryKey: "ITSAppUsesNonExemptEncryption") as? Bool, false)
    }

    func testAppPrivacyManifestDeclaresUserDefaultsReasonWithoutTracking() throws {
        let url = try XCTUnwrap(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"))
        let data = try Data(contentsOf: url)
        var format = PropertyListSerialization.PropertyListFormat.xml
        let propertyList = try PropertyListSerialization.propertyList(from: data, options: [], format: &format)
        let root = try XCTUnwrap(propertyList as? [String: Any])
        XCTAssertEqual(root["NSPrivacyTracking"] as? Bool, false)

        let access = try XCTUnwrap(root["NSPrivacyAccessedAPITypes"] as? [[String: Any]])
        let userDefaults = try XCTUnwrap(access.first { item in
            item["NSPrivacyAccessedAPIType"] as? String == "NSPrivacyAccessedAPICategoryUserDefaults"
        })
        XCTAssertEqual(userDefaults["NSPrivacyAccessedAPITypeReasons"] as? [String], ["CA92.1"])
    }
}
