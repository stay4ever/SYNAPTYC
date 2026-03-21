import Foundation

/// Message model for direct messages between users.
struct Message: Codable, Identifiable {
    let id: String
    let senderId: String
    let recipientId: String
    var content: String
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

    var isEncrypted: Bool {
        content.hasPrefix("ENC:")
    }

    var sentAt: Date { timestamp }

    /// Check if sent by current user (uses stored user ID from keychain)
    var isFromCurrentUser: Bool {
        if let storedUserId = KeychainService.shared.load(key: "current_user_id") {
            return senderId == storedUserId
        }
        return false
    }

    func isFromCurrentUser(_ userId: String) -> Bool {
        senderId == userId
    }

    /// Formatted timestamp for display
    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: timestamp)
    }

    #if DEBUG
    static var mockSentMessage: Message {
        Message(id: "msg-1", senderId: "current-user", recipientId: "user-2",
                content: "ENC:encrypted-content", timestamp: Date(),
                isRead: true, senderUsername: "morpheus")
    }

    static var mockReceivedMessage: Message {
        Message(id: "msg-2", senderId: "user-2", recipientId: "current-user",
                content: "Follow the white rabbit", timestamp: Date(),
                isRead: false, senderUsername: "neo")
    }
    #endif
}
