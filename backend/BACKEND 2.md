# nano-SYNAPSYS Backend

Node.js server providing REST API + WebSocket relay for the nano-SYNAPSYS encrypted messaging app.

## Quick Start

```bash
cd backend
npm install
node migrate.js
node server.js
```

Server starts on `http://localhost:3000` with WebSocket at `ws://localhost:3000/chat`.

## Docker

```bash
cd backend
docker compose up --build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP/WS port |
| `JWT_SECRET` | dev default | **Change in production** |
| `JWT_EXPIRES` | `30d` | JWT token lifetime |
| `DB_PATH` | `./nano-synapsys.db` | SQLite database path |
| `BASE_URL` | `http://localhost:3000` | Public URL for invite links |

Copy `.env.example` to `.env` and set production values.

## REST API

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Get current user |
| POST | `/auth/password-reset` | Request password reset |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/:userId` | Get conversation history |
| POST | `/api/messages` | Send DM (persists `ENC:` and `KEX:` messages) |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List contacts |
| POST | `/api/contacts` | Send contact request |
| PATCH | `/api/contacts/:id` | Accept/block contact |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List user's groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id/messages` | Get group messages |
| POST | `/api/groups/:id/members` | Add member |
| DELETE | `/api/groups/:id/members` | Remove member |
| DELETE | `/api/groups/:id` | Delete group |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bot/chat` | AI bot chat |
| POST | `/api/invites` | Create invite link |
| GET | `/health` | Health check |

## WebSocket Protocol

Connect to `ws://host/chat?token=JWT_TOKEN`.

### Message Types Relayed

| Type | Direction | Description |
|------|-----------|-------------|
| `chat_message` | bidirectional | DM delivery — persisted to DB, relayed to recipient |
| `key_exchange` | bidirectional | ECDH public key relay — **NOT stored**, forwarded only |
| `group_message` | bidirectional | Group message — persisted, relayed to all members |
| `mark_read` | bidirectional | Read receipt — updates DB, notifies sender |
| `typing` | bidirectional | Typing indicator relay |
| `user_list` | server→client | Online presence broadcast on connect/disconnect |

### Key Exchange Flow

The server acts as a **transparent relay** for `key_exchange` messages. It never inspects or stores the ECDH public key material.

```
Alice → Server: {"type": "key_exchange", "to": 2, "public_key": "<base64>"}
Server → Bob:   {"type": "key_exchange", "from": 1, "to": 2, "public_key": "<base64>"}
```

Both `KEX:` prefixed REST messages (for offline exchange) and real-time `key_exchange` WebSocket messages are supported.

### Unknown Message Types

Any message with a `to` field but an unrecognized `type` is relayed as-is with `from` attached. This future-proofs the server for new client features.

## Security Notes

- The server **never sees plaintext message content** — all messages arrive pre-encrypted with `ENC:` prefix
- ECDH key material is relayed, not stored — the server cannot derive shared secrets
- JWT tokens authenticate all REST and WebSocket requests
- Passwords are hashed with bcrypt (12 rounds)
- SQLite WAL mode for concurrent read/write performance

## Integration Tests

```bash
node migrate.js
node server.js &
node test-integration.js
```

20 tests covering auth, messaging, contacts, groups, and all WebSocket relay types including `key_exchange`.
