import Foundation

@MainActor
protocol SavedItemsSessionSource: AnyObject {
    var currentSession: AccountSession { get }
    func subscribe(_ listener: @escaping @MainActor (AccountSession) -> Void) -> any AccountSessionSubscription
}

@MainActor
protocol AccountRepository: SavedItemsSessionSource {
    func signIn(email: String, password: String) async throws
    func createPatientAccount(email: String, password: String) async throws
    func signOut() async throws
    func profile() async throws -> AccountProfile
    func updatePreferences(_ preferences: AccountPreferences) async throws
    func setHealthConsent(_ value: Bool) async throws
    func refreshEmailVerification() async throws
    func deleteAccount() async throws
    func reauthenticateAndDelete(password: String) async throws
}

@MainActor
protocol AccountSessionSubscription: AnyObject {
    func cancel()
}
