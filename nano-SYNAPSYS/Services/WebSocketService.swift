import Foundation
import Combine

/// WebSocketService: Singleton for real-time WebSocket communication.
/// Handles connection, message routing, and Combine-based event publishing.
final class WebSocketService: NSObject, URLSessionWebSocketDelegate {
    static let shared = WebSocketService()

    private let wsURL = URL(string: "wss://api.nanosynapsys.com/ws")!
    private let keychain = KeychainService.shared

    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?

    // Combine publishers for message routing
    let newMessagePublisher = PassthroughSubject<NewMessageEvent, Never>()
    let typingPublisher = PassthroughSubject<TypingEvent, Never>()
    let presencePublisher = PassthroughSubject<PresenceEvent, Never>()
    let keyExchangePublisher = PassthroughSubject<KeyExchangeEvent, Never>()
    let groupMessagePublisher = PassthroughSubject<GroupMessageEvent, Never>()
    let groupUpdatePublisher = PassthroughSubject<GroupUpdateEvent, Never>()
    let groupMemberUpdatePublisher = PassthroughSubject<GroupMemberUpdateEvent, Never>()

    // Compatibility aliases used by ViewModels
    var messageReceived: PassthroughSubject<Message, Never> { _messageReceived }
    var typingIndicator: PassthroughSubject<TypingEvent, Never> { typingPublisher }
    var groupUpdate: PassthroughSubject<GroupUpdateEvent, Never> { groupUpdatePublisher }
    var groupMemberUpdate: PassthroughSubject<GroupMemberUpdateEvent, Never> { groupMemberUpdatePublisher }
    private let _messageReceived = PassthroughSubject<Message, Never>()

    private var pingTimer: Timer?
    private var reconnectTimer: Timer?
    private var isConnected = false

    override private init() {
        super.init()
    }

    // MARK: - Connection Management

    /// Connect to the WebSocket using JWT authentication.
    func connect(with token: String) {
        // Cancel any pending reconnect attempts
        reconnectTimer?.invalidate()

        let config = URLSessionConfiguration.default
        session = URLSession(configuration: config, delegate: self, delegateQueue: .main)

        var request = URLRequest(url: wsURL)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        webSocket = session?.webSocketTask(with: request)
        webSocket?.resume()

        isConnected = true
        receiveMessages()
        startPingKeepAlive()
    }

    /// Disconnect from the WebSocket.
    func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil

        if let webSocket = webSocket {
            webSocket.cancel(with: .goingAway, reason: nil)
            self.webSocket = nil
        }

        isConnected = false
    }

    // MARK: - Message Reception

    /// Continuously receive messages from the WebSocket.
    private func receiveMessages() {
        guard let webSocket = webSocket else { return }

        webSocket.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleMessage(message)
                self?.receiveMessages()

            case .failure(let error):
                if self?.isConnected == true {
                    print("WebSocket error: \(error.localizedDescription)")
                    self?.scheduleReconnect()
                }
            }
        }
    }

    /// Handle an incoming WebSocket message.
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let jsonString):
            guard let data = jsonString.data(using: .utf8) else { return }
            do {
                let wsMessage = try JSONDecoder().decode(WSMessage.self, from: data)
                routeMessage(wsMessage)
            } catch {
                print("Failed to decode WebSocket message: \(error)")
            }

        case .data(let data):
            do {
                let wsMessage = try JSONDecoder().decode(WSMessage.self, from: data)
                routeMessage(wsMessage)
            } catch {
                print("Failed to decode WebSocket data: \(error)")
            }

        @unknown default:
            break
        }
    }

    /// Route decoded WebSocket message to appropriate publisher.
    private func routeMessage(_ wsMessage: WSMessage) {
        switch wsMessage.type {
        case "newMessage":
            if let event = wsMessage.as(NewMessageEvent.self) {
                newMessagePublisher.send(event)
            }

        case "typing":
            if let event = wsMessage.as(TypingEvent.self) {
                typingPublisher.send(event)
            }

        case "presence":
            if let event = wsMessage.as(PresenceEvent.self) {
                presencePublisher.send(event)
            }

        case "keyExchange":
            if let event = wsMessage.as(KeyExchangeEvent.self) {
                keyExchangePublisher.send(event)
            }

        case "groupMessage":
            if let event = wsMessage.as(GroupMessageEvent.self) {
                groupMessagePublisher.send(event)
            }

        default:
            print("Unknown WebSocket message type: \(wsMessage.type)")
        }
    }

    // MARK: - Message Transmission

    /// Send a typing indicator for a contact.
    func sendTypingIndicator(contactId: String) {
        let event = TypingEvent(contactId: contactId, isTyping: true)
        send(event: event, type: "typing")
    }

    /// Send a presence update (online/offline).
    func sendPresenceUpdate(isOnline: Bool) {
        let event = PresenceEvent(userId: UUID().uuidString, isOnline: isOnline)
        send(event: event, type: "presence")
    }

    /// Send a key exchange event (public key sharing).
    func sendKeyExchange(contactId: String, publicKeyBase64: String) {
        let event = KeyExchangeEvent(contactId: contactId, publicKey: publicKeyBase64)
        send(event: event, type: "keyExchange")
    }

    /// Generic send method for WebSocket events.
    private func send(event: Codable, type: String) {
        guard let webSocket = webSocket else { return }

        do {
            let data = try JSONEncoder().encode(event)
            var dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
            dict["type"] = type

            let jsonData = try JSONSerialization.data(withJSONObject: dict)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? ""

            webSocket.send(.string(jsonString)) { error in
                if let error = error {
                    print("WebSocket send error: \(error.localizedDescription)")
                }
            }
        } catch {
            print("Failed to encode WebSocket event: \(error)")
        }
    }

    // MARK: - Keep Alive

    /// Start ping/pong keep-alive every 30 seconds.
    private func startPingKeepAlive() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }

    /// Send a ping frame to keep the connection alive.
    private func sendPing() {
        guard let webSocket = webSocket else { return }

        webSocket.sendPing { [weak self] error in
            if let error = error {
                print("Ping error: \(error.localizedDescription)")
                self?.scheduleReconnect()
            }
        }
    }

    // MARK: - Reconnection

    /// Schedule automatic reconnection attempt.
    private func scheduleReconnect() {
        guard isConnected else { return }

        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
            if let token = self?.keychain.load(key: "jwt_token") {
                self?.connect(with: token)
            }
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        print("WebSocket connected")
        isConnected = true
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        print("WebSocket closed: \(closeCode)")
        isConnected = false
        scheduleReconnect()
    }
}

// MARK: - WebSocket Message Models

struct WSMessage: Decodable {
    let type: String
    let payload: [String: AnyCodable]

    func `as`<T: Decodable>(_ type: T.Type) -> T? {
        do {
            let data = try JSONEncoder().encode(payload)
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            return nil
        }
    }
}

// MARK: - Event Models

struct NewMessageEvent: Codable {
    let messageId: String
    let senderId: String
    let content: String
    let timestamp: Double
}

struct TypingEvent: Codable {
    let contactId: String
    let isTyping: Bool
}

struct PresenceEvent: Codable {
    let userId: String
    let isOnline: Bool
}

struct KeyExchangeEvent: Codable {
    let contactId: String
    let publicKey: String
}

struct GroupMessageEvent: Codable {
    let messageId: String
    let groupId: String
    let senderId: String
    let content: String
    let timestamp: Double
}

struct GroupUpdateEvent: Codable {
    let groupId: String
    let groupName: String
    let timestamp: Date
}

struct GroupMemberUpdateEvent: Codable {
    let groupId: String
    let memberId: String
    let username: String
    let displayName: String
    let isJoining: Bool
    let timestamp: Date
}

// MARK: - Helper: AnyCodable

/// Helper type for encoding/decoding heterogeneous JSON.
enum AnyCodable: Codable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([AnyCodable])
    case object([String: AnyCodable])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let int = try? container.decode(Int.self) {
            self = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self = .double(double)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if var array = try? container.decode([AnyCodable].self) {
            self = .array(array)
        } else if var object = try? container.decode([String: AnyCodable].self) {
            self = .object(object)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode AnyCodable")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .null:
            try container.encodeNil()
        case .bool(let value):
            try container.encode(value)
        case .int(let value):
            try container.encode(value)
        case .double(let value):
            try container.encode(value)
        case .string(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        }
    }
}
