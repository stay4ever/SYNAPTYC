import Foundation

/// Contact model representing a user contact in the address book.
struct Contact: Codable, Identifiable {
    let id: String
    let userId: String // Current user's ID
    let contactId: String // Contact's user ID
    let contactUsername: String
    let contactDisplayName: String?
    let publicKey: String? // Contact's ECDH P-384 public key
    let isOnline: Bool
    let addedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case contactId = "contact_id"
        case contactUsername = "contact_username"
        case contactDisplayName = "contact_display_name"
        case publicKey = "public_key"
        case isOnline = "is_online"
        case addedAt = "added_at"
    }

    // MARK: - Computed Properties

    /// Display name if available, otherwise username
    var displayNameOrUsername: String {
        contactDisplayName ?? contactUsername
    }

    /// Initials derived from displayName or username
    var initials: String {
        let name = contactDisplayName ?? contactUsername
        let components = name.split(separator: " ")
        if components.count > 1 {
            return String(components[0].prefix(1)) + String(components[1].prefix(1))
        }
        return String(name.prefix(1))
    }

    #if DEBUG
    static var mockContact: Contact {
        Contact(id: "contact-1", userId: "current-user", contactId: "user-2",
                contactUsername: "neo", contactDisplayName: "Neo",
                publicKey: nil, isOnline: true, addedAt: Date())
    }
    #endif
}
