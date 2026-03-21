import Foundation
import Combine

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isTyping = false
    @Published var messageText = ""

    private let contact: Contact
    private var encryptionService: EncryptionService
    private var cancellables = Set<AnyCancellable>()
    private var typingTimer: Timer?

    init(contact: Contact) {
        self.contact = contact
        self.encryptionService = EncryptionService(conversationId: contact.id)
        subscribeToWebSocket()
    }

    // MARK: - Load Messages

    func loadMessages() async {
        isLoading = true
        errorMessage = nil

        do {
            let encryptedMessages = try await APIService.shared.getMessages(contactId: contact.id)

            var decryptedMessages: [Message] = []
            for encryptedMsg in encryptedMessages {
                do {
                    let decrypted = try encryptionService.decryptMessage(encryptedMsg)
                    decryptedMessages.append(decrypted)
                } catch {
                    print("Failed to decrypt message: \(error)")
                    decryptedMessages.append(encryptedMsg) // Fallback: show encrypted
                }
            }

            self.messages = decryptedMessages.sorted { $0.sentAt < $1.sentAt }
            isLoading = false
        } catch {
            errorMessage = "Failed to load messages: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Send Message

    func sendMessage() async {
        guard !messageText.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        let content = messageText
        messageText = ""

        do {
            // Encrypt message
            let encryptedContent = try encryptionService.encryptMessage(content)

            // Send to API
            let message = try await APIService.shared.sendMessage(
                to: contact.id,
                content: encryptedContent
            )

            // Add to local messages
            var decrypted = message
            do {
                decrypted = try encryptionService.decryptMessage(message)
            } catch {
                print("Failed to decrypt sent message: \(error)")
            }

            messages.append(decrypted)
        } catch {
            errorMessage = "Failed to send message: \(error.localizedDescription)"
            messageText = content // Restore message on error
        }
    }

    // MARK: - Typing Indicator

    func sendTypingIndicator() {
        // Cancel existing timer
        typingTimer?.invalidate()

        // Send "typing" event
        Task {
            do {
                try await APIService.shared.sendTypingIndicator(to: contact.id, isTyping: true)
            } catch {
                print("Failed to send typing indicator: \(error)")
            }
        }

        // Auto-stop after 3 seconds of inactivity
        typingTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: false) { _ in
            Task {
                do {
                    try await APIService.shared.sendTypingIndicator(to: self.contact.id, isTyping: false)
                } catch {
                    print("Failed to stop typing indicator: \(error)")
                }
            }
        }
    }

    // MARK: - WebSocket Subscription

    private func subscribeToWebSocket() {
        WebSocketService.shared.messageReceived
            .receive(on: DispatchQueue.main)
            .filter { $0.senderId == contact.id }
            .sink { [weak self] message in
                self?.handleIncomingMessage(message)
            }
            .store(in: &cancellables)

        WebSocketService.shared.typingIndicator
            .receive(on: DispatchQueue.main)
            .filter { $0.userId == contact.id }
            .sink { [weak self] event in
                self?.isTyping = event.isTyping
            }
            .store(in: &cancellables)
    }

    private func handleIncomingMessage(_ message: Message) {
        do {
            let decrypted = try encryptionService.decryptMessage(message)
            messages.append(decrypted)
        } catch {
            print("Failed to decrypt incoming message: \(error)")
            messages.append(message) // Fallback
        }
    }

    deinit {
        typingTimer?.invalidate()
    }
}
