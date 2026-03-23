import Foundation
import CryptoKit

// MARK: - Service protocols for dependency injection and testability

/// Protocol for API networking — allows mocking in tests
protocol APIServiceProtocol: Sendable {
    func login(email: String, password: String) async throws -> AuthResponse
    func register(username: String, email: String, password: String, displayName: String, phoneNumberHash: String?) async throws -> AuthResponse
    func syncContacts(hashes: [String]) async throws -> [AppUser]
    func me() async throws -> AppUser
    func requestPasswordReset(email: String) async throws
    func users() async throws -> [AppUser]
    func messages(with userId: Int) async throws -> [Message]
    func sendMessage(toUser: Int, content: String) async throws -> Message
    func contacts() async throws -> [Contact]
    func sendContactRequest(to userId: Int) async throws -> Contact
    func updateContact(id: Int, status: String) async throws -> Contact
    func botChat(message: String) async throws -> String
    func groups() async throws -> [Group]
    func createGroup(name: String, description: String) async throws -> Group
    func groupMessages(groupId: Int) async throws -> [GroupMessage]
    func addGroupMember(groupId: Int, userId: Int) async throws -> Group
    func removeGroupMember(groupId: Int, userId: Int) async throws
    func deleteGroup(groupId: Int) async throws
    func createInvite() async throws -> InviteResponse
}

/// Protocol for keychain storage — allows mocking in tests
protocol KeychainServiceProtocol {
    @discardableResult static func save(_ value: String, for key: String) -> Bool
    static func load(_ key: String) -> String?
    @discardableResult static func delete(_ key: String) -> Bool
    @discardableResult static func saveData(_ data: Data, for key: String) -> Bool
    static func loadData(_ key: String) -> Data?
}

/// Protocol for encryption operations — allows mocking in tests
protocol EncryptionServiceProtocol {
    static func generateKeyPair() -> P384.KeyAgreement.PrivateKey
    static func publicKeyData(from privateKey: P384.KeyAgreement.PrivateKey) -> Data
    static func deriveSharedKey(myPrivateKey: P384.KeyAgreement.PrivateKey, theirPublicKeyData: Data) throws -> SymmetricKey
    static func encrypt(_ plaintext: String, using key: SymmetricKey) throws -> String
    static func decrypt(_ ciphertext: String, using key: SymmetricKey) throws -> String
}

// MARK: - Protocol conformances for existing services

extension APIService: APIServiceProtocol {}
extension KeychainService: KeychainServiceProtocol {}
extension EncryptionService: EncryptionServiceProtocol {}
