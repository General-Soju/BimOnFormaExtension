# BimOn Forma — Bridge ↔ Extension 계약 (단일 출처)

이 문서와 [`tools.schema.json`](tools.schema.json)은 **브리지(C#)와 확장(JS) 사이의 단일 출처(single source of truth)** 입니다.
두 코드베이스가 서로 다른 레포에 있으므로, **도구를 추가/변경하면 반드시 양쪽을 이 계약에 맞춰 동기화**합니다.

- 브리지 측: `BimOnMcpSuite` 레포 `BimOnMcpBridge/Program.cs`의 `ToolDefinitions.Forma()` (도구 **선언**)
- 확장 측: 이 레포 `src/dispatch.ts` (+ `standalone.html`) 의 `handlers` 맵 (도구 **구현**)

---

## 1. 전송 (Transport)

- 주소: **`ws://127.0.0.1:PORT`** (기본 51737, 충돌 시 51737–51746 범위 폴백)
- 역할: **브리지 = WebSocket 서버**, **확장 = 클라이언트**
- https인 Forma에서 `ws://127.0.0.1`(loopback)은 mixed-content 예외로 허용됨

## 2. 핸드셰이크

확장 접속 직후:
```json
→ { "type": "bimon-hello" }
← { "type": "bimon-ack", "target": "forma" }
```
확장은 ack를 받은 포트를 "올바른 브리지"로 확정한다.

## 3. 도구 호출 (Request / Response)

```json
요청(브리지→확장)  { "id": <int>, "name": "<tool>", "arguments": { ... } }
응답(확장→브리지)  { "id": <int>, "result": "<string>" }
오류(확장→브리지)  { "id": <int>, "error":  "<string>" }
```
- `id`는 상관(correlation)용. 브리지는 동일 `id`의 응답을 매칭한다.
- `result`는 **문자열**: 텍스트이거나 `JSON.stringify(obj)`.
- 복합 인자(행렬/배열/객체)는 **JSON 문자열**로 전달한다 (예: `transformJson`, `meshJson`, `pathsJson`).

## 4. 파일 사이드채널 (대용량 메시, Claude 컨텍스트 우회)

두 측이 같은 PC라는 점을 이용:
- `add_element_from_file`: 브리지가 `arguments.filePath`를 읽어 `arguments._dataBase64`(base64)로 주입 후 전달.
- `export_scene_mesh` + `arguments.toFile`: 확장이 반환한 결과를 브리지가 그 경로에 쓰고, Claude에는 **경로만** 반환.

## 5. 쓰기(WRITE) 게이트

`add_element*`, `replace_element`, `remove_element`, `edit_element_properties` 등 WRITE 도구는
`Forma.getCanEdit() === true`(편집 권한)일 때만 동작한다. 확장 핸들러가 선검사한다.

## 6. 버전/동기화 규칙

- 도구 추가·변경 시: ① [`tools.schema.json`](tools.schema.json) 갱신(출처) → ② 브리지 `Forma()` 선언 → ③ 확장 `dispatch.ts`/`standalone.html` 핸들러. 셋이 항상 일치해야 한다.
- 향후 권장: hello에 `protocolVersion` 추가하여 skew 감지. 브리지가 `tools.schema.json`을 런타임 로드하도록 리팩터링하면 ①→② 동기화를 제거할 수 있다.

## 7. 현재 도구 수

**31종** — 읽기8 · 제어7 · 분석4 · 오버레이4 · 편집4 · 입력1 · 상호운용3. 상세는 `tools.schema.json`.
