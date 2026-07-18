@MainActor
protocol AccountCallableGateway: AnyObject {
    func revokeHealthConsent() async throws
    func deleteMyAccount() async throws
    func unregisterNativePushEndpoint(expectedUserID: String) async throws
}
