import Foundation
import Combine
import CryptoKit

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [Message]        = []
    @Published var isLoading                  = false
    @Published var errorMessage: String?
    @Published var disappearTimer: DisappearTimer = .off
    @Published var isTyping                   = false
    @Published var encryptionReady            = false

    let peer: AppUser

    private var ratchetState: RatchetState?
    /// Legacy symmetric key — used only to decrypt old "ENC:" messages
    private var legacyKey: SymmetricKey?

    private var cancellables                  = Set<AnyCancellable>()
    private var pendingOutgoing: [String]     = []
    private var keyExchangeInFlight           = false
    private static let maxRetries             = 3

    init(peer: AppUser) {
        self.peer = peer

        // Restore persisted ratchet state (covers app restarts)
        ratchetState    = DoubleRatchet.load(for: peer.id)
        legacyKey       = EncryptionService.loadSymmetricKey(conversationId: peer.id)
        encryptionReady = ratchetState?.cks != nil

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
            .sink { [weak self] msg in self?.handleIncoming(msg) }
            .store(in: &cancellables)

        // MARK: Incoming key-exchange events (real-time via WebSocket)
        WebSocketService.shared.$incomingKeyExchange
            .compactMap { $0 }
            .filter { [weak self] kex in kex.from == self?.peer.id }
            .receive(on: RunLoop.main)
            .sink { [weak self] kex in self?.completeKeyExchange(theirPublicKeyData: kex.publicKeyData) }
            .store(in: &cancellables)

        // MARK: Typing indicator
        WebSocketService.shared.$typingUsers
            .receive(on: RunLoop.main)
            .map { [weak self] ids in ids.contains(self?.peer.id ?? -1) }
            .assign(to: &$isTyping)
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched = try await APIService.shared.messages(with: peer.id)

            // Scan history for peer's ECDH public key if we don't have a ratchet yet
            if ratchetState == nil {
                for msg in fetched where msg.content.hasPrefix("KEX:") && msg.fromUser == peer.id {
                    let base64 = String(msg.content.dropFirst(4))
                    if let pubKeyData = Data(base64Encoded: base64) {
                        completeKeyExchange(theirPublicKeyData: pubKeyData)
                        break
                    }
                }
            }

            // If still no ratchet, kick off ECDH exchange
            if ratchetState == nil {
                await initiateKeyExchange()
            }

            // Decrypt and filter protocol messages
            let display: [Message] = fetched.compactMap { msg in
                if msg.content.hasPrefix("KEX:") { return nil }
                var m = msg
                m.content = decryptContent(m.content)
                return m
            }
            messages = display
            purgeExpired()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Send

    func send(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        guard ratchetState?.cks != nil else {
            pendingOutgoing.append(text)
            if !keyExchangeInFlight && ratchetState == nil {
                await initiateKeyExchange()
            }
            return
        }

        await sendEncrypted(text)
    }

    func sendTypingIndicator() {
        WebSocketService.shared.sendTyping(to: peer.id)
    }

    // MARK: - Incoming message handler

    private func handleIncoming(_ msg: Message) {
        // Read-receipt update for an existing message
        if msg.read, let idx = messages.firstIndex(where: { $0.id == msg.id }) {
            messages[idx].read = true
            return
        }

        var m = msg

        // Filter out ECDH key-exchange protocol messages
        if m.content.hasPrefix("KEX:") {
            if m.fromUser == peer.id {
                let base64 = String(m.content.dropFirst(4))
                if let pubKeyData = Data(base64Encoded: base64) {
                    completeKeyExchange(theirPublicKeyData: pubKeyData)
                }
            }
            return
        }

        m.content = decryptContent(m.content)

        if !messages.contains(where: { $0.id == m.id }) {
            messages.append(m)
            applyDisappearTimer(to: &messages[messages.count - 1])
        }

        if m.fromUser == peer.id {
            WebSocketService.shared.markRead(messageId: m.id)
            NotificationService.scheduleLocal(title: peer.name, body: "New encrypted message")
        }
    }

    // MARK: - Decrypt  (DR2 → legacy ENC: → plaintext fallback)

    private func decryptContent(_ content: String) -> String {
        if content.hasPrefix("DR2:") {
            if var state = ratchetState,
               let plain = try? DoubleRatchet.decrypt(state: &state, ciphertext: content) {
                ratchetState = state
                DoubleRatchet.save(state, for: peer.id)
                // Bob gets CKs after the first successful DH ratchet step
                if !encryptionReady && state.cks != nil {
                    encryptionReady = true
                    flushPending()
                }
                return plain
            }
        } else if content.hasPrefix("ENC:"), let key = legacyKey {
            return (try? EncryptionService.decrypt(content, using: key)) ?? content
        }
        return content
    }

    // MARK: - ECDH Key Exchange

    /// Broadcast our P-384 public key so the peer can derive the shared secret.
    private func initiateKeyExchange() async {
        keyExchangeInFlight = true
        defer { keyExchangeInFlight = false }

        let privateKey: P384.KeyAgreement.PrivateKey
        if let existing = EncryptionService.loadPrivateKey(conversationId: peer.id) {
            privateKey = existing
        } else {
            privateKey = EncryptionService.generateKeyPair()
            EncryptionService.storePrivateKey(privateKey, conversationId: peer.id)
        }

        let pubBase64 = EncryptionService.publicKeyData(from: privateKey).base64EncodedString()
        WebSocketService.shared.sendKeyExchange(to: peer.id, publicKey: pubBase64)
        _ = try? await APIService.shared.sendMessage(toUser: peer.id, content: "KEX:\(pubBase64)")
    }

    /// Called when we receive the peer's ECDH public key.
    /// Derives the shared secret and bootstraps the Double Ratchet.
    private func completeKeyExchange(theirPublicKeyData: Data) {
        guard ratchetState == nil else { return }

        var privateKey: P384.KeyAgreement.PrivateKey
        if let existing = EncryptionService.loadPrivateKey(conversationId: peer.id) {
            privateKey = existing
        } else {
            privateKey = EncryptionService.generateKeyPair()
            EncryptionService.storePrivateKey(privateKey, conversationId: peer.id)
            // Send our key back so the peer can complete their side
            let pubBase64 = EncryptionService.publicKeyData(from: privateKey).base64EncodedString()
            WebSocketService.shared.sendKeyExchange(to: peer.id, publicKey: pubBase64)
            Task { _ = try? await APIService.shared.sendMessage(toUser: peer.id, content: "KEX:\(pubBase64)") }
        }

        guard let sharedSymKey = try? EncryptionService.deriveSharedKey(
            myPrivateKey: privateKey,
            theirPublicKeyData: theirPublicKeyData
        ) else {
            errorMessage = "Key exchange failed — unable to derive shared secret"
            return
        }

        let sk   = sharedSymKey.withUnsafeBytes { Data($0) }
        let myId = AuthViewModel.shared.currentUser?.id ?? 0

        // Lower user ID = "Alice" (initiator — gets CKs immediately).
        // Higher user ID = "Bob"  (responder — gets CKs after Alice's first message).
        let state: RatchetState
        if myId < peer.id {
            guard let s = try? DoubleRatchet.initAlice(
                sharedSecret: sk,
                theirPublicKeyData: theirPublicKeyData
            ) else {
                errorMessage = "Double Ratchet initialisation failed"
                return
            }
            state = s
        } else {
            state = DoubleRatchet.initBob(
                sharedSecret: sk,
                ourPrivateKeyData: privateKey.rawRepresentation
            )
        }

        ratchetState    = state
        DoubleRatchet.save(state, for: peer.id)
        encryptionReady = state.cks != nil      // true for Alice, false for Bob until first recv

        flushPending()
    }

    // MARK: - Encrypted send with retry

    private func sendEncrypted(_ text: String) async {
        guard var state = ratchetState else { return }
        do {
            let encrypted = try DoubleRatchet.encrypt(state: &state, plaintext: text)
            ratchetState  = state
            DoubleRatchet.save(state, for: peer.id)

            let sent = try await sendWithRetry(content: encrypted)
            var msg  = sent
            msg.content = text          // display plaintext locally
            applyDisappearTimer(to: &msg)
            messages.append(msg)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Exponential-backoff retry: 1 s, 2 s, 4 s
    private func sendWithRetry(content: String, attempt: Int = 0) async throws -> Message {
        do {
            return try await APIService.shared.sendMessage(toUser: peer.id, content: content)
        } catch {
            guard attempt < Self.maxRetries else { throw error }
            let delay = UInt64(pow(2.0, Double(attempt))) * 1_000_000_000
            try? await Task.sleep(nanoseconds: delay)
            return try await sendWithRetry(content: content, attempt: attempt + 1)
        }
    }

    // MARK: - Flush pending messages

    private func flushPending() {
        guard encryptionReady else { return }
        let pending = pendingOutgoing
        pendingOutgoing.removeAll()
        Task { for text in pending { await sendEncrypted(text) } }
    }

    // MARK: - Disappearing messages

    private func applyDisappearTimer(to msg: inout Message) {
        guard let interval = disappearTimer.interval else { return }
        msg.disappearsAt = Date().addingTimeInterval(interval)
    }

    func purgeExpired() {
        let now = Date()
        messages.removeAll { $0.disappearsAt.map { $0 < now } ?? false }
    }
}
