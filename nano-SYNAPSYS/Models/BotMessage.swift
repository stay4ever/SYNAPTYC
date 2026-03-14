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

struct BotChatRequest: Codable {
    let message: String
}

struct BotChatResponse: Codable {
    let reply: String
}
