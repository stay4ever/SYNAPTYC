import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case serverError(String)
    case unauthorized
    case decodingError(Error)
    case timeout

    var errorDescription: String? {
        switch self {
        case .invalidURL:          return "Invalid URL"
        case .noData:              return "No data received"
        case .serverError(let m):  return m
        case .unauthorized:        return "Session expired. Please log in again."
        case .decodingError(let e): return "Data error: \(e.localizedDescription)"
        case .timeout:             return "Request timed out. Check your connection."
        }
    }
}

actor APIService {
    static let shared = APIService()
    private init() {}

    // Shared URLSession with a 20-second timeout
    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest  = 20
        cfg.timeoutIntervalForResource = 60
        return URLSession(configuration: cfg)
    }()

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

        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await session.data(for: req)
        } catch let err as URLError where err.code == .timedOut {
            throw APIError.timeout
        }

        if let http = resp as? HTTPURLResponse {
            if http.statusCode == 401 { throw APIError.unauthorized }
            if http.statusCode >= 400 {
                // Extract error message from JSON body (try "error" then "detail" keys)
                let msg: String
                if let json = try? JSONDecoder().decode([String: String].self, from: data) {
                    msg = json["error"] ?? json["detail"] ?? "Server error \(http.statusCode)"
                } else {
                    msg = "Server error \(http.statusCode)"
                }
                throw APIError.serverError(msg)
            }
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Auth

    func register(username: String, email: String, password: String,
                  displayName: String, phoneNumberHash: String? = nil) async throws -> AuthResponse {
        struct Body: Encodable {
            let username, email, password: String
            let displayName: String
            let phoneNumberHash: String?
            enum CodingKeys: String, CodingKey {
                case username, email, password
                case displayName     = "display_name"
                case phoneNumberHash = "phone_number_hash"
            }
        }
        return try await request(Config.API.register, method: "POST",
                                 body: Body(username: username, email: email, password: password,
                                            displayName: displayName, phoneNumberHash: phoneNumberHash),
                                 responseType: AuthResponse.self)
    }

    func syncContacts(hashes: [String]) async throws -> [AppUser] {
        struct Body: Encodable { let hashes: [String] }
        struct Resp: Decodable { let matched: [AppUser] }
        let resp = try await request("\(Config.API.contacts)/sync", method: "POST",
                                     body: Body(hashes: hashes), responseType: Resp.self)
        return resp.matched
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

    func deleteContact(id: Int) async throws {
        struct Resp: Decodable { let deleted: Bool }
        _ = try await request("\(Config.API.contacts)/\(id)", method: "DELETE",
                              responseType: Resp.self)
    }

    // MARK: - Profile

    func updateProfile(displayName: String? = nil) async throws -> AppUser {
        struct Body: Encodable {
            let displayName: String?
            enum CodingKeys: String, CodingKey { case displayName = "display_name" }
        }
        struct Resp: Decodable { let user: AppUser }
        return try await request(Config.API.profile, method: "PUT",
                                 body: Body(displayName: displayName),
                                 responseType: Resp.self).user
    }

    // MARK: - Push Token

    func registerPushToken(_ token: String) async throws {
        struct Body: Encodable { let token, platform: String }
        struct Resp: Decodable { let registered: Bool }
        _ = try await request(Config.API.pushToken, method: "POST",
                              body: Body(token: token, platform: "ios"),
                              responseType: Resp.self)
    }

    // MARK: - Bot

    func botChat(message: String) async throws -> String {
        let body = BotChatRequest(message: message)
        let resp = try await request(Config.API.botChat, method: "POST",
                                     body: body, responseType: BotChatResponse.self)
        return resp.reply
    }

    func bannerChat(
        message: String,
        conversation: [BannerConvMessage],
        deviceContext: BannerDeviceContext,
        toolResults: [BannerToolResult] = []
    ) async throws -> BannerChatResponse {
        let body = BannerChatRequest(message: message, conversation: conversation,
                                     deviceContext: deviceContext, toolResults: toolResults)
        return try await request(Config.API.botChat, method: "POST",
                                 body: body, responseType: BannerChatResponse.self)
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
