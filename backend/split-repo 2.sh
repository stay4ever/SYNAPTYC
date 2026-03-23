#!/usr/bin/env bash
# Split the backend into its own independent git repository.
#
# Usage: ./split-repo.sh [target-directory]
#   Default target: ../nano-SYNAPSYS-backend
#
# This creates a new standalone git repo for the backend with its own
# commit history, fully segregated from the iOS app repository.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$(dirname "$SCRIPT_DIR")/nano-SYNAPSYS-backend}"

echo "╔══════════════════════════════════════════════╗"
echo "║   Splitting backend into standalone repo     ║"
echo "║   Target: $TARGET"
echo "╚══════════════════════════════════════════════╝"

if [ -d "$TARGET" ]; then
  echo "❌ Target directory already exists: $TARGET"
  echo "   Remove it first or specify a different path."
  exit 1
fi

# Create new repo structure
mkdir -p "$TARGET/.github/workflows"
cp -r "$SCRIPT_DIR"/* "$TARGET/"
cp "$SCRIPT_DIR/.gitignore" "$TARGET/" 2>/dev/null || true
cp "$SCRIPT_DIR/.env.example" "$TARGET/" 2>/dev/null || true

# Move GitHub workflow into proper location
if [ -f "$TARGET/deploy-backend.yml.github-workflow" ]; then
  mv "$TARGET/deploy-backend.yml.github-workflow" "$TARGET/.github/workflows/deploy.yml"
  # Update paths filter since backend/ is now the root
  sed -i 's|paths:|# paths:|' "$TARGET/.github/workflows/deploy.yml"
  sed -i 's|- "backend/\*\*"|# (triggers on all pushes to main)|' "$TARGET/.github/workflows/deploy.yml"
  sed -i 's|working-directory: backend||' "$TARGET/.github/workflows/deploy.yml"
fi

cd "$TARGET"

# Remove the split script itself from the new repo
rm -f split-repo.sh

# Initialize fresh git repo
git init -b main
git add -A
git commit -m "feat: initial commit — nano-SYNAPSYS backend server

Standalone Node.js/Express backend for the nano-SYNAPSYS encrypted messaging app.
Fully segregated from the iOS client repository.

- REST API: auth, messages, contacts, groups, bot, invites
- WebSocket relay: chat_message, key_exchange, group_message, mark_read, typing
- SQLite + WAL mode
- Production hardening: rate limiting, CORS, security headers, graceful shutdown
- Deploy configs: Railway, Fly.io, VPS, Docker, GitHub Actions CI/CD
- 20 passing integration tests"

echo ""
echo "✅ Backend repo created at: $TARGET"
echo ""
echo "Next steps:"
echo "  1. cd $TARGET"
echo "  2. Create a new GitHub repo:"
echo "     gh repo create nano-SYNAPSYS-backend --private --source=. --push"
echo "  3. Or manually:"
echo "     git remote add origin git@github.com:YOUR_ORG/nano-SYNAPSYS-backend.git"
echo "     git push -u origin main"
echo ""
echo "Then remove backend/ from the iOS repo:"
echo "  cd $(dirname "$SCRIPT_DIR")"
echo "  git rm -r backend/"
echo "  git commit -m 'refactor: remove backend (moved to nano-SYNAPSYS-backend repo)'"
