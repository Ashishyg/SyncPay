#!/usr/bin/env bash
# Install dependencies, build the web app and publish it to /var/www/syncpay. Run as root (setup/update call it).
set -euo pipefail
APP=/opt/syncpay
WEB=/var/www/syncpay
as_app() { sudo -u syncpay -H env HOME="$APP" "$@"; }

cd "$APP/backend"
as_app npm ci --omit=dev

cd "$APP/frontend"
as_app npm ci            # .npmrc sets legacy-peer-deps
as_app npm run build

mkdir -p "$WEB"
rm -rf "${WEB:?}/"*
cp -r "$APP/frontend/dist/." "$WEB/"
echo "Published web app to $WEB"
