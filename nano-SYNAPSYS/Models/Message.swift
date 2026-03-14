import Foundation

struct Message: Codable, Identifiable, Equatable {
    let id: Int
    let fromUser: Int
    let toUser: Int
    var content: String
    var read: Bool
    let createdAt: String

    // Encrypted payload (stored locally, not sent to server in plaintext)
    var isEncrypted: Bool = false
    var disappearsAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case fromUser  = "from_user"
        case toUser    = "to_user"
        case content
        case read
        case createdAt = "created_at"
    }

    var timestamp: Date {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fmt.date(from: createdAt) ?? Date()
    }

    var timeString: String {
        let fmt = DateFormatter()
        let cal = Calendar.current
        if cal.isDateInToday(timestamp) {
            fmt.dateFormat = "HH:mm"
        } else if cal.isDateInYesterday(timestamp) {
            return "Yesterday"
        } else {
            fmt.dateFormat = "dd/MM/yy"
        }
        return fmt.string(from: timestamp)
    }
}

struct SendMessageRequest: Codable {
    let toUser: Int
    let content: String
    enum CodingKeys: String, CodingKey {
        case toUser = "to_user"
        case content
    }
}

struct MessagesResponse: Codable {
    let messages: [Message]
}

// Disappearing message timer options
enum DisappearTimer: String, CaseIterable, Identifiable {
    case off
    case h24   = "24h"
    case d7    = "7d"
    case d30   = "30d"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .off:  return "Off"
        case .h24:  return "24 hours"
        case .d7:   return "7 days"
        case .d30:  return "30 days"
        }
    }
    var interval: TimeInterval? {
        switch self {
        case .off:  return nil
        case .h24:  return 86400
        case .d7:   return 604800
        case .d30:  return 2592000
        }
    }
}
