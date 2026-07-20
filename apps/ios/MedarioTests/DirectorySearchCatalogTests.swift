import XCTest
@testable import Medario

final class DirectorySearchCatalogTests: XCTestCase {

    func testCatalogDeduplicatesSpecialties() {
        let profiles = [PublicProfileFixture.mariana, PublicProfileFixture.mariana]
        let catalog = DirectorySearchCatalog.from(profiles: profiles)
        XCTAssertEqual(catalog.specialties, ["Dermatologia"])
    }

    func testCatalogSortedAlphabetically() {
        let profiles = [PublicProfileFixture.mariana]
        let catalog = DirectorySearchCatalog.from(profiles: profiles)
        XCTAssertEqual(catalog.specialties, ["Dermatologia"])
    }

    func testCatalogExcludesEmptySpecialties() {
        let profile = PublicProfile(
            id: "empty", slug: "empty", name: "Dr Empty", specialty: "",
            crm: "", rqe: nil, bio: "", verified: false, claimed: false,
            updatedAt: nil, pendingChange: nil,
            location: ProfileLocation(name: "Local", address: nil, district: "", city: "Joinville", state: "SC", authorized: false, latitude: nil, longitude: nil),
            insurances: [], modalities: [], availability: "", contacts: ProfileContacts(whatsApp: nil, phone: nil)
        )
        let catalog = DirectorySearchCatalog.from(profiles: [profile])
        XCTAssertTrue(catalog.specialties.isEmpty)
    }

    func testContainsExactMatch() {
        let catalog = DirectorySearchCatalog(specialties: ["Dermatologia"], cities: ["Joinville"], insurances: ["Unimed"], doctorCandidates: [])
        XCTAssertTrue(catalog.contains(specialty: "Dermatologia"))
        XCTAssertFalse(catalog.contains(specialty: "Nonexistent"))
        XCTAssertTrue(catalog.contains(city: "Joinville"))
        XCTAssertTrue(catalog.contains(insurance: "Unimed"))
    }

    func testEmptyCatalog() {
        let catalog = DirectorySearchCatalog.from(profiles: [])
        XCTAssertTrue(catalog.specialties.isEmpty)
        XCTAssertTrue(catalog.cities.isEmpty)
        XCTAssertTrue(catalog.insurances.isEmpty)
        XCTAssertTrue(catalog.doctorCandidates.isEmpty)
    }

    // MARK: - Cities

    func testCatalogExtractsCities() {
        let catalog = DirectorySearchCatalog.from(profiles: [PublicProfileFixture.mariana])
        XCTAssertEqual(catalog.cities, ["Joinville"])
    }

    // MARK: - Insurances

    func testCatalogExtractsInsurances() {
        let catalog = DirectorySearchCatalog.from(profiles: [PublicProfileFixture.mariana])
        XCTAssertEqual(catalog.insurances, ["Unimed"])
    }

    // MARK: - Doctor candidates

    func testDoctorCandidatesWithMatchingQuery() {
        let catalog = DirectorySearchCatalog.from(
            profiles: [PublicProfileFixture.mariana], query: "Mariana"
        )
        XCTAssertEqual(catalog.doctorCandidates.count, 1)
        XCTAssertEqual(catalog.doctorCandidates.first?.slug, "dra-mariana-andrade")
    }

    func testDoctorCandidatesEmptyWithEmptyQuery() {
        let catalog = DirectorySearchCatalog.from(profiles: [PublicProfileFixture.mariana])
        XCTAssertTrue(catalog.doctorCandidates.isEmpty)
    }

    func testDoctorCandidatesLimitedToTwenty() {
        var profiles: [PublicProfile] = []
        for i in 0..<30 {
            profiles.append(PublicProfile(
                id: "doc\(i)", slug: "doc-\(i)", name: "Doctor Mariana \(i)", specialty: "Dermatologia",
                crm: "CRM-SC \(i)", rqe: nil, bio: "", verified: false, claimed: false,
                updatedAt: nil, pendingChange: nil,
                location: ProfileLocation(name: "Local", address: nil, district: "", city: "Joinville", state: "SC", authorized: false, latitude: nil, longitude: nil),
                insurances: [], modalities: [.inPerson], availability: "",
                contacts: ProfileContacts(whatsApp: nil, phone: nil)
            ))
        }
        let catalog = DirectorySearchCatalog.from(profiles: profiles, query: "Mariana")
        XCTAssertEqual(catalog.doctorCandidates.count, 20)
    }

    func testContainsDoctorSlug() {
        let catalog = DirectorySearchCatalog.from(
            profiles: [PublicProfileFixture.mariana], query: "Mariana"
        )
        XCTAssertTrue(catalog.containsDoctor(slug: "dra-mariana-andrade"))
        XCTAssertFalse(catalog.containsDoctor(slug: "nonexistent"))
    }
}