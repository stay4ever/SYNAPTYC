import Foundation

/// Conversation model wrapping a Contact with conversation metadata.
struct Conversation: Identifiable {
    let id: String
    let contact: ConversationContact
    var lastMessage: String
    var lastMessageAt: Date?
    var unreadCount: Int
    var isOnline: Bool

    var lastMessageTime: String {
        guard let date = lastMessageAt else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    static var mockConversation: Conversation {
        Conversation(
            id: "conv-1",
            contact: ConversationContact(id: "user-1", username: "neo", displayName: "Neo", initials: "N"),
            lastMessage: "Follow the white rabbit...",
            lastMessageAt: Date(),
            unreadCount: 2,
            isOnline: true
        )
    }
}

/// Lightweight contact info for display in conversation lists.
struct ConversationContact: Identifiable {
    let id: String
    let username: String
    let displayName: String
    let initials: String
}
