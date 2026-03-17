#!/usr/bin/env bash
# Deploy nano-SYNAPSYS backend to a VPS (DigitalOcean, AWS EC2, Linode, etc.)
# Usage: ./deploy-vps.sh user@your-server-ip
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 user@server-ip"
  echo "  Example: $0 root@203.0.113.50"
  exit 1
fi

TARGET="$1"
APP_DIR="/opt/nano-synapsys"
SERVICE_NAME="nano-synapsys"

echo "╔══════════════════════════════════════════════╗"
echo "║   nano-SYNAPSYS — VPS Deployment             ║"
echo "║   Target: $TARGET"
echo "╚══════════════════════════════════════════════╝"

cd "$(dirname "$0")"

# Generate a JWT secret
JWT_SECRET=$(openssl rand -hex 32)

echo ""
echo "1/4 — Uploading files..."
ssh "$TARGET" "mkdir -p $APP_DIR/data"
scp package.json package-lock.json server.js migrate.js "$TARGET:$APP_DIR/"

echo ""
echo "2/4 — Installing dependencies on server..."
ssh "$TARGET" "cd $APP_DIR && \
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null && \
  apt-get install -y nodejs 2>/dev/null || true && \
  npm ci --production && \
  node migrate.js"

echo ""
echo "3/4 — Creating systemd service..."
ssh "$TARGET" "cat > /etc/systemd/system/${SERVICE_NAME}.service << 'UNIT'
[Unit]
Description=nano-SYNAPSYS Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=JWT_SECRET=${JWT_SECRET}
Environment=JWT_EXPIRES=30d
Environment=DB_PATH=${APP_DIR}/data/nano-synapsys.db
Environment=BASE_URL=https://www.api.nanosynapsys.com
Environment=ALLOWED_ORIGINS=https://www.api.nanosynapsys.com
Environment=RATE_LIMIT_MAX=100
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}"

echo ""
echo "4/4 — Setting up nginx reverse proxy with SSL..."
ssh "$TARGET" "apt-get install -y nginx certbot python3-certbot-nginx 2>/dev/null || true

cat > /etc/nginx/sites-available/${SERVICE_NAME} << 'NGINX'
server {
    listen 80;
    server_name www.api.nanosynapsys.com api.nanosynapsys.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/${SERVICE_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo 'Run: certbot --nginx -d www.api.nanosynapsys.com -d api.nanosynapsys.com'
"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Service status:"
ssh "$TARGET" "systemctl status ${SERVICE_NAME} --no-pager -l | head -15"
echo ""
echo "Next steps:"
echo "  1. Point DNS A record for api.nanosynapsys.com to your server IP"
echo "  2. Run on server: certbot --nginx -d www.api.nanosynapsys.com -d api.nanosynapsys.com"
echo "  3. Verify: curl https://www.api.nanosynapsys.com/health"
echo ""
echo "JWT_SECRET has been set to: ${JWT_SECRET}"
echo "Save this securely — you'll need it if you redeploy."
