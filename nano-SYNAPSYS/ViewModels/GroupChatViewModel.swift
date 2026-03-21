import Foundation
import Combine

@MainActor
class GroupChatViewModel: ObservableObject {
    @Published var messages: [GroupMessage] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var messageText = ""

    private let group: Group
    private var encryptionService: EncryptionService
    private var cancellables = Set<AnyCancellable>()
    private var typingTimer: Timer?

    init(group: Group) {
        self.group = group
        self.encryptionService = EncryptionService(conversationId: group.id)
        subscribeToWebSocket()
    }

    // MARK: - Load Messages

    func loadMessages() async {
        isLoading = true
        errorMessage = nil

        do {
            let encryptedMessages = try await APIService.shared.getGroupMessages(groupId: group.id)

            var decryptedMessages: [GroupMessage] = []
            for encryptedMsg in encryptedMessages {
                do {
                    let decrypted = try encryptionService.decryptGroupMessage(encryptedMsg)
                    decryptedMessages.append(decrypted)
                } catch {
                    print("Failed to decrypt group message: \(error)")
                    decryptedMessages.append(encryptedMsg) // Fallback
                }
            }

            self.messages = decryptedMessages.sorted { $0.sentAt < $1.sentAt }
            isLoading = false
        } catch {
            errorMessage = "Failed to load group messages: \(error.localizedDescription)"
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
            let message = try await APIService.shared.sendGroupMessage(
                groupId: group.id,
                content: encryptedContent
            )

            // Add to local messages
            var decrypted = message
            do {
                decrypted = try encryptionService.decryptGroupMessage(message)
            } catch {
                print("Failed to decrypt sent group message: \(error)")
            }

            messages.append(decrypted)
        } catch {
            errorMessage = "Failed to send group message: \(error.localizedDescription)"
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
                try await APIService.shared.sendGroupTypingIndicator(groupId: group.id, isTyping: true)
            } catch {
                print("Failed to send group typing indicator: \(error)")
            }
        }

        // Auto-stop after 3 seconds of inactivity
        typingTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: false) { _ in
            Task {
                do {
                    try await APIService.shared.sendGroupTypingIndicator(groupId: self.group.id, isTyping: false)
                } catch {
                    print("Failed to stop group typing indicator: \(error)")
                }
            }
        }
    }

    // MARK: - WebSocket Subscription

    private func subscribeToWebSocket() {
        WebSocketService.shared.groupMessageReceived
            .receive(on: DispatchQueue.main)
            .filter { $0.groupId == group.id }
            .sink { [weak self] message in
                self?.handleIncomingMessage(message)
            }
            .store(in: &cancellables)

        WebSocketService.shared.groupTypingIndicator
            .receive(on: DispatchQueue.main)
            .filter { $0.groupId == group.id }
            .sink { [weak self] event in
                // Update typing state for specific member in group
                // (could maintain a Set<String> of typing members if needed)
                print("User \(event.userId) is typing in group")
            }
            .store(in: &cancellables)
    }

    private func handleIncomingMessage(_ message: GroupMessage) {
        do {
            let decrypted = try encryptionService.decryptGroupMessage(message)
            messages.append(decrypted)
        } catch {
            print("Failed to decrypt incoming group message: \(error)")
            messages.append(message) // Fallback
        }
    }

    deinit {
        typingTimer?.invalidate()
    }
}
