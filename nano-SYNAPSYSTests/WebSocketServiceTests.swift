import XCTest
@testable import nano_SYNAPSYS

final class WebSocketServiceTests: XCTestCase {

    // MARK: - WSMessage Decoding

    func test_wsMessage_decodeNewMessage() {
        let json = """
        {
            "type": "message",
            "payload": {
                "id": "msg_123",
                "conversationId": "conv_456",
                "senderId": "user_789",
                "content": "Hello",
                "timestamp": "2026-03-20T12:00:00Z",
                "status": "sent"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let wsMessage = try! decoder.decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "message")
        XCTAssertNotNil(wsMessage.payload)
    }

    func test_wsMessage_decodeTyping() {
        let json = """
        {
            "type": "typing",
            "payload": {
                "userId": "user_123",
                "conversationId": "conv_456"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()

        let wsMessage = try! decoder.decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "typing")
    }

    func test_wsMessage_decodePresence() {
        let json = """
        {
            "type": "presence",
            "payload": {
                "userId": "user_123",
                "status": "online"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()

        let wsMessage = try! decoder.decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "presence")
    }

    func test_wsMessage_decodeKeyExchange() {
        let json = """
        {
            "type": "keyexchange",
            "payload": {
                "userId": "user_123",
                "publicKeyBase64": "ABC123==",
                "timestamp": "2026-03-20T12:00:00Z"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let wsMessage = try! decoder.decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "keyexchange")
    }

    func test_wsMessage_decodeGroupMessage() {
        let json = """
        {
            "type": "groupmessage",
            "payload": {
                "id": "gmsg_123",
                "groupId": "group_1",
                "senderId": "user_1",
                "content": "Group message",
                "timestamp": "2026-03-20T12:00:00Z",
                "status": "sent"
            }
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let wsMessage = try! decoder.decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "groupmessage")
    }

    func test_wsMessage_invalidJSON() {
        let invalidJSON = "{ invalid json".data(using: .utf8)!

        let decoder = JSONDecoder()

        XCTAssertThrowsError(try decoder.decode(WSMessage.self, from: invalidJSON))
    }

    // MARK: - KeyExchangeEvent

    func test_keyExchangeEvent_decode() {
        let json = """
        {
            "userId": "user_abc",
            "publicKeyBase64": "XYZ789==",
            "timestamp": "2026-03-20T13:00:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let keyExchange = try! decoder.decode(KeyExchangeEvent.self, from: json)

        XCTAssertEqual(keyExchange.userId, "user_abc")
        XCTAssertEqual(keyExchange.publicKeyBase64, "XYZ789==")
    }

    func test_keyExchangeEvent_encode() {
        let keyExchange = KeyExchangeEvent(
            userId: "user_def",
            publicKeyBase64: "DEF456==",
            timestamp: Date(timeIntervalSince1970: 1000)
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        let data = try! encoder.encode(keyExchange)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let decoded = try! decoder.decode(KeyExchangeEvent.self, from: data)

        XCTAssertEqual(decoded.userId, keyExchange.userId)
        XCTAssertEqual(decoded.publicKeyBase64, keyExchange.publicKeyBase64)
    }
}
