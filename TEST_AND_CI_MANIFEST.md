# Test & CI/CD Files Manifest — nano-SYNAPSYS

Generated: 2026-03-21

## Unit Tests (nano-SYNAPSYSTests/)

### 1. EncryptionServiceTests.swift — 12 tests
- `test_generateKeyPair_createsValidKeys`
- `test_exportPublicKey_returnsBase64`
- `test_importPublicKey_fromBase64`
- `test_deriveSharedSecret_symmetric` — ECDH P-384 symmetric derivation
- `test_encryptDecrypt_roundTrip` — AES-256-GCM E2E test
- `test_encryptedMessage_hasENCPrefix` — Encryption marker validation
- `test_decrypt_invalidData_throws` — Error handling
- `test_decrypt_wrongKey_throws` — Security validation
- `test_nonce_uniqueness` — Randomization of each encryption
- `test_emptyMessage_roundTrip`
- `test_longMessage_roundTrip` — 10K character payload
- `test_specialCharacters_roundTrip` — Unicode, emoji support

### 2. KeychainServiceTests.swift — 8 tests
- `test_saveAndLoadString` — Keychain string storage
- `test_saveAndLoadData` — Binary data serialization
- `test_saveAndLoadSymmetricKey` — CryptoKit key persistence
- `test_overwriteExistingValue` — Update behavior
- `test_deleteValue` — Removal from secure storage
- `test_loadNonexistentKey_returnsNil` — Missing key handling
- `test_saveEmptyString` — Edge case: empty payload
- `test_deleteNonexistentKey_noError` — Idempotent deletion

### 3. ModelCodingTests.swift — 16 tests
- `test_appUser_decodesFromJSON` — AppUser model parsing
- `test_appUser_encodesAndDecodes` — Full round-trip JSON coding
- `test_appUser_initials_computed` — Display name initials logic
- `test_appUser_displayNameOrUsername` — Fallback name resolution
- `test_message_decodesFromJSON` — Message model parsing
- `test_message_isEncrypted_withPrefix` — ENC: prefix detection
- `test_message_isEncrypted_withoutPrefix` — Plain text detection
- `test_message_isFromCurrentUser` — Sender validation
- `test_contact_decodesFromJSON` — Contact model parsing
- `test_contact_displayNameOrUsername` — Contact name fallback
- `test_contact_initials` — Contact display initials
- `test_group_decodesFromJSON` — Group model parsing
- `test_groupMember_decodesFromJSON` — GroupMember model parsing
- `test_groupMessage_decodesFromJSON` — GroupMessage model parsing
- `test_groupMessage_isEncrypted` — Group message encryption detection
- `test_botMessage_uniqueIds` — BotMessage uniqueness (Banner AI)

### 4. ConfigTests.swift — 10 tests
- `test_baseURL_isHTTPS` — Security: HTTPS enforcement
- `test_wsURL_isWSS` — Security: WSS enforcement
- `test_allEndpoints_constructValidURLs` — All endpoints use HTTPS
- `test_loginEndpoint` — Login URL structure
- `test_messagesEndpoint` — Messages URL structure
- `test_contactsEndpoint` — Contacts URL structure
- `test_groupsEndpoint` — Groups URL structure
- `test_botEndpoint` — Bot (Banner) URL structure
- `test_appVersion_isSemver` — Version format (1.x.y)
- `test_bundleId` — Bundle ID validation

### 5. BotMessageTests.swift — 6 tests
- `test_botMessage_init` — BotMessage initialization
- `test_botMessage_uniqueIds` — Unique ID generation for Banner messages
- `test_botMessage_encodeDecode` — JSON serialization round-trip
- `test_botMessage_timestamp` — Timestamp preservation
- `test_botMessage_isFromUser` — BotMessage never from user
- `test_botMessage_equatable` — Equality comparison

### 6. WebSocketServiceTests.swift — 8 tests
- `test_wsMessage_decodeNewMessage` — Message type WSMessage parsing
- `test_wsMessage_decodeTyping` — Typing indicator parsing
- `test_wsMessage_decodePresence` — User presence parsing
- `test_wsMessage_decodeKeyExchange` — ECDH key exchange message parsing
- `test_wsMessage_decodeGroupMessage` — Group message type parsing
- `test_wsMessage_invalidJSON` — Error handling on malformed JSON
- `test_keyExchangeEvent_decode` — KeyExchangeEvent model parsing
- `test_keyExchangeEvent_encode` — KeyExchangeEvent JSON encoding

### 7. APIServiceTests.swift — 3 tests
- `test_apiError_descriptions` — APIError message strings
- `test_apiError_types` — Error case enumeration
- `test_apiError_equatable` — Error equality comparison

**Unit Test Total: 63 tests**

## UI Tests (nano-SYNAPSYSUITests/)

### 8. nano_SYNAPSYSUITests.swift — 4 tests
- `testSplashScreenAppears` — Launch screen verification
- `testLoginScreenElements` — Login form element presence
- `testRegistrationFlow` — Registration form validation
- `testAccessibilityLabels` — a11y compliance

### 9. nano_SYNAPSYSUITestsLaunchTests.swift — 1 test
- `testLaunchScreenshot` — Launch screenshot capture

**UI Test Total: 5 tests**

**Grand Total: 68 tests**

---

## CI/CD Workflows (.github/workflows/)

### 1. ios.yml — Build & Test Pipeline
**Trigger:** Push to main/develop, PRs to main/develop

**Jobs:**
- `build-and-test` (macOS 14, Xcode 15.2)
  - Checkout code
  - Install dependencies (CocoaPods)
  - Build for testing
  - Run unit tests → upload results
  - Build for release (Debug + Release configs)

- `lint` (SwiftLint)
  - Run SwiftLint with GitHub Actions reporting

### 2. testflight.yml — TestFlight Deployment
**Trigger:** Git tags matching `v*`

**Jobs:**
- `deploy-testflight` (macOS 14, Xcode 15.2)
  - Checkout code
  - Decode App Store Connect API key (.p8 from base64 secret)
  - Install Fastlane
  - Run `fastlane beta` → upload to TestFlight
  - Cleanup credentials
  - Slack notification on failure

**Required Secrets:**
- `ASC_KEY_ID` — App Store Connect key ID
- `ASC_ISSUER_ID` — App Store Connect issuer ID
- `ASC_API_KEY` — Base64-encoded .p8 private key file

### 3. check-testflight.yml — Build Status Monitor
**Trigger:** Manual dispatch (workflow_dispatch)

**Jobs:**
- `check-build-status` (Ubuntu, Python 3.11)
  - Decode App Store Connect API key
  - Query App Store Connect API for latest builds
  - Fetch app builds for `com.aievolve.nanosynapsys`
  - Report build processing state (5 latest builds)
  - Cleanup credentials

---

## Fastlane Configuration (fastlane/)

### 1. Fastfile — Build Automation Lanes

**Lanes:**
- `test` — Run unit tests via xcodebuild
- `build` — Build release archive (iphoneos SDK)
- `beta` — Full TestFlight submission pipeline
  - Code signing with `match`
  - Build with export method = app-store
  - Upload to TestFlight (skip processing wait)
  - Slack notification
  
- `release` — App Store submission
  - Run `beta` first
  - Submit latest build for review
  - Slack notification

- `ui_tests` — Run UI tests on iPhone 15 simulator

### 2. Appfile — App Configuration
- `app_identifier` → `com.aievolve.nanosynapsys`
- Apple ID and Team ID via environment variables
- iTunes Connect team configuration

---

## Test Naming Convention

All tests follow: `test_<function>_<scenario>()`

Examples:
- `test_generateKeyPair_createsValidKeys` — Crypto function test
- `test_saveAndLoadString` — Service persistence test
- `test_message_isEncrypted_withPrefix` — Model behavior test

---

## Security Notes

- Encryption tests validate ECDH P-384 + AES-256-GCM round-trip
- Keychain tests ensure secure token/key storage
- Config tests enforce HTTPS/WSS transport security
- TestFlight workflow uses secrets for API credentials (base64-encoded .p8)
- Credentials cleaned up after workflow completion
- All endpoints validated for HTTPS enforcement

---

## Build Command Reference

```bash
# Run all unit tests
xcodebuild -project nano-SYNAPSYS/nano-SYNAPSYS.xcodeproj \
  -scheme nano-SYNAPSYS \
  -sdk iphonesimulator \
  test

# Run UI tests
xcodebuild -project nano-SYNAPSYS/nano-SYNAPSYS.xcodeproj \
  -scheme nano-SYNAPSYS \
  -sdk iphonesimulator \
  -only-testing nano_SYNAPSYSUITests \
  test

# Build with Fastlane
fastlane ios test        # Run unit tests
fastlane ios build       # Build for release
fastlane ios beta        # Upload to TestFlight
fastlane ios ui_tests    # Run UI tests
```

---

**All files follow nano-SYNAPSYS architecture, security model, and coding conventions.**
