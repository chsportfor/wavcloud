#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# != 2 || ! $2 =~ ^[a-f0-9]{64}$ ]]; then
  echo 'Usage: sudo bash deploy.sh /tmp/wavcloud-web-RELEASE EXPECTED_CURRENT_INDEX_SHA256' >&2
  exit 2
fi
[[ $EUID == 0 ]] || { echo 'Run as root' >&2; exit 2; }
stage=$(realpath "$1")
case "$stage" in /tmp/wavcloud-web-*) ;; *) echo 'Unexpected release path' >&2; exit 2 ;; esac
target=/opt/cloudmusic/client/dist
config=/etc/nginx/sites-available/cloudmusic
[[ -d $target && ! -L $target && -f $config ]] || exit 2
[[ $(sha256sum "$target/index.html" | cut -d' ' -f1) == "$2" ]] || { echo 'Live web changed; inspect before deploying' >&2; exit 3; }
cd "$stage"
sha256sum -c release.sha256
node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync("build.json"));if(!/^[a-f0-9]{16}$/.test(b.version)||!Array.isArray(b.files)||b.files.length>30||!b.files.includes("index.html")||!b.files.includes("sw.js")||b.files.some(p=>!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(p)||p.includes("..")||!fs.statSync(p).isFile()))process.exit(1);'
node --check sw.js
backup=$(mktemp -d "/opt/cloudmusic/backups/web-refactor-$(date -u +%Y%m%dT%H%M%SZ)-XXXX")
cp -a "$target" "$backup/dist"
cp -a "$config" "$backup/nginx.conf"
rollback() {
  trap - ERR
  cp -a "$backup/dist/." "$target/"
  cp -a "$backup/nginx.conf" "$config"
  nginx -t && systemctl reload nginx
  echo "Web deployment failed; restored $backup" >&2
}
trap rollback ERR

# Add immutable assets before HTML and the worker reference them.
while IFS= read -r file; do
  [[ $file != index.html && $file != sw.js ]] || continue
  install -D -m 0644 "$stage/$file" "$target/$file"
done < <(node -e 'JSON.parse(require("fs").readFileSync("build.json")).files.forEach(p=>console.log(p))')
install -m 0644 build.json "$target/build.json"
for file in index.html sw.js; do
  install -m 0644 "$stage/$file" "$target/.$file.next"
  mv -f "$target/.$file.next" "$target/$file"
done
python3 - "$config" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
marker = '    location / {\n'
if marker not in text:
    raise RuntimeError('Expected SPA location is missing')
if '    location = /index.html {' not in text:
    text = text.replace(marker, '    location = /index.html {\n        expires -1;\n        try_files $uri =404;\n    }\n\n' + marker, 1)
if '    location / {\n        expires -1;' not in text:
    text = text.replace(marker, marker + '        expires -1;\n', 1)
path.write_text(text)
PY
nginx -t
systemctl reload nginx
[[ $(curl -fsS --resolve wavcloud.duckdns.org:443:127.0.0.1 https://wavcloud.duckdns.org/ | sha256sum | cut -d' ' -f1) == $(sha256sum index.html | cut -d' ' -f1) ]]
while IFS= read -r file; do
  [[ $(sha256sum "$target/$file" | cut -d' ' -f1) == $(sha256sum "$stage/$file" | cut -d' ' -f1) ]]
done < <(node -e 'JSON.parse(require("fs").readFileSync("build.json")).files.forEach(p=>console.log(p))')
systemctl is-active cloudmusic nginx
trap - ERR
echo "Deployed web $(node -p 'JSON.parse(require("fs").readFileSync("build.json")).version')"
echo "Backup: $backup"
