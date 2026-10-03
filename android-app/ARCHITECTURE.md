# WavCloud Android 구조

## 빌드 흐름

1. `web-src/`의 CSS와 JavaScript를 `tools/sync-web.mjs`가 결합한다.
2. `artwork-catalog.json`을 검증하고 앱 내장 앨범아트 목록으로 삽입한다.
3. 생성 결과를 `app/src/main/assets/app.html`에 기록한다.
4. Node 계약·회귀 검사를 실행한다.
5. Gradle이 Android APK를 빌드한다.

`app.html`은 수정 대상이 아니다. `work/build.bat`을 실행하면 항상 원본에서 다시 생성된다.

## 재생 경계

- `tools/native-bridge.js`는 웹 플레이어 명령과 상태를 Android 형식으로 변환한다.
- Android WebView에서는 `runtime.js`의 브라우저 오디오와 브라우저 MediaSession을 시작하지 않는다. 대기열·상태 모델만 공유하고 재생은 Media3가 담당한다.
- `NativePlayerBridge.kt`는 명령을 Media3 `Player`에 적용한다.
- `QueueUpdatePlanner.kt`는 대기열 변경을 추가·이동·삭제로 계산한다. 재생 중 대기열 수정 시 전체 재생목록을 다시 준비하지 않는다.
- `PlayerStateDispatcher.kt`는 Media3 상태를 전체 상태와 500ms 진행 상태로 나눠 웹에 전달한다.
- 재연결 시 전체 대기열과 반복·셔플 설정을 전달한다. 이후 대기열·메타데이터 변경 이벤트에만 대기열을 포함하고, 일반 재생 상태 이벤트에는 상태 필드만 전달한다.
- `JavascriptGateway.kt`는 WebView 콜백 호출과 JSON 인코딩을 한 곳에서 처리한다.
- `PlaybackService.kt`는 백그라운드 재생과 MediaSession 수명을 담당한다. `PlaybackQueueStore.kt`가 대기열 변경과 재생 위치를 앱 내부 저장소에 기록하고, 프로세스가 다시 시작되면 일시정지 상태로 복원한다.
- `OfflineAudioStore.kt`는 오프라인 파일 저장과 Media3용 로컬 URI를 담당한다. `NativeOfflineBridge.kt`와 `native-offline.js`가 기존 웹 화면의 저장·삭제 계약을 연결한다.
- 오프라인 파일은 다운로드 크기와 전송 완료를 확인한 뒤 임시 파일에서 최종 경로로 옮긴다. 동시에 두 WebView 캐시 가져오기가 시작되면 나중 요청은 거절된다.

## 변경 기준

- 디자인 변경은 `web-src/styles/`와 해당 View 파일에서 처리한다.
- `api-client.js`는 인증, API 응답 검증, 요청 제한 시간, 미디어 URL과 업로드 통신을 담당한다. 기존 런타임에서 API 클래스를 분리했으므로 통신 기능은 이 파일에서 확장한다.
- `library-data.js`는 저장된 곡·재생목록 검증, 곡 목록 불러오기와 재시도, 중복 요청 억제, 오프라인 저장 작업의 실패 복구를 담당한다. 브라우저 캐시 저장에 실패해도 서버에서 받은 곡 목록은 표시한다.
- 목록 렌더링은 `trackRenderVersion`을 확인한다. 오프라인 파일 조회를 기다리는 동안 탭이나 상세 화면이 바뀌면 이전 렌더링을 중단한다.
- `FileChooserBridge.kt`는 HTML 파일 입력과 Android 파일 선택기를 연결한다. 새 선택 요청, 선택 취소, 액티비티 종료 시 대기 중인 콜백을 정리한다.
- 대기열 화면의 다음 재생 순서는 `web-src/scripts/cloud-dark.js`의 `cloudUpcomingQueue`가 결정한다. 항목의 `data-index`는 실제 대기열 인덱스를 유지해 순서 변경과 삭제에 사용한다.
- 앨범·폴더 기능은 `library-view.js`, 플레이어·대기열 기능은 `player-view.js`에서 처리한다.
- `library-feedback.js`는 재생목록 창과 스캔 진행 카드의 DOM을 만든다. `runtime.js`의 라이브러리 메서드가 이 함수들을 호출하며, 서버의 `/api/tracks/scan/start`와 `/scan/status`로 실제 진행 상황을 확인한다.
- 커버 URL 변경은 `artwork-catalog.json`만 수정한다.
- Android 재생 명령이나 상태 필드를 바꿀 때는 JavaScript와 Kotlin 양쪽 계약을 함께 변경한다.
- 대기열 변경은 웹의 `player:queue-changed` 이벤트 한 곳에서 네이티브로 전송한다. “다음에 재생”도 이 경로를 사용한다.
- 생성 파일을 직접 수정하거나 새 프로토타입 패치를 추가하지 않는다.

## 자동 검사

- `check-bundle.mjs`: 원본과 생성물 일치, 네이티브 브리지 포함 여부
- `test-native-contract.cjs`: 진행 상태와 전체 상태가 대기열·현재 곡을 보존하는지 검사
- `QueueUpdatePlannerTest.kt`: 추가·순서 변경·삭제·중복 곡·비우기 검사
- `test-artwork-quality.cjs`: 고화질 커버 선택·중복 요청·실패 대체 검사
- `test-cloud-dark.cjs`: 플레이어, 필터, 스크롤, 곡 순서 회귀 검사
- `test-native-offline.cjs`: Android 오프라인 저장·삭제 및 기존 WebView 캐시 이전 검사
- `test-offline-row.cjs`: 앨범 곡의 저장 표시가 다운로드·삭제 직후 갱신되는지 검사
- `test-dom-safety.cjs`: 외부 메타데이터 표시 계약 검사
- `test-library-feedback.cjs`: 한글·일본어 재생목록, 중복 추가 방지, 스캔 진행률·재연결·통신 오류 복구 검사
- `test-library-data.cjs`: 손상된 저장 데이터, 캐시 용량 초과, 중복 목록 요청, 오프라인 저장 실패 복구 검사
- `test-api-client.cjs`: 미디어 URL 인코딩, API 응답 검증, 로그인 만료, 통신 제한 시간 검사
- `test-artwork-catalog-load.cjs`: 원격 목록이 멈춰도 내장 목록으로 돌아오는지 검사
- `test-queue-display.cjs`: 현재 곡 이후 순서, 순서 변경, 전체 반복, 셔플 안내 검사

`work/build.bat`은 검사와 APK 빌드가 끝난 뒤 `outputs/`에 버전명이 들어간 APK를 복사하고 SHA-256을 출력한다.
