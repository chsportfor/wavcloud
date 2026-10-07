# WavCloud PC 앱

Windows x64용 독립 창과 설치 파일을 제공한다. 앱은 운영 웹사이트
`https://wavcloud.duckdns.org/`를 전용 Chromium 창으로 열어 공통 화면과 재생 기능을 사용한다.
웹 UI를 수정하면 PC 앱에서도 갱신된 화면을 사용할 수 있다.

## 설치와 사용

- 운영 다운로드: [설치형](https://wavcloud.duckdns.org/downloads/WavCloud-PC-0.1.0-x64-nsis.exe),
  [무설치형](https://wavcloud.duckdns.org/downloads/WavCloud-PC-0.1.0-x64-portable.exe),
  [SHA-256](https://wavcloud.duckdns.org/downloads/WavCloud-PC-0.1.0-SHA256.txt).
- `WavCloud-PC-0.1.0-x64-nsis.exe`: 현재 사용자에게 설치하고 바탕화면·시작 메뉴 바로가기를 만든다.
  관리자 권한을 요청하지 않는다. 설치 후 WavCloud 바로가기로 실행한다.
- `WavCloud-PC-0.1.0-x64-portable.exe`: 설치 없이 실행한다.
  로그인과 음악 캐시는 이 PC의 사용자 데이터 폴더에 저장한다. 실행 파일에 포함되지 않는다.
- 처음 실행할 때 기존 WavCloud 계정으로 로그인한다. 웹 브라우저의 로그인은 자동으로 가져오지 않는다.
- 창의 X 버튼은 기본적으로 트레이로 이동한다. 최소화·트레이 이동 중에도 재생이 계속된다.
  트레이의 WavCloud 열기로 복원하고, 트레이나 앱 메뉴의 종료로 완전히 종료한다.
  앱 메뉴에서 트레이 이동을 끄면 X 버튼으로 종료한다. Alt+F4는 완전히 종료한다.
- Ctrl+K 검색, Space 재생·일시정지, ←/→ 5초 이동, N/P 다음·이전, M 음소거는 웹과 같다.
  Windows의 미디어 조작은 공통 플레이어의 MediaSession을 사용한다.
- 보기 메뉴의 최신 화면 다시 열기는 현재 웹 버전으로 다시 연다. 재생도 중단되므로 필요한 때에 사용한다.
- 저장됨에서 곡을 오프라인으로 보관한다. 최초 로그인과 아직 저장하지 않은 곡은 인터넷 연결이 필요하다.
- 창 크기·최대화·트레이 설정을 복원하고, 사라진 모니터 위치는 기본 화면으로 되돌린다.
- 연결 실패나 화면 프로세스 종료 시 다시 열기 화면을 표시한다. 사용자 데이터를 자동으로 삭제하지 않는다.

데이터 위치는 일반적으로 `%APPDATA%\WavCloud`다. 설치형과 무설치형은 같은 PC에서 같은 데이터를 사용한다.
Android·다른 브라우저·다른 PC와 재생목록을 동기화하지 않는다.

## 개발·빌드

Node.js 22.12 이상과 npm을 설치하고 저장소 루트에서 실행한다. JDK·Android SDK는 필요하지 않다.
첫 설치와 빌드에는 공식 npm·Electron·electron-builder 배포물을 받기 위한 인터넷 연결이 필요하다.

```powershell
cd desktop-app
npm ci
npm test
npm start
npm run dist
```

`npm run pack`은 `dist/win-unpacked`의 압축하지 않은 실행본을 만든다.
`npm run dist`는 검사 후 NSIS 설치형·무설치형을 만들고 저장소 `outputs/`에 실행 파일과 SHA-256을 복사한다.
Electron과 빌더 버전은 package.json과 package-lock.json에 고정한다.
현재 개인용 Windows 빌드에는 Authenticode 코드 서명을 적용하지 않았다.
자체 자동 업데이트 서버는 구성하지 않았다. PC 런타임은 새 설치 파일로 업데이트하며 앱 ID와 데이터 경로를 유지한다.
웹 화면·기능 갱신은 웹 배포와 새 버전 안내를 사용한다.

## 코드 구조와 검사

- `src/main.cjs`: 단일 실행 잠금과 초기화.
- `src/application.cjs`: 창·트레이·메뉴·재시도·다운로드·재생 중 절전 방지.
- `src/policy.cjs`: 서비스 URL·권한·모니터 위치 검증.
- `src/state.cjs`: 창 설정만 원자적으로 저장. 로그인 정보는 이 JSON에 기록하지 않는다.
- `src/recovery.html`: 로컬 연결 실패 화면.
- `tools/assets.mjs`: 웹의 아이콘 생성기를 재사용해 Windows ICO·PNG 생성.
- `test/application.test.cjs`: 잘못된 URL·권한·설정, 트레이 종료, 장애 복구, 재생 상태와 중복 실행 검사.
- `tools/check-runtime.cjs`: 창을 만들지 않고 실제 Electron에서 패키지 모듈·아이콘·지속 세션 검사.

서비스 화면에는 Node.js·IPC·로컬 파일 API를 노출하지 않는다. sandbox·contextIsolation을 유지하고
다른 사이트로의 탐색, 팝업과 webview를 차단한다. 인증서 검증과 웹 보안을 유지한다.
앱 전체를 수정할 때 이 경계를 풀거나 개인키·운영 .env를 패키지에 포함하지 않는다.

사용한 문서: [Electron 보안](https://www.electronjs.org/docs/latest/tutorial/security),
[지속 세션](https://www.electronjs.org/docs/latest/api/session),
[재생 이벤트](https://www.electronjs.org/docs/latest/api/web-contents),
[절전 방지](https://www.electronjs.org/docs/latest/api/power-save-blocker),
[Windows 설치·무설치 빌드](https://www.electron.build/docs/nsis/).
