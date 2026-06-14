// ── 상호운용 헬퍼 (Revit ↔ Forma 형상 교환) ──────────────────────────────
// 좌표 규약: Forma 씬/inline Mesh = Z-up, XY 수평, meter (검증됨).
// Revit 내부 = Z-up, feet. inline Mesh 경로는 축 스왑 불필요(R=I).

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** JSON 문자열 → 4x4 column-major 변환행렬(16수) | undefined */
export function parseTransform(json?: string): number[] | undefined {
  if (!json) return undefined;
  const t = JSON.parse(json);
  if (!Array.isArray(t) || t.length !== 16) throw new Error("transform must be 16 numbers (column-major 4x4)");
  return t.map(Number);
}

/** {verts:[...],faces:[...]} (meter) → Forma inline Mesh geometry */
export function meshToInlineGeometry(meshJson: string) {
  const m = JSON.parse(meshJson);
  if (!Array.isArray(m.verts) || !Array.isArray(m.faces))
    throw new Error("meshJson must be { verts:number[], faces:number[] } in meters");
  return { type: "Inline", format: "Mesh", verts: m.verts, faces: m.faces };
}
