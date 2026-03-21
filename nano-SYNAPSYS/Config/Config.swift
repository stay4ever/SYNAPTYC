import Foundation

/// Global configuration for nano-SYNAPSYS app
struct Config {
    // MARK: - App Info
    static let bundleID = "com.aievolve.nanosynapsys"
    static let appVersion = "1.1.0"
    static let buildNumber = "13"

    // MARK: - API Configuration
    static let apiBaseURL = "https://api.nanosynapsys.com"
    static let wsURL = "wss://api.nanosynapsys.com/ws"

    // MARK: - Endpoints
    enum Endpoint {
        case login
        case register
        case getUser
        case updateUser
        case getMessages(conversationID: String)
        case sendMessage
        case getContacts
        case addContact
        case removeContact
        case getGroups
        case createGroup
        case updateGroup
        case deleteGroup
        case botMessage
        case botHistory

        var path: String {
            switch self {
            case .login:
                return "/auth/login"
            case .register:
                return "/auth/register"
            case .getUser:
                return "/user"
            case .updateUser:
                return "/user"
            case .getMessages(let conversationID):
                return "/messages/\(conversationID)"
            case .sendMessage:
                return "/messages"
            case .getContacts:
                return "/contacts"
            case .addContact:
                return "/contacts"
            case .removeContact:
                return "/contacts"
            case .getGroups:
                return "/groups"
            case .createGroup:
                return "/groups"
            case .updateGroup:
                return "/groups"
            case .deleteGroup:
                return "/groups"
            case .botMessage:
                return "/bot/message"
            case .botHistory:
                return "/bot/history"
            }
        }

        var httpMethod: String {
            switch self {
            case .login, .register, .sendMessage, .addContact, .createGroup, .botMessage:
                return "POST"
            case .updateUser, .updateGroup:
                return "PUT"
            case .removeContact, .deleteGroup:
                return "DELETE"
            case .getUser, .getMessages, .getContacts, .getGroups, .botHistory:
                return "GET"
            }
        }
    }

    // MARK: - URL Construction
    /// Constructs full API endpoint URL
    static func apiURL(_ endpoint: Endpoint) -> URL? {
        guard let baseURL = URL(string: apiBaseURL) else { return nil }
        return baseURL.appendingPathComponent(endpoint.path)
    }

    /// Constructs full API endpoint URL with query parameters
    static func apiURL(_ endpoint: Endpoint, queryParams: [String: String]) -> URL? {
        guard var url = apiURL(endpoint) else { return nil }
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        components?.queryItems = queryParams.map { URLQueryItem(name: $0.key, value: $0.value) }
        return components?.url
    }

    /// Validates that a URL uses HTTPS or WSS
    static func isSecureURL(_ urlString: String) -> Bool {
        return urlString.hasPrefix("https://") || urlString.hasPrefix("wss://")
    }

    // MARK: - Validation
    /// Validates app configuration for security and correctness
    static func validateConfiguration() throws {
        guard isSecureURL(apiBaseURL) else {
            throw ConfigError.insecureURL("API base URL must use HTTPS")
        }
        guard isSecureURL(wsURL) else {
            throw ConfigError.insecureURL("WebSocket URL must use WSS")
        }
        guard isValidSemver(appVersion) else {
            throw ConfigError.invalidVersion("App version must follow semantic versioning")
        }
    }

    /// Validates semantic versioning format (e.g., "1.1.0")
    private static func isValidSemver(_ version: String) -> Bool {
        let pattern = "^\\d+\\.\\d+\\.\\d+$"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return false }
        let range = NSRange(version.startIndex..<version.endIndex, in: version)
        return regex.firstMatch(in: version, range: range) != nil
    }
}

// MARK: - Config Errors
enum ConfigError: LocalizedError {
    case insecureURL(String)
    case invalidVersion(String)

    var errorDescription: String? {
        switch self {
        case .insecureURL(let message):
            return "Configuration Error: \(message)"
        case .invalidVersion(let message):
            return "Configuration Error: \(message)"
        }
    }
}
