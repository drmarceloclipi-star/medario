@preconcurrency import FirebaseFunctions
import Foundation

@MainActor
final class FirebaseNativeNotificationRepository: NativeNotificationRepository {
    private let functions: Functions

    init(functions: Functions = .functions()) {
        self.functions = functions
    }

    func preferences() async throws -> NativeNotificationPreferences {
        let value = try await functions.httpsCallable("getNativeNotificationPreferences").call().data
        return NativeNotificationPreferences.fromCallable(value)
    }

    func update(_ preferences: NativeNotificationPreferences, expectedUserID: String) async throws -> NativeNotificationPreferences {
        let value = try await functions.httpsCallable("updateNativeNotificationPreferences").call([
            "preferences": preferences.callablePayload,
            "expectedUid": expectedUserID,
        ]).data
        return NativeNotificationPreferences.fromCallable(value)
    }

    func register(token: String, installationID: String, expectedUserID: String) async throws {
        _ = try await functions.httpsCallable("registerNativePushEndpoint").call([
            "token": token,
            "installationId": installationID,
            "expectedUid": expectedUserID,
        ])
    }

    func unregister(expectedUserID: String) async throws {
        _ = try await functions.httpsCallable("unregisterNativePushEndpoint").call(["expectedUid": expectedUserID])
    }
}
