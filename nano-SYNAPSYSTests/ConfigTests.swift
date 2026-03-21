import XCTest
@testable import nano_SYNAPSYS

final class ConfigTests: XCTestCase {

    // MARK: - URL Validation

    func test_baseURL_isHTTPS() {
        let baseURL = Config.baseURL
        XCTAssertTrue(baseURL.absoluteString.hasPrefix("https://"), "Base URL must use HTTPS")
    }

    func test_wsURL_isWSS() {
        let wsURL = Config.wsURL
        XCTAssertTrue(wsURL.absoluteString.hasPrefix("wss://"), "WebSocket URL must use WSS")
    }

    func test_allEndpoints_constructValidURLs() {
        let endpoints = [
            Config.loginURL,
            Config.registerURL,
            Config.messagesURL,
            Config.contactsURL,
            Config.groupsURL,
            Config.botURL
        ]

        for endpoint in endpoints {
            XCTAssertTrue(endpoint.absoluteString.hasPrefix("https://"), "All endpoints must use HTTPS")
            XCTAssertFalse(endpoint.absoluteString.isEmpty, "Endpoint URL should not be empty")
        }
    }

    func test_loginEndpoint() {
        let loginURL = Config.loginURL
        XCTAssertTrue(loginURL.absoluteString.contains("/login"), "Login endpoint should contain '/login'")
    }

    func test_messagesEndpoint() {
        let messagesURL = Config.messagesURL
        XCTAssertTrue(messagesURL.absoluteString.contains("/messages"), "Messages endpoint should contain '/messages'")
    }

    func test_contactsEndpoint() {
        let contactsURL = Config.contactsURL
        XCTAssertTrue(contactsURL.absoluteString.contains("/contacts"), "Contacts endpoint should contain '/contacts'")
    }

    func test_groupsEndpoint() {
        let groupsURL = Config.groupsURL
        XCTAssertTrue(groupsURL.absoluteString.contains("/groups"), "Groups endpoint should contain '/groups'")
    }

    func test_botEndpoint() {
        let botURL = Config.botURL
        XCTAssertTrue(botURL.absoluteString.contains("/bot"), "Bot endpoint should contain '/bot'")
    }

    // MARK: - Version & Bundle

    func test_appVersion_isSemver() {
        let version = Config.appVersion
        let semverPattern = "^\\d+\\.\\d+\\.\\d+$"
        let regex = try! NSRegularExpression(pattern: semverPattern, options: [])
        let range = NSRange(version.startIndex..<version.endIndex, in: version)

        XCTAssertTrue(regex.firstMatch(in: version, options: [], range: range) != nil, "App version should be semantic versioning (e.g., 1.1.0)")
    }

    func test_bundleId() {
        let bundleId = Config.bundleIdentifier
        XCTAssertEqual(bundleId, "com.aievolve.nanosynapsys", "Bundle ID must match the app identifier")
    }
}
