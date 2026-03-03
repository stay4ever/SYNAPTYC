/**
 * src/media.js — Cloudflare R2 encrypted media upload for SYNAPTYC
 *
 * Flow:
 *   1. Pick image → base64 from expo-image-picker
 *   2. Encrypt with XSalsa20-Poly1305 (tweetnacl nacl.secretbox)
 *   3. Request presigned PUT URL from Elixir backend
 *   4. PUT encrypted bytes directly to R2
 *   5. Share { url, key, nonce } JSON payload, which is then Signal-encrypted
 *
 * Receiving:
 *   1. Signal-decrypt message → parse { type:"media", url, key, nonce }
 *   2. Fetch R2 URL → nacl.secretbox.open decrypt → render as data URI
 *
 * Encrypted media is opaque to anyone without the key (even Cloudflare).
 *
 * NOTE: Uses tweetnacl instead of WebCrypto because Hermes (React Native's
 * JS engine) does not provide crypto.subtle.
 */

const nacl     = require('tweetnacl');
const naclUtil = require('tweetnacl-util');
const { BASE_URL } = require('./constants');

/**
 * Encrypt raw image bytes with XSalsa20-Poly1305 (nacl.secretbox).
 * Returns { cipherBytes: Uint8Array, key: base64, nonce: base64 }
 */
function encryptMedia(base64Data) {
  // Decode base64 → bytes
  const raw = naclUtil.decodeBase64(base64Data);

  // Generate random 32-byte key and 24-byte nonce
  const key   = nacl.randomBytes(nacl.secretbox.keyLength);    // 32 bytes
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);  // 24 bytes

  // Encrypt
  const cipherBytes = nacl.secretbox(raw, nonce, key);

  return {
    cipherBytes,
    key:   naclUtil.encodeBase64(key),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

/**
 * Decrypt XSalsa20-Poly1305 encrypted media fetched from R2.
 * Returns a data URI string (e.g. 'data:image/jpeg;base64,...').
 * @param {string} mime - MIME type (default: 'image/jpeg' for backward compat)
 */
async function decryptMedia(url, key64, nonce64, mime) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`R2 fetch failed: ${res.status}`);
  const cipherBuf = await res.arrayBuffer();
  const cipherBytes = new Uint8Array(cipherBuf);

  const key   = naclUtil.decodeBase64(key64);
  const nonce = naclUtil.decodeBase64(nonce64);

  const plainBytes = nacl.secretbox.open(cipherBytes, nonce, key);
  if (!plainBytes) throw new Error('Media decryption failed — wrong key or corrupted data');

  const b64 = naclUtil.encodeBase64(plainBytes);
  const mimeType = mime || 'image/jpeg';
  return `data:${mimeType};base64,${b64}`;
}

/**
 * Encrypt an image and upload it directly to Cloudflare R2.
 *
 * @param {string} base64Data - raw base64 image data (no prefix)
 * @param {string} mimeType   - e.g. 'image/jpeg'
 * @param {string} token      - Elixir JWT token for presign endpoint
 * @returns {{ url: string, key: string, nonce: string }}
 */
async function uploadEncryptedMedia(base64Data, mimeType, token) {
  // 1. Get presigned PUT URL from Elixir backend
  const presignRes = await fetch(`${BASE_URL}/api/media/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mime: mimeType }),
  });
  if (!presignRes.ok) throw new Error(`Presign failed: ${presignRes.status}`);
  const { upload_url, public_url } = await presignRes.json();

  // 2. Encrypt locally (synchronous — no WebCrypto needed)
  const { cipherBytes, key, nonce } = encryptMedia(base64Data);

  // 3. Upload encrypted bytes directly to R2 (no auth needed — presigned)
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: cipherBytes,
  });
  if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.status}`);

  return { url: public_url, key, nonce };
}

/**
 * Build the JSON payload string for an encrypted media message.
 * This string is then passed to sendMessage(), which Signal-encrypts it.
 * @param {string} mime - MIME type of the media (e.g. 'image/png')
 */
function mediaPayload(url, key, nonce, mime) {
  const obj = { type: 'media', url, key, nonce };
  if (mime) obj.mime = mime;
  return JSON.stringify(obj);
}

/**
 * Detect if a message content string is an encrypted media payload.
 */
function isMediaPayload(content) {
  if (typeof content !== 'string') return false;
  try {
    const obj = JSON.parse(content);
    return obj?.type === 'media' && typeof obj.url === 'string';
  } catch { return false; }
}

/**
 * Parse a media payload JSON string.
 * Returns { url, key, nonce, mime } or null.
 * Supports both new format (nonce) and old format (iv) for backward compat.
 */
function parseMediaPayload(content) {
  try {
    const obj = JSON.parse(content);
    if (obj?.type === 'media' && obj.url && obj.key && (obj.nonce || obj.iv)) {
      return { url: obj.url, key: obj.key, nonce: obj.nonce || obj.iv, mime: obj.mime || 'image/jpeg' };
    }
  } catch {}
  return null;
}

module.exports = {
  encryptMedia,
  decryptMedia,
  uploadEncryptedMedia,
  mediaPayload,
  isMediaPayload,
  parseMediaPayload,
};
