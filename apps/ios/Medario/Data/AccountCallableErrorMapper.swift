import FirebaseFunctions
import Foundation

enum AccountCallableErrorMapper {
    static func map(_ error: Error) -> AccountRepositoryError {
        let error = error as NSError
        guard error.domain == FunctionsErrorDomain,
              let code = FunctionsErrorCode(rawValue: error.code) else {
            return .operationFailed
        }
        return switch code {
        case .failedPrecondition:
            .reauthenticationRequired
        case .unauthenticated:
            .authenticationRequired
        case .unavailable, .deadlineExceeded:
            .networkUnavailable
        default:
            .operationFailed
        }
    }
}
