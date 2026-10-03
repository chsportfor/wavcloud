#!/usr/bin/env bash
set -Eeuo pipefail

stage=/tmp/wavcloud-server-review-20260929
server=/opt/cloudmusic/server
target="$server/dist/services/metadata.js"
helper="$server/dist/services/legacy-tags.js"
backup="/opt/cloudmusic/backups/legacy-artist-$(date -u +%Y%m%dT%H%M%SZ)"
changed=0

wait_for_api() {
  local code
  for _ in {1..240}; do
    code=$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/api/tracks/ || true)
    [[ $code == 401 ]] && return 0
    sleep 1
  done
  return 1
}

rollback() {
  trap - ERR
  if (( changed == 0 )); then return; fi
  echo "Deployment failed; restoring $target from $backup" >&2
  cp -p "$backup/metadata.js" "$target"
  # Keep the added helper for inspection; the restored module does not import it.
  systemctl restart cloudmusic
  wait_for_api || echo "Restored service did not become healthy within 240 seconds" >&2
}
trap rollback ERR

[[ $EUID == 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ -f "$stage/dist/services/metadata.js" && -f "$stage/dist/services/legacy-tags.js" ]] || {
  echo "Missing staged files" >&2; exit 1;
}
[[ -f /tmp/wavcloud-check-live-cosmo.js ]] || { echo "Missing live verification script" >&2; exit 1; }
[[ ! -e "$helper" ]] || { echo "Target helper already exists" >&2; exit 1; }
sha256sum -c - <<'HASH'
994f9cf939397bf7707993459037f87d4872711a2f316b39752b9abd59af551b  /opt/cloudmusic/server/dist/services/metadata.js
HASH
cd "$stage"
NODE_PATH="$server/node_modules" node scripts/check.js
NODE_PATH="$server/node_modules" node --test test/*.test.js

mkdir -p "$backup"
cp -p "$target" "$backup/metadata.js"
echo "Backup: $backup"
changed=1
install -o cloudmusic -g cloudmusic -m 0644 "$stage/dist/services/legacy-tags.js" "$helper.deploy-new"
mv -f "$helper.deploy-new" "$helper"
install -o cloudmusic -g cloudmusic -m 0644 "$stage/dist/services/metadata.js" "$target.deploy-new"
mv -f "$target.deploy-new" "$target"
systemctl restart cloudmusic
wait_for_api
sudo -n -u cloudmusic env NODE_PATH="$server/node_modules" node /tmp/wavcloud-check-live-cosmo.js
systemctl is-active --quiet cloudmusic
changed=0
trap - ERR
echo "Deployment complete; backup: $backup"
