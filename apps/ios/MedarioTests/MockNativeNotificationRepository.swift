@testable import Medario

@MainActor
final class MockNativeNotificationRepository: NativeNotificationRepository {
    var storedPreferences = NativeNotificationPreferences()
    var preferencesError: Error?
    var updateError: Error?
    var registerError: Error?
    var unregisterError: Error?

    private(set) var updatedPreferences: [NativeNotificationPreferences] = []
    private(set) var registerInputs: [(token: String, installationID: String, userID: String)] = []
    private(set) var unregisterInputs: [String] = []

    func preferences() async throws -> NativeNotificationPreferences {
        if let preferencesError { throw preferencesError }
        return storedPreferences
    }

    func update(_ preferences: NativeNotificationPreferences, expectedUserID: String) async throws -> NativeNotificationPreferences {
        updatedPreferences.append(preferences)
        if let updateError { throw updateError }
        storedPreferences = preferences
        return preferences
    }

    func register(token: String, installationID: String, expectedUserID: String) async throws {
        registerInputs.append((token, installationID, expectedUserID))
        if let registerError { throw registerError }
    }

    func unregister(expectedUserID: String) async throws {
        unregisterInputs.append(expectedUserID)
        if let unregisterError { throw unregisterError }
    }
}

@MainActor
final class MockNativeNotificationPermissionService: NativeNotificationPermissionProviding {
    var token = "fcm-token-that-is-long-enough-for-validation"
    var error: Error?
    private(set) var requestCount = 0

    func requestToken() async throws -> String {
        requestCount += 1
        if let error { throw error }
        return token
    }
}

enum MockNativeNotificationError: Error { case failed }
