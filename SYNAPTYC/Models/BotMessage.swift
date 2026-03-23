import Foundation

struct BotMessage: Identifiable, Equatable {
    let id: UUID
    let role: BotRole
    let content: String
    let timestamp: Date

    init(role: BotRole, content: String) {
        self.id        = UUID()
        self.role      = role
        self.content   = content
        self.timestamp = Date()
    }
}

enum BotRole: String {
    case user
    case assistant
}

// MARK: - Banner API models

struct BannerConvMessage: Codable {
    let role: String
    let content: String
}

struct BannerToolResult: Codable {
    let toolUseId: String
    let result: String
    enum CodingKeys: String, CodingKey {
        case toolUseId = "tool_use_id"
        case result
    }
}

struct BannerToolCall: Codable, Identifiable {
    var id: String       // tool_use_id from Claude
    let name: String
    let input: [String: String]
}

struct BannerChatRequest: Codable {
    let message: String
    let conversation: [BannerConvMessage]
    let deviceContext: BannerDeviceContext
    let toolResults: [BannerToolResult]
    enum CodingKeys: String, CodingKey {
        case message, conversation
        case deviceContext = "device_context"
        case toolResults   = "tool_results"
    }
}

struct BannerChatResponse: Codable {
    let reply: String
    let toolCalls: [BannerToolCall]
    enum CodingKeys: String, CodingKey {
        case reply
        case toolCalls = "tool_calls"
    }
}

struct BannerDeviceContext: Codable {
    var batteryLevel: Float
    var batteryState: String
    var storageFreeGB: Double
    var storageTotalGB: Double
    var iosVersion: String
    var deviceModel: String
    var networkType: String
    var appVersion: String
    var unreadCount: Int
    var timestamp: String
    enum CodingKeys: String, CodingKey {
        case batteryLevel   = "battery_level"
        case batteryState   = "battery_state"
        case storageFreeGB  = "storage_free_gb"
        case storageTotalGB = "storage_total_gb"
        case iosVersion     = "ios_version"
        case deviceModel    = "device_model"
        case networkType    = "network_type"
        case appVersion     = "app_version"
        case unreadCount    = "unread_count"
        case timestamp
    }
}

// Legacy (kept for backwards compatibility with existing APIService.botChat)
struct BotChatRequest: Codable {
    let message: String
}

struct BotChatResponse: Codable {
    let reply: String
}
