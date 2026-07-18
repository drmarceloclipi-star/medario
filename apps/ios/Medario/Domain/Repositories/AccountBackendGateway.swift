import Foundation

@MainActor
protocol AccountBackendGateway: AnyObject {
    var currentSession: AccountSession { get }

    func subscribe(_ listener: @escaping @MainActor (AccountSession) -> Void) -> any AccountSessionSubscription
    func signIn(email: String, password: String) async throws
    func createPatientAccount(email: String, password: String) async throws
    func signOut() async throws
    func profile() async throws -> AccountProfile
    func updatePreferences(_ preferences: AccountPreferences) async throws
    func grantHealthConsent() async throws
    func reloadCurrentUser() async throws -> AccountSession
    func reauthenticate(password: String) async throws
    func refreshIDToken() async throws
}
