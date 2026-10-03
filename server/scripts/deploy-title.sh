#!/usr/bin/env bash
set -Eeuo pipefail

stage=/tmp/wavcloud-title-20260929
server=/opt/cloudmusic/server
target="$server/dist/services/metadata.js"
helper="$server/dist/services/title.js"
backup="/opt/cloudmusic/backups/title-tag-$(date -u +%Y%m%dT%H%M%SZ)"
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
  cp -p "$backup/metadata.js" "$target"
  rm -f "$helper"
  systemctl restart cloudmusic
  wait_for_api || echo "Restored service did not become healthy within 240 seconds" >&2
}
trap rollback ERR

[[ $EUID == 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ -f "$stage/metadata.js" && -f "$stage/title.js" && -f "$stage/title.test.js" && -f "$stage/verify-live-title.js" ]] || {
  echo "Missing staged files" >&2; exit 1;
}
[[ ! -e "$helper" ]] || { echo "Title helper already exists" >&2; exit 1; }
sha256sum -c - <<'HASH'
aefa85e9fa05ba04d6697ca2d7c3422c617dc921c8bd9c70f88a08a5fbec3146  /opt/cloudmusic/server/dist/services/metadata.js
HASH
node --check "$stage/metadata.js"
node --check "$stage/title.js"
mkdir -p "$stage/dist/services" "$stage/test"
cp "$stage/title.js" "$stage/dist/services/title.js"
cp "$stage/title.test.js" "$stage/test/title.test.js"
cd "$stage"
node --test test/title.test.js

mkdir -p "$backup"
cp -p "$target" "$backup/metadata.js"
echo "Backup: $backup"
changed=1
install -o cloudmusic -g cloudmusic -m 0644 "$stage/title.js" "$helper.deploy-new"
mv -f "$helper.deploy-new" "$helper"
install -o cloudmusic -g cloudmusic -m 0644 "$stage/metadata.js" "$target.deploy-new"
mv -f "$target.deploy-new" "$target"
systemctl restart cloudmusic
wait_for_api
cd "$server"
sudo -n -u cloudmusic env NODE_PATH="$server/node_modules" WAVCLOUD_SERVER_ROOT="$server" node "$stage/verify-live-title.js"
systemctl is-active --quiet cloudmusic
changed=0
trap - ERR
echo "Deployment complete; backup: $backup"
