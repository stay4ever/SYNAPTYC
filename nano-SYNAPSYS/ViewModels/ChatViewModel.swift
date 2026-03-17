import Foundation
import Combine
import CryptoKit

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [Message]      = []
    @Published var isLoading               = false
    @Published var errorMessage: String?
    @Published var disappearTimer: DisappearTimer = .off
    @Published var isTyping                = false
    @Published var encryptionReady         = false

    let peer: AppUser
    private var cancellables               = Set<AnyCancellable>()
    private var symmetricKey: SymmetricKey?
    private var pendingOutgoing: [String]  = []
    private static let maxRetries          = 3

    init(peer: AppUser) {
        self.peer = peer
        // Restore shared key if a previous key exchange completed
        self.symmetricKey = EncryptionService.loadSymmetricKey(conversationId: peer.id)
        self.encryptionReady = symmetricKey != nil

        // MARK: Incoming DM messages
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
                // Filter out KEX protocol messages from display
                if m.content.hasPrefix("KEX:") {
                    // This is a key-exchange message persisted via REST — extract peer's public key
                    if m.fromUser == self.peer.id {
                        let base64 = String(m.content.dropFirst(4))
                        if let pubKeyData = Data(base64Encoded: base64) {
                            self.completeKeyExchange(theirPublicKeyData: pubKeyData)
                        }
                    }
                    return
                }
                // Decrypt — all real messages MUST be encrypted
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

        // MARK: Incoming key exchange events (real-time via WebSocket)
        WebSocketService.shared.$incomingKeyExchange
            .compactMap { $0 }
            .filter { [weak self] kex in kex.from == self?.peer.id }
            .receive(on: RunLoop.main)
            .sink { [weak self] kex in
                self?.completeKeyExchange(theirPublicKeyData: kex.publicKeyData)
            }
            .store(in: &cancellables)

        // MARK: Typing indicator
        WebSocketService.shared.$typingUsers
            .receive(on: RunLoop.main)
            .map { [weak self] ids in ids.contains(self?.peer.id ?? -1) }
            .assign(to: &$isTyping)
    }

    // MARK: - Load messages

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched = try await APIService.shared.messages(with: peer.id)

            // Scan history for peer's KEX message if no shared key yet
            if symmetricKey == nil {
                for msg in fetched where msg.content.hasPrefix("KEX:") && msg.fromUser == peer.id {
                    let base64 = String(msg.content.dropFirst(4))
                    if let pubKeyData = Data(base64Encoded: base64) {
                        completeKeyExchange(theirPublicKeyData: pubKeyData)
                        break
                    }
                }
            }

            // If still no key, initiate key exchange
            if symmetricKey == nil {
                await initiateKeyExchange()
            }

            // Decrypt messages and filter out KEX protocol messages
            let displayMessages: [Message] = fetched.compactMap { msg in
                if msg.content.hasPrefix("KEX:") { return nil }
                var m = msg
                if let key = self.symmetricKey {
                    m.content = (try? EncryptionService.decrypt(m.content, using: key)) ?? m.content
                }
                return m
            }
            messages = displayMessages
            purgeExpired()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Send (always encrypted)

    func send(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        guard let key = symmetricKey else {
            // Queue until key exchange completes — never send plaintext
            pendingOutgoing.append(text)
            if pendingOutgoing.count == 1 {
                await initiateKeyExchange()
            }
            return
        }

        await sendEncrypted(text, using: key)
    }

    func sendTypingIndicator() {
        WebSocketService.shared.sendTyping(to: peer.id)
    }

    // MARK: - ECDH Key Exchange

    /// Initiate key exchange: generate our keypair and broadcast public key
    private func initiateKeyExchange() async {
        let privateKey: P384.KeyAgreement.PrivateKey
        if let existing = EncryptionService.loadPrivateKey(conversationId: peer.id) {
            privateKey = existing
        } else {
            privateKey = EncryptionService.generateKeyPair()
            EncryptionService.storePrivateKey(privateKey, conversationId: peer.id)
        }

        let pubKeyData   = EncryptionService.publicKeyData(from: privateKey)
        let pubKeyBase64 = pubKeyData.base64EncodedString()

        // Real-time exchange via WebSocket
        WebSocketService.shared.sendKeyExchange(to: peer.id, publicKey: pubKeyBase64)

        // Persist via REST for offline exchange (peer will find it when they load history)
        let kexContent = "KEX:\(pubKeyBase64)"
        _ = try? await APIService.shared.sendMessage(toUser: peer.id, content: kexContent)
    }

    /// Complete key exchange with peer's public key — derive shared secret
    private func completeKeyExchange(theirPublicKeyData: Data) {
        // Already have a shared key — skip
        guard symmetricKey == nil else { return }

        // Load or generate our private key
        let privateKey: P384.KeyAgreement.PrivateKey
        if let existing = EncryptionService.loadPrivateKey(conversationId: peer.id) {
            privateKey = existing
        } else {
            privateKey = EncryptionService.generateKeyPair()
            EncryptionService.storePrivateKey(privateKey, conversationId: peer.id)
            // Send our public key back so the peer can also derive the shared key
            let pubKeyBase64 = EncryptionService.publicKeyData(from: privateKey).base64EncodedString()
            WebSocketService.shared.sendKeyExchange(to: peer.id, publicKey: pubKeyBase64)
            Task {
                _ = try? await APIService.shared.sendMessage(toUser: peer.id, content: "KEX:\(pubKeyBase64)")
            }
        }

        guard let sharedKey = try? EncryptionService.deriveSharedKey(
            myPrivateKey: privateKey,
            theirPublicKeyData: theirPublicKeyData
        ) else {
            errorMessage = "Key exchange failed — unable to derive shared secret"
            return
        }

        symmetricKey = sharedKey
        EncryptionService.storeSymmetricKey(sharedKey, conversationId: peer.id)
        encryptionReady = true

        // Flush all queued messages now that encryption is ready
        let pending = pendingOutgoing
        pendingOutgoing.removeAll()
        Task {
            for text in pending {
                await sendEncrypted(text, using: sharedKey)
            }
        }
    }

    // MARK: - Encrypted send with retry

    private func sendEncrypted(_ text: String, using key: SymmetricKey) async {
        do {
            let encrypted = try EncryptionService.encrypt(text, using: key)
            let sent = try await sendWithRetry(content: encrypted)
            var msg = sent
            msg.content = text // show decrypted content locally
            applyDisappearTimer(to: &msg)
            messages.append(msg)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Retry send with exponential backoff: 1s, 2s, 4s
    private func sendWithRetry(content: String, attempt: Int = 0) async throws -> Message {
        do {
            return try await APIService.shared.sendMessage(toUser: peer.id, content: content)
        } catch {
            if attempt < Self.maxRetries {
                let delay = UInt64(pow(2.0, Double(attempt))) * 1_000_000_000
                try? await Task.sleep(nanoseconds: delay)
                return try await sendWithRetry(content: content, attempt: attempt + 1)
            }
            throw error
        }
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
