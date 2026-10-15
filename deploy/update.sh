#!/usr/bin/env bash
# Deploy the latest code from GitHub:  sudo bash /opt/syncpay/deploy/update.sh
set -euo pipefail
APP=/opt/syncpay
[ "$(id -u)" = 0 ] || { echo "Please run with sudo"; exit 1; }

sudo -u syncpay -H git -C "$APP" pull --ff-only
bash "$APP/deploy/build.sh"
cp "$APP/deploy/syncpay.service" /etc/systemd/system/syncpay.service
systemctl daemon-reload
systemctl restart syncpay
sleep 3
PORT="$(grep -E '^PORT=' "$APP/backend/.env" | cut -d= -f2)"
curl -fsS "http://127.0.0.1:${PORT:-3100}/api/health" && echo "  updated and running"
