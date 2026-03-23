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
        case fromUser = "from_user"
        case toUser = "to_user"
        case content
        case read
        case createdAt = "created_at"
    }

    var timestamp: Date {
        // Try with fractional seconds first (e.g., "2024-01-01T12:00:00.000Z")
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFrac.date(from: createdAt) { return d }
        // Fall back to without fractional seconds (e.g., "2024-01-01T12:00:00Z")
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: createdAt) ?? Date()
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
    case m1    = "1m"
    case m5    = "5m"
    case m10   = "10m"
    case h24   = "24h"
    case d7    = "7d"
    case d30   = "30d"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .off: return "Off"
        case .m1:  return "1 minute"
        case .m5:  return "5 minutes"
        case .m10: return "10 minutes"
        case .h24: return "24 hours"
        case .d7:  return "7 days"
        case .d30: return "30 days"
        }
    }
    var interval: TimeInterval? {
        switch self {
        case .off: return nil
        case .m1:  return 60
        case .m5:  return 300
        case .m10: return 600
        case .h24: return 86400
        case .d7:  return 604800
        case .d30: return 2592000
        }
    }
}
