import XCTest
@testable import Medario

final class MedarioDeepLinkTests: XCTestCase {
    @MainActor
    func testParsesOnlySafeProfileLinksFromOwnedDomains() throws {
        XCTAssertEqual(
            MedarioDeepLink.parse(try XCTUnwrap(URL(string: "https://medario.com.br/medicos/mariana-andrade"))),
            .profile(slug: "mariana-andrade")
        )
        XCTAssertNil(MedarioDeepLink.parse(try XCTUnwrap(URL(string: "https://app.medario.com.br/perfil/mariana-andrade?query=sensitive"))))
        XCTAssertNil(MedarioDeepLink.parse(try XCTUnwrap(URL(string: "https://example.com/medicos/mariana-andrade"))))
        XCTAssertNil(MedarioDeepLink.parse(try XCTUnwrap(URL(string: "https://medario.com.br/medicos/../../conta"))))
    }
}
