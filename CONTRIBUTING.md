# Contributing to nano-SYNAPSYS

Thank you for your interest in contributing to nano-SYNAPSYS.

## Getting Started

### Prerequisites

- macOS 14+ (Sonoma)
- Xcode 15+
- iOS 17.0+ simulator or device
- Node.js 18+ (for backend development)

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/nano-SYNAPSYS.git
cd nano-SYNAPSYS

# Open in Xcode
open nano-SYNAPSYS.xcodeproj

# Build and run
# Select an iPhone 15 simulator, then Cmd+R
```

### Backend (optional, for full-stack development)

```bash
cd backend
cp .env.example .env
npm install
node migrate.js
node server.js
```

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes following the conventions below

3. Run all tests:
   ```bash
   xcodebuild test -project nano-SYNAPSYS.xcodeproj -scheme nano-SYNAPSYS -sdk iphonesimulator
   ```

4. Commit using semantic commit messages (see below)

5. Open a pull request against `main`

## Code Conventions

### Swift Style

- Swift 5.0, SwiftUI declarative syntax
- ViewModels: `@MainActor class` conforming to `ObservableObject` with `@Published` properties
- Services: singleton pattern (`static let shared`)
- Models: conform to `Codable` and `Identifiable`
- No external dependencies — Apple-native frameworks only (CryptoKit, Combine, Security, UserNotifications)

### Naming

- Test methods: `test_<function>_<scenario>()` (e.g., `test_encryptDecrypt_roundTrip()`)
- Files named after their primary type (e.g., `ChatViewModel.swift`)

### Commit Messages

Semantic format: `<type>: <description>`

| Type | Description |
|------|-------------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `test:` | Test additions/changes |
| `refactor:` | Code restructuring |
| `docs:` | Documentation |
| `ci:` | CI/CD changes |
| `style:` | Formatting, lint fixes |

### UI/Design

All new UI must follow the nano-SYNAPSYS design language:

- Background: `#000e00` (deep black)
- Accent: `#00ff41` (neon green)
- Typography: monospaced fonts only
- Cards: glassmorphism with neon borders (`.neonCard()`)
- Text glow: `.glowText()` on headers

### Security

- Never store secrets in source code — use iOS Keychain
- Preserve backward compatibility with `ENC:` prefix for encrypted messages
- Test round-trip encryption/decryption for every cryptographic change
- Run the full `EncryptionServiceTests` suite after any encryption changes

## What NOT to Do

- Do not add external package dependencies without explicit approval
- Do not use `UserDefaults` for sensitive data
- Do not commit `*.env`, `Secrets.swift`, or `DerivedData/`
- Do not break the Matrix neon-green design language

## Testing

We aim for comprehensive test coverage:

- **Unit tests** in `nano-SYNAPSYSTests/` — one file per service/model
- **UI tests** in `nano-SYNAPSYSUITests/` — screen-level automation
- **Backend integration tests** in `backend/test-integration.js`

Run tests before every PR submission.

## Questions?

Open an issue in the repository for any questions about contributing.
