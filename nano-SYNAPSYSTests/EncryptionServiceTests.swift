import XCTest
import CryptoKit
@testable import nano_SYNAPSYS

final class EncryptionServiceTests: XCTestCase {

    // MARK: - Symmetric encrypt / decrypt round-trip

    func test_encryptDecrypt_roundTrip() throws {
        let key       = SymmetricKey(size: .bits256)
        let plaintext = "Hello, nano-SYNAPSYS!"

        let ciphertext = try EncryptionService.encrypt(plaintext, using: key)
        XCTAssertTrue(ciphertext.hasPrefix("ENC:"), "Encrypted output must have ENC: prefix")
        XCTAssertNotEqual(ciphertext, plaintext)

        let recovered = try EncryptionService.decrypt(ciphertext, using: key)
        XCTAssertEqual(recovered, plaintext)
    }

    func test_decrypt_plaintext_passthrough() throws {
        let key   = SymmetricKey(size: .bits256)
        let plain = "not encrypted"
        let result = try EncryptionService.decrypt(plain, using: key)
        XCTAssertEqual(result, plain, "Non-ENC: string should pass through unchanged")
    }

    func test_decrypt_wrongKey_throws() {
        let key1 = SymmetricKey(size: .bits256)
        let key2 = SymmetricKey(size: .bits256)
        let ciphertext = try? EncryptionService.encrypt("secret", using: key1)
        XCTAssertNotNil(ciphertext)
        XCTAssertThrowsError(try EncryptionService.decrypt(ciphertext!, using: key2),
                             "Decrypting with wrong key must throw")
    }

    func test_encryptDecrypt_emptyString() throws {
        let key    = SymmetricKey(size: .bits256)
        let result = try EncryptionService.encrypt("", using: key)
        let back   = try EncryptionService.decrypt(result, using: key)
        XCTAssertEqual(back, "")
    }

    func test_encryptDecrypt_unicode() throws {
        let key       = SymmetricKey(size: .bits256)
        let plaintext = "Héllo wörld — nano-SYNAPSYS"
        let back      = try EncryptionService.decrypt(
            try EncryptionService.encrypt(plaintext, using: key),
            using: key
        )
        XCTAssertEqual(back, plaintext)
    }

    func test_encryptDecrypt_longMessage() throws {
        let key       = SymmetricKey(size: .bits256)
        let plaintext = String(repeating: "A", count: 10_000)
        let encrypted = try EncryptionService.encrypt(plaintext, using: key)
        let decrypted = try EncryptionService.decrypt(encrypted, using: key)
        XCTAssertEqual(decrypted, plaintext)
    }

    func test_encrypt_producesDifferentCiphertext() throws {
        let key = SymmetricKey(size: .bits256)
        let a   = try EncryptionService.encrypt("same", using: key)
        let b   = try EncryptionService.encrypt("same", using: key)
        XCTAssertNotEqual(a, b, "AES-GCM nonce should make ciphertexts differ")
    }

    // MARK: - ECDH key exchange

    func test_ecdhKeyExchange_producesSharedKey() throws {
        let alice = EncryptionService.generateKeyPair()
        let bob   = EncryptionService.generateKeyPair()

        let aliceShared = try EncryptionService.deriveSharedKey(
            myPrivateKey: alice,
            theirPublicKeyData: EncryptionService.publicKeyData(from: bob)
        )
        let bobShared = try EncryptionService.deriveSharedKey(
            myPrivateKey: bob,
            theirPublicKeyData: EncryptionService.publicKeyData(from: alice)
        )

        let aliceBytes = aliceShared.withUnsafeBytes { Data($0) }
        let bobBytes   = bobShared.withUnsafeBytes   { Data($0) }
        XCTAssertEqual(aliceBytes, bobBytes, "ECDH must produce the same shared secret on both sides")
    }

    func test_ecdhCrossEncrypt_aliceToBob() throws {
        let alice = EncryptionService.generateKeyPair()
        let bob   = EncryptionService.generateKeyPair()

        let sharedA = try EncryptionService.deriveSharedKey(
            myPrivateKey: alice,
            theirPublicKeyData: EncryptionService.publicKeyData(from: bob)
        )
        let sharedB = try EncryptionService.deriveSharedKey(
            myPrivateKey: bob,
            theirPublicKeyData: EncryptionService.publicKeyData(from: alice)
        )

        let msg       = "Top secret message"
        let encrypted = try EncryptionService.encrypt(msg, using: sharedA)
        let decrypted = try EncryptionService.decrypt(encrypted, using: sharedB)
        XCTAssertEqual(decrypted, msg)
    }

    func test_ecdhKeyExchange_differentPairs_differentKeys() throws {
        let alice = EncryptionService.generateKeyPair()
        let bob   = EncryptionService.generateKeyPair()
        let carol = EncryptionService.generateKeyPair()

        let abKey = try EncryptionService.deriveSharedKey(
            myPrivateKey: alice,
            theirPublicKeyData: EncryptionService.publicKeyData(from: bob)
        )
        let acKey = try EncryptionService.deriveSharedKey(
            myPrivateKey: alice,
            theirPublicKeyData: EncryptionService.publicKeyData(from: carol)
        )

        let abBytes = abKey.withUnsafeBytes { Data($0) }
        let acBytes = acKey.withUnsafeBytes { Data($0) }
        XCTAssertNotEqual(abBytes, acBytes, "Different conversation pairs must produce different keys")
    }

    // MARK: - Public key serialisation

    func test_publicKey_serialisationRoundTrip() throws {
        let key     = EncryptionService.generateKeyPair()
        let rawData = EncryptionService.publicKeyData(from: key)
        XCTAssertFalse(rawData.isEmpty)
        let restored = try P384.KeyAgreement.PublicKey(rawRepresentation: rawData)
        XCTAssertEqual(key.publicKey.rawRepresentation, restored.rawRepresentation)
    }

    func test_publicKey_dataSize() {
        let key  = EncryptionService.generateKeyPair()
        let data = EncryptionService.publicKeyData(from: key)
        XCTAssertEqual(data.count, 96, "P-384 uncompressed public key should be 96 bytes")
    }
}
