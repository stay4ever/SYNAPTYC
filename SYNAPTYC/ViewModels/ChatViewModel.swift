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
    /// Zero-width space — silent bootstrap message sent by Alice after initAlice so Bob gets his cks
    private static let kBootstrapSentinel     = "\u{200B}"

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

        // MARK: Real-time message deletion
        WebSocketService.shared.$deletedMessageId
            .compactMap { $0 }
            .receive(on: RunLoop.main)
            .sink { [weak self] deletedId in
                self?.messages.removeAll { $0.id == deletedId }
            }
            .store(in: &cancellables)
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched = try await APIService.shared.messages(with: peer.id)

            // Use the MOST RECENT KEX from peer (handles reinstall / re-key scenarios)
            let latestPeerKex = fetched.last { $0.content.hasPrefix("KEX:") && $0.fromUser == peer.id }
            if let kexMsg = latestPeerKex,
               let pubKeyData = Data(base64Encoded: String(kexMsg.content.dropFirst(4))) {
                completeKeyExchange(theirPublicKeyData: pubKeyData)
            }

            // If still no ratchet, kick off ECDH exchange
            if ratchetState == nil {
                await initiateKeyExchange()
            }

            // Decrypt and filter protocol messages (nil = sentinel or undecryptable outgoing)
            let myId = AuthViewModel.shared.currentUser?.id ?? 0
            let display: [Message] = fetched.compactMap { msg in
                if msg.content.hasPrefix("KEX:") { return nil }
                var m = msg
                guard let plain = decryptContent(m.content, isMine: msg.fromUser == myId) else { return nil }
                m.content = plain
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
            // Encryption not ready yet — queue and ensure key exchange is running
            pendingOutgoing.append(text)
            if !keyExchangeInFlight {
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

        let myId2 = AuthViewModel.shared.currentUser?.id ?? 0
        guard let plain = decryptContent(m.content, isMine: m.fromUser == myId2) else { return }
        m.content = plain

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

    /// Returns nil for bootstrap sentinel or failed outgoing decryption (filter from UI).
    private func decryptContent(_ content: String, isMine: Bool = false) -> String? {
        if content.hasPrefix("DR2:") {
            if var state = ratchetState,
               let plain = try? DoubleRatchet.decrypt(state: &state, ciphertext: content) {
                ratchetState = state
                DoubleRatchet.save(state, for: peer.id)
                if !encryptionReady && state.cks != nil {
                    encryptionReady = true
                    flushPending()
                }
                return plain == Self.kBootstrapSentinel ? nil : plain
            }
            return isMine ? nil : "·· ··"
        } else if content.hasPrefix("ENC:"), let key = legacyKey {
            return (try? EncryptionService.decrypt(content, using: key)) ?? "·· ··"
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
    /// Derives the shared secret and bootstraps the Double Ratchet with correct Alice/Bob roles.
    private func completeKeyExchange(theirPublicKeyData: Data) {
        // Skip if this is the same ECDH key we already used to set up the current ratchet.
        // (Alice uses dhr == theirPublicKeyData; Bob stores the key separately in Keychain
        //  because Bob's dhr becomes the DR key after the bootstrap step, not the ECDH key.)
        let ecdhKeyTag = "\(Config.Keychain.privateKeyTag).ecdh.peer.\(peer.id)"
        if ratchetState != nil {
            if let stored = KeychainService.loadData(ecdhKeyTag), stored == theirPublicKeyData { return }
        }

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

        let sk = sharedSymKey.withUnsafeBytes { Data($0) }
        let myId = AuthViewModel.shared.currentUser?.id ?? 0

        // Role assignment: lower user ID is Alice (has cks immediately and sends bootstrap);
        // higher user ID is Bob (waits for Alice's bootstrap to derive his cks via DH ratchet step).
        if myId < peer.id {
            // Alice role
            guard let state = try? DoubleRatchet.initAlice(
                sharedSecret: sk,
                theirPublicKeyData: theirPublicKeyData
            ) else {
                errorMessage = "Encryption setup failed"
                return
            }
            ratchetState    = state
            DoubleRatchet.save(state, for: peer.id)
            _ = KeychainService.saveData(theirPublicKeyData, for: ecdhKeyTag)
            encryptionReady = true
            Task { await sendBootstrap() }
            flushPending()
        } else {
            // Bob role — cks comes after receiving Alice's bootstrap DH ratchet message
            let state = DoubleRatchet.initBob(
                sharedSecret: sk,
                ourPrivateKeyData: privateKey.rawRepresentation
            )
            ratchetState    = state
            DoubleRatchet.save(state, for: peer.id)
            _ = KeychainService.saveData(theirPublicKeyData, for: ecdhKeyTag)
            encryptionReady = false  // Bob waits for Alice's bootstrap to unlock sending
        }
    }

    /// Alice sends a silent zero-width-space message so Bob's DH ratchet step fires,
    /// giving Bob his sending chain key (cks) immediately.
    private func sendBootstrap() async {
        guard var state = ratchetState, state.cks != nil else { return }
        guard let encrypted = try? DoubleRatchet.encrypt(state: &state, plaintext: Self.kBootstrapSentinel) else { return }
        ratchetState = state
        DoubleRatchet.save(state, for: peer.id)
        _ = try? await APIService.shared.sendMessage(toUser: peer.id, content: encrypted)
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

    // MARK: - Flush pending messages (queued while encryption was being established)

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

    // MARK: - Delete message

    func deleteMessage(id: Int) {
        messages.removeAll { $0.id == id }
        Task { try? await APIService.shared.deleteMessage(id: id) }
    }
}
