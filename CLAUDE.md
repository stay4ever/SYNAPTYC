# CLAUDE.md — nano-SYNAPSYS

## Project Overview

nano-SYNAPSYS is a privacy-first, end-to-end encrypted iOS messaging app. Fully standalone — no shared infrastructure with any other service. No phone number required. No metadata harvested. It uses ECDH P-384 key exchange with AES-256-GCM encryption, real-time WebSocket communication, and a cyberpunk neon-green Matrix aesthetic.

- **Platform:** iOS 17.0+ (iPhone only, portrait)
- **Language:** Swift 5.0 / SwiftUI
- **Bundle ID:** `com.nanosynapsys`
- **Backend:** `https://api.nanosynapsys.com` (REST API + WSS)
- **No external dependencies** — purely Apple-native frameworks (CryptoKit, Combine, Security, UserNotifications)

## Architecture

**MVVM + Services layer** with singleton services and Combine-based reactivity.

```
nano-SYNAPSYS/
├── Config/           # API endpoints, Keychain keys, app constants
├── Models/           # Data structures: User, Message, Contact, Group, BotMessage
├── Services/         # Singletons: API, WebSocket, Encryption, Keychain, Notifications
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
├── Assets.xcassets/  # Image assets and app icons
└── Info.plist        # Capabilities, permissions, TLS enforcement
```

## Build & Run

This is a native Xcode project — no package managers (CocoaPods, SPM, Carthage).

```bash
# Open in Xcode
open nano-SYNAPSYS.xcodeproj

# Build from command line (requires Xcode 15+)
xcodebuild -project nano-SYNAPSYS.xcodeproj -scheme nano-SYNAPSYS -sdk iphonesimulator build

# Run tests
xcodebuild -project nano-SYNAPSYS.xcodeproj -scheme nano-SYNAPSYS -sdk iphonesimulator test
```

## Testing

Tests live in `nano-SYNAPSYSTests/nano_SYNAPSYSTests.swift` — 35 unit tests using XCTest.

**Test suites:**
- **EncryptionServiceTests** (10) — Round-trip encryption, ECDH key exchange, public key serialization, edge cases
- **KeychainServiceTests** (6) — Save/load strings, data, symmetric keys, overwrites, deletion
- **ModelCodingTests** (11) — JSON decoding of AppUser, Message, Contact; name/initials handling
- **ConfigTests** (5) — HTTPS/WSS validation, endpoint URL construction
- **BotMessageTests** (3) — Bot message initialization, uniqueness, encoding

**Test naming convention:** `test_<function>_<scenario>()` (e.g., `test_encryptDecrypt_roundTrip()`)

## Key Services

| Service | File | Purpose |
|---------|------|---------|
| `APIService.shared` | `Services/APIService.swift` | All HTTP calls (auth, messages, contacts, groups, bot) |
| `WebSocketService.shared` | `Services/WebSocketService.swift` | Real-time WSS: chat, typing indicators, presence |
| `EncryptionService` | `Services/EncryptionService.swift` | ECDH P-384 + AES-256-GCM per-conversation E2E encryption |
| `KeychainService` | `Services/KeychainService.swift` | Secure storage (JWT tokens, encryption keys) |
| `NotificationService.shared` | `Services/NotificationService.swift` | APNs + local notifications, badge management |

## Security Model

- **Key exchange:** ECDH P-384 per-conversation, shared secret via HKDF-SHA384
- **Message encryption:** AES-256-GCM; encrypted messages prefixed with `"ENC:"`
- **Token storage:** JWT in iOS Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`)
- **Screen security:** Auto-blur on background/inactive, screenshot alerts
- **Transport:** TLS 1.3 enforced via ATS; no arbitrary loads
- **Secrets:** `*.env` and `Secrets.swift` are git-ignored — never commit these

## Theme & Design System

Defined in `Theme/AppTheme.swift`. Cyberpunk Matrix aesthetic with neon-green palette.

**Key colors:**
- `#00ff41` neon green (primary), `#000e00` deep black (background), `#ff3333` alert red

**Typography:** All monospaced (`monoTitle`, `monoHeadline`, `monoBody`, `monoCaption`, `monoSmall`)

**Custom view modifiers:**
- `.neonCard()` — Glassmorphism dark card with neon border and glow
- `.glowText()` — Text glow shadow effect
- `.matrixBackground()` — Deep black background ignoring safe area

All new UI should follow this design language — dark backgrounds, neon green accents, monospaced fonts, glass-morphism cards.

## Conventions for AI Assistants

### Code style
- Swift 5.0, SwiftUI declarative syntax
- ViewModels are `@MainActor class` conforming to `ObservableObject` with `@Published` properties
- Services use singleton pattern (`static let shared`)
- Models conform to `Codable` and `Identifiable`
- No external dependencies — use only Apple-native frameworks

### Commit messages
Semantic format: `<type>: <description>`
- `feat:` new features
- `fix:` bug fixes
- `test:` test additions/changes
- `refactor:` code restructuring
- `docs:` documentation changes

### What not to do
- Do not add external package dependencies without explicit approval
- Do not store secrets, tokens, or keys in source code — use Keychain
- Do not use UserDefaults for sensitive data
- Do not break the neon-green Matrix design language
- Do not commit `*.env`, `Secrets.swift`, or `DerivedData/`

### When modifying encryption
- Preserve backward compatibility with `"ENC:"` prefix convention
- Test round-trip encryption/decryption for every change
- Maintain per-conversation key isolation
- Run the full EncryptionServiceTests suite after any change
