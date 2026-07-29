// 파라미터 패널 — 순수 DOM UI (무-프레임워크). 모든 튜닝 노브를 슬라이더로 노출 (CLAUDE.md 컨벤션).
// Phase 2: 검 전체(칼날·가드·손잡이·폼멜) 파라미터 + 부품 표시 토글.
// Phase 4: 전역 SurfaceState 슬라이더 + Operation 로그 패널 (06-phase4 §4.5).

import { createOperationLog } from "./oplog.js";

const BLADE_SLIDER_DEFS = [
  { key: "length", label: "길이 (m)", min: 0.3, max: 1.8, step: 0.01 },
  { key: "widthRoot", label: "뿌리 폭 (m)", min: 0.02, max: 0.14, step: 0.001 },
  { key: "widthMid", label: "중간 폭 (m)", min: 0.015, max: 0.13, step: 0.001 },
  { key: "widthTip", label: "끝 폭 (m)", min: 0.005, max: 0.1, step: 0.001 },
  { key: "thicknessRoot", label: "뿌리 두께 (m)", min: 0.003, max: 0.02, step: 0.0005 },
  { key: "thicknessTip", label: "끝 두께 (m)", min: 0.002, max: 0.015, step: 0.0005 },
  { key: "ridgeHeight", label: "능선 돌출", min: 0, max: 1.5, step: 0.05 },
  { key: "curve", label: "칼날 휨 (m)", min: -0.04, max: 0.04, step: 0.001 },
  { key: "tipStart", label: "tip 시작 t", min: 0.4, max: 0.95, step: 0.01 },
  { key: "tipEndScale", label: "tip 끝 배율", min: 0.01, max: 0.5, step: 0.01 },
  { key: "segLong", label: "길이 세그먼트", min: 8, max: 96, step: 1 },
  { key: "segCross", label: "단면 세그먼트", min: 8, max: 32, step: 4 },
];

const FULLER_DEFS = [
  { key: "fullerStart", label: "홈 시작 t", min: 0, max: 0.5, step: 0.01 },
  { key: "fullerEnd", label: "홈 끝 t", min: 0.2, max: 0.95, step: 0.01 },
  { key: "fullerWidth", label: "홈 폭 (m)", min: 0.005, max: 0.05, step: 0.001 },
  { key: "fullerDepth", label: "홈 깊이 (m)", min: 0.001, max: 0.008, step: 0.0005 },
];

const GUARD_DEFS = [
  { key: "guardWidth", label: "가드 폭 (m)", min: 0.08, max: 0.3, step: 0.005 },
  { key: "guardThickness", label: "가드 두께 (m)", min: 0.01, max: 0.06, step: 0.002 },
  { key: "guardDepth", label: "가드 깊이 (m)", min: 0.008, max: 0.05, step: 0.002 },
  { key: "guardBevel", label: "가드 베벨 (m)", min: 0, max: 0.008, step: 0.001 },
];

const GRIP_DEFS = [
  { key: "gripLength", label: "손잡이 길이 (m)", min: 0.08, max: 0.4, step: 0.005 },
  { key: "gripStartRadius", label: "위 반지름 (m)", min: 0.008, max: 0.03, step: 0.001 },
  { key: "gripEndRadius", label: "아래 반지름 (m)", min: 0.008, max: 0.03, step: 0.001 },
  { key: "gripTilt", label: "손잡이 기울임 (m)", min: -0.06, max: 0.06, step: 0.001 },
  { key: "gripFlatten", label: "납작 비율", min: 0.5, max: 1, step: 0.05 },
  { key: "gripWrapTurns", label: "감기 회전 수", min: 3, max: 20, step: 1 },
  { key: "gripWrapDepth", label: "감기 골 깊이 (m)", min: 0.0004, max: 0.003, step: 0.0002 },
];

const STATE_DEFS = [
  { key: "statePolish", label: "연마", min: 0, max: 1, step: 0.05 },
  { key: "stateOxidation", label: "산화", min: 0, max: 1, step: 0.05 },
  { key: "stateDirt", label: "오염", min: 0, max: 1, step: 0.05 },
  { key: "stateMoisture", label: "습기", min: 0, max: 1, step: 0.05 },
];

const POMMEL_DEFS = [
  { key: "pommelScale", label: "폼멜 크기", min: 0.6, max: 3, step: 0.1 },
];

export const DEFAULT_PARAMS = {
  // 칼날
  length: 0.95, widthRoot: 0.055, widthMid: 0.048, widthTip: 0.03,
  thicknessRoot: 0.006, thicknessTip: 0.004,
  crossSection: "diamond", ridgeHeight: 0.5, curve: 0,
  fullerEnabled: false, fullerStart: 0.05, fullerEnd: 0.6, fullerWidth: 0.02, fullerDepth: 0.003,
  tipType: "spear", tipStart: 0.8, tipEndScale: 0.05,
  segLong: 32, segCross: 16,
  // 가드
  guardShape: "bar", guardWidth: 0.18, guardThickness: 0.025, guardDepth: 0.02, guardBevel: 0.004,
  // 손잡이
  gripLength: 0.14, gripStartRadius: 0.014, gripEndRadius: 0.012, gripTilt: 0,
  gripCrossSection: "circle", gripFlatten: 0.85,
  gripWrapGeomEnabled: false, gripWrapTurns: 9, gripWrapDepth: 0.0012,
  // 폼멜
  pommelShape: "sphere", pommelScale: 1.5,
  // 머티리얼 (Phase 3)
  bladeMat: "carbon_steel", guardMat: "bronze", gripMat: "leather", pommelMat: "bronze",
  statePolish: 0.5, stateOxidation: 0.15, stateDirt: 0.15, stateMoisture: 0,
  seed: 12345,
};

/** 평탄 params → makeSwordDesign 입력 (부품별 중첩 구조). */
export function paramsToSwordInput(p) {
  return {
    blade: {
      length: p.length, widthRoot: p.widthRoot, widthMid: p.widthMid, widthTip: p.widthTip,
      thicknessRoot: p.thicknessRoot, thicknessTip: p.thicknessTip,
      crossSection: p.crossSection, ridgeHeight: p.ridgeHeight, curve: p.curve ?? 0,
      fuller: p.fullerEnabled
        ? { enabled: true, start: p.fullerStart, end: p.fullerEnd, width: p.fullerWidth, depth: p.fullerDepth }
        : null,
      tipType: p.tipType, tipStart: p.tipStart, tipEndScale: p.tipEndScale,
      segLong: p.segLong, segCross: p.segCross,
    },
    guard: {
      shape: p.guardShape, width: p.guardWidth, thickness: p.guardThickness,
      depth: p.guardDepth, bevel: p.guardBevel,
    },
    grip: {
      length: p.gripLength, startRadius: p.gripStartRadius, endRadius: p.gripEndRadius,
      tilt: p.gripTilt ?? 0,
      crossSection: p.gripCrossSection, flatten: p.gripFlatten,
      wrapGeometry: { enabled: p.gripWrapGeomEnabled, turns: p.gripWrapTurns, depth: p.gripWrapDepth },
    },
    pommel: { shape: p.pommelShape, scale: p.pommelScale },
  };
}

/** 평탄 params → MaterialGraph 입력 (Phase 3). */
export function paramsToMaterialInput(p) {
  return {
    blade: p.bladeMat, guard: p.guardMat, grip: p.gripMat, pommel: p.pommelMat,
    state: {
      polish: p.statePolish, oxidation: p.stateOxidation,
      dirt: p.stateDirt, moisture: p.stateMoisture,
      scratchAmount: 0, impactAmount: 0,
    },
  };
}

/** 중첩 프리셋(blade/guard/grip/pommel) → 평탄 params. */
export function swordInputToParams(input) {
  const b = input.blade;
  const flat = {
    ...b,
    curve: b.curve ?? 0,
    fullerEnabled: !!b.fuller,
    guardShape: input.guard.shape, guardWidth: input.guard.width,
    guardThickness: input.guard.thickness, guardDepth: input.guard.depth,
    guardBevel: input.guard.bevel ?? 0,
    gripLength: input.grip.length, gripStartRadius: input.grip.startRadius,
    gripEndRadius: input.grip.endRadius, gripTilt: input.grip.tilt ?? 0,
    gripCrossSection: input.grip.crossSection ?? "circle",
    gripFlatten: input.grip.flatten ?? 0.85,
    gripWrapGeomEnabled: input.grip.wrapGeometry?.enabled ?? false,
    gripWrapTurns: input.grip.wrapGeometry?.turns ?? 9,
    gripWrapDepth: input.grip.wrapGeometry?.depth ?? 0.0012,
    pommelShape: input.pommel.shape, pommelScale: input.pommel.scale ?? 1,
  };
  if (b.fuller) {
    flat.fullerStart = b.fuller.start;
    flat.fullerEnd = b.fuller.end;
    flat.fullerWidth = b.fuller.width;
    flat.fullerDepth = b.fuller.depth;
  }
  delete flat.fuller;
  return flat;
}

export function createPanel(container, {
  swordPresets, bladePresets, onChange, onExportGLB, onDownloadDesign, onViewerOption, onBake,
  onDownloadTextures, onDownloadOperations, onOperationsChange,
}) {
  const params = { ...DEFAULT_PARAMS };
  const valueLabels = {};
  const controls = {};

  const emit = (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChange({ ...params }), 50); // 디바운스 50ms
    };
  })();

  const h3 = (text) => {
    const el = document.createElement("h3");
    el.textContent = text;
    container.appendChild(el);
  };

  const addRow = (label, control, valueKey) => {
    const row = document.createElement("div");
    row.className = "row";
    const lab = document.createElement("label");
    lab.textContent = label;
    row.appendChild(lab);
    row.appendChild(control);
    if (valueKey) {
      const val = document.createElement("span");
      val.className = "val";
      row.appendChild(val);
      valueLabels[valueKey] = val;
    }
    container.appendChild(row);
  };

  const addSlider = (def) => {
    const input = document.createElement("input");
    input.type = "range";
    input.min = def.min; input.max = def.max; input.step = def.step;
    input.value = params[def.key];
    input.addEventListener("input", () => {
      params[def.key] = Number(input.value);
      valueLabels[def.key].textContent = String(params[def.key]);
      emit();
    });
    addRow(def.label, input, def.key);
    valueLabels[def.key].textContent = String(params[def.key]);
    controls[def.key] = input;
  };

  const addSelect = (label, key, values) => {
    const select = document.createElement("select");
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      select.appendChild(opt);
    }
    select.value = params[key];
    select.addEventListener("change", () => { params[key] = select.value; emit(); });
    addRow(label, select);
    controls[key] = select;
  };

  const addCheckbox = (label, key) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = params[key];
    input.addEventListener("change", () => { params[key] = input.checked; emit(); });
    addRow(label, input);
    controls[key] = input;
  };

  // ── 프리셋 ──
  h3("프리셋");
  {
    const swordSelect = document.createElement("select");
    const none = document.createElement("option");
    none.value = ""; none.textContent = "— 검 프리셋 —";
    swordSelect.appendChild(none);
    for (const p of swordPresets) {
      const opt = document.createElement("option");
      opt.value = p.name; opt.textContent = p.name;
      swordSelect.appendChild(opt);
    }
    swordSelect.addEventListener("change", () => {
      const preset = swordPresets.find((p) => p.name === swordSelect.value);
      if (!preset) return;
      Object.assign(params, swordInputToParams(preset.params));
      syncControls();
      emit();
    });
    addRow("검 전체", swordSelect);

    const bladeSelect = document.createElement("select");
    const bnone = document.createElement("option");
    bnone.value = ""; bnone.textContent = "— 칼날 프리셋 —";
    bladeSelect.appendChild(bnone);
    for (const p of bladePresets) {
      const opt = document.createElement("option");
      opt.value = p.name; opt.textContent = p.name;
      bladeSelect.appendChild(opt);
    }
    bladeSelect.addEventListener("change", () => {
      const preset = bladePresets.find((p) => p.name === bladeSelect.value);
      if (!preset) return;
      const p = { ...preset.params };
      if (p.fuller) {
        p.fullerEnabled = true;
        p.fullerStart = p.fuller.start; p.fullerEnd = p.fuller.end;
        p.fullerWidth = p.fuller.width; p.fullerDepth = p.fuller.depth;
      } else {
        p.fullerEnabled = false;
      }
      delete p.fuller;
      Object.assign(params, p);
      syncControls();
      emit();
    });
    addRow("칼날만", bladeSelect);
  }

  h3("칼날");
  addSelect("단면", "crossSection", ["diamond", "lenticular", "hexagonal", "flat"]);
  for (const def of BLADE_SLIDER_DEFS) addSlider(def);
  addSelect("tip 유형", "tipType", ["needle", "spear", "rounded"]);

  h3("홈 (fuller)");
  addCheckbox("홈 사용", "fullerEnabled");
  for (const def of FULLER_DEFS) addSlider(def);

  h3("가드");
  addSelect("윤곽", "guardShape", ["bar", "tapered", "oval", "diamond"]);
  for (const def of GUARD_DEFS) addSlider(def);

  h3("손잡이");
  addSelect("단면", "gripCrossSection", ["circle", "ellipse", "octagon"]);
  addCheckbox("감기 기하", "gripWrapGeomEnabled");
  for (const def of GRIP_DEFS) addSlider(def);

  h3("폼멜");
  addSelect("프로파일", "pommelShape", ["sphere", "disc", "teardrop", "scent-stopper"]);
  for (const def of POMMEL_DEFS) addSlider(def);

  h3("머티리얼");
  const PRIMS = ["carbon_steel", "bronze", "leather"];
  addSelect("칼날 물질", "bladeMat", PRIMS);
  addSelect("가드 물질", "guardMat", PRIMS);
  addSelect("손잡이 물질", "gripMat", PRIMS);
  addSelect("폼멜 물질", "pommelMat", PRIMS);
  for (const def of STATE_DEFS) addSlider(def);
  {
    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.value = params.seed;
    seedInput.addEventListener("change", () => { params.seed = Number(seedInput.value) >>> 0; });
    addRow("seed", seedInput);
    controls.seed = seedInput;
  }
  h3("표면 상태 Operation");
  const opLog = createOperationLog(container, (ops) => onOperationsChange?.(ops));

  const btnBake = document.createElement("button");
  btnBake.textContent = "베이크 (1024²)";
  btnBake.addEventListener("click", () => onBake({ ...params }));
  container.appendChild(btnBake);

  h3("표시");
  for (const [label, opt] of [
    ["와이어프레임", "wireframe"], ["노멀 표시", "normals"], ["소켓 표시", "sockets"],
    ["BaseColor 단독", "flatColor"],
  ]) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => onViewerOption(opt, input.checked));
    addRow(label, input);
  }
  for (const [label, opt] of [
    ["칼날", "showBlade"], ["가드", "showGuard"], ["손잡이", "showGrip"], ["폼멜", "showPommel"],
  ]) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.addEventListener("change", () => onViewerOption(opt, input.checked));
    addRow(label, input);
  }

  h3("UV (Atlas)");
  const uvCanvas = document.createElement("canvas");
  uvCanvas.id = "uv-preview";
  uvCanvas.width = 292; uvCanvas.height = 292;
  container.appendChild(uvCanvas);

  h3("출력");
  const btnGLB = document.createElement("button");
  btnGLB.textContent = "GLB 다운로드";
  btnGLB.addEventListener("click", onExportGLB);
  const btnDesign = document.createElement("button");
  btnDesign.textContent = "design.json";
  btnDesign.addEventListener("click", onDownloadDesign);
  const btnTex = document.createElement("button");
  btnTex.textContent = "텍스처 PNG";
  btnTex.addEventListener("click", () => onDownloadTextures?.());
  const btnOps = document.createElement("button");
  btnOps.textContent = "operations.json";
  btnOps.addEventListener("click", () => onDownloadOperations?.(opLog.toJSON()));
  container.appendChild(btnGLB);
  container.appendChild(btnDesign);
  container.appendChild(btnTex);
  container.appendChild(btnOps);

  const stats = document.createElement("div");
  stats.id = "stats";
  container.appendChild(stats);

  const ALL_DEFS = [
    ...BLADE_SLIDER_DEFS, ...FULLER_DEFS, ...GUARD_DEFS, ...GRIP_DEFS, ...POMMEL_DEFS, ...STATE_DEFS,
  ];
  function syncControls() {
    for (const def of ALL_DEFS) {
      controls[def.key].value = params[def.key];
      valueLabels[def.key].textContent = String(params[def.key]);
    }
    for (const key of ["crossSection", "tipType", "guardShape", "pommelShape",
      "gripCrossSection", "bladeMat", "guardMat", "gripMat", "pommelMat"]) {
      controls[key].value = params[key];
    }
    controls.fullerEnabled.checked = params.fullerEnabled;
    controls.gripWrapGeomEnabled.checked = params.gripWrapGeomEnabled;
  }

  // 아일랜드 구분색 (partId 기준)
  const PART_COLORS = ["rgba(120,200,255,0.4)", "rgba(255,180,90,0.45)", "rgba(150,255,150,0.45)", "rgba(255,130,200,0.45)"];

  return {
    params,
    opLog,
    /** 외부(참조 맞춤 결과 등)에서 파라미터 일괄 반영 — 슬라이더 동기화 + 재빌드 */
    applyParams(partial) {
      Object.assign(params, partial);
      syncControls();
      emit();
    },
    /** UV 프리뷰(표시 전용 — Canvas 2D 허용). merged 메시(부품 병합)를 그린다. */
    drawUV(merged) {
      const ctx = uvCanvas.getContext("2d");
      const s = uvCanvas.width;
      ctx.fillStyle = "#17181c";
      ctx.fillRect(0, 0, s, s);
      const { partId } = merged.attributes;
      for (let color = 0; color < 4; color++) {
        ctx.strokeStyle = PART_COLORS[color];
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let t = 0; t < merged.indices.length; t += 3) {
          const [a, b, c] = [merged.indices[t], merged.indices[t + 1], merged.indices[t + 2]];
          if (partId[a] !== color) continue;
          ctx.moveTo(merged.uvAtlas[a * 2] * s, (1 - merged.uvAtlas[a * 2 + 1]) * s);
          ctx.lineTo(merged.uvAtlas[b * 2] * s, (1 - merged.uvAtlas[b * 2 + 1]) * s);
          ctx.lineTo(merged.uvAtlas[c * 2] * s, (1 - merged.uvAtlas[c * 2 + 1]) * s);
          ctx.closePath();
        }
        ctx.stroke();
      }
    },
    setStats(text) {
      stats.textContent = text;
    },
  };
}

export function downloadBlob(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
