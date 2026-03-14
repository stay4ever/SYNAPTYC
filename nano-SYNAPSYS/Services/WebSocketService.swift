import Foundation
import Combine

struct WSMessage: Decodable {
    let type: String
    // DM fields
    let id: Int?
    let from: Int?
    let to: Int?
    let content: String?
    let createdAt: String?
    let read: Bool?
    let messageId: Int?
    // Key exchange fields
    let publicKey: String?
    // Group message fields
    let groupId: Int?
    let fromUsername: String?
    let fromDisplay: String?
    // Group key fields
    let encryptedKey: String?
    // User list
    let users: [WSUser]?

    enum CodingKeys: String, CodingKey {
        case type, id, content, from, to, users, read
        case createdAt    = "created_at"
        case messageId    = "message_id"
        case publicKey    = "public_key"
        case groupId      = "group_id"
        case fromUsername  = "from_username"
        case fromDisplay   = "from_display"
        case encryptedKey = "encrypted_key"
    }
}

struct WSUser: Decodable {
    let id: Int
    let username: String
    let displayName: String?
    let online: Bool

    enum CodingKeys: String, CodingKey {
        case id, username, online
        case displayName = "display_name"
    }
}

/// Event emitted when a peer sends their ECDH public key
struct KeyExchangeEvent {
    let from: Int
    let publicKeyData: Data
}

@MainActor
final class WebSocketService: ObservableObject {
    static let shared = WebSocketService()

    @Published var onlineUserIds: Set<Int>                = []
    @Published var incomingMessage: Message?
    @Published var incomingGroupMessage: GroupMessage?
    @Published var incomingKeyExchange: KeyExchangeEvent?
    @Published var typingUsers: Set<Int>                   = []
    @Published var isConnected                             = false

    private var webSocketTask: URLSessionWebSocketTask?
    private var pingTimer: Timer?
    private var reconnectAttempt = 0
    private static let maxReconnectDelay: UInt64 = 30_000_000_000 // 30s cap

    private init() {}

    // MARK: - Connection

    func connect() {
        guard let token = KeychainService.load(Config.Keychain.tokenKey) else { return }
        guard let url = URL(string: "\(Config.wsURL)?token=\(token)") else { return }
        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        isConnected = true
        reconnectAttempt = 0
        receive()
        startPing()
    }

    func disconnect() {
        pingTimer?.invalidate()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected   = false
        onlineUserIds = []
        reconnectAttempt = 0
    }

    // MARK: - Outgoing messages

    func sendTyping(to userId: Int) {
        let payload: [String: Any] = ["type": "typing", "to": userId]
        send(payload)
    }

    func markRead(from userId: Int) {
        let payload: [String: Any] = ["type": "mark_read", "from": userId]
        send(payload)
    }

    func markRead(messageId: Int) {
        let payload: [String: Any] = ["type": "mark_read", "message_id": messageId]
        send(payload)
    }

    func sendGroupMessage(groupId: Int, content: String) {
        let payload: [String: Any] = ["type": "group_message", "group_id": groupId, "content": content]
        send(payload)
    }

    /// Send ECDH public key to a peer for key exchange
    func sendKeyExchange(to userId: Int, publicKey: String) {
        let payload: [String: Any] = [
            "type": "key_exchange",
            "to": userId,
            "public_key": publicKey
        ]
        send(payload)
    }

    // MARK: - Internal send

    private func send(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let str  = String(data: data, encoding: .utf8) else { return }
        webSocketTask?.send(.string(str)) { _ in }
    }

    // MARK: - Receive loop

    private func receive() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let msg):
                if case .string(let text) = msg {
                    Task { @MainActor in self.handle(text) }
                }
                self.receive()
            case .failure:
                Task { @MainActor in
                    self.isConnected = false
                    // Exponential backoff reconnect: 2s, 4s, 8s, 16s, capped at 30s
                    let delay = min(
                        UInt64(pow(2.0, Double(self.reconnectAttempt + 1))) * 1_000_000_000,
                        Self.maxReconnectDelay
                    )
                    self.reconnectAttempt += 1
                    try? await Task.sleep(nanoseconds: delay)
                    self.connect()
                }
            }
        }
    }

    // MARK: - Message handler

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let msg  = try? JSONDecoder().decode(WSMessage.self, from: data) else { return }

        switch msg.type {
        case "chat_message":
            if let from = msg.from, let to = msg.to, let content = msg.content, let id = msg.id {
                let message = Message(
                    id: id, fromUser: from, toUser: to,
                    content: content, read: msg.read ?? false,
                    createdAt: msg.createdAt ?? ISO8601DateFormatter().string(from: Date())
                )
                incomingMessage = message
            }

        case "key_exchange":
            if let from = msg.from,
               let pubKeyStr = msg.publicKey,
               let pubKeyData = Data(base64Encoded: pubKeyStr) {
                incomingKeyExchange = KeyExchangeEvent(from: from, publicKeyData: pubKeyData)
            }

        case "group_message":
            if let id = msg.id,
               let gid = msg.groupId,
               let from = msg.from,
               let content = msg.content,
               let username = msg.fromUsername,
               let display = msg.fromDisplay {
                let gm = GroupMessage(
                    id: id, groupId: gid,
                    fromUser: from, fromUsername: username, fromDisplay: display,
                    content: content,
                    createdAt: msg.createdAt ?? ISO8601DateFormatter().string(from: Date())
                )
                incomingGroupMessage = gm
            }

        case "mark_read":
            if let id = msg.messageId ?? msg.id, let from = msg.from, let to = msg.to {
                var readMsg = Message(
                    id: id, fromUser: from, toUser: to,
                    content: "", read: true,
                    createdAt: msg.createdAt ?? ISO8601DateFormatter().string(from: Date())
                )
                readMsg.isEncrypted = false
                incomingMessage = readMsg
            }

        case "user_list":
            if let users = msg.users {
                onlineUserIds = Set(users.filter { $0.online }.map { $0.id })
            }

        case "typing":
            if let from = msg.from {
                typingUsers.insert(from)
                Task {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    await MainActor.run { self.typingUsers.remove(from) }
                }
            }

        default: break
        }
    }

    // MARK: - Keep-alive

    private func startPing() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
            self?.webSocketTask?.sendPing { _ in }
        }
    }
}
