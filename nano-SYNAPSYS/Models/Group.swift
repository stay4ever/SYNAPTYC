import Foundation

/// Group model for group chat conversations.
struct Group: Codable, Identifiable {
    let id: String
    let name: String
    let creatorId: String
    let members: [GroupMember]
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case creatorId = "creator_id"
        case members
        case createdAt = "created_at"
    }
}

/// GroupMember model representing a member within a group.
struct GroupMember: Codable, Identifiable {
    let id: String
    let userId: String
    let username: String
    let role: String // "admin" or "member"
    let publicKey: String? // ECDH P-384 public key for group encryption

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case username
        case role
        case publicKey = "public_key"
    }
}

/// GroupMessage model representing a message within a group chat.
struct GroupMessage: Codable, Identifiable {
    let id: String
    let groupId: String
    let senderId: String
    let senderUsername: String?
    let content: String // May be "ENC:..." ciphertext
    let timestamp: Date
    let isRead: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case groupId = "group_id"
        case senderId = "sender_id"
        case senderUsername = "sender_username"
        case content
        case timestamp
        case isRead = "is_read"
    }

    // MARK: - Computed Properties

    /// Returns true if message content is encrypted (starts with "ENC:")
    var isEncrypted: Bool {
        content.hasPrefix("ENC:")
    }
}
