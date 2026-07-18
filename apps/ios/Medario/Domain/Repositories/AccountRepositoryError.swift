import Foundation

enum AccountRepositoryError: Error, Equatable {
    case authenticationRequired
    case reauthenticationRequired
    case passwordRequired
    case invalidCredentials
    case emailAlreadyInUse
    case weakPassword
    case networkUnavailable
    case operationFailed
}
