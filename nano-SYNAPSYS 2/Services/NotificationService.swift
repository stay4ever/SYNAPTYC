import Foundation
import UserNotifications

enum NotificationService {

    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = try? await center.requestAuthorization(options: [.alert, .badge, .sound])
        return granted ?? false
    }

    static func scheduleLocal(title: String, body: String, identifier: String = UUID().uuidString) {
        let content       = UNMutableNotificationContent()
        content.title     = title
        content.body      = body
        content.sound     = .default
        let trigger       = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        let request       = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    static func clearAll() {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    static func setBadge(_ count: Int) {
        Task { @MainActor in
            try? await UNUserNotificationCenter.current().setBadgeCount(count)
        }
    }
}
