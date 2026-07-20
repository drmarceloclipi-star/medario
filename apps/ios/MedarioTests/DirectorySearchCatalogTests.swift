import XCTest
@testable import Medario

final class DirectorySearchCatalogTests: XCTestCase {

    func testCatalogDeduplicatesSpecialties() {
        let profiles = [
            PublicProfileFixture.mariana,
            PublicProfileFixture.mariana,
            PublicProfileFixture.mariana,
        ]
        let catalog = DirectorySearchCatalog.from(profiles: profiles)
        XCTAssertEqual(catalog.specialties, ["Dermatologia"])
    }

    func testCatalogSortedAlphabetically() {
        let profiles = [
            PublicProfileFixture.mariana, // Dermatologia
        ]
        let catalog = DirectorySearchCatalog.from(profiles: profiles)
        XCTAssertEqual(catalog.specialties, ["Dermatologia"])
    }

    func testCatalogExcludesEmptySpecialties() {
        let profileWithEmptySpecialty = PublicProfile(
            id: "empty", slug: "empty", name: "Dr Empty", specialty: "",
            crm: "", rqe: nil, bio: "", verified: false, claimed: false,
            updatedAt: nil, pendingChange: nil,
            location: ProfileLocation(name: "Local", address: nil, district: "", city: "Joinville", state: "SC", authorized: false, latitude: nil, longitude: nil),
            insurances: [], modalities: [], availability: "", contacts: ProfileContacts(whatsApp: nil, phone: nil)
        )
        let catalog = DirectorySearchCatalog.from(profiles: [profileWithEmptySpecialty])
        XCTAssertTrue(catalog.specialties.isEmpty)
    }

    func testContainsExactMatch() {
        let catalog = DirectorySearchCatalog(specialties: ["Dermatologia", "Cardiologia"])
        XCTAssertTrue(catalog.contains("Dermatologia"))
        XCTAssertFalse(catalog.contains(" dermatologia "))
        XCTAssertFalse(catalog.contains("Nonexistent"))
    }

    func testEmptyCatalog() {
        let catalog = DirectorySearchCatalog.from(profiles: [])
        XCTAssertTrue(catalog.specialties.isEmpty)
        XCTAssertFalse(catalog.contains("Dermatologia"))
    }
}