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

// MIME type support
const pngPayload = MEDIA.mediaPayload('https://r2.example.com/img.enc', key, nonce, 'image/png');
const parsedPng = MEDIA.parseMediaPayload(pngPayload);
assert(parsedPng !== null && parsedPng.mime === 'image/png', 'parseMediaPayload extracts MIME type');

// MIME default for old payloads (without mime field)
const noMimePayload = JSON.stringify({ type: 'media', url: 'https://r2.example.com/img.enc', key: 'abc', nonce: 'def' });
const parsedNoMime = MEDIA.parseMediaPayload(noMimePayload);
assert(parsedNoMime !== null && parsedNoMime.mime === 'image/jpeg', 'parseMediaPayload defaults to image/jpeg when mime absent');

// ─── Full Handshake Flow (Alice ↔ Bob real-world simulation) ─────────────────

section('Full Handshake Flow — Alice initiates to Bob');

{
  // Bob publishes his bundle (IK, SPK, OPK)
  const bobIK  = nacl.box.keyPair();
  const bobSPK = nacl.box.keyPair();
  const bobOPK = nacl.box.keyPair();

  // Alice generates her identity + ephemeral keys
  const aliceIK = nacl.box.keyPair();
  const aliceEK = nacl.box.keyPair();

  // Alice performs X3DH as initiator
  const SK_alice = SIG.x3dhInitiator(
    aliceIK.secretKey, aliceEK.secretKey,
    bobIK.publicKey, bobSPK.publicKey, bobOPK.publicKey
  );
  const aliceSess = SIG.drInitSender(SK_alice, bobSPK.publicKey);

  // Alice attaches x3dh metadata to the first message header (simulating App.js)
  const { header: firstHdr, ciphertext: firstCt } = SIG.drEncrypt(aliceSess, 'Hello Bob from Alice!');
  const x3dhMeta = {
    ik:   SIG.b64enc(aliceIK.publicKey),
    ek:   SIG.b64enc(aliceEK.publicKey),
    opk:  SIG.b64enc(bobOPK.publicKey),
  };
  const wireFirstHdr = { ...firstHdr, _x3dh: x3dhMeta };

  // Bob receives the first message — he must build session from x3dh metadata
  const SK_bob = SIG.x3dhResponder(
    bobIK.secretKey, bobSPK.secretKey, bobOPK.secretKey,
    SIG.b64dec(x3dhMeta.ik), SIG.b64dec(x3dhMeta.ek)
  );
  const bobSess = SIG.drInitReceiver(SK_bob, bobSPK);

  const firstPlain = SIG.drDecrypt(bobSess, wireFirstHdr, firstCt);
  assert(firstPlain === 'Hello Bob from Alice!', 'Handshake: first message Alice→Bob decrypts');

  // Bob replies to Alice
  const { header: replyHdr, ciphertext: replyCt } = SIG.drEncrypt(bobSess, 'Hey Alice!');
  const replyPlain = SIG.drDecrypt(aliceSess, replyHdr, replyCt);
  assert(replyPlain === 'Hey Alice!', 'Handshake: Bob reply decrypts on Alice side');

  // Multi-turn conversation continues
  const msgs = ['msg-3', 'msg-4', 'msg-5', 'msg-6', 'msg-7', 'msg-8'];
  let allOk = true;
  for (let i = 0; i < msgs.length; i++) {
    const sender   = i % 2 === 0 ? aliceSess : bobSess;
    const receiver = i % 2 === 0 ? bobSess   : aliceSess;
    const { header, ciphertext } = SIG.drEncrypt(sender, msgs[i]);
    const plain = SIG.drDecrypt(receiver, header, ciphertext);
    if (plain !== msgs[i]) { allOk = false; console.error(`  ✗ FAIL: msg-${i+3} failed`); }
  }
  assert(allOk, 'Handshake: 6 additional alternating messages all decrypt');
}

// ─── Delivery Timing ────────────────────────────────────────────────────────

section('Delivery Timing — Encrypt/Decrypt Latency');

{
  const tIK_A = nacl.box.keyPair();
  const tIK_B = nacl.box.keyPair();
  const tSPK  = nacl.box.keyPair();

  const tSK_a = SIG.x3dhInitiator(tIK_A.secretKey, nacl.box.keyPair().secretKey, tIK_B.publicKey, tSPK.publicKey, null);
  const tSK_b = SIG.x3dhResponder(tIK_B.secretKey, tSPK.secretKey, null, tIK_A.publicKey, nacl.box.keyPair().publicKey);
  // Note: SK won't match because we used different EK above, that's fine — we just need timing for sender
  const timeSK = SIG.x3dhInitiator(tIK_A.secretKey, nacl.box.keyPair().secretKey, tIK_B.publicKey, tSPK.publicKey, null);
  const timeSess = SIG.drInitSender(timeSK, tSPK.publicKey);

  // Benchmark 100 encryptions
  const encStart = Date.now();
  const encrypted = [];
  for (let i = 0; i < 100; i++) {
    encrypted.push(SIG.drEncrypt(timeSess, `Timing test message ${i} with some content to be realistic`));
  }
  const encMs = Date.now() - encStart;
  const encAvg = (encMs / 100).toFixed(2);
  console.log(`  ⏱  100 DR encryptions: ${encMs}ms total, ${encAvg}ms avg`);
  assert(encMs < 5000, `DR encryption: 100 msgs in ${encMs}ms (< 5s threshold)`);

  // Benchmark 100 sender key encryptions
  let skState = SIG.skGenerate();
  const skEncStart = Date.now();
  for (let i = 0; i < 100; i++) {
    const { newState } = SIG.skEncrypt(skState, `Group timing test ${i}`, 'bench');
    skState = newState;
  }
  const skEncMs = Date.now() - skEncStart;
  const skEncAvg = (skEncMs / 100).toFixed(2);
  console.log(`  ⏱  100 SK encryptions: ${skEncMs}ms total, ${skEncAvg}ms avg`);
  assert(skEncMs < 5000, `SK encryption: 100 msgs in ${skEncMs}ms (< 5s threshold)`);

  // Benchmark X3DH key agreement
  const x3dhStart = Date.now();
  for (let i = 0; i < 100; i++) {
    SIG.x3dhInitiator(tIK_A.secretKey, nacl.box.keyPair().secretKey, tIK_B.publicKey, tSPK.publicKey, null);
  }
  const x3dhMs = Date.now() - x3dhStart;
  console.log(`  ⏱  100 X3DH handshakes: ${x3dhMs}ms total, ${(x3dhMs/100).toFixed(2)}ms avg`);
  assert(x3dhMs < 10000, `X3DH: 100 handshakes in ${x3dhMs}ms (< 10s threshold)`);
}

// ─── Wire Envelope Round-Trip ───────────────────────────────────────────────

section('Wire Envelope — Full Round-Trip (encrypt→serialize→detect→parse→decrypt)');

{
  const wIK_A = nacl.box.keyPair();
  const wIK_B = nacl.box.keyPair();
  const wSPK  = nacl.box.keyPair();
  const wEK   = nacl.box.keyPair();
  const wOPK  = nacl.box.keyPair();

  const wSK_a = SIG.x3dhInitiator(wIK_A.secretKey, wEK.secretKey, wIK_B.publicKey, wSPK.publicKey, wOPK.publicKey);
  const wSK_b = SIG.x3dhResponder(wIK_B.secretKey, wSPK.secretKey, wOPK.secretKey, wIK_A.publicKey, wEK.publicKey);
  const wSendSess = SIG.drInitSender(wSK_a, wSPK.publicKey);
  const wRecvSess = SIG.drInitReceiver(wSK_b, wSPK);

  // Encrypt and build wire envelope (as App.js encryptDM does)
  const { header: wHdr, ciphertext: wCt } = SIG.drEncrypt(wSendSess, 'Wire round trip!');
  const wireEnvelope = JSON.stringify({
    sig: true,
    v: 1,
    hdr: JSON.stringify(wHdr),
    ct: wCt,
  });

  // Detect envelope type
  assert(SIG.isSignalDM(wireEnvelope), 'Wire RT: isSignalDM detects the envelope');
  assert(!SIG.isSignalGroup(wireEnvelope), 'Wire RT: isSignalGroup rejects DM envelope');
  assert(!SIG.isLegacyNaClDM(wireEnvelope), 'Wire RT: isLegacyNaClDM rejects Signal envelope');

  // Parse and decrypt (as App.js decryptDM does)
  const parsed = JSON.parse(wireEnvelope);
  const parsedHdr = JSON.parse(parsed.hdr);
  const plain = SIG.drDecrypt(wRecvSess, parsedHdr, parsed.ct);
  assert(plain === 'Wire round trip!', 'Wire RT: full DM round-trip decrypts correctly');

  // Group wire envelope round-trip
  let gSKState = SIG.skGenerate();
  const gSKRecv = { chainKey: new Uint8Array(gSKState.chainKey), iteration: gSKState.iteration };

  const { newState: gNS, envelope: gEnv } = SIG.skEncrypt(gSKState, 'Group wire test!', 'user42');
  const groupWire = JSON.stringify(gEnv);

  assert(SIG.isSignalGroup(groupWire), 'Wire RT: isSignalGroup detects group envelope');
  assert(!SIG.isSignalDM(groupWire), 'Wire RT: isSignalDM rejects group envelope');

  const gParsed = JSON.parse(groupWire);
  const gResult = SIG.skDecrypt(gSKRecv, gParsed);
  assert(gResult !== null && gResult.plaintext === 'Group wire test!', 'Wire RT: full group round-trip decrypts correctly');
}

// ─── Session Backup & Restore ───────────────────────────────────────────────

section('Session Backup & Restore — Simulates SecureStore persistence');

{
  const bIK_A = nacl.box.keyPair();
  const bIK_B = nacl.box.keyPair();
  const bSPK  = nacl.box.keyPair();
  const bEK   = nacl.box.keyPair();

  const bSK = SIG.x3dhInitiator(bIK_A.secretKey, bEK.secretKey, bIK_B.publicKey, bSPK.publicKey, null);
  const bSKr = SIG.x3dhResponder(bIK_B.secretKey, bSPK.secretKey, null, bIK_A.publicKey, bEK.publicKey);

  const senderSess = SIG.drInitSender(bSK, bSPK.publicKey);
  const recvSess = SIG.drInitReceiver(bSKr, bSPK);

  // Send a few messages to advance the ratchet
  for (let i = 0; i < 5; i++) {
    const { header, ciphertext } = SIG.drEncrypt(senderSess, `Pre-backup msg ${i}`);
    const p = SIG.drDecrypt(recvSess, header, ciphertext);
    assert(p === `Pre-backup msg ${i}`, `Backup: pre-backup msg ${i} ok`);
  }

  // Bob replies to trigger DH ratchet step
  const { header: rH, ciphertext: rC } = SIG.drEncrypt(recvSess, 'Reply before backup');
  SIG.drDecrypt(senderSess, rH, rC);

  // Serialize both sessions (simulates saving to SecureStore)
  const senderJson = SIG.serialiseSession(senderSess);
  const recvJson = SIG.serialiseSession(recvSess);

  // Restore sessions (simulates app restart loading from SecureStore)
  const restoredSender = SIG.deserialiseSession(senderJson);
  const restoredRecv   = SIG.deserialiseSession(recvJson);

  // Continue conversation with restored sessions
  const { header: postH, ciphertext: postC } = SIG.drEncrypt(restoredSender, 'After restore from sender');
  const postPlain = SIG.drDecrypt(restoredRecv, postH, postC);
  assert(postPlain === 'After restore from sender', 'Backup: post-restore message decrypts');

  const { header: postH2, ciphertext: postC2 } = SIG.drEncrypt(restoredRecv, 'Reply after restore');
  const postPlain2 = SIG.drDecrypt(restoredSender, postH2, postC2);
  assert(postPlain2 === 'Reply after restore', 'Backup: post-restore reply decrypts');

  // Sender key backup/restore
  let skOrig = SIG.skGenerate();
  const skRecvOrig = { chainKey: new Uint8Array(skOrig.chainKey), iteration: skOrig.iteration };

  // Advance a few iterations
  for (let i = 0; i < 10; i++) {
    const { newState, envelope } = SIG.skEncrypt(skOrig, `SK pre-backup ${i}`, 'user1');
    skOrig = newState;
    SIG.skDecrypt(skRecvOrig, envelope); // advance receiver too — but skRecvOrig is reassigned below
  }

  // Serialize & restore sender key
  const skJson = SIG.serialiseSKState(skOrig);
  const skRestored = SIG.deserialiseSKState(skJson);

  assert(skRestored.iteration === skOrig.iteration, 'Backup: SK iteration preserved');
  assert(SIG.b64enc(skRestored.chainKey) === SIG.b64enc(skOrig.chainKey), 'Backup: SK chainKey preserved');
}

// ─── Sender Self-Decrypt Failure ────────────────────────────────────────────

section('Sender Self-Decrypt — Verifies sender cannot decrypt own DR messages');

{
  const sdIK_A = nacl.box.keyPair();
  const sdIK_B = nacl.box.keyPair();
  const sdSPK  = nacl.box.keyPair();
  const sdEK   = nacl.box.keyPair();

  const sdSK = SIG.x3dhInitiator(sdIK_A.secretKey, sdEK.secretKey, sdIK_B.publicKey, sdSPK.publicKey, null);
  const senderOnly = SIG.drInitSender(sdSK, sdSPK.publicKey);

  // Encrypt message
  const { header: sdH, ciphertext: sdC } = SIG.drEncrypt(senderOnly, 'Can I read my own msg?');

  // Sender tries to decrypt their own message — should fail
  const selfDecrypt = SIG.drDecrypt(senderOnly, sdH, sdC);
  assert(selfDecrypt === null, 'Self-decrypt: sender cannot decrypt own DR message');

  // This validates the ownPlainRef pattern — sender MUST cache plaintext locally
}

// ─── Long Conversation Stability ────────────────────────────────────────────

section('Long Conversation — 200 alternating messages');

{
  const lcIK_A = nacl.box.keyPair();
  const lcIK_B = nacl.box.keyPair();
  const lcSPK  = nacl.box.keyPair();
  const lcEK   = nacl.box.keyPair();

  const lcSK_a = SIG.x3dhInitiator(lcIK_A.secretKey, lcEK.secretKey, lcIK_B.publicKey, lcSPK.publicKey, null);
  const lcSK_b = SIG.x3dhResponder(lcIK_B.secretKey, lcSPK.secretKey, null, lcIK_A.publicKey, lcEK.publicKey);

  const lcAlice = SIG.drInitSender(lcSK_a, lcSPK.publicKey);
  const lcBob   = SIG.drInitReceiver(lcSK_b, lcSPK);

  let longOk = true;
  const start200 = Date.now();
  for (let i = 0; i < 200; i++) {
    const sender   = i % 2 === 0 ? lcAlice : lcBob;
    const receiver = i % 2 === 0 ? lcBob   : lcAlice;
    const text = `Long convo msg #${i}`;
    const { header, ciphertext } = SIG.drEncrypt(sender, text);
    const plain = SIG.drDecrypt(receiver, header, ciphertext);
    if (plain !== text) {
      longOk = false;
      console.error(`  ✗ FAIL: long convo msg #${i}`);
      break;
    }
  }
  const elapsed200 = Date.now() - start200;
  assert(longOk, `Long convo: all 200 alternating messages decrypt correctly`);
  console.log(`  ⏱  200 msgs: ${elapsed200}ms (${(elapsed200/200).toFixed(2)}ms/msg)`);
  assert(elapsed200 < 15000, `Long convo: 200 msgs in ${elapsed200}ms (< 15s threshold)`);
}

// ─── Burst Send (Rapid-Fire) ────────────────────────────────────────────────

section('Burst Send — 20 messages from one side before any decryption');

{
  const burstIK_A = nacl.box.keyPair();
  const burstIK_B = nacl.box.keyPair();
  const burstSPK  = nacl.box.keyPair();
  const burstEK   = nacl.box.keyPair();

  const burstSK_a = SIG.x3dhInitiator(burstIK_A.secretKey, burstEK.secretKey, burstIK_B.publicKey, burstSPK.publicKey, null);
  const burstSK_b = SIG.x3dhResponder(burstIK_B.secretKey, burstSPK.secretKey, null, burstIK_A.publicKey, burstEK.publicKey);

  const burstAlice = SIG.drInitSender(burstSK_a, burstSPK.publicKey);
  const burstBob   = SIG.drInitReceiver(burstSK_b, burstSPK);

  // Alice sends 20 messages without waiting for Bob to decrypt
  const burst = [];
  for (let i = 0; i < 20; i++) {
    burst.push(SIG.drEncrypt(burstAlice, `Burst #${i}`));
  }

  // Bob decrypts all 20 in order
  let burstOk = true;
  for (let i = 0; i < 20; i++) {
    const plain = SIG.drDecrypt(burstBob, burst[i].header, burst[i].ciphertext);
    if (plain !== `Burst #${i}`) {
      burstOk = false;
      console.error(`  ✗ FAIL: burst msg #${i}`);
      break;
    }
  }
  assert(burstOk, 'Burst: all 20 rapid-fire messages decrypt in order');

  // Bob decrypts 20 messages OUT OF ORDER (reverse)
  const burstAlice2 = SIG.drInitSender(
    SIG.x3dhInitiator(burstIK_A.secretKey, nacl.box.keyPair().secretKey, burstIK_B.publicKey, burstSPK.publicKey, null),
    burstSPK.publicKey
  );
  const burstBob2 = SIG.drInitReceiver(
    SIG.x3dhResponder(burstIK_B.secretKey, burstSPK.secretKey, null, burstIK_A.publicKey, nacl.box.keyPair().publicKey),
    burstSPK
  );
  // Note: SK mismatch due to different EK — need matching EK
  const burst2EK = nacl.box.keyPair();
  const burst2SK_a = SIG.x3dhInitiator(burstIK_A.secretKey, burst2EK.secretKey, burstIK_B.publicKey, burstSPK.publicKey, null);
  const burst2SK_b = SIG.x3dhResponder(burstIK_B.secretKey, burstSPK.secretKey, null, burstIK_A.publicKey, burst2EK.publicKey);
  const burst2Alice = SIG.drInitSender(burst2SK_a, burstSPK.publicKey);
  const burst2Bob   = SIG.drInitReceiver(burst2SK_b, burstSPK);

  const burst2 = [];
  for (let i = 0; i < 10; i++) {
    burst2.push(SIG.drEncrypt(burst2Alice, `RevBurst #${i}`));
  }

  // Decrypt in reverse order
  let revOk = true;
  for (let i = 9; i >= 0; i--) {
    const plain = SIG.drDecrypt(burst2Bob, burst2[i].header, burst2[i].ciphertext);
    if (plain !== `RevBurst #${i}`) {
      revOk = false;
      console.error(`  ✗ FAIL: reverse burst msg #${i}, got: ${plain}`);
      break;
    }
  }
  assert(revOk, 'Burst: 10 messages decrypted in reverse order (skipped keys)');
}

// ─── Group Sender Key Cycle ─────────────────────────────────────────────────

section('Group Sender Key — Multi-member simulation');

{
  // Simulate 3 users in a group
  const members = ['alice', 'bob', 'charlie'];
  const senderKeys = {};
  const receiverStates = {};

  // Each member generates their sender key
  for (const m of members) {
    senderKeys[m] = SIG.skGenerate();
    // Each other member gets a copy (simulates key distribution via DM)
    for (const other of members) {
      if (other !== m) {
        if (!receiverStates[other]) receiverStates[other] = {};
        receiverStates[other][m] = {
          chainKey: new Uint8Array(senderKeys[m].chainKey),
          iteration: senderKeys[m].iteration,
        };
      }
    }
  }

  // Simulate group conversation: each member sends messages
  let groupOk = true;
  const groupMsgs = [
    ['alice',   'Hello group from Alice!'],
    ['bob',     'Hey Alice, Bob here'],
    ['charlie', 'Charlie joining in'],
    ['alice',   'Alice again'],
    ['bob',     'Bob reply'],
    ['charlie', 'Charlie reply'],
    ['alice',   'Alice third msg'],
    ['bob',     'Bob third msg'],
  ];

  for (const [sender, text] of groupMsgs) {
    const { newState, envelope } = SIG.skEncrypt(senderKeys[sender], text, sender);
    senderKeys[sender] = newState;

    // Every other member decrypts
    for (const receiver of members) {
      if (receiver === sender) continue;
      const result = SIG.skDecrypt(receiverStates[receiver][sender], envelope);
      if (!result || result.plaintext !== text) {
        groupOk = false;
        console.error(`  ✗ FAIL: ${receiver} couldn't decrypt ${sender}'s msg: "${text}"`);
      } else {
        receiverStates[receiver][sender] = result.newSenderKeyState;
      }
    }
  }
  assert(groupOk, 'Group SK: 3-member group, 8 messages all decrypt for all members');

  // Sender key serialization round-trip per member
  let skSerOk = true;
  for (const m of members) {
    const ser = SIG.serialiseSKState(senderKeys[m]);
    const de  = SIG.deserialiseSKState(ser);
    if (de.iteration !== senderKeys[m].iteration ||
        SIG.b64enc(de.chainKey) !== SIG.b64enc(senderKeys[m].chainKey)) {
      skSerOk = false;
      console.error(`  ✗ FAIL: SK serialization for ${m}`);
    }
  }
  assert(skSerOk, 'Group SK: sender key serialization round-trip for all members');
}

// ─── Edge Cases ─────────────────────────────────────────────────────────────

section('Edge Cases');

{
  // Empty string message
  const edgeIK_A = nacl.box.keyPair();
  const edgeSPK  = nacl.box.keyPair();
  const edgeSK = SIG.x3dhInitiator(edgeIK_A.secretKey, nacl.box.keyPair().secretKey, nacl.box.keyPair().publicKey, edgeSPK.publicKey, null);
  const edgeSess = SIG.drInitSender(edgeSK, edgeSPK.publicKey);
  const edgeIK_B = nacl.box.keyPair();
  const edgeEK = nacl.box.keyPair();
  const edgeSK2 = SIG.x3dhInitiator(edgeIK_A.secretKey, edgeEK.secretKey, edgeIK_B.publicKey, edgeSPK.publicKey, null);
  const edgeSK2r = SIG.x3dhResponder(edgeIK_B.secretKey, edgeSPK.secretKey, null, edgeIK_A.publicKey, edgeEK.publicKey);
  const edgeSend = SIG.drInitSender(edgeSK2, edgeSPK.publicKey);
  const edgeRecv = SIG.drInitReceiver(edgeSK2r, edgeSPK);

  const { header: eH, ciphertext: eCt } = SIG.drEncrypt(edgeSend, '');
  const ePlain = SIG.drDecrypt(edgeRecv, eH, eCt);
  assert(ePlain === '', 'Edge: empty string message encrypts/decrypts');

  // Unicode / emoji message
  const { header: uH, ciphertext: uCt } = SIG.drEncrypt(edgeSend, '🔐 Encrypted! 中文 العربية');
  const uPlain = SIG.drDecrypt(edgeRecv, uH, uCt);
  assert(uPlain === '🔐 Encrypted! 中文 العربية', 'Edge: unicode/emoji message roundtrips');

  // Very long message (10KB)
  const longMsg = 'A'.repeat(10000);
  const { header: lH, ciphertext: lCt } = SIG.drEncrypt(edgeSend, longMsg);
  const lPlain = SIG.drDecrypt(edgeRecv, lH, lCt);
  assert(lPlain === longMsg, 'Edge: 10KB message encrypts/decrypts');

  // JSON content in message (common case — media payloads)
  const jsonMsg = JSON.stringify({ type: 'media', url: 'https://example.com', key: 'abc' });
  const { header: jH, ciphertext: jCt } = SIG.drEncrypt(edgeSend, jsonMsg);
  const jPlain = SIG.drDecrypt(edgeRecv, jH, jCt);
  assert(jPlain === jsonMsg, 'Edge: JSON content inside message roundtrips');

  // Legacy NaCl detection edge cases
  assert(SIG.isLegacyNaClDM(JSON.stringify({ enc: 1, nonce: 'abc' })) === true, 'Edge: legacy NaCl with enc=1 (number) detected');
  assert(SIG.isLegacyNaClDM(JSON.stringify({ enc: 'cipher', nonce: 'abc' })) === true, 'Edge: legacy NaCl with enc=string detected');
  assert(SIG.isLegacyNaClDM(JSON.stringify({ enc: null, nonce: 'abc' })) === false, 'Edge: legacy NaCl with enc=null rejected');
  assert(SIG.isLegacyNaClDM('not json at all') === false, 'Edge: non-JSON rejected by isLegacyNaClDM');

  // Sender key — group message with empty string
  let skEdge = SIG.skGenerate();
  const skEdgeRecv = { chainKey: new Uint8Array(skEdge.chainKey), iteration: skEdge.iteration };
  const { newState: skEN, envelope: skEE } = SIG.skEncrypt(skEdge, '', 'edgeUser');
  const skEdgeResult = SIG.skDecrypt(skEdgeRecv, skEE);
  assert(skEdgeResult !== null && skEdgeResult.plaintext === '', 'Edge: SK empty string group message roundtrips');
}

// ─── HTML Escape Corruption & Recovery with encrypted content ───────────────

section('HTML Escape — Signal envelope corruption & recovery');

{
  // Build a real encrypted DM envelope
  const hIK_A = nacl.box.keyPair();
  const hIK_B = nacl.box.keyPair();
  const hSPK  = nacl.box.keyPair();
  const hEK   = nacl.box.keyPair();

  const hSK_a = SIG.x3dhInitiator(hIK_A.secretKey, hEK.secretKey, hIK_B.publicKey, hSPK.publicKey, null);
  const hSK_b = SIG.x3dhResponder(hIK_B.secretKey, hSPK.secretKey, null, hIK_A.publicKey, hEK.publicKey);

  const hSend = SIG.drInitSender(hSK_a, hSPK.publicKey);
  const hRecv = SIG.drInitReceiver(hSK_b, hSPK);

  const { header: hHdr, ciphertext: hCt } = SIG.drEncrypt(hSend, 'Survives HTML escape?');
  const realEnvelope = JSON.stringify({ sig: true, v: 1, hdr: JSON.stringify(hHdr), ct: hCt });

  // Simulate backend HTML escaping (the server's html_escape)
  const corrupted = realEnvelope
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Verify it's broken
  let broken = false;
  try { JSON.parse(corrupted); } catch { broken = true; }
  assert(broken, 'HTML escape: real envelope is corrupted by HTML escaping');

  // Recover
  const recovered = corrupted
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  assert(recovered === realEnvelope, 'HTML escape: recovery restores original envelope');

  // Decrypt after recovery
  const recParsed = JSON.parse(recovered);
  const recHdr = JSON.parse(recParsed.hdr);
  const recPlain = SIG.drDecrypt(hRecv, recHdr, recParsed.ct);
  assert(recPlain === 'Survives HTML escape?', 'HTML escape: decryption succeeds after recovery');
}

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
