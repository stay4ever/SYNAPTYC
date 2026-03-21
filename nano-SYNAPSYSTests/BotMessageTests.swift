import XCTest
@testable import nano_SYNAPSYS

final class BotMessageTests: XCTestCase {

    func test_botMessage_init() {
        let conversationId = "conv_123"
        let content = "Hello, this is Banner speaking."
        let timestamp = Date()

        let botMessage = BotMessage(
            id: "botmsg_1",
            conversationId: conversationId,
            content: content,
            timestamp: timestamp
        )

        XCTAssertEqual(botMessage.conversationId, conversationId)
        XCTAssertEqual(botMessage.content, content)
        XCTAssertEqual(botMessage.timestamp, timestamp)
    }

    func test_botMessage_uniqueIds() {
        let botMsg1 = BotMessage(
            id: "botmsg_uuid_1",
            conversationId: "conv_1",
            content: "First message",
            timestamp: Date()
        )

        let botMsg2 = BotMessage(
            id: "botmsg_uuid_2",
            conversationId: "conv_1",
            content: "Second message",
            timestamp: Date()
        )

        XCTAssertNotEqual(botMsg1.id, botMsg2.id, "Each BotMessage should have a unique ID")
    }

    func test_botMessage_encodeDecode() {
        let original = BotMessage(
            id: "botmsg_encode_1",
            conversationId: "conv_1",
            content: "Test encode/decode",
            timestamp: Date()
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        let data = try! encoder.encode(original)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let decoded = try! decoder.decode(BotMessage.self, from: data)

        XCTAssertEqual(decoded.id, original.id)
        XCTAssertEqual(decoded.conversationId, original.conversationId)
        XCTAssertEqual(decoded.content, original.content)
    }

    func test_botMessage_timestamp() {
        let now = Date()
        let botMessage = BotMessage(
            id: "botmsg_ts_1",
            conversationId: "conv_1",
            content: "Timestamped message",
            timestamp: now
        )

        XCTAssertEqual(botMessage.timestamp, now)
    }

    func test_botMessage_isFromUser() {
        let botMessage = BotMessage(
            id: "botmsg_user_1",
            conversationId: "conv_1",
            content: "This is from Banner, not a user",
            timestamp: Date()
        )

        XCTAssertFalse(botMessage.isFromUser, "BotMessage should never be from a user")
    }

    func test_botMessage_equatable() {
        let botMsg1 = BotMessage(
            id: "botmsg_eq_1",
            conversationId: "conv_1",
            content: "Same content",
            timestamp: Date(timeIntervalSince1970: 1000)
        )

        let botMsg2 = BotMessage(
            id: "botmsg_eq_1",
            conversationId: "conv_1",
            content: "Same content",
            timestamp: Date(timeIntervalSince1970: 1000)
        )

        XCTAssertEqual(botMsg1, botMsg2, "BotMessages with same ID should be equal")
    }
}
