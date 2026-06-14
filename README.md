# BimOn AI for Forma — Extension

Claude의 MCP 도구를 **Autodesk Forma (Site Design)** SDK 호출로 중계하는 임베디드 확장.
로컬 브리지(`BimOnMcpBridge.exe --target forma`, **BimOnMcpSuite** 레포)와 `ws://127.0.0.1:51737` WebSocket으로 통신한다.

> **별도 레포로 분리 권장.** 데스크톱 Suite는 .NET(설치형)이고 이 확장은 웹(TS/Vite/CDN, 호스팅형)이라
> 툴체인·배포주기·호스팅이 다르다. 브리지/설정은 Suite에 남고, 이 확장만 분리한다.
> 브리지↔확장 **계약은 [`CONTRACT.md`](CONTRACT.md) + [`tools.schema.json`](tools.schema.json)** 가 단일 출처.

```
Claude ──stdio──► BimOnMcpBridge.exe --target forma ──ws://127.0.0.1:51737──► (이 확장, Forma iframe)
                                                                                   └─ forma-embedded-view-sdk@0.93
```

## 두 가지 진입점

| | 빌드 | 용도 |
|---|---|---|
| `standalone.html` | **불필요** (SDK를 esm.sh CDN로 로드) | 빠른 테스트·소규모 배포. 검증에 사용됨 |
| `src/` (Vite 앱) | 필요 (`npm run build` → `dist/`) | 정식 빌드·번들. `forma-embedded-view-sdk` npm 의존 |

## 빌드 / 개발

```bash
npm install
npm run build          # → dist/  (정적 파일)
npm run dev            # http://localhost:5173 (개발 서버)
```
> Node 18+ 권장.

## 호스팅 (GitHub Pages 권장)

이 레포를 GitHub에 올리고 **Settings → Pages → Source: GitHub Actions** 활성화하면
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)가 자동 배포:
- `https://<user>.github.io/<repo>/` ← 빌드된 Vite 앱
- `https://<user>.github.io/<repo>/standalone.html` ← 빌드불필요 단일 HTML

이 **고정 HTTPS URL**을 Forma에 1회 등록하면 로컬 서버가 필요 없다. (로컬 옵션: `python -m http.server 5173 --bind 127.0.0.1`)

## Forma에 등록 + 사용

상세 절차: **[FORMA_SETUP.md](FORMA_SETUP.md)** (확장 생성 → Owner를 APS 앱으로 → URL+placement → 프로젝트 허용 → Add → 패널 열기).
패널에 🟢 **Connected** + **SDK loaded ✓** 가 뜨면 Claude에서 `BimOn-Forma` 도구가 동작.

- `BimOn-Forma` MCP는 Suite 설치 시 Claude에 자동 등록됨(브리지 실행).
- 이 패널이 **열려 있어야** 도구가 동작(headless 불가). WRITE 도구는 Forma 편집 권한 필요.
- 브리지는 소켓 1개(last-wins) → 패널은 **한 곳만** 열기.

## 구조

```
├── standalone.html        # 빌드불필요 단일 HTML (esm.sh CDN, 31핸들러 인라인)
├── src/
│   ├── main.ts            # WS 포트스캔 + hello 핸드셰이크 + 디스패치 + 재연결 + 상태 UI
│   ├── dispatch.ts        # name → Forma SDK 호출 (31 도구)
│   └── interop.ts         # 메시/변환행렬/base64 헬퍼 (Revit↔Forma)
├── tools.schema.json      # ★ 도구 계약 단일 출처 (31종)
├── CONTRACT.md            # ★ WS 프로토콜 + 동기화 규칙
├── FORMA_SETUP.md         # 사용자용 1회 등록 가이드
└── .github/workflows/deploy-pages.yml   # GitHub Pages 자동 배포
```

## 알려진 미확정 (`// VERIFY`)

라이브 SDK(v0.93)로 요청 형태 확정이 필요한 지점 — `dispatch.ts`의 `// VERIFY`:
`analysis.triggerSun/triggerNoise`, `camera.move`(CameraState). 나머지(sun/visibility/areaMetrics/
capture/integrate/proposal/elements/geometry)는 타입 정의로 확정됨.
