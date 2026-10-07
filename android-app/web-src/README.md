# WavCloud 공통 화면 소스

Android 내장 `app.html`과 운영 웹사이트는 이 디렉터리의 같은 화면·기능 소스를 사용한다.
`app/src/main/assets/app.html`과 `web-app/dist`는 생성물이며 직접 수정하지 않는다.

- `api-client.js`, `library-data.js`: API, 목록 불러오기·재시도, 저장 데이터 검증.
- `library-view.js`, `library-ui.js`: 앨범·폴더·곡·검색·재생목록 화면.
- `audio-player.js`: 브라우저 재생과 공통 대기열·상태 모델.
- `android-player.js`: Android Media3 계약. 웹 빌드에서는 제외한다.
- `player-view.js`, `mini-player-view.js`: 전체·미니 플레이어와 대기열.
- `offline-store.js`: 브라우저 음원 캐시와 동시 다운로드 관리.
- `native-offline.js`: Android 네이티브 저장 연결. 웹 빌드에서는 제외한다.
- `artwork.js`, `artwork-view.js`: 앨범아트 선택·캐시·표시.
- `dom-safety.js`, `ui-primitives.js`, `runtime-support.js`: 공통 도우미.
- `upload-dialog.js`, `library-feedback.js`: 업로드, 폴더 입력, 스캔 진행 화면.
- `cloud-dark.js`와 `styles/`: 공통 디자인과 재생 대기열 표시.
- `app-controller.js`, `playback-runtime.js`, `bootstrap.js`: 화면·재생 환경 선택과 시작.

`tools/web-source.mjs`가 모듈 순서와 앨범아트 목록 삽입을 관리한다.
압축 런타임이나 View 프로토타입 재정의를 추가하지 않는다. 클래스의 원래 메서드를 수정한다.

저장소 루트에서:

```powershell
node android-app/tools/sync-web.mjs
node android-app/tools/check-bundle.mjs
node web-app/tools/build.mjs
node --test web-app/tools/test-web.cjs
```

앨범아트의 단일 원본은 `android-app/artwork-catalog.json`이다.
`node android-app/tools/sync-web.mjs --export-catalog`로 배포용 JSON을 따로 생성할 수도 있다.
전체 Android 검사는 `work/build.bat`, 웹 실행·배포는 [웹 개발 안내](../../web-app/README.md)를 따른다.
