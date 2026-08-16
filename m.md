# 📄 잉크(Ink) 전용 마인크래프트 커스텀 런처 — 기획 및 사양

## 1. 프로젝트 개요

- **프로젝트명:** Ink Launcher (잉크 코블몬 전용 런처)
- **제작 목적:**
  - 마인크래프트 모드 설치(Fabric, `.jar` 파일 이동 등)에 어려움을 겪는 부원들의 진입 장벽 완벽 해소.
  - 모드 및 리소스팩(CCC 등) 업데이트 시 발생하는 재배포의 번거로움 해결 및 버전 파편화 방지.
  - '원클릭 접속'을 통한 동아리 서버 활성화 및 소속감 고취.
- **타겟 사용자:** 잉크(Ink) 동아리 부원 전체 (컴퓨터 비숙련자 포함)

---

## 2. 개발 스택 및 기술 환경

최신 프론트엔드 트렌드와 데스크톱 앱 개발의 표준을 따라, 익숙한 웹 생태계 기술을 그대로 활용합니다.

- **프레임워크:** Electron (데스크톱 앱 패키징), React (UI 렌더링)
- **런타임:** Node.js 20+ (내장 `fetch` 사용, 별도 HTTP 라이브러리 불필요)
- **핵심 라이브러리:**
  - `minecraft-launcher-core` — 마인크래프트 코어 다운로드 및 실행 엔진 (Java 21 JRE 자동 다운로드 포함)
  - `msmc` — 마이크로소프트(Xbox) 정품 계정 로그인 OAuth 처리
- **빌드 도구:** `electron-builder` (Windows `.exe` 인스톨러 제작)
- **Java 관리 방침:** 마인크래프트 1.21.1은 **Java 21 필수**. `minecraft-launcher-core`의 JRE 자동 다운로드 기능을 사용해 사용자 PC에 Java가 없어도 자동 설치됨. 런처는 별도로 Java를 번들링하지 않음.

---

## 3. 핵심 기능 정의 (Core Features)

- **F1. 간편한 로그인** — 런처 실행 시 마이크로소프트 로그인 창을 띄워 정품 인증 및 세션 유지.
- **F2. 모드팩 자동 동기화 (Modrinth 기반)** — 자세한 아키텍처는 §6 참조.
  - 원격 `manifest.json`에 나열된 모드/리소스팩을 **Modrinth CDN에서 개별 다운로드**.
  - 로컬 캐시된 파일의 해시가 매니페스트와 일치하면 재다운로드하지 않음(델타 동기화).
  - 매니페스트에서 항목이 빠지면 로컬에서도 자동 삭제 → 관리자가 뺀 모드는 부원 PC에서도 자동으로 제거.
- **F3. 리소스팩 자동 활성화** — Modrinth에서 받은 리소스팩을 `%APPDATA%\.ink_cobblemon\resourcepacks\`에 배치하고, `options.txt`의 `resourcePacks` 항목에 자동 주입해 기본 활성화.
- **F4. 원클릭 게임 런칭** — 복잡한 RAM 할당(**권장 8GB, 최소 6GB**)과 Fabric 실행 인자를 런처가 백그라운드에서 자동 구성하여 게임 실행.
  - Cobblemon + Simple Voice Chat + Xaero 지도 + 다수의 컨텐츠/편의 모드가 포함되므로 4GB로는 부족.

---

## 4. UI/UX 디자인 계획

디지털 미디어 감각을 살려, 직관적이고 세련된 단일 페이지 앱(SPA) 형태로 구성합니다.

- **배경:** 코블몬 서버에서 찍은 동아리 단체 샷·풍경 스크린샷 슬라이드쇼.
- **메인 컴포넌트:**
  - **중앙 하단:** 거대한 **[게임 시작]** 버튼 (동아리 로고 형태의 애니메이션 버튼).
  - **우측 상단:** 로그인된 플레이어의 스킨 헤드(아바타) 아이콘 및 닉네임 표시.
  - **하단 바:** 다운로드 진행률 프로그레스 바 + 현재 상태 텍스트("Cobblemon.jar 다운로드 중… 3/24").

---

## 5. 프로젝트 폴더 구조 (계획)

```
INK_Mine_Launcher/
├─ src/
│  ├─ main/           # Electron 메인 프로세스 (게임 런칭·파일 IO·msmc)
│  ├─ renderer/       # React UI (SPA)
│  └─ shared/         # 매니페스트 타입, 상수 등
├─ manifest/
│  └─ manifest.json   # 배포용 매니페스트 원본 (편집 후 호스팅 위치에 업로드)
├─ build/             # electron-builder 산출물
├─ package.json
└─ m.md               # 본 기획서
```

- **모드/리소스팩 파일은 저장소에 포함하지 않음.** 모든 자산은 Modrinth CDN에서 실시간 다운로드되며, `manifest.json`만이 진실의 원천(Source of Truth)이다.
- 관리자는 매니페스트만 편집하면 되고, 부원의 런처는 다음 실행 시 자동으로 반영한다.

---

## 6. 자동 동기화 아키텍처 (Modrinth 기반) ⭐

### 6.1 왜 Modrinth인가
- Modrinth는 오픈 소스 모드 저장소이며 **CDN 다운로드가 무료 · 무제한**.
- 자체 파일 서버(오라클 클라우드 등)에 수십 개 `.jar`을 올리지 않아도 되어 **트래픽·용량 부담 제로**.
- 각 파일에 SHA-1/SHA-512 해시가 제공되어 무결성 검증이 쉬움.
- Modrinth에 없는 커스텀 모드는 `direct` 소스로 별도 URL 지정 가능(하이브리드).

### 6.2 매니페스트(`manifest.json`) 스키마

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-17T00:00:00Z",
  "minecraft": {
    "version": "1.21.1",
    "loader": "fabric",
    "loaderVersion": "0.16.14",
    "java": "21"
  },
  "assets": [
    {
      "type": "mod",
      "name": "Cobblemon",
      "source": "modrinth",
      "url": "https://cdn.modrinth.com/data/MdwFAVRL/versions/<versionId>/Cobblemon-fabric-1.6.1+1.21.1.jar",
      "sha1": "…",
      "size": 12345678,
      "required": true
    },
    {
      "type": "resource",
      "name": "CCC",
      "source": "modrinth",
      "url": "https://cdn.modrinth.com/data/<projectId>/versions/<versionId>/CCC_2.1.zip",
      "sha1": "…",
      "size": 3456789,
      "autoEnable": true
    },
    {
      "type": "mod",
      "name": "InkCustomAddon",
      "source": "direct",
      "url": "https://our-server.example.com/mods/InkCustomAddon.jar",
      "sha1": "…",
      "size": 234567
    }
  ]
}
```

- `type`이 로컬 저장 위치를 결정한다:
  - `mod` → `%APPDATA%\.ink_cobblemon\mods\`
  - `resource` → `%APPDATA%\.ink_cobblemon\resourcepacks\`
- `autoEnable: true`인 리소스팩은 런처가 `options.txt`의 `resourcePacks` 라인에 자동 주입.
- `source: modrinth`는 관례상 표기(다운로드 로직에는 영향 없음, URL만 사용).
- Modrinth에 없는 자체 제작/사설 모드가 있다면 `source: direct`로 우리 웹서버에서 호스팅.

### 6.3 관리자 워크플로우 (모드 추가/변경 시)

1. Modrinth에서 원하는 모드/버전 페이지 접속 → **Download** 링크의 URL과 SHA-1 복사.
2. `manifest/manifest.json`의 `assets` 배열에 항목 추가/수정.
3. 매니페스트만 배포 위치(§8)에 업로드.
4. 부원 런처는 다음 실행 시 자동으로 diff 감지 → 필요한 파일만 다운로드.

> **원칙:** 저장소의 `mods/`, `resources/` 폴더가 있더라도 배포에는 사용되지 않는다. 매니페스트가 유일한 진실의 원천이다.

### 6.4 클라이언트 동기화 로직

1. 원격 `manifest.json` fetch.
2. 로컬 캐시 상태(`%APPDATA%\.ink_cobblemon\cache\state.json`) 로드.
3. 각 `asset`에 대해:
   - 로컬에 파일이 없거나 SHA-1이 다르면 → 다운로드.
   - 로컬에는 있는데 매니페스트에 없으면 → 삭제.
   - 해시가 일치하면 → 건너뜀.
4. 진행률을 UI 프로그레스 바에 실시간 반영.
5. 모든 자산 검증 완료 후 `state.json` 갱신.

### 6.5 특이사항 — Simple Voice Chat
- 서버 측 UDP 포트 개방이 필요한 모드. 런처(클라이언트)에는 `.jar` 배치만 담당하고, 서버 운영자가 별도로 방화벽/포트포워딩 설정.

---

## 7. 단계별 개발 마일스톤 (Milestones)

- **Phase 1: 기반 세팅 및 UI 퍼블리싱 (1주 차)**
  - Electron + React 보일러플레이트 구축.
  - 런처 메인 화면 UI 컴포넌트 디자인 및 개발.
- **Phase 2: 인증 및 게임 코어 연동 (2주 차)**
  - `msmc`를 활용한 마이크로소프트 로그인 로직 구현.
  - `minecraft-launcher-core`로 순정 바닐라 1.21.1 실행 1차 테스트.
- **Phase 3: 매니페스트 동기화 및 커스텀 실행 (3주 차)**
  - `manifest.json` 스키마 확정 후 초기본 작성 (Cobblemon + 필수 모드).
  - Modrinth CDN에서 파일 다운로드 · SHA-1 검증 · 캐시/삭제 로직 구현.
  - Fabric 로더로 마인크래프트가 켜지도록 실행 인자 튜닝.
- **Phase 4: 패키징 및 사내 베타 테스트 (4주 차)**
  - `electron-builder`로 설치형 `.exe` 파일 패키징.
  - 임원진 대상 로그인·다운로드·서버 접속 테스트 후 정식 배포.

---

## 8. 배포 및 파일 호스팅 계획

- **매니페스트 호스팅:** `manifest.json` 하나만 우리가 호스팅한다. 후보:
  - **GitHub raw** (권장): `https://raw.githubusercontent.com/<org>/<repo>/main/manifest/manifest.json` — 무료·빠름·이력 추적.
  - **오라클 웹서버 특정 경로** — 이미 운영 중이라면 재사용.
  - **GitHub Releases** — 태그로 롤백/버전 관리하고 싶을 때.
- **모드/리소스 파일 호스팅:** Modrinth CDN이 대신 처리. 우리 측 트래픽 부담 없음.
- **커스텀 모드/사설 리소스 호스팅:** Modrinth에 없는 자산만 위 웹서버에 소량 배치하고 매니페스트에서 `source: direct`로 참조.
- **런처 자체 업데이트:** `electron-builder`의 auto-updater(GitHub Releases 연동) 활용 검토(Phase 4 이후).

---

## 9. 개발 스크립트 초안 (`package.json`)

```jsonc
{
  "scripts": {
    "dev": "electron-vite dev",          // 개발 서버 + 핫리로드
    "build": "electron-vite build",       // 프로덕션 번들
    "package": "electron-builder --win",  // .exe 패키징
    "validate-manifest": "node scripts/validate-manifest.mjs"  // 매니페스트 스키마 검증
  }
}
```

- `validate-manifest`는 배포 전 CI 또는 로컬에서 매니페스트의 URL 유효성·해시 형식·필수 필드를 검증.

---

## 10. 로그·에러 처리 방침

- **로그 위치:** `%APPDATA%\.ink_cobblemon\logs\launcher-YYYYMMDD.log` (일자별 롤링).
- **표시 정책:** 정상 다운로드 로그는 UI에 상태 텍스트만 표시, 상세는 파일에 기록.
- **에러 시나리오:**
  - 네트워크 실패 → 3회 재시도 후 사용자에게 "인터넷 연결을 확인해 주세요" 모달.
  - Modrinth 파일 SHA-1 불일치 → 재다운로드 1회 후 실패 시 사용자에게 관리자 문의 안내.
  - 마이크로소프트 세션 만료 → 자동 재로그인 유도.
  - 게임 크래시 로그는 `.ink_cobblemon\crash-reports\`에 마인크래프트가 자동 저장.

---

## 11. OS 지원 범위

- **1차 대상:** Windows 10/11 (부원 대다수).
- **macOS/Linux:** 초기 릴리스에는 미지원. Electron·`minecraft-launcher-core`가 크로스 플랫폼이므로 향후 확장은 어렵지 않으나, 별도 로그인 창·경로 규칙(`~/Library/Application Support/…`, `~/.ink_cobblemon`) 대응 필요.
