// 참조 이미지 형상 맞춤 UI — Phase 5 (07-phase5 §5.1 어노테이션 + §5.4 진행 UI).
// 어노테이션·프리뷰는 표시 전용이라 Canvas 2D 허용 (결정 경로 아님 — 02-architecture §5).
// 결정 계산(마스크 래스터·TargetSpec·최적화)은 전부 src/eval 모듈을 호출한다.

import { buildReferenceSpec, decodeReferenceMask } from "../eval/refmask.js";
import { buildTargetSpec, createInitialSwordDesign, LANDMARK_NAMES } from "../eval/targetspec.js";
import { projectSwordMask, getMaskBit } from "../eval/silhouette.js";
import { vectorToInput } from "../eval/paramspace.js";
import {
  optimizeContinuousSteps, optimizeExhaustiveSteps, applyDiscreteCombo, OPTIMIZE_DEFAULTS,
} from "../eval/optimize.js";
import { makeSwordDesign } from "../mesh/sword.js";
import { downloadBlob } from "./panels.js";

const LANDMARK_LABELS = {
  tip: "칼끝 (tip)", root: "칼날 뿌리 (root)", guardTop: "가드 상단",
  guardBottom: "가드 하단", gripBottom: "손잡이 하단",
};

/**
 * @param panel    패널 컨테이너 (섹션을 이어 붙임)
 * @param viewport 뷰포트 요소 (어노테이터 오버레이 부착)
 * @param onApplyInput (SwordInput) => void — 결과를 슬라이더·재빌드에 반영
 * @param getSeed  () => number — 메인 패널의 seed (결정성 스트림 공유)
 */
export function createReferenceTool({ panel, viewport, onApplyInput, getSeed }) {
  // ── 어노테이션 상태 ──
  const anno = {
    image: null, // HTMLImageElement | null (spec 로드만 했으면 null)
    maskBackdrop: null, // spec 로드 시 마스크 백드롭 캔버스
    name: "", width: 0, height: 0, view: "side",
    polygon: [], polygonClosed: false,
    landmarks: {}, // name → {x,y} (이미지 px)
    loadedSpec: null, // referenceSpec 을 직접 불러온 경우 (폴리곤 대신 RLE 마스크 사용)
  };
  let targetSpec = null;
  let initial = null; // { input, design }
  let baseInput = null; // 최적화 출발 입력
  let running = false;
  let result = null; // 최적화 최종/중단 결과 { input, iou, ... }
  let iouHistory = [];
  let lastOverlayDraw = 0;

  // ── 패널 섹션 ──
  const h3 = document.createElement("h3");
  h3.textContent = "참조 맞춤 (Phase 5)";
  panel.appendChild(h3);
  const section = document.createElement("div");
  panel.appendChild(section);

  const row = (parent = section) => {
    const el = document.createElement("div");
    el.className = "row";
    parent.appendChild(el);
    return el;
  };
  const button = (label, onClick, parent = section) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", onClick);
    parent.appendChild(b);
    return b;
  };

  // 이미지 열기 + 뷰 선택
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  section.appendChild(fileInput);
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      Object.assign(anno, {
        image: img, maskBackdrop: null, name: file.name, width: img.naturalWidth,
        height: img.naturalHeight, polygon: [], polygonClosed: false, landmarks: {}, loadedSpec: null,
      });
      openAnnotator();
      updateStatus();
    };
    img.src = URL.createObjectURL(file);
    fileInput.value = "";
  });

  const btnOpenImage = button("참조 이미지 열기", () => fileInput.click());

  {
    const r = row();
    const lab = document.createElement("label");
    lab.textContent = "뷰";
    r.appendChild(lab);
    const viewSelect = document.createElement("select");
    for (const v of ["side", "three_quarter", "unknown"]) {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      viewSelect.appendChild(opt);
    }
    viewSelect.addEventListener("change", () => {
      anno.view = viewSelect.value;
      updateStatus();
    });
    r.appendChild(viewSelect);
  }

  // 물리 칼날 길이 앵커 — 이미지에서 절대 스케일은 관측 불가 (targetspec.js)
  const anchorInput = document.createElement("input");
  {
    const r = row();
    const lab = document.createElement("label");
    lab.textContent = "칼날 길이 (m)";
    r.appendChild(lab);
    anchorInput.type = "number";
    anchorInput.step = "0.05";
    anchorInput.value = "0.9";
    r.appendChild(anchorInput);
  }

  const btnAnnotate = button("어노테이터", () => openAnnotator());
  button("spec 저장", () => saveSpec());
  const specInput = document.createElement("input");
  specInput.type = "file";
  specInput.accept = "application/json";
  specInput.style.display = "none";
  section.appendChild(specInput);
  specInput.addEventListener("change", async () => {
    const file = specInput.files?.[0];
    if (!file) return;
    try {
      loadSpec(JSON.parse(await file.text()));
    } catch (err) {
      setStatus(`spec 로드 오류: ${err.message}`);
    }
    specInput.value = "";
  });
  button("spec 열기", () => specInput.click());

  const btnTarget = button("TargetSpec 생성", () => makeTarget());
  const btnFit = button("빠른 맞춤", () => startRun(false));
  const btnFull = button("전수 탐색 (48)", () => startRun(true));
  const btnStop = button("중단", () => { running = false; });
  const btnApply = button("결과 적용", () => {
    if (result) onApplyInput(result.input);
  });

  // IoU 그래프 + 실루엣 오버레이
  const graphCanvas = document.createElement("canvas");
  graphCanvas.width = 292; graphCanvas.height = 60;
  graphCanvas.className = "ref-canvas";
  section.appendChild(graphCanvas);
  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = 292; overlayCanvas.height = 292;
  overlayCanvas.className = "ref-canvas";
  section.appendChild(overlayCanvas);

  // 체크리스트(어노테이션 진행)와 메시지(작업 결과)를 분리 — 서로 덮어쓰지 않는다
  const stateDiv = document.createElement("div");
  stateDiv.className = "ref-status";
  section.appendChild(stateDiv);
  const statusDiv = document.createElement("div");
  statusDiv.className = "ref-status";
  section.appendChild(statusDiv);
  const setStatus = (text) => { statusDiv.textContent = text; };

  const annotationComplete = () =>
    (anno.polygonClosed || anno.loadedSpec) && LANDMARK_NAMES.every((n) => anno.landmarks[n]);

  function updateStatus() {
    const maskOk = anno.polygonClosed || !!anno.loadedSpec;
    const lmCount = LANDMARK_NAMES.filter((n) => anno.landmarks[n]).length;
    const warn = anno.view !== "side" ? "\n⚠ side 외 뷰는 스코프 밖 — 결과 보증 없음 (07-phase5 §5.1)" : "";
    stateDiv.textContent =
      `마스크: ${maskOk ? "✓" : "—"}  랜드마크: ${lmCount}/${LANDMARK_NAMES.length}` +
      `${targetSpec ? "  TargetSpec: ✓" : ""}${warn}`;
    btnTarget.disabled = !annotationComplete();
    const ready = !!targetSpec && !running;
    btnFit.disabled = !ready;
    btnFull.disabled = !ready;
    btnStop.disabled = !running;
    btnApply.disabled = !result;
  }

  // ── referenceSpec 입출력 (07-phase5 §5.1 — 마스크는 RLE) ──
  function currentReferenceSpec() {
    if (anno.loadedSpec && !anno.polygonClosed) return anno.loadedSpec;
    return buildReferenceSpec({
      image: { width: anno.width, height: anno.height, name: anno.name, view: anno.view },
      maskPolygon: anno.polygonClosed ? anno.polygon : [],
      landmarks: LANDMARK_NAMES.filter((n) => anno.landmarks[n])
        .map((n) => ({ name: n, ...anno.landmarks[n] })),
    });
  }

  function saveSpec() {
    if (!anno.width) { setStatus("저장할 어노테이션이 없다 — 이미지를 먼저 연다"); return; }
    downloadBlob(JSON.stringify(currentReferenceSpec()), "referenceSpec.json", "application/json");
  }

  function loadSpec(spec) {
    Object.assign(anno, {
      image: null, maskBackdrop: null, name: spec.image.name ?? "", width: spec.image.width,
      height: spec.image.height, view: spec.image.view,
      polygon: spec.maskPolygon ?? [], polygonClosed: (spec.maskPolygon?.length ?? 0) >= 3,
      landmarks: {}, loadedSpec: spec,
    });
    for (const lm of spec.landmarks ?? []) anno.landmarks[lm.name] = { x: lm.x, y: lm.y };
    // 이미지 없이도 어노테이터에서 확인할 수 있게 마스크 백드롭 생성 (표시 전용)
    const mask = decodeReferenceMask(spec);
    const canvas = document.createElement("canvas");
    canvas.width = anno.width; canvas.height = anno.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(anno.width, anno.height);
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i] ? 150 : 30;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    anno.maskBackdrop = canvas;
    targetSpec = null; result = null;
    setStatus("referenceSpec 로드 완료");
    updateStatus();
  }

  // ── TargetSpec + 초기 설계 (07-phase5 §5.2) ──
  function makeTarget() {
    try {
      targetSpec = buildTargetSpec(currentReferenceSpec());
      initial = createInitialSwordDesign(targetSpec, { bladeLength: Number(anchorInput.value) || 0.9 });
      baseInput = initial.input;
      result = { input: initial.input }; // 초기 설계도 즉시 적용 가능
      iouHistory = [];
      drawOverlay(projectSwordMask(initial.design, targetSpec.size));
      setStatus("TargetSpec 생성 완료 — 초기 설계 준비됨");
      updateStatus();
    } catch (err) {
      setStatus(`TargetSpec 오류: ${err.message}`);
    }
  }

  // ── 최적화 실행 (07-phase5 §5.4 — 제너레이터를 프레임 단위로 소비, 언제든 중단) ──
  function startRun(exhaustive) {
    if (!targetSpec || running) return;
    const opts = { ...OPTIMIZE_DEFAULTS, seed: getSeed() };
    const gen = exhaustive
      ? optimizeExhaustiveSteps(targetSpec, baseInput, opts)
      : optimizeContinuousSteps(targetSpec, baseInput, opts);
    running = true;
    result = null;
    iouHistory = [];
    updateStatus();
    pump(gen);
  }

  function pump(gen) {
    const t0 = performance.now();
    let r = null;
    let last = null;
    while (performance.now() - t0 < 30) {
      r = gen.next();
      if (r.done) break;
      last = r.value;
      iouHistory.push(last.best?.iou ?? 0);
    }
    if (last) {
      drawGraph();
      const comboText = last.phase === "combo"
        ? `조합 ${last.comboIndex}/${last.comboTotal} (${last.combo.crossSection}·${last.combo.tipType}·${last.combo.guardShape})`
        : last.phase;
      setStatus(`최적화 중 [${comboText}] 평가 ${last.evals} — best IoU ${(last.best?.iou ?? 0).toFixed(3)}`);
      // 후보 실루엣 오버레이는 0.5s 스로틀 (재투영 비용)
      if (performance.now() - lastOverlayDraw > 500 && last.best?.x) {
        lastOverlayDraw = performance.now();
        drawCandidateFromProgress(last);
      }
    }
    if (r?.done) {
      finishRun(r.value, null);
    } else if (!running) {
      finishRun(null, last); // 중단 — 지금까지의 best 로 부분 결과 구성
    } else {
      setTimeout(() => pump(gen), 0);
    }
  }

  function progressInput(progress) {
    const base = progress.bestCombo ? applyDiscreteCombo(baseInput, progress.bestCombo) : baseInput;
    return vectorToInput(base, progress.best.x);
  }

  function drawCandidateFromProgress(progress) {
    try {
      drawOverlay(projectSwordMask(makeSwordDesign(progressInput(progress)), targetSpec.size));
    } catch { /* 진행 중 일시적 조합은 무시 */ }
  }

  function finishRun(finalResult, partialProgress) {
    running = false;
    if (finalResult) {
      result = finalResult;
      drawOverlay(finalResult.mask);
      const d = finalResult.discrete
        ? `  [${finalResult.discrete.crossSection}·${finalResult.discrete.tipType}·${finalResult.discrete.guardShape}]`
        : "";
      setStatus(`완료 — IoU ${finalResult.iou.toFixed(3)} (평가 ${finalResult.evals})${d}\n"결과 적용"으로 슬라이더 반영 → 수동 미세조정`);
    } else if (partialProgress?.best?.x) {
      const input = progressInput(partialProgress);
      result = { input, iou: partialProgress.best.iou };
      drawOverlay(projectSwordMask(makeSwordDesign(input), targetSpec.size));
      setStatus(`중단 — 현재 best IoU ${(partialProgress.best.iou ?? 0).toFixed(3)} 적용 가능`);
    } else {
      setStatus("중단됨");
    }
    drawGraph();
    updateStatus();
  }

  // ── 진행 그래프 + 오버레이 (표시 전용 Canvas 2D) ──
  function drawGraph() {
    const ctx = graphCanvas.getContext("2d");
    const { width: w, height: h } = graphCanvas;
    ctx.fillStyle = "#17181c";
    ctx.fillRect(0, 0, w, h);
    // 목표선 0.92
    ctx.strokeStyle = "#665";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, h - 0.92 * h);
    ctx.lineTo(w, h - 0.92 * h);
    ctx.stroke();
    ctx.setLineDash([]);
    if (iouHistory.length > 1) {
      ctx.strokeStyle = "#8fc";
      ctx.beginPath();
      for (let i = 0; i < iouHistory.length; i++) {
        const x = (i / (iouHistory.length - 1)) * w;
        const y = h - iouHistory[i] * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /** 참조 마스크(회색) vs 후보 마스크(청록) 오버레이 — 교집합은 밝게 */
  function drawOverlay(candidateMask) {
    if (!targetSpec) return;
    const ctx = overlayCanvas.getContext("2d");
    const s = overlayCanvas.width;
    const size = targetSpec.size;
    const img = ctx.createImageData(s, s);
    for (let py = 0; py < s; py++) {
      const my = Math.min(size - 1, Math.floor(((s - 1 - py) / s) * size)); // 화면 y-down → 마스크 y-up
      for (let px = 0; px < s; px++) {
        const mx = Math.min(size - 1, Math.floor((px / s) * size));
        const t = getMaskBit(targetSpec.mask, mx, my);
        const c = candidateMask ? getMaskBit(candidateMask, mx, my) : 0;
        const i = (py * s + px) * 4;
        img.data[i] = t ? 130 : 25;
        img.data[i + 1] = (t ? 110 : 25) + (c ? 110 : 0);
        img.data[i + 2] = (t ? 110 : 30) + (c ? 90 : 0);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ── 어노테이터 오버레이 (07-phase5 §5.1 — 다각형 라소 + 랜드마크 5클릭) ──
  const overlay = document.createElement("div");
  overlay.className = "ref-annotator";
  overlay.style.display = "none";
  viewport.appendChild(overlay);

  const toolbar = document.createElement("div");
  toolbar.className = "ref-toolbar";
  overlay.appendChild(toolbar);

  let tool = "mask"; // "mask" | "landmark"
  const toolMask = document.createElement("button");
  toolMask.textContent = "마스크 폴리곤";
  const toolLm = document.createElement("button");
  toolLm.textContent = "랜드마크";
  const lmSelect = document.createElement("select");
  for (const name of LANDMARK_NAMES) {
    const opt = document.createElement("option");
    opt.value = name;
    lmSelect.appendChild(opt);
  }
  const setTool = (t) => {
    tool = t;
    toolMask.classList.toggle("active", t === "mask");
    toolLm.classList.toggle("active", t === "landmark");
  };
  toolMask.addEventListener("click", () => setTool("mask"));
  toolLm.addEventListener("click", () => setTool("landmark"));
  toolbar.appendChild(toolMask);
  toolbar.appendChild(toolLm);
  toolbar.appendChild(lmSelect);

  const refreshLmSelect = () => {
    for (const opt of lmSelect.options) {
      const set = !!anno.landmarks[opt.value];
      opt.textContent = `${set ? "✓ " : ""}${LANDMARK_LABELS[opt.value]}`;
    }
  };
  refreshLmSelect();

  const toolbarBtn = (label, onClick) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", onClick);
    toolbar.appendChild(b);
    return b;
  };
  toolbarBtn("폴리곤 닫기", () => {
    if (anno.polygon.length >= 3) anno.polygonClosed = true;
    redrawAnnotator();
    updateStatus();
  });
  toolbarBtn("되돌리기", () => {
    if (tool === "mask" && anno.polygon.length) {
      anno.polygonClosed = false;
      anno.polygon.pop();
    } else if (tool === "landmark") {
      delete anno.landmarks[lmSelect.value];
      refreshLmSelect();
    }
    redrawAnnotator();
    updateStatus();
  });
  toolbarBtn("마스크 지우기", () => {
    anno.polygon = [];
    anno.polygonClosed = false;
    redrawAnnotator();
    updateStatus();
  });
  toolbarBtn("닫기", () => { overlay.style.display = "none"; updateStatus(); });

  const annoCanvas = document.createElement("canvas");
  annoCanvas.className = "ref-anno-canvas";
  overlay.appendChild(annoCanvas);

  // 화면 ↔ 이미지 좌표 (fit 스케일)
  let fit = { scale: 1, ox: 0, oy: 0 };
  const toImage = (sx, sy) => [(sx - fit.ox) / fit.scale, (sy - fit.oy) / fit.scale];
  const toScreen = (ix, iy) => [ix * fit.scale + fit.ox, iy * fit.scale + fit.oy];

  function openAnnotator() {
    if (!anno.width) { fileInput.click(); return; }
    overlay.style.display = "block";
    const rect = overlay.getBoundingClientRect();
    annoCanvas.width = rect.width;
    annoCanvas.height = rect.height - 34; // 툴바 높이
    fit.scale = Math.min(annoCanvas.width / anno.width, annoCanvas.height / anno.height);
    fit.ox = (annoCanvas.width - anno.width * fit.scale) / 2;
    fit.oy = (annoCanvas.height - anno.height * fit.scale) / 2;
    refreshLmSelect();
    redrawAnnotator();
  }

  annoCanvas.addEventListener("click", (event) => {
    const rect = annoCanvas.getBoundingClientRect();
    const [ix, iy] = toImage(event.clientX - rect.left, event.clientY - rect.top);
    if (ix < 0 || ix >= anno.width || iy < 0 || iy >= anno.height) return;
    if (tool === "mask") {
      if (anno.polygonClosed) return; // 닫힌 뒤에는 지우기/되돌리기로만 수정
      anno.polygon.push([ix, iy]);
    } else {
      anno.landmarks[lmSelect.value] = { x: ix, y: iy };
      refreshLmSelect();
      // 다음 미설정 랜드마크로 자동 이동
      const next = LANDMARK_NAMES.find((n) => !anno.landmarks[n]);
      if (next) lmSelect.value = next;
    }
    redrawAnnotator();
    updateStatus();
  });

  function redrawAnnotator() {
    const ctx = annoCanvas.getContext("2d");
    ctx.fillStyle = "#101114";
    ctx.fillRect(0, 0, annoCanvas.width, annoCanvas.height);
    const backdrop = anno.image ?? anno.maskBackdrop;
    if (backdrop) {
      ctx.drawImage(backdrop, fit.ox, fit.oy, anno.width * fit.scale, anno.height * fit.scale);
    }
    // 폴리곤
    if (anno.polygon.length) {
      ctx.strokeStyle = anno.polygonClosed ? "#6f6" : "#fc6";
      ctx.fillStyle = "rgba(120,255,120,0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      anno.polygon.forEach(([x, y], i) => {
        const [sx, sy] = toScreen(x, y);
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      if (anno.polygonClosed) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();
      for (const [x, y] of anno.polygon) {
        const [sx, sy] = toScreen(x, y);
        ctx.fillStyle = "#fc6";
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }
    // 검 축 (tip·root)
    const tip = anno.landmarks.tip;
    const root = anno.landmarks.root;
    if (tip && root) {
      ctx.strokeStyle = "rgba(120,180,255,0.7)";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(...toScreen(root.x, root.y));
      ctx.lineTo(...toScreen(tip.x, tip.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 랜드마크
    for (const name of LANDMARK_NAMES) {
      const lm = anno.landmarks[name];
      if (!lm) continue;
      const [sx, sy] = toScreen(lm.x, lm.y);
      ctx.fillStyle = "#7cf";
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#cde";
      ctx.font = "11px system-ui";
      ctx.fillText(name, sx + 6, sy - 4);
    }
  }

  updateStatus();
  return { updateStatus };
}
