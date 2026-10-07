# WavCloud

Android 앱은 `android-app/`, 웹사이트의 빌드와 PC 화면은 `web-app/`, Windows PC 앱은 `desktop-app/`에 있습니다. 공통 화면·기능 소스는 `android-app/web-src/`에서 관리합니다. `work/`는 주로 이전 작업 기록과 로컬 빌드 도구이며, `outputs/`는 생성된 APK·Windows 설치 파일과 확인 화면입니다.

다른 Windows PC에서는 이 저장소를 복제하고 [Android 빌드 안내](android-app/README.md)에 따라 Node.js, JDK 17, Android SDK 플랫폼 36을 준비하세요. 저장소에는 앱 소스와 `work/build.bat`이 포함됩니다. APK, 빌드 캐시, 로컬 SDK, 서명키는 Git에서 제외됩니다.

서버 접속용 SSH 개인키와 앱의 디버그 서명키는 Git에 포함하지 않습니다. 설치된 앱을 유지하면서 다른 PC의 APK로 업데이트하려면 `android-app/app/debug.keystore`를 별도로 옮겨야 합니다.

서버 개발 소스는 `server/src/`이며 빌드로 `server/dist/`를 생성합니다. 웹 개발 소스와 빌드·검사·배포 도구도 이 저장소에 포함합니다. 운영 `.env`, 음원과 생성된 웹 배포물은 Git에 넣지 않습니다.

[다른 환경에서 작업 이어가기](docs/WORKING_ELSEWHERE.md)에 저장소 동기화, 빌드 환경, SSH 접속과 운영 확인 절차를 정리했습니다. 현재 구조와 리팩토링 결과는 [작업 보고서](docs/REFACTOR_REVIEW_2026-10-03.md)를 참고하세요.

[2026-10-07 추가 리팩토링](docs/REFACTOR_REVIEW_2026-10-07.md)은 오프라인 관리 모듈 분리와 다운로드·캐시 이전의 동시 작업 문제를 다룹니다.

[핵심 리팩토링 완료 보고서](docs/REFACTOR_COMPLETION_2026-10-07.md)는 화면 클래스 통합, 반복 갱신 제거,
서버 목록 복원·변경 파일 검사와 검증 결과를 정리합니다. 기본 앱 빌드는 기존 설치 키를 사용하는
개인용 릴리스 APK입니다. [빌드 종류와 서명 안내](docs/BUILD_VARIANTS.md)를 참고하세요.

[웹 개발 안내](web-app/README.md)에 공통 소스, PC 배치, 단축키, PWA 캐시와 배포·복구 절차를 정리했습니다.
[2026-10-07 웹 적용 결과](docs/WEB_COMPLETION_2026-10-07.md)를 참고하세요.

[PC 앱 개발·설치 안내](desktop-app/README.md)에 Windows 설치형·무설치형,
트레이 재생·창 복원·사용자 데이터·빌드 절차를 정리했습니다.
[Windows PC 앱 구성 결과](docs/PC_COMPLETION_2026-10-07.md)에 확인 범위와 산출물이 있습니다.
