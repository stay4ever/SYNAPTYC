import XCTest
@testable import nano_SYNAPSYS

final class ModelCodingTests: XCTestCase {

    // MARK: - AppUser Tests

    func test_appUser_decodesFromJSON() {
        let json = """
        {
            "id": "user_123",
            "username": "testuser",
            "displayName": "Test User",
            "email": "test@nanosynapsys.com",
            "publicKeyBase64": "ABC123==",
            "avatar": "https://api.nanosynapsys.com/avatar/user_123",
            "status": "online",
            "createdAt": "2026-03-20T10:00:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let user = try! decoder.decode(AppUser.self, from: json)

        XCTAssertEqual(user.id, "user_123")
        XCTAssertEqual(user.username, "testuser")
        XCTAssertEqual(user.displayName, "Test User")
        XCTAssertEqual(user.email, "test@nanosynapsys.com")
    }

    func test_appUser_encodesAndDecodes() {
        let user = AppUser(
            id: "user_456",
            username: "alice",
            displayName: "Alice Smith",
            email: "alice@nanosynapsys.com",
            publicKeyBase64: "XYZ789==",
            avatar: "https://api.nanosynapsys.com/avatar/user_456",
            status: "online",
            createdAt: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        let data = try! encoder.encode(user)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let decoded = try! decoder.decode(AppUser.self, from: data)

        XCTAssertEqual(decoded.id, user.id)
        XCTAssertEqual(decoded.username, user.username)
    }

    func test_appUser_initials_computed() {
        let user1 = AppUser(
            id: "user_1",
            username: "jdoe",
            displayName: "John Doe",
            email: "john@nanosynapsys.com",
            publicKeyBase64: "key1",
            avatar: nil,
            status: "online",
            createdAt: Date()
        )

        XCTAssertEqual(user1.initials, "JD")

        let user2 = AppUser(
            id: "user_2",
            username: "alice",
            displayName: "Alice",
            email: "alice@nanosynapsys.com",
            publicKeyBase64: "key2",
            avatar: nil,
            status: "online",
            createdAt: Date()
        )

        XCTAssertEqual(user2.initials, "A")
    }

    func test_appUser_displayNameOrUsername() {
        let user1 = AppUser(
            id: "user_1",
            username: "jdoe",
            displayName: "John Doe",
            email: "john@nanosynapsys.com",
            publicKeyBase64: "key1",
            avatar: nil,
            status: "online",
            createdAt: Date()
        )

        XCTAssertEqual(user1.displayNameOrUsername, "John Doe")

        let user2 = AppUser(
            id: "user_2",
            username: "alice",
            displayName: "",
            email: "alice@nanosynapsys.com",
            publicKeyBase64: "key2",
            avatar: nil,
            status: "online",
            createdAt: Date()
        )

        XCTAssertEqual(user2.displayNameOrUsername, "alice")
    }

    // MARK: - Message Tests

    func test_message_decodesFromJSON() {
        let json = """
        {
            "id": "msg_123",
            "conversationId": "conv_456",
            "senderId": "user_789",
            "content": "ENC:ABC123==",
            "timestamp": "2026-03-20T12:00:00Z",
            "status": "sent"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let message = try! decoder.decode(Message.self, from: json)

        XCTAssertEqual(message.id, "msg_123")
        XCTAssertEqual(message.content, "ENC:ABC123==")
        XCTAssertTrue(message.isEncrypted)
    }

    func test_message_isEncrypted_withPrefix() {
        let message = Message(
            id: "msg_1",
            conversationId: "conv_1",
            senderId: "user_1",
            content: "ENC:encryptedData",
            timestamp: Date(),
            status: "sent"
        )

        XCTAssertTrue(message.isEncrypted)
    }

    func test_message_isEncrypted_withoutPrefix() {
        let message = Message(
            id: "msg_2",
            conversationId: "conv_1",
            senderId: "user_1",
            content: "Plain text message",
            timestamp: Date(),
            status: "sent"
        )

        XCTAssertFalse(message.isEncrypted)
    }

    func test_message_isFromCurrentUser() {
        let currentUserId = "user_1"
        let message1 = Message(
            id: "msg_1",
            conversationId: "conv_1",
            senderId: currentUserId,
            content: "My message",
            timestamp: Date(),
            status: "sent"
        )

        XCTAssertTrue(message1.isFromCurrentUser(currentUserId))

        let message2 = Message(
            id: "msg_2",
            conversationId: "conv_1",
            senderId: "user_2",
            content: "Their message",
            timestamp: Date(),
            status: "sent"
        )

        XCTAssertFalse(message2.isFromCurrentUser(currentUserId))
    }

    // MARK: - Contact Tests

    func test_contact_decodesFromJSON() {
        let json = """
        {
            "id": "contact_123",
            "userId": "user_789",
            "displayName": "Bob Smith",
            "publicKeyBase64": "KEY123==",
            "status": "online",
            "lastSeen": "2026-03-20T11:30:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let contact = try! decoder.decode(Contact.self, from: json)

        XCTAssertEqual(contact.id, "contact_123")
        XCTAssertEqual(contact.userId, "user_789")
        XCTAssertEqual(contact.displayName, "Bob Smith")
    }

    func test_contact_displayNameOrUsername() {
        let contact1 = Contact(
            id: "contact_1",
            userId: "user_1",
            displayName: "Charlie Brown",
            publicKeyBase64: "key1",
            status: "online",
            lastSeen: Date()
        )

        XCTAssertEqual(contact1.displayNameOrUsername, "Charlie Brown")

        let contact2 = Contact(
            id: "contact_2",
            userId: "user_2",
            displayName: "",
            publicKeyBase64: "key2",
            status: "offline",
            lastSeen: Date()
        )

        XCTAssertEqual(contact2.displayNameOrUsername, "user_2")
    }

    func test_contact_initials() {
        let contact = Contact(
            id: "contact_1",
            userId: "user_1",
            displayName: "Diana Prince",
            publicKeyBase64: "key1",
            status: "online",
            lastSeen: Date()
        )

        XCTAssertEqual(contact.initials, "DP")
    }

    // MARK: - Group Tests

    func test_group_decodesFromJSON() {
        let json = """
        {
            "id": "group_123",
            "name": "Engineering Team",
            "description": "All things engineering",
            "ownerId": "user_1",
            "members": [],
            "createdAt": "2026-03-15T08:00:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let group = try! decoder.decode(Group.self, from: json)

        XCTAssertEqual(group.id, "group_123")
        XCTAssertEqual(group.name, "Engineering Team")
        XCTAssertEqual(group.ownerId, "user_1")
    }

    func test_groupMember_decodesFromJSON() {
        let json = """
        {
            "userId": "user_123",
            "displayName": "Eve Wilson",
            "role": "member"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()

        let member = try! decoder.decode(GroupMember.self, from: json)

        XCTAssertEqual(member.userId, "user_123")
        XCTAssertEqual(member.displayName, "Eve Wilson")
        XCTAssertEqual(member.role, "member")
    }

    func test_groupMessage_decodesFromJSON() {
        let json = """
        {
            "id": "gmsg_123",
            "groupId": "group_1",
            "senderId": "user_1",
            "content": "ENC:groupEncrypted",
            "timestamp": "2026-03-20T14:00:00Z",
            "status": "sent"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let groupMessage = try! decoder.decode(GroupMessage.self, from: json)

        XCTAssertEqual(groupMessage.id, "gmsg_123")
        XCTAssertEqual(groupMessage.groupId, "group_1")
        XCTAssertEqual(groupMessage.content, "ENC:groupEncrypted")
    }

    func test_groupMessage_isEncrypted() {
        let encryptedMessage = GroupMessage(
            id: "gmsg_1",
            groupId: "group_1",
            senderId: "user_1",
            content: "ENC:secretData",
            timestamp: Date(),
            status: "sent"
        )

        XCTAssertTrue(encryptedMessage.isEncrypted)

        let plainMessage = GroupMessage(
            id: "gmsg_2",
            groupId: "group_1",
            senderId: "user_1",
            content: "Plain message",
            timestamp: Date(),
            status: "sent"
        )

        XCTAssertFalse(plainMessage.isEncrypted)
    }

    // MARK: - BotMessage Tests

    func test_botMessage_uniqueIds() {
        let botMsg1 = BotMessage(
            id: "botmsg_1",
            conversationId: "conv_1",
            content: "Hello from Banner",
            timestamp: Date()
        )

        let botMsg2 = BotMessage(
            id: "botmsg_2",
            conversationId: "conv_1",
            content: "Another message",
            timestamp: Date()
        )

        XCTAssertNotEqual(botMsg1.id, botMsg2.id)
    }
}
