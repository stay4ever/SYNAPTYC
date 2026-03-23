import Foundation
import CryptoKit

/// Per-conversation E2E encryption using ECDH P-384 + AES-256-GCM
enum EncryptionService {

    // MARK: - Key generation

    static func generateKeyPair() -> P384.KeyAgreement.PrivateKey {
        P384.KeyAgreement.PrivateKey()
    }

    static func publicKeyData(from privateKey: P384.KeyAgreement.PrivateKey) -> Data {
        privateKey.publicKey.rawRepresentation
    }

    // MARK: - Shared secret derivation

    static func deriveSharedKey(
        myPrivateKey: P384.KeyAgreement.PrivateKey,
        theirPublicKeyData: Data
    ) throws -> SymmetricKey {
        let theirPublicKey = try P384.KeyAgreement.PublicKey(rawRepresentation: theirPublicKeyData)
        let sharedSecret  = try myPrivateKey.sharedSecretFromKeyAgreement(with: theirPublicKey)
        return sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA384.self,
            salt: Data("nano-SYNAPSYS-v1".utf8),
            sharedInfo: Data(),
            outputByteCount: 32
        )
    }

    // MARK: - Encrypt / Decrypt

    static func encrypt(_ plaintext: String, using key: SymmetricKey) throws -> String {
        let data = Data(plaintext.utf8)
        let sealed = try AES.GCM.seal(data, using: key)
        guard let combined = sealed.combined else {
            throw EncryptionError.sealFailed
        }
        return "ENC:" + combined.base64EncodedString()
    }

    static func decrypt(_ ciphertext: String, using key: SymmetricKey) throws -> String {
        guard ciphertext.hasPrefix("ENC:") else { return ciphertext }
        let base64 = String(ciphertext.dropFirst(4))
        guard let data = Data(base64Encoded: base64) else {
            throw EncryptionError.decodingFailed
        }
        let box = try AES.GCM.SealedBox(combined: data)
        let plaintext = try AES.GCM.open(box, using: key)
        guard let str = String(data: plaintext, encoding: .utf8) else {
            throw EncryptionError.decodingFailed
        }
        return str
    }

    // MARK: - Key persistence

    static func storePrivateKey(_ key: P384.KeyAgreement.PrivateKey, conversationId: Int) {
        let data = key.rawRepresentation
        KeychainService.saveData(data, for: "\(Config.Keychain.privateKeyTag).\(conversationId)")
    }

    static func loadPrivateKey(conversationId: Int) -> P384.KeyAgreement.PrivateKey? {
        guard let data = KeychainService.loadData("\(Config.Keychain.privateKeyTag).\(conversationId)") else { return nil }
        return try? P384.KeyAgreement.PrivateKey(rawRepresentation: data)
    }

    static func storeSymmetricKey(_ key: SymmetricKey, conversationId: Int) {
        KeychainService.saveData(key.withUnsafeBytes { Data($0) },
                                 for: "\(Config.Keychain.privateKeyTag).sym.\(conversationId)")
    }

    static func loadSymmetricKey(conversationId: Int) -> SymmetricKey? {
        guard let data = KeychainService.loadData("\(Config.Keychain.privateKeyTag).sym.\(conversationId)") else { return nil }
        return SymmetricKey(data: data)
    }

    // MARK: - Convenience: message-level encryption without pre-exchange
    // Used when no key exchange has occurred yet (falls back to a device-local key)

    static func localKey() -> SymmetricKey {
        let tag = "\(Config.Keychain.privateKeyTag).local"
        if let data = KeychainService.loadData(tag) {
            return SymmetricKey(data: data)
        }
        let key = SymmetricKey(size: .bits256)
        key.withUnsafeBytes { KeychainService.saveData(Data($0), for: tag) }
        return key
    }
}

enum EncryptionError: LocalizedError {
    case encodingFailed
    case decodingFailed
    case sealFailed
    case keyExchangeFailed

    var errorDescription: String? {
        switch self {
        case .encodingFailed: return "Failed to encode message data"
        case .decodingFailed: return "Failed to decode encrypted data"
        case .sealFailed: return "Encryption seal failed"
        case .keyExchangeFailed: return "Key exchange failed"
        }
    }
}
