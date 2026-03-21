import Foundation
import CryptoKit

/// EncryptionService: Provides ECDH P-384 key exchange and AES-256-GCM encryption.
/// Instantiated per-conversation for key isolation. Static helpers for key generation.
final class EncryptionService {
    private let keychain = KeychainService.shared

    // MARK: - Initialization

    /// Initialize with a private key (typically loaded from storage).
    init(privateKey: P384.KeyAgreement.PrivateKey) {
        self.privateKey = privateKey
    }

    /// Initialize with a keychain key identifier, loading the private key from secure storage.
    init?(fromKeychainKey: String) {
        guard let data = keychain.loadData(key: fromKeychainKey) else { return nil }
        do {
            self.privateKey = try P384.KeyAgreement.PrivateKey(rawRepresentation: data)
        } catch {
            return nil
        }
    }

    private var privateKey: P384.KeyAgreement.PrivateKey

    // MARK: - Static Key Generation

    /// Generate a new ECDH P-384 key pair.
    static func generateKeyPair() -> (privateKey: P384.KeyAgreement.PrivateKey, publicKey: P384.KeyAgreement.PublicKey) {
        let privateKey = P384.KeyAgreement.PrivateKey()
        let publicKey = privateKey.publicKey
        return (privateKey, publicKey)
    }

    /// Export a public key to base64 for transmission.
    static func exportPublicKey(_ publicKey: P384.KeyAgreement.PublicKey) -> String {
        let rawKey = publicKey.rawRepresentation
        return rawKey.base64EncodedString()
    }

    /// Import a public key from base64.
    static func importPublicKey(from base64String: String) throws -> P384.KeyAgreement.PublicKey {
        guard let rawKey = Data(base64Encoded: base64String) else {
            throw EncryptionError.invalidBase64
        }
        do {
            return try P384.KeyAgreement.PublicKey(rawRepresentation: rawKey)
        } catch {
            throw EncryptionError.invalidPublicKey
        }
    }

    // MARK: - Key Derivation

    /// Derive a shared secret from the peer's public key using ECDH.
    /// Uses HKDF-SHA384 to expand the shared secret into a 32-byte SymmetricKey.
    func deriveSharedSecret(peerPublicKey: P384.KeyAgreement.PublicKey) throws -> SymmetricKey {
        let sharedSecret = try privateKey.sharedSecretFromKeyAgreement(with: peerPublicKey)

        // Use HKDF-SHA384 to expand to SymmetricKey (256-bit)
        let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA384.self,
            salt: Data(),
            sharedInfo: Data("nano-synapsys-e2e".utf8),
            outputByteCount: 32
        )
        return symmetricKey
    }

    // MARK: - Encryption & Decryption

    /// Encrypt a plaintext message using AES-256-GCM.
    /// Returns "ENC:" prefix + base64(nonce + ciphertext + tag).
    func encrypt(message: String, using symmetricKey: SymmetricKey) throws -> String {
        guard let plaintext = message.data(using: .utf8) else {
            throw EncryptionError.encodingFailed
        }

        let nonce = AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(plaintext, using: symmetricKey, nonce: nonce)

        // Combine nonce + ciphertext + tag
        let nonceData = Data(nonce)

        var combined = nonceData
        combined.append(sealedBox.ciphertext)
        combined.append(sealedBox.tag)

        let encoded = combined.base64EncodedString()
        return "ENC:" + encoded
    }

    /// Decrypt an encrypted message in the format "ENC:" + base64(...).
    /// Extracts nonce, ciphertext, and tag; verifies and decrypts.
    func decrypt(encryptedMessage: String, using symmetricKey: SymmetricKey) throws -> String {
        guard encryptedMessage.hasPrefix("ENC:") else {
            throw EncryptionError.invalidFormat
        }

        let base64String = String(encryptedMessage.dropFirst(4))
        guard let combined = Data(base64Encoded: base64String) else {
            throw EncryptionError.invalidBase64
        }

        // Extract nonce (12 bytes), ciphertext, and tag (16 bytes)
        let nonceSize = 12
        let tagSize = 16

        guard combined.count >= nonceSize + tagSize else {
            throw EncryptionError.malformedData
        }

        let nonceData = combined.subdata(in: 0..<nonceSize)
        let ciphertextAndTag = combined.subdata(in: nonceSize..<combined.count)

        guard let nonce = try? AES.GCM.Nonce(data: nonceData) else {
            throw EncryptionError.invalidNonce
        }

        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertextAndTag.dropLast(tagSize), tag: ciphertextAndTag.suffix(tagSize))
        let plaintext = try AES.GCM.open(sealedBox, using: symmetricKey)

        guard let message = String(data: plaintext, encoding: .utf8) else {
            throw EncryptionError.decodingFailed
        }

        return message
    }

    // MARK: - Public Key Access

    /// Get the public key for this service's private key.
    var publicKey: P384.KeyAgreement.PublicKey {
        privateKey.publicKey
    }

    /// Export this service's public key as base64.
    func exportPublicKey() -> String {
        Self.exportPublicKey(publicKey)
    }
}

// MARK: - EncryptionError

enum EncryptionError: LocalizedError {
    case invalidBase64
    case invalidPublicKey
    case encodingFailed
    case encryptionFailed
    case invalidFormat
    case malformedData
    case invalidNonce
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .invalidBase64:
            return "Invalid base64 encoding"
        case .invalidPublicKey:
            return "Invalid P-384 public key"
        case .encodingFailed:
            return "Failed to encode plaintext as UTF-8"
        case .encryptionFailed:
            return "Encryption operation failed"
        case .invalidFormat:
            return "Encrypted message does not start with 'ENC:' prefix"
        case .malformedData:
            return "Encrypted data is too short or malformed"
        case .invalidNonce:
            return "Invalid AES-GCM nonce"
        case .decodingFailed:
            return "Failed to decode decrypted plaintext as UTF-8"
        }
    }
}
