#!/usr/bin/env bash
# One-time SyncPay server setup for Ubuntu/Debian. Safe to re-run.
#   sudo DOMAIN=syncpay.example.com bash setup.sh
#
# Designed to share a server with other apps:
#   - SyncPay gets its OWN Node.js (/opt/syncpay-node); the system Node is never touched.
#   - It listens on its own port (default 3100); setup stops if that port is taken.
#   - An existing system Caddy is extended (a backup of its Caddyfile is kept), never replaced.
#   - If another web server (nginx, Docker...) owns ports 80/443, nothing is changed:
#     re-run with SKIP_CADDY=1 and use deploy/nginx.conf.
# Before running: point the domain's DNS A record at this server and allow ports 80 + 443.
set -euo pipefail

DOMAIN="${DOMAIN:-syncpay.acrossthe.cloud}"
SKIP_CADDY="${SKIP_CADDY:-}"
REPO="${REPO:-https://github.com/Ashishyg/SyncPay.git}"
APP=/opt/syncpay
NODE_DIR=/opt/syncpay-node
WEB=/var/www/syncpay

[ "$(id -u)" = 0 ] || { echo "Please run with sudo"; exit 1; }
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

# Keep the port from an earlier run; otherwise 3100
PORT="${PORT:-$(grep -E '^PORT=' "$APP/backend/.env" 2>/dev/null | cut -d= -f2 || true)}"
PORT="${PORT:-3100}"

step "Pre-flight checks (nothing is changed yet)"
if ss -tlnH "sport = :$PORT" | grep -q . && ! systemctl is-active --quiet syncpay; then
  echo "Port $PORT is already in use by:"
  ss -tlnpH "sport = :$PORT"
  echo "Nothing was changed. Pick a free port:  sudo PORT=3200 DOMAIN=$DOMAIN bash setup.sh"
  exit 1
fi
if [ -z "$SKIP_CADDY" ]; then
  owner="$(ss -tlnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -o 'users:(("[^"]*' | sed 's/.*"//' | sort -u | xargs)"
  if [ -n "$owner" ] && ! { echo "$owner" | grep -qw caddy && systemctl is-active --quiet caddy; }; then
    echo "Ports 80/443 are used by: $owner"
    echo "That is not a system Caddy this script can extend (maybe Docker or nginx)."
    echo "Nothing was changed. Re-run with SKIP_CADDY=1 and configure that web server (deploy/nginx.conf)."
    exit 1
  fi
fi
echo "OK: SyncPay will use port $PORT"

step "System packages"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg openssl build-essential python3 xz-utils \
  debian-keyring debian-archive-keyring apt-transport-https

step "Private Node.js 22 in $NODE_DIR (system Node is left alone)"
if ! "$NODE_DIR/bin/node" -v 2>/dev/null | grep -qE '^v2[2-9]\.'; then
  case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; *) echo "Unsupported CPU: $(uname -m)"; exit 1 ;; esac
  BASE=https://nodejs.org/dist/latest-v22.x
  TMP="$(mktemp -d)"
  curl -fsSL "$BASE/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
  FILE="$(grep "linux-$ARCH.tar.xz" "$TMP/SHASUMS256.txt" | awk '{print $2}')"
  curl -fsSL "$BASE/$FILE" -o "$TMP/$FILE"
  (cd "$TMP" && grep " $FILE\$" SHASUMS256.txt | sha256sum -c -)      # verify the download
  rm -rf "$NODE_DIR"; mkdir -p "$NODE_DIR"
  tar -xJf "$TMP/$FILE" -C "$NODE_DIR" --strip-components=1
  rm -rf "$TMP"
fi
"$NODE_DIR/bin/node" -v

if [ -z "$SKIP_CADDY" ] && ! command -v caddy >/dev/null; then
  step "Caddy (web server with automatic HTTPS)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

step "App user and code"
id syncpay >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin syncpay
if [ -d "$APP/.git" ]; then
  git config --global --add safe.directory "$APP" 2>/dev/null || true
  git -C "$APP" pull --ff-only
else
  git clone "$REPO" "$APP"
fi
mkdir -p "$APP/backend/db" "$APP/backend/keys" "$APP/backend/wa_auth"

step "Backend settings (.env, created once)"
if [ ! -f "$APP/backend/.env" ]; then
  cat > "$APP/backend/.env" <<EOF
PORT=$PORT
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
  step "Caddy site for $DOMAIN (added alongside your existing sites)"
  sed -e "s/^DOMAIN {/$DOMAIN {/" -e "s/BACKEND_PORT/$PORT/" "$APP/deploy/Caddyfile" > /etc/caddy/syncpay.caddy
  if [ ! -f /etc/caddy/Caddyfile ]; then
    echo "import syncpay.caddy" > /etc/caddy/Caddyfile
  elif ! grep -q '^import syncpay.caddy' /etc/caddy/Caddyfile; then
    cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-$(date +%Y%m%d%H%M%S)"   # untouched copy of your config
    printf '\nimport syncpay.caddy\n' >> /etc/caddy/Caddyfile
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
curl -fsS "http://127.0.0.1:$PORT/api/health" && echo "  backend OK" || { echo "  backend NOT responding: journalctl -u syncpay -n 50"; exit 1; }

cat <<EOF

Done. Open https://$DOMAIN (the certificate can take a minute on first visit).

Next: link WhatsApp (OTP codes won't send until you do). From YOUR computer:
  ssh -L $PORT:127.0.0.1:$PORT <user>@<server>
then open http://localhost:$PORT/whatsapp in your browser and scan the QR.

Back up these (never commit them): $APP/backend/keys  $APP/backend/.env  $APP/backend/db
Logs:   journalctl -u syncpay -f
Update: sudo bash $APP/deploy/update.sh
EOF
