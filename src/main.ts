// ── BimOn Forma Extension — 메인 루프 ────────────────────────────────────
//   로컬 브리지(BimOnMcpBridge.exe --target forma)의 WebSocket 서버에 접속하여
//   Claude의 MCP tools/call을 Forma SDK 호출로 중계한다.
//   전송: ws://127.0.0.1:PORT (loopback; https→ws mixed-content 예외 허용).

import { handlers } from "./dispatch";

const BASE_PORT = 51737;
const PORT_RANGE = 10;

const dot = document.getElementById("dot")!;
const statusText = document.getElementById("statusText")!;
const logEl = document.getElementById("log")!;

function log(msg: string) {
  const t = new Date().toLocaleTimeString();
  logEl.textContent += `[${t}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(on: boolean, text: string) {
  dot.className = "dot " + (on ? "on" : "off");
  statusText.textContent = text;
}

let ws: WebSocket | null = null;

/** 포트 범위를 순차 스캔하며 hello/ack로 올바른 브리지를 찾아 접속 */
function connect() {
  let port = BASE_PORT;

  const tryPort = () => {
    if (port >= BASE_PORT + PORT_RANGE) {
      setStatus(false, "Bridge not found — is Claude (BimOn-Forma) running?");
      setTimeout(() => { port = BASE_PORT; tryPort(); }, 3000); // 재시도
      return;
    }
    const url = `ws://127.0.0.1:${port}/`;
    const sock = new WebSocket(url);
    let acked = false;

    const failNext = () => { try { sock.close(); } catch {} port++; tryPort(); };
    const timer = setTimeout(() => { if (!acked) failNext(); }, 700);

    sock.onopen = () => sock.send(JSON.stringify({ type: "bimon-hello" }));

    sock.onmessage = (ev) => {
      let m: any;
      try { m = JSON.parse(ev.data as string); } catch { return; }

      // 핸드셰이크 확인
      if (m.type === "bimon-ack") {
        acked = true; clearTimeout(timer); ws = sock;
        setStatus(true, `Connected — ws://127.0.0.1:${port}`);
        log(`connected to bridge on port ${port}`);
        return;
      }
      // 도구 호출 디스패치
      handleCall(sock, m);
    };

    sock.onclose = () => {
      if (!acked) { clearTimeout(timer); failNext(); return; }
      ws = null; setStatus(false, "Disconnected — retrying…");
      log("disconnected; retrying");
      setTimeout(connect, 1500);
    };
    sock.onerror = () => { /* onclose가 후처리 */ };
  };

  tryPort();
}

async function handleCall(sock: WebSocket, m: { id: number; name: string; arguments?: any }) {
  const { id, name } = m;
  const args = m.arguments ?? {};
  const fn = handlers[name];
  if (!fn) {
    sock.send(JSON.stringify({ id, error: `unknown tool: ${name}` }));
    return;
  }
  log(`→ ${name}`);
  try {
    const out = await fn(args);
    const result = typeof out === "string" ? out : JSON.stringify(out);
    sock.send(JSON.stringify({ id, result }));
    log(`← ${name} ok`);
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    sock.send(JSON.stringify({ id, error: msg }));
    log(`✕ ${name}: ${msg}`);
  }
}

setStatus(false, "Connecting…");
connect();
