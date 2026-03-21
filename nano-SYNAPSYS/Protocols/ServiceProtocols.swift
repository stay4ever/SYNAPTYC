import Foundation
import CryptoKit

/// Protocol for API service operations.
protocol APIServiceProtocol {
    func login(username: String, password: String) async throws -> AuthResponse
    func getContacts() async throws -> [Contact]
    func getMessages(contactId: String) async throws -> [Message]
    func sendMessage(recipientId: String, content: String) async throws -> Message
}

/// Protocol for keychain storage operations.
protocol KeychainServiceProtocol {
    func save(key: String, value: String) throws
    func load(key: String) -> String?
    func delete(key: String) throws
}

/// Protocol for encryption operations.
protocol EncryptionServiceProtocol {
    func encrypt(message: String, using key: SymmetricKey) throws -> String
    func decrypt(encryptedMessage: String, using key: SymmetricKey) throws -> String
}
