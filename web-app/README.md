# WavCloud 웹사이트

Android와 같은 `android-app/web-src`의 API, 목록, 플레이어, 오프라인 저장 코드를 사용한다.
`android-app/tools/web-source.mjs`가 공통 입력 목록을 관리하고 플랫폼별 재생 구현을 선택한다.
웹에서는 브라우저 Audio·MediaSession·Cache API, Android에서는 Media3와 네이티브 저장소를 사용한다.
웹용 코드에 Android 브리지를 포함하지 않는다. 재생목록은 기존 기기별 로컬 저장 방식을 유지한다.

## 빌드와 검사

저장소 루트에서 Node.js 20.11 이상을 사용한다. 추가 npm 의존성은 없다.

```powershell
node web-app/tools/build.mjs
node web-app/tools/build.mjs --check
node --test web-app/tools/test-web.cjs
node android-app/tools/sync-web.mjs
node android-app/tools/check-bundle.mjs
```

출력은 Git에서 제외한 `web-app/dist`에 생긴다. `build.json`에 현재 버전과 배포 파일 목록이 있다.
CSS·JS 파일 이름은 내용 해시로 바뀌므로 Nginx의 1년 캐시와 충돌하지 않는다.
`--check`는 현재 생성물과 원본의 바이트 일치를 검사한다.
이전 빌드의 해시 파일이 출력 폴더에 남아도 **현재 build.json에 있는 파일만 배포**한다.

```powershell
node web-app/tools/preview.cjs
```

`http://localhost:3000`의 미리보기는 3곡의 테스트 음원과 가짜 API를 사용한다.
업로드된 파일은 이 테스트 서버에서 버리며 운영 서버로 전송하지 않는다.
로컬 브라우저에 테스트 토큰·곡 목록이 저장된다. 로그인 검사는 `/?scenario=login`에서
사용자 `audit`, 비밀번호 `demo`를 사용한다. 운영 서버 계정 정보가 아니다.

## 화면과 PWA

- 900px 이상: 왼쪽 메뉴, 항상 표시되는 검색 입력, 하단 플레이어와 음량 조절,
  큰 커버 옆에 표시되는 다음 재생 대기열.
- 그보다 작은 화면: 기존 모바일 탐색과 전체 플레이어·대기열 전환.
- 단축키: Ctrl+K 검색, Space 재생, ←/→ 5초 탐색, N/P 다음·이전 곡, M 음소거.
  입력·버튼·슬라이더·열린 창에서는 기본 키 동작을 보존한다.
- 기존 `cm_*` 저장 키와 `audio-cache`를 유지한다. 음원 캐시의 Range 응답을 만들어
  저장한 곡을 오프라인에서 재생·탐색할 수 있다.
- 서비스워커는 화면 파일과 로컬 음원만 처리한다. 로그인·업로드·곡 목록 API를 캐시하지 않는다.
  예전 Workbox 화면 캐시를 교체할 때 음원·앨범아트·사용자 저장 데이터를 지우지 않는다.
- 새 서비스워커는 실행 중인 화면을 강제로 새로고침하지 않는다. 새 버전 안내의
  새로고침 버튼으로 적용한다. 처음 옛 웹에서 옮길 때도 페이지를 새로고침하면 새 UI가 열린다.
- 브라우저별 저장 용량과 백그라운드 재생 정책은 해당 브라우저가 결정한다.

## 배포

현재 운영 웹은 `/opt/cloudmusic/client/dist`, Nginx 설정은 `/etc/nginx/sites-available/cloudmusic`이다.
기존 `downloads/`, `.well-known/`, 옛 해시 자산을 보존한다. 서버 API·음원·계정은 배포 대상이 아니다.

1. 현재 운영 `index.html`의 SHA-256을 읽고 변경 내역을 확인한다.
2. 검사를 통과한 `build.json`의 파일, `build.json`, 이 배포 스크립트를
   `/tmp/wavcloud-web-<버전>`으로 전송한다.
3. 전송 파일에 대해 `release.sha256`을 만든다. 비밀키·`.env`는 포함하지 않는다.
4. `sudo bash deploy.sh <릴리스 경로> <확인한 운영 index.html SHA-256>`을 실행한다.
5. HTTPS 화면·자산·서비스워커와 API를 확인한다.

스크립트는 현재 화면 해시를 확인하고 웹 전체와 Nginx 설정을 백업한 뒤
자산→HTML→서비스워커 순서로 반영한다. HTML은 재검증하고 해시 자산은 기존 캐시 정책을 쓴다.
실패 시 백업을 복원한다. 복구는 백업 `dist/.`를 운영 `dist/`에 복사하고
백업 `nginx.conf`를 복원한 뒤 `nginx -t`, `systemctl reload nginx`로 수행한다.
새 자산이 복구 후 남더라도 이전 HTML·서비스워커는 이를 참조하지 않는다.
