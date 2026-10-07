@echo off
set "BUILD_KIND=%~1"
if not defined BUILD_KIND set "BUILD_KIND=release-personal"
set "APK_VARIANT=release"
set "GRADLE_BUILD_TASK=assembleRelease"
set "SIGNING_OPTION="
if "%BUILD_KIND%"=="debug" (
  set "APK_VARIANT=debug"
  set "GRADLE_BUILD_TASK=assembleDebug"
)
if "%BUILD_KIND%"=="release-personal" set "SIGNING_OPTION=-PpersonalRelease=true"
if "%BUILD_KIND%"=="bundle" set "GRADLE_BUILD_TASK=bundleRelease"
if not "%BUILD_KIND%"=="debug" if not "%BUILD_KIND%"=="release-personal" if not "%BUILD_KIND%"=="release" if not "%BUILD_KIND%"=="bundle" (
  echo Usage: build.bat [release-personal^|debug^|release^|bundle]
  exit /b 1
)
if "%BUILD_KIND%"=="release" if not defined WAVCLOUD_RELEASE_KEYSTORE (
  echo Set WAVCLOUD_RELEASE signing environment variables, or use release-personal for the existing installation key.
  exit /b 1
)
if "%BUILD_KIND%"=="bundle" if not defined WAVCLOUD_RELEASE_KEYSTORE (
  echo Set WAVCLOUD_RELEASE signing environment variables before generating an upload bundle.
  exit /b 1
)
for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"
if exist "%PROJECT_DIR%\work\android-tools\jdk\jdk-17.0.20.1+1\bin\java.exe" (
  set "JAVA_HOME=%PROJECT_DIR%\work\android-tools\jdk\jdk-17.0.20.1+1"
)
if exist "%PROJECT_DIR%\work\android-tools\android-sdk\platforms\android-36" (
  set "ANDROID_HOME=%PROJECT_DIR%\work\android-tools\android-sdk"
)
if exist "%PROJECT_DIR%\work\android-tools\gradle-home" (
  set "GRADLE_USER_HOME=%PROJECT_DIR%\work\android-tools\gradle-home"
)
if exist "%PROJECT_DIR%\work\android-tools\android-user-home" (
  set "ANDROID_USER_HOME=%PROJECT_DIR%\work\android-tools\android-user-home"
)
if not defined ANDROID_USER_HOME set "ANDROID_USER_HOME=%USERPROFILE%\.android"
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
if not defined ANDROID_HOME if defined ANDROID_SDK_ROOT set "ANDROID_HOME=%ANDROID_SDK_ROOT%"
if not defined ANDROID_HOME (
  echo Android SDK not found. Set ANDROID_HOME to an SDK with platform 36.
  exit /b 1
)
if not defined JAVA_HOME (
  echo JDK not found. Set JAVA_HOME to JDK 17.
  exit /b 1
)
if not exist "%PROJECT_DIR%\android-app\app\debug.keystore" (
  "%JAVA_HOME%\bin\keytool.exe" -genkeypair -keystore "%PROJECT_DIR%\android-app\app\debug.keystore" -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" -noprompt
  if errorlevel 1 exit /b 1
)

cd /d "%PROJECT_DIR%"
node android-app\tools\sync-web.mjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\check-bundle.mjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-native-contract.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-player-updates.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-native-offline.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-offline-store.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-offline-row.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-artwork-quality.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-artwork-catalog-load.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-cloud-dark.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-queue-display.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-dom-safety.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-library-feedback.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-library-data.cjs
if errorlevel 1 exit /b %errorlevel%
node android-app\tools\test-api-client.cjs
if errorlevel 1 exit /b %errorlevel%

cd /d "%PROJECT_DIR%\android-app"
call gradlew.bat testDebugUnitTest %GRADLE_BUILD_TASK% %SIGNING_OPTION%
if errorlevel 1 exit /b %errorlevel%

cd /d "%PROJECT_DIR%"
if "%BUILD_KIND%"=="bundle" (
  echo AAB: android-app\app\build\outputs\bundle\release\app-release.aab
  exit /b 0
)
node android-app\tools\package-apk.mjs %APK_VARIANT%
if errorlevel 1 exit /b %errorlevel%
