#!/usr/bin/env bash
# One-time SyncPay server setup for Ubuntu/Debian. Safe to re-run.
#   sudo DOMAIN=syncpay.example.com bash setup.sh
#   sudo DOMAIN=... SKIP_CADDY=1 bash setup.sh   # a web server (e.g. nginx) already owns ports 80/443:
#                                                 # use deploy/nginx.conf instead of Caddy
# Before running: point the domain's DNS A record at this server, and allow ports 80 + 443.
set -euo pipefail

DOMAIN="${DOMAIN:-syncpay.acrossthe.cloud}"
SKIP_CADDY="${SKIP_CADDY:-}"
REPO="${REPO:-https://github.com/Ashishyg/SyncPay.git}"
APP=/opt/syncpay
WEB=/var/www/syncpay

[ "$(id -u)" = 0 ] || { echo "Please run with sudo"; exit 1; }
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

step "System packages"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg openssl build-essential python3 \
  debian-keyring debian-archive-keyring apt-transport-https

step "Node.js 22"
if ! node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

step "Caddy (web server with automatic HTTPS)"
if [ -z "$SKIP_CADDY" ]; then
  owner="$(ss -tlnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -o 'users:(("[^"]*' | sed 's/.*"//' | sort -u | xargs)"
  if [ -n "$owner" ] && ! { echo "$owner" | grep -qw caddy && systemctl is-active --quiet caddy; }; then
    echo "Ports 80/443 are used by: $owner"
    echo "That is not a system Caddy this script can extend (maybe Docker or nginx)."
    echo "Nothing was changed. Re-run with SKIP_CADDY=1 and configure that web server, or ask for help."
    exit 1
  fi
fi
if [ -z "$SKIP_CADDY" ] && ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

step "App user and code"
id syncpay >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin syncpay
if [ -d "$APP/.git" ]; then
  sudo -u syncpay -H git -C "$APP" pull --ff-only
else
  git clone "$REPO" "$APP"
fi
mkdir -p "$APP/backend/db" "$APP/backend/keys" "$APP/backend/wa_auth"

step "Backend settings (.env, created once)"
if [ ! -f "$APP/backend/.env" ]; then
  cat > "$APP/backend/.env" <<EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
WHATSAPP_ENABLED=true
TRUST_PROXY=1
EOF
  echo "Created $APP/backend/.env with a fresh random JWT secret"
fi
chown -R syncpay:syncpay "$APP"
chmod 600 "$APP/backend/.env"
chmod 700 "$APP/backend/keys" "$APP/backend/wa_auth"

step "Install and build"
bash "$APP/deploy/build.sh"

step "Background service"
cp "$APP/deploy/syncpay.service" /etc/systemd/system/syncpay.service
systemctl daemon-reload
systemctl enable syncpay
systemctl restart syncpay

if [ -z "$SKIP_CADDY" ]; then
  step "Caddy site for $DOMAIN (added alongside any existing sites)"
  sed "s/^DOMAIN {/$DOMAIN {/" "$APP/deploy/Caddyfile" > /etc/caddy/syncpay.caddy
  if [ ! -f /etc/caddy/Caddyfile ]; then
    echo "import syncpay.caddy" > /etc/caddy/Caddyfile
  elif ! grep -q '^import syncpay.caddy' /etc/caddy/Caddyfile; then
    cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-$(date +%Y%m%d%H%M%S)"   # untouched copy of your config
    printf '
import syncpay.caddy
' >> /etc/caddy/Caddyfile
  fi
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  systemctl enable caddy
  systemctl reload caddy || systemctl restart caddy
else
  step "Skipping Caddy: configure your web server with deploy/nginx.conf (see README)"
fi

step "Firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp && ufw allow 443/tcp
fi

step "Checks"
sleep 4
curl -fsS http://127.0.0.1:3000/api/health && echo "  backend OK" || { echo "  backend NOT responding: journalctl -u syncpay -n 50"; exit 1; }

cat <<EOF

Done. Open https://$DOMAIN (the certificate can take a minute on first visit).

Next: link WhatsApp (OTP codes won't send until you do). From YOUR computer:
  ssh -L 3000:127.0.0.1:3000 <user>@<server>
then open http://localhost:3000/whatsapp in your browser and scan the QR.

Back up these (never commit them): $APP/backend/keys  $APP/backend/.env  $APP/backend/db
Logs:   journalctl -u syncpay -f
Update: sudo bash $APP/deploy/update.sh
EOF
