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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3000", 10);
const JWT_SECRET = process.env.JWT_SECRET || "nano-synapsys-dev-secret-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "30d";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "nano-synapsys.db");
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const BCRYPT_ROUNDS = 12;
const NODE_ENV = process.env.NODE_ENV || "development";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : null; // null = allow all (dev), set in production
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "100", 10);

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

// Rate limiting (in-memory, per-IP)
const rateLimitMap = new Map();
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

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS * 2;
  for (const [ip, entry] of rateLimitMap) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, 300_000);

app.use(express.json({ limit: "1mb" }));

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
  const { username, email, password, display_name } = req.body;
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
  const info = db
    .prepare(
      "INSERT INTO users (username, email, password_hash, display_name, is_approved) VALUES (?, ?, ?, ?, 1)"
    )
    .run(username, email, hash, display_name || null);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = signToken(user.id);
  res.status(201).json({ token, user: sanitizeUser(user) });
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
  if (!user.is_approved) {
    return res.status(403).json({ error: "Account pending approval" });
  }
  const token = signToken(user.id);
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/auth/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: sanitizeUser(user) });
});

app.post("/auth/password-reset", (req, res) => {
  // Stub — in production send email with reset link
  res.json({ message: "If this email exists, a reset link has been sent." });
});

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

app.get("/api/users", authMiddleware, (req, res) => {
  const users = db.prepare("SELECT * FROM users WHERE is_approved = 1").all();
  res.json({ users: users.map(sanitizeUser) });
});

// ---------------------------------------------------------------------------
// MESSAGES
// ---------------------------------------------------------------------------

app.get("/api/messages/:userId", authMiddleware, (req, res) => {
  const otherId = parseInt(req.params.userId, 10);
  const messages = db
    .prepare(
      `SELECT * FROM messages
       WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
       ORDER BY created_at ASC`
    )
    .all(req.userId, otherId, otherId, req.userId);
  res.json({ messages });
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
  // "rejected" maps to a hard delete — no need to keep the row
  if (status === "rejected") {
    const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
    if (!contact) return res.status(404).json({ error: "Contact not found" });
    if (contact.requester_id !== req.userId && contact.receiver_id !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    db.prepare("DELETE FROM contacts WHERE id = ?").run(req.params.id);
    return res.json({ deleted: true });
  }
  db.prepare("UPDATE contacts SET status = ? WHERE id = ?").run(status, req.params.id);
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id);
  if (!contact) return res.status(404).json({ error: "Contact not found" });
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
  const messages = db
    .prepare("SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC")
    .all(req.params.groupId);
  res.json(messages);
});

app.post("/api/groups/:groupId/members", authMiddleware, (req, res) => {
  const { user_id } = req.body;
  const groupId = parseInt(req.params.groupId, 10);
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
  db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(
    req.params.groupId,
    user_id
  );
  res.json({ removed: true });
});

app.delete("/api/groups/:groupId", authMiddleware, (req, res) => {
  db.prepare("DELETE FROM groups_ WHERE id = ? AND created_by = ?").run(
    req.params.groupId,
    req.userId
  );
  res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------

app.get("/api/profile", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: sanitizeUser(user) });
});

app.put("/api/profile", authMiddleware, (req, res) => {
  const { display_name, bio } = req.body;
  if (display_name !== undefined && typeof display_name !== "string") {
    return res.status(400).json({ error: "display_name must be a string" });
  }
  if (bio !== undefined && typeof bio !== "string") {
    return res.status(400).json({ error: "bio must be a string" });
  }

  // Only update columns that were provided
  const updates = [];
  const values = [];
  if (display_name !== undefined) { updates.push("display_name = ?"); values.push(display_name.slice(0, 100)); }
  if (bio !== undefined)          { updates.push("bio = ?");          values.push(bio.slice(0, 500)); }

  if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

  values.push(req.userId);
  // Ignore "bio" column gracefully if it doesn't exist yet (migration may not have added it)
  try {
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  } catch {
    // bio column missing — retry without it
    const safeUpdates = updates.filter((u) => !u.startsWith("bio"));
    const safeValues = safeUpdates.map((u) => {
      if (u.startsWith("display_name")) return display_name.slice(0, 100);
      return undefined;
    }).filter(Boolean);
    if (safeUpdates.length === 0) return res.status(400).json({ error: "Nothing to update" });
    safeValues.push(req.userId);
    db.prepare(`UPDATE users SET ${safeUpdates.join(", ")} WHERE id = ?`).run(...safeValues);
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json({ user: sanitizeUser(user) });
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
// BOT (stub — proxies to external AI or returns a canned response)
// ---------------------------------------------------------------------------

app.post("/api/bot/chat", authMiddleware, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });
  // Stub response — replace with actual AI integration
  res.json({
    reply:
      "SYSTEM ONLINE — nano-SYNAPSYS AI relay operational. Backend bot integration pending.",
  });
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
  const allUsers = db.prepare("SELECT id, username, display_name, online FROM users WHERE is_approved = 1").all();
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
        if (!msg.to || !msg.content) break;
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

      // -----------------------------------------------------------------
      // Unknown types — relay as-is if they have a 'to' field
      // This future-proofs the server for new client message types.
      // -----------------------------------------------------------------
      default: {
        if (msg.to) {
          sendToUser(msg.to, { ...msg, from: userId });
        }
        break;
      }
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
  res.json({ status: "ok", service: "nano-SYNAPSYS", version: "1.5.1" });
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

function sanitizeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    display_name: row.display_name,
    is_approved: !!row.is_approved,
    online: !!row.online,
    last_seen: row.last_seen,
  };
}
