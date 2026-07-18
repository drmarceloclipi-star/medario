struct AccountProfile: Equatable, Sendable {
    let email: String
    var preferences: AccountPreferences
    var healthConsent: Bool
}
