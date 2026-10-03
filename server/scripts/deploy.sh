#!/usr/bin/env bash
set -Eeuo pipefail

stage=/tmp/wavcloud-server-review-20260929
server=/opt/cloudmusic/server
nginx_file=/etc/nginx/sites-available/cloudmusic
backup="/opt/cloudmusic/backups/server-refactor-$(date -u +%Y%m%dT%H%M%SZ)"
existing=(
  dist/services/metadata.js
  dist/routes/upload.js
  dist/routes/download.js
  dist/routes/stream.js
)
added=(
  dist/services/audio-files.js
  dist/utils/audio-format.js
)
changed=0

rollback() {
  trap - ERR
  if (( changed == 0 )); then return; fi
  echo "Deployment failed; restoring originals from $backup" >&2
  for relative in "${existing[@]}"; do
    cp -p "$backup/$relative" "$server/$relative"
  done
  cp -p "$backup/nginx.conf" "$nginx_file"
  # The added helpers are harmless with the original modules and are retained
  # for inspection rather than deleting a potentially modified file.
  systemctl restart cloudmusic || true
  nginx -t && systemctl reload nginx || true
}
trap rollback ERR

[[ $EUID == 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ -f "$stage/nginx.conf" ]] || { echo "Missing staged Nginx config" >&2; exit 1; }
for relative in "${existing[@]}" "${added[@]}"; do
  [[ -f "$stage/$relative" ]] || { echo "Missing staged $relative" >&2; exit 1; }
  node --check "$stage/$relative"
done
for relative in "${added[@]}"; do
  if [[ -e "$server/$relative" ]]; then
    cmp -s "$stage/$relative" "$server/$relative" || {
      echo "New target differs from staged file: $relative" >&2; exit 1;
    }
  fi
done

sha256sum -c - <<'HASHES'
690bd657273bcfd558b1ddeab049ee012589109d8ff15584a6327ef6a359bdad  /opt/cloudmusic/server/dist/services/metadata.js
793c7945db3d6e3d4695ced2a8870102381d8cc726d03fa45995eab8f59830de  /opt/cloudmusic/server/dist/routes/upload.js
361bb57c66175ad5af820fb0ef0c0c375c0e452addf3bb9ee8861dc7179eb891  /opt/cloudmusic/server/dist/routes/download.js
01ac4ba135f24bbece882c2b08163e814fdea1df1c649d1dd5a7fa4aabfe0f22  /opt/cloudmusic/server/dist/routes/stream.js
5ac9369ca527e0e78a5b5c8d4f5f085dfe4f1e36a8670c27d1f59a7c5d1aa4f3  /etc/nginx/sites-available/cloudmusic
HASHES

cd "$stage"
NODE_PATH="$server/node_modules" node scripts/check.js
NODE_PATH="$server/node_modules" node --test test/*.test.js

for relative in "${existing[@]}"; do
  mkdir -p "$backup/$(dirname "$relative")"
  cp -p "$server/$relative" "$backup/$relative"
done
cp -p "$nginx_file" "$backup/nginx.conf"
echo "Backup: $backup"

changed=1
for relative in "${existing[@]}" "${added[@]}"; do
  target="$server/$relative"
  install -o cloudmusic -g cloudmusic -m 0644 "$stage/$relative" "$target.deploy-new"
  mv -f "$target.deploy-new" "$target"
done
install -o root -g root -m 0644 "$stage/nginx.conf" "$nginx_file.deploy-new"
mv -f "$nginx_file.deploy-new" "$nginx_file"

nginx -t
systemctl restart cloudmusic
healthy=0
for _ in {1..240}; do
  code=$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/api/tracks/ || true)
  if [[ $code == 401 ]]; then healthy=1; break; fi
  sleep 1
done
(( healthy == 1 )) || { echo "API did not respond with expected 401" >&2; false; }
systemctl reload nginx
systemctl is-active --quiet cloudmusic
systemctl is-active --quiet nginx
changed=0
trap - ERR
echo "Deployment complete; backup: $backup"
