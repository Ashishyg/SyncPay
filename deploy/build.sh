#!/usr/bin/env bash
# Install dependencies, build the web app and publish it to /var/www/syncpay. Run as root (setup/update call it).
set -euo pipefail
APP=/opt/syncpay
NODE_DIR=/opt/syncpay-node   # private Node (system Node is never touched)
WEB=/var/www/syncpay
as_app() { sudo -u syncpay -H env HOME="$APP" PATH="$NODE_DIR/bin:$PATH" "$@"; }

cd "$APP/backend"
as_app npm ci --omit=dev

cd "$APP/frontend"
as_app npm ci            # .npmrc sets legacy-peer-deps
as_app npm run build

mkdir -p "$WEB"
rm -rf "${WEB:?}/"*
cp -r "$APP/frontend/dist/." "$WEB/"
echo "Published web app to $WEB"
