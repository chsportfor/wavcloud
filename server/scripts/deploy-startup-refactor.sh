#!/usr/bin/env bash
# Change-specific deployment: use the verified staging directory and original-code manifest.
set -euo pipefail
stage=/tmp/wavcloud-final-refactor-20261007
live=/opt/cloudmusic/server
backup=/opt/cloudmusic/backups/startup-refactor-$(date -u +%Y%m%dT%H%M%SZ)
prepared=$live/dist.prepared-20261007
cd "$stage"
sha256sum -c expected-production.sha256 > production-hash-check.log
test ! -e "$prepared"
node scripts/build.js --check
mkdir -p "$backup"
cp -a "$live/dist" "$backup/dist"
cp -a "$live/package.json" "$backup/package.json"
if test -d "$live/src"; then cp -a "$live/src" "$backup/src"; fi
cp -a "$stage/dist" "$prepared"
chown -R cloudmusic:cloudmusic "$prepared"
rollback() {
  trap - ERR
  systemctl stop cloudmusic || true
  if test -d "$backup/active-dist"; then
    mv "$live/dist" "$backup/failed-dist" 2>/dev/null || true
    mv "$backup/active-dist" "$live/dist"
  fi
  systemctl start cloudmusic
  echo "Deployment rolled back. Backup: $backup" >&2
}
trap rollback ERR
systemctl stop cloudmusic
mv "$live/dist" "$backup/active-dist"
mv "$prepared" "$live/dist"
systemctl start cloudmusic
NODE_PATH="$live/node_modules" node scripts/verify-startup.js --tracks=1042 --warm-restart
NODE_PATH="$live/node_modules" node scripts/verify-live-refactor.js
nginx -t
systemctl is-active --quiet cloudmusic
systemctl is-active --quiet nginx
trap - ERR
# Publish the maintainable source/build files only after the deployed runtime passes.
mkdir -p "$live/src" "$live/scripts"
cp -a "$stage/src/." "$live/src/"
install -m 0644 "$stage/scripts/build.js" "$live/scripts/build.js"
install -m 0644 "$stage/scripts/check.js" "$live/scripts/check.js"
install -m 0644 "$stage/package.json" "$live/package.json"
printf 'Deployment verified. Backup: %s\n' "$backup"
