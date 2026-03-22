import Foundation

// MARK: - Group

struct Group: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String
    let createdBy: Int
    let createdAt: String
    let members: [GroupMember]

    enum CodingKeys: String, CodingKey {
        case id, name, description, members
        case createdBy = "created_by"
        case createdAt = "created_at"
    }

    var initials: String {
        name.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map { String($0) } }
            .joined()
            .uppercased()
            .ifEmpty(use: String(name.prefix(2)).uppercased())
    }
}

struct GroupMember: Codable, Identifiable {
    let id: Int
    let userId: Int
    let username: String
    let displayName: String?
    let role: String

    enum CodingKeys: String, CodingKey {
        case id, username, role
        case userId = "user_id"
        case displayName = "display_name"
    }

    var name: String {
        if let dn = displayName, !dn.isEmpty { return dn }
        return username
    }
}

// MARK: - Group Message

struct GroupMessage: Codable, Identifiable {
    let id: Int
    let groupId: Int
    let fromUser: Int
    let fromUsername: String
    let fromDisplay: String
    var content: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, content
        case groupId = "group_id"
        case fromUser = "from_user"
        case fromUsername = "from_username"
        case fromDisplay = "from_display"
        case createdAt = "created_at"
    }

    var timestamp: Date {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = fmt.date(from: createdAt) { return d }
        let alt = ISO8601DateFormatter()
        return alt.date(from: createdAt) ?? Date()
    }

    var timeString: String {
        let fmt = DateFormatter()
        fmt.dateFormat = Calendar.current.isDateInToday(timestamp) ? "HH:mm" : "dd/MM HH:mm"
        return fmt.string(from: timestamp)
    }
}

// MARK: - Invite

struct InviteResponse: Codable {
    let inviteUrl: String
    let token: String
    let expiresAt: String

    enum CodingKeys: String, CodingKey {
        case token
        case inviteUrl = "invite_url"
        case expiresAt = "expires_at"
    }
}

// MARK: - Helpers

private extension String {
    func ifEmpty(use fallback: String) -> String { isEmpty ? fallback : self }
}
