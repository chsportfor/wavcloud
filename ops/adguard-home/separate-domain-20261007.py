"""One-time migration of the existing installation to its dedicated hostname."""
import datetime
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.request
import yaml


def run(*args):
    subprocess.run(args, check=True)


if os.geteuid() != 0:
    raise SystemExit('Run as root')
domain = 'adguardfm.duckdns.org'
home = Path('/var/lib/wavcloud-adguard')
config = home / 'AdGuardHome.yaml'
music = Path('/etc/nginx/sites-available/cloudmusic')
site = Path('/etc/nginx/sites-available/adguardfm')
link = Path('/etc/nginx/sites-enabled/adguardfm')
hook = Path('/etc/letsencrypt/renewal-hooks/deploy/wavcloud-adguard')
webroot = Path('/var/www/adguardfm')
certificate = Path('/etc/letsencrypt/live') / domain
if site.exists() or link.exists():
    raise SystemExit('Dedicated site already exists; review before rerunning')
backup = Path('/opt/cloudmusic/backups/adguard-domain-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
for source, name in [(config, 'AdGuardHome.yaml'), (music, 'cloudmusic.conf'), (hook, 'deploy-hook')]:
    shutil.copy2(source, backup / name)
    os.chmod(backup / name, 0o600)
shutil.copytree(home / 'tls', backup / 'tls')
http = '''server {
    listen 80;
    server_name adguardfm.duckdns.org;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/adguardfm;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 301 https://adguardfm.duckdns.org$request_uri; }
}
'''
webroot.mkdir(parents=True, exist_ok=True, mode=0o755)
site.write_text(http)
link.symlink_to(site)
try:
    run('nginx', '-t')
    run('systemctl', 'reload', 'nginx')
    run('certbot', 'certonly', '--webroot', '-w', str(webroot), '-d', domain,
        '--cert-name', domain, '--non-interactive', '--agree-tos', '--keep-until-expiring')
    music_text = music.read_text()
    route = re.search(r'    # AdGuard Home:.*?\n    location = /dns-query \{.*?\n    \}\n', music_text, re.S)
    if not route:
        raise RuntimeError('Expected existing DNS location missing')
    https = '''
server {
    listen 443 ssl http2;
    server_name adguardfm.duckdns.org;
    ssl_certificate /etc/letsencrypt/live/adguardfm.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/adguardfm.duckdns.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
'''
    https += route.group(0)
    https += '''    location = /downloads/AdGuardFM-DoH.mobileconfig {
        alias /var/www/adguardfm/AdGuardFM-DoH.mobileconfig;
        default_type application/x-apple-aspen-config;
        add_header Cache-Control "no-store";
    }
    location / { return 404; }
}
'''
    site.write_text(http + https)
    # Explicitly reject the old endpoint instead of letting the music SPA handle it.
    music.write_text(music_text[:route.start()] + '    location = /dns-query { return 404; }\n' + music_text[route.end():])
    run('nginx', '-t')
    run('systemctl', 'stop', 'wavcloud-adguard')
    settings = yaml.safe_load(config.read_text())
    settings['tls']['server_name'] = domain
    config.write_text(yaml.safe_dump(settings, sort_keys=False))
    hook.write_text((backup / 'deploy-hook').read_text().replace('/etc/letsencrypt/live/wavcloud.duckdns.org', str(certificate)))
    os.chmod(hook, 0o755)
    run('env', 'RENEWED_LINEAGE=' + str(certificate), str(hook))
    run('/opt/wavcloud-adguard/AdGuardHome', '--check-config', '-c', str(config), '-w', str(home))
    run('systemctl', 'start', 'wavcloud-adguard')
    run('systemctl', 'reload', 'nginx')
    # systemctl start returns before the application's HTTP listener is ready.
    for attempt in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3080/apple/doh.mobileconfig?host=' + domain, timeout=5) as result:
                profile = result.read()
            break
        except OSError:
            if attempt == 29:
                raise
            time.sleep(1)
    (webroot / 'AdGuardFM-DoH.mobileconfig').write_bytes(profile)
    os.chmod(webroot / 'AdGuardFM-DoH.mobileconfig', 0o644)
except BaseException:
    run('systemctl', 'stop', 'wavcloud-adguard')
    shutil.copy2(backup / 'AdGuardHome.yaml', config)
    shutil.copy2(backup / 'cloudmusic.conf', music)
    shutil.copy2(backup / 'deploy-hook', hook)
    os.chmod(hook, 0o755)
    shutil.copytree(backup / 'tls', home / 'tls', dirs_exist_ok=True)
    run('chown', 'wavcloud-adguard:wavcloud-adguard', str(config))
    run('chown', '-R', 'root:wavcloud-adguard', str(home / 'tls'))
    link.unlink(missing_ok=True)
    site.unlink(missing_ok=True)
    run('nginx', '-t')
    run('systemctl', 'reload', 'nginx')
    run('systemctl', 'start', 'wavcloud-adguard')
    raise
print('Dedicated domain configured; backup:', backup)
