import XCTest
@testable import nano_SYNAPSYS

// swiftlint:disable force_cast force_unwrapping
final class BotMessageTests: XCTestCase {

    func test_botMessage_initAssignsFields() {
        let msg = BotMessage(role: .assistant, content: "Hello from Banner")
        XCTAssertEqual(msg.role,    .assistant)
        XCTAssertEqual(msg.content, "Hello from Banner")
        XCTAssertNotNil(msg.id)
    }

    func test_botMessage_uniqueIDs() {
        let a = BotMessage(role: .user,      content: "A")
        let b = BotMessage(role: .assistant, content: "B")
        XCTAssertNotEqual(a.id, b.id)
    }

    func test_botChatRequest_encode() throws {
        let req = BotChatRequest(message: "What is nano-SYNAPSYS?")
        let data = try JSONEncoder().encode(req)
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(dict["message"] as? String, "What is nano-SYNAPSYS?")
    }

    func test_botChatResponse_decode() throws {
        let json = Data("""
        {"reply": "Hello! I'm Banner AI."}
        """.utf8)
        let resp = try JSONDecoder().decode(BotChatResponse.self, from: json)
        XCTAssertEqual(resp.reply, "Hello! I'm Banner AI.")
    }

    func test_botRole_rawValues() {
        XCTAssertEqual(BotRole.user.rawValue, "user")
        XCTAssertEqual(BotRole.assistant.rawValue, "assistant")
    }

    func test_botMessage_timestampIsRecent() {
        let msg = BotMessage(role: .user, content: "test")
        XCTAssertTrue(msg.timestamp.timeIntervalSinceNow > -1, "Timestamp should be within the last second")
    }
}
