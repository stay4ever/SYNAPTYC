import Foundation
import Combine

@MainActor
class ConversationsViewModel: ObservableObject {
    @Published var conversations: [Contact] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var cancellables = Set<AnyCancellable>()

    init() {
        subscribeToWebSocket()
    }

    // MARK: - Load Conversations

    func loadConversations() async {
        isLoading = true
        errorMessage = nil

        do {
            let contacts = try await APIService.shared.getContacts()

            // Filter to only contacts with message history
            self.conversations = contacts.filter { $0.lastMessageAt != nil }

            // Sort by last message timestamp, most recent first
            self.conversations.sort { ($0.lastMessageAt ?? Date.distantPast) > ($1.lastMessageAt ?? Date.distantPast) }

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
            .sink { [weak self] event in
                self?.handleTypingIndicator(event)
            }
            .store(in: &cancellables)
    }

    private func handleNewMessage(_ message: Message) {
        // Find or create conversation for this contact
        if let index = conversations.firstIndex(where: { $0.id == message.senderId }) {
            // Update existing conversation
            conversations[index].lastMessage = message.content
            conversations[index].lastMessageAt = message.sentAt
            conversations[index].unreadCount += 1

            // Move to top
            let conversation = conversations.remove(at: index)
            conversations.insert(conversation, at: 0)
        } else {
            // Load contact and add conversation
            Task {
                do {
                    let contact = try await APIService.shared.getContact(id: message.senderId)
                    var updatedContact = contact
                    updatedContact.lastMessage = message.content
                    updatedContact.lastMessageAt = message.sentAt
                    updatedContact.unreadCount = 1

                    self.conversations.insert(updatedContact, at: 0)
                } catch {
                    print("Failed to load contact for new message: \(error)")
                }
            }
        }
    }

    private func handleTypingIndicator(_ event: TypingEvent) {
        if let index = conversations.firstIndex(where: { $0.id == event.userId }) {
            conversations[index].isTyping = event.isTyping
        }
    }

    // MARK: - Mark as Read

    func markAsRead(contactId: String) async {
        if let index = conversations.firstIndex(where: { $0.id == contactId }) {
            conversations[index].unreadCount = 0

            do {
                try await APIService.shared.markConversationAsRead(contactId: contactId)
            } catch {
                print("Failed to mark conversation as read: \(error)")
            }
        }
    }
}
