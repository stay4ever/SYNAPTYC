import Foundation

/// BotMessage model for Claude AI assistant ("Banner") conversation.
struct BotMessage: Codable, Identifiable, Equatable {
    let id: UUID
    let content: String
    let isFromUser: Bool
    let timestamp: Date

    enum CodingKeys: String, CodingKey {
        case id
        case content
        case isFromUser = "is_from_user"
        case timestamp
    }

    // MARK: - Initializer

    /// Initialize a new bot message with a unique UUID.
    init(id: UUID = UUID(), content: String, isFromUser: Bool, timestamp: Date = Date()) {
        self.id = id
        self.content = content
        self.isFromUser = isFromUser
        self.timestamp = timestamp
    }

    // MARK: - Codable

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Decode id as UUID or String and convert if needed
        if let uuidString = try container.decodeIfPresent(String.self, forKey: .id),
           let uuid = UUID(uuidString: uuidString) {
            self.id = uuid
        } else {
            self.id = try container.decode(UUID.self, forKey: .id)
        }

        self.content = try container.decode(String.self, forKey: .content)
        self.isFromUser = try container.decode(Bool.self, forKey: .isFromUser)
        self.timestamp = try container.decode(Date.self, forKey: .timestamp)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(content, forKey: .content)
        try container.encode(isFromUser, forKey: .isFromUser)
        try container.encode(timestamp, forKey: .timestamp)
    }

    // MARK: - Equatable

    static func == (lhs: BotMessage, rhs: BotMessage) -> Bool {
        lhs.id == rhs.id
            && lhs.content == rhs.content
            && lhs.isFromUser == rhs.isFromUser
            && lhs.timestamp == rhs.timestamp
    }
}
