#SYNAPTYC

> **Encrypted iOS Messaging — Beyond Signal. Beyond WhatsApp.**

A privacy-first, end-to-end encrypted messaging app built for the AI Evolution ecosystem. No phone number required. No metadata harvested. No compromise.

---

## Security Architecture

| Layer | Technology |
|---|---|
| Key Exchange | ECDH P-384 |
| Message Encryption | AES-256-GCM |
| Token Storage | iOS Keychain |
| Transport | WSS / HTTPS TLS 1.3 |
| Screen Security | Background blur + screenshot detection |

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
- **Matrix Design** — AI Evolution aesthetic — dark green neon

---

## Requirements

- iOS 17.0+
- Xcode 15+
- Swift 5.9

## Backend

Connects to the AI Evolution backend at `https://www.ai-evolution.com.au`

---

## Design

Follows the AI Evolution design language:
- Background `#000e00`
- Accent `#00ff41` (matrix green)
- Monospaced typography
- Glassmorphism dark cards with neon borders

---

*nano-SYNAPSYS — encrypted by default, private by design.*
