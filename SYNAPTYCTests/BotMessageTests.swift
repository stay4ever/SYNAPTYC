import XCTest
@testable import SYNAPTYC

final class BotMessageTests: XCTestCase {

    func test_botMessage_init() {
        let content = "Hello, this is Banner speaking."
        let botMessage = BotMessage(role: .assistant, content: content)

        XCTAssertEqual(botMessage.content, content)
        XCTAssertEqual(botMessage.role, .assistant)
        XCTAssertNotNil(botMessage.timestamp)
    }

    func test_botMessage_uniqueIds() {
        let botMsg1 = BotMessage(role: .assistant, content: "First message")
        let botMsg2 = BotMessage(role: .assistant, content: "Second message")

        XCTAssertNotEqual(botMsg1.id, botMsg2.id, "Each BotMessage should have a unique ID")
    }

    func test_botMessage_timestamp() {
        let before = Date()
        let botMessage = BotMessage(role: .user, content: "Timestamped message")
        let after = Date()

        XCTAssertGreaterThanOrEqual(botMessage.timestamp, before)
        XCTAssertLessThanOrEqual(botMessage.timestamp, after)
    }

    func test_botMessage_role_assistant() {
        let botMessage = BotMessage(role: .assistant, content: "This is from Banner")

        XCTAssertEqual(botMessage.role, .assistant)
    }

    func test_botMessage_role_user() {
        let userMessage = BotMessage(role: .user, content: "This is from the user")

        XCTAssertEqual(userMessage.role, .user)
    }

    func test_botMessage_equatable() {
        let msg = BotMessage(role: .assistant, content: "Same content")

        // A message should be equal to itself
        XCTAssertEqual(msg, msg, "A BotMessage should be equal to itself")

        // Two independently created messages should not be equal (different UUIDs)
        let msg2 = BotMessage(role: .assistant, content: "Same content")
        XCTAssertNotEqual(msg, msg2, "BotMessages with different UUIDs should not be equal")
    }
}
