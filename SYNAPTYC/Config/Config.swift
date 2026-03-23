import Foundation

enum Config {
    // MARK: - Server endpoints (SYNAPTYC dedicated infrastructure)
    // Standalone backend — no shared infrastructure with any other service.

    static let baseURL = "https://www.ai-evolution.com.au"
    static let wsURL   = "wss://www.ai-evolution.com.au/chat"

    enum API {
        static let register         = "\(baseURL)/auth/register"
        static let login            = "\(baseURL)/auth/login"
        static let me               = "\(baseURL)/auth/me"
        static let users            = "\(baseURL)/api/users"
        static let contacts         = "\(baseURL)/api/contacts"
        static let contactsPending  = "\(baseURL)/api/contacts/pending"
        static let contactsRequest  = "\(baseURL)/api/contacts/request"
        static let contactsAccept   = "\(baseURL)/api/contacts/accept"
        static let contactsDecline  = "\(baseURL)/api/contacts/decline"
        static let contactsBlock    = "\(baseURL)/api/contacts/block"
        static let messages         = "\(baseURL)/api/messages"
        static let botChat          = "\(baseURL)/api/bot/chat"
        static let groups           = "\(baseURL)/api/groups"
        static let invites          = "\(baseURL)/api/invites"
        static let profile          = "\(baseURL)/api/profile"
        static let pushToken        = "\(baseURL)/api/push-token"
        static let passwordReset    = "\(baseURL)/auth/password-reset"
    }

    enum Keychain {
        static let tokenKey      = "nano_synapsys_jwt"
        static let userKey       = "nano_synapsys_user"
        static let privateKeyTag = "com.nanosynapsys.ecprivatekey"
    }

    enum App {
        static let name          = "SYNAPTYC"
        static let version       = "1.1.0"
        static let encryptionLabel = "AES-256-GCM · ECDH-P384 · E2E Encrypted"
    }
}
