import Foundation

struct AppUser: Codable, Identifiable, Equatable {
    let id: Int
    let username: String
    let email: String
    var displayName: String?
    var isApproved: Bool
    var isOnline: Bool?
    var lastSeen: String?

    enum CodingKeys: String, CodingKey {
        case id, username, email
        case displayName = "display_name"
        case isApproved = "is_approved"
        case isOnline = "online"
        case lastSeen = "last_seen"
    }

    var name: String {
        if let dn = displayName, !dn.isEmpty { return dn }
        return username
    }
    var initials: String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}

struct AuthResponse: Codable {
    let token: String
    let user: AppUser
}

struct MeResponse: Codable {
    let user: AppUser
}
