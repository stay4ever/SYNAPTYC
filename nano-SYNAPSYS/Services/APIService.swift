import Foundation
import Combine

/// APIService: Singleton for all HTTP REST API calls to the nano-SYNAPSYS backend.
/// Manages JWT token authentication, request/response serialization, and error handling.
final class APIService {
    static let shared = APIService()

    private let baseURL = URL(string: "https://api.nanosynapsys.com")!
    private let keychain = KeychainService.shared
    private let session = URLSession(configuration: .default)

    private var jwtToken: String?

    private init() {
        // Attempt to load JWT from Keychain on init
        jwtToken = keychain.load(key: "jwt_token")
    }

    // MARK: - Authentication

    /// Log in with username and password. Stores JWT token in Keychain and memory.
    func login(username: String, password: String) async throws -> AuthResponse {
        let url = baseURL.appendingPathComponent("/auth/login")

        let body: [String: String] = ["username": username, "password": password]
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)

        try validateResponse(response)

        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        jwtToken = authResponse.token

        try keychain.save(key: "jwt_token", value: authResponse.token)

        return authResponse
    }

    /// Register a new account with username, password, and display name.
    func register(username: String, password: String, displayName: String) async throws -> AuthResponse {
        let url = baseURL.appendingPathComponent("/auth/register")

        let body: [String: String] = [
            "username": username,
            "password": password,
            "displayName": displayName
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)

        try validateResponse(response)

        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        jwtToken = authResponse.token

        try keychain.save(key: "jwt_token", value: authResponse.token)

        return authResponse
    }

    // MARK: - Messages

    /// Fetch all messages for a given contact (DM conversation).
    func getMessages(contactId: String) async throws -> [Message] {
        let url = baseURL.appendingPathComponent("/messages/\(contactId)")
        let data = try await performAuthenticatedRequest(url: url, method: "GET")
        return try JSONDecoder().decode([Message].self, from: data)
    }

    /// Send a message to a recipient.
    func sendMessage(recipientId: String, content: String) async throws -> Message {
        let url = baseURL.appendingPathComponent("/messages")

        let body: [String: String] = [
            "recipientId": recipientId,
            "content": content
        ]

        let data = try await performAuthenticatedRequest(
            url: url,
            method: "POST",
            body: try JSONEncoder().encode(body)
        )

        return try JSONDecoder().decode(Message.self, from: data)
    }

    // MARK: - Contacts

    /// Fetch the current user's contact list.
    func getContacts() async throws -> [Contact] {
        let url = baseURL.appendingPathComponent("/contacts")
        let data = try await performAuthenticatedRequest(url: url, method: "GET")
        return try JSONDecoder().decode([Contact].self, from: data)
    }

    /// Add a contact by username.
    func addContact(username: String) async throws -> Contact {
        let url = baseURL.appendingPathComponent("/contacts")

        let body: [String: String] = ["username": username]

        let data = try await performAuthenticatedRequest(
            url: url,
            method: "POST",
            body: try JSONEncoder().encode(body)
        )

        return try JSONDecoder().decode(Contact.self, from: data)
    }

    /// Remove a contact.
    func removeContact(contactId: String) async throws {
        let url = baseURL.appendingPathComponent("/contacts/\(contactId)")
        _ = try await performAuthenticatedRequest(url: url, method: "DELETE")
    }

    // MARK: - Groups

    /// Fetch all groups for the current user.
    func getGroups() async throws -> [Group] {
        let url = baseURL.appendingPathComponent("/groups")
        let data = try await performAuthenticatedRequest(url: url, method: "GET")
        return try JSONDecoder().decode([Group].self, from: data)
    }

    /// Create a new group.
    func createGroup(name: String, memberIds: [String]) async throws -> Group {
        let url = baseURL.appendingPathComponent("/groups")

        let body: [String: Any] = [
            "name": name,
            "memberIds": memberIds
        ]

        let data = try await performAuthenticatedRequest(
            url: url,
            method: "POST",
            body: try JSONEncoder().encode(body)
        )

        return try JSONDecoder().decode(Group.self, from: data)
    }

    /// Fetch all messages in a group.
    func getGroupMessages(groupId: String) async throws -> [GroupMessage] {
        let url = baseURL.appendingPathComponent("/groups/\(groupId)/messages")
        let data = try await performAuthenticatedRequest(url: url, method: "GET")
        return try JSONDecoder().decode([GroupMessage].self, from: data)
    }

    /// Send a message to a group.
    func sendGroupMessage(groupId: String, content: String) async throws -> GroupMessage {
        let url = baseURL.appendingPathComponent("/groups/\(groupId)/messages")

        let body: [String: String] = ["content": content]

        let data = try await performAuthenticatedRequest(
            url: url,
            method: "POST",
            body: try JSONEncoder().encode(body)
        )

        return try JSONDecoder().decode(GroupMessage.self, from: data)
    }

    // MARK: - Bot

    /// Send a message to the Claude AI bot ("Banner") and receive a response.
    func sendBotMessage(content: String) async throws -> BotMessage {
        let url = baseURL.appendingPathComponent("/bot/message")

        let body: [String: String] = ["content": content]

        let data = try await performAuthenticatedRequest(
            url: url,
            method: "POST",
            body: try JSONEncoder().encode(body)
        )

        return try JSONDecoder().decode(BotMessage.self, from: data)
    }

    // MARK: - Helper Methods

    /// Perform an authenticated HTTP request using the stored JWT token.
    private func performAuthenticatedRequest(
        url: URL,
        method: String,
        body: Data? = nil
    ) async throws -> Data {
        guard let token = jwtToken else {
            throw APIError.notAuthenticated
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body = body {
            request.httpBody = body
        }

        let (data, response) = try await session.data(for: request)

        try validateResponse(response)

        return data
    }

    /// Validate HTTP response status code.
    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 400:
            throw APIError.badRequest
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode)
        default:
            throw APIError.unexpectedStatusCode(httpResponse.statusCode)
        }
    }

    /// Clear stored authentication (logout).
    func logout() throws {
        jwtToken = nil
        try keychain.delete(key: "jwt_token")
    }
}

// MARK: - API Models

struct AuthResponse: Codable {
    let token: String
    let user: AppUser
}

// MARK: - APIError

enum APIError: LocalizedError {
    case notAuthenticated
    case invalidResponse
    case badRequest
    case unauthorized
    case forbidden
    case notFound
    case serverError(Int)
    case unexpectedStatusCode(Int)
    case decodingError(DecodingError)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "User is not authenticated. Please log in first."
        case .invalidResponse:
            return "Invalid response from server"
        case .badRequest:
            return "Bad request: Invalid parameters"
        case .unauthorized:
            return "Unauthorized: Invalid or expired token"
        case .forbidden:
            return "Forbidden: You do not have access to this resource"
        case .notFound:
            return "Resource not found"
        case .serverError(let code):
            return "Server error (\(code))"
        case .unexpectedStatusCode(let code):
            return "Unexpected status code: \(code)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        }
    }
}
