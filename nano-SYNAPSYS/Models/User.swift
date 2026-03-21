import Foundation

/// AppUser model representing a user in the nano-SYNAPSYS system.
/// Named AppUser to avoid conflict with framework User types.
struct AppUser: Codable, Identifiable {
    let id: String
    let username: String
    let displayName: String?
    let publicKey: String? // Base64-encoded ECDH P-384 public key
    let createdAt: Date?
    let isOnline: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case displayName = "display_name"
        case publicKey = "public_key"
        case createdAt = "created_at"
        case isOnline = "is_online"
    }

    // MARK: - Computed Properties

    /// Initials derived from displayName or username
    var initials: String {
        let name = displayName ?? username
        let components = name.split(separator: " ")
        if components.count > 1 {
            return String(components[0].prefix(1)) + String(components[1].prefix(1))
        }
        return String(name.prefix(1))
    }

    /// Display name if available, otherwise username
    var displayNameOrUsername: String {
        displayName ?? username
    }
}
