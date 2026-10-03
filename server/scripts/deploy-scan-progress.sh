#!/usr/bin/env bash
set -Eeuo pipefail
stage=/tmp/wavcloud-scan-20260930
server=/opt/cloudmusic/server
backup="/opt/cloudmusic/backups/scan-progress-$(date -u +%Y%m%dT%H%M%SZ)"
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
  cp -p "$backup/metadata.js" "$server/dist/services/metadata.js"
  cp -p "$backup/tracks.js" "$server/dist/routes/tracks.js"
  rm -f "$server/dist/services/scan-jobs.js"
  systemctl restart cloudmusic
  wait_for_api || echo "Restored service did not become healthy" >&2
}
trap rollback ERR
[[ $EUID == 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ ! -e "$server/dist/services/scan-jobs.js" ]] || { echo "Scan helper already exists" >&2; exit 1; }
sha256sum -c - <<'HASH'
d198ad7ebd9af4ab27c08be899516d268f9491fc25a59c177adf000447967337  /opt/cloudmusic/server/dist/services/metadata.js
372ff5665d5d7614a0dc62dac5c1bb51c277fec3a8cbd4d8024de802c616dcf4  /opt/cloudmusic/server/dist/routes/tracks.js
HASH
cd "$stage"
NODE_PATH="$server/node_modules" node scripts/check.js
NODE_PATH="$server/node_modules" node --test test/*.test.js
mkdir -p "$backup"
cp -p "$server/dist/services/metadata.js" "$backup/metadata.js"
cp -p "$server/dist/routes/tracks.js" "$backup/tracks.js"
echo "Backup: $backup"
changed=1
for relative in services/scan-jobs.js services/metadata.js routes/tracks.js; do
  install -o cloudmusic -g cloudmusic -m 0644 "$stage/dist/$relative" "$server/dist/$relative.deploy-new"
  mv -f "$server/dist/$relative.deploy-new" "$server/dist/$relative"
done
systemctl restart cloudmusic
wait_for_api
cd "$server"
sudo -n -u cloudmusic env NODE_PATH="$server/node_modules" WAVCLOUD_SERVER_ROOT="$server" node "$stage/scripts/verify-live-scan.js"
systemctl is-active --quiet cloudmusic
changed=0
trap - ERR
echo "Deployment complete; backup: $backup"
