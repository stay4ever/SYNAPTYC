/**
 * nano-SYNAPSYS Backend Server
 *
 * REST API + WebSocket relay for the encrypted messaging app.
 * Supports: auth, messages, contacts, groups, bot, invites.
 * WebSocket relays: chat_message, key_exchange, group_message, mark_read, typing, user_list.
 */

const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3000", 10);
// C6: Fail fast if JWT_SECRET is not set — never use a known-public fallback in production.
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "30d";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "nano-synapsys.db");
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const BCRYPT_ROUNDS = 12;
const NODE_ENV = process.env.NODE_ENV || "development";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : null; // null = allow all (dev), set in production
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX     = parseInt(process.env.RATE_LIMIT_MAX     || "100", 10);
const BOT_RATE_LIMIT_MAX = parseInt(process.env.BOT_RATE_LIMIT_MAX || "10",  10);

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Run migration inline if tables don't exist
const tableCheck = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
).get();
if (!tableCheck) {
  console.log("Running initial migration...");
  require("./migrate");
}

// Add phone_number_hashes column if it doesn't exist (multi-format matching)
try {
  db.prepare("ALTER TABLE users ADD COLUMN phone_number_hashes TEXT DEFAULT NULL").run();
  console.log("Migrated: added phone_number_hashes column");
} catch (_) { /* column already exists */ }

// Add avatar_url column if it doesn't exist
try {
  db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL").run();
  console.log("Migrated: added avatar_url column");
} catch (_) { /* column already exists */ }

// M2: Add bio column if it doesn't exist
try {
  db.prepare("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL").run();
  console.log("Migrated: added bio column");
} catch (_) { /* column already exists */ }

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "uploads", "avatars");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// Production: trust reverse proxy (Railway, Fly, nginx)
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// CORS — lock to specific origins in production
app.use(
  cors(
    ALLOWED_ORIGINS
      ? { origin: ALLOWED_ORIGINS, credentials: true }
      : undefined
  )
);

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  if (NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// Rate limiting (in-memory, per-IP for global; per-userId for bot)
const rateLimitMap    = new Map();
const botRateLimitMap = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }
  next();
});

// L8: Clean up stale rate-limit entries every minute (prune entries older than 1 window).
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, entry] of rateLimitMap) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
  for (const [uid, entry] of botRateLimitMap) {
    if (entry.windowStart < cutoff) botRateLimitMap.delete(uid);
  }
}, 60_000);

app.use(express.json({ limit: "5mb" })); // allow base64 avatar payloads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const server = http.createServer(app);

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** Express middleware: attaches req.userId */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) return res.status(401).json({ error: "Session expired. Please log in again." });
  req.userId = payload.userId;
  next();
}

// ---------------------------------------------------------------------------
// AUTH routes
// ---------------------------------------------------------------------------

app.post("/auth/register", (req, res) => {
  const { username, email, password, display_name, phone_number_hash, phone_number_hashes } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "username, email, and password are required" });
  }
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ? OR email = ?")
    .get(username, email);
  if (existing) {
    return res.status(409).json({ error: "Username or email already taken" });
  }
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  // Store all phone hash variants (JSON array) for multi-format contact matching
  const allHashes = Array.isArray(phone_number_hashes) && phone_number_hashes.length
    ? phone_number_hashes
    : phone_number_hash ? [phone_number_hash] : [];
  const primaryHash = allHashes[0] || null;
  const hashesJson = allHashes.length > 1 ? JSON.stringify(allHashes) : null;
  const info = db
    .prepare(
      "INSERT INTO users (username, email, password_hash, display_name, is_approved, phone_number_hash, phone_number_hashes) VALUES (?, ?, ?, ?, 1, ?, ?)"
    )
    .run(username, email, hash, display_name || null, primaryHash, hashesJson);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = signToken(user.id);
  res.status(201).json({ token, user: { ...sanitizeUser(user), email: user.email } });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken(user.id);
  res.json({ token, user: { ...sanitizeUser(user), email: user.email } });
});

app.get("/auth/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { ...sanitizeUser(user), email: user.email } });
});

app.post("/auth/password-reset", (req, res) => {
  // Stub — in production send email with reset link
  res.json({ message: "If this email exists, a reset link has been sent." });
});

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

app.get("/api/users", authMiddleware, (req, res) => {
  const users = db.prepare("SELECT * FROM users").all();
  res.json({ users: users.map(sanitizeUser) });
});

// ---------------------------------------------------------------------------
// MESSAGES
// ---------------------------------------------------------------------------

app.get("/api/messages/:userId", authMiddleware, (req, res) => {
  const otherId  = parseInt(req.params.userId, 10);
  // M9: Paginate with before_id cursor (newest 200 messages by default).
  const beforeId = parseInt(req.query.before_id || "0", 10);
  const limit    = Math.min(parseInt(req.query.limit || "200", 10), 200);
  const messages = beforeId > 0
    ? db.prepare(
        `SELECT * FROM messages
         WHERE ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))
           AND id < ?
         ORDER BY created_at DESC LIMIT ?`
      ).all(req.userId, otherId, otherId, req.userId, beforeId, limit).reverse()
    : db.prepare(
        `SELECT * FROM messages
         WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
         ORDER BY created_at DESC LIMIT ?`
      ).all(req.userId, otherId, otherId, req.userId, limit).reverse();
  res.json({ messages: messages.map(sanitizeMessage) });
});

app.post("/api/messages", authMiddleware, (req, res) => {
  const { to_user, content } = req.body;
  if (!to_user || content === undefined) {
    return res.status(400).json({ error: "to_user and content are required" });
  }
  if (typeof content !== "string" || content.length === 0) {
    return res.status(400).json({ error: "content must be a non-empty string" });
  }
  if (content.length > 65536) {
    return res.status(400).json({ error: "content too large (max 64 KB)" });
  }
  const info = db
    .prepare("INSERT INTO messages (from_user, to_user, content) VALUES (?, ?, ?)")
    .run(req.userId, to_user, content);
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(info.lastInsertRowid);

  // Relay via WebSocket if recipient is online
  const wsPayload = {
    type: "chat_message",
    id: message.id,
    from: message.from_user,
    to: message.to_user,
    content: message.content,
    read: false,
    created_at: message.created_at,
  };
  sendToUser(message.to_user, wsPayload);
  // Echo back to sender's other devices
  sendToUser(message.from_user, wsPayload, null);

  res.status(201).json({ message });
});

app.delete("/api/messages/:id", authMiddleware, (req, res) => {
  const messageId = parseInt(req.params.id, 10);
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!message) return res.status(404).json({ error: "Message not found" });
  if (message.from_user !== req.userId) return res.status(403).json({ error: "Cannot delete another user's message" });
  db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
  // Notify both parties so they can remove it from their UI
  const payload = { type: "message_deleted", id: messageId };
  sendToUser(message.from_user, payload, null);
  sendToUser(message.to_user, payload, null);
  res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// CONTACTS
// ---------------------------------------------------------------------------

app.get("/api/contacts", authMiddleware, (req, res) => {
  const contacts = db
    .prepare("SELECT * FROM contacts WHERE requester_id = ? OR receiver_id = ?")
    .all(req.userId, req.userId);
  res.json({ contacts });
});

app.post("/api/contacts", authMiddleware, (req, res) => {
  const { receiver_id } = req.body;
  if (!receiver_id) return res.status(400).json({ error: "receiver_id is required" });
  if (receiver_id === req.userId) return res.status(400).json({ error: "Cannot add yourself" });

  const existing = db
    .prepare(
      "SELECT * FROM contacts WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)"
    )
    .get(req.userId, receiver_id, receiver_id, req.userId);
  if (existing) return res.status(409).json({ error: "Contact already exists" });

  const info = db
    .prepare("INSERT INTO contacts (requester_id, receiver_id) VALUES (?, ?)")
    .run(req.userId, receiver_id);
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ contact });
});

app.patch("/api/contacts/:id", authMiddleware, (req, res) => {
  const { status } = req.body;
  if (!["accepted", "blocked", "pending", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  // C1: Verify caller is party to this contact before any mutation.
  const contactRow = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contactRow) return res.status(404).json({ error: "Contact not found" });
  if (contactRow.requester_id !== req.userId && contactRow.receiver_id !== req.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // "rejected" maps to a hard delete — no need to keep the row
  if (status === "rejected") {
    db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
    return res.json({ deleted: true });
  }
  db.prepare("UPDATE contacts SET status = ? WHERE id = ?").run(status, req.params.id);
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  res.json({ contact });
});

app.delete("/api/contacts/:id", authMiddleware, (req, res) => {
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found" });
  if (contact.requester_id !== req.userId && contact.receiver_id !== req.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
  res.json({ deleted: true });
});

// POST /api/contacts/sync — Signal-style phone number discovery
// Accepts an array of SHA-256 hashed phone numbers; returns matched users.
// The server never sees raw phone numbers — only hashes.
app.post("/api/contacts/sync", authMiddleware, (req, res) => {
  const { hashes } = req.body;
  if (!Array.isArray(hashes) || hashes.length === 0) {
    return res.json({ matched: [] });
  }
  // Limit to 500 hashes per request to prevent abuse
  const limited = hashes.slice(0, 500);
  const placeholders = limited.map(() => "?").join(",");

  // Match against primary hash column
  const primaryRows = db
    .prepare(`SELECT * FROM users WHERE phone_number_hash IN (${placeholders}) AND id != ?`)
    .all(...limited, req.userId);

  // Also match against secondary hashes JSON column (any variant stored at registration)
  const allUsers = db
    .prepare(`SELECT * FROM users WHERE phone_number_hashes IS NOT NULL AND id != ?`)
    .all(req.userId);
  const limitedSet = new Set(limited);
  const secondaryRows = allUsers.filter(u => {
    try {
      const stored = JSON.parse(u.phone_number_hashes);
      return Array.isArray(stored) && stored.some(h => limitedSet.has(h));
    } catch { return false; }
  });

  // Merge, deduplicate by id
  const seen = new Set(primaryRows.map(r => r.id));
  const merged = [...primaryRows, ...secondaryRows.filter(r => !seen.has(r.id))];
  res.json({ matched: merged.map(sanitizeUser) });
});

// ---------------------------------------------------------------------------
// GROUPS
// ---------------------------------------------------------------------------

app.get("/api/groups", authMiddleware, (req, res) => {
  const groups = db
    .prepare(
      `SELECT DISTINCT g.* FROM groups_ g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ?`
    )
    .all(req.userId);

  const result = groups.map((g) => {
    g.members = db.prepare("SELECT * FROM group_members WHERE group_id = ?").all(g.id);
    return g;
  });
  res.json(result);
});

app.post("/api/groups", authMiddleware, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  // M8: Enforce maximum group name length.
  if (typeof name !== "string" || name.length > 100) {
    return res.status(400).json({ error: "Group name must be 1–100 characters" });
  }

  const creator = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  const info = db
    .prepare("INSERT INTO groups_ (name, description, created_by) VALUES (?, ?, ?)")
    .run(name, description || "", req.userId);

  // Add creator as admin
  db.prepare(
    "INSERT INTO group_members (group_id, user_id, username, display_name, role) VALUES (?, ?, ?, ?, 'admin')"
  ).run(info.lastInsertRowid, req.userId, creator.username, creator.display_name || "");

  const group = db.prepare("SELECT * FROM groups_ WHERE id = ?").get(info.lastInsertRowid);
  group.members = db.prepare("SELECT * FROM group_members WHERE group_id = ?").all(group.id);
  res.status(201).json(group);
});

app.get("/api/groups/:groupId/messages", authMiddleware, (req, res) => {
  // C2: Only members may read group messages.
  const membership = db
    .prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?")
    .get(req.params.groupId, req.userId);
  if (!membership) return res.status(403).json({ error: "Not a member of this group" });

  const messages = db
    .prepare("SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC")
    .all(req.params.groupId);
  res.json(messages);
});

app.post("/api/groups/:groupId/members", authMiddleware, (req, res) => {
  const { user_id } = req.body;
  const groupId = parseInt(req.params.groupId, 10);

  // C3: Only group admins may add members.
  const callerRole = db
    .prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?")
    .get(groupId, req.userId);
  if (!callerRole || callerRole.role !== "admin") {
    return res.status(403).json({ error: "Only group admins can add members" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "User not found" });

  db.prepare(
    "INSERT OR IGNORE INTO group_members (group_id, user_id, username, display_name, role) VALUES (?, ?, ?, ?, 'member')"
  ).run(groupId, user_id, user.username, user.display_name || "");

  const group = db.prepare("SELECT * FROM groups_ WHERE id = ?").get(groupId);
  group.members = db.prepare("SELECT * FROM group_members WHERE group_id = ?").all(groupId);
  res.json(group);
});

app.delete("/api/groups/:groupId/members", authMiddleware, (req, res) => {
  const { user_id } = req.body;
  const groupId = parseInt(req.params.groupId, 10);
  const targetId = parseInt(user_id, 10);

  // C4: Allow if caller is an admin, or caller is removing themselves.
  const callerMember = db
    .prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?")
    .get(groupId, req.userId);
  if (!callerMember) return res.status(403).json({ error: "Not a member of this group" });
  if (callerMember.role !== "admin" && targetId !== req.userId) {
    return res.status(403).json({ error: "Only admins can remove other members" });
  }

  db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(groupId, targetId);
  res.json({ removed: true });
});

app.delete("/api/groups/:groupId", authMiddleware, (req, res) => {
  // M3: Return meaningful errors instead of silent success on no-op.
  const group = db.prepare("SELECT * FROM groups_ WHERE id = ?").get(req.params.groupId);
  if (!group) return res.status(404).json({ error: "Group not found" });
  if (group.created_by !== req.userId) return res.status(403).json({ error: "Only the group creator can delete it" });
  db.prepare("DELETE FROM groups_ WHERE id = ?").run(req.params.groupId);
  res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------

app.get("/api/profile", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { ...sanitizeUser(user), email: user.email } });
});

app.put("/api/profile", authMiddleware, (req, res) => {
  const { display_name, bio, phone_number } = req.body;
  if (display_name !== undefined && typeof display_name !== "string") {
    return res.status(400).json({ error: "display_name must be a string" });
  }
  if (bio !== undefined && typeof bio !== "string") {
    return res.status(400).json({ error: "bio must be a string" });
  }
  if (phone_number !== undefined && typeof phone_number !== "string") {
    return res.status(400).json({ error: "phone_number must be a string" });
  }

  // Compute phone number hashes if provided
  let primaryHash = undefined;
  let allHashes = undefined;
  if (phone_number !== undefined && phone_number.trim().length > 0) {
    const crypto = require("crypto");
    const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
    const digits = phone_number.replace(/\D/g, "");
    if (digits.length >= 7) {
      const variants = new Set([digits]);
      if (digits.startsWith("0") && digits.length === 10) variants.add("61" + digits.slice(1));
      if (digits.startsWith("61") && digits.length === 11) variants.add("0" + digits.slice(2));
      if (digits.length === 10 && !digits.startsWith("0")) variants.add("1" + digits);
      if (digits.startsWith("1") && digits.length === 11) variants.add(digits.slice(1));
      const hashed = Array.from(variants).map(sha256);
      primaryHash = hashed[0];
      allHashes = JSON.stringify(hashed);
    }
  }

  // Only update columns that were provided
  const updates = [];
  const values = [];
  if (display_name !== undefined) { updates.push("display_name = ?"); values.push(display_name.slice(0, 100)); }
  if (bio !== undefined)          { updates.push("bio = ?");          values.push(bio.slice(0, 500)); }
  if (primaryHash !== undefined)  { updates.push("phone_number_hash = ?"); values.push(primaryHash); }
  if (allHashes !== undefined)    { updates.push("phone_number_hashes = ?"); values.push(allHashes); }

  if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

  // M1/M2: bio column is now always present (inline migration above). No retry needed.
  values.push(req.userId);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json({ user: { ...sanitizeUser(user), email: user.email } });
});

// POST /api/profile/avatar — accept base64-encoded JPEG, store to disk, return URL
app.post("/api/profile/avatar", authMiddleware, (req, res) => {
  const { image } = req.body; // base64 data URI or raw base64 string
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image is required" });
  }
  // Strip data URI prefix if present ("data:image/jpeg;base64,...")
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  if (base64Data.length > 500_000) { // ~375KB raw limit
    return res.status(400).json({ error: "Image too large (max 375KB compressed)" });
  }
  const buffer = Buffer.from(base64Data, "base64");

  // M4: Validate JPEG magic bytes (FF D8 FF) before writing to disk.
  if (buffer.length < 3 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
    return res.status(400).json({ error: "Invalid image format. Only JPEG is accepted." });
  }
  const filename = `${req.userId}.jpg`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  const avatarUrl = `${BASE_URL}/uploads/avatars/${filename}`;
  db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(avatarUrl, req.userId);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json({ user: { ...sanitizeUser(user), email: user.email } });
});

// ---------------------------------------------------------------------------
// PUSH TOKENS
// ---------------------------------------------------------------------------

app.post("/api/push-token", authMiddleware, (req, res) => {
  const { token, platform } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });

  // Upsert push token for this user (one token per user for simplicity)
  try {
    db.prepare(
      `INSERT INTO push_tokens (user_id, token, platform, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET token = excluded.token,
         platform = excluded.platform, updated_at = excluded.updated_at`
    ).run(req.userId, token, platform || "ios", new Date().toISOString());
  } catch {
    // push_tokens table may not exist in older migrations — create it now
    db.prepare(
      `CREATE TABLE IF NOT EXISTS push_tokens (
         user_id INTEGER PRIMARY KEY,
         token TEXT NOT NULL,
         platform TEXT DEFAULT 'ios',
         updated_at TEXT NOT NULL,
         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
       )`
    ).run();
    db.prepare(
      `INSERT OR REPLACE INTO push_tokens (user_id, token, platform, updated_at)
       VALUES (?, ?, ?, ?)`
    ).run(req.userId, token, platform || "ios", new Date().toISOString());
  }

  res.json({ registered: true });
});

// ---------------------------------------------------------------------------
// BANNER AI — Claude-powered agent with device context + tool use
// ---------------------------------------------------------------------------

// H4: Per-user rate limit for bot endpoint — map and constant defined near top of file.
function botRateLimit(req, res, next) {
  const key = req.userId; // keyed by authenticated user, not IP
  const now = Date.now();
  let entry = botRateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    botRateLimitMap.set(key, entry);
  }
  entry.count++;
  if (entry.count > BOT_RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many Banner requests. Try again in a minute." });
  }
  next();
}

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const BANNER_TOOLS = [
  {
    name: "get_platform_users",
    description: "Get users registered on the SYNAPTYC platform (excludes current user)",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_task",
    description: "Create a tracked agent task visible to the user",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short task title" },
        description: { type: "string", description: "What the task does" },
      },
      required: ["title"],
    },
  },
  {
    name: "navigate_to",
    description: "Navigate the iOS app to a screen: conversations | groups | contacts | settings",
    input_schema: {
      type: "object",
      properties: {
        screen: { type: "string", enum: ["conversations", "groups", "contacts", "settings"] },
      },
      required: ["screen"],
    },
  },
];

app.post("/api/bot/chat", authMiddleware, botRateLimit, async (req, res) => {
  let { message = "", conversation = [], device_context = {}, tool_results = [] } = req.body;

  // H5: Cap conversation history to last 20 turns and each message content to 4096 chars.
  if (Array.isArray(conversation)) {
    conversation = conversation.slice(-20).map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 4096) : "",
    }));
  } else {
    conversation = [];
  }

  if (!anthropic) {
    return res.json({
      reply:
        "⚠ ANTHROPIC_API_KEY not set on server.\n\nTo enable Banner AI:\n  fly secrets set ANTHROPIC_API_KEY=sk-ant-...\n\nThen redeploy.",
      tool_calls: [],
    });
  }

  try {
    const dc = device_context;
    const deviceSummary = dc.battery_level != null
      ? `Battery ${Math.round(dc.battery_level * 100)}% (${dc.battery_state}) · ${dc.network_type} · ${(dc.storage_free_gb || 0).toFixed(1)} GB free / ${(dc.storage_total_gb || 0).toFixed(1)} GB · iOS ${dc.ios_version} · App v${dc.app_version}`
      : "Device context unavailable";

    const systemPrompt = `You are Banner, an AI agent embedded in SYNAPTYC — a private, end-to-end encrypted messaging app. You run directly on the user's device and have real-time access to device stats, app state, and platform data.

CONNECTED DEVICE:
${deviceSummary}
Unread messages: ${dc.unread_count ?? 0}

CAPABILITIES:
• Read live device stats (battery, storage, network, iOS version)
• Create and track tasks shown in the agents panel
• Navigate the app to any screen
• Query SYNAPTYC platform users
• Write and explain code (Swift, JavaScript, Python, shell)

STYLE: Concise, technical, cyberpunk terminal aesthetic. Use actual device data in responses. Be action-oriented — when asked to do something, do it, don't just describe it.`;

    // Build message array from conversation history
    const messages = conversation.map((m) => ({ role: m.role, content: m.content }));

    // Append tool results if this is a continuation
    if (tool_results.length > 0) {
      messages.push({
        role: "user",
        content: tool_results.map((tr) => ({
          type: "tool_result",
          tool_use_id: tr.tool_use_id,
          content: tr.result,
        })),
      });
    } else if (message.trim()) {
      messages.push({ role: "user", content: message });
    }

    // Agentic loop — process server-side tools automatically (max 4 iterations)
    let finalReply = "";
    const clientToolCalls = [];
    for (let i = 0; i < 4; i++) {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: BANNER_TOOLS,
      });

      const texts = response.content.filter((b) => b.type === "text");
      const uses  = response.content.filter((b) => b.type === "tool_use");
      if (texts.length) finalReply = texts.map((b) => b.text).join("\n");

      if (response.stop_reason === "end_turn" || uses.length === 0) break;

      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const use of uses) {
        let result = "";
        if (use.name === "get_platform_users") {
          const rows = db
            .prepare("SELECT id, username, display_name FROM users WHERE id != ? LIMIT 50")
            .all(req.userId);
          result = JSON.stringify(rows);
        } else if (use.name === "create_task") {
          // Task is also created client-side for immediate display; here we just confirm
          result = JSON.stringify({ created: true, title: use.input.title });
        } else {
          // Client-side tool — return to app
          clientToolCalls.push({ id: use.id, name: use.name, input: use.input });
          result = "Sent to client device for execution";
        }
        toolResults.push({ type: "tool_result", tool_use_id: use.id, content: result });
      }

      // If any client tools were queued, return now and let app handle them
      if (clientToolCalls.length > 0) break;
      messages.push({ role: "user", content: toolResults });
    }

    res.json({ reply: finalReply, tool_calls: clientToolCalls });
  } catch (err) {
    console.error("Banner error:", err.message);
    res.status(500).json({ error: `Banner error: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// INVITES
// ---------------------------------------------------------------------------

app.post("/api/invites", authMiddleware, (req, res) => {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO invites (token, created_by, expires_at) VALUES (?, ?, ?)").run(
    token,
    req.userId,
    expiresAt
  );
  res.json({
    token,
    invite_url: `${BASE_URL}/invite/${token}`,
    expires_at: expiresAt,
  });
});

// ---------------------------------------------------------------------------
// WebSocket Server — relay hub
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true });

/** Map<userId, Set<WebSocket>> — supports multiple devices per user */
const clients = new Map();

/** Send a JSON payload to all WebSocket connections for a user */
function sendToUser(userId, payload, excludeWs = undefined) {
  const sockets = clients.get(userId);
  if (!sockets) return;
  const data = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

/** Broadcast to all connected clients */
function broadcastUserList() {
  const userList = [];
  const allUsers = db.prepare("SELECT id, username, display_name, online FROM users").all();
  for (const u of allUsers) {
    userList.push({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      online: !!clients.has(u.id),
    });
  }
  const payload = JSON.stringify({ type: "user_list", users: userList });
  for (const [, sockets] of clients) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

/** Send the group member list to all group members for a specific group */
function getGroupMemberIds(groupId) {
  return db
    .prepare("SELECT user_id FROM group_members WHERE group_id = ?")
    .all(groupId)
    .map((r) => r.user_id);
}

server.on("upgrade", (request, socket, head) => {
  // Extract token from query string
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get("token");
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    ws.userId = payload.userId;
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => {
  const userId = ws.userId;

  // Register connection
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);

  // Mark online
  db.prepare("UPDATE users SET online = 1 WHERE id = ?").run(userId);
  broadcastUserList();

  // -----------------------------------------------------------------------
  // Message handler — relay all known types, preserve ordering
  // -----------------------------------------------------------------------
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      // -----------------------------------------------------------------
      // DM chat message (sent via WS as alternative to REST)
      // -----------------------------------------------------------------
      case "chat_message": {
        // H3: Enforce same 64 KB content limit as REST endpoint.
        if (!msg.to || typeof msg.content !== "string" || msg.content.length === 0 || msg.content.length > 65536) break;
        const info = db
          .prepare("INSERT INTO messages (from_user, to_user, content) VALUES (?, ?, ?)")
          .run(userId, msg.to, msg.content);
        const saved = db.prepare("SELECT * FROM messages WHERE id = ?").get(info.lastInsertRowid);
        const payload = {
          type: "chat_message",
          id: saved.id,
          from: userId,
          to: msg.to,
          content: saved.content,
          read: false,
          created_at: saved.created_at,
        };
        sendToUser(msg.to, payload);
        sendToUser(userId, payload, ws); // echo to sender's other devices
        break;
      }

      // -----------------------------------------------------------------
      // ECDH key exchange — relay public key to target user
      // The server NEVER inspects or stores the key material.
      // -----------------------------------------------------------------
      case "key_exchange": {
        if (!msg.to || !msg.public_key) break;
        sendToUser(msg.to, {
          type: "key_exchange",
          from: userId,
          to: msg.to,
          public_key: msg.public_key,
        });
        break;
      }

      // -----------------------------------------------------------------
      // Group message — persist and relay to all group members
      // -----------------------------------------------------------------
      case "group_message": {
        const groupId = msg.group_id;
        if (!groupId || typeof msg.content !== "string" || msg.content.length === 0) break;
        if (msg.content.length > 65536) break;

        // C5: Verify sender is a member of this group before persisting.
        const membershipCheck = db
          .prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?")
          .get(groupId, userId);
        if (!membershipCheck) break;

        const sender = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
        const info = db
          .prepare(
            "INSERT INTO group_messages (group_id, from_user, from_username, from_display, content) VALUES (?, ?, ?, ?, ?)"
          )
          .run(groupId, userId, sender.username, sender.display_name || "", msg.content);
        const saved = db.prepare("SELECT * FROM group_messages WHERE id = ?").get(info.lastInsertRowid);

        const payload = {
          type: "group_message",
          id: saved.id,
          group_id: saved.group_id,
          from: saved.from_user,
          from_username: saved.from_username,
          from_display: saved.from_display,
          content: saved.content,
          created_at: saved.created_at,
        };

        // Send to all group members
        const memberIds = getGroupMemberIds(groupId);
        for (const memberId of memberIds) {
          sendToUser(memberId, payload, memberId === userId ? ws : undefined);
        }
        break;
      }

      // -----------------------------------------------------------------
      // Mark read — update DB and notify sender
      // -----------------------------------------------------------------
      case "mark_read": {
        if (msg.message_id) {
          // Mark specific message as read
          const m = db.prepare("SELECT * FROM messages WHERE id = ?").get(msg.message_id);
          if (m && m.to_user === userId) {
            db.prepare("UPDATE messages SET read = 1 WHERE id = ?").run(msg.message_id);
            sendToUser(m.from_user, {
              type: "mark_read",
              message_id: m.id,
              id: m.id,
              from: m.from_user,
              to: m.to_user,
              created_at: m.created_at,
            });
          }
        } else if (msg.from) {
          // Mark all messages from a user as read
          db.prepare(
            "UPDATE messages SET read = 1 WHERE from_user = ? AND to_user = ? AND read = 0"
          ).run(msg.from, userId);
          sendToUser(msg.from, {
            type: "mark_read",
            from: msg.from,
            to: userId,
          });
        }
        break;
      }

      // -----------------------------------------------------------------
      // Typing indicator — relay to target
      // -----------------------------------------------------------------
      case "typing": {
        if (!msg.to) break;
        sendToUser(msg.to, { type: "typing", from: userId });
        break;
      }

      // H2: Unknown message types are silently dropped.
      // Do NOT relay arbitrary payloads — a malicious client could fabricate
      // system message types (user_list, mark_read, message_deleted) and inject
      // them into another user's WebSocket stream.
      default:
        break;
    }
  });

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------
  ws.on("close", () => {
    const sockets = clients.get(userId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        clients.delete(userId);
        db.prepare("UPDATE users SET online = 0, last_seen = ? WHERE id = ?").run(
          new Date().toISOString(),
          userId
        );
      }
    }
    broadcastUserList();
  });

  ws.on("error", () => {
    ws.close();
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (_, res) => {
  const pkg = (() => { try { return require("./package.json"); } catch { return {}; } })();
  res.json({ status: "ok", service: "nano-SYNAPSYS", version: pkg.version || "1.5.2" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║         nano-SYNAPSYS Backend Server             ║
  ║                                                  ║
  ║   REST API:    http://localhost:${PORT}             ║
  ║   WebSocket:   ws://localhost:${PORT}/chat           ║
  ║   Database:    ${DB_PATH}    ║
  ╚══════════════════════════════════════════════════╝
  `);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  // Close WebSocket connections
  for (const [, sockets] of clients) {
    for (const ws of sockets) ws.close(1001, "Server shutting down");
  }
  clients.clear();
  // Close HTTP server
  server.close(() => {
    db.close();
    console.log("Database closed. Goodbye.");
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeMessage(m) {
  return {
    id: m.id,
    from_user: m.from_user,
    to_user: m.to_user,
    content: m.content,
    read: m.read === 1 || m.read === true,
    created_at: m.created_at,
  };
}

function sanitizeUser(row) {
  // H1: email is returned only for the user themselves (auth routes).
  // Public-facing calls (GET /api/users, contacts) use this same function but
  // email must not be visible to peers — callers that need email add it manually.
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    is_approved: !!row.is_approved,
    online: !!row.online,
    last_seen: row.last_seen,
    phone_number_hash: row.phone_number_hash || null,
    avatar_url: row.avatar_url || null,
  };
}
