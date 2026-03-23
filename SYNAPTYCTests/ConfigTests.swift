import XCTest
@testable import SYNAPTYC

final class ConfigTests: XCTestCase {

    // MARK: - URL Validation

    func test_baseURL_isHTTPS() {
        XCTAssertTrue(Config.baseURL.hasPrefix("https://"), "Base URL must use HTTPS")
    }

    func test_wsURL_isWSS() {
        XCTAssertTrue(Config.wsURL.hasPrefix("wss://"), "WebSocket URL must use WSS")
    }

    func test_allAPIEndpoints_useHTTPS() {
        let endpoints = [
            Config.API.register,
            Config.API.login,
            Config.API.me,
            Config.API.users,
            Config.API.contacts,
            Config.API.messages,
            Config.API.botChat,
            Config.API.passwordReset,
            Config.API.groups,
            Config.API.invites,
            Config.API.profile,
            Config.API.pushToken
        ]
        for endpoint in endpoints {
            XCTAssertTrue(endpoint.hasPrefix("https://"),
                          "Endpoint \(endpoint) must use HTTPS")
            XCTAssertNotNil(URL(string: endpoint), "Endpoint \(endpoint) must be a valid URL")
        }
    }

    func test_loginEndpoint() {
        XCTAssertTrue(Config.API.login.contains("/login"), "Login endpoint should contain '/login'")
    }

    func test_messagesEndpoint() {
        XCTAssertTrue(Config.API.messages.contains("/messages"), "Messages endpoint should contain '/messages'")
    }

    func test_contactsEndpoint() {
        XCTAssertTrue(Config.API.contacts.contains("/contacts"), "Contacts endpoint should contain '/contacts'")
    }

    func test_groupsEndpoint() {
        XCTAssertTrue(Config.API.groups.contains("/groups"), "Groups endpoint should contain '/groups'")
    }

    func test_botEndpoint() {
        XCTAssertTrue(Config.API.botChat.contains("/bot"), "Bot endpoint should contain '/bot'")
    }

    // MARK: - Version & App Info

    func test_appVersion_isSemver() {
        let version = Config.App.version
        let semverPattern = "^\\d+\\.\\d+\\.\\d+$"
        let regex = try! NSRegularExpression(pattern: semverPattern, options: [])
        let range = NSRange(version.startIndex..<version.endIndex, in: version)

        XCTAssertTrue(
            regex.firstMatch(in: version, options: [], range: range) != nil,
            "App version should follow semantic versioning (e.g., 1.5.0)"
        )
    }

    func test_appName() {
        XCTAssertEqual(Config.App.name, "SYNAPTYC", "App name must be SYNAPTYC")
    }
}
