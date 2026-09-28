# 앨범아트 고화질 작업 인수인계 — 2026-09-22

## 사용자 요청 / 현재 중단 지점

- 안드로이드 **WavCloud 앱** 앨범아트 화질 개선. 웹사이트 수정 요청은 아님.
- 찾기 어려운 동인/개인 앨범은 **YouTube 제작자 영상과 Bandcamp**를 확인하라고 사용자가 명시함.
- 사용자가 WavCloud 웹에 직접 로그인해 라이브러리를 보여줌. 총 **75개 앨범** 확인.
- 최신 요청: “다른 agent가 이어서 찾게 진행상황 정리해놔”. 이에 검색을 중단하고 이 문서를 작성함. 다른 에이전트/새 작업을 생성하지 않았음.
- 현재 **48개 앨범의 출처와 이미지 파일 다운로드/해상도 검증 완료**, **27개 추가 조사 필요**.
- **중요:** 48개 모두 기존 표지보다 실제로 선명해졌다는 기기 검증은 아직 아님. 이미지 URL 정상 응답, 크기, 형태를 검사했고 앨범명/제작자 기준으로 수동 연결했음. 모든 기존 표지와 시각적/판본 대조까지 완료하지는 않았음.
- 사용자에게 알린 상태: 대부분 1200×1200, 일부 1600~1900px 확보, 로딩 문제 수정, 최종 APK 준비 중.

## 핵심 파일

- `android-app/artwork-catalog.json`: **48개** 출처·앱 폴더명·이미지 URL·실측 width/height·로컬 preview 파일명. 다음 에이전트가 가장 먼저 읽을 파일.
- `work/artwork-candidates.json`: 검증 전 후보 목록.
- `work/artwork-images/`: 실제 다운로드한 표지 이미지. JSON의 preview 필드로 대응.
- `work/artwork-pages/`: 공식 페이지 HTML과 추출 `.html.json`. 파일명은 URL을 UTF-8 base64url 인코딩한 값.
- `work/artwork-youtube/`: YouTube 검색 결과 JSON. 파일명은 검색어의 base64url. 제작자, 설명, 영상 ID, 썸네일 포함.
- `work/artwork-itunes/`: Apple 공개 검색 API 응답. 파일명은 검색어 base64url.
- `work/artwork-unverified.json`: 마지막 실행에서는 빈 배열(48/48 이미지 검사 통과).

## 변경한 앱 코드

1. `android-app/app/src/main/assets/app.html`
   - 원래부터 이 파일에만 최신 Android UI/HQ 코드가 있었음. `work/index-ui-v24.js`는 더 오래된 버전임.
   - `// BEGIN VERIFIED ARTWORK CATALOG` ~ `// END VERIFIED ARTWORK CATALOG`: 48개 앨범 URL 매핑 삽입.
   - `uiVerifiedArtworkKey(track)`: `W.prototype.getTrackLocation(track)`의 **category///album** 폴더 키로 매핑. 아티스트 태그가 없어도 일치 가능.
   - `uiRequestHighResArtwork`, `uiResolvedArtworkUrl`: 검증된 매핑 우선 사용, 나머지는 기존 MusicBrainz native 검색.
   - native 검색 대기 시간과 실제 요청 시간을 분리. `__wavcloudArtworkStarted` 통지를 받은 후에 120초 타이머 시작. 이전에는 직렬 큐에서 기다리는 동안 20초 타임아웃되어 결과를 버렸음.
   - 이미지 교체 전에 실제 픽셀 크기 비교, 더 큰 기존 원본 유지.
   - 늦게 로드된 저해상도 원본 / 원본 요청 실패가 HQ 표지를 덮지 않도록 처리.
   - 플레이어 500ms 상태 갱신 때 같은 HQ 이미지를 계속 새로 프로브하지 않도록 중복 억제.
   - 원본 로딩 실패 시 `<img>`를 삭제하지 않아 후속 HQ 이미지로 복구 가능.
2. `android-app/app/src/main/java/org/duckdns/wavcloud/ArtworkResolverBridge.kt`
   - native 직렬 작업 시작 시 `__wavcloudArtworkStarted(requestId)` 통지.
   - 제목/아티스트 부분문자열 일치 대신 정규화 후 완전 일치 (엉뚱한 표지 방지).
   - preferences 캐시 이름 v1 → v2.
3. `android-app/app/build.gradle.kts`: versionCode 20, versionName **0.1.19**.
4. `android-app/tools/embed-artwork-catalog.mjs`: JSON → 위 app.html 매핑 갱신. 중복 키 / URL / 최소 크기 검사.
5. `android-app/tools/test-artwork-quality.cjs`: 큐 타임아웃, 동일 앨범 중복 요청, 원본/HQ 경쟁, 원본 오류, 큰 원본 유지 회귀검사.

**주의: `android-app/tools/sync-web.mjs`를 그대로 실행하면 최신 app.html 수정 및 기존 Android 전용 UI가 사라질 수 있음. 이 작업에서는 실행하지 않았음.**

## 검사 / 빌드 상태

마지막 아래 검사는 모두 PASS:

```powershell
node android-app/tools/test-artwork-quality.cjs
node android-app/tools/test-cloud-dark.cjs
node android-app/tools/check-bundle.mjs
node --check work/android-app-bundle-check.mjs
```

- 48개 매핑을 넣기 **전**, 로딩 버그/Kotlin 수정 상태에서 APK 빌드 성공한 적 있음.
- **48개 매핑을 넣은 최종 상태는 아직 APK 재빌드하지 않았음.** 기존 `app-debug.apk`를 최종본으로 전달하지 말 것.
- 최초 빌드는 `C:\.android` 오류로 실패. 아래처럼 환경변수 지정하면 성공함:

```powershell
$env:ANDROID_USER_HOME = Join-Path $PWD 'work/android-tools/android-user-home'
.\work\build.bat
```

- Kotlin daemon이 사용자 AppData에 쓰기 실패했지만 fallback compilation으로 `BUILD SUCCESSFUL` 확인함. 권한 문제가 재발하면 정상 escalation 사용.
- `work/build.bat`에 JDK/Android SDK/Gradle 경로가 이미 지정되어 있음.
- 최종 확인 후 `android-app/app/build/outputs/apk/debug/app-debug.apk`를 `outputs/WavCloud-Android-0.1.19-debug.apk`로 복사해서 전달하면 됨. 아직 복사하지 않았음.
- 실제 Android 기기 실행/설치/화면 테스트 미실시. 서버나 웹사이트 배포 미실시.

## 수집/갱신 도구

```powershell
# 공개 페이지 수집. HTML/메타데이터 저장. Bandcamp popupImage 원본 링크 우선 추출.
node work/artwork-sources.mjs URL1 URL2
# YouTube 공개 검색. 상위 3개 간략 출력, 전체 결과 JSON 저장.
node work/youtube-artwork-search.mjs '검색어1' '검색어2'
# Apple 공개 카탈로그 검색, country=jp. 결과가 엉뚱할 수 있으므로 반드시 수동 확인.
node work/itunes-artwork-search.mjs '검색어'
# 아래 파일의 명시적 페이지/Apple ID 매핑을 수정한 뒤 후보 생성
node work/prepare-artwork-catalog.mjs
# 4개씩 다운로드, JPEG/PNG 크기 및 거의 정사각형 검사, catalog JSON 생성
node work/verify-artwork-catalog.mjs
# 앱에 반영
node android-app/tools/embed-artwork-catalog.mjs
```

- `prepare-artwork-catalog.mjs`는 매번 후보 전체를 재생성함. JSON만 직접 수정하면 다음 실행에서 덮어쓰므로 해당 스크립트도 갱신할 것.
- `verify-artwork-catalog.mjs`는 최소 600px, 가로세로 비율 오차 10% 이하 검사. **그림의 동일성/판본 판단은 하지 않음.**
- 네트워크 shell 실행에 승인이 필요했으며 `node work/artwork-sources.mjs`, `node work/youtube-artwork-search.mjs`, `node work/itunes-artwork-search.mjs`, `node work/verify-artwork-catalog.mjs` 범위로 escalation 했음. 세션에 따라 다시 필요할 수 있음.
- API 토큰이나 비밀번호는 추출하지 않았음. 브라우저 로그인은 사용자가 직접 수행.
- 마지막 브라우저 호출에서 `Tab 1 is not part of browser session ...`가 나옴. 브라우저 세션을 다시 확인해야 할 수 있음.

## 남은 27개 앨범과 이미 찾은 단서

### 동인 음악 Album — 9개

1. **EmoCosine - DEBUT!** (13곡): 제작자 영상 https://www.youtube.com/watch?v=7nOhW4MKPzQ . 영상 설명에 외부 링크 없음. MusicBrainz CD/공식 구작 사이트 추가 조사. 기존 EmoCosine Bandcamp 목록에는 안 보였음.
2. **KALPA - Daybreak** (5곡): 공식 소개 https://www.youtube.com/watch?v=qgXFb9mLs10 . 게임팩과 음반/커스텀 모음 여부 확인 필요.
3. **Monstercat - JSB SoundTrack** (11곡): Just Shapes & Beats 곡 모음으로 보임. 제목만으로 개별 곡 재킷을 전체 앨범 표지로 바꾸지 말 것.
4. **Project Etheria - ~The First Page~** (13곡): 제작자 Team Resonance XFD https://www.youtube.com/watch?v=QH2SQW2BVI8 . 설명에 링크 없음. 관련 Fugu 영상 https://www.youtube.com/watch?v=W1fymuL8Fc0 .
5. **SANY-ON - DidItYesterday** (15곡): 제작자 XFD https://www.youtube.com/watch?v=0uqDICRrPs4 → 공식 https://madmindmachine.com/diy/ . 공식 페이지의 Bandcamp https://sany-on.bandcamp.com/album/didityesterday 는 404. og:image `https://65c5bce3dc2a095b4f87319c--gilded-wisp-373672.netlify.app/cover.png` 는 아직 다운로드/정사각형/시각 검증 전. HTML에 더 나은 이미지가 있을 수 있음.
6. **Tanchiky - CHICK TAC FACTORY** (13곡): 공식 https://ctf.tanchiky.com/ . og:image `card.png`는 홍보 배너일 가능성. 실제 표지 `<img src="/_ipx/f_webp/images/tncd0006_jacket_small.webp">` 및 확대 UI 있음. 원본 링크/이미지 검증 필요. 현재 검증 스크립트는 WebP 지원 안 함.
7. **TANOC - 20** (13곡): 방금 찾은 공식 영상 https://www.youtube.com/watch?v=AsBGoWaWG5s → **https://www.tano-c.net/release/tanocd-0029/** . 아직 공식 페이지 미수집.
8. **モリモリあつし - FIRST_ DREAMER** (15곡): Apple 검색 `Morimori Atsushi FIRST DREAMER`의 ID **6784135036**, 제목 `First: Dreamer`, 작가 モリモリあつし & uma, **12곡**. 판본/보너스곡 차이 확인 필요하여 아직 추가 안 함.
9. **モリモリあつし - Re-End of a Dream** (12곡): Apple에 동명 싱글/동방 에디션 여러 개. 함부로 선택하면 안 됨. `Re End of a Dream` JSON 참고. 앨범 버전 추가 조사 필요.

### Blue Archive Album — 14개

1. **밀레니엄 게임음악부! data** (6곡): ENnE 공식 full https://www.youtube.com/watch?v=U1eYotjnzE8 , XFD https://www.youtube.com/watch?v=_tkCwATJtUY . 후자는 720p 이상 후보. 영상 썸네일을 정사각 앨범 표지로 무작정 크롭하지 말 것.
2. **샬레 재즈 연구부** (9곡): Z:U 지우 full https://www.youtube.com/watch?v=-ZPHtBoS8RQ , XFD https://www.youtube.com/watch?v=ZZFT2lbiJDc . 원화 bolchan. Full 영상 썸네일 1920×1080은 확인, 정사각 표지 원본은 아직 못 찾음.
3. **지금부터 트리니티 교가 제창이 있겠습니다** (20곡): ENnE full https://www.youtube.com/watch?v=nosnZp5cA2g 후보. 아래 8곡 영상과 구분 필요.
4. **지금부터 트리니티 교가 제창이 있겠습니다 Part 2** (8곡): https://www.youtube.com/watch?v=pTBkb1jHUGo 는 설명에 8곡, XFD https://www.youtube.com/watch?v=HfvKJrxHAOA . 원화 モネ. 검색 제목에 Part 2가 없으므로 원래 표지와 비교 필요.
5. **키보토스의 밤** (6곡): ChestnutWhale 공식 XFD https://www.youtube.com/watch?v=-KBHex9uZEo . 설명상 6곡 일치. 원화 Nakun https://twitter.com/nakunedog . 영상 썸네일 1920×1080 확인, 정사각 원본 미확보.
6. **Blue Archive Symphony** (40곡): 상록수 공식 https://www.youtube.com/watch?v=dFcDgrYuA9A . 설명에 제작자 공개 Drive 링크 **https://drive.google.com/file/d/1fT22pH6UOYbNqr7RjWN5YQ6Sxj6kmGaq/view?usp=drive_link** . 링크 대상이 표지/음원/전체 패키지인지 아직 확인 안 함.
7. **Blue Archive Symphony - Encore** (20곡): https://www.youtube.com/watch?v=eJ29pmFsSwY . 제작자 공개 Drive **https://drive.google.com/file/d/1eW84-V0UQsKygjI1r0Z7HtYHWZnTeEI6/view?usp=sharing** . 미확인.
8. **Constant Moderato (ESPITZ Remix)** (1곡): 공식 demo https://www.youtube.com/watch?v=0pvp4II1CyA . 방금 발견, 설명/원본 미조사.
9. **Kivotos Jazz Cafe** (8곡, ZiU,Kaiun,Halang): 일반 검색/YouTube 영문 및 한글 검색이 관련 없는 재즈 영상으로 나옴. 정확한 제작자 채널/로컬 표지 확인 필요.
10. **Kivotos of Rock** (5곡): NezMayo 공식 full https://www.youtube.com/watch?v=o6L-tfSB1CA , XFD https://www.youtube.com/watch?v=16xj_Fs-xag . **BOOTH https://booth.pm/ja/items/5395877 은 9곡 일본판으로 표지가 다를 수 있어 사용 안 함.**
11. **Kivotos Of Rock ~ 少女夢想** (6곡): 공식 full https://www.youtube.com/watch?v=MmY3r35O7wc , XFD https://www.youtube.com/watch?v=wKSnPfs109c .
12. **Kivotos Of Rock ~ Per Ardua ad Astra** (12곡): LiBRA 공식 XFD https://www.youtube.com/watch?v=HFmZx5s7Vnw .
13. **Kivotos Of Rock ~ The False Sanctum ~** (5곡): 공식 full https://www.youtube.com/watch?v=Oz0RiY6MLTs , XFD https://www.youtube.com/watch?v=pyYkhbh3v_c .
14. **MIDNIGHT ARCHIVE** (6곡): Ing'gE 공식 https://www.youtube.com/watch?v=bgQhoqW24KI . 원화 rockda https://x.com/rocktide_ . 원본 추가 조사.

### DJMAX Album — 2개

1. **Drive** (12곡): 공식 전곡 영상 https://www.youtube.com/watch?v=7M3XIKRr-d4 . Apple 일본 검색은 엉뚱한 결과만 나옴. 국내 공식 음반 페이지/영상 설명 추가 조사.
2. **V LIBERTY** (27곡): 후속 2~5와 달리 Apple 일본 검색에서 첫 앨범을 못 찾음. Spotify/국내 카탈로그 확인 가능. 다른 V LIBERTY 판본 재킷을 가져오지 말 것.

### J-POP Album — 1개

- **우마무스메 2기 OST** (4곡, 아티스트 미상): 정확한 음반/곡 목록/현재 표지 확인 전에는 판본 확정 불가. 아직 별도 조사 안 함.

### ETC — 1개

- **DNF BGM** (6곡): 특정 정규 앨범보다 사용자 모음으로 보임. 기존 표지/원본 확인 필요. 다른 던파 OST 재킷으로 임의 대체하지 말 것.

## 다음 작업 우선순위

1. 미확인 공식 링크(특히 TANO*C 20, SANY-ON, 상록수 Drive 원본)를 조사하면 추가 확보 가능성이 높음.
2. 확보된 48개도 기존 표지와 판본/그림 대조. 일부 스트리밍판 곡 수가 사용자의 로컬판과 다르므로 같은 재킷인지 확인. 특히 ARForest Deluxe, PLATiNA, DJMAX 보너스곡 포함판.
3. 정사각 원본이 없는 YouTube 썸네일은 홍보 문구/레이아웃이 다른 경우 유지 처리. 무리한 크롭이나 AI 재창작은 아직 수행하지 않았고 사용자도 요청하지 않았음.
4. catalogue 키를 실제 파일 경로에 대조하는 통합 테스트 추가 권장. 현재 회귀검사는 verified path가 없는 기본 track 대상으로만 동작하므로 48개 폴더 매핑 경로 자체에 대한 추가 검사가 필요.
5. 기존 원본보다 작은 후보가 플레이어/알림 메타데이터에 반영되는 경우가 없는지 점검. 화면 프로브에는 크기 비교가 있으나 `uiResolvedArtworkUrl`은 curated URL을 바로 반환함.
6. Android 실기기 또는 UI 미리보기 확인 → 최종 APK 재빌드 → `outputs`에 복사 → 확보 수/미해결 앨범 수를 정확히 밝히고 전달.

## 출처 대표 예시

- https://arforest.bandcamp.com/album/the-umbra
- https://emocosine.bandcamp.com/album/lovely-lover
- https://copiest.bandcamp.com/album/memories-in-blue-vol-1-2
- https://pearlorigin.bandcamp.com/album/z-core-volution
- 개별 전체 출처는 `android-app/artwork-catalog.json`에 보존되어 있음.
