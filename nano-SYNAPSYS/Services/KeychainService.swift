import Foundation
import Security
import CryptoKit

/// KeychainService: Singleton for secure iOS Keychain operations.
/// Handles storage and retrieval of strings, data, and CryptoKit SymmetricKeys.
final class KeychainService {
    static let shared = KeychainService()

    private let serviceName = "com.aievolve.nanosynapsys"

    private init() {}

    // MARK: - String Operations

    /// Save a string value to the Keychain.
    func save(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }
        try saveData(key: key, data: data)
    }

    /// Load a string value from the Keychain.
    func load(key: String) -> String? {
        guard let data = loadData(key: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // MARK: - Data Operations

    /// Save raw data to the Keychain.
    func saveData(key: String, data: Data) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String,
            kSecValueData as String: data
        ]

        // Delete existing if present
        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    /// Load raw data from the Keychain.
    func loadData(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }
        return data
    }

    // MARK: - SymmetricKey Operations

    /// Save a CryptoKit SymmetricKey to the Keychain.
    func saveSymmetricKey(key: String, symmetricKey: SymmetricKey) throws {
        let keyData = symmetricKey.withUnsafeBytes { Data($0) }
        try saveData(key: key, data: keyData)
    }

    /// Load a CryptoKit SymmetricKey from the Keychain.
    func loadSymmetricKey(key: String) -> SymmetricKey? {
        guard let data = loadData(key: key) else { return nil }
        return SymmetricKey(data: data)
    }

    // MARK: - Deletion

    /// Delete a value from the Keychain.
    func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }
}

// MARK: - KeychainError

enum KeychainError: LocalizedError {
    case encodingFailed
    case saveFailed(OSStatus)
    case deleteFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .encodingFailed:
            return "Failed to encode string as UTF-8"
        case .saveFailed(let status):
            return "Keychain save failed with status: \(status)"
        case .deleteFailed(let status):
            return "Keychain delete failed with status: \(status)"
        }
    }
}
