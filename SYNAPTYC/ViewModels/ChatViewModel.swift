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
    private var consecutiveDecryptFailures    = 0
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
        WebSocketService.shared.incomingMessage
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
        WebSocketService.shared.incomingKeyExchange
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
        WebSocketService.shared.deletedMessageId
            .receive(on: RunLoop.main)
            .sink { [weak self] deletedId in
                self?.messages.removeAll { $0.id == deletedId }
            }
            .store(in: &cancellables)
    }

    // MARK: - Load

    func load() async {
        isLoading = true
        // Flush plaintext cache to Keychain once after all decryptions in this load cycle,
        // not on every individual cachePlaintext call (avoids O(n²) Keychain writes).
        defer {
            isLoading = false
            flushPlaintextCache()
        }
        do {
            let fetched = try await APIService.shared.messages(with: peer.id)

            // Snapshot whether a ratchet existed BEFORE we process any KEX.
            // If the ratchet is freshly established during this load() (was nil, now set),
            // old messages from a PREVIOUS session will legitimately fail to decrypt
            // (forward secrecy). Those failures are expected and must NOT trigger a reset
            // that would destroy the brand-new ratchet.
            let hadRatchetBeforeKEX = ratchetState != nil

            // Attempt key exchange using the most recent KEX from the peer in history.
            // completeKeyExchange has its own guard logic to skip if the session is already
            // up-to-date and avoid destroying a live ratchet.
            let latestPeerKex = fetched.last { $0.content.hasPrefix("KEX:") && $0.fromUser == peer.id }
            if let kexMsg = latestPeerKex,
               let pubKeyData = Data(base64Encoded: String(kexMsg.content.dropFirst(4))) {
                completeKeyExchange(theirPublicKeyData: pubKeyData)
            }

            // If still no ratchet, kick off our own ECDH exchange
            if ratchetState == nil {
                await initiateKeyExchange()
            }

            let myId = AuthViewModel.shared.currentUser?.id ?? 0

            // Decrypt and filter protocol messages.
            //
            // IMPORTANT: The Double Ratchet is stateful — each successful decrypt advances the
            // chain key. Re-running decryptContent on the same messages (e.g. pull-to-refresh)
            // would corrupt the ratchet making subsequent messages unreadable. We therefore
            // cache every decrypted plaintext by server message-ID on first decrypt, and
            // serve from that cache on all subsequent loads.
            //
            // Track fresh (not previously cached) DR2 decryption failures from the peer.
            // If the count is high AND the ratchet existed before this load (not freshly
            // established), the session is permanently desynced and needs a reset.
            var freshDR2Failures = 0

            let display: [Message] = fetched.compactMap { msg in
                if msg.content.hasPrefix("KEX:") { return nil }
                var m = msg
                let isMine = msg.fromUser == myId
                let isEncrypted = msg.content.hasPrefix("DR2:") || msg.content.hasPrefix("ENC:")

                if isEncrypted {
                    // Cache-hit → serve without touching the ratchet.
                    // Empty string is a sentinel meaning "already processed/filtered" (e.g. bootstrap).
                    if let cached = loadCachedPlaintext(messageId: msg.id) {
                        if cached.isEmpty { return nil }
                        m.content = cached
                        return m
                    }
                    // Cache-miss for own messages: sender cannot re-decrypt their own DR2
                    // ciphertext (forward secrecy — sending chain key is one-way).
                    // Cache as "" so future loads skip without touching the ratchet, then hide.
                    if isMine {
                        cachePlaintext(messageId: msg.id, text: "")
                        return nil
                    }
                    // Cache-miss for received message: run the ratchet exactly once, then cache.
                    // guard covers two filtered cases:
                    //   nil      → bootstrap sentinel (\u{200B})
                    //   "·· ··"  → ratchet advanced past this key (forward secrecy, can't re-derive)
                    // Both are stored as "" so future loads skip without re-touching the ratchet.
                    guard let plain = decryptContent(m.content, isMine: false),
                          plain != "·· ··" else {
                        // Only permanently cache failures when we actually have a ratchet.
                        // If ratchetState is nil, the KEX hasn't completed yet — these
                        // messages may become decryptable once the ratchet is established.
                        // Leaving them uncached lets the next load() retry them.
                        if ratchetState != nil {
                            cachePlaintext(messageId: msg.id, text: "")
                        }
                        if msg.content.hasPrefix("DR2:") { freshDR2Failures += 1 }
                        return nil
                    }
                    cachePlaintext(messageId: msg.id, text: plain)
                    m.content = plain
                    return m
                }

                // Not encrypted (plaintext or unrecognised prefix)
                guard let plain = decryptContent(m.content, isMine: isMine) else { return nil }
                m.content = plain
                return m
            }

            // Detect permanent session desync from history.
            // Only reset if the ratchet EXISTED before this load — if it was freshly
            // established (e.g. from a KEX in history or during initiateKeyExchange),
            // old messages from a previous session will legitimately fail (forward secrecy)
            // and those failures must not destroy the brand-new session.
            if freshDR2Failures >= 2 && hadRatchetBeforeKEX {
                await resetSession()
                // Schedule a delayed re-load so the peer's key exchange response
                // (which may arrive in the next 1-3 seconds via WS or REST) gets
                // picked up without requiring the user to close and reopen the chat.
                Task { [weak self] in
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    await self?.load()
                }
            }

            // Merge WebSocket-arrived messages that came in during the async API fetch.
            // handleIncoming() may have appended messages to `messages` while we were
            // awaiting the HTTP response; those IDs won't be in `fetched`, so a plain
            // `messages = display` would discard them.
            let fetchedIds = Set(fetched.map { $0.id })
            let wsArrived  = messages.filter { $0.id > 0 && !fetchedIds.contains($0.id) }
            messages = display + wsArrived
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
        let isMine2 = m.fromUser == myId2
        guard let plain = decryptContent(m.content, isMine: isMine2) else {
            // decryptContent returned nil → bootstrap sentinel (DR2 from peer, decrypted as zero-width space).
            // Only cache if we actually have a ratchet — if ratchetState is nil the
            // decrypt failed because KEX hasn't completed, and caching would permanently
            // hide the message even after the ratchet is established (cache poisoning).
            if !isMine2 && m.content.hasPrefix("DR2:") && ratchetState != nil {
                cachePlaintext(messageId: m.id, text: "")
            }
            return
        }
        // Filter undecryptable real-time messages (ratchet out of sync).
        // Only cache and count failures when we actually HAVE a ratchet — failures
        // during the KEX window (ratchetState nil) are expected and transient.
        // Those messages will be retried on the next load() after the ratchet is ready.
        if plain == "·· ··" {
            if !isMine2 {
                if ratchetState != nil {
                    cachePlaintext(messageId: m.id, text: "")
                    flushPlaintextCache()
                }
                consecutiveDecryptFailures += 1
                if consecutiveDecryptFailures >= 3 {
                    consecutiveDecryptFailures = 0
                    Task { await self.resetSession() }
                }
            }
            return
        }
        consecutiveDecryptFailures = 0

        m.content = plain

        // Cache the decrypted plaintext so load() doesn't re-run the ratchet on history reload.
        // Flush to Keychain immediately (real-time messages, not a batch operation).
        if !isMine2 {
            cachePlaintext(messageId: m.id, text: plain)
            flushPlaintextCache()
        }

        if !messages.contains(where: { $0.id == m.id }) {
            messages.append(m)
            // disappearsAt is populated from the server's expires_at field (M5).
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
        } else if content.hasPrefix("ENC:") {
            guard let key = legacyKey else { return nil }
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
        // Guard: skip re-initialization when we can verify this is the same session.
        //
        // Decision table:
        //   ecdhKeyTag == theirPublicKeyData  → same session, no-op
        //   ecdhKeyTag  != theirPublicKeyData → peer re-keyed, fall through to re-init
        //   ecdhKeyTag  missing               → cannot verify; treat as re-key, fall through
        let ecdhKeyTag = "\(Config.Keychain.privateKeyTag).ecdh.peer.\(peer.id)"
        if let stored = KeychainService.loadData(ecdhKeyTag) {
            // Only treat as same session when ratchetState is also intact.
            // If ratchetState is nil (cleared by reinstall / Keychain wipe) we must
            // re-init even if their public key hasn't changed, otherwise we remain
            // stuck with no ratchet and every message fails.
            if stored == theirPublicKeyData && ratchetState != nil { return }
            // Different key OR ratchet lost → fall through to re-initialize
        }
        // ecdhKeyTag missing or peer re-keyed or ratchet lost — fall through to (re-)initialize

        var privateKey: P384.KeyAgreement.PrivateKey
        if let existing = EncryptionService.loadPrivateKey(conversationId: peer.id) {
            privateKey = existing
        } else {
            privateKey = EncryptionService.generateKeyPair()
            EncryptionService.storePrivateKey(privateKey, conversationId: peer.id)
        }
        // ALWAYS send our public key back so the peer can complete their side.
        // Previously this was only done when generating a NEW key, meaning any peer
        // who reset their session would never get our response and stay stuck.
        let pubBase64 = EncryptionService.publicKeyData(from: privateKey).base64EncodedString()
        WebSocketService.shared.sendKeyExchange(to: peer.id, publicKey: pubBase64)
        Task { _ = try? await APIService.shared.sendMessage(toUser: peer.id, content: "KEX:\(pubBase64)") }

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
            // Bootstrap MUST arrive at server before any regular messages so Bob's
            // DH ratchet step fires and gives him his sending chain key (cks).
            // flushPending() is deferred inside the same Task so ordering is guaranteed.
            Task {
                await sendBootstrap()
                flushPending()
            }
        } else {
            // Bob role — cks comes after receiving Alice's bootstrap DH ratchet message
            guard let state = try? DoubleRatchet.initBob(
                sharedSecret: sk,
                ourPrivateKeyData: privateKey.rawRepresentation
            ) else {
                errorMessage = "Encryption setup failed (Bob init)"
                return
            }
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
        // Bootstrap is critical — without it Bob never gets his sending chain key.
        // Use the same retry logic as regular messages to survive transient failures.
        _ = try? await sendWithRetry(content: encrypted)
    }

    // MARK: - Encrypted send with retry

    private func sendEncrypted(_ text: String) async {
        guard var state = ratchetState else { return }
        do {
            let encrypted = try DoubleRatchet.encrypt(state: &state, plaintext: text)
            ratchetState  = state
            DoubleRatchet.save(state, for: peer.id)

            // M5: Pass the expire date to the server so TTL is enforced server-side.
            let expiresAt = disappearTimer.interval.map { Date().addingTimeInterval($0) }
            let sent = try await sendWithRetry(content: encrypted, expiresAt: expiresAt)
            var msg  = sent
            msg.content = text          // display plaintext locally

            // Cache plaintext by server message ID so we can restore it from history
            // on future loads (DR2 ciphertext cannot be decrypted by the sender).
            // Flush immediately so the cache survives if the app is killed right after send.
            cachePlaintext(messageId: sent.id, text: text)
            flushPlaintextCache()

            // disappearsAt is now populated by the server response decoder — no local override needed.
            messages.append(msg)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Exponential-backoff retry: 1 s, 2 s, 4 s
    private func sendWithRetry(content: String, expiresAt: Date? = nil, attempt: Int = 0) async throws -> Message {
        do {
            return try await APIService.shared.sendMessage(toUser: peer.id, content: content, expiresAt: expiresAt)
        } catch {
            guard attempt < Self.maxRetries else { throw error }
            let delay = UInt64(pow(2.0, Double(attempt))) * 1_000_000_000
            try? await Task.sleep(nanoseconds: delay)
            return try await sendWithRetry(content: content, expiresAt: expiresAt, attempt: attempt + 1)
        }
    }

    // MARK: - Sent-message plaintext cache (Keychain-backed, survives reinstall)
    //
    // DR2-encrypted messages cannot be decrypted by the sender or after the ratchet
    // advances past their key (forward secrecy). We persist plaintexts keyed by server
    // message ID in the Keychain so load() can restore them across app launches AND
    // reinstalls (Keychain persists; UserDefaults does not).
    //
    // Performance: mutations are accumulated in _plaintextCache (in-memory) and flushed
    // to Keychain in one batch via flushPlaintextCache(). Call flush at the end of load()
    // and immediately after each real-time send/receive.

    private var _plaintextCache: [String: String]?
    private var _plaintextCacheDirty = false

    private var plaintextCacheKey: String {
        "\(Config.Keychain.privateKeyTag).ptcache.\(peer.id)"
    }

    /// Returns the in-memory cache, loading from Keychain on first access.
    /// Performs a one-time migration from UserDefaults → Keychain for existing installs.
    private func plaintextCacheLoaded() -> [String: String] {
        if let c = _plaintextCache { return c }

        // 1. Try Keychain (survives app reinstall)
        if let data = KeychainService.loadData(plaintextCacheKey),
           let dict = try? JSONDecoder().decode([String: String].self, from: data) {
            _plaintextCache = dict
            return dict
        }

        // 2. One-time migration: move UserDefaults cache → Keychain
        let udKey = "sent_plaintexts_\(peer.id)"
        if let udDict = UserDefaults.standard.dictionary(forKey: udKey) as? [String: String],
           !udDict.isEmpty {
            _plaintextCache = udDict
            _plaintextCacheDirty = true   // will be written to Keychain on next flush
            UserDefaults.standard.removeObject(forKey: udKey)
            return udDict
        }

        _plaintextCache = [:]
        return [:]
    }

    /// Writes the in-memory cache to Keychain if dirty. Safe to call multiple times.
    private func flushPlaintextCache() {
        guard _plaintextCacheDirty, let cache = _plaintextCache else { return }
        if let data = try? JSONEncoder().encode(cache) {
            KeychainService.saveData(data, for: plaintextCacheKey)
        }
        _plaintextCacheDirty = false
    }

    private func cachePlaintext(messageId: Int, text: String) {
        var cache = plaintextCacheLoaded()
        cache["\(messageId)"] = text
        // Keep only the 500 most recent entries to cap Keychain storage growth
        if cache.count > 500 {
            let overflow = cache.count - 500
            let oldest = cache.keys.compactMap { Int($0) }.sorted().prefix(overflow)
            oldest.forEach { cache.removeValue(forKey: "\($0)") }
        }
        _plaintextCache = cache
        _plaintextCacheDirty = true
        // Callers responsible for calling flushPlaintextCache() at an appropriate batch boundary
    }

    private func loadCachedPlaintext(messageId: Int) -> String? {
        return plaintextCacheLoaded()["\(messageId)"]
    }

    // MARK: - Session reset (auto-recovery from permanent desync)

    /// Wipes all local ECDH and ratchet state for this conversation and kicks off a
    /// fresh key exchange.  Called automatically after 3 consecutive decrypt failures,
    /// which signals that one party's ratchet is permanently out of sync with the other's
    /// (typically caused by a reinstall or Keychain wipe on one device).
    private func resetSession() async {
        DoubleRatchet.delete(for: peer.id)
        ratchetState  = nil
        encryptionReady = false
        consecutiveDecryptFailures = 0
        // Wipe the stored ECDH peer-key tag so completeKeyExchange doesn't
        // treat the next KEX as a no-op same-session check.
        let ecdhKeyTag = "\(Config.Keychain.privateKeyTag).ecdh.peer.\(peer.id)"
        KeychainService.delete(ecdhKeyTag)
        // Wipe our own ECDH private key so we generate a fresh one in initiateKeyExchange.
        KeychainService.delete("\(Config.Keychain.privateKeyTag).\(peer.id)")
        await initiateKeyExchange()
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
        // L6: Save the message so we can restore it if the server rejects the delete.
        guard let removed = messages.first(where: { $0.id == id }) else { return }
        messages.removeAll { $0.id == id }
        Task {
            do {
                try await APIService.shared.deleteMessage(id: id)
            } catch {
                // Restore the message if server-side delete fails.
                messages.append(removed)
                messages.sort { $0.id < $1.id }
                errorMessage = "Could not delete message: \(error.localizedDescription)"
            }
        }
    }
}
