import Foundation
import UIKit
import Network

/// Collects live device context and manages Banner agent tasks.
@MainActor
final class BannerService: ObservableObject {
    static let shared = BannerService()

    @Published var tasks: [BannerAgentTask] = []
    @Published var networkType: String = "wifi"

    private var pathMonitor: NWPathMonitor?
    private let monitorQueue = DispatchQueue(label: "banner.network", qos: .background)

    private init() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        startNetworkMonitor()
    }

    // MARK: - Device context

    func collectContext() -> BannerDeviceContext {
        let device = UIDevice.current
        let attrs   = try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())
        let freeB   = (attrs?[.systemFreeSize] as? NSNumber)?.doubleValue ?? 0
        let totalB  = (attrs?[.systemSize]     as? NSNumber)?.doubleValue ?? 0
        let unread  = ConversationsListUnreadBridge.unreadCount

        return BannerDeviceContext(
            batteryLevel:   max(0, device.batteryLevel),
            batteryState:   batteryStateString(device.batteryState),
            storageFreeGB:  freeB  / 1_073_741_824,
            storageTotalGB: totalB / 1_073_741_824,
            iosVersion:     device.systemVersion,
            deviceModel:    device.model,
            networkType:    networkType,
            appVersion:     Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0",
            unreadCount:    unread,
            timestamp:      ISO8601DateFormatter().string(from: Date())
        )
    }

    private func batteryStateString(_ state: UIDevice.BatteryState) -> String {
        switch state {
        case .charging:  return "charging"
        case .full:      return "full"
        case .unplugged: return "unplugged"
        default:         return "unknown"
        }
    }

    private func startNetworkMonitor() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let type: String
            if path.usesInterfaceType(.wifi)     { type = "wifi" }
            else if path.usesInterfaceType(.cellular) { type = "cellular" }
            else                                 { type = "offline" }
            Task { @MainActor [weak self] in self?.networkType = type }
        }
        monitor.start(queue: monitorQueue)
        pathMonitor = monitor
    }

    // MARK: - Agent task management

    func createTask(title: String, description: String? = nil) -> BannerAgentTask {
        let task = BannerAgentTask(title: title, description: description, status: .running)
        tasks.insert(task, at: 0)
        return task
    }

    func completeTask(id: UUID, result: String? = nil) {
        guard let i = tasks.firstIndex(where: { $0.id == id }) else { return }
        tasks[i].status = .done
        tasks[i].result = result
    }

    func clearDone() {
        tasks.removeAll { $0.status == .done }
    }

    // MARK: - Execute client-side tool calls from Banner

    func execute(toolCall: BannerToolCall) async -> String {
        switch toolCall.name {
        case "navigate_to":
            let screen = toolCall.input["screen"] ?? "conversations"
            NotificationCenter.default.post(name: .bannerNavigate, object: screen)
            return "Navigated to \(screen)"

        case "create_task":
            let title = toolCall.input["title"] ?? "Task"
            let desc  = toolCall.input["description"]
            let t = createTask(title: title, description: desc)
            return "Task created: \(t.title)"

        default:
            return "Unknown tool: \(toolCall.name)"
        }
    }
}

// MARK: - BannerAgentTask model

struct BannerAgentTask: Identifiable {
    var id: UUID = UUID()
    var title: String
    var description: String?
    var status: Status
    var result: String?
    var createdAt: Date = Date()

    enum Status: Equatable {
        case pending, running, done, failed
        var label: String {
            switch self {
            case .pending: return "PENDING"
            case .running: return "RUNNING"
            case .done:    return "DONE"
            case .failed:  return "FAILED"
            }
        }
        var color: String { // used as SF symbol name hack — we handle in view
            switch self {
            case .pending: return "circle"
            case .running: return "arrow.triangle.2.circlepath"
            case .done:    return "checkmark.circle.fill"
            case .failed:  return "xmark.circle.fill"
            }
        }
    }
}

// MARK: - Lightweight bridge for unread count (avoids circular dependency)

enum ConversationsListUnreadBridge {
    static var unreadCount: Int = 0
}

// MARK: - Notification

extension Notification.Name {
    static let bannerNavigate = Notification.Name("bannerNavigate")
}
