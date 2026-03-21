import Foundation

/// Environment configuration for nano-SYNAPSYS.
enum Environment {
    case development
    case staging
    case production

    static var current: Environment {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }

    var apiBaseURL: String {
        switch self {
        case .development: return "https://api.nanosynapsys.com"
        case .staging: return "https://api.nanosynapsys.com"
        case .production: return "https://api.nanosynapsys.com"
        }
    }

    var wsBaseURL: String {
        switch self {
        case .development: return "wss://api.nanosynapsys.com/ws"
        case .staging: return "wss://api.nanosynapsys.com/ws"
        case .production: return "wss://api.nanosynapsys.com/ws"
        }
    }
}
