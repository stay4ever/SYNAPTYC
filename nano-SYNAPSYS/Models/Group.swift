import Foundation

/// Group model for group chat conversations.
struct Group: Codable, Identifiable {
    let id: String
    var name: String
    let creatorId: String
    var members: [GroupMember]
    let createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name
        case creatorId = "creator_id"
        case members
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var memberCount: Int { members.count }

    var lastMessageTime: String { "" }

    var lastMessage: String { "" }

    static var mockGroup: Group {
        Group(id: "group-1", name: "Zion Operators", creatorId: "user-1",
              members: [], createdAt: Date(), updatedAt: nil)
    }
}

/// GroupMember model.
struct GroupMember: Codable, Identifiable {
    let id: String
    let username: String
    var displayName: String?
    let role: String?
    let publicKey: String?
    var joinedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, username
        case displayName = "display_name"
        case role
        case publicKey = "public_key"
        case joinedAt = "joined_at"
    }

    init(id: String, username: String, displayName: String? = nil,
         role: String? = nil, publicKey: String? = nil, joinedAt: Date? = nil) {
        self.id = id
        self.username = username
        self.displayName = displayName
        self.role = role
        self.publicKey = publicKey
        self.joinedAt = joinedAt
    }
}

/// GroupMessage model.
struct GroupMessage: Codable, Identifiable {
    let id: String
    let groupId: String
    let senderId: String
    let senderUsername: String?
    var content: String
    let timestamp: Date
    let isRead: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case groupId = "group_id"
        case senderId = "sender_id"
        case senderUsername = "sender_username"
        case content, timestamp
        case isRead = "is_read"
    }

    var isEncrypted: Bool { content.hasPrefix("ENC:") }
    var sentAt: Date { timestamp }
    var senderName: String { senderUsername ?? senderId }

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: timestamp)
    }
}
