/**
 * SYNAPTYC — Signal Protocol E2EE
 * X3DH + Double Ratchet + Sender Keys
 *
 * Primitives:
 *   • X25519 DH key exchange   — tweetnacl nacl.box
 *   • XSalsa20-Poly1305        — tweetnacl nacl.secretbox (message encryption)
 *   • HMAC-SHA256 / HKDF       — @noble/hashes
 *   • Random bytes             — tweetnacl nacl.randomBytes
 *
 * Wire format — DM:
 *   { sig: true, v: 1, hdr: <base64 header>, ct: <base64 ciphertext> }
 * Wire format — Group:
 *   { gsig: true, v: 1, sid: <sender_id>, hdr: <base64>, ct: <base64> }
 *
 * Header contains: { spk: senderDH_pk_b64, n: msgIdx, pn: prevChainLen }
 *   (headers themselves are plaintext; content is confidential via Double Ratchet)
 */

'use strict';

// eslint-disable-next-line import/no-commonjs
const nacl     = require('tweetnacl');
// eslint-disable-next-line import/no-commonjs
const naclUtil = require('tweetnacl-util');

// @noble/hashes — pure-JS, no native code
// eslint-disable-next-line import/no-commonjs
const { hmac }       = require('@noble/hashes/hmac');
// eslint-disable-next-line import/no-commonjs
const { sha256 }     = require('@noble/hashes/sha2');
// eslint-disable-next-line import/no-commonjs
const { hkdf }       = require('@noble/hashes/hkdf');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const b64enc = (buf) => naclUtil.encodeBase64(buf);
const b64dec = (str) => naclUtil.decodeBase64(str);
const utf8enc = (str) => naclUtil.decodeUTF8(str);
const utf8dec = (buf) => naclUtil.encodeUTF8(buf);

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out   = new Uint8Array(total);
  let   off   = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// HKDF-SHA256: IKM + salt + info → N bytes
function kdfHKDF(ikm, salt, info, length) {
  return hkdf(sha256, ikm, salt, info instanceof Uint8Array ? info : utf8enc(info), length);
}

// HMAC-SHA256(key, data) → 32 bytes
function hmacSHA256(key, data) {
  return hmac(sha256, key, data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Double Ratchet KDF functions
// ─────────────────────────────────────────────────────────────────────────────

const DR_INFO_ROOT  = utf8enc('SYNAPTYC_DR_ROOT');
const DR_INFO_CHAIN = utf8enc('SYNAPTYC_DR_CHAIN');
const DR_INFO_MSG   = utf8enc('SYNAPTYC_DR_MSG');
const X3DH_INFO     = utf8enc('SYNAPTYC_X3DH');
const SK_INFO       = utf8enc('SYNAPTYC_SENDER_KEY');

/**
 * KDF_RK — called on DH ratchet step.
 * Returns [new_root_key (32B), new_chain_key (32B)]
 */
function kdfRK(rootKey, dhOutput) {
  const okm  = kdfHKDF(dhOutput, rootKey, DR_INFO_ROOT, 64);
  return [okm.slice(0, 32), okm.slice(32, 64)];
}

/**
 * KDF_CK — called per message.
 * Returns [new_chain_key (32B), message_key (32B)]
 */
function kdfCK(chainKey) {
  const msgKey   = hmacSHA256(chainKey, new Uint8Array([0x01]));
  const nextChain = hmacSHA256(chainKey, new Uint8Array([0x02]));
  return [new Uint8Array(nextChain), new Uint8Array(msgKey)];
}

// ─────────────────────────────────────────────────────────────────────────────
// X3DH key agreement helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Curve25519 DH between my secret key and their public key.
 * Returns 32-byte shared secret.
 */
function dh(mySecretKey, theirPublicKey) {
  // nacl.box uses X25519 internally — expose shared key via scalarMult
  return nacl.scalarMult(mySecretKey, theirPublicKey);
}

/**
 * X3DH session initiator (Alice → Bob).
 *
 * @param {Uint8Array} IK_A_sec   Alice identity secret key
 * @param {Uint8Array} EK_A_sec   Alice ephemeral secret key
 * @param {Uint8Array} IK_B_pub   Bob identity public key
 * @param {Uint8Array} SPK_B_pub  Bob signed pre-key public key
 * @param {Uint8Array} OPK_B_pub  Bob one-time pre-key public key (may be null)
 * @returns {Uint8Array} 32-byte shared key (SK)
 */
function x3dhInitiator(IK_A_sec, EK_A_sec, IK_B_pub, SPK_B_pub, OPK_B_pub) {
  const dh1 = dh(IK_A_sec,  SPK_B_pub);  // DH(IK_A, SPK_B)
  const dh2 = dh(EK_A_sec,  IK_B_pub);   // DH(EK_A, IK_B)
  const dh3 = dh(EK_A_sec,  SPK_B_pub);  // DH(EK_A, SPK_B)
  const parts = OPK_B_pub
    ? concat(dh1, dh2, dh3, dh(EK_A_sec, OPK_B_pub))  // + DH(EK_A, OPK_B)
    : concat(dh1, dh2, dh3);
  const salt = new Uint8Array(32);  // zero salt
  return new Uint8Array(kdfHKDF(parts, salt, X3DH_INFO, 32));
}

/**
 * X3DH session responder (Bob ← Alice's message).
 *
 * @param {Uint8Array} IK_B_sec   Bob identity secret key
 * @param {Uint8Array} SPK_B_sec  Bob signed pre-key secret key
 * @param {Uint8Array} OPK_B_sec  Bob one-time pre-key secret key (may be null)
 * @param {Uint8Array} IK_A_pub   Alice identity public key
 * @param {Uint8Array} EK_A_pub   Alice ephemeral public key
 * @returns {Uint8Array} 32-byte shared key (SK)
 */
function x3dhResponder(IK_B_sec, SPK_B_sec, OPK_B_sec, IK_A_pub, EK_A_pub) {
  const dh1 = dh(SPK_B_sec,  IK_A_pub);   // DH(SPK_B, IK_A)
  const dh2 = dh(IK_B_sec,   EK_A_pub);   // DH(IK_B,  EK_A)
  const dh3 = dh(SPK_B_sec,  EK_A_pub);   // DH(SPK_B, EK_A)
  const parts = OPK_B_sec
    ? concat(dh1, dh2, dh3, dh(OPK_B_sec, EK_A_pub))  // + DH(OPK_B, EK_A)
    : concat(dh1, dh2, dh3);
  const salt = new Uint8Array(32);
  return new Uint8Array(kdfHKDF(parts, salt, X3DH_INFO, 32));
}

// ─────────────────────────────────────────────────────────────────────────────
// Double Ratchet state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise a Double Ratchet session for the SENDER after X3DH.
 * The sender starts with DHs (their ratchet key pair) and DHr (receiver's ratchet pk).
 */
function drInitSender(SK, receiverRatchetPk) {
  const DHs = nacl.box.keyPair();            // fresh ratchet key pair
  const [RK, CKs] = kdfRK(SK, dh(DHs.secretKey, receiverRatchetPk));
  return {
    RK,
    CKs,
    CKr:  null,
    Ns:   0,
    Nr:   0,
    PN:   0,
    DHs:  { publicKey: DHs.publicKey, secretKey: DHs.secretKey },
    DHr:  receiverRatchetPk,
    skipped: {},  // { "<dhrB64>_<n>": messageKey }
  };
}

/**
 * Initialise a Double Ratchet session for the RECEIVER after X3DH.
 * The receiver starts knowing SK and their own ratchet key (which is SPK_B).
 */
function drInitReceiver(SK, receiverRatchetKeyPair) {
  return {
    RK:   SK,
    CKs:  null,
    CKr:  null,
    Ns:   0,
    Nr:   0,
    PN:   0,
    DHs:  { publicKey: receiverRatchetKeyPair.publicKey,
            secretKey: receiverRatchetKeyPair.secretKey },
    DHr:  null,
    skipped: {},
  };
}

/**
 * Encrypt a message with the Double Ratchet.
 * Returns { header, ciphertext } where header = { spk, n, pn }
 */
function drEncrypt(session, plaintext) {
  const [newCKs, mk] = kdfCK(session.CKs);
  session.CKs = newCKs;

  const header = {
    spk: b64enc(session.DHs.publicKey),
    n:   session.Ns,
    pn:  session.PN,
  };
  session.Ns += 1;

  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ct    = nacl.secretbox(utf8enc(JSON.stringify({ p: plaintext })), nonce, mk);

  return {
    header,
    ciphertext: b64enc(concat(nonce, ct)),
  };
}

/**
 * Decrypt a message with the Double Ratchet.
 * Returns plaintext string or null on failure.
 */
function drDecrypt(session, header, ciphertextB64) {
  // Check skipped message keys first
  const skipKey = `${header.spk}_${header.n}`;
  if (session.skipped[skipKey]) {
    const mk  = session.skipped[skipKey];
    delete session.skipped[skipKey];
    return _drDecryptWithKey(mk, ciphertextB64);
  }

  const senderPk = b64dec(header.spk);

  // Check if we need a DH ratchet step
  if (!session.DHr || !_arraysEqual(session.DHr, senderPk)) {
    // Skip messages in current receiving chain
    if (session.DHr) {
      _skipMessageKeys(session, header.pn);
    }
    _dhRatchetStep(session, senderPk);
  }

  // Skip messages in new receiving chain
  _skipMessageKeys(session, header.n);

  // Decrypt current message
  const [newCKr, mk] = kdfCK(session.CKr);
  session.CKr = newCKr;
  session.Nr  += 1;

  return _drDecryptWithKey(mk, ciphertextB64);
}

function _dhRatchetStep(session, theirNewPk) {
  session.PN = session.Ns;
  session.Ns = 0;
  session.Nr = 0;
  session.DHr = theirNewPk;

  // Receiving ratchet
  const [newRK1, newCKr] = kdfRK(session.RK, dh(session.DHs.secretKey, theirNewPk));
  session.RK  = newRK1;
  session.CKr = newCKr;

  // Sending ratchet with a fresh DHs
  const newDHs = nacl.box.keyPair();
  const [newRK2, newCKs] = kdfRK(newRK1, dh(newDHs.secretKey, theirNewPk));
  session.RK  = newRK2;
  session.CKs = newCKs;
  session.DHs = { publicKey: newDHs.publicKey, secretKey: newDHs.secretKey };
}

function _skipMessageKeys(session, until) {
  const MAX_SKIP = 1000;
  if (session.Nr + MAX_SKIP < until) return;  // safety: don't skip too many
  while (session.Nr < until) {
    const [newCKr, mk] = kdfCK(session.CKr);
    session.CKr = newCKr;
    const skipKey = `${b64enc(session.DHr)}_${session.Nr}`;
    session.skipped[skipKey] = mk;
    session.Nr += 1;
  }
  // Prune oldest skipped keys if map exceeds limit (prevent unbounded memory growth)
  const keys = Object.keys(session.skipped);
  if (keys.length > MAX_SKIP) {
    const toRemove = keys.length - MAX_SKIP;
    for (let i = 0; i < toRemove; i++) delete session.skipped[keys[i]];
  }
}

function _drDecryptWithKey(mk, ciphertextB64) {
  try {
    const raw   = b64dec(ciphertextB64);
    const nonce = raw.slice(0, nacl.secretbox.nonceLength);
    const ct    = raw.slice(nacl.secretbox.nonceLength);
    const plain = nacl.secretbox.open(ct, nonce, mk);
    if (!plain) return null;
    const obj = JSON.parse(utf8dec(plain));
    return obj.p;
  } catch (_) {
    return null;
  }
}

function _arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sender Keys — group encryption (Signal-style)
// ─────────────────────────────────────────────────────────────────────────────

// Maximum iteration value — must fit in uint32 LE wire encoding (4 bytes)
const SK_MAX_ITERATION = 0xFFFFFFFF;  // 2^32 - 1
// Maximum number of out-of-order message keys to cache per sender key.
// Must be large enough for active groups where a member is offline for extended periods.
// 10000 iterations × ~10ms HMAC = ~100ms to advance on mobile — acceptable.
const SK_MAX_SKIP = 10000;

/**
 * Generate a fresh sender key chain state for a group.
 * Returns { chainKey: Uint8Array, iteration: number, skipped: {} }
 */
function skGenerate() {
  return {
    chainKey:  nacl.randomBytes(32),
    iteration: 0,
    skipped:   {},  // { "<iteration>": messageKey (Uint8Array) }
  };
}

/**
 * Derive the message key for the current iteration, advance chain.
 * Returns [newChainState, messageKey (32B)]
 * Throws if iteration would exceed uint32 max (caller must regenerate key).
 */
function skAdvance(senderKeyState) {
  if (senderKeyState.iteration >= SK_MAX_ITERATION) {
    throw new Error('Sender key iteration overflow — must regenerate key');
  }
  const mk      = new Uint8Array(hmacSHA256(senderKeyState.chainKey, new Uint8Array([0x01])));
  const newCK   = new Uint8Array(hmacSHA256(senderKeyState.chainKey, new Uint8Array([0x02])));
  return [
    { chainKey: newCK, iteration: senderKeyState.iteration + 1, skipped: senderKeyState.skipped || {} },
    mk,
  ];
}

/**
 * Advance sender key state N times (to catch up to a given iteration).
 * Caches intermediate message keys for out-of-order decryption.
 * Returns [finalChainState, messageKey_at_target]
 */
function skAdvanceTo(senderKeyState, targetIteration) {
  // Guard: prevent advancing past uint32 max
  if (targetIteration > SK_MAX_ITERATION) return [senderKeyState, null];
  // Guard: prevent excessive skip (DoS protection)
  const gap = targetIteration - senderKeyState.iteration;
  if (gap > SK_MAX_SKIP) return [senderKeyState, null];

  let state = { ...senderKeyState, skipped: { ...(senderKeyState.skipped || {}) } };
  let mk    = null;
  while (state.iteration <= targetIteration) {
    [state, mk] = skAdvance(state);
    // Cache intermediate keys (all except the target itself)
    if (state.iteration - 1 < targetIteration) {
      state.skipped[String(state.iteration - 1)] = mk;
    }
  }

  // Prune oldest skipped keys if map exceeds limit
  const keys = Object.keys(state.skipped);
  if (keys.length > SK_MAX_SKIP) {
    // Sort numerically and remove oldest
    keys.sort((a, b) => Number(a) - Number(b));
    const toRemove = keys.length - SK_MAX_SKIP;
    for (let i = 0; i < toRemove; i++) delete state.skipped[keys[i]];
  }

  return [state, mk];
}

/**
 * Encrypt a group message with the sender key.
 * Returns wire envelope object.
 * Returns null if the sender key needs regeneration (iteration overflow).
 */
function skEncrypt(senderKeyState, plaintext, senderId) {
  if (senderKeyState.iteration >= SK_MAX_ITERATION) {
    return null;  // Caller must regenerate and redistribute sender key
  }
  const [newState, mk] = skAdvance(senderKeyState);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ct    = nacl.secretbox(utf8enc(plaintext), nonce, mk);
  // Encode iteration as uint32 LE explicitly (endian-safe — matches skDecrypt's LE read)
  const iterBuf = new ArrayBuffer(4);
  new DataView(iterBuf).setUint32(0, senderKeyState.iteration, true);
  return {
    newState,
    envelope: {
      gsig: true,
      v:    1,
      sid:  senderId,
      hdr:  b64enc(new Uint8Array(iterBuf)),
      ct:   b64enc(concat(nonce, ct)),
    },
  };
}

/**
 * Decrypt a group message.
 * Returns { plaintext, newSenderKeyState } or null.
 * Supports out-of-order messages via skipped key cache.
 */
function skDecrypt(senderKeyState, envelope) {
  try {
    const hdrBytes = b64dec(envelope.hdr);
    // Support both old 1-byte and new 4-byte (uint32 LE) iteration headers
    const iteration = hdrBytes.length >= 4
      ? new DataView(hdrBytes.buffer, hdrBytes.byteOffset, 4).getUint32(0, true)
      : hdrBytes[0];

    // Ensure skipped cache exists (backward compat with old serialised states)
    const skipped = senderKeyState.skipped || {};

    // Check skipped-key cache first (out-of-order message)
    const skipKey = String(iteration);
    if (skipped[skipKey]) {
      const cachedMk = skipped[skipKey];
      const raw   = b64dec(envelope.ct);
      const nonce = raw.slice(0, nacl.secretbox.nonceLength);
      const ct    = raw.slice(nacl.secretbox.nonceLength);
      const plain = nacl.secretbox.open(ct, nonce, cachedMk);
      if (!plain) return null;
      // Remove used key from cache
      const newSkipped = { ...skipped };
      delete newSkipped[skipKey];
      return {
        plaintext: utf8dec(plain),
        newSenderKeyState: { ...senderKeyState, skipped: newSkipped },
      };
    }

    // Forward advance — cache intermediate keys
    if (senderKeyState.iteration <= iteration) {
      const [state, mk] = skAdvanceTo(senderKeyState, iteration);
      if (!mk) return null;  // gap too large or overflow

      const raw   = b64dec(envelope.ct);
      const nonce = raw.slice(0, nacl.secretbox.nonceLength);
      const ct    = raw.slice(nacl.secretbox.nonceLength);
      const plain = nacl.secretbox.open(ct, nonce, mk);
      if (!plain) return null;
      return { plaintext: utf8dec(plain), newSenderKeyState: state };
    }

    // Iteration is behind current state and not in skip cache — truly lost
    return null;
  } catch (_) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session serialisation (for SecureStore)
// ─────────────────────────────────────────────────────────────────────────────

function serialiseSession(session) {
  const obj = {
    RK:      b64enc(session.RK),
    CKs:     session.CKs ? b64enc(session.CKs) : null,
    CKr:     session.CKr ? b64enc(session.CKr) : null,
    Ns:      session.Ns,
    Nr:      session.Nr,
    PN:      session.PN,
    DHs_pub: b64enc(session.DHs.publicKey),
    DHs_sec: b64enc(session.DHs.secretKey),
    DHr:     session.DHr ? b64enc(session.DHr) : null,
    skipped: Object.fromEntries(
      Object.entries(session.skipped).map(([k, v]) => [k, b64enc(v)])
    ),
  };
  // Persist x3dh metadata so it survives app restarts — needed for session recovery
  if (session._x3dh) obj._x3dh = session._x3dh;
  return JSON.stringify(obj);
}

function deserialiseSession(json) {
  const d = JSON.parse(json);
  const sess = {
    RK:   b64dec(d.RK),
    CKs:  d.CKs ? b64dec(d.CKs) : null,
    CKr:  d.CKr ? b64dec(d.CKr) : null,
    Ns:   d.Ns,
    Nr:   d.Nr,
    PN:   d.PN,
    DHs:  { publicKey: b64dec(d.DHs_pub), secretKey: b64dec(d.DHs_sec) },
    DHr:  d.DHr ? b64dec(d.DHr) : null,
    skipped: Object.fromEntries(
      Object.entries(d.skipped || {}).map(([k, v]) => [k, b64dec(v)])
    ),
  };
  if (d._x3dh) sess._x3dh = d._x3dh;
  return sess;
}

function serialiseSKState(state) {
  const obj = { chainKey: b64enc(state.chainKey), iteration: state.iteration };
  // Persist skipped key cache for out-of-order message support
  if (state.skipped && Object.keys(state.skipped).length > 0) {
    obj.skipped = Object.fromEntries(
      Object.entries(state.skipped).map(([k, v]) => [k, b64enc(v)])
    );
  }
  return JSON.stringify(obj);
}

function deserialiseSKState(json) {
  const d = JSON.parse(json);
  const state = { chainKey: b64dec(d.chainKey), iteration: d.iteration };
  // Restore skipped key cache (backward compat: old states won't have this field)
  state.skipped = {};
  if (d.skipped) {
    state.skipped = Object.fromEntries(
      Object.entries(d.skipped).map(([k, v]) => [k, b64dec(v)])
    );
  }
  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Envelope detection
// ─────────────────────────────────────────────────────────────────────────────

function isSignalDM(content) {
  try { const o = JSON.parse(content); return o?.sig === true && o?.v === 1 && typeof o?.hdr === 'string' && typeof o?.ct === 'string'; } catch { return false; }
}

function isSignalGroup(content) {
  try { const o = JSON.parse(content); return o?.gsig === true && o?.v === 1 && typeof o?.sid === 'string' && typeof o?.hdr === 'string' && typeof o?.ct === 'string'; } catch { return false; }
}

// Legacy NaCl DM detection (for backward-compat decryption)
function isLegacyNaClDM(content) {
  try { const o = JSON.parse(content); return o?.enc != null && typeof o?.nonce === 'string'; } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // X3DH
  x3dhInitiator,
  x3dhResponder,
  // Double Ratchet
  drInitSender,
  drInitReceiver,
  drEncrypt,
  drDecrypt,
  // Sender Keys
  skGenerate,
  skEncrypt,
  skDecrypt,
  // Serialisation
  serialiseSession,
  deserialiseSession,
  serialiseSKState,
  deserialiseSKState,
  // Envelope detection
  isSignalDM,
  isSignalGroup,
  isLegacyNaClDM,
  // Utils
  b64enc,
  b64dec,
};
