import XCTest
@testable import nano_SYNAPSYS

// swiftlint:disable force_cast force_unwrapping
final class ConfigTests: XCTestCase {

    func test_baseURL_isHTTPS() {
        XCTAssertTrue(Config.baseURL.hasPrefix("https://"), "Base URL must use HTTPS")
    }

    func test_wsURL_isWSS() {
        XCTAssertTrue(Config.wsURL.hasPrefix("wss://"), "WebSocket URL must use WSS")
    }

    func test_apiEndpoints_containBaseURL() {
        let endpoints = [
            Config.API.register,
            Config.API.login,
            Config.API.me,
            Config.API.users,
            Config.API.contacts,
            Config.API.messages,
            Config.API.botChat
        ]
        for ep in endpoints {
            XCTAssertTrue(ep.hasPrefix(Config.baseURL), "Endpoint \(ep) must start with baseURL")
        }
    }

    func test_apiEndpoints_areValidURLs() {
        let endpoints = [
            Config.API.register, Config.API.login, Config.API.me,
            Config.API.users, Config.API.contacts, Config.API.messages, Config.API.botChat
        ]
        for ep in endpoints {
            XCTAssertNotNil(URL(string: ep), "\(ep) must be a valid URL")
        }
    }

    func test_keychainKeys_areNonEmpty() {
        XCTAssertFalse(Config.Keychain.tokenKey.isEmpty)
        XCTAssertFalse(Config.Keychain.userKey.isEmpty)
        XCTAssertFalse(Config.Keychain.privateKeyTag.isEmpty)
    }

    func test_encryptionLabel_containsAlgorithms() {
        let label = Config.App.encryptionLabel
        XCTAssertTrue(label.contains("AES-256-GCM"), "Label must mention AES-256-GCM")
        XCTAssertTrue(label.contains("ECDH-P384"),   "Label must mention ECDH-P384")
        XCTAssertTrue(label.contains("E2E"),          "Label must mention E2E")
    }

    func test_groupsEndpoint_containsBaseURL() {
        XCTAssertTrue(Config.API.groups.hasPrefix(Config.baseURL))
    }

    func test_invitesEndpoint_containsBaseURL() {
        XCTAssertTrue(Config.API.invites.hasPrefix(Config.baseURL))
    }

    func test_passwordResetEndpoint_containsBaseURL() {
        XCTAssertTrue(Config.API.passwordReset.hasPrefix(Config.baseURL))
    }

    func test_appName_isSet() {
        XCTAssertEqual(Config.App.name, "nano-SYNAPSYS")
    }

    func test_appVersion_isValid() {
        let parts = Config.App.version.split(separator: ".")
        XCTAssertEqual(parts.count, 3, "Version must be semver format (x.y.z)")
    }
}
