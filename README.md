# SYNAPTYC

> **Encrypted iOS Messaging — Beyond Signal. Beyond WhatsApp.**

A privacy-first, end-to-end encrypted iOS messaging app. Fully standalone with dedicated infrastructure. No phone number required. No metadata harvested. No compromise.

---

## Security Architecture

| Layer | Technology |
|-------|------------|
| Key Exchange | ECDH P-384 per-conversation, shared secret via HKDF-SHA384 |
| Message Encryption | AES-256-GCM; messages prefixed with `"ENC:"` |
| Token Storage | JWT in iOS Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) |
| Transport | WSS / HTTPS TLS 1.3 enforced via ATS |
| Screen Security | Auto-blur on background + screenshot alerts |

Every message is encrypted **on-device** before transmission. The server never sees plaintext.

---

## Features

- **E2E Encrypted Messaging** — AES-256-GCM with per-session ECDH key exchange
- **No Phone Number** — Email + username only
- **Disappearing Messages** — Per-conversation timers (24h / 7d / 30d)
- **AI Banner Bot** — Built-in AI assistant powered by Claude
- **Online Presence** — Real-time indicators via WebSocket
- **Read Receipts** — Double-check delivery confirmation
- **Screen Security** — Auto-blur on background, screenshot alerts
- **Contact Management** — Request / accept / block
- **Push Notifications** — APNs integration
- **Matrix Design** — Cyberpunk neon aesthetic

---

## Platform

- **iOS 17.0+** — iPhone only, portrait orientation
- **Language:** Swift 5.0 / SwiftUI
- **Bundle ID:** `com.nanosynapsys`
- **Backend:** `https://api.nanosynapsys.com` (REST API + WSS)
- **No external dependencies** — purely Apple-native frameworks (CryptoKit, Combine, Security, UserNotifications)

---

## Architecture

MVVM + Services layer with singleton services and Combine-based reactivity.

```
SYNAPTYC/
├── Config/           # API endpoints, environment config, app constants
├── Models/           # Data structures: User, Message, Contact, Group, BotMessage
├── Services/         # Singletons: API, WebSocket, Encryption, Keychain, Notifications
├── Protocols/        # Service protocols for dependency injection and testing
├── Extensions/       # Reusable Swift extensions
├── Theme/            # Design system: colors, typography, neon view modifiers
├── ViewModels/       # @MainActor ObservableObjects with @Published state
├── Views/            # SwiftUI views organized by feature
│   ├── Auth/         #   Login, Register, Splash
│   ├── Main/         #   Tab bar, Conversations list, Groups list
│   ├── Chat/         #   DM chat, Group chat, Message bubble, Typing indicator
│   ├── Bot/          #   Claude-powered AI assistant ("Banner")
│   ├── Contacts/     #   Contact list, Contact row
│   ├── Settings/     #   Security info, notifications, account
│   └── Components/   #   Reusable: NeonButton, NeonTextField, EncryptionBadge, OnlineDot
├── Resources/        # Localization strings
└── Assets.xcassets/  # Image assets, color assets, app icons
```

---

## Key Services

| Service | Purpose |
|---------|---------|
| `APIService.shared` | All HTTP calls (auth, messages, contacts, groups, bot) |
| `WebSocketService.shared` | Real-time WSS: chat, typing indicators, presence |
| `EncryptionService` | ECDH P-384 + AES-256-GCM per-conversation E2E encryption |
| `KeychainService` | Secure storage (JWT tokens, encryption keys) |
| `NotificationService.shared` | APNs + local notifications, badge management |

---

## Build & Run

Requires Xcode 15+. No package manager setup needed.

```bash
# Open in Xcode
open SYNAPTYC.xcodeproj

# Build from command line
xcodebuild -project SYNAPTYC.xcodeproj -scheme SYNAPTYC -sdk iphonesimulator build

# Run tests
xcodebuild -project SYNAPTYC.xcodeproj -scheme SYNAPTYC -sdk iphonesimulator test
```

---

## Design

Follows the SYNAPTYC design language defined in `Theme/AppTheme.swift`:

- Background `#000e00` — deep black
- Accent `#00ff41` — matrix green (primary)
- Alert `#ff3333` — red
- Monospaced typography throughout
- Glassmorphism dark cards with neon borders and glow effects

---

## Security Notes

- Never commit `*.env`, `Secrets.swift`, or `DerivedData/`
- Do not store sensitive data in UserDefaults — use Keychain
- Do not use arbitrary loads or bypass ATS

---

*SYNAPTYC — encrypted by default, private by design.*
