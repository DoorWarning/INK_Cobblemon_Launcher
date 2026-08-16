# Ink Launcher

잉크 동아리 코블몬 서버 전용 마인크래프트 커스텀 런처. 상세 사양은 [`m.md`](./m.md) 참고.

## 요구 사항
- Node.js 20+ (권장 22 LTS)
- Windows 10/11 (1차 지원 OS)

## 개발
```bash
npm install
npm run dev          # electron-vite 개발 서버 + HMR
```

## 매니페스트 재생성
`mods/` 또는 `resources/` 폴더에 파일을 추가/삭제한 뒤:
```bash
npm run gen-manifest
```
Modrinth `/v2/version_files` API로 각 SHA-1을 조회해 `manifest/manifest.json`을 다시 만듭니다. Modrinth에 없는 파일은 `source: "direct"` + `url: "TODO"`로 표시되므로, 자체 웹서버 URL로 채우면 됩니다.

## 배포용 매니페스트 호스팅
`src/main/sync.ts`의 `REMOTE_MANIFEST_URL` 상수에 실제 URL을 넣거나, 런타임에 `INK_MANIFEST_URL` 환경 변수로 지정합니다. 설정 안 하면 앱에 번들된 매니페스트로 폴백합니다.

## 빌드 / 패키징
```bash
npm run build        # electron-vite 프로덕션 번들
npm run package      # electron-builder로 Windows .exe 인스톨러 생성
```
산출물: `dist/Ink Launcher-Setup-<version>.exe`

## 데이터 경로
```
%APPDATA%\.ink_cobblemon\
├─ mods\               # 동기화된 모드
├─ resourcepacks\      # 동기화된 리소스팩 (auto-enable)
├─ versions\           # Fabric/바닐라 프로필 (minecraft-launcher-core 관리)
├─ cache\state.json    # 로컬 설치 상태 (SHA-1)
├─ logs\               # 런처 일자별 로그
└─ options.txt         # 리소스팩 자동 주입 대상
```
