# SYNAPTYC E2EE Security Audit & Enhancement Report

**Date:** 2026-03-01
**Scope:** Evaluate four proposed security enhancements against the current architecture
**Platform:** React Native (Expo SDK 54, Hermes JS engine)

---

## Current Architecture Summary

SYNAPTYC implements a custom Signal Protocol (X3DH + Double Ratchet + Sender Keys) using:
- **tweetnacl** — X25519 DH, XSalsa20-Poly1305 AEAD encryption
- **@noble/hashes** — HMAC-SHA256, HKDF-SHA256
- **expo-secure-store** — key persistence (identity keys, sessions, sender keys)
- **op-sqlite with SQLCipher** — encrypted local message database

Wire formats:
- DM: `{ sig: true, v: 1, hdr: "<JSON header>", ct: "<base64 ciphertext>" }`
- Group: `{ gsig: true, v: 1, sid: "<sender_id>", hdr: "<iteration>", ct: "<base64>" }`

Server sees: sender ID, recipient ID, group ID, timestamps, display names, message size. Server never sees plaintext.

---

## 1. Replace Custom Crypto with libsignal or libsodium

### Current State

The Signal Protocol is implemented from scratch in `src/signal_protocol.js` (~470 lines) using tweetnacl + @noble/hashes. This includes:
- X3DH key agreement (initiator + responder)
- Double Ratchet with DH ratchet steps, chain key KDF, skipped message keys (MAX_SKIP=1000)
- Sender Keys with HMAC-based chain ratchet
- Custom HKDF info strings (`SYNAPTYC_DR_ROOT`, `SYNAPTYC_X3DH`, etc.)
- Custom wire format (JSON, not protobuf)

### Option A: @signalapp/libsignal-client (Signal's Official Library)

**Verdict: Not viable for Expo/Hermes today.**

| Aspect | Detail |
|--------|--------|
| Language | Rust with Node-API (NAPI) bindings |
| RN Support | None — Hermes does not support NAPI |
| Expo Support | `expo-libsignal-client` exists but is abandoned (0 weekly downloads) |
| Workaround | Build custom JSI/Turbo Module bindings via Rust cross-compilation |

**Pros:**
- Battle-tested by Signal (billions of messages)
- Maintained by professional cryptographers
- Covers the entire protocol (X3DH, Double Ratchet, Sealed Sender, Sender Keys, Groups v2)
- Regular security audits

**Cons:**
- Does not work with Hermes/Expo — requires building custom native bindings from Rust
- Estimated 4-6 weeks of native module development for iOS + Android
- Expo config plugin required; breaks Expo Go (already broken for us — using EAS Build)
- Would need to migrate all existing sessions (breaking change for current users)
- Ongoing maintenance burden keeping Rust bindings in sync with upstream releases

**Effort: 4-6 weeks** (native Rust-to-JSI bridge + session migration + testing)

### Option B: react-native-libsodium (Replace Primitives Only)

**Verdict: Viable but marginal benefit.**

| Aspect | Detail |
|--------|--------|
| Package | `react-native-libsodium` by serenity-kit |
| Expo Support | Yes — has Expo config plugin |
| Hermes Support | Yes — native module, not NAPI |
| API | Subset of libsodium-wrappers (crypto_box, crypto_secretbox, crypto_sign, crypto_kdf, crypto_aead) |

**Pros:**
- Native C implementation = faster than pure-JS tweetnacl
- Well-audited libsodium underneath (djb's NaCl + extras)
- Adds Ed25519 signatures (tweetnacl only has nacl.sign, which is fine)
- Adds XChaCha20-Poly1305 AEAD (slightly more modern than XSalsa20)
- Expo plugin integration

**Cons:**
- tweetnacl already uses the same algorithms (Curve25519, XSalsa20-Poly1305) — same security level
- Adding a native dependency for marginal crypto improvement
- Our Double Ratchet / X3DH logic stays custom regardless — libsodium is just primitives
- Performance difference is negligible for messaging workloads (we encrypt individual messages, not bulk data)
- Risk of introducing new bugs during migration for no security gain

**Effort: 1-2 weeks** (swap import, test all crypto paths, EAS build verification)

### Option C: Keep Current Implementation + Harden

**Verdict: Recommended path.**

| Aspect | Detail |
|--------|--------|
| Changes | Fix known bugs, add tests, document deviations from Signal spec |
| Dependencies | None — already using audited primitives (tweetnacl, @noble/hashes) |

**Pros:**
- tweetnacl IS djb's NaCl — same crypto as libsodium, just pure JS
- @noble/hashes is audited, widely used, pure JS
- No new native dependencies to maintain
- Zero migration risk for existing users
- Custom implementation allows full control over wire format and protocol behavior
- Already working and shipping

**Cons:**
- Custom protocol code is harder to audit than a well-known library
- No independent security audit of the protocol implementation (only the primitives are audited)
- Deviations from Signal spec (custom HKDF info strings, JSON wire format vs protobuf) mean we can't claim "Signal Protocol compatible"
- Bugs in protocol logic (like the 6 we just fixed) are our responsibility to find

**Effort: 1 week** (add unit tests for all crypto functions, document spec deviations)

### Recommendation

**Keep tweetnacl + @noble/hashes. Invest in testing and an independent audit instead.**

The cryptographic primitives are sound — they are the same algorithms used by libsodium. The risk is in the protocol logic (Double Ratchet state management, key derivation, session handling), which would remain custom regardless of which primitive library we use. The right investment is:
1. Comprehensive unit tests for signal_protocol.js
2. An independent security audit of the protocol implementation (~$5-15K for a focused review)
3. Document all deviations from the Signal Protocol specification

---

## 2. Key Verification (Safety Numbers / QR Codes)

### What It Is

Key verification lets two users confirm they share the same view of each other's identity keys, proving no MITM is intercepting their messages. Signal implements this as "Safety Numbers" — a 60-digit numeric code or QR code derived from both users' identity keys.

### Current State

SYNAPTYC has **no key verification mechanism**. Users have no way to confirm they are communicating with the right person (beyond trusting the server's key distribution).

### How Signal Does It

```
Safety Number = SHA-512(
  Version || User A Identity Key || User A Identifier ||
  User B Identity Key || User B Identifier
) → truncated to 60 digits (6 groups of 5)
```

Each user computes the number independently. If both see the same number, no MITM exists. A QR code encodes the same data for easy scanning.

### Implementation Plan

**Frontend changes (App.js):**
1. Add `computeSafetyNumber(myIdentityKey, myUserId, peerIdentityKey, peerUserId)` function
2. New "Verify Identity" button in DM chat header → shows 60-digit number + QR code
3. QR scanning via `expo-camera` (already available in Expo SDK 54)
4. Visual indicator (checkmark/shield icon) for verified contacts
5. Alert when a contact's identity key changes (key change notification)

**Backend changes:**
- None required — verification is fully client-side

**Dependencies:**
- QR generation: `react-native-qrcode-svg` (pure JS, works with Expo)
- QR scanning: `expo-camera` with `BarCodeScanner` (already in Expo)

**Pros:**
- Strong protection against MITM attacks (server compromise, key substitution)
- Industry standard — users of Signal/WhatsApp already understand this concept
- Fully client-side — no backend changes needed
- Builds user trust in the E2EE system
- Required for any serious security messaging claim

**Cons:**
- UX friction — most users won't verify (Signal reports < 5% of users verify)
- Key change notifications can be confusing for non-technical users
- Need to handle legitimate key changes (new device, reinstall) vs malicious changes
- QR scanning requires camera permission (may not always be convenient)
- Need persistent storage for "verified" status per contact

**Effort: 1-2 weeks**

| Task | Time |
|------|------|
| Safety number computation function | 2 hours |
| Verification UI (number display + QR) | 2-3 days |
| QR scanning integration | 1 day |
| Key change detection + notifications | 2-3 days |
| Verified status storage + visual indicators | 1 day |
| Testing | 1-2 days |

### Recommendation

**Implement this. High security value, moderate effort, no backend changes.**

This is the single most impactful security feature missing from SYNAPTYC. Without it, the server (or anyone who compromises the server) can substitute identity keys and MITM all conversations. Start with the numeric safety number display; add QR scanning as a follow-up.

---

## 3. Sealed Sender (Metadata Protection)

### What It Is

Sealed sender hides the sender's identity from the server. Currently the server sees who sends each message (via the JWT auth token and `from_user` field). With sealed sender, the server only knows the recipient — the sender is encrypted inside the message envelope.

### Current Metadata Exposure

The server currently sees for every message:
- **Sender ID** (from JWT token + `from_user` field)
- **Recipient ID** (DM: `to` field; Group: `group_id`)
- **Timestamp** (server-assigned `created_at`)
- **Message size** (encrypted payload length)
- **Online status** (WebSocket connection implies online)
- **Display name / username** (sent in message metadata)

### How Signal Implements It

1. **Sender Certificate**: Server issues short-lived certificates (sender ID + identity key + signature + expiry)
2. **Delivery Token**: Derived from profile key (shared only with contacts), registered with server
3. **Double Encryption**: Message encrypted with Signal Protocol, then outer envelope encrypted with recipient's identity key
4. **Anonymous Submission**: Message sent to server without auth, validated only by delivery token
5. **Recipient Decrypts**: Outer layer reveals sender identity, inner layer reveals plaintext

### Implementation Requirements

**Backend (Elixir/Phoenix):**
1. Sender certificate signing service (Ed25519 server signing key)
2. Certificate issuance endpoint (short-lived, ~24h expiry)
3. Delivery token registration and validation
4. Anonymous message submission endpoint (no JWT required)
5. Anti-abuse rate limiting on anonymous endpoint (IP-based)
6. Separate message delivery path (token-validated, not auth-validated)

**Frontend (App.js):**
1. Profile key generation and distribution to contacts
2. Delivery token derivation (HMAC of profile key + user ID)
3. Sender certificate fetching and caching
4. Double-layer encryption (inner: Signal Protocol, outer: nacl.box with recipient IK)
5. Anonymous WebSocket or HTTP submission path
6. Recipient-side: outer decryption, certificate validation, inner decryption

**Pros:**
- Significantly reduces metadata exposure — server can't build social graph from message flows
- Industry-leading privacy feature (only Signal and a few others implement this)
- Strong differentiator for a privacy-focused messaging app
- Protects against server compromise revealing communication patterns

**Cons:**
- Very complex implementation (Signal spent months on this)
- Requires significant backend changes (new endpoints, new auth model, certificate infrastructure)
- Anonymous submission endpoint is an abuse vector (spam, DoS) — needs careful rate limiting
- Certificate infrastructure adds operational complexity (key rotation, revocation)
- Only protects sender identity — server still sees recipient, timing, and message size
- Profile key distribution adds another key management layer
- Breaking change — old clients can't receive sealed-sender messages
- Marginal benefit if the server is trusted (we control the server)

**Effort: 6-10 weeks**

| Task | Time |
|------|------|
| Server signing key infrastructure | 1 week |
| Certificate issuance endpoint | 3-4 days |
| Profile key system (generation, distribution, storage) | 1 week |
| Delivery token system (derivation, registration, validation) | 3-4 days |
| Anonymous submission endpoint + anti-abuse | 1 week |
| Frontend double-encryption layer | 1 week |
| Frontend certificate management | 3-4 days |
| WebSocket anonymous path | 1 week |
| Migration strategy for existing conversations | 3-4 days |
| Testing (end-to-end, abuse scenarios, key rotation) | 1-2 weeks |

### Recommendation

**Defer to Phase 2. High complexity, moderate security benefit for a small user base.**

Sealed sender is valuable when the server is a significant threat actor or when legal compulsion to reveal communication patterns is a concern. For a startup-stage app with a controlled server, the threat model doesn't justify the 6-10 week investment yet. Implement key verification first — it protects against a more immediate threat (MITM via server key substitution).

If implementing later, consider a simplified version first: encrypt the sender ID inside the E2EE envelope (so the server can't read it from the message content), even if the JWT still identifies the sender at the transport layer. This gives partial protection with ~1 week of work.

---

## 4. TLS Certificate Pinning

### What It Is

Certificate pinning ensures the app only trusts specific TLS certificates (or public keys) for your server, preventing network-level MITM attacks even if an attacker has a valid CA-signed certificate (e.g., corporate proxy, compromised CA, government interception).

### Current State

SYNAPTYC relies entirely on the OS certificate store for TLS validation. All `fetch()` and WebSocket connections to `nano-synapsys-server.fly.dev` trust any certificate signed by any CA in the device's trust store.

### Available Libraries for Expo

| Library | Expo Compatible | Setup |
|---------|----------------|-------|
| `react-native-ssl-public-key-pinning` | Yes (with dev build) | JS-only config, no native setup |
| `@bam.tech/react-native-ssl-pinning` | Yes (Expo config plugin) | Plugin-based, more Expo-native |

Both use TrustKit (iOS) and OkHttp CertificatePinner (Android) under the hood.

### Implementation Plan

**Using `react-native-ssl-public-key-pinning` (simplest):**

```javascript
// In App.js initialization
import { initializeSslPinning } from 'react-native-ssl-public-key-pinning';

await initializeSslPinning({
  'nano-synapsys-server.fly.dev': {
    includeSubdomains: true,
    publicKeyHashes: [
      'CURRENT_CERT_SHA256_HASH_BASE64',
      'BACKUP_CERT_SHA256_HASH_BASE64',  // Required by TrustKit on iOS
    ],
  },
});
```

**Operational requirements:**
1. Extract current server certificate's SPKI SHA-256 hash
2. Generate or identify a backup certificate hash
3. Plan certificate rotation strategy (pins must be updated before cert expires)
4. OTA update mechanism for pin rotation (or ship new binary before cert expires)

**Fly.dev consideration:** Fly.dev manages TLS certificates automatically (Let's Encrypt). Certificates rotate every 90 days. This means:
- You must pin the **public key** (SPKI hash), not the certificate itself
- If Fly.dev rotates the underlying key pair, pins break → app can't connect
- You need a strategy for handling pin failures gracefully (fallback? force update?)

**Pros:**
- Prevents network-level MITM (corporate proxies, compromised CAs, Wi-Fi attacks)
- Relatively simple to implement (~1-2 days of code)
- Industry best practice for apps handling sensitive data
- Protects the TLS layer that all E2EE key exchange depends on

**Cons:**
- **Fly.dev certificate rotation is a significant operational risk** — if the server's public key changes and the app has the old pin, ALL users are locked out until they update the app
- No OTA pin updates with Expo (pins are baked into the binary) — requires app store update to rotate
- Breaks debugging/development (can't use Charles Proxy, Proxyman, etc.)
- TrustKit requires at least 2 pins on iOS (backup pin mandatory)
- Does not protect WebSocket connections on all libraries (need to verify)
- Users on older app versions with expired pins = permanent lockout
- Adds native dependency (requires custom dev build, not Expo Go)

**Effort: 3-5 days**

| Task | Time |
|------|------|
| Extract server SPKI hashes | 2 hours |
| Install and configure pinning library | 4 hours |
| Test with EAS build (iOS + Android) | 1 day |
| Certificate rotation strategy document | 4 hours |
| Graceful failure handling (error UI, force-update prompt) | 1 day |
| Verify WebSocket pinning works | 4 hours |

### Recommendation

**Implement with caution. The Fly.dev managed TLS adds operational risk.**

Certificate pinning is a best practice, but the risk of bricking all users due to a certificate rotation is real. Mitigations:
1. Pin the SPKI public key hash (survives cert renewal if key is reused)
2. Always include a backup pin
3. Implement a "pin failure" screen that directs users to update the app
4. Consider a grace period: if pinning fails, allow connection for N hours while alerting the user
5. Move to a custom domain with a certificate you control (not Fly.dev's auto-managed certs)

The safest approach: **get your own domain + certificate** (e.g., `api.synaptyc.app` with a cert you manage), then pin that key. This decouples certificate lifecycle from Fly.dev.

---

## Priority Matrix

| Enhancement | Security Impact | Effort | Risk | Priority |
|-------------|----------------|--------|------|----------|
| **Key Verification** | HIGH — prevents MITM | 1-2 weeks | Low | **P0 — Do Now** |
| **TLS Certificate Pinning** | MEDIUM — prevents network MITM | 3-5 days | Medium (cert rotation) | **P1 — Do Soon** |
| **Harden Current Crypto** (tests + audit) | MEDIUM — prevents protocol bugs | 1 week | Low | **P1 — Do Soon** |
| **Sealed Sender** | MEDIUM — reduces metadata | 6-10 weeks | High (complexity) | **P2 — Plan for Later** |
| **Replace with libsignal** | LOW (same algorithms) | 4-6 weeks | High (native bindings) | **P3 — Not Recommended** |
| **Switch to libsodium** | LOW (same algorithms) | 1-2 weeks | Low | **P3 — Not Recommended** |

---

## Summary

The current custom Signal Protocol implementation uses **sound cryptographic primitives** (tweetnacl = NaCl = same algorithms as libsodium). Replacing the primitive library provides no meaningful security improvement. The real risks are:

1. **No key verification** (P0) — the server can MITM any conversation by substituting identity keys. This is the most critical gap.
2. **No certificate pinning** (P1) — network attackers can intercept the TLS connection that all key exchange flows over.
3. **Protocol logic bugs** (P1) — the 6 bugs found and fixed this session demonstrate that custom protocol code needs thorough testing.
4. **Metadata exposure** (P2) — the server sees full communication patterns. Sealed sender would help but is a major undertaking.

The recommended order: **Key Verification → Certificate Pinning → Crypto Tests/Audit → Sealed Sender (future)**.
