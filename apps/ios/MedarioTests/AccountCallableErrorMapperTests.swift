import FirebaseFunctions
import XCTest
@testable import Medario

@MainActor
final class AccountCallableErrorMapperTests: XCTestCase {
    func testMapsRecentLoginRequirement() {
        XCTAssertEqual(
            AccountCallableErrorMapper.map(error(code: .failedPrecondition)),
            .reauthenticationRequired
        )
    }

    func testMapsAuthenticationAndNetworkFailures() {
        XCTAssertEqual(AccountCallableErrorMapper.map(error(code: .unauthenticated)), .authenticationRequired)
        XCTAssertEqual(AccountCallableErrorMapper.map(error(code: .unavailable)), .networkUnavailable)
        XCTAssertEqual(AccountCallableErrorMapper.map(error(code: .deadlineExceeded)), .networkUnavailable)
    }

    func testUnknownErrorIsGeneric() {
        let error = NSError(domain: "unrelated", code: 1)
        XCTAssertEqual(AccountCallableErrorMapper.map(error), .operationFailed)
    }

    private func error(code: FunctionsErrorCode) -> NSError {
        NSError(domain: FunctionsErrorDomain, code: code.rawValue)
    }
}
