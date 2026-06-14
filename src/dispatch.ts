// ── name → handler 디스패치 (브리지가 보낸 MCP tools/call을 Forma SDK 호출로 변환) ──
//   브리지 프로토콜: 수신 { id, name, arguments } → 응답 { id, result } | { id, error }
//   복합 인자는 JSON 문자열로 전달됨(브리지 도구 정의와 일치).
//   ⚠ // VERIFY 표시는 라이브 SDK(v0.93)로 요청 형태 확정이 필요한 지점.

import { Forma } from "forma-embedded-view-sdk/auto";
import { base64ToArrayBuffer, parseTransform, meshToInlineGeometry } from "./interop";

type Args = Record<string, any>;
type Handler = (a: Args) => Promise<unknown>;

// 오버레이 id → 종류(remove 라우팅용)
const overlays = new Map<string, "mesh" | "glb" | "geojson">();

async function requireEdit(): Promise<void> {
  // @ts-ignore — getCanEdit는 EmbeddedViewSdk 루트 메서드
  const can = await Forma.getCanEdit();
  if (!can) throw new Error("no edit access (Forma.getCanEdit() == false)");
}

export const handlers: Record<string, Handler> = {
  // ── A. 읽기/조회 ──
  get_project_info: async () => ({
    project: await Forma.project.get(),
    geoLocation: await Forma.project.getGeoLocation(),
    timezone: await Forma.project.getTimezone(),
    countryCode: await Forma.project.getCountryCode(),
  }),
  get_proposal_tree: async () => ({
    rootUrn: await Forma.proposal.getRootUrn(),
    elements: await Forma.proposal.getAll(),
  }),
  get_element: async (a) => {
    if (a.urn) return await Forma.elements.get({ urn: a.urn, recursive: a.recursive === "true" });
    if (a.path) return await Forma.elements.getByPath({ path: a.path, recursive: a.recursive === "true" });
    throw new Error("get_element requires urn or path");
  },
  get_element_transform: async (a) => await Forma.elements.getWorldTransform({ path: a.path }),
  get_geometry: async (a) => {
    switch (a.kind) {
      case "triangles": return Array.from(await Forma.geometry.getTriangles(a.path ? { path: a.path } : undefined));
      case "footprint": return await Forma.geometry.getFootprint({ path: a.path });
      case "category": return await Forma.geometry.getPathsByCategory({ category: a.category });
      default: throw new Error("kind must be triangles|footprint|category");
    }
  },
  get_building_functions: async () => await Forma.settings.get(),
  get_selection: async () => await Forma.selection.getSelection(),
  // @ts-ignore
  check_can_edit: async () => ({ canEdit: await Forma.getCanEdit() }),

  // ── B. 화면 제어 ──
  get_sun: async () => ({ date: (await Forma.sun.getDate()).toISOString() }),
  set_sun: async (a) => { await Forma.sun.setDate({ date: new Date(a.date) }); return "ok"; },
  get_camera: async () => await Forma.camera.getCurrent(),
  move_camera: async (a) => { await Forma.camera.move(JSON.parse(a.cameraStateJson)); return "ok"; },
  switch_perspective: async () => { await Forma.camera.switchPerspective(); return "ok"; },
  capture_view: async (a) => {
    // camera.capture({width,height}) → HTMLCanvasElement → PNG dataURL(base64)
    const width = a.width ? Number(a.width) : 1200;
    const height = a.height ? Number(a.height) : 800;
    const canvas = await Forma.camera.capture({ width, height });
    return { pngDataUrl: canvas.toDataURL("image/png"), width, height };
  },
  set_visibility: async (a) => {
    if (a.all === "true") { await Forma.render.unhideAllElements(); return "ok"; }
    const pathList: string[] = JSON.parse(a.pathsJson);
    const visible = a.visible === "true";
    await Forma.render.setElementsVisibility({ paths: pathList.map((path) => ({ path, visible })) });
    return "ok";
  },

  // ── C. 분석 ──
  list_analyses: async () => await Forma.analysis.list({}),
  run_sun_analysis: async (a) => {
    const params = a.parametersJson ? JSON.parse(a.parametersJson) : undefined;
    const triggered: any = await Forma.analysis.triggerSun(params as any); // VERIFY req
    return await Forma.analysis.getSunAnalysis(triggered as any);
  },
  run_noise_analysis: async (a) => {
    const params = a.parametersJson ? JSON.parse(a.parametersJson) : undefined;
    const triggered: any = await Forma.analysis.triggerNoise(params as any); // VERIFY req
    return await Forma.analysis.getNoiseAnalysis(triggered as any);
  },
  get_area_metrics: async (a) => {
    const req = a.pathsJson ? { paths: JSON.parse(a.pathsJson) } : {};
    return await Forma.areaMetrics.calculate(req);
  },

  // ── D. 오버레이 ──
  add_overlay_geojson: async (a) => {
    const transform = parseTransform(a.transformJson);
    const { id } = await Forma.render.geojson.add({ geojson: JSON.parse(a.geojson), transform } as any);
    overlays.set(id, "geojson");
    return { id };
  },
  add_overlay_glb: async (a) => {
    const transform = parseTransform(a.transformJson);
    const glb = base64ToArrayBuffer(a.glbBase64);
    const { id } = await Forma.render.glb.add({ glb, transform } as any);
    overlays.set(id, "glb");
    return { id };
  },
  remove_overlay: async (a) => {
    const kind = overlays.get(a.id);
    if (kind === "glb") await Forma.render.glb.remove({ id: a.id });
    else await Forma.render.remove({ id: a.id });
    overlays.delete(a.id);
    return "ok";
  },
  clear_overlays: async () => {
    await Forma.render.cleanup();
    try { await Forma.render.glb.cleanup(); } catch {}
    overlays.clear();
    return "ok";
  },

  // ── E. 씬 편집 (WRITE) ──
  add_element: async (a) => {
    await requireEdit();
    return await Forma.proposal.addElement({
      urn: a.urn,
      parentPath: a.parentPath || "root",
      name: a.name,
      transform: parseTransform(a.transformJson),
    } as any);
  },
  replace_element: async (a) => { await requireEdit(); await Forma.proposal.replaceElement({ path: a.path, urn: a.urn }); return "ok"; },
  remove_element: async (a) => { await requireEdit(); await Forma.proposal.removeElement({ path: a.path }); return "ok"; },
  edit_element_properties: async (a) => {
    await requireEdit();
    return await Forma.elements.editProperties({ urn: a.urn, propertiesJsonMergePatch: JSON.parse(a.propertiesJson) });
  },

  // ── F. 사용자 입력 수집 ──
  get_drawn_input: async (a) => {
    switch (a.kind) {
      case "point": return await Forma.designTool.getPoint();
      case "polygon": return await Forma.designTool.getPolygon();
      case "extrudedPolygon": return await Forma.designTool.getExtrudedPolygon();
      case "line": return await Forma.designTool.getLine();
      default: throw new Error("kind must be point|polygon|extrudedPolygon|line");
    }
  },

  // ── 상호운용 (Revit ↔ Forma) ──
  add_element_mesh: async (a) => {
    await requireEdit();
    const geometry = meshToInlineGeometry(a.meshJson);
    const { urn } = await Forma.integrateElements.createElementHierarchy({
      data: {
        rootElement: "root",
        elements: { root: { id: "root", properties: { name: a.name || "From Revit", geometry } as any } },
      },
    });
    return await Forma.proposal.addElement({ urn, transform: parseTransform(a.transformJson) } as any);
  },
  add_element_from_file: async (a) => {
    await requireEdit();
    if (a.format === "mesh") {
      // 브리지가 _dataBase64로 파일 내용을 주입 → mesh JSON 텍스트
      const text = new TextDecoder().decode(base64ToArrayBuffer(a._dataBase64));
      return await handlers.add_element_mesh({ meshJson: text, transformJson: a.transformJson, name: a.name });
    }
    // GLB 경로: uploadFile → createElementV2 → addElement
    const glb = base64ToArrayBuffer(a._dataBase64);
    const { blobId } = await Forma.integrateElements.uploadFile({ data: glb });
    const { urn } = await Forma.integrateElements.createElementV2({
      properties: { name: a.name || "From Revit" } as any,
      representations: { volumeMesh: { blobId } } as any,
    });
    return await Forma.proposal.addElement({ urn, transform: parseTransform(a.transformJson) } as any);
  },
  export_scene_mesh: async (a) => {
    const req: any = {};
    if (a.path) req.path = a.path;
    if (a.excludedPathsJson) req.excludedPaths = JSON.parse(a.excludedPathsJson);
    const tris = await Forma.geometry.getTriangles(Object.keys(req).length ? req : undefined);
    // flat triangle soup(meter, Z-up): verts = 좌표열, faces = 순차 인덱스
    const verts = Array.from(tris);
    const faces = Array.from({ length: verts.length / 3 }, (_, i) => i);
    return { verts, faces, unit: "meter", upAxis: "Z" };
  },
};
