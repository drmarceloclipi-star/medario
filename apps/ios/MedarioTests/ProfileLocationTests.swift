import XCTest
@testable import Medario

final class ProfileLocationTests: XCTestCase {
    @MainActor
    func testVisibleAddressRequiresExplicitAuthorization() {
        let unauthorized = ProfileLocation(
            name: "Consultório",
            address: "Rua privada, 10",
            district: "Centro",
            city: "Joinville",
            state: "SC",
            authorized: false
        )
        let authorized = ProfileLocation(
            name: "Consultório",
            address: "Rua pública, 20",
            district: "Centro",
            city: "Joinville",
            state: "SC",
            authorized: true
        )

        XCTAssertNil(unauthorized.visibleAddress)
        XCTAssertEqual(authorized.visibleAddress, "Rua pública, 20")
    }

    @MainActor
    func testCoordinatesAndExternalRouteRequireAuthorization() {
        let unauthorized = ProfileLocation(
            name: "Privado", address: "Rua privada, 10", district: "Centro", city: "Joinville", state: "SC",
            authorized: false, latitude: -26.3, longitude: -48.8
        )
        let authorized = ProfileLocation(
            name: "Público", address: "Rua pública, 20", district: "Centro", city: "Joinville", state: "SC",
            authorized: true, latitude: -26.3, longitude: -48.8
        )

        XCTAssertNil(unauthorized.authorizedCoordinates)
        XCTAssertNil(unauthorized.routeURL)
        XCTAssertEqual(authorized.authorizedCoordinates?.latitude, -26.3)
        XCTAssertTrue(authorized.routeURL?.absoluteString.contains("maps.apple.com") == true)
    }
}
