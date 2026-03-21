import XCTest
@testable import nano_SYNAPSYS
import CryptoKit

final class EncryptionServiceTests: XCTestCase {
    var sut: EncryptionService!

    override func setUp() {
        super.setUp()
        sut = EncryptionService()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    // MARK: - Key Pair Generation

    func test_generateKeyPair_createsValidKeys() {
        let keyPair = sut.generateKeyPair()

        XCTAssertNotNil(keyPair.privateKey)
        XCTAssertNotNil(keyPair.publicKey)
    }

    func test_exportPublicKey_returnsBase64() {
        let keyPair = sut.generateKeyPair()
        let publicKeyBase64 = sut.exportPublicKey(keyPair.publicKey)

        XCTAssertFalse(publicKeyBase64.isEmpty)
        XCTAssertTrue(publicKeyBase64.contains(where: { $0.isLetter || $0.isNumber || $0 == "+" || $0 == "/" || $0 == "=" }))
    }

    func test_importPublicKey_fromBase64() {
        let keyPair = sut.generateKeyPair()
        let publicKeyBase64 = sut.exportPublicKey(keyPair.publicKey)
        let importedKey = sut.importPublicKey(from: publicKeyBase64)

        XCTAssertNotNil(importedKey)
    }

    // MARK: - Key Exchange

    func test_deriveSharedSecret_symmetric() {
        let aliceKeyPair = sut.generateKeyPair()
        let bobKeyPair = sut.generateKeyPair()

        let alicePublicBase64 = sut.exportPublicKey(aliceKeyPair.publicKey)
        let bobPublicBase64 = sut.exportPublicKey(bobKeyPair.publicKey)

        guard let bobPublic = sut.importPublicKey(from: bobPublicBase64),
              let alicePublic = sut.importPublicKey(from: alicePublicBase64) else {
            XCTFail("Failed to import public keys")
            return
        }

        let aliceSecret = sut.deriveSharedSecret(privateKey: aliceKeyPair.privateKey, publicKey: bobPublic)
        let bobSecret = sut.deriveSharedSecret(privateKey: bobKeyPair.privateKey, publicKey: alicePublic)

        XCTAssertEqual(aliceSecret, bobSecret, "Both parties should derive the same shared secret")
    }

    // MARK: - Encryption & Decryption

    func test_encryptDecrypt_roundTrip() {
        let plaintext = "Hello, nano-SYNAPSYS!"
        let sharedSecret = SymmetricKey(size: .bits256)

        let encrypted = sut.encrypt(plaintext, withKey: sharedSecret)
        let decrypted = sut.decrypt(encrypted, withKey: sharedSecret)

        XCTAssertEqual(plaintext, decrypted)
    }

    func test_encryptedMessage_hasENCPrefix() {
        let plaintext = "Secret message"
        let sharedSecret = SymmetricKey(size: .bits256)

        let encrypted = sut.encrypt(plaintext, withKey: sharedSecret)

        XCTAssertTrue(encrypted.hasPrefix("ENC:"), "Encrypted messages must be prefixed with 'ENC:'")
    }

    func test_decrypt_invalidData_throws() {
        let sharedSecret = SymmetricKey(size: .bits256)
        let invalidData = "ENC:notvalidbase64!!!"

        XCTAssertNil(sut.decrypt(invalidData, withKey: sharedSecret))
    }

    func test_decrypt_wrongKey_throws() {
        let plaintext = "Secret message"
        let key1 = SymmetricKey(size: .bits256)
        let key2 = SymmetricKey(size: .bits256)

        let encrypted = sut.encrypt(plaintext, withKey: key1)
        let decrypted = sut.decrypt(encrypted, withKey: key2)

        XCTAssertNil(decrypted, "Decryption with wrong key should fail")
    }

    func test_nonce_uniqueness() {
        let plaintext = "Same message"
        let sharedSecret = SymmetricKey(size: .bits256)

        let encrypted1 = sut.encrypt(plaintext, withKey: sharedSecret)
        let encrypted2 = sut.encrypt(plaintext, withKey: sharedSecret)

        XCTAssertNotEqual(encrypted1, encrypted2, "Encrypting same message twice should produce different ciphertexts due to unique nonce")
    }

    func test_emptyMessage_roundTrip() {
        let plaintext = ""
        let sharedSecret = SymmetricKey(size: .bits256)

        let encrypted = sut.encrypt(plaintext, withKey: sharedSecret)
        let decrypted = sut.decrypt(encrypted, withKey: sharedSecret)

        XCTAssertEqual(plaintext, decrypted)
    }

    func test_longMessage_roundTrip() {
        let plaintext = String(repeating: "A", count: 10000)
        let sharedSecret = SymmetricKey(size: .bits256)

        let encrypted = sut.encrypt(plaintext, withKey: sharedSecret)
        let decrypted = sut.decrypt(encrypted, withKey: sharedSecret)

        XCTAssertEqual(plaintext, decrypted)
    }

    func test_specialCharacters_roundTrip() {
        let plaintext = "🔐 Security Test: émojis, spëcial çhars, 中文, العربية, עברית"
        let sharedSecret = SymmetricKey(size: .bits256)

        let encrypted = sut.encrypt(plaintext, withKey: sharedSecret)
        let decrypted = sut.decrypt(encrypted, withKey: sharedSecret)

        XCTAssertEqual(plaintext, decrypted)
    }
}
