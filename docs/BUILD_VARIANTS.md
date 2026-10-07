# Android 빌드 종류와 서명

기본 빌드는 개인용 릴리스 APK다. 빌드 종류와 서명 인증서는 별개의 설정이다.
개인용 릴리스는 `debuggable=false`, R8 코드 축소·최적화, 리소스 축소를 사용하고,
기존 `android-app/app/debug.keystore`로 서명하여 설치된 앱을 업데이트할 수 있다.
0.1.34 릴리스와 0.1.33 디버그 APK의 인증서 SHA-256이 동일한 것을 확인했다.

| 명령 | 결과 | 서명 |
| --- | --- | --- |
| `work\build.bat` 또는 `work\build.bat release-personal` | 개인용 Release APK | 기존 설치 키 |
| `work\build.bat debug` | Debug APK | 기존 설치 키 |
| `work\build.bat release` | 배포용 Release APK | 환경변수로 지정한 별도 키 |
| `work\build.bat bundle` | Release AAB | 환경변수로 지정한 별도 키 |

APK는 `outputs/WavCloud-Android-<버전>-<종류>.apk`에 복사한다.
AAB는 `android-app/app/build/outputs/bundle/release/app-release.aab`에 생성한다.
각 명령은 화면 생성과 JavaScript 회귀 검사, Kotlin 단위 검사를 먼저 실행한다.
서명하지 않은 APK를 완성된 배포 APK로 복사하지 않는다.

별도 서명을 사용할 때는 아래 네 환경변수를 설정한다. 키와 암호는 Git에 넣지 않는다.

- `WAVCLOUD_RELEASE_KEYSTORE`: keystore의 절대 경로
- `WAVCLOUD_RELEASE_STORE_PASSWORD`: 저장소 암호
- `WAVCLOUD_RELEASE_KEY_ALIAS`: 키 별칭
- `WAVCLOUD_RELEASE_KEY_PASSWORD`: 키 암호

새 인증서로 만든 앱은 현재 설치의 인증서와 다르므로 업데이트 호환성을 별도로 결정해야 한다.
개인용 Release APK의 현재 인증서 이름은 `Android Debug`이며, 기존 설치 호환성을 위해 유지한다.
Google Play 배포는 별도 업로드 키와 Play App Signing을 사용하는 흐름으로 설정한다.
현재 검증한 산출물은 개인용 Release APK이며 별도 키의 APK·AAB는 설정 경로를 제공한다.

R8에서는 `@JavascriptInterface`가 붙은 모든 브리지 메서드를 유지한다. 재생·오프라인·앨범아트
세 브리지의 메서드가 R8 보존 목록에 남아 있는 것을 확인했다.

공식 근거: [명령줄 빌드](https://developer.android.com/build/building-cmdline),
[앱 서명](https://developer.android.com/studio/publish/app-signing).
