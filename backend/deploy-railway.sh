#!/usr/bin/env bash
# Deploy nano-SYNAPSYS backend to Railway
# Usage: ./deploy-railway.sh
set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║   nano-SYNAPSYS — Railway Deployment         ║"
echo "╚══════════════════════════════════════════════╝"

# Check prerequisites
if ! command -v railway &>/dev/null; then
  echo "Installing Railway CLI..."
  npm install -g @railway/cli
fi

if ! railway whoami &>/dev/null; then
  echo ""
  echo "Not logged in. Run: railway login"
  echo "Then re-run this script."
  exit 1
fi

cd "$(dirname "$0")"

# Initialize project if needed
if [ ! -f .railway/config.json ] 2>/dev/null; then
  echo ""
  echo "No Railway project linked. Initializing..."
  railway init
fi

# Set production environment variables
echo ""
echo "Setting environment variables..."
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)
railway variables set \
  NODE_ENV=production \
  JWT_SECRET="$JWT_SECRET" \
  JWT_EXPIRES=30d \
  DB_PATH=/data/nano-synapsys.db \
  BASE_URL=https://www.api.nanosynapsys.com \
  ALLOWED_ORIGINS=https://www.api.nanosynapsys.com \
  RATE_LIMIT_MAX=100 2>/dev/null || true

# Add persistent volume for SQLite
echo "Ensuring persistent volume exists..."
railway volume add --mount-path /data 2>/dev/null || true

# Deploy
echo ""
echo "Deploying..."
railway up

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Get your deployment URL:  railway open"
echo "  2. Set custom domain:        railway domain"
echo "  3. Point DNS for api.nanosynapsys.com to the Railway domain"
echo "  4. Verify health:            curl https://your-domain/health"
