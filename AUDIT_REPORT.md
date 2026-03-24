# SYNAPTYC Full-Stack Audit Report
**Date:** 2026-03-24
**Version audited:** 1.5.2 build 202603241849
**Scope:** backend/server.js, backend/migrate.js, all SYNAPTYC/*.swift source files
**Auditor:** Claude Code (senior full-stack review)

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 6     | Open |
| HIGH     | 5     | Open |
| MEDIUM   | 9     | Open |
| LOW      | 8     | Open |
| **Total**| **28**| **Awaiting fix approval** |

---

## CRITICAL

### C1 — PATCH /api/contacts/:id: Missing authorization for status updates
**File:** `backend/server.js:333`
**Issue:** After the `"rejected"` branch (which correctly checks ownership), the fallback `UPDATE` statement runs `db.prepare("UPDATE contacts SET status = ? WHERE id = ?").run(status, req.params.id)` with no check that `req.userId` is party to the contact. Any authenticated user can change any contact row's status — e.g., force-accept contact requests between two other users, or block contacts they have no relation to.
**Fix:** Add `WHERE id = ? AND (requester_id = ? OR receiver_id = ?)` to the UPDATE, and verify the row exists before returning.

---

### C2 — GET /api/groups/:groupId/messages: No group membership check
**File:** `backend/server.js:423-428`
**Issue:** `SELECT * FROM group_messages WHERE group_id = ?` — no verification that `req.userId` is a member of `groupId`. Any authenticated user can read the full message history of any group.
**Fix:** Add a membership sub-query: `AND EXISTS (SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?)`.

---

### C3 — POST /api/groups/:groupId/members: No admin authorization
**File:** `backend/server.js:430-443`
**Issue:** Any authenticated user can add any user to any group — no check that the caller is a member or admin of the group.
**Fix:** Before inserting, verify `req.userId` is an admin in `group_members` for `groupId`. Return 403 if not.

---

### C4 — DELETE /api/groups/:groupId/members: No authorization
**File:** `backend/server.js:445-452`
**Issue:** `DELETE FROM group_members WHERE group_id = ? AND user_id = ?` — no check that the caller has permission. Any user can evict any member from any group.
**Fix:** Require caller to be an admin of the group, or allow only self-removal.

---

### C5 — WebSocket group_message: No membership verification
**File:** `backend/server.js:879-909`
**Issue:** The `group_message` WebSocket handler inserts and relays messages for any `group_id` without verifying the sending user is a member. Any authenticated WebSocket client can inject messages into any group.
**Fix:** Before inserting, query `group_members` and break/return if `userId` is not a member of `groupId`.

---

### C6 — Hardcoded default JWT secret
**File:** `backend/server.js:26`
**Issue:** `const JWT_SECRET = process.env.JWT_SECRET || "nano-synapsys-dev-secret-change-in-production"` — the fallback is a known public string. If the env var is not set in production, any attacker can sign valid JWTs and impersonate any user.
**Fix:** Remove the fallback entirely and fail fast: `if (!process.env.JWT_SECRET) { console.error("FATAL: JWT_SECRET not set"); process.exit(1); }`.

---

## HIGH

### H1 — GET /api/users: Exposes all users including email addresses
**File:** `backend/server.js:222-224`, `server.js:1059`
**Issue:** `SELECT * FROM users` returns every user in the database to any authenticated user. `sanitizeUser` includes the `email` field. This enables user enumeration and exposes private emails.
**Fix:** Remove `email` from `sanitizeUser`. Consider filtering to only return approved contacts, or at minimum add pagination (`LIMIT`/`OFFSET`).

---

### H2 — WebSocket default relay: Unvalidated message type forwarding
**File:** `backend/server.js:956-961`
**Issue:** The `default:` case forwards any unrecognised message type to `msg.to` with `from: userId` added. A malicious client can fabricate custom message types (e.g., `"user_list"`, `"mark_read"`, `"message_deleted"`) and inject them directly into another user's WebSocket stream.
**Fix:** Remove the default relay case entirely, or whitelist only specific future-safe types.

---

### H3 — WebSocket chat_message: No content size validation
**File:** `backend/server.js:841-845`
**Issue:** The REST `POST /api/messages` enforces a 64 KB content limit, but the equivalent WebSocket `chat_message` handler stores `msg.content` directly without any size check. The REST and WS paths are inconsistent.
**Fix:** Add `if (!msg.content || typeof msg.content !== "string" || msg.content.length === 0 || msg.content.length > 65536) break;` before the INSERT.

---

### H4 — Banner AI: No per-endpoint rate limiting on expensive LLM calls
**File:** `backend/server.js:629-727`
**Issue:** `/api/bot/chat` is subject only to the shared 100 req/min IP-level rate limit. Each call can invoke up to 4 LLM API calls (4 × 1024 tokens × claude-opus-4-6). A single user hitting 100 req/min could generate significant Anthropic API costs.
**Fix:** Add a stricter per-user rate limit (e.g., 10 req/min) for the bot endpoint. Track by `req.userId` not just IP.

---

### H5 — Banner AI: No conversation history size limit
**File:** `backend/server.js:662`
**Issue:** `conversation.map((m) => ({ role: m.role, content: m.content }))` is processed without any length or total-token guard. A client can send an arbitrarily large conversation array, causing server memory pressure and large upstream API calls.
**Fix:** Limit the conversation array to the last N messages (e.g., 20) and cap each message's content length (e.g., 4096 chars).

---

## MEDIUM

### M1 — PUT /api/profile: Retry-without-bio drops phone number updates
**File:** `backend/server.js:519-526`
**Issue:** The catch block (fired when the `bio` column doesn't exist) rebuilds `safeValues` by mapping only `display_name` from the `safeUpdates` array — `phone_number_hash` and `phone_number_hashes` are silently dropped. A user updating their phone number in the same request as display_name would lose the phone update if `bio` is absent.
**Fix:** Add the `bio` column to `migrate.js` (see M2) to eliminate the need for this workaround entirely.

---

### M2 — `bio` column missing from schema
**File:** `backend/migrate.js` (users table definition)
**Issue:** The `users` table has no `bio` column. `server.js` tries to write to `bio` on every `PUT /api/profile` call and relies on a try/catch fallback. Fresh installations always fail the first attempt, and any retry issues (M1) stem from this.
**Fix:** Add `bio TEXT DEFAULT NULL` to the users table in `migrate.js`. Add inline migration `try { db.prepare("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL").run(); } catch (_) {}` in `server.js` alongside the existing column migrations.

---

### M3 — DELETE /api/groups/:groupId: Silent failure
**File:** `backend/server.js:454-459`
**Issue:** `DELETE FROM groups_ WHERE id = ? AND created_by = ?` returns `{deleted: true}` even if no row was affected (group doesn't exist or caller isn't the creator). The caller has no way to detect an authorisation failure.
**Fix:** Check `db.prepare(...).run().changes` and return 404 or 403 accordingly.

---

### M4 — POST /api/profile/avatar: No image content validation
**File:** `backend/server.js:544-547`
**Issue:** The decoded buffer is written directly to disk as a `.jpg` file without verifying it contains a valid JPEG (magic bytes `FF D8 FF`). Arbitrary binary data is accepted and served as a static file.
**Fix:** Check the first 3 bytes of the buffer for the JPEG magic number. Reject non-JPEG uploads with 400.

---

### M5 — Disappearing messages are client-side only
**File:** `SYNAPTYC/ViewModels/ChatViewModel.swift:329-332`, `backend/server.js` (no TTL support)
**Issue:** `disappearsAt` is set and enforced entirely on the iOS client. The server never receives or enforces a message TTL. A user on a new device (or any non-iOS client) can retrieve messages that have "expired" on the sender's device, defeating the disappearing message guarantee.
**Fix (future):** Add an optional `expires_at` column to the `messages` table. Server should exclude expired messages from `GET /api/messages/:userId` responses and run a periodic cleanup job.

---

### M6 — Config.App.build is stale
**File:** `SYNAPTYC/Config/Config.swift:35`
**Issue:** `static let build = "202603240514"` — this is the previous build number. The current TestFlight build is `202603241849`. SettingsView and any debug display will show the wrong build number.
**Fix:** Update to `"202603241849"`.

---

### M7 — Stale `Config 2/` directory
**File:** `SYNAPTYC/Config 2/Config.swift`
**Issue:** A second `Config.swift` with old `ai-evolution.com.au` endpoints and version `1.1.0` exists on disk. It is not included in `project.pbxproj` so it won't be compiled, but it causes confusion about the active backend URL.
**Fix:** Delete `SYNAPTYC/Config 2/` from the repository.

---

### M8 — No input length validation on group name
**File:** `backend/server.js:406`
**Issue:** `if (!name) return res.status(400).json(...)` — any truthy string is accepted. A 10 MB group name string would be stored in SQLite.
**Fix:** Add `if (name.length > 100) return res.status(400).json({ error: "Group name too long (max 100 chars)" });`.

---

### M9 — GET /api/messages/:userId: No pagination
**File:** `backend/server.js:230-240`
**Issue:** All messages between two users are returned in a single query with no LIMIT. A long-running conversation (thousands of messages) could cause significant memory and latency.
**Fix:** Add `LIMIT 200 OFFSET ?` with a `before_id` cursor parameter as an optional query param.

---

## LOW

### L1 — Health check version hardcoded to 1.5.1
**File:** `backend/server.js:993`
**Issue:** `{ status: "ok", service: "nano-SYNAPSYS", version: "1.5.1" }` — stale version string.
**Fix:** Set version from an env var or `package.json` constant.

---

### L2 — No password strength validation in iOS
**File:** `SYNAPTYC/ViewModels/AuthViewModel.swift:101-123` (register)
**Issue:** No minimum password length or strength check before the API call. A 1-character password is accepted by the client and (unless the server rejects it, which it doesn't) will be stored.
**Fix:** Add a guard in `AuthViewModel.register`: `guard password.count >= 8 else { errorMessage = "Password must be at least 8 characters"; return }`. Add corresponding server-side check.

---

### L3 — `ISO8601DateFormatter()` instantiated per message
**File:** `SYNAPTYC/Services/WebSocketService.swift:197, 221`
**Issue:** `ISO8601DateFormatter()` is instantiated inline when constructing each incoming message. Date formatters are expensive to initialise and should be shared instances.
**Fix:** Create a static let `private static let isoFormatter = ISO8601DateFormatter()` and reference it in both call sites.

---

### L4 — `biometricsEnabled` setting stored in UserDefaults
**File:** `SYNAPTYC/ViewModels/AuthViewModel.swift:12`
**Issue:** `UserDefaults.standard.bool(forKey: "biometrics_enabled")` — UserDefaults is not encrypted. On a jailbroken device an attacker could disable the biometric gate by flipping this flag.
**Fix:** Store the biometrics setting in the Keychain via `KeychainService.save`.

---

### L5 — JWT 30-day expiry with no refresh mechanism
**File:** `backend/server.js:27`
**Issue:** Tokens expire after 30 days with no refresh path. When a token expires the user is silently logged out on the next API call. There is no token rotation or sliding-window renewal.
**Fix:** Implement a `POST /auth/refresh` endpoint that issues a new short-lived access token given a valid long-lived refresh token, or extend the token expiry and add explicit invalidation on logout.

---

### L6 — deleteMessage silently swallows API errors
**File:** `SYNAPTYC/ViewModels/ChatViewModel.swift:337-339`
**Issue:** `Task { try? await APIService.shared.deleteMessage(id: id) }` — if the server returns an error (e.g., 403), the message is already removed from the local UI with no feedback. The server and client are now out of sync.
**Fix:** Capture the error and restore the message or show an alert: `do { try await ... } catch { errorMessage = error.localizedDescription; messages.append(msg) }`.

---

### L7 — `Environment.swift` is unreferenced dead code
**File:** `SYNAPTYC/Config/Environment.swift`
**Issue:** `AppEnvironment` defines a full environment-switching enum but is never referenced anywhere in the codebase. `Config.swift` hardcodes URLs directly. The file adds noise and false confidence that environment switching is active.
**Fix:** Either wire `AppEnvironment.current` into `Config.swift`, or delete `Environment.swift`.

---

### L8 — In-memory rate-limit map grows unboundedly under sustained traffic
**File:** `backend/server.js:120-125`
**Issue:** The cleanup interval fires every 5 minutes with a `cutoff = now - RATE_LIMIT_WINDOW_MS * 2` (2 minutes). Entries within the last 2 minutes are never pruned, so under constant moderate traffic from many IPs the map grows continuously.
**Fix:** Change the cutoff to `now - RATE_LIMIT_WINDOW_MS` so entries expire as soon as their window closes.

---

## Cross-cutting Notes

### Group E2E encryption (known limitation, not a new finding)
The GKEX key distribution sends the raw AES-256 symmetric key in plaintext over the group WebSocket channel. The server can read every group encryption key. This is documented in `GroupChatViewModel.swift` and `memory/project_synaptyc.md`. A proper fix (Sender Keys or MLS) is a significant future project.

### KEX public keys persisted as messages
`ChatViewModel.swift:205` sends ECDH public keys via `POST /api/messages`. This stores every key exchange event in the messages table, giving the server a record of when key exchanges occurred between users. The keys themselves are not secret, but the metadata is.

### `Config 2/` vs active `Config/`
The active backend is `nano-synapsys-server.fly.dev` (Fly.io). The project memory previously recorded `ai-evolution.com.au` as the backend — this is the old `Config 2` URL and is no longer active. The memory entry should be updated.

---

## Proposed Fix Order

Phase 4 fixes should proceed in this order:

1. **C6** — JWT_SECRET guard (fail-fast, one line)
2. **C1** — PATCH /api/contacts authorization
3. **C2** — GET /api/groups messages membership check
4. **C3** — POST members admin check
5. **C4** — DELETE members authorization
6. **C5** — WS group_message membership check
7. **H2** — WS default relay removal
8. **H3** — WS chat_message size check
9. **M2** — Add bio column to migrate.js (unblocks M1)
10. **M1** — Fix profile retry logic (or remove entirely once M2 done)
11. **M3** — Group delete feedback
12. **M4** — Avatar MIME validation
13. **M6** — Update Config.App.build
14. **M7** — Delete Config 2 directory
15. **M8** — Group name length limit
16. **H1** — Remove email from sanitizeUser
17. **L1** — Health check version
18. **L2** — Password length validation
19. **L3** — ISO8601 formatter as static
20. **L6** — deleteMessage error handling
21. **L7** — Remove or wire Environment.swift
22. **L8** — Rate-limit map cleanup fix

H4, H5 (bot rate limiting), M5 (server-side disappearing messages), L4 (biometrics in Keychain), and L5 (JWT refresh) are deferred — they require more design discussion.

---

*Awaiting approval to proceed with Phase 4 fixes.*
