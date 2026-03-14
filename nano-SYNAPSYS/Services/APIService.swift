import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case serverError(String)
    case unauthorized
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:          return "Invalid URL"
        case .noData:              return "No data received"
        case .serverError(let m):  return m
        case .unauthorized:        return "Session expired. Please log in again."
        case .decodingError(let e):return "Data error: \(e.localizedDescription)"
        }
    }
}

actor APIService {
    static let shared = APIService()
    private init() {}

    private func token() -> String? {
        KeychainService.load(Config.Keychain.tokenKey)
    }

    // MARK: - Generic request

    private func request<T: Decodable>(
        _ urlString: String,
        method: String = "GET",
        body: Encodable? = nil,
        responseType: T.Type
    ) async throws -> T {
        guard let url = URL(string: urlString) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let tok = token() {
            req.setValue("Bearer \(tok)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        if let http = resp as? HTTPURLResponse {
            if http.statusCode == 401 { throw APIError.unauthorized }
            if http.statusCode >= 400 {
                let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
                    ?? (try? JSONDecoder().decode([String: String].self, from: data))?["detail"]
                    ?? "Server error \(http.statusCode)"
                throw APIError.serverError(msg)
            }
        }
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Auth

    func register(username: String, email: String, password: String, displayName: String) async throws -> AuthResponse {
        struct Body: Encodable {
            let username, email, password: String
            let displayName: String
            enum CodingKeys: String, CodingKey {
                case username, email, password
                case displayName = "display_name"
            }
        }
        return try await request(Config.API.register, method: "POST",
                                 body: Body(username: username, email: email, password: password, displayName: displayName),
                                 responseType: AuthResponse.self)
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        struct Body: Encodable { let email, password: String }
        return try await request(Config.API.login, method: "POST",
                                 body: Body(email: email, password: password),
                                 responseType: AuthResponse.self)
    }

    func me() async throws -> AppUser {
        struct Resp: Decodable { let user: AppUser }
        return try await request(Config.API.me, responseType: Resp.self).user
    }

    func requestPasswordReset(email: String) async throws {
        struct Body: Encodable { let email: String }
        struct Resp: Decodable { let message: String }
        _ = try await request(Config.API.passwordReset, method: "POST",
                              body: Body(email: email), responseType: Resp.self)
    }

    // MARK: - Users

    func users() async throws -> [AppUser] {
        struct Resp: Decodable { let users: [AppUser] }
        return try await request(Config.API.users, responseType: Resp.self).users
    }

    // MARK: - Messages

    func messages(with userId: Int) async throws -> [Message] {
        let resp = try await request("\(Config.API.messages)/\(userId)",
                                     responseType: MessagesResponse.self)
        return resp.messages
    }

    func sendMessage(toUser: Int, content: String) async throws -> Message {
        struct Resp: Decodable { let message: Message }
        let body = SendMessageRequest(toUser: toUser, content: content)
        return try await request(Config.API.messages, method: "POST",
                                 body: body, responseType: Resp.self).message
    }

    // MARK: - Contacts

    func contacts() async throws -> [Contact] {
        struct Resp: Decodable { let contacts: [Contact] }
        return try await request(Config.API.contacts, responseType: Resp.self).contacts
    }

    func sendContactRequest(to userId: Int) async throws -> Contact {
        struct Resp: Decodable { let contact: Contact }
        let body = ContactRequest(receiverId: userId)
        return try await request(Config.API.contacts, method: "POST",
                                 body: body, responseType: Resp.self).contact
    }

    func updateContact(id: Int, status: String) async throws -> Contact {
        struct Resp: Decodable { let contact: Contact }
        let body = ContactPatch(status: status)
        return try await request("\(Config.API.contacts)/\(id)", method: "PATCH",
                                 body: body, responseType: Resp.self).contact
    }

    // MARK: - Bot

    func botChat(message: String) async throws -> String {
        let body = BotChatRequest(message: message)
        let resp = try await request(Config.API.botChat, method: "POST",
                                     body: body, responseType: BotChatResponse.self)
        return resp.reply
    }

    // MARK: - Groups

    func groups() async throws -> [Group] {
        return try await request(Config.API.groups, responseType: [Group].self)
    }

    func createGroup(name: String, description: String) async throws -> Group {
        struct Body: Encodable { let name, description: String }
        return try await request(Config.API.groups, method: "POST",
                                 body: Body(name: name, description: description),
                                 responseType: Group.self)
    }

    func groupMessages(groupId: Int) async throws -> [GroupMessage] {
        return try await request("\(Config.API.groups)/\(groupId)/messages",
                                 responseType: [GroupMessage].self)
    }

    func addGroupMember(groupId: Int, userId: Int) async throws -> Group {
        struct Body: Encodable {
            let userId: Int
            enum CodingKeys: String, CodingKey { case userId = "user_id" }
        }
        return try await request("\(Config.API.groups)/\(groupId)/members", method: "POST",
                                 body: Body(userId: userId), responseType: Group.self)
    }

    func removeGroupMember(groupId: Int, userId: Int) async throws {
        struct Body: Encodable {
            let userId: Int
            enum CodingKeys: String, CodingKey { case userId = "user_id" }
        }
        struct Resp: Decodable { let removed: Bool }
        _ = try await request("\(Config.API.groups)/\(groupId)/members", method: "DELETE",
                              body: Body(userId: userId), responseType: Resp.self)
    }

    func deleteGroup(groupId: Int) async throws {
        struct Resp: Decodable { let deleted: Bool }
        _ = try await request("\(Config.API.groups)/\(groupId)", method: "DELETE",
                              responseType: Resp.self)
    }

    // MARK: - Invites

    func createInvite() async throws -> InviteResponse {
        struct Body: Encodable {}
        return try await request(Config.API.invites, method: "POST",
                                 body: Body(), responseType: InviteResponse.self)
    }
}
