import Foundation

struct Contact: Codable, Identifiable {
    let id: Int
    let requesterId: Int
    let receiverId: Int
    var status: ContactStatus
    let createdAt: String
    var otherUser: AppUser?

    enum CodingKeys: String, CodingKey {
        case id
        case requesterId = "requester_id"
        case receiverId = "receiver_id"
        case status
        case createdAt = "created_at"
        case otherUser = "other_user"
    }
}

enum ContactStatus: String, Codable {
    case pending
    case accepted
    case blocked
}

struct ContactsResponse: Codable {
    let contacts: [Contact]
}

struct ContactRequest: Codable {
    let receiverId: Int
    enum CodingKeys: String, CodingKey {
        case receiverId = "receiver_id"
    }
}

struct ContactPatch: Codable {
    let status: String
}
