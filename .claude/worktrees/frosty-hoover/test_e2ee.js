#!/usr/bin/env node
/**
 * E2EE Unit Tests for SYNAPTYC Signal Protocol implementation.
 * Run: node test_e2ee.js
 *
 * Requires a Module._resolveFilename hook because @noble/hashes exports
 * use .js extensions (e.g. ./hmac.js) but signal_protocol.js requires
 * without .js (which Metro resolves for React Native).
 */

const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('@noble/hashes/') && !request.endsWith('.js')) {
    return origResolve.call(this, request + '.js', parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};

const SIG = require('./src/signal_protocol');
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

function section(name) { console.log(`\n── ${name} ──`); }

// ─── X3DH ────────────────────────────────────────────────────────────────────

section('X3DH Key Agreement');

const IK_A = nacl.box.keyPair();  // Alice identity key
const EK_A = nacl.box.keyPair();  // Alice ephemeral key
const IK_B = nacl.box.keyPair();  // Bob identity key
const SPK_B = nacl.box.keyPair(); // Bob signed prekey
const OPK_B = nacl.box.keyPair(); // Bob one-time prekey

// With OPK
const SK_init = SIG.x3dhInitiator(IK_A.secretKey, EK_A.secretKey, IK_B.publicKey, SPK_B.publicKey, OPK_B.publicKey);
const SK_resp = SIG.x3dhResponder(IK_B.secretKey, SPK_B.secretKey, OPK_B.secretKey, IK_A.publicKey, EK_A.publicKey);

assert(SK_init.length === 32, 'X3DH initiator produces 32-byte shared secret');
assert(SK_resp.length === 32, 'X3DH responder produces 32-byte shared secret');
assert(SIG.b64enc(SK_init) === SIG.b64enc(SK_resp), 'X3DH shared secrets match (with OPK)');

// Without OPK
const SK_init_noOPK = SIG.x3dhInitiator(IK_A.secretKey, EK_A.secretKey, IK_B.publicKey, SPK_B.publicKey, null);
const SK_resp_noOPK = SIG.x3dhResponder(IK_B.secretKey, SPK_B.secretKey, null, IK_A.publicKey, EK_A.publicKey);

assert(SIG.b64enc(SK_init_noOPK) === SIG.b64enc(SK_resp_noOPK), 'X3DH shared secrets match (without OPK)');
assert(SIG.b64enc(SK_init) !== SIG.b64enc(SK_init_noOPK), 'X3DH with OPK differs from without');

// ─── Double Ratchet ──────────────────────────────────────────────────────────

section('Double Ratchet — Basic');

const sessSender = SIG.drInitSender(SK_init, SPK_B.publicKey);
const sessReceiver = SIG.drInitReceiver(SK_resp, SPK_B);

// Alice sends message 1
const { header: h1, ciphertext: ct1 } = SIG.drEncrypt(sessSender, 'Hello Bob!');
const plain1 = SIG.drDecrypt(sessReceiver, h1, ct1);
assert(plain1 === 'Hello Bob!', 'DR: Alice→Bob message 1 decrypts correctly');

// Alice sends message 2
const { header: h2, ciphertext: ct2 } = SIG.drEncrypt(sessSender, 'Second message');
const plain2 = SIG.drDecrypt(sessReceiver, h2, ct2);
assert(plain2 === 'Second message', 'DR: Alice→Bob message 2 decrypts correctly');

// Bob replies
const { header: h3, ciphertext: ct3 } = SIG.drEncrypt(sessReceiver, 'Hi Alice!');
const plain3 = SIG.drDecrypt(sessSender, h3, ct3);
assert(plain3 === 'Hi Alice!', 'DR: Bob→Alice reply decrypts correctly');

// Multiple back-and-forth
const { header: h4, ciphertext: ct4 } = SIG.drEncrypt(sessSender, 'Message 4');
const { header: h5, ciphertext: ct5 } = SIG.drEncrypt(sessSender, 'Message 5');
const plain4 = SIG.drDecrypt(sessReceiver, h4, ct4);
const plain5 = SIG.drDecrypt(sessReceiver, h5, ct5);
assert(plain4 === 'Message 4', 'DR: sequential message 4 decrypts');
assert(plain5 === 'Message 5', 'DR: sequential message 5 decrypts');

section('Double Ratchet — Out of Order');

// Fresh session for OOO test
const SK2 = SIG.x3dhInitiator(IK_A.secretKey, EK_A.secretKey, IK_B.publicKey, SPK_B.publicKey, null);
const SK2r = SIG.x3dhResponder(IK_B.secretKey, SPK_B.secretKey, null, IK_A.publicKey, EK_A.publicKey);
const oooSender = SIG.drInitSender(SK2, SPK_B.publicKey);
const oooReceiver = SIG.drInitReceiver(SK2r, SPK_B);

const { header: oH1, ciphertext: oCt1 } = SIG.drEncrypt(oooSender, 'OOO msg 1');
const { header: oH2, ciphertext: oCt2 } = SIG.drEncrypt(oooSender, 'OOO msg 2');
const { header: oH3, ciphertext: oCt3 } = SIG.drEncrypt(oooSender, 'OOO msg 3');

// Receive out of order: 3, 1, 2
const oPlain3 = SIG.drDecrypt(oooReceiver, oH3, oCt3);
assert(oPlain3 === 'OOO msg 3', 'DR: out-of-order msg 3 decrypts first');

const oPlain1 = SIG.drDecrypt(oooReceiver, oH1, oCt1);
assert(oPlain1 === 'OOO msg 1', 'DR: out-of-order msg 1 decrypts (from skipped keys)');

const oPlain2 = SIG.drDecrypt(oooReceiver, oH2, oCt2);
assert(oPlain2 === 'OOO msg 2', 'DR: out-of-order msg 2 decrypts (from skipped keys)');

section('Double Ratchet — Serialization');

const serialised = SIG.serialiseSession(sessSender);
assert(typeof serialised === 'string', 'DR: serialiseSession returns string');
const restored = SIG.deserialiseSession(serialised);
assert(restored.Ns === sessSender.Ns, 'DR: deserialized session preserves Ns');
assert(restored.Nr === sessSender.Nr, 'DR: deserialized session preserves Nr');

// Encrypt with restored session
const { header: hR, ciphertext: ctR } = SIG.drEncrypt(restored, 'After restore');
const plainR = SIG.drDecrypt(sessReceiver, hR, ctR);
assert(plainR === 'After restore', 'DR: message from restored session decrypts');

section('Double Ratchet — Replay / Wrong Key');

// Replay same message
const replayResult = SIG.drDecrypt(sessReceiver, h1, ct1);
assert(replayResult === null, 'DR: replay of already-decrypted message returns null');

// Wrong key
const fakeReceiver = SIG.drInitReceiver(nacl.randomBytes(32), SPK_B);
const wrongResult = SIG.drDecrypt(fakeReceiver, h1, ct1);
assert(wrongResult === null, 'DR: decryption with wrong key returns null');

// ─── Sender Keys ─────────────────────────────────────────────────────────────

section('Sender Keys — Basic');

const sk1 = SIG.skGenerate();
assert(sk1.chainKey.length === 32, 'SK: generates 32-byte chain key');
assert(sk1.iteration === 0, 'SK: initial iteration is 0');

// Clone state for receiver (simulates key distribution)
const sk1Receiver = { chainKey: new Uint8Array(sk1.chainKey), iteration: sk1.iteration };

// Encrypt message 1
const { newState: ns1, envelope: env1 } = SIG.skEncrypt(sk1, 'Group msg 1', 'alice');
assert(env1.gsig === true, 'SK: envelope has gsig flag');
assert(env1.sid === 'alice', 'SK: envelope has sender ID');

// Decrypt message 1
const dec1 = SIG.skDecrypt(sk1Receiver, env1);
assert(dec1 !== null, 'SK: message 1 decrypted');
assert(dec1.plaintext === 'Group msg 1', 'SK: message 1 plaintext correct');

// Message 2
const { newState: ns2, envelope: env2 } = SIG.skEncrypt(ns1, 'Group msg 2', 'alice');
const dec2 = SIG.skDecrypt(dec1.newSenderKeyState, env2);
assert(dec2 !== null, 'SK: message 2 decrypted');
assert(dec2.plaintext === 'Group msg 2', 'SK: message 2 plaintext correct');

section('Sender Keys — Iteration Handling');

// Test many messages (past the old 256 overflow point)
let encState = SIG.skGenerate();
let decState = { chainKey: new Uint8Array(encState.chainKey), iteration: encState.iteration };
let lastDecState = decState;

const testIterations = [1, 50, 100, 200, 255, 256, 257, 300];
let iterOk = true;
for (const target of testIterations) {
  while (encState.iteration < target) {
    const { newState, envelope } = SIG.skEncrypt(encState, `Msg at ${encState.iteration}`, 'test');
    encState = newState;
    const result = SIG.skDecrypt(lastDecState, envelope);
    if (!result) { iterOk = false; console.error(`  ✗ FAIL: iteration ${encState.iteration - 1} decrypt failed`); break; }
    lastDecState = result.newSenderKeyState;
  }
}
assert(iterOk, `SK: all iterations up to ${testIterations[testIterations.length - 1]} work (no overflow)`);

section('Sender Keys — Serialization');

const skSer = SIG.serialiseSKState(ns2);
assert(typeof skSer === 'string', 'SK: serialiseSKState returns string');
const skDe = SIG.deserialiseSKState(skSer);
assert(skDe.iteration === ns2.iteration, 'SK: deserialized state preserves iteration');

const { newState: ns3, envelope: env3 } = SIG.skEncrypt(skDe, 'After SK restore', 'alice');
const dec3 = SIG.skDecrypt(dec2.newSenderKeyState, env3);
assert(dec3 !== null && dec3.plaintext === 'After SK restore', 'SK: message from restored state decrypts');

// ─── Wire Format Detection ──────────────────────────────────────────────────

section('Wire Format Detection');

// Valid Signal DM
const dmEnv = JSON.stringify({ sig: true, v: 1, hdr: 'test', ct: 'test' });
assert(SIG.isSignalDM(dmEnv) === true, 'isSignalDM: detects valid DM envelope');

// Valid Signal Group
const grpEnv = JSON.stringify({ gsig: true, v: 1, sid: 'alice', hdr: 'test', ct: 'test' });
assert(SIG.isSignalGroup(grpEnv) === true, 'isSignalGroup: detects valid group envelope');

// False positive: missing required fields
const fakeDm = JSON.stringify({ sig: true, v: 1 });
assert(SIG.isSignalDM(fakeDm) === false, 'isSignalDM: rejects object without hdr/ct');

const fakeGrp = JSON.stringify({ gsig: true, v: 1 });
assert(SIG.isSignalGroup(fakeGrp) === false, 'isSignalGroup: rejects object without sid/hdr/ct');

// Legacy NaCl
const legacyEnv = JSON.stringify({ enc: 'base64cipher', nonce: 'base64nonce' });
assert(SIG.isLegacyNaClDM(legacyEnv) === true, 'isLegacyNaClDM: detects legacy envelope');

// Plain text
assert(SIG.isSignalDM('Hello world') === false, 'isSignalDM: rejects plain text');
assert(SIG.isSignalGroup('Hello world') === false, 'isSignalGroup: rejects plain text');
assert(SIG.isSignalDM('{"message": "hi"}') === false, 'isSignalDM: rejects random JSON');

// ─── HTML Unescape (simulates corrupted backend messages) ───────────────────

section('HTML Unescape — Backend Corruption Recovery');

function htmlEscape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlUnescape(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Simulate what the backend did: HTML-escape a Signal DM envelope
const originalEnv = JSON.stringify({ sig: true, v: 1, hdr: '{"spk":"abc","n":0,"pn":0}', ct: 'ciphertext' });
const corrupted = htmlEscape(originalEnv);
assert(corrupted.includes('&quot;'), 'HTML escape corrupts JSON (contains &quot;)');
assert(corrupted !== originalEnv, 'HTML escape changes the string');

// Verify JSON.parse fails on corrupted string
let parseFailed = false;
try { JSON.parse(corrupted); } catch { parseFailed = true; }
assert(parseFailed, 'JSON.parse fails on HTML-escaped envelope');

// Verify unescaping restores the original
const restored2 = htmlUnescape(corrupted);
assert(restored2 === originalEnv, 'htmlUnescape restores original envelope');

// Verify it parses correctly after unescape
const parsed = JSON.parse(restored2);
assert(parsed.sig === true && parsed.v === 1, 'Unescaped envelope parses correctly');
assert(parsed.hdr === '{"spk":"abc","n":0,"pn":0}', 'Unescaped envelope has correct hdr');

// ─── Media Encryption ────────────────────────────────────────────────────────

section('Media Encryption (nacl.secretbox)');

const MEDIA = require('./src/media');

const testImageB64 = naclUtil.encodeBase64(nacl.randomBytes(1024));  // Simulate image data

// Encrypt
const { cipherBytes, key, nonce } = MEDIA.encryptMedia(testImageB64);
assert(cipherBytes.length > 0, 'Media encrypt produces ciphertext');
assert(typeof key === 'string', 'Media encrypt returns base64 key');
assert(typeof nonce === 'string', 'Media encrypt returns base64 nonce');

// Decrypt locally (without network)
const keyBytes = naclUtil.decodeBase64(key);
const nonceBytes = naclUtil.decodeBase64(nonce);
const decrypted = nacl.secretbox.open(cipherBytes, nonceBytes, keyBytes);
assert(decrypted !== null, 'Media decrypt succeeds with correct key/nonce');
const decryptedB64 = naclUtil.encodeBase64(decrypted);
assert(decryptedB64 === testImageB64, 'Media decrypt recovers original data');

// Wrong key
const wrongKey = nacl.randomBytes(32);
const wrongDecrypt = nacl.secretbox.open(cipherBytes, nonceBytes, wrongKey);
assert(wrongDecrypt === null, 'Media decrypt fails with wrong key');

// Media payload detection
const payloadStr = MEDIA.mediaPayload('https://r2.example.com/img.enc', key, nonce);
assert(MEDIA.isMediaPayload(payloadStr), 'isMediaPayload detects media payload');
assert(!MEDIA.isMediaPayload('Hello world'), 'isMediaPayload rejects plain text');
assert(!MEDIA.isMediaPayload('{"type":"text"}'), 'isMediaPayload rejects non-media JSON');

const parsed2 = MEDIA.parseMediaPayload(payloadStr);
assert(parsed2 !== null, 'parseMediaPayload returns parsed object');
assert(parsed2.url === 'https://r2.example.com/img.enc', 'parseMediaPayload extracts URL');
assert(parsed2.key === key, 'parseMediaPayload extracts key');
assert(parsed2.nonce === nonce, 'parseMediaPayload extracts nonce');

// Backward compat: old format with 'iv' instead of 'nonce'
const oldPayload = JSON.stringify({ type: 'media', url: 'https://test.com', key: 'abc', iv: 'def' });
const parsedOld = MEDIA.parseMediaPayload(oldPayload);
assert(parsedOld !== null && parsedOld.nonce === 'def', 'parseMediaPayload handles legacy iv field');

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
