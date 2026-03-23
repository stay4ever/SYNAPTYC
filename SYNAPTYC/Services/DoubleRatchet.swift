import Foundation
import CryptoKit

// MARK: - Wire-format prefix

private let kDRPrefix = "DR2:"

// MARK: - Header (transmitted with every message)

struct RatchetHeader: Codable {
    /// Sender's current DH ratchet public key (P-384 raw representation)
    let dh: Data
    /// Length of the previous sending chain (so receiver can skip)
    let pn: UInt32
    /// Message number in the current sending chain
    let n: UInt32
}

// MARK: - Ratchet State (fully serialisable — persisted to Keychain as JSON)

struct RatchetState: Codable {
    // --- DH ratchet keypair (ours, rotated each time we receive a new DH key) ---
    var dhsPriv: Data           // P-384 private key — raw representation
    var dhsPub:  Data           // P-384 public key  — raw representation

    // --- Their current DH ratchet public key ---
    var dhr: Data?

    // --- Chain keys (32 bytes each, nil until that chain is established) ---
    var rk:  Data               // Root key
    var cks: Data?              // Sending chain key
    var ckr: Data?              // Receiving chain key

    // --- Message counters ---
    var ns: UInt32 = 0          // Messages sent on current sending chain
    var nr: UInt32 = 0          // Messages received on current receiving chain
    var pn: UInt32 = 0          // Messages sent on the previous sending chain

    // --- Out-of-order message keys: "<dhPubBase64>:<N>" → 32-byte message key ---
    var mkSkipped: [String: Data] = [:]
}

// MARK: - Double Ratchet Engine

/// Signal-compliant Double Ratchet (ECDH P-384 + HKDF-SHA256 + HMAC-SHA256 + AES-256-GCM).
///
/// Usage
/// -----
///   Initiator (lower user ID, knows peer's initial ratchet pub key):
///     var state = try DoubleRatchet.initAlice(sharedSecret: sk, theirPublicKeyData: peerPub)
///
///   Responder (higher user ID, owns the keypair whose pub was given to Alice):
///     var state = DoubleRatchet.initBob(sharedSecret: sk, ourPrivateKeyData: ourPriv)
///
///   Send:   let wire = try DoubleRatchet.encrypt(state: &state, plaintext: "hello")
///   Recv:   let text = try DoubleRatchet.decrypt(state: &state, ciphertext: wire)
///   Persist: DoubleRatchet.save(state, for: conversationId)
enum DoubleRatchet {

    // MARK: - Limits

    private static let maxSkip = 100

    // MARK: - Initialisation

    /// Alice side: already knows Bob's initial ratchet public key.
    /// Derives the first sending chain immediately — Alice can send without waiting.
    static func initAlice(sharedSecret: Data, theirPublicKeyData: Data) throws -> RatchetState {
        let ourKP    = P384.KeyAgreement.PrivateKey()
        let theirPub = try P384.KeyAgreement.PublicKey(rawRepresentation: theirPublicKeyData)
        let dh       = try ourKP.sharedSecretFromKeyAgreement(with: theirPub)
        let (newRK, cks) = kdfRK(rootKey: sharedSecret, dhOutput: dh)
        return RatchetState(
            dhsPriv: ourKP.rawRepresentation,
            dhsPub:  ourKP.publicKey.rawRepresentation,
            dhr:     theirPublicKeyData,
            rk:      newRK,
            cks:     cks,
            ckr:     nil
        )
    }

    /// Bob side: holds the keypair whose public key was given to Alice.
    /// No sending chain yet — Bob obtains one after the first DH ratchet step on receive.
    static func initBob(sharedSecret: Data, ourPrivateKeyData: Data) -> RatchetState {
        let pub = (try? P384.KeyAgreement.PrivateKey(rawRepresentation: ourPrivateKeyData))?
                        .publicKey.rawRepresentation ?? Data()
        return RatchetState(
            dhsPriv: ourPrivateKeyData,
            dhsPub:  pub,
            dhr:     nil,
            rk:      sharedSecret,
            cks:     nil,
            ckr:     nil
        )
    }

    // MARK: - Encrypt

    /// Encrypts `plaintext`, advances the sending chain, and returns the wire string.
    /// The wire format is:  DR2:<header_base64>:<aesgcm_combined_base64>
    static func encrypt(state: inout RatchetState, plaintext: String) throws -> String {
        guard let cks = state.cks else { throw DoubleRatchetError.noSendingChain }

        // Advance sending chain
        let (newCKs, mk) = kdfCK(chainKey: cks)
        let header = RatchetHeader(dh: state.dhsPub, pn: state.pn, n: state.ns)
        state.cks = newCKs
        state.ns += 1

        // Serialise header; use it as authenticated data so tampering is detected
        let headerData   = try JSONEncoder().encode(header)
        let headerBase64 = headerData.base64EncodedString()
        let ad           = Data(headerBase64.utf8)

        // AES-256-GCM with message key
        let sealed = try AES.GCM.seal(Data(plaintext.utf8), using: SymmetricKey(data: mk), authenticating: ad)
        guard let combined = sealed.combined else { throw DoubleRatchetError.sealFailed }

        return "\(kDRPrefix)\(headerBase64):\(combined.base64EncodedString())"
    }

    // MARK: - Decrypt

    /// Decrypts a DR2 wire string, advancing the receiving chain (and DH ratchet if needed).
    static func decrypt(state: inout RatchetState, ciphertext: String) throws -> String {
        guard ciphertext.hasPrefix(kDRPrefix) else { throw DoubleRatchetError.invalidFormat }

        let body  = String(ciphertext.dropFirst(kDRPrefix.count))
        let parts = body.split(separator: ":", maxSplits: 1).map(String.init)
        guard parts.count == 2,
              let headerData = Data(base64Encoded: parts[0]),
              let header     = try? JSONDecoder().decode(RatchetHeader.self, from: headerData),
              let combined   = Data(base64Encoded: parts[1])
        else { throw DoubleRatchetError.invalidFormat }

        let headerBase64 = parts[0]

        // 1. Check skipped keys first (out-of-order delivery)
        let skipID = skippedKeyID(dh: header.dh, n: header.n)
        if let mk = state.mkSkipped[skipID] {
            state.mkSkipped.removeValue(forKey: skipID)
            return try open(combined: combined, mk: mk, ad: Data(headerBase64.utf8))
        }

        // 2. DH ratchet step if the sender has rotated their key
        if header.dh != state.dhr {
            try skipMessageKeys(state: &state, until: header.pn)
            try dhRatchetStep(state: &state, header: header)
        }

        // 3. Skip to the right message in the current receiving chain
        try skipMessageKeys(state: &state, until: header.n)

        // 4. Consume the message key
        guard let ckr = state.ckr else { throw DoubleRatchetError.noReceivingChain }
        let (newCKr, mk) = kdfCK(chainKey: ckr)
        state.ckr = newCKr
        state.nr += 1

        return try open(combined: combined, mk: mk, ad: Data(headerBase64.utf8))
    }

    // MARK: - Keychain persistence

    static func save(_ state: RatchetState, for conversationId: Int) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        KeychainService.saveData(data, for: storeKey(conversationId))
    }

    static func load(for conversationId: Int) -> RatchetState? {
        guard let data  = KeychainService.loadData(storeKey(conversationId)),
              let state = try? JSONDecoder().decode(RatchetState.self, from: data)
        else { return nil }
        return state
    }

    static func delete(for conversationId: Int) {
        KeychainService.delete(storeKey(conversationId))
    }

    // MARK: - KDF_RK  (root key ratchet)

    /// KDF_RK(rk, dh_out) → (new_root_key, new_chain_key)
    /// Uses HKDF-SHA256: IKM = DH output, salt = root key, info = domain label.
    /// Returns 64 bytes split into two 32-byte keys.
    static func kdfRK(rootKey: Data, dhOutput: SharedSecret) -> (Data, Data) {
        let out64 = dhOutput.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: rootKey,
            sharedInfo: Data("SYNAPTYC-DR-RK-v1".utf8),
            outputByteCount: 64
        )
        let bytes = out64.withUnsafeBytes { Data($0) }
        return (Data(bytes.prefix(32)), Data(bytes.suffix(32)))
    }

    // MARK: - KDF_CK  (chain key ratchet — HMAC-SHA256 per Signal spec)

    /// KDF_CK(ck) → (new_chain_key, message_key)
    /// HMAC-SHA256(ck, 0x02) → next chain key
    /// HMAC-SHA256(ck, 0x01) → message key
    static func kdfCK(chainKey: Data) -> (newChainKey: Data, messageKey: Data) {
        let k   = SymmetricKey(data: chainKey)
        let mk  = Data(HMAC<SHA256>.authenticationCode(for: Data([0x01]), using: k))
        let nck = Data(HMAC<SHA256>.authenticationCode(for: Data([0x02]), using: k))
        return (nck, mk)
    }

    // MARK: - DH Ratchet step (triggered on receive of a new DH public key)

    private static func dhRatchetStep(state: inout RatchetState, header: RatchetHeader) throws {
        let theirPub = try P384.KeyAgreement.PublicKey(rawRepresentation: header.dh)
        let ourPriv  = try P384.KeyAgreement.PrivateKey(rawRepresentation: state.dhsPriv)

        // Save previous chain length, reset counters
        state.pn  = state.ns
        state.ns  = 0
        state.nr  = 0
        state.dhr = header.dh

        // Derive new receiving chain from current keypair + their new key
        let dh1 = try ourPriv.sharedSecretFromKeyAgreement(with: theirPub)
        let (rk1, newCKr) = kdfRK(rootKey: state.rk, dhOutput: dh1)
        state.ckr = newCKr
        state.rk  = rk1

        // Generate fresh sending keypair, derive new sending chain
        let newKP = P384.KeyAgreement.PrivateKey()
        let dh2   = try newKP.sharedSecretFromKeyAgreement(with: theirPub)
        let (rk2, newCKs) = kdfRK(rootKey: rk1, dhOutput: dh2)
        state.dhsPriv = newKP.rawRepresentation
        state.dhsPub  = newKP.publicKey.rawRepresentation
        state.cks     = newCKs
        state.rk      = rk2
    }

    // MARK: - Skip message keys (handles out-of-order delivery)

    private static func skipMessageKeys(state: inout RatchetState, until target: UInt32) throws {
        guard let ckr = state.ckr else { return }          // no receiving chain yet — nothing to skip
        guard state.nr <= target else { return }            // already past target
        guard target - state.nr <= UInt32(maxSkip) else { throw DoubleRatchetError.tooManySkipped }

        var currentCK = ckr
        while state.nr < target {
            let (newCK, mk) = kdfCK(chainKey: currentCK)
            state.mkSkipped[skippedKeyID(dh: state.dhr ?? Data(), n: state.nr)] = mk
            currentCK = newCK
            state.nr += 1
        }
        state.ckr = currentCK
    }

    // MARK: - AES-GCM open helper

    private static func open(combined: Data, mk: Data, ad: Data) throws -> String {
        let box   = try AES.GCM.SealedBox(combined: combined)
        let plain = try AES.GCM.open(box, using: SymmetricKey(data: mk), authenticating: ad)
        guard let str = String(data: plain, encoding: .utf8) else {
            throw DoubleRatchetError.decodingFailed
        }
        return str
    }

    // MARK: - Keychain key helper

    private static func storeKey(_ id: Int) -> String {
        "\(Config.Keychain.privateKeyTag).dr.\(id)"
    }

    private static func skippedKeyID(dh: Data, n: UInt32) -> String {
        "\(dh.base64EncodedString()):\(n)"
    }
}

// MARK: - Errors

enum DoubleRatchetError: LocalizedError {
    case noSendingChain
    case noReceivingChain
    case tooManySkipped
    case invalidFormat
    case sealFailed
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .noSendingChain:   return "No sending chain — key exchange not yet complete"
        case .noReceivingChain: return "No receiving chain established"
        case .tooManySkipped:   return "Too many skipped messages (limit: 100)"
        case .invalidFormat:    return "Invalid Double Ratchet message format"
        case .sealFailed:       return "AES-GCM seal failed"
        case .decodingFailed:   return "Failed to decode decrypted plaintext"
        }
    }
}
