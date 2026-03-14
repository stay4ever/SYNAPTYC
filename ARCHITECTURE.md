# Architecture — nano-SYNAPSYS

## Overview

nano-SYNAPSYS is a privacy-first, end-to-end encrypted iOS messaging app with a standalone Node.js backend.

```
┌──────────────────────────────────────────────────────────┐
│                      iOS Client                          │
│                                                          │
│  ┌─────────┐  ┌────────────┐  ┌───────────────────────┐ │
│  │  Views   │→│ ViewModels │→│      Services          │ │
│  │ (SwiftUI)│  │(@Published)│  │ API·WS·Crypto·Keychain│ │
│  └─────────┘  └────────────┘  └───────────┬───────────┘ │
│                                            │             │
└────────────────────────────────────────────┼─────────────┘
                                             │
                              HTTPS/WSS TLS 1.3
                                             │
┌────────────────────────────────────────────┼─────────────┐
│                     Backend                │             │
│                                            ▼             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐       │
│  │ Express REST │  │ WebSocket    │  │ SQLite   │       │
│  │ API         │  │ Relay        │  │ (WAL)    │       │
│  └─────────────┘  └──────────────┘  └──────────┘       │
│                                                          │
│  api.nanosynapsys.com                                    │
└──────────────────────────────────────────────────────────┘
```

## iOS Architecture (MVVM + Services)

### Layer Responsibilities

| Layer | Role | Example |
|-------|------|---------|
| **Views** | UI rendering, user interaction | `ChatView`, `LoginView` |
| **ViewModels** | State management, business logic | `ChatViewModel`, `AuthViewModel` |
| **Services** | Network, crypto, storage | `APIService`, `EncryptionService` |
| **Models** | Data structures | `Message`, `AppUser`, `Contact` |
| **Config** | Constants, environment | `Config`, `Environment` |
| **Theme** | Design system | `AppTheme` |
| **Protocols** | Abstractions for DI | `ServiceProtocols` |
| **Extensions** | Reusable helpers | `View+Accessibility` |

### Data Flow

```
User Action → View → ViewModel → Service → Network
                ↑                              │
                └──── @Published binding ←──── ┘
```

1. User taps "Send" in `ChatView`
2. `ChatView` calls `vm.send(text)`
3. `ChatViewModel.send()` encrypts via `EncryptionService`
4. Sends encrypted payload via `APIService` (REST) + `WebSocketService` (real-time)
5. Response updates `@Published var messages`
6. SwiftUI re-renders `ChatView`

### Encryption Flow

```
Sender                              Receiver
  │                                    │
  │  1. Generate ECDH P-384 keypair    │
  │  2. Send public key (KEX:)    ──→  │
  │                                    │  3. Generate ECDH P-384 keypair
  │  ←──  4. Send public key (KEX:)    │
  │                                    │
  │  5. HKDF-SHA384 → shared secret    │  5. HKDF-SHA384 → shared secret
  │                                    │
  │  6. AES-256-GCM encrypt       ──→  │  7. AES-256-GCM decrypt
  │     (content prefixed "ENC:")      │
```

- Per-conversation ECDH key exchange
- Shared secret stored in iOS Keychain
- Key exchange messages (`KEX:`) persisted via REST for offline peers
- Real-time key exchange also sent via WebSocket for online peers

### Service Dependencies

```
AuthViewModel ─→ APIService ─→ URLSession
      │                              │
      └─→ KeychainService           │
      └─→ WebSocketService ─→ URLSessionWebSocketTask
      └─→ NotificationService ─→ UNUserNotificationCenter

ChatViewModel ─→ APIService
      │         EncryptionService ─→ CryptoKit
      │         WebSocketService
      └─→ KeychainService
```

## Backend Architecture

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | JWT authentication |
| GET | `/auth/me` | Current user info |
| POST | `/auth/password-reset` | Password reset |
| GET | `/api/users` | List all users |
| GET/POST | `/api/messages/:userId` | DM messages |
| GET/POST/PATCH | `/api/contacts/:id` | Contact management |
| GET/POST/DELETE | `/api/groups/:id` | Group CRUD |
| POST | `/api/bot/chat` | AI assistant |
| POST | `/api/invites` | Invite link generation |
| GET | `/health` | Health check |

### WebSocket Message Types

| Type | Direction | Persisted | Purpose |
|------|-----------|-----------|---------|
| `chat_message` | Bidirectional | Yes | DM delivery |
| `key_exchange` | Relay only | No | ECDH public key exchange |
| `group_message` | Bidirectional | Yes | Group chat |
| `mark_read` | Sender→Server | Yes | Read receipts |
| `typing` | Relay only | No | Typing indicators |
| `user_list` | Server→Client | No | Online presence |

### Security Model

The server is a **transparent relay** — it never sees plaintext message content:

- Messages arrive encrypted (`ENC:` prefix) and are stored encrypted
- Key exchange messages (`KEX:`) contain only public keys
- JWT tokens (30-day TTL) for REST and WebSocket auth
- Passwords hashed with bcrypt (12 rounds)
- Rate limiting, CORS lockdown, security headers (HSTS, X-Frame-Options)

## Directory Structure

```
nano-SYNAPSYS/
├── nano-SYNAPSYS/               # iOS app source
│   ├── Config/                  #   API endpoints, environment config
│   ├── Models/                  #   Data structures (Codable)
│   ├── Services/                #   Singletons: API, WS, Crypto, Keychain
│   ├── Protocols/               #   Service protocols for DI/testing
│   ├── Extensions/              #   Reusable Swift extensions
│   ├── Theme/                   #   Design system (colors, fonts, modifiers)
│   ├── ViewModels/              #   @MainActor ObservableObjects
│   ├── Views/                   #   SwiftUI views by feature
│   │   ├── Auth/                #     Login, Register, Splash
│   │   ├── Main/                #     Tab bar, Conversations, Groups
│   │   ├── Chat/                #     DM chat, Group chat, Bubbles
│   │   ├── Bot/                 #     AI assistant
│   │   ├── Contacts/            #     Contact list and management
│   │   ├── Settings/            #     Security info, account
│   │   └── Components/          #     Reusable UI components
│   ├── Resources/               #   Localization strings
│   └── Assets.xcassets/         #   Images and app icons
├── nano-SYNAPSYSTests/          # Unit tests (XCTest)
├── nano-SYNAPSYSUITests/        # UI automation tests (XCUITest)
├── backend/                     # Node.js backend server
│   ├── server.js                #   Express + WebSocket
│   ├── migrate.js               #   SQLite schema
│   └── test-integration.js      #   Integration tests
├── .github/workflows/           # CI/CD pipelines
│   └── ios.yml                  #   Build, test, lint
└── .swiftlint.yml               # Code style enforcement
```
