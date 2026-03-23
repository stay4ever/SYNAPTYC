import Foundation

/// Build environment configuration
/// Set the active environment via build scheme or compile-time flag:
///   -DDEVELOPMENT, -DSTAGING, or -DPRODUCTION (default)
enum AppEnvironment: String {
    case development
    case staging
    case production

    static var current: AppEnvironment {
        #if DEVELOPMENT
        return .development
        #elseif STAGING
        return .staging
        #else
        return .production
        #endif
    }

    var baseURL: String {
        switch self {
        case .development: return "http://localhost:3000"
        case .staging:     return "https://nano-synapsys-server.fly.dev"
        case .production:  return "https://nano-synapsys-server.fly.dev"
        }
    }

    var wsURL: String {
        switch self {
        case .development: return "ws://localhost:3000/chat"
        case .staging:     return "wss://nano-synapsys-server.fly.dev/chat"
        case .production:  return "wss://nano-synapsys-server.fly.dev/chat"
        }
    }

    var name: String { rawValue.capitalized }

    var isProduction: Bool { self == .production }

    /// Whether to show debug UI elements
    var showDebugUI: Bool { self != .production }

    /// Log level
    var verboseLogging: Bool { self != .production }
}
