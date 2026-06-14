# BimOn AI for Autodesk Forma — Site Design : 1회 등록 가이드

여기서 Forma는 **Autodesk Forma — Site Design**(개념설계/대지계획)을 의미합니다(다른 Autodesk 제품 아님). 데스크톱 앱이 아니라 **브라우저 확장**으로 연동됩니다. 그래서 인스톨러가 자동으로 못 하고,
**당신의 Forma 계정에서 한 번만 등록**하면 됩니다. (이후엔 패널만 열면 작동)

> 전제: ① BimOn MCP Suite 설치 완료(`BimOn-Forma`가 Claude에 등록됨) · ② Forma에 **APS 애플리케이션 1개** 보유
> ([aps.autodesk.com](https://aps.autodesk.com) → Create App, 없으면 먼저 생성)

---

## A. 확장 URL 준비 (둘 중 하나)

- **권장 — 브리지가 직접 서빙**: 설치 시 `standalone.html`이 `%AppData%\BimOnAI\FormaExtension\`에 배포되고,
  `BimOnMcpBridge.exe --target forma`(Claude가 자동 실행)가 이를 **`http://localhost:51737/standalone.html`** 로 제공합니다.
  → **이 URL을 그대로 사용** (별도 서버·공개 호스팅 불필요).
- **대안 — 로컬 서버**(개발 시): `python -m http.server 5173 --bind 127.0.0.1` → `http://localhost:5173/standalone.html`

> ⚠️ URL은 반드시 **`http://localhost`** — Forma는 임베디드 뷰 URL로 **https 또는 http://localhost만 허용**합니다(`http://127.0.0.1`·공개 https는 거부/차단). 브리지가 `http://localhost`로 서빙하고, 내부 ws 연결은 `ws://127.0.0.1:51737`을 씁니다.

## B. Forma에 확장 등록 (1회)

1. Forma에서 사이트(프로젝트) 열기 → 좌측 **확장 기능(Extensions)** 아이콘 → **+ 확장 기능 추가**
2. App Store 우상단 **⚙(톱니) → 확장 기능 생성(Create Extension)**
3. 이름 입력(예: `BimOn AI`) → Publisher Agreement 동의 체크 → **Create** (확장 ID 발급)
4. **★ Owner를 "Myself only" → 본인 APS 애플리케이션으로 변경** (이래야 URL 칸이 열림 / **비가역**)
5. **Integration → Embedded views**:
   - placement = `RIGHT_MENU_ANALYSIS_PANEL`
   - URL = **`http://localhost:51737/standalone.html`** (브리지 제공 — A 참고)
6. **Who are allowed to use → Only specific projects** → 사용할 **프로젝트 ID** 추가 → **Save**
   - 프로젝트 ID는 Forma 디자인 화면 URL의 `pro_xxxxx` 부분

## C. 설치 + 열기

7. 프로젝트의 App Store에서 **BimOn AI** 검색 → **Add** → 설치 약관 **Agree**
8. 우측 **분석 패널의 확장 런처(큐브 아이콘)** → **BimOn AI** 클릭
9. 패널에 **🟢 Connected — ws://127.0.0.1:51737** + **SDK loaded ✓** 가 뜨면 성공

---

## 사용 중 유지 조건

- 이 **패널이 열려 있어야** Claude가 Forma를 제어합니다.
- `BimOn-Forma` 브리지가 실행 중이어야 합니다(Claude가 자동 실행).
- 브리지 URL(`http://localhost:51737`)을 쓰면 별도 서버가 필요 없습니다. (대안인 로컬 서버 URL을 쓸 때만 그 서버를 켜둬야 함)

## 문제 해결

| 증상 | 원인 / 조치 |
|---|---|
| 패널이 비어 있음 / `Missing query parameter: origin` | 페이지를 직접 연 것. **Forma 확장으로 등록**해서 Forma가 iframe을 `?origin=`으로 로드해야 함 |
| `Forma is not connected` (Claude 측) | 패널 미연결. 패널을 열고 🟢 Connected 확인 |
| URL 입력란이 안 보임 | Owner가 "Myself only". **APS 앱으로** 변경 필요(4단계) |
| 두 군데서 열어 도구가 엉킴 | 브리지는 소켓 1개(last-wins). **패널은 한 곳만** 열기 |
| WRITE 도구 실패 | Forma 편집 권한 필요(`check_can_edit`로 확인) |

> 참고: Forma는 APS앱 소유 확장의 **등록 자체를 지우는 UI를 제공하지 않습니다**(프로젝트 제거/허용 제거까지만 가능).
