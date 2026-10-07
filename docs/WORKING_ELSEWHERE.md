# 다른 환경에서 WavCloud 작업 이어가기

이 저장소에는 Android 앱·웹사이트·Windows PC 앱 소스, 서버 개발 JavaScript와 빌드 결과, 검사·배포 도구와 작업 보고서가 있다.
서버 SSH 개인키, Android 앱 서명키, 운영 `.env`, 음악 파일, APK와 로컬 SDK는 별도 관리한다.

## 코드 가져오기

처음 작업하는 환경에서는 다음과 같이 복제한다. 저장소가 인증을 요구하면 본인의 GitHub 계정으로 인증한다.

```powershell
git clone https://github.com/chsportfor/wavcloud.git
cd wavcloud
git status
```

이미 복제했다면 로컬 변경을 먼저 커밋하거나 보관한 다음 최신 코드를 받는다.

```powershell
git pull --ff-only origin main
```

작업 시작 전에 [구조 설명](../android-app/ARCHITECTURE.md)과
[2026-10-03 작업 보고서](REFACTOR_REVIEW_2026-10-03.md)를 읽는다.
화면 소스는 `android-app/web-src/`이며 생성된 `app.html`을 직접 수정하지 않는다.
서버는 `server/src/`의 JavaScript를 수정하고 `npm run build`로 `server/dist/`를 생성한다.
실행 코드를 바탕으로 개발 소스를 재구성했으며 원래의 TypeScript 프로젝트는 발견되지 않았다.
웹사이트는 `web-app/`의 템플릿·PC 배치·서비스워커와 `android-app/web-src/`의 공통 화면을 사용한다.
`node web-app/tools/build.mjs`로 웹 배포물을 생성하고 `node --test web-app/tools/test-web.cjs`로 검사한다.
웹만 수정할 때는 Android SDK와 앱 서명키가 필요하지 않다. [웹 개발·배포 안내](../web-app/README.md)를 따른다.

Windows PC 앱은 `desktop-app/`에 있다. Node.js 22.12 이상과 npm으로
`cd desktop-app`, `npm ci`, `npm run dist`를 실행한다. Android SDK와 SSH 키는 PC 앱 빌드에 필요하지 않다.
PC 앱은 운영 웹 UI를 사용하므로 공통 화면 변경은 웹 배포로 적용한다.
Electron 런타임·창·트레이 변경은 새 PC 설치 파일을 만들어야 한다. [PC 앱 안내](../desktop-app/README.md)를 따른다.

## Windows에서 Android APK 빌드

Node.js 20.11 이상, JDK 17, Android SDK 플랫폼 36을 설치하고 아래 경로를 실제 설치 위치로 바꾼다.
Gradle은 저장소의 wrapper를 사용한다. 첫 빌드에는 의존성을 받기 위한 네트워크 연결이 필요하다.

```powershell
$env:JAVA_HOME = 'C:\Tools\jdk-17'
$env:ANDROID_HOME = 'C:\Android\Sdk'
& .\work\build.bat
```

결과는 `outputs/WavCloud-Android-<버전>-release.apk`이다. 기본값은 기존 앱 키를 사용하는 개인용 릴리스다.
디버그 검사 빌드는 `& .\work\build.bat debug`로 실행한다. 별도 서명과 AAB는 [빌드 안내](BUILD_VARIANTS.md)를 참고한다.
`work/android-tools/`에 도구를 두면 빌드 스크립트가 해당 경로를 우선 사용한다.
이 PC의 기존 도구는 `C:\Users\JUNGLE\Documents\Codex\2026-09-15\cloud-duckdns-org\work\android-tools`에 있다.
다른 PC에서는 이 절대 경로 대신 새 환경의 설치 경로를 사용한다.

기존 설치 위에 업데이트하려면 기존 `android-app/app/debug.keystore`를
새 프로젝트의 같은 위치에 별도로 가져와 **첫 빌드 전에** 배치한다.
없으면 빌드 스크립트가 새 키를 생성해 기존 앱과 서명이 달라진다.
SSH 개인키와 앱 서명키는 서로 다른 파일이며 Git에 추가하지 않는다.

## 서버 SSH 접속

현재 운영 접속은 `ubuntu@wavcloud.duckdns.org`, SSH 포트 `22`다.
본인이 관리하는 개인키 경로를 사용한다.
Windows OpenSSH는 개인키 파일이 다른 사용자에게 공개된 권한이면 접속을 거절할 수 있다.
개인키 접근 권한을 본인 계정으로 제한한다.

현재 신뢰하는 서버 호스트키 기록은 이 PC의
`C:\Users\JUNGLE\Documents\Codex\2026-09-15\cloud-duckdns-org\work\known_hosts`에 있다.
이를 새 환경의 `~/.ssh/wavcloud_known_hosts`로 가져오거나 별도 신뢰 경로로 서버 지문을 확인한다.
아래 명령은 이미 확인한 호스트키 파일이 있을 때 사용한다.

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519" -p 22 -o "UserKnownHostsFile=$env:USERPROFILE/.ssh/wavcloud_known_hosts" -o StrictHostKeyChecking=yes ubuntu@wavcloud.duckdns.org
```

접속 후 읽기 전용 상태 확인:

```bash
systemctl is-active cloudmusic nginx
cd /opt/cloudmusic/server
node --version
```

API는 `/opt/cloudmusic/server/dist`, 웹 배포 파일은 `/opt/cloudmusic/client/dist`,
음원 기준 경로는 `/mnt/music`다. 실제 운영 환경변수는 서버의 `.env`와 systemd 설정을 사용한다.
로컬 `server/dist/config.js`의 기본값을 운영 계정이나 운영 비밀값으로 사용하지 않는다.
서버 코드만 수정한다면 Android 빌드 도구와 앱 서명키는 필요하지 않다.

## 서버 검사와 배포

깨끗한 개발 환경에서는 `server/`에서 `npm ci`, `npm run build`, `npm test`를 실행한다.
WAV→FLAC 변환의 실제 검사는 FFmpeg가 필요하다. 현재 Linux 운영 서버에는 해당 도구와 의존성이 있다.
새 개발 환경의 `.env`는 별도로 설정하고 운영 `.env`를 Git에 넣지 않는다.

`server/scripts/deploy*.sh`는 특정 변경을 적용할 때 사용한 기록이며 공통 배포 명령이 아니다.
예전 파일 해시, 경로, 새 파일 조건을 검사하므로 현재 서버에 그대로 재실행하지 않는다.
다음 배포에서는 현재 서버 파일과 변경분을 비교하고, 검사·백업·반영·운영 확인·복구 절차를 준비한다.
2026-10-03 수정과 2026-10-07 시작·스캔 리팩토링은 운영 서버에 적용됐다.
최종 백업은 `/opt/cloudmusic/backups/startup-refactor-20261007T074214Z`이며
[완료 보고서](REFACTOR_COMPLETION_2026-10-07.md)에 확인 결과가 있다.

검증 도구 `server/scripts/verify-live-refactor.js`는 운영 서버에서
`sudo env NODE_PATH=/opt/cloudmusic/server/node_modules node <검증도구의 실제 경로>`로 실행한다.
운영 환경을 읽어 60초짜리 토큰으로 목록·스트리밍·다운로드를 조회하며 비밀값을 출력하지 않는다.

다른 환경에서 수정한 내용도 검사 후 커밋·푸시하고, 기존 환경에서는 로컬 작업을 보관한 뒤
`git pull --ff-only origin main`으로 받는다. Git 동기화와 운영 서버 배포는 별도 단계다.
