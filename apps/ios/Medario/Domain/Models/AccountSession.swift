enum AccountSession: Equatable, Sendable {
    case loading
    case signedOut
    case signedIn(AccountUser)
}
