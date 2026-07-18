import Foundation

@MainActor
protocol NativeNotificationRepository: AnyObject {
    func preferences() async throws -> NativeNotificationPreferences
    func update(_ preferences: NativeNotificationPreferences, expectedUserID: String) async throws -> NativeNotificationPreferences
    func register(token: String, installationID: String, expectedUserID: String) async throws
    func unregister(expectedUserID: String) async throws
}

@MainActor
protocol NativeNotificationPermissionProviding: AnyObject {
    func requestToken() async throws -> String
}
