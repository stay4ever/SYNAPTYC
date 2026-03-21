import Foundation
import UserNotifications
import Combine

/// NotificationService: Singleton for managing APNs and local notifications.
/// Handles permission requests, device token registration, and badge management.
final class NotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationService()

    private let notificationCenter = UNUserNotificationCenter.current()
    private var deviceToken: String?

    // Combine publishers for notification events
    let deviceTokenPublisher = PassthroughSubject<String, Never>()
    let notificationReceivedPublisher = PassthroughSubject<UNNotificationResponse, Never>()

    override private init() {
        super.init()
        notificationCenter.delegate = self
    }

    // MARK: - Permission Request

    /// Request user permission for push notifications (alert, sound, badge).
    func requestNotificationPermission() async -> Bool {
        do {
            let granted = try await notificationCenter.requestAuthorization(options: [.alert, .sound, .badge])
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            return granted
        } catch {
            print("Notification permission request failed: \(error.localizedDescription)")
            return false
        }
    }

    /// Receive and store the APNs device token.
    func setDeviceToken(_ token: Data) {
        let tokenParts = token.map { data in String(format: "%02.2hhx", data) }
        let tokenString = tokenParts.joined()
        deviceToken = tokenString
        deviceTokenPublisher.send(tokenString)
    }

    /// Get the stored APNs device token.
    func getDeviceToken() -> String? {
        deviceToken
    }

    // MARK: - Local Notifications

    /// Schedule a local notification for a new message.
    func scheduleMessageNotification(
        title: String,
        body: String,
        contactName: String,
        contactId: String,
        delaySeconds: TimeInterval = 1.0
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)

        // Custom data for handling notification tap
        content.userInfo = [
            "contactId": contactId,
            "contactName": contactName
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1.0, delaySeconds), repeats: false)
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )

        notificationCenter.add(request) { error in
            if let error = error {
                print("Failed to schedule notification: \(error.localizedDescription)")
            }
        }
    }

    /// Schedule a group message notification.
    func scheduleGroupMessageNotification(
        title: String,
        body: String,
        groupName: String,
        groupId: String,
        delaySeconds: TimeInterval = 1.0
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)

        content.userInfo = [
            "groupId": groupId,
            "groupName": groupName,
            "isGroupMessage": true
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1.0, delaySeconds), repeats: false)
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )

        notificationCenter.add(request) { error in
            if let error = error {
                print("Failed to schedule group notification: \(error.localizedDescription)")
            }
        }
    }

    /// Schedule a local notification for bot messages.
    func scheduleBotNotification(
        title: String,
        body: String,
        delaySeconds: TimeInterval = 1.0
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = NSNumber(value: UIApplication.shared.applicationIconBadgeNumber + 1)

        content.userInfo = ["isBot": true]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1.0, delaySeconds), repeats: false)
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )

        notificationCenter.add(request) { error in
            if let error = error {
                print("Failed to schedule bot notification: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Badge Management

    /// Set the application badge count.
    func setBadgeCount(_ count: Int) {
        UIApplication.shared.applicationIconBadgeNumber = count
    }

    /// Increment the application badge count.
    func incrementBadgeCount() {
        let current = UIApplication.shared.applicationIconBadgeNumber
        UIApplication.shared.applicationIconBadgeNumber = current + 1
    }

    /// Reset the application badge count to zero.
    func resetBadgeCount() {
        UIApplication.shared.applicationIconBadgeNumber = 0
    }

    // MARK: - Notification Center Delegate

    /// Handle user interaction with notifications (tap).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        notificationReceivedPublisher.send(response)
        completionHandler()
    }

    /// Handle notifications received while app is in foreground.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner and sound even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
}
