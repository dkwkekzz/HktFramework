// 파라미터 패널 — 순수 DOM UI (무-프레임워크). 모든 튜닝 노브를 슬라이더로 노출 (CLAUDE.md 컨벤션).

const SLIDER_DEFS = [
  { key: "length", label: "길이 (m)", min: 0.4, max: 1.8, step: 0.01 },
  { key: "widthRoot", label: "뿌리 폭 (m)", min: 0.02, max: 0.14, step: 0.001 },
  { key: "widthMid", label: "중간 폭 (m)", min: 0.015, max: 0.13, step: 0.001 },
  { key: "widthTip", label: "끝 폭 (m)", min: 0.005, max: 0.1, step: 0.001 },
  { key: "thicknessRoot", label: "뿌리 두께 (m)", min: 0.003, max: 0.02, step: 0.0005 },
  { key: "thicknessTip", label: "끝 두께 (m)", min: 0.002, max: 0.015, step: 0.0005 },
  { key: "ridgeHeight", label: "능선 돌출", min: 0, max: 1.5, step: 0.05 },
  { key: "tipStart", label: "tip 시작 t", min: 0.5, max: 0.95, step: 0.01 },
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

export const DEFAULT_PARAMS = {
  length: 1.0, widthRoot: 0.06, widthMid: 0.05, widthTip: 0.03,
  thicknessRoot: 0.008, thicknessTip: 0.005,
  crossSection: "diamond", ridgeHeight: 0.4,
  fullerEnabled: false, fullerStart: 0.05, fullerEnd: 0.6, fullerWidth: 0.02, fullerDepth: 0.003,
  tipType: "spear", tipStart: 0.8, tipEndScale: 0.05,
  segLong: 32, segCross: 16,
};

/** params → makeStraightBladeDesign 입력 형태 */
export function paramsToDesignInput(p) {
  return {
    ...p,
    fuller: p.fullerEnabled
      ? { enabled: true, start: p.fullerStart, end: p.fullerEnd, width: p.fullerWidth, depth: p.fullerDepth }
      : null,
  };
}

export function createPanel(container, { presets, onChange, onExportGLB, onDownloadDesign, onViewerOption }) {
  const params = { ...DEFAULT_PARAMS };
  const valueLabels = {};

  const emit = (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChange({ ...params }), 50); // 디바운스 50ms (03-phase1 §1.7)
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
    return input;
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
    return select;
  };

  const addCheckbox = (label, key) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = params[key];
    input.addEventListener("change", () => { params[key] = input.checked; emit(); });
    addRow(label, input);
    return input;
  };

  const controls = {};

  h3("프리셋");
  const presetSelect = document.createElement("select");
  {
    const none = document.createElement("option");
    none.value = ""; none.textContent = "— 직접 설정 —";
    presetSelect.appendChild(none);
    for (const p of presets) {
      const opt = document.createElement("option");
      opt.value = p.name; opt.textContent = p.name;
      presetSelect.appendChild(opt);
    }
    presetSelect.addEventListener("change", () => {
      const preset = presets.find((p) => p.name === presetSelect.value);
      if (!preset) return;
      // 프리셋의 fuller 객체 → 패널 플래그 필드로 변환
      const p = { ...preset.params };
      if (p.fuller) {
        p.fullerEnabled = true;
        p.fullerStart = p.fuller.start;
        p.fullerEnd = p.fuller.end;
        p.fullerWidth = p.fuller.width;
        p.fullerDepth = p.fuller.depth;
      } else {
        p.fullerEnabled = false;
      }
      delete p.fuller;
      Object.assign(params, p);
      syncControls();
      emit();
    });
    addRow("프리셋", presetSelect);
  }

  h3("칼날 형상");
  controls.crossSection = addSelect("단면", "crossSection", ["diamond", "lenticular", "hexagonal", "flat"]);
  for (const def of SLIDER_DEFS) controls[def.key] = addSlider(def);
  controls.tipType = addSelect("tip 유형", "tipType", ["needle", "spear", "rounded"]);

  h3("홈 (fuller)");
  controls.fullerEnabled = addCheckbox("홈 사용", "fullerEnabled");
  for (const def of FULLER_DEFS) controls[def.key] = addSlider(def);

  h3("표시");
  {
    const wire = document.createElement("input");
    wire.type = "checkbox";
    wire.addEventListener("change", () => onViewerOption("wireframe", wire.checked));
    addRow("와이어프레임", wire);
    const normals = document.createElement("input");
    normals.type = "checkbox";
    normals.addEventListener("change", () => onViewerOption("normals", normals.checked));
    addRow("노멀 표시", normals);
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
  container.appendChild(btnGLB);
  container.appendChild(btnDesign);

  const stats = document.createElement("div");
  stats.id = "stats";
  container.appendChild(stats);

  function syncControls() {
    for (const def of [...SLIDER_DEFS, ...FULLER_DEFS]) {
      if (controls[def.key]) {
        controls[def.key].value = params[def.key];
        valueLabels[def.key].textContent = String(params[def.key]);
      }
    }
    controls.crossSection.value = params.crossSection;
    controls.tipType.value = params.tipType;
    controls.fullerEnabled.checked = params.fullerEnabled;
  }

  return {
    params,
    /** UV 프리뷰(표시 전용 — Canvas 2D 허용, 03-phase1 §1.7) */
    drawUV(mesh) {
      const ctx = uvCanvas.getContext("2d");
      const s = uvCanvas.width;
      ctx.fillStyle = "#17181c";
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(120,200,255,0.35)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
        ctx.moveTo(mesh.uvAtlas[a * 2] * s, (1 - mesh.uvAtlas[a * 2 + 1]) * s);
        ctx.lineTo(mesh.uvAtlas[b * 2] * s, (1 - mesh.uvAtlas[b * 2 + 1]) * s);
        ctx.lineTo(mesh.uvAtlas[c * 2] * s, (1 - mesh.uvAtlas[c * 2 + 1]) * s);
        ctx.closePath();
      }
      ctx.stroke();
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
