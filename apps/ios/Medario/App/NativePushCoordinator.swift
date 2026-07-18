@preconcurrency import FirebaseMessaging
import Foundation
import UIKit
import UserNotifications

extension Notification.Name {
    static let medarioNotificationDestination = Notification.Name("medario.notification.destination")
    static let medarioFCMTokenUpdated = Notification.Name("medario.fcm-token.updated")
}

@MainActor
final class NativePushTokenStore {
    static let shared = NativePushTokenStore()
    private(set) var token: String?

    func set(_ token: String?) { self.token = token }
}

final class MedarioAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        Task { @MainActor in
            NativePushTokenStore.shared.set(fcmToken)
            if let fcmToken {
                NotificationCenter.default.post(name: .medarioFCMTokenUpdated, object: fcmToken)
            }
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard let destination = response.notification.request.content.userInfo["destination"] as? String else { return }
        await MainActor.run {
            NotificationCenter.default.post(name: .medarioNotificationDestination, object: destination)
        }
    }
}

@MainActor
final class FirebaseNativeNotificationPermissionService: NativeNotificationPermissionProviding {
    func requestToken() async throws -> String {
        let center = UNUserNotificationCenter.current()
        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        guard granted else { throw PermissionError.denied }
        UIApplication.shared.registerForRemoteNotifications()
        let token = try await Messaging.messaging().token()
        NativePushTokenStore.shared.set(token)
        return token
    }

    private enum PermissionError: Error { case denied }
}

enum NativePushInstallationID {
    private static let key = "medario.native-push-installation-id"

    @MainActor
    static var current: String {
        if let existing = UserDefaults.standard.string(forKey: key), !existing.isEmpty { return existing }
        let value = UUID().uuidString.lowercased()
        UserDefaults.standard.set(value, forKey: key)
        return value
    }
}
