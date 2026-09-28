# Android 웹 화면 소스

`app/src/main/assets/app.html`은 생성 파일이다. 화면을 수정할 때는 이 디렉터리의 CSS·JavaScript 또는 `tools/native-bridge.js`를 수정한다.

파일별 책임:

- `scripts/runtime.js`: 기존 WavCloud 기본 런타임. 공통 API 자체를 바꿀 때만 수정한다.
- `scripts/library-view.js`: 앨범·폴더·곡 목록과 검색 화면.
- `scripts/player-view.js`: 전체 플레이어·미니 플레이어·대기열 화면.
- `scripts/artwork.js`: 고화질 앨범아트 선택·캐시·표시.
- `scripts/dom-safety.js`, `scripts/ui-primitives.js`: 공통 화면 도우미.
- `scripts/cloud-dark.js`: Cloud Dark 화면 확장.
- `styles/clean-ui.css`, `styles/cloud-dark.css`: 디자인 수정.
- `tools/native-bridge.js`: JavaScript와 Android Media3 사이의 재생 계약.

```powershell
node android-app/tools/sync-web.mjs
node android-app/tools/sync-web.mjs --check
```

앨범아트의 단일 원본은 `android-app/artwork-catalog.json`이다. 앱에 내장되는 목록과 서버 배포용 JSON은 이 파일에서 생성한다.

```powershell
node android-app/tools/sync-web.mjs --export-catalog
```

`work/build.bat`은 웹 화면을 다시 생성하고 번들 검사를 통과한 뒤 APK를 빌드한다.

새 기능은 해당 책임 파일에 추가하고 `runtime.js`의 기존 클래스를 다시 덮어쓰는 코드는 늘리지 않는다. 재생 데이터 형식을 바꾸면 `test-native-contract.cjs`, 앨범아트 동작을 바꾸면 `test-artwork-quality.cjs`를 함께 갱신한다.
