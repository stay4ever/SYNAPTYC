#!/usr/bin/env bash
# Deploy nano-SYNAPSYS backend to Fly.io
# Usage: ./deploy-fly.sh
set -euo pipefail

echo "╔══════════════════════════════════════════════╗"
echo "║   nano-SYNAPSYS — Fly.io Deployment          ║"
echo "╚══════════════════════════════════════════════╝"

# Check prerequisites
if ! command -v flyctl &>/dev/null; then
  echo "Installing Fly CLI..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$HOME/.fly/bin:$PATH"
fi

if ! flyctl auth whoami &>/dev/null; then
  echo ""
  echo "Not logged in. Run: flyctl auth login"
  echo "Then re-run this script."
  exit 1
fi

cd "$(dirname "$0")"

# Launch app if not created yet
if ! flyctl status &>/dev/null; then
  echo ""
  echo "Creating Fly app..."
  flyctl launch --no-deploy --copy-config --name nano-synapsys --region syd

  echo "Creating persistent volume for SQLite..."
  flyctl volumes create synapsys_data --size 1 --region syd

  echo "Setting secrets..."
  JWT_SECRET=$(openssl rand -hex 32)
  flyctl secrets set \
    JWT_SECRET="$JWT_SECRET" \
    ALLOWED_ORIGINS="https://www.api.nanosynapsys.com"
fi

# Deploy
echo ""
echo "Deploying..."
flyctl deploy

echo ""
echo "✅ Deployment complete!"
echo ""
flyctl status
echo ""
echo "Next steps:"
echo "  1. Add custom domain:  flyctl certs create www.api.nanosynapsys.com"
echo "  2. Point DNS CNAME:    www.api.nanosynapsys.com → nano-synapsys.fly.dev"
echo "  3. Verify health:      curl https://nano-synapsys.fly.dev/health"
