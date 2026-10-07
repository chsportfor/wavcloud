import datetime
import json
import hashlib
import os
import pathlib
import secrets
import shutil
import subprocess
import yaml

def run(*args):
    subprocess.run(args, check=True)

if os.geteuid() != 0:
    raise SystemExit('Run as root')
stage = pathlib.Path('/tmp/wavcloud-adguard-20261007')
expected_binary = '64a9b6fc6269247f1973cddbf285aa6ce866d11bd29546b0f4135ba31d2283c8'
if hashlib.sha256((stage / 'AdGuardHome/AdGuardHome').read_bytes()).hexdigest() != expected_binary:
    raise SystemExit('Official v0.107.79 ARM64 binary hash mismatch')
home = pathlib.Path('/var/lib/wavcloud-adguard')
binary = pathlib.Path('/opt/wavcloud-adguard/AdGuardHome')
nginx = pathlib.Path('/etc/nginx/sites-available/cloudmusic')
unit = pathlib.Path('/etc/systemd/system/wavcloud-adguard.service')
hook = pathlib.Path('/etc/letsencrypt/renewal-hooks/deploy/wavcloud-adguard')
if home.exists() or unit.exists() or hook.exists():
    raise SystemExit('Existing AdGuard installation requires review')
if 'location = /dns-query' in nginx.read_text():
    raise SystemExit('Existing DNS route requires review')
backup = pathlib.Path('/opt/cloudmusic/backups/adguard-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
shutil.copy2(nginx, backup / 'nginx.conf')
for rules in ['/etc/iptables/rules.v4', '/etc/iptables/rules.v6']:
    if pathlib.Path(rules).exists():
        shutil.copy2(rules, backup / pathlib.Path(rules).name)
password = secrets.token_urlsafe(24)
hashed = subprocess.check_output(['node', '-e', 'const fs=require("fs"); process.stdout.write(require("bcrypt").hashSync(fs.readFileSync(0,"utf8"),12));'], input=password.encode(), env={**os.environ, 'NODE_PATH': '/opt/cloudmusic/server/node_modules'}).decode()
try:
    subprocess.run(['id', '-u', 'wavcloud-adguard'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
except subprocess.CalledProcessError:
    run('useradd', '--system', '--home-dir', str(home), '--shell', '/usr/sbin/nologin', 'wavcloud-adguard')
run('install', '-D', '-m', '0755', str(stage / 'AdGuardHome/AdGuardHome'), str(binary))
home.mkdir(mode=0o700)
(home / 'tls').mkdir(mode=0o750)
run('chown', 'root:wavcloud-adguard', str(home / 'tls'))
for source, dest in [('fullchain.pem', 'fullchain.pem'), ('privkey.pem', 'privkey.pem')]:
    run('install', '-o', 'root', '-g', 'wavcloud-adguard', '-m', '0640', '/etc/letsencrypt/live/wavcloud.duckdns.org/' + source, str(home / 'tls' / dest))
config = {
    'schema_version': 34,
    'http': {'address': '127.0.0.1:3080', 'session_ttl': '12h', 'doh': {'insecure_enabled': True}},
    'users': [{'name': 'admin', 'password': hashed}],
    'auth_attempts': 5, 'block_auth_min': 15, 'language': 'ko', 'theme': 'dark',
    'dns': {
        'bind_hosts': ['0.0.0.0'], 'port': 5353, 'serve_plain_dns': False,
        'upstream_dns': ['https://dns.quad9.net/dns-query', 'https://cloudflare-dns.com/dns-query'],
        'bootstrap_dns': ['9.9.9.9', '1.1.1.1'], 'fallback_dns': [],
        'ratelimit': 30, 'refuse_any': True, 'cache_size': 4194304,
        'trusted_proxies': ['127.0.0.1/32'], 'max_goroutines': 128,
        'upstream_timeout': '10s', 'enable_dnssec': True,
        'use_private_ptr_resolvers': False, 'anonymize_client_ip': True,
    },
    'tls': {
        'enabled': True, 'server_name': 'wavcloud.duckdns.org', 'port_https': 0,
        'port_dns_over_tls': 853, 'port_dns_over_quic': 0, 'strict_sni_check': True,
        'certificate_path': str(home / 'tls/fullchain.pem'),
        'private_key_path': str(home / 'tls/privkey.pem'),
    },
    'filtering': {'protection_enabled': True, 'filtering_enabled': True, 'blocking_mode': 'null_ip'},
    'filters': [{'enabled': True, 'url': 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt', 'name': 'AdGuard DNS filter', 'id': 1}],
    'querylog': {'enabled': True, 'interval': '24h', 'size_memory': 1000},
    'statistics': {'enabled': True, 'interval': '168h'},
    'dhcp': {'enabled': False},
}
(home / 'AdGuardHome.yaml').write_text(yaml.safe_dump(config, sort_keys=False))
os.chmod(home / 'AdGuardHome.yaml', 0o600)
run('chown', 'wavcloud-adguard:wavcloud-adguard', str(home), str(home / 'AdGuardHome.yaml'))
run(str(binary), '--check-config', '-c', str(home / 'AdGuardHome.yaml'), '-w', str(home))
credentials = pathlib.Path('/root/wavcloud-adguard-admin.json')
credentials.write_text(json.dumps({'username': 'admin', 'password': password, 'admin_url': 'http://127.0.0.1:13080', 'dot_hostname': 'wavcloud.duckdns.org', 'doh_url': 'https://wavcloud.duckdns.org/dns-query'}, indent=2) + '\n')
os.chmod(credentials, 0o600)
unit.write_text('''[Unit]
Description=WavCloud AdGuard Home encrypted DNS
Wants=network-online.target
After=network-online.target

[Service]
User=wavcloud-adguard
Group=wavcloud-adguard
ExecStart=/opt/wavcloud-adguard/AdGuardHome -c /var/lib/wavcloud-adguard/AdGuardHome.yaml -w /var/lib/wavcloud-adguard
Restart=on-failure
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/wavcloud-adguard
MemoryHigh=384M
MemoryMax=512M
CPUQuota=50%
TasksMax=128
LimitNOFILE=8192
UMask=0077

[Install]
WantedBy=multi-user.target
''')
hook.write_text('''#!/bin/sh
set -eu
[ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/wavcloud.duckdns.org ] || exit 0
for file in fullchain.pem privkey.pem; do
  install -o root -g wavcloud-adguard -m 0640 "$RENEWED_LINEAGE/$file" "/var/lib/wavcloud-adguard/tls/.$file.next"
  mv -f "/var/lib/wavcloud-adguard/tls/.$file.next" "/var/lib/wavcloud-adguard/tls/$file"
done
if systemctl is-active --quiet wavcloud-adguard; then
  systemctl restart wavcloud-adguard
fi
''')
os.chmod(hook, 0o750)
limits = pathlib.Path('/etc/nginx/conf.d/wavcloud-adguard.conf')
if limits.exists():
    raise SystemExit('Existing Nginx rate limits require review')
limits.write_text('''limit_req_zone $binary_remote_addr zone=wavcloud_dns_client:1m rate=30r/s;
limit_req_zone $server_name zone=wavcloud_dns_total:1m rate=60r/s;
''')
route = '''    # AdGuard Home: expose only DNS, keep administration on loopback.
    location = /dns-query {
        limit_req zone=wavcloud_dns_client burst=60 nodelay;
        limit_req zone=wavcloud_dns_total burst=120 nodelay;
        limit_req_status 429;
        client_max_body_size 16k;
        limit_except GET POST { deny all; }
        proxy_pass http://127.0.0.1:3080/dns-query;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 3s;
        proxy_read_timeout 15s;
        access_log off;
    }

'''
try:
    nginx.write_text(nginx.read_text().replace('    # API & Streaming', route + '    # API & Streaming', 1))
    run('nginx', '-t')
    run('systemctl', 'daemon-reload')
    run('systemctl', 'enable', '--now', 'wavcloud-adguard')
    run('systemctl', 'reload', 'nginx')
except Exception:
    shutil.copy2(backup / 'nginx.conf', nginx)
    limits.unlink(missing_ok=True)
    subprocess.run(['systemctl', 'disable', '--now', 'wavcloud-adguard'], check=False)
    subprocess.run(['nginx', '-t'], check=False)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=False)
    raise
print('Installed AdGuard Home v0.107.79; backup:', backup)
