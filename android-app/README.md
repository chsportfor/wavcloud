# WavCloud Android

기존 WavCloud 웹 화면을 앱에 포함하고 Android Media3로 재생합니다. 화면 소스는 `web-src/`이며 `app/src/main/assets/app.html`은 빌드 중 생성됩니다.

## Windows 빌드

Node.js, JDK 17, Android SDK 플랫폼 36이 필요합니다. 프로젝트 안의 `work/android-tools/`가 없으면 `JAVA_HOME`과 `ANDROID_HOME`을 설치 위치로 설정하세요. 첫 빌드에는 Gradle 의존성을 내려받을 네트워크 연결이 필요합니다.

다른 PC에서는 먼저 저장소를 복제한 다음 프로젝트 루트에서 실행합니다.

```powershell
git clone https://github.com/chsportfor/wavcloud.git
cd wavcloud
```

JDK와 SDK를 설치한 뒤 `JAVA_HOME`과 `ANDROID_HOME`을 설정하고 빌드합니다.

```powershell
& .\work\build.bat
```

스크립트는 화면 생성, JavaScript·Android 검사, APK 빌드를 차례로 실행하고 `outputs/WavCloud-Android-<버전>-debug.apk`를 만듭니다.

`app/debug.keystore`가 있으면 기존 디버그 APK와 같은 키로 서명합니다. 다른 PC에서도 설치된 앱 위에 업데이트하려면 이 파일을 Git과 별도로 안전하게 옮기세요. 없으면 빌드 스크립트가 새 디버그 키를 만들므로 기존 앱과 서명이 달라집니다.

Android 앱의 오프라인 음원은 앱 내부 저장소에 보관하며 Media3가 직접 재생합니다. 이전 버전의 WebView 캐시에 저장된 음원은 오프라인 목록을 열 때 앱 저장소로 순차적으로 이전됩니다.

재생 대기열, 현재 곡, 재생 위치, 반복·셔플 상태는 앱 내부 저장소에 보관합니다. 앱을 종료한 뒤 다시 열면 마지막 대기열이 일시정지 상태로 복원되며, 재생 버튼을 누르면 이어서 재생합니다.

라이브러리 스캔은 파일 탐색 단계와 곡 처리 진행률(처리 수/전체 수)을 화면 상단에 표시합니다. 스캔 중에도 라이브러리를 사용할 수 있으며, 앱을 다시 열면 진행 중인 서버 작업에 연결합니다. 재생목록 생성·곡 추가·삭제는 앱 내부 하단 창으로 처리합니다.

파일별 책임과 수정 방법은 [ARCHITECTURE.md](ARCHITECTURE.md)에 있습니다.

0.1.32에서는 검색과 빈 목록 안내를 복구하고, API·저장 데이터 처리를 별도 모듈로 분리했습니다.
검색 결과·저장됨 목록의 곡 메뉴 배치를 통일했으며, 필터된 목록 정렬과 늦은 오프라인 조회가
다른 목록을 변경하는 문제를 막았습니다. Android 파일 선택 연결도 추가했습니다.
상세 분석과 검증 범위는 [2026-10-03 리팩토링 결과](../docs/REFACTOR_REVIEW_2026-10-03.md)에 있습니다.

0.1.33에서는 압축 런타임의 오프라인 저장 관리를 `offline-store.js`로 분리했습니다.
중복 다운로드와 Android 캐시 이전의 동시 실행을 막고, 실패한 이전의 재시도와 다운로드 중 삭제를 처리합니다.
검색·재생목록·저장됨 목록에서도 저장 표시를 갱신합니다.
검증 결과와 남은 개선 과제는 [2026-10-07 리팩토링 결과](../docs/REFACTOR_REVIEW_2026-10-07.md)에 있습니다.
