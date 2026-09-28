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

파일별 책임과 수정 방법은 [ARCHITECTURE.md](ARCHITECTURE.md)에 있습니다.
