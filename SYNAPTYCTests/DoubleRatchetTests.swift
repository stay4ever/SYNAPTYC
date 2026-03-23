import XCTest
import CryptoKit
@testable import SYNAPTYC

final class DoubleRatchetTests: XCTestCase {

    // MARK: - Helpers

    /// Set up an Alice/Bob pair from a random shared secret.
    private func makePair() throws -> (alice: RatchetState, bob: RatchetState) {
        let bobPriv = P384.KeyAgreement.PrivateKey()
        let bobPub  = EncryptionService.publicKeyData(from: bobPriv)

        // Shared secret: same value both sides would derive via ECDH
        let alicePriv   = P384.KeyAgreement.PrivateKey()
        let sharedKey   = try EncryptionService.deriveSharedKey(
            myPrivateKey:       alicePriv,
            theirPublicKeyData: bobPub
        )
        let sk = sharedKey.withUnsafeBytes { Data($0) }

        let bobShared = try EncryptionService.deriveSharedKey(
            myPrivateKey:       bobPriv,
            theirPublicKeyData: EncryptionService.publicKeyData(from: alicePriv)
        )
        let skBob = bobShared.withUnsafeBytes { Data($0) }

        // Both sides must derive the same SK
        XCTAssertEqual(sk, skBob)

        let alice = try DoubleRatchet.initAlice(sharedSecret: sk, theirPublicKeyData: bobPub)
        let bob   = DoubleRatchet.initBob(sharedSecret: sk, ourPrivateKeyData: bobPriv.rawRepresentation)
        return (alice, bob)
    }

    // MARK: - Basic round-trip

    func test_drRoundTrip_aliceToBob() throws {
        var (alice, bob) = try makePair()

        let wire = try DoubleRatchet.encrypt(state: &alice, plaintext: "Hello Bob")
        XCTAssertTrue(wire.hasPrefix("DR2:"))

        let plain = try DoubleRatchet.decrypt(state: &bob, ciphertext: wire)
        XCTAssertEqual(plain, "Hello Bob")
    }

    func test_drRoundTrip_alternating() throws {
        var (alice, bob) = try makePair()

        let w1 = try DoubleRatchet.encrypt(state: &alice, plaintext: "Hi Bob")
        _      = try DoubleRatchet.decrypt(state: &bob,   ciphertext: w1)

        let w2 = try DoubleRatchet.encrypt(state: &bob,   plaintext: "Hi Alice")
        _      = try DoubleRatchet.decrypt(state: &alice, ciphertext: w2)

        let w3 = try DoubleRatchet.encrypt(state: &alice, plaintext: "How are you?")
        let p3 = try DoubleRatchet.decrypt(state: &bob,   ciphertext: w3)
        XCTAssertEqual(p3, "How are you?")
    }

    func test_drRoundTrip_manyMessages() throws {
        var (alice, bob) = try makePair()

        for i in 0..<50 {
            let text = "Message \(i)"
            let wire = try DoubleRatchet.encrypt(state: &alice, plaintext: text)
            let back = try DoubleRatchet.decrypt(state: &bob,   ciphertext: wire)
            XCTAssertEqual(back, text, "Mismatch at message \(i)")
        }
    }

    // MARK: - Unique ciphertext (nonce randomness)

    func test_drNonceUniqueness() throws {
        var (alice, _) = try makePair()

        let w1 = try DoubleRatchet.encrypt(state: &alice, plaintext: "Same text")
        let w2 = try DoubleRatchet.encrypt(state: &alice, plaintext: "Same text")
        XCTAssertNotEqual(w1, w2, "Same plaintext encrypted twice must produce different ciphertexts")
    }

    // MARK: - Forward secrecy

    func test_drForwardSecrecy_oldKeyCannotDecryptNew() throws {
        var (alice, bob) = try makePair()

        // Capture Bob's state BEFORE any messages
        let bobStateBefore = bob

        // Complete one full DH ratchet turn: Alice sends, Bob replies.
        // When Alice receives Bob's reply she rotates her DH keypair, so
        // subsequent messages use a chain key that staleBob cannot reconstruct
        // from bob's original private key alone.
        let w1 = try DoubleRatchet.encrypt(state: &alice, plaintext: "ping")
        _      = try DoubleRatchet.decrypt(state: &bob,   ciphertext: w1)

        let reply = try DoubleRatchet.encrypt(state: &bob,   plaintext: "pong")
        _         = try DoubleRatchet.decrypt(state: &alice, ciphertext: reply)

        // Alice now sends on the rotated chain (post-DH-ratchet)
        let newWire = try DoubleRatchet.encrypt(state: &alice, plaintext: "future message")

        // staleBob holds bob's original private key — cannot derive alice's
        // post-rotation chain key, so decryption must fail
        var staleBob = bobStateBefore
        XCTAssertThrowsError(
            try DoubleRatchet.decrypt(state: &staleBob, ciphertext: newWire),
            "Stale state must not decrypt messages encrypted after DH ratchet rotation"
        )
    }

    // MARK: - Out-of-order delivery

    func test_drOutOfOrder() throws {
        var (alice, bob) = try makePair()

        let w0 = try DoubleRatchet.encrypt(state: &alice, plaintext: "first")
        let w1 = try DoubleRatchet.encrypt(state: &alice, plaintext: "second")
        let w2 = try DoubleRatchet.encrypt(state: &alice, plaintext: "third")

        // Deliver out of order: 2 → 0 → 1
        let p2 = try DoubleRatchet.decrypt(state: &bob, ciphertext: w2)
        let p0 = try DoubleRatchet.decrypt(state: &bob, ciphertext: w0)
        let p1 = try DoubleRatchet.decrypt(state: &bob, ciphertext: w1)

        XCTAssertEqual(p0, "first")
        XCTAssertEqual(p1, "second")
        XCTAssertEqual(p2, "third")
    }

    // MARK: - DH Ratchet advance (break-in recovery)

    func test_drDHRatchetAdvances_onReply() throws {
        var (alice, bob) = try makePair()

        // Alice → Bob
        let w1 = try DoubleRatchet.encrypt(state: &alice, plaintext: "ping")
        _      = try DoubleRatchet.decrypt(state: &bob,   ciphertext: w1)

        // Bob's reply causes Alice to do a DH ratchet step
        let dhPubBefore = alice.dhsPub
        let w2 = try DoubleRatchet.encrypt(state: &bob,   plaintext: "pong")
        _      = try DoubleRatchet.decrypt(state: &alice, ciphertext: w2)

        // After receiving Bob's reply, Alice should have rotated her DH keypair
        XCTAssertNotEqual(alice.dhsPub, dhPubBefore, "Alice must rotate DH key after receiving Bob's reply")
    }

    // MARK: - Tampered ciphertext is rejected

    func test_drTamperedCiphertextThrows() throws {
        var (alice, bob) = try makePair()

        let wire = try DoubleRatchet.encrypt(state: &alice, plaintext: "secret")
        // Flip one byte in the ciphertext portion
        var tampered = wire
        if let range = tampered.range(of: ":", options: .backwards) {
            let idx = tampered.index(range.upperBound, offsetBy: 4, limitedBy: tampered.endIndex)
                ?? tampered.endIndex
            if idx < tampered.endIndex {
                tampered.replaceSubrange(idx...idx, with: tampered[idx] == "A" ? "B" : "A")
            }
        }
        XCTAssertThrowsError(try DoubleRatchet.decrypt(state: &bob, ciphertext: tampered))
    }

    // MARK: - KDF determinism

    func test_kdfRK_isDeterministic() throws {
        let priv1 = P384.KeyAgreement.PrivateKey()
        let priv2 = P384.KeyAgreement.PrivateKey()
        let pub2  = priv2.publicKey
        let rk    = Data(repeating: 0xAB, count: 32)

        let dh = try priv1.sharedSecretFromKeyAgreement(with: pub2)
        let (rk1a, ck1a) = DoubleRatchet.kdfRK(rootKey: rk, dhOutput: dh)
        let (rk1b, ck1b) = DoubleRatchet.kdfRK(rootKey: rk, dhOutput: dh)

        XCTAssertEqual(rk1a, rk1b)
        XCTAssertEqual(ck1a, ck1b)
    }

    func test_kdfCK_isDeterministic() {
        let ck = Data(repeating: 0xCD, count: 32)
        let (nck1, mk1) = DoubleRatchet.kdfCK(chainKey: ck)
        let (nck2, mk2) = DoubleRatchet.kdfCK(chainKey: ck)
        XCTAssertEqual(nck1, nck2)
        XCTAssertEqual(mk1,  mk2)
    }

    func test_kdfCK_chainAndMessageKeyAreDifferent() {
        let ck = Data(repeating: 0xEF, count: 32)
        let (nck, mk) = DoubleRatchet.kdfCK(chainKey: ck)
        XCTAssertNotEqual(nck, mk,  "Chain key and message key must differ")
        XCTAssertNotEqual(nck, ck,  "New chain key must differ from input chain key")
    }
}
