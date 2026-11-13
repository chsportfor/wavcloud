#!/usr/bin/env bash
set -euo pipefail

# Deploy staged server files (containing src/ and dist/) to /opt/cloudmusic/server.
# Usage: sudo bash deploy-server.sh <staged-server-dir>

STAGED_DIR="${1:-}"
TARGET_DIR="/opt/cloudmusic/server"
BACKUP_ROOT="/opt/cloudmusic/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_ROOT}/server-deploy-${TIMESTAMP}"

if [[ -z "${STAGED_DIR}" || ! -d "${STAGED_DIR}/src" || ! -d "${STAGED_DIR}/dist" ]]; then
  echo "Usage: sudo bash $0 <staged-server-dir-with-src-and-dist>" >&2
  exit 1
fi

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "Target server directory not found: ${TARGET_DIR}" >&2
  exit 1
fi

echo "[1/5] Checking staged server build..."
(cd "${STAGED_DIR}" && node scripts/build.js --check && node scripts/check.js)

echo "[2/5] Backing up current server to ${BACKUP_DIR}..."
mkdir -p "${BACKUP_DIR}"
cp -a "${TARGET_DIR}/src" "${BACKUP_DIR}/src"
cp -a "${TARGET_DIR}/dist" "${BACKUP_DIR}/dist"

echo "[3/5] Syncing src/ and dist/..."
rsync -a --delete "${STAGED_DIR}/src/" "${TARGET_DIR}/src/"
rsync -a --delete "${STAGED_DIR}/dist/" "${TARGET_DIR}/dist/"
chown -R ubuntu:ubuntu "${TARGET_DIR}/src"
chown -R cloudmusic:cloudmusic "${TARGET_DIR}/dist"

echo "[4/5] Running server test suite..."
(cd "${TARGET_DIR}" && npm test)

echo "[5/5] Restarting cloudmusic and verifying services..."
systemctl restart cloudmusic
sleep 2
systemctl is-active --quiet cloudmusic
systemctl is-active --quiet nginx

echo "Deploy complete. Backup saved at: ${BACKUP_DIR}"
