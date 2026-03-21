import Foundation

/// Message model for direct messages between users.
/// Content may be plaintext or encrypted (prefixed with "ENC:")
struct Message: Codable, Identifiable {
    let id: String
    let senderId: String
    let recipientId: String
    let content: String // May be "ENC:..." ciphertext
    let timestamp: Date
    let isRead: Bool
    let senderUsername: String?

    enum CodingKeys: String, CodingKey {
        case id
        case senderId = "sender_id"
        case recipientId = "recipient_id"
        case content
        case timestamp
        case isRead = "is_read"
        case senderUsername = "sender_username"
    }

    // MARK: - Computed Properties

    /// Returns true if message content is encrypted (starts with "ENC:")
    var isEncrypted: Bool {
        content.hasPrefix("ENC:")
    }

    /// Returns true if the message was sent by the given user
    func isFromCurrentUser(_ userId: String) -> Bool {
        senderId == userId
    }
}
