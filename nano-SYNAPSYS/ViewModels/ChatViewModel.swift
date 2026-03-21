import Foundation
import Combine

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isRemoteTyping = false

    let contactId: String
    private var cancellables = Set<AnyCancellable>()

    init(contactId: String) {
        self.contactId = contactId
        subscribeToWebSocket()
    }

    // MARK: - Load Messages

    func loadMessages() {
        Task {
            isLoading = true
            errorMessage = nil
            do {
                let msgs = try await APIService.shared.getMessages(contactId: contactId)
                self.messages = msgs.sorted { $0.timestamp < $1.timestamp }
            } catch {
                errorMessage = "Failed to load messages: \(error.localizedDescription)"
            }
            isLoading = false
        }
    }

    // MARK: - Send Message

    func sendMessage(_ content: String) {
        Task {
            do {
                let message = try await APIService.shared.sendMessage(
                    recipientId: contactId,
                    content: content
                )
                messages.append(message)
            } catch {
                errorMessage = "Failed to send message: \(error.localizedDescription)"
            }
        }
    }

    // MARK: - WebSocket Subscription

    private func subscribeToWebSocket() {
        WebSocketService.shared.messageReceived
            .receive(on: DispatchQueue.main)
            .filter { [weak self] msg in msg.senderId == self?.contactId }
            .sink { [weak self] message in
                self?.messages.append(message)
            }
            .store(in: &cancellables)

        WebSocketService.shared.typingIndicator
            .receive(on: DispatchQueue.main)
            .filter { [weak self] event in event.contactId == self?.contactId }
            .sink { [weak self] event in
                self?.isRemoteTyping = event.isTyping
            }
            .store(in: &cancellables)
    }
}
