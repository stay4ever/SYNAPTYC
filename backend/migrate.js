/**
 * nano-SYNAPSYS database migration
 * SQLite schema for users, messages, contacts, groups, and invites.
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "nano-synapsys.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    display_name  TEXT,
    is_approved   INTEGER NOT NULL DEFAULT 0,
    online        INTEGER NOT NULL DEFAULT 0,
    last_seen     TEXT,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now') || 'Z')
  );

  -- Direct messages
  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user   INTEGER NOT NULL REFERENCES users(id),
    to_user     INTEGER NOT NULL REFERENCES users(id),
    content     TEXT    NOT NULL,
    read        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now') || 'Z')
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(from_user, to_user, created_at);

  -- Contacts
  CREATE TABLE IF NOT EXISTS contacts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id  INTEGER NOT NULL REFERENCES users(id),
    receiver_id   INTEGER NOT NULL REFERENCES users(id),
    status        TEXT    NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','accepted','blocked')),
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now') || 'Z'),
    UNIQUE(requester_id, receiver_id)
  );

  -- Groups
  CREATE TABLE IF NOT EXISTS groups_ (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    created_by  INTEGER NOT NULL REFERENCES users(id),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now') || 'Z')
  );

  -- Group members
  CREATE TABLE IF NOT EXISTS group_members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id    INTEGER NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    username    TEXT    NOT NULL,
    display_name TEXT,
    role        TEXT    NOT NULL DEFAULT 'member'
                  CHECK(role IN ('admin','member')),
    UNIQUE(group_id, user_id)
  );

  -- Group messages
  CREATE TABLE IF NOT EXISTS group_messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id      INTEGER NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
    from_user     INTEGER NOT NULL REFERENCES users(id),
    from_username TEXT    NOT NULL,
    from_display  TEXT    NOT NULL DEFAULT '',
    content       TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now') || 'Z')
  );
  CREATE INDEX IF NOT EXISTS idx_group_messages_group
    ON group_messages(group_id, created_at);

  -- Invites
  CREATE TABLE IF NOT EXISTS invites (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token       TEXT    NOT NULL UNIQUE,
    created_by  INTEGER NOT NULL REFERENCES users(id),
    expires_at  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now') || 'Z')
  );
`);

// Add phone_number_hash column if upgrading from older schema
try { db.exec("ALTER TABLE users ADD COLUMN phone_number_hash TEXT"); } catch (_) {}

console.log("✅ Database migrated successfully:", DB_PATH);
db.close();
