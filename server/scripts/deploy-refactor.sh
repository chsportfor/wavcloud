#!/usr/bin/env bash
set -Eeuo pipefail
stage=${1:?Pass the verified staging directory}
server=/opt/cloudmusic/server
[[ $stage == /tmp/wavcloud-audit-* ]] || { echo "Unexpected staging directory" >&2; exit 1; }
[[ $EUID == 0 ]] || { echo "Run as root" >&2; exit 1; }
existing=(dist/routes/auth.js dist/middleware/auth.js dist/routes/stream.js dist/routes/upload.js dist/services/metadata.js)
added=(dist/services/library-store.js dist/utils/byte-range.js dist/utils/request-validation.js)
backup="/opt/cloudmusic/backups/audit-refactor-$(date -u +%Y%m%dT%H%M%SZ)"
changed=0
rollback() {
  trap - ERR
  if (( changed == 0 )); then return; fi
  echo "Restoring originals from $backup" >&2
  for relative in "${existing[@]}"; do cp -p "$backup/$relative" "$server/$relative"; done
  systemctl restart cloudmusic || true
}
trap rollback ERR
for relative in "${existing[@]}" "${added[@]}"; do node --check "$stage/$relative"; done
for relative in "${added[@]}"; do
  [[ ! -e "$server/$relative" ]] || { echo "New target already exists: $relative" >&2; exit 1; }
done
sha256sum -c "$stage/expected-production.sha256"
cd "$stage"
NODE_PATH="$server/node_modules" node --test --test-reporter=dot test/*.test.js
NODE_PATH="$server/node_modules" node scripts/verify-live-refactor.js --baseline
for relative in "${existing[@]}"; do
  mkdir -p "$backup/$(dirname "$relative")"
  cp -p "$server/$relative" "$backup/$relative"
done
changed=1
for relative in "${existing[@]}" "${added[@]}"; do
  install -o cloudmusic -g cloudmusic -m 0644 "$stage/$relative" "$server/$relative.audit-new"
  mv -f "$server/$relative.audit-new" "$server/$relative"
done
systemctl restart cloudmusic
healthy=0
for _ in {1..240}; do
  code=$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/api/tracks || true)
  if [[ $code == 401 ]]; then healthy=1; break; fi
  sleep 1
done
(( healthy == 1 )) || { echo "API startup failed" >&2; false; }
systemctl is-active --quiet cloudmusic
NODE_PATH="$server/node_modules" node scripts/verify-live-refactor.js
changed=0
trap - ERR
echo "Deployment verified. Backup: $backup"
