import XCTest
@testable import nano_SYNAPSYS

final class ModelCodingTests: XCTestCase {

    // MARK: - AppUser

    func test_appUser_decode() throws {
        let json = """
        {
            "id": 42,
            "username": "alice",
            "email": "alice@test.com",
            "display_name": "Alice",
            "is_approved": true,
            "online": true
        }
        """.data(using: .utf8)!
        let user = try JSONDecoder().decode(AppUser.self, from: json)
        XCTAssertEqual(user.id,          42)
        XCTAssertEqual(user.username,    "alice")
        XCTAssertEqual(user.displayName, "Alice")
        XCTAssertTrue(user.isApproved)
        XCTAssertTrue(user.isOnline ?? false)
    }

    func test_appUser_decode_minimalFields() throws {
        let json = """
        {"id": 1, "username": "bob", "email": "b@t.com", "is_approved": false}
        """.data(using: .utf8)!
        let user = try JSONDecoder().decode(AppUser.self, from: json)
        XCTAssertEqual(user.id, 1)
        XCTAssertNil(user.displayName)
        XCTAssertNil(user.isOnline)
        XCTAssertFalse(user.isApproved)
    }

    func test_appUser_initialsFromDisplayName() {
        let user = AppUser(id: 1, username: "jd", email: "jd@test.com",
                           displayName: "John Doe", isApproved: true)
        XCTAssertEqual(user.initials, "JD")
    }

    func test_appUser_initialsFromUsername_whenNoDisplayName() {
        let user = AppUser(id: 1, username: "alice", email: "a@test.com",
                           displayName: nil, isApproved: true)
        XCTAssertEqual(user.initials, "AL")
    }

    func test_appUser_namePreference() {
        let withDisplay = AppUser(id: 1, username: "usr", email: "e@t.com",
                                  displayName: "Display Name", isApproved: true)
        XCTAssertEqual(withDisplay.name, "Display Name")

        let noDisplay = AppUser(id: 2, username: "usr", email: "e@t.com",
                                displayName: nil, isApproved: true)
        XCTAssertEqual(noDisplay.name, "usr")
    }

    func test_appUser_emptyDisplayName_fallsBackToUsername() {
        let user = AppUser(id: 1, username: "alice", email: "a@t.com",
                           displayName: "", isApproved: true)
        XCTAssertEqual(user.name, "alice")
    }

    // MARK: - Message

    func test_message_decode() throws {
        let json = """
        {
            "id": 7,
            "from_user": 1,
            "to_user": 2,
            "content": "Hello!",
            "read": false,
            "created_at": "2025-01-15T10:30:00.000Z"
        }
        """.data(using: .utf8)!
        let msg = try JSONDecoder().decode(Message.self, from: json)
        XCTAssertEqual(msg.id,       7)
        XCTAssertEqual(msg.fromUser, 1)
        XCTAssertEqual(msg.content,  "Hello!")
        XCTAssertFalse(msg.read)
    }

    func test_message_encode() throws {
        let req   = SendMessageRequest(toUser: 5, content: "Hi there")
        let data  = try JSONEncoder().encode(req)
        let dict  = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(dict["to_user"] as? Int,    5)
        XCTAssertEqual(dict["content"] as? String, "Hi there")
    }

    func test_message_timestampParsing() throws {
        let json = """
        {"id": 1, "from_user": 1, "to_user": 2, "content": "x", "read": true, "created_at": "2025-06-15T12:00:00.000Z"}
        """.data(using: .utf8)!
        let msg = try JSONDecoder().decode(Message.self, from: json)
        XCTAssertFalse(msg.timeString.isEmpty)
    }

    // MARK: - Contact

    func test_contact_decode() throws {
        let json = """
        {
            "id": 3,
            "requester_id": 10,
            "receiver_id": 20,
            "status": "accepted",
            "created_at": "2025-01-01T00:00:00Z"
        }
        """.data(using: .utf8)!
        let contact = try JSONDecoder().decode(Contact.self, from: json)
        XCTAssertEqual(contact.status, .accepted)
        XCTAssertEqual(contact.requesterId, 10)
    }

    func test_contact_statusValues() throws {
        for status in ["pending", "accepted", "blocked"] {
            let json = """
            {"id": 1, "requester_id": 1, "receiver_id": 2, "status": "\(status)", "created_at": "2025-01-01T00:00:00Z"}
            """.data(using: .utf8)!
            let contact = try JSONDecoder().decode(Contact.self, from: json)
            XCTAssertEqual(contact.status.rawValue, status)
        }
    }

    // MARK: - Group

    func test_group_decode() throws {
        let json = """
        {
            "id": 1,
            "name": "Test Group",
            "description": "A test group",
            "created_by": 42,
            "created_at": "2025-01-01T00:00:00Z",
            "members": [
                {"id": 1, "user_id": 42, "username": "alice", "display_name": "Alice", "role": "admin"}
            ]
        }
        """.data(using: .utf8)!
        let group = try JSONDecoder().decode(Group.self, from: json)
        XCTAssertEqual(group.name, "Test Group")
        XCTAssertEqual(group.members.count, 1)
        XCTAssertEqual(group.members.first?.role, "admin")
    }

    func test_groupMessage_decode() throws {
        let json = """
        {
            "id": 1,
            "group_id": 5,
            "from_user": 42,
            "from_username": "alice",
            "from_display": "Alice",
            "content": "Hello group!",
            "created_at": "2025-01-15T10:30:00.000Z"
        }
        """.data(using: .utf8)!
        let msg = try JSONDecoder().decode(GroupMessage.self, from: json)
        XCTAssertEqual(msg.groupId, 5)
        XCTAssertEqual(msg.fromDisplay, "Alice")
    }

    // MARK: - DisappearTimer

    func test_disappearTimer_intervals() {
        XCTAssertNil(DisappearTimer.off.interval)
        XCTAssertEqual(DisappearTimer.h24.interval,  86400)
        XCTAssertEqual(DisappearTimer.d7.interval,   604800)
        XCTAssertEqual(DisappearTimer.d30.interval,  2592000)
    }

    func test_disappearTimer_allCases_count() {
        XCTAssertEqual(DisappearTimer.allCases.count, 4)
    }
}
