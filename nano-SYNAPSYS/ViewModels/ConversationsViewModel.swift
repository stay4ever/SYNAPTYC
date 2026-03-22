import Foundation
import Combine

// MARK: - Models

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

// MARK: - View Model

/// View model managing the list of conversations and real-time updates
@MainActor
class ConversationsViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var cancellables = Set<AnyCancellable>()

    init() {
        subscribeToWebSocket()
    }

    // MARK: - Load Conversations

    func loadConversations() {
        Task {
            await refreshConversations()
        }
    }

    func refreshConversations() async {
        isLoading = true
        errorMessage = nil

        do {
            let contacts = try await APIService.shared.getContacts()
            self.conversations = contacts.map { contact in
                Conversation(
                    id: contact.id,
                    contact: ConversationContact(
                        id: contact.contactId,
                        username: contact.contactUsername,
                        displayName: contact.displayNameOrUsername,
                        initials: contact.initials
                    ),
                    lastMessage: "",
                    lastMessageAt: contact.addedAt,
                    unreadCount: 0,
                    isOnline: contact.isOnline
                )
            }
            isLoading = false
        } catch {
            errorMessage = "Failed to load conversations: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - WebSocket Subscription

    private func subscribeToWebSocket() {
        WebSocketService.shared.messageReceived
            .receive(on: DispatchQueue.main)
            .sink { [weak self] message in
                self?.handleNewMessage(message)
            }
            .store(in: &cancellables)

        WebSocketService.shared.typingIndicator
            .receive(on: DispatchQueue.main)
            .sink { _ in
                // Handle typing indicator updates
            }
            .store(in: &cancellables)
    }

    private func handleNewMessage(_ message: Message) {
        if let index = conversations.firstIndex(where: { $0.contact.id == message.senderId }) {
            conversations[index].lastMessage = message.content
            conversations[index].lastMessageAt = message.timestamp
            conversations[index].unreadCount += 1

            let conversation = conversations.remove(at: index)
            conversations.insert(conversation, at: 0)
        }
    }

    // MARK: - Mark as Read

    func markAsRead(contactId: String) async {
        if let index = conversations.firstIndex(where: { $0.contact.id == contactId }) {
            conversations[index].unreadCount = 0

            do {
                try await APIService.shared.markConversationAsRead(contactId: contactId)
            } catch {
                print("Failed to mark conversation as read: \(error)")
            }
        }
    }
}
