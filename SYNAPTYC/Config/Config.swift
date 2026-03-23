import Foundation

enum Config {
    // MARK: - Server endpoints (SYNAPTYC dedicated infrastructure)
    // Standalone backend — no shared infrastructure with any other service.

    static let baseURL = "https://nano-synapsys-server.fly.dev"
    static let wsURL   = "wss://nano-synapsys-server.fly.dev/chat"

    enum API {
        static let register      = "\(baseURL)/auth/register"
        static let login         = "\(baseURL)/auth/login"
        static let me            = "\(baseURL)/auth/me"
        static let passwordReset = "\(baseURL)/auth/password-reset"
        static let users         = "\(baseURL)/api/users"
        static let contacts      = "\(baseURL)/api/contacts"
        static let messages      = "\(baseURL)/api/messages"
        static let botChat       = "\(baseURL)/api/bot/chat"
        static let groups        = "\(baseURL)/api/groups"
        static let invites       = "\(baseURL)/api/invites"
        static let profile       = "\(baseURL)/api/profile"
        static let avatar        = "\(baseURL)/api/profile/avatar"
        static let pushToken     = "\(baseURL)/api/push-token"
    }

    enum Keychain {
        static let tokenKey      = "nano_synapsys_jwt"
        static let userKey       = "nano_synapsys_user"
        static let privateKeyTag = "com.nanosynapsys.ecprivatekey"
    }

    enum App {
        static let name             = "SYNAPTYC"
        static let version          = "1.5.1"
        static let build            = "83"
        static let encryptionLabel  = "Signal Double Ratchet · AES-256-GCM · ECDH-P384"
        static let backendHost      = "nano-synapsys-server.fly.dev"
    }
}
