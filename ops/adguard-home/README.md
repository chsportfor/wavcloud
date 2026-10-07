# AdGuard Home 운영 구성

2026-10-07, 음악 서버 `wavcloud.duckdns.org`에 공식 ARM64 안정 버전 `v0.107.79`를 설치했다.
공식 GitHub 릴리스의 `checksums.txt`로 배포 파일 SHA-256을 확인했다.

## 휴대폰 연결

Android의 프라이빗 DNS 제공업체 호스트 이름:

```text
wavcloud.duckdns.org
```

프로토콜은 DNS-over-TLS이며 TCP 853을 사용한다. 삼성 기기는 대체로
설정 → 연결 → 기타 연결 설정 → 프라이빗 DNS에서 입력한다.
VPN을 켜지 않아도 일반 Wi-Fi·모바일 데이터에서 사용한다.
이 설정은 DNS 요청을 암호화하고 도메인을 차단하며 인터넷 접속 IP를 바꾸지 않는다.

DNS-over-HTTPS 주소:

```text
https://wavcloud.duckdns.org/dns-query
```

iPhone 설정 파일은 [DoH 프로파일](https://wavcloud.duckdns.org/downloads/WavCloud-AdGuard-DoH.mobileconfig)을 다운로드한 뒤
설정의 다운로드한 프로파일 또는 일반 → VPN 및 기기 관리에서 설치한다.
프로파일은 `com.apple.dnsSettings.managed` DNS 설정과 위 HTTPS 주소만 포함하며 관리자 암호는 없다.
실제 휴대폰의 설정 변경은 사용자가 수행한다. 사용자 웹사이트를 차단하면 관리 화면에서 허용 목록에 추가할 수 있다.
유튜브 영상 광고 등 콘텐츠와 같은 도메인을 사용하는 광고는 DNS 차단 대상에 한계가 있다.

## 실행과 접근 경계

- systemd 서비스: `wavcloud-adguard`, 부팅 시 자동 시작·오류 시 재시작.
- 실행 파일: `/opt/wavcloud-adguard/AdGuardHome`.
- 설정·캐시·로그: `/var/lib/wavcloud-adguard`, 전용 시스템 계정, 폴더 0700·설정 0600.
- 관리 화면: `127.0.0.1:3080`에서만 제공. 공개 Nginx에는 `/dns-query`만 연결.
- 평문 DNS와 DNS-over-QUIC·DHCP는 비활성화. 기존 systemd-resolved·WireGuard DNS는 변경하지 않았다.
- 공개 TCP 853에 Linux 연결 속도 제한을 적용했다. 사용자가 해당 Oracle 보안 목록/NSG의 TCP 853 인바운드를 추가했다.
- 기본 DoT·DoH는 클라이언트 계정 인증을 요구하지 않는 공개 암호화 DNS다.
  Android의 ‘프라이빗 DNS’는 암호화 연결 기능이며 개인 전용 접근 인증을 뜻하지 않는다.
- DNS 요청 제한, DoH의 IP별·전체 HTTP 속도 제한, ANY 요청 거부, 16KiB HTTP 요청 크기 제한.
- CPUQuota 50%, MemoryHigh 384MiB, MemoryMax 512MiB. 상한은 자원 예약량이 아니다.
- 기본 AdGuard DNS 필터 1개, 4MiB DNS 캐시, 쿼리 로그 24시간·통계 7일, 클라이언트 IP 익명화.
- upstream은 Quad9·Cloudflare의 HTTPS DNS, bootstrap만 9.9.9.9·1.1.1.1을 사용한다.
- 웹과 같은 Let's Encrypt 인증서의 별도 복사본을 사용한다.
  `/etc/letsencrypt/renewal-hooks/deploy/wavcloud-adguard`가 갱신 시 전용 인증서를 교체하고 DNS 서비스를 재시작한다.

## 관리자 접속

관리 계정 `admin`의 새 암호는 서버 `/root/wavcloud-adguard-admin.json`에 root 전용으로 보관한다.
사용자가 명시적으로 승인한 뒤 이 PC의 `outputs/AdGuardHome-admin-2026-10-07.json`에도
본인 계정 전용 접근 권한으로 저장했다. 암호·인증서 개인키·실제 설정 YAML은 Git에 포함하지 않는다.

안전하게 보관한 SSH 키로 터널을 연다. 아래 경로는 각 PC에 맞게 바꾼다.

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" -o "UserKnownHostsFile=$env:USERPROFILE/.ssh/wavcloud_known_hosts" -o StrictHostKeyChecking=yes -N -L 127.0.0.1:13080:127.0.0.1:3080 ubuntu@wavcloud.duckdns.org
```

터널이 실행 중일 때 `http://127.0.0.1:13080`을 열고 관리 계정으로 로그인한다.
터널을 종료하면 로컬 관리 주소 연결도 종료된다. 운영 관리 포트를 인터넷에 추가로 공개하지 않는다.

## 검사·변경·복구

```powershell
node ops/adguard-home/check-dns.cjs
```

외부 DoH·DoT의 인증서 검증, `example.com` 정상 조회와 `doubleclick.net` 차단을 검사한다.
서버 내부만 검사할 때는 `DNS_TEST_HOST=127.0.0.1`을 사용한다.

```bash
systemctl is-active wavcloud-adguard cloudmusic nginx
sudo systemctl show wavcloud-adguard -p MemoryCurrent -p CPUUsageNSec
sudo journalctl -u wavcloud-adguard -n 30 --no-pager
sudo /opt/wavcloud-adguard/AdGuardHome --check-config -c /var/lib/wavcloud-adguard/AdGuardHome.yaml -w /var/lib/wavcloud-adguard
```

설정 파일은 서비스를 중지한 상태에서만 수정하고, 검사 후 다시 시작한다.
실행 중 직접 수정하면 서비스가 파일을 덮어쓸 수 있다.
`install-20261007.py`는 이번 설치의 기록이며 기존 설치가 있으면 중단한다. 업데이트용으로 재실행하지 않는다.
백업: `/opt/cloudmusic/backups/adguard-20261007T123759Z`의 기존 Nginx 설정·영구 방화벽 규칙.
DNS를 제거할 때는 휴대폰 DNS 설정을 먼저 자동으로 되돌리고 서비스·갱신 hook·Nginx DNS location/제한·853 규칙을 제거한다.
향후 웹 배포를 그대로 되돌리면 DNS location이 사라질 수 있으므로 현재 DNS 추가 설정을 함께 검토한다.

## 2026-10-07 확인 결과

- 외부 PC에서 DoH·DoT 각각 정상 조회와 광고 도메인 차단, 4개 검사 통과.
- SSH 터널의 관리 화면에서 생성한 계정 로그인·보호 활성화·차단 통계 확인.
- 관리 API는 미인증 접근 401, 관리 HTTP 포트는 loopback 전용, 외부 평문 DNS 리스너 없음.
- iPhone용 프로파일의 HTTPS DNS 주소·Payload 확인, 공개 다운로드 200 확인.
- Certbot 1.21.0의 `renew --dry-run --no-random-sleep-on-renew --non-interactive` 성공.
  이 버전은 `--run-deploy-hooks`를 지원하지 않아 실제 유효 인증서로 deploy hook을 따로 실행해 검증했다.
- hook 실행·DNS 재시작 후 외부 검사 다시 통과, 인증서 만료일 2026-11-15 유지.
- 최종 `MemoryCurrent` 44,556,288 bytes, 약 42.5MiB. 실행 파일 33MiB·데이터 약 4.2MiB.
- Nginx 검사 통과, DNS·음악 API·Nginx active. 음악 1,043곡과 스트리밍 206·다운로드 200 유지.
- 실제 휴대폰의 설정 적용과 각 앱 광고 차단 여부는 아직 직접 조작하여 검사하지 않았다.

로컬 화면 기록: `outputs/adguard-dashboard-2026-10-07.jpg`. 화면·관리 정보·프로파일 생성물은 Git에서 제외한다.

공식 문서: [설정](https://adguard-dns.io/kb/adguard-home/configuration/),
[암호화 DNS](https://github.com/AdguardTeam/AdGuardHome/wiki/Encryption),
[Oracle 보안 규칙](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm).
