import XCTest
@testable import SYNAPTYC

final class WebSocketServiceTests: XCTestCase {

    // MARK: - WSMessage Decoding

    func test_wsMessage_decodeNewMessage() {
        let json = """
        {
            "type": "chat_message",
            "id": 123,
            "from": 789,
            "to": 456,
            "content": "Hello",
            "created_at": "2026-03-20T12:00:00Z"
        }
        """.data(using: .utf8)!

        let wsMessage = try! JSONDecoder().decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "chat_message")
        XCTAssertEqual(wsMessage.id, 123)
        XCTAssertEqual(wsMessage.from, 789)
        XCTAssertEqual(wsMessage.content, "Hello")
    }

    func test_wsMessage_decodeTyping() {
        let json = """
        {
            "type": "typing",
            "from": 123
        }
        """.data(using: .utf8)!

        let wsMessage = try! JSONDecoder().decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "typing")
        XCTAssertEqual(wsMessage.from, 123)
    }

    func test_wsMessage_decodeUserList() {
        let json = """
        {
            "type": "user_list",
            "users": []
        }
        """.data(using: .utf8)!

        let wsMessage = try! JSONDecoder().decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "user_list")
        XCTAssertNotNil(wsMessage.users)
    }

    func test_wsMessage_decodeKeyExchange() {
        let json = """
        {
            "type": "key_exchange",
            "from": 123,
            "public_key": "ABC123=="
        }
        """.data(using: .utf8)!

        let wsMessage = try! JSONDecoder().decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "key_exchange")
        XCTAssertEqual(wsMessage.publicKey, "ABC123==")
        XCTAssertEqual(wsMessage.from, 123)
    }

    func test_wsMessage_decodeGroupMessage() {
        let json = """
        {
            "type": "group_message",
            "id": 123,
            "group_id": 1,
            "from": 1,
            "content": "Group message",
            "from_username": "alice",
            "from_display": "Alice"
        }
        """.data(using: .utf8)!

        let wsMessage = try! JSONDecoder().decode(WSMessage.self, from: json)

        XCTAssertEqual(wsMessage.type, "group_message")
        XCTAssertEqual(wsMessage.groupId, 1)
        XCTAssertEqual(wsMessage.content, "Group message")
        XCTAssertEqual(wsMessage.fromUsername, "alice")
    }

    func test_wsMessage_invalidJSON() {
        let invalidJSON = "{ invalid json".data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(WSMessage.self, from: invalidJSON))
    }

    // MARK: - KeyExchangeEvent

    func test_keyExchangeEvent_properties() {
        let publicKeyData = Data("fakePublicKey".utf8)
        let event = KeyExchangeEvent(from: 42, publicKeyData: publicKeyData)

        XCTAssertEqual(event.from, 42)
        XCTAssertEqual(event.publicKeyData, publicKeyData)
    }

    func test_keyExchangeEvent_distinctInstances() {
        let data1 = Data("key1".utf8)
        let data2 = Data("key2".utf8)
        let event1 = KeyExchangeEvent(from: 1, publicKeyData: data1)
        let event2 = KeyExchangeEvent(from: 2, publicKeyData: data2)

        XCTAssertNotEqual(event1.from, event2.from)
        XCTAssertNotEqual(event1.publicKeyData, event2.publicKeyData)
    }
}
