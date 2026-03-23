import XCTest
@testable import SYNAPTYC
import CryptoKit

final class EncryptionServiceTests: XCTestCase {

    // MARK: - Key Pair Generation

    func test_generateKeyPair_createsValidKey() {
        let privateKey = EncryptionService.generateKeyPair()
        let pubData = EncryptionService.publicKeyData(from: privateKey)
        XCTAssertFalse(pubData.isEmpty)
    }

    func test_publicKeyData_isNotEmpty() {
        let privateKey = EncryptionService.generateKeyPair()
        let pubData = EncryptionService.publicKeyData(from: privateKey)

        XCTAssertFalse(pubData.isEmpty)
        XCTAssertGreaterThan(pubData.count, 0)
    }

    func test_publicKeyData_canBeImported() {
        let privateKey = EncryptionService.generateKeyPair()
        let pubData = EncryptionService.publicKeyData(from: privateKey)
        let importedKey = try? P384.KeyAgreement.PublicKey(rawRepresentation: pubData)

        XCTAssertNotNil(importedKey)
    }

    // MARK: - Key Exchange

    func test_deriveSharedKey_symmetric() {
        let alicePriv = EncryptionService.generateKeyPair()
        let bobPriv   = EncryptionService.generateKeyPair()

        let alicePubData = EncryptionService.publicKeyData(from: alicePriv)
        let bobPubData   = EncryptionService.publicKeyData(from: bobPriv)

        guard let aliceKey = try? EncryptionService.deriveSharedKey(myPrivateKey: alicePriv, theirPublicKeyData: bobPubData),
              let bobKey   = try? EncryptionService.deriveSharedKey(myPrivateKey: bobPriv, theirPublicKeyData: alicePubData) else {
            XCTFail("Failed to derive shared keys")
            return
        }

        let aliceBytes = aliceKey.withUnsafeBytes { Data($0) }
        let bobBytes   = bobKey.withUnsafeBytes { Data($0) }

        XCTAssertEqual(aliceBytes, bobBytes, "Both parties should derive the same shared key")
    }

    // MARK: - Encryption & Decryption

    func test_encryptDecrypt_roundTrip() {
        let plaintext = "Hello, SYNAPTYC!"
        let sharedKey = SymmetricKey(size: .bits256)

        let encrypted = try! EncryptionService.encrypt(plaintext, using: sharedKey)
        let decrypted = try! EncryptionService.decrypt(encrypted, using: sharedKey)

        XCTAssertEqual(plaintext, decrypted)
    }

    func test_encryptedMessage_hasENCPrefix() {
        let plaintext = "Secret message"
        let sharedKey = SymmetricKey(size: .bits256)

        let encrypted = try! EncryptionService.encrypt(plaintext, using: sharedKey)

        XCTAssertTrue(encrypted.hasPrefix("ENC:"), "Encrypted messages must be prefixed with 'ENC:'")
    }

    func test_decrypt_invalidData_throws() {
        let sharedKey = SymmetricKey(size: .bits256)
        let invalidData = "ENC:notvalidbase64!!!"

        XCTAssertThrowsError(try EncryptionService.decrypt(invalidData, using: sharedKey))
    }

    func test_decrypt_wrongKey_throws() {
        let plaintext = "Secret message"
        let key1 = SymmetricKey(size: .bits256)
        let key2 = SymmetricKey(size: .bits256)

        let encrypted = try! EncryptionService.encrypt(plaintext, using: key1)

        XCTAssertThrowsError(
            try EncryptionService.decrypt(encrypted, using: key2),
            "Decryption with wrong key should throw"
        )
    }

    func test_nonce_uniqueness() {
        let plaintext = "Same message"
        let sharedKey = SymmetricKey(size: .bits256)

        let encrypted1 = try! EncryptionService.encrypt(plaintext, using: sharedKey)
        let encrypted2 = try! EncryptionService.encrypt(plaintext, using: sharedKey)

        XCTAssertNotEqual(encrypted1, encrypted2, "Encrypting same message twice should produce different ciphertexts")
    }

    func test_emptyMessage_roundTrip() {
        let plaintext = ""
        let sharedKey = SymmetricKey(size: .bits256)

        let encrypted = try! EncryptionService.encrypt(plaintext, using: sharedKey)
        let decrypted = try! EncryptionService.decrypt(encrypted, using: sharedKey)

        XCTAssertEqual(plaintext, decrypted)
    }

    func test_longMessage_roundTrip() {
        let plaintext = String(repeating: "A", count: 10000)
        let sharedKey = SymmetricKey(size: .bits256)

        let encrypted = try! EncryptionService.encrypt(plaintext, using: sharedKey)
        let decrypted = try! EncryptionService.decrypt(encrypted, using: sharedKey)

        XCTAssertEqual(plaintext, decrypted)
    }

    func test_specialCharacters_roundTrip() {
        let plaintext = "🔐 Security Test: émojis, spëcial çhars, 中文, العربية, עברית"
        let sharedKey = SymmetricKey(size: .bits256)

        let encrypted = try! EncryptionService.encrypt(plaintext, using: sharedKey)
        let decrypted = try! EncryptionService.decrypt(encrypted, using: sharedKey)

        XCTAssertEqual(plaintext, decrypted)
    }
}
