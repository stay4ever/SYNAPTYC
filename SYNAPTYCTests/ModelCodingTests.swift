import XCTest
@testable import SYNAPTYC

final class ModelCodingTests: XCTestCase {

    // MARK: - AppUser Tests

    func test_appUser_decodesFromJSON() {
        let json = """
        {
            "id": 123,
            "username": "testuser",
            "email": "test@example.com",
            "display_name": "Test User",
            "is_approved": true,
            "online": true
        }
        """.data(using: .utf8)!

        let user = try! JSONDecoder().decode(AppUser.self, from: json)

        XCTAssertEqual(user.id, 123)
        XCTAssertEqual(user.username, "testuser")
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertEqual(user.displayName, "Test User")
        XCTAssertEqual(user.isOnline, true)
    }

    func test_appUser_encodesAndDecodes() {
        let user = AppUser(
            id: 456,
            username: "alice",
            email: "alice@example.com",
            displayName: "Alice Smith",
            isApproved: true,
            isOnline: true,
            lastSeen: nil
        )

        let data = try! JSONEncoder().encode(user)
        let decoded = try! JSONDecoder().decode(AppUser.self, from: data)

        XCTAssertEqual(decoded.id, user.id)
        XCTAssertEqual(decoded.username, user.username)
        XCTAssertEqual(decoded.email, user.email)
    }

    func test_appUser_initials_computed() {
        let user1 = AppUser(
            id: 1,
            username: "jdoe",
            email: "j@example.com",
            displayName: "John Doe",
            isApproved: true,
            isOnline: true,
            lastSeen: nil
        )
        XCTAssertEqual(user1.initials, "JD")

        let user2 = AppUser(
            id: 2,
            username: "alice",
            email: "alice@example.com",
            displayName: nil,
            isApproved: true,
            isOnline: true,
            lastSeen: nil
        )
        // username "alice" → no displayName → name = "alice" → one word → prefix(2).uppercased() = "AL"
        XCTAssertEqual(user2.initials, "AL")
    }

    func test_appUser_name_computed() {
        let user1 = AppUser(
            id: 1,
            username: "jdoe",
            email: "j@example.com",
            displayName: "John Doe",
            isApproved: true,
            isOnline: true,
            lastSeen: nil
        )
        XCTAssertEqual(user1.name, "John Doe")

        let user2 = AppUser(
            id: 2,
            username: "alice",
            email: "alice@example.com",
            displayName: nil,
            isApproved: true,
            isOnline: false,
            lastSeen: nil
        )
        XCTAssertEqual(user2.name, "alice")
    }

    // MARK: - Message Tests

    func test_message_decodesFromJSON() {
        let json = """
        {
            "id": 123,
            "from_user": 789,
            "to_user": 456,
            "content": "Hello",
            "read": false,
            "created_at": "2026-03-20T12:00:00Z"
        }
        """.data(using: .utf8)!

        let message = try! JSONDecoder().decode(Message.self, from: json)

        XCTAssertEqual(message.id, 123)
        XCTAssertEqual(message.fromUser, 789)
        XCTAssertEqual(message.toUser, 456)
        XCTAssertEqual(message.content, "Hello")
        XCTAssertFalse(message.read)
    }

    func test_message_isEncrypted_flag() {
        var message = Message(
            id: 1,
            fromUser: 1,
            toUser: 2,
            content: "ENC:encryptedData",
            read: false,
            createdAt: "2026-03-20T12:00:00Z"
        )
        // isEncrypted is a stored Bool, default false; set it explicitly
        XCTAssertFalse(message.isEncrypted)
        message.isEncrypted = true
        XCTAssertTrue(message.isEncrypted)
    }

    func test_message_content() {
        let message = Message(
            id: 2,
            fromUser: 1,
            toUser: 2,
            content: "Plain text message",
            read: false,
            createdAt: "2026-03-20T12:00:00Z"
        )
        XCTAssertEqual(message.content, "Plain text message")
    }

    func test_message_fromUser() {
        let message1 = Message(
            id: 1,
            fromUser: 1,
            toUser: 2,
            content: "My message",
            read: true,
            createdAt: "2026-03-20T12:00:00Z"
        )
        XCTAssertEqual(message1.fromUser, 1)

        let message2 = Message(
            id: 2,
            fromUser: 2,
            toUser: 1,
            content: "Their message",
            read: false,
            createdAt: "2026-03-20T12:00:00Z"
        )
        XCTAssertEqual(message2.fromUser, 2)
    }

    // MARK: - Contact Tests

    func test_contact_decodesFromJSON() {
        let json = """
        {
            "id": 123,
            "requester_id": 1,
            "receiver_id": 789,
            "status": "accepted",
            "created_at": "2026-03-20T10:00:00Z"
        }
        """.data(using: .utf8)!

        let contact = try! JSONDecoder().decode(Contact.self, from: json)

        XCTAssertEqual(contact.id, 123)
        XCTAssertEqual(contact.requesterId, 1)
        XCTAssertEqual(contact.receiverId, 789)
        XCTAssertEqual(contact.status, .accepted)
    }

    func test_contact_status_pending() {
        let contact = Contact(
            id: 1,
            requesterId: 1,
            receiverId: 2,
            status: .pending,
            createdAt: "2026-03-20T10:00:00Z",
            otherUser: nil
        )
        XCTAssertEqual(contact.status, .pending)
    }

    func test_contact_otherUser() {
        let user = AppUser(
            id: 99,
            username: "charlie",
            email: "charlie@example.com",
            displayName: "Charlie Brown",
            isApproved: true,
            isOnline: true,
            lastSeen: nil
        )
        let contact = Contact(
            id: 1,
            requesterId: 1,
            receiverId: 99,
            status: .accepted,
            createdAt: "2026-03-20T10:00:00Z",
            otherUser: user
        )
        XCTAssertEqual(contact.otherUser?.username, "charlie")
        XCTAssertEqual(contact.otherUser?.displayName, "Charlie Brown")
    }

    // MARK: - Group Tests

    func test_group_decodesFromJSON() {
        let json = """
        {
            "id": 123,
            "name": "Engineering Team",
            "description": "Dev team",
            "created_by": 1,
            "created_at": "2026-03-15T08:00:00Z",
            "members": []
        }
        """.data(using: .utf8)!

        let group = try! JSONDecoder().decode(Group.self, from: json)

        XCTAssertEqual(group.id, 123)
        XCTAssertEqual(group.name, "Engineering Team")
        XCTAssertEqual(group.createdBy, 1)
    }

    func test_groupMember_decodesFromJSON() {
        let json = """
        {
            "id": 1,
            "user_id": 5,
            "username": "eve",
            "display_name": "Eve Wilson",
            "role": "member"
        }
        """.data(using: .utf8)!

        let member = try! JSONDecoder().decode(GroupMember.self, from: json)

        XCTAssertEqual(member.id, 1)
        XCTAssertEqual(member.userId, 5)
        XCTAssertEqual(member.username, "eve")
        XCTAssertEqual(member.displayName, "Eve Wilson")
        XCTAssertEqual(member.role, "member")
    }

    func test_groupMessage_decodesFromJSON() {
        let json = """
        {
            "id": 123,
            "group_id": 1,
            "from_user": 1,
            "from_username": "alice",
            "from_display": "Alice",
            "content": "Hello group!",
            "created_at": "2026-03-20T14:00:00Z"
        }
        """.data(using: .utf8)!

        let groupMessage = try! JSONDecoder().decode(GroupMessage.self, from: json)

        XCTAssertEqual(groupMessage.id, 123)
        XCTAssertEqual(groupMessage.groupId, 1)
        XCTAssertEqual(groupMessage.content, "Hello group!")
        XCTAssertEqual(groupMessage.fromUsername, "alice")
    }

    func test_groupMessage_fromUser() {
        let msg = GroupMessage(
            id: 1,
            groupId: 1,
            fromUser: 5,
            fromUsername: "alice",
            fromDisplay: "Alice",
            content: "Test",
            createdAt: "2026-03-20T14:00:00Z"
        )
        XCTAssertEqual(msg.fromUser, 5)
        XCTAssertEqual(msg.fromUsername, "alice")
    }

    // MARK: - BotMessage Tests

    func test_botMessage_uniqueIds() {
        let botMsg1 = BotMessage(role: .assistant, content: "Hello from Banner")
        let botMsg2 = BotMessage(role: .assistant, content: "Another message")

        XCTAssertNotEqual(botMsg1.id, botMsg2.id)
    }
}
