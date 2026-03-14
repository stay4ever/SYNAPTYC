import Foundation
import Combine

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [Message]      = []
    @Published var isLoading               = false
    @Published var errorMessage: String?
    @Published var disappearTimer: DisappearTimer = .off
    @Published var isTyping                = false

    let peer: AppUser
    private var cancellables               = Set<AnyCancellable>()
    /// Per-conversation shared key from ECDH exchange; nil if no key exchange has occurred yet.
    private var symmetricKey: SymmetricKey?

    /// Whether E2E encryption is active for this conversation.
    var isEncrypted: Bool { symmetricKey != nil }

    init(peer: AppUser) {
        self.peer = peer
        // Load per-conversation symmetric key if a key exchange has completed
        self.symmetricKey = EncryptionService.loadSymmetricKey(conversationId: peer.id)

        WebSocketService.shared.$incomingMessage
            .compactMap { $0 }
            .filter { [weak self] msg in
                guard let self else { return false }
                let me = AuthViewModel.shared.currentUser?.id ?? 0
                return (msg.fromUser == self.peer.id && msg.toUser == me) ||
                       (msg.fromUser == me && msg.toUser == self.peer.id)
            }
            .receive(on: RunLoop.main)
            .sink { [weak self] msg in
                guard let self else { return }
                // Handle read-receipt updates for existing messages
                if msg.read, let idx = self.messages.firstIndex(where: { $0.id == msg.id }) {
                    self.messages[idx].read = true
                    return
                }
                var m = msg
                if let key = self.symmetricKey {
                    m.content = (try? EncryptionService.decrypt(m.content, using: key)) ?? m.content
                }
                if !self.messages.contains(where: { $0.id == m.id }) {
                    self.messages.append(m)
                    self.applyDisappearTimer(to: &self.messages[self.messages.count - 1])
                }
                if m.fromUser == self.peer.id {
                    WebSocketService.shared.markRead(messageId: m.id)
                    NotificationService.scheduleLocal(title: self.peer.name, body: "New encrypted message")
                }
            }
            .store(in: &cancellables)

        WebSocketService.shared.$typingUsers
            .receive(on: RunLoop.main)
            .map { [weak self] ids in ids.contains(self?.peer.id ?? -1) }
            .assign(to: &$isTyping)
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            var fetched = try await APIService.shared.messages(with: peer.id)
            if let key = symmetricKey {
                fetched = fetched.map { msg in
                    var m = msg
                    m.content = (try? EncryptionService.decrypt(m.content, using: key)) ?? m.content
                    return m
                }
            }
            messages = fetched
            purgeExpired()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func send(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let outgoing: String
        if let key = symmetricKey {
            outgoing = (try? EncryptionService.encrypt(text, using: key)) ?? text
        } else {
            outgoing = text
        }
        do {
            var sent = try await APIService.shared.sendMessage(toUser: peer.id, content: outgoing)
            sent.content = text // show decrypted locally
            applyDisappearTimer(to: &sent)
            messages.append(sent)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendTypingIndicator() {
        WebSocketService.shared.sendTyping(to: peer.id)
    }

    // MARK: - Disappearing messages

    private func applyDisappearTimer(to msg: inout Message) {
        guard let interval = disappearTimer.interval else { return }
        msg.disappearsAt = Date().addingTimeInterval(interval)
    }

    func purgeExpired() {
        let now = Date()
        messages.removeAll { msg in
            guard let exp = msg.disappearsAt else { return false }
            return exp < now
        }
    }
}
