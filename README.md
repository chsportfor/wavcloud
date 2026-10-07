# WavCloud

Android 앱의 유지보수 원본은 `android-app/`에 있습니다. `work/`의 대부분은 이전 작업 기록과 이 PC의 빌드 도구이며, `outputs/`는 생성된 APK입니다.

다른 Windows PC에서는 이 저장소를 복제하고 [Android 빌드 안내](android-app/README.md)에 따라 Node.js, JDK 17, Android SDK 플랫폼 36을 준비하세요. 저장소에는 앱 소스와 `work/build.bat`이 포함됩니다. APK, 빌드 캐시, 로컬 SDK, 서명키는 Git에서 제외됩니다.

서버 접속용 SSH 개인키와 앱의 디버그 서명키는 Git에 포함하지 않습니다. 설치된 앱을 유지하면서 다른 PC의 APK로 업데이트하려면 `android-app/app/debug.keystore`를 별도로 옮겨야 합니다.

서버의 현재 실행 코드와 검사 도구는 `server/`에 있습니다. 운영 서버의 `.env`, 음원, 웹 PWA 배포 파일은 포함하지 않습니다.

[다른 환경에서 작업 이어가기](docs/WORKING_ELSEWHERE.md)에 저장소 동기화, 빌드 환경, SSH 접속과 운영 확인 절차를 정리했습니다. 현재 구조와 리팩토링 결과는 [작업 보고서](docs/REFACTOR_REVIEW_2026-10-03.md)를 참고하세요.

[2026-10-07 추가 리팩토링](docs/REFACTOR_REVIEW_2026-10-07.md)은 오프라인 관리 모듈 분리와 다운로드·캐시 이전의 동시 작업 문제를 다룹니다.
