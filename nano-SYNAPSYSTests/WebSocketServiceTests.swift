import XCTest
@testable import nano_SYNAPSYS

// swiftlint:disable force_cast force_unwrapping
final class WebSocketServiceTests: XCTestCase {

    func test_wsMessage_decodeChatMessage() throws {
        let json = Data("""
        {"type": "chat_message", "id": 1, "from": 10, "to": 20, "content": "hello", "read": false, "created_at": "2025-01-01T00:00:00Z"}
        """.utf8)
        let msg = try JSONDecoder().decode(WSMessage.self, from: json)
        XCTAssertEqual(msg.type, "chat_message")
        XCTAssertEqual(msg.from, 10)
        XCTAssertEqual(msg.to, 20)
        XCTAssertEqual(msg.content, "hello")
    }

    func test_wsMessage_decodeKeyExchange() throws {
        let json = Data("""
        {"type": "key_exchange", "from": 5, "public_key": "dGVzdA=="}
        """.utf8)
        let msg = try JSONDecoder().decode(WSMessage.self, from: json)
        XCTAssertEqual(msg.type, "key_exchange")
        XCTAssertEqual(msg.publicKey, "dGVzdA==")
    }

    func test_wsMessage_decodeGroupMessage() throws {
        let json = Data("""
        {"type": "group_message", "id": 1, "group_id": 3, "from": 10, "from_username": "alice", "from_display": "Alice", "content": "hi group"}
        """.utf8)
        let msg = try JSONDecoder().decode(WSMessage.self, from: json)
        XCTAssertEqual(msg.type, "group_message")
        XCTAssertEqual(msg.groupId, 3)
        XCTAssertEqual(msg.fromUsername, "alice")
    }

    func test_wsMessage_decodeUserList() throws {
        let json = Data("""
        {"type": "user_list", "users": [{"id": 1, "username": "alice", "display_name": "Alice", "online": true}]}
        """.utf8)
        let msg = try JSONDecoder().decode(WSMessage.self, from: json)
        XCTAssertEqual(msg.type, "user_list")
        XCTAssertEqual(msg.users?.count, 1)
        XCTAssertEqual(msg.users?.first?.username, "alice")
        XCTAssertTrue(msg.users?.first?.online ?? false)
    }

    func test_wsMessage_decodeMarkRead() throws {
        let json = Data("""
        {"type": "mark_read", "message_id": 42, "from": 1, "to": 2}
        """.utf8)
        let msg = try JSONDecoder().decode(WSMessage.self, from: json)
        XCTAssertEqual(msg.type, "mark_read")
        XCTAssertEqual(msg.messageId, 42)
    }

    func test_wsMessage_decodeTyping() throws {
        let json = Data("""
        {"type": "typing", "from": 7}
        """.utf8)
        let msg = try JSONDecoder().decode(WSMessage.self, from: json)
        XCTAssertEqual(msg.type, "typing")
        XCTAssertEqual(msg.from, 7)
    }

    func test_wsUser_decode() throws {
        let json = Data("""
        {"id": 42, "username": "bob", "display_name": "Bob Smith", "online": false}
        """.utf8)
        let user = try JSONDecoder().decode(WSUser.self, from: json)
        XCTAssertEqual(user.id, 42)
        XCTAssertEqual(user.displayName, "Bob Smith")
        XCTAssertFalse(user.online)
    }

    func test_keyExchangeEvent_storesFields() {
        let data = Data([0x01, 0x02, 0x03])
        let event = KeyExchangeEvent(from: 42, publicKeyData: data)
        XCTAssertEqual(event.from, 42)
        XCTAssertEqual(event.publicKeyData, data)
    }
}
