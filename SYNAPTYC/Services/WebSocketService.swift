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
        case createdAt     = "created_at"
        case messageId     = "message_id"
        case publicKey     = "public_key"
        case groupId       = "group_id"
        case fromUsername  = "from_username"
        case fromDisplay   = "from_display"
        case encryptedKey  = "encrypted_key"
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

    @Published var onlineUserIds: Set<Int>          = []
    @Published var incomingMessage: Message?
    @Published var incomingGroupMessage: GroupMessage?
    @Published var incomingKeyExchange: KeyExchangeEvent?
    @Published var deletedMessageId: Int?
    @Published var typingUsers: Set<Int>            = []
    @Published var isConnected                      = false

    private var webSocketTask: URLSessionWebSocketTask?
    private var pingTimer: Timer?
    private var reconnectTask: Task<Void, Never>?
    private var reconnectAttempt = 0
    private static let maxReconnectDelay: UInt64 = 30_000_000_000 // 30 s cap
    private static let maxReconnectAttempts = 10

    private init() {}

    // MARK: - Connection

    func connect() {
        // Don't double-connect
        guard webSocketTask == nil || !(webSocketTask?.state == .running) else { return }
        guard let token = KeychainService.load(Config.Keychain.tokenKey) else { return }
        guard let url = URL(string: "\(Config.wsURL)?token=\(token)") else { return }

        let session = URLSession(configuration: .default)
        let task = session.webSocketTask(with: url)
        webSocketTask = task
        task.resume()
        // isConnected set to true only after first successful message or ping ACK
        receive()
        startPing()
    }

    func disconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
        pingTimer?.invalidate()
        pingTimer = nil
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected      = false
        onlineUserIds    = []
        reconnectAttempt = 0
    }

    // MARK: - Outgoing messages

    func sendTyping(to userId: Int) {
        send(["type": "typing", "to": userId])
    }

    func markRead(from userId: Int) {
        send(["type": "mark_read", "from": userId])
    }

    func markRead(messageId: Int) {
        send(["type": "mark_read", "message_id": messageId])
    }

    func sendGroupMessage(groupId: Int, content: String) {
        send(["type": "group_message", "group_id": groupId, "content": content])
    }

    /// Send ECDH public key to a peer for key exchange
    func sendKeyExchange(to userId: Int, publicKey: String) {
        send([
            "type":       "key_exchange",
            "to":         userId,
            "public_key": publicKey
        ])
    }

    // MARK: - Internal send

    private func send(_ dict: [String: Any]) {
        guard let task = webSocketTask, task.state == .running else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let str  = String(data: data, encoding: .utf8) else { return }
        task.send(.string(str)) { _ in }
    }

    // MARK: - Receive loop

    private func receive() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let msg):
                Task { @MainActor in
                    self.isConnected = true   // first message confirms connection
                    if case .string(let text) = msg {
                        self.handle(text)
                    }
                    self.receive()          // re-arm on main actor
                }
            case .failure:
                Task { @MainActor in
                    self.isConnected = false
                    self.scheduleReconnect()
                }
            }
        }
    }

    private func scheduleReconnect() {
        guard reconnectAttempt < Self.maxReconnectAttempts else { return }
        reconnectTask?.cancel()
        let delay = min(
            UInt64(pow(2.0, Double(reconnectAttempt + 1))) * 1_000_000_000,
            Self.maxReconnectDelay
        )
        reconnectAttempt += 1
        reconnectTask = Task { @MainActor [weak self] in
            guard let self else { return }
            try? await Task.sleep(nanoseconds: delay)
            guard !Task.isCancelled else { return }
            // Tear down old socket cleanly before creating a new one
            self.pingTimer?.invalidate()
            self.pingTimer = nil
            self.webSocketTask?.cancel(with: .normalClosure, reason: nil)
            self.webSocketTask = nil
            self.connect()
        }
    }

    // MARK: - Message handler

    private func handle(_ text: String) {
        let data = Data(text.utf8)
        guard let msg = try? JSONDecoder().decode(WSMessage.self, from: data) else { return }

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
            if let id       = msg.id,
               let gid      = msg.groupId,
               let from     = msg.from,
               let content  = msg.content,
               let username = msg.fromUsername,
               let display  = msg.fromDisplay {
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
                isConnected = true
            }

        case "message_deleted":
            if let id = msg.id {
                deletedMessageId = id
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
            guard let self else { return }
            Task { @MainActor in
                guard let task = self.webSocketTask, task.state == .running else { return }
                task.sendPing { [weak self] error in
                    if error != nil {
                        Task { @MainActor in
                            self?.isConnected = false
                            self?.scheduleReconnect()
                        }
                    } else {
                        Task { @MainActor in self?.isConnected = true }
                    }
                }
            }
        }
    }
}
