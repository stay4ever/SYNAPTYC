import Foundation
import Combine
import CryptoKit

@MainActor
final class GroupChatViewModel: ObservableObject {
    @Published var messages: [GroupMessage] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var encryptionReady = false

    let group: Group
    private var cancellables = Set<AnyCancellable>()
    private var groupKey: SymmetricKey?
    private var pendingOutgoing: [String] = []
    private var isGeneratingKey = false
    /// Counter for temporary local IDs — always negative so they never clash with server IDs
    private var tempIdCounter = -1

    init(group: Group) {
        self.group = group

        // Load persisted group key
        self.groupKey        = EncryptionService.loadSymmetricKey(conversationId: Self.groupConversationId(group.id))
        self.encryptionReady = groupKey != nil

        // MARK: Incoming group messages
        WebSocketService.shared.$incomingGroupMessage
            .compactMap { $0 }
            .filter { $0.groupId == group.id }
            .receive(on: RunLoop.main)
            .sink { [weak self] gm in
                guard let self else { return }
                if gm.content.hasPrefix("GKEX:") {
                    self.handleGroupKeyMessage(gm)
                    return
                }
                var m = gm
                if let key = self.groupKey {
                    m.content = (try? EncryptionService.decrypt(m.content, using: key)) ?? m.content
                }
                let myId = AuthViewModel.shared.currentUser?.id ?? 0
                // If this echo is from us, replace the optimistic temp message (negative ID)
                // rather than appending a duplicate.
                if m.fromUser == myId,
                   let tempIdx = self.messages.firstIndex(where: { $0.id < 0 && $0.content == m.content }) {
                    self.messages[tempIdx] = m
                    return
                }
                guard !self.messages.contains(where: { $0.id == m.id }) else { return }
                self.messages.append(m)
            }
            .store(in: &cancellables)
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched = try await APIService.shared.groupMessages(groupId: group.id)

            // Scan for group key if we don't have one yet
            if groupKey == nil {
                for msg in fetched where msg.content.hasPrefix("GKEX:") {
                    handleGroupKeyMessage(msg)
                    if groupKey != nil { break }
                }
            }

            // Generate and distribute a fresh key if still missing
            if groupKey == nil {
                generateAndDistributeGroupKey()
            }

            // Decrypt + filter protocol messages
            messages = fetched.compactMap { msg -> GroupMessage? in
                if msg.content.hasPrefix("GKEX:") { return nil }
                var m = msg
                if let key = self.groupKey {
                    m.content = (try? EncryptionService.decrypt(m.content, using: key)) ?? m.content
                }
                return m
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func send(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        guard let key = groupKey else {
            // Queue and generate key — 100% encrypted, no plaintext fallback
            pendingOutgoing.append(trimmed)
            generateAndDistributeGroupKey()
            return
        }
        sendEncrypted(trimmed, using: key)
    }

    func addMember(userId: Int) async {
        do {
            _ = try await APIService.shared.addGroupMember(groupId: group.id, userId: userId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Group key management

    /// Negative conversation ID distinguishes group keys from DM keys in Keychain
    static func groupConversationId(_ groupId: Int) -> Int { -groupId }

    private func generateAndDistributeGroupKey() {
        guard !isGeneratingKey, groupKey == nil else { return }
        isGeneratingKey = true
        defer { isGeneratingKey = false }

        let key = SymmetricKey(size: .bits256)
        groupKey = key
        encryptionReady = true
        EncryptionService.storeSymmetricKey(key, conversationId: Self.groupConversationId(group.id))

        // Distribute the raw key over the group channel (server-visible; see note below).
        // NOTE: This provides in-transit confidentiality between group members for *content*,
        // but the key itself is relay-visible. A full forward-secret group E2E scheme (e.g.
        // Signal's Sender Keys or MLS) would encrypt the GKEX payload per-member using each
        // member's individual ratchet public key — a future improvement.
        let keyData   = key.withUnsafeBytes { Data($0) }
        let keyBase64 = keyData.base64EncodedString()
        WebSocketService.shared.sendGroupMessage(groupId: group.id, content: "GKEX:\(keyBase64)")

        flushPending(using: key)
    }

    private func handleGroupKeyMessage(_ gm: GroupMessage) {
        guard groupKey == nil else { return }
        let base64 = String(gm.content.dropFirst(5)) // strip "GKEX:"
        guard let keyData = Data(base64Encoded: base64), keyData.count == 32 else { return }

        let key = SymmetricKey(data: keyData)
        groupKey = key
        encryptionReady = true
        EncryptionService.storeSymmetricKey(key, conversationId: Self.groupConversationId(group.id))
        flushPending(using: key)
    }

    // MARK: - Encrypted send

    private func sendEncrypted(_ text: String, using key: SymmetricKey) {
        guard let encrypted = try? EncryptionService.encrypt(text, using: key) else {
            errorMessage = "Encryption failed"
            return
        }
        WebSocketService.shared.sendGroupMessage(groupId: group.id, content: encrypted)

        // Optimistic local append — show message immediately without waiting for WS echo.
        // Negative ID ensures no collision with server-assigned positive IDs.
        let me = AuthViewModel.shared.currentUser
        let local = GroupMessage(
            id: tempIdCounter,
            groupId: group.id,
            fromUser: me?.id ?? 0,
            fromUsername: me?.username ?? "",
            fromDisplay: me?.name ?? "",
            content: text,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        tempIdCounter -= 1
        messages.append(local)
    }

    private func flushPending(using key: SymmetricKey) {
        let pending = pendingOutgoing
        pendingOutgoing.removeAll()
        for text in pending { sendEncrypted(text, using: key) }
    }
}
