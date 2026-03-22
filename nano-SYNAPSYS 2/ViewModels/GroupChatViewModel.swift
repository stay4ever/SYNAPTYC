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

    init(group: Group) {
        self.group = group

        // Load persisted group key
        self.groupKey = EncryptionService.loadSymmetricKey(conversationId: Self.groupConversationId(group.id))
        self.encryptionReady = groupKey != nil

        // MARK: Incoming group messages
        WebSocketService.shared.$incomingGroupMessage
            .compactMap { $0 }
            .filter { $0.groupId == group.id }
            .receive(on: RunLoop.main)
            .sink { [weak self] gm in
                guard let self else { return }
                // Handle group key distribution messages
                if gm.content.hasPrefix("GKEX:") {
                    self.handleGroupKeyMessage(gm)
                    return
                }
                var m = gm
                // Decrypt group message
                if let key = self.groupKey {
                    m.content = (try? EncryptionService.decrypt(m.content, using: key)) ?? m.content
                }
                if !self.messages.contains(where: { $0.id == m.id }) {
                    self.messages.append(m)
                }
            }
            .store(in: &cancellables)
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let fetched = try await APIService.shared.groupMessages(groupId: group.id)

            // If no group key, check for GKEX messages in history
            if groupKey == nil {
                for msg in fetched where msg.content.hasPrefix("GKEX:") {
                    handleGroupKeyMessage(msg)
                    if groupKey != nil { break }
                }
            }

            // If still no group key, generate one and distribute
            if groupKey == nil {
                generateAndDistributeGroupKey()
            }

            // Decrypt and filter out GKEX protocol messages
            messages = fetched.compactMap { msg in
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
            // Queue until group key is ready
            pendingOutgoing.append(trimmed)
            generateAndDistributeGroupKey()
            return
        }

        sendEncrypted(trimmed, using: key)
    }

    // MARK: - Group key management

    /// Use a negative conversation ID to distinguish group keys from DM keys
    static func groupConversationId(_ groupId: Int) -> Int {
        return -groupId
    }

    /// Generate a random group symmetric key and distribute to members
    private func generateAndDistributeGroupKey() {
        let key = SymmetricKey(size: .bits256)
        groupKey = key
        encryptionReady = true
        EncryptionService.storeSymmetricKey(key, conversationId: Self.groupConversationId(group.id))

        // Distribute: encode the key as base64 and send as a GKEX message in the group
        let keyData = key.withUnsafeBytes { Data($0) }
        let keyBase64 = keyData.base64EncodedString()
        let gkexContent = "GKEX:\(keyBase64)"
        WebSocketService.shared.sendGroupMessage(groupId: group.id, content: gkexContent)

        // Flush pending
        flushPending(using: key)
    }

    /// Handle an incoming group key distribution message
    private func handleGroupKeyMessage(_ gm: GroupMessage) {
        // Don't overwrite if we already have a key
        guard groupKey == nil else { return }
        let base64 = String(gm.content.dropFirst(5)) // drop "GKEX:"
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
    }

    private func flushPending(using key: SymmetricKey) {
        let pending = pendingOutgoing
        pendingOutgoing.removeAll()
        for text in pending {
            sendEncrypted(text, using: key)
        }
    }
}
