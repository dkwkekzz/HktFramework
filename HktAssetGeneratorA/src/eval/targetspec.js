// TargetSpec 생성 — 참조 어노테이션 → SwordTargetSpec (07-phase5 §5.2, 원본 §5.3).
// 정규 프레임(silhouette.js 와 동일): 검 축 = y, 실루엣 최하단 = 0, 칼끝 = 1,
// x 는 축 중심 ±0.5 (같은 스케일). 절대 스케일은 이미지에서 관측 불가 —
// createInitialSwordDesign 이 물리 칼날 길이 앵커(기본 0.9m)로 미터를 복원한다.

import { clamp } from "../core/math.js";
import { makeSwordDesign } from "../mesh/sword.js";
import { decodeReferenceMask } from "./refmask.js";
import { clampParam } from "./paramspace.js";
import {
  SILHOUETTE_SIZE, createBitMask, setMaskBit, getMaskBit,
  projectSwordMask, designLandmarks, designPartSpans,
} from "./silhouette.js";

/** 부품 경계 랜드마크 이름 — 어노테이션 UI 와 규약 공유 (07-phase5 §5.1) */
export const LANDMARK_NAMES = ["tip", "root", "guardTop", "guardBottom", "gripBottom"];

/** 마스크(y-up 비트마스크)의 행별 폭 프로파일 — 정규 단위 (1행 폭 = 1/size) */
function widthProfileFromMask(mask) {
  const size = mask.size;
  const profile = new Float32Array(size);
  for (let y = 0; y < size; y++) {
    let count = 0;
    for (let x = 0; x < size; x++) count += getMaskBit(mask, x, y);
    profile[y] = count / size;
  }
  return profile;
}

/**
 * 행별 중심선 프로파일 — 마스크 행 무게중심의 축(x=0.5) 이탈, 정규 단위 (D-18).
 * 빈 행은 0. 칼날 휨(sagitta)·손잡이 기울임의 초기 추정 재료.
 */
function centerProfileFromMask(mask) {
  const size = mask.size;
  const profile = new Float32Array(size);
  for (let y = 0; y < size; y++) {
    let count = 0;
    let sum = 0;
    for (let x = 0; x < size; x++) {
      if (getMaskBit(mask, x, y)) { count++; sum += x + 0.5; }
    }
    profile[y] = count ? sum / count / size - 0.5 : 0;
  }
  return profile;
}

/** 정규 축상 위치 → 부품 구간 (blade/guard/grip/pommel — 각 {start,end,span}) */
function partsFromLandmarks(lm) {
  const spans = {
    blade: { start: lm.root, end: 1 },
    guard: { start: lm.guardBottom, end: lm.guardTop },
    grip: { start: lm.gripBottom, end: lm.guardBottom },
    pommel: { start: 0, end: lm.gripBottom },
  };
  for (const name of Object.keys(spans)) {
    const s = spans[name];
    if (!(s.end > s.start)) throw new Error(`부품 구간이 뒤집힘: ${name} (${s.start} → ${s.end})`);
    s.span = s.end - s.start;
  }
  return spans;
}

/**
 * referenceSpec (refmask.buildReferenceSpec 산출물) → SwordTargetSpec.
 * 회전·스케일 보정: tip·root 랜드마크가 만드는 검 축으로 마스크를 재샘플링 (07-phase5 §5.2).
 * @returns {{ size, mask, widthProfile, landmarksN, parts, view,
 *             materialTargets, hiddenStructureHypotheses }}
 */
export function buildTargetSpec(referenceSpec, size = SILHOUETTE_SIZE) {
  const { width, height } = referenceSpec.image;
  const imageMask = decodeReferenceMask(referenceSpec);
  const lmByName = {};
  for (const lm of referenceSpec.landmarks) lmByName[lm.name] = lm;
  for (const name of LANDMARK_NAMES) {
    if (!lmByName[name]) throw new Error(`랜드마크 누락: ${name}`);
  }

  // 검 축 (이미지 px 좌표 — y down 이어도 순수 2D 벡터 연산이라 무관)
  const root = lmByName.root;
  const tip = lmByName.tip;
  const dx = tip.x - root.x, dy = tip.y - root.y;
  const tipT = Math.hypot(dx, dy);
  if (tipT < 1e-6) throw new Error("tip·root 랜드마크가 겹침 — 검 축을 만들 수 없다");
  const ux = dx / tipT, uy = dy / tipT; // 축 단위벡터 (root → tip)
  const nx = -uy, ny = ux; // 수직 단위벡터

  // 실루엣 최하단(축 좌표 최소) 탐색 — 마스크 픽셀 1회 스캔
  let bottomT = Infinity;
  let maskCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!imageMask[y * width + x]) continue;
      maskCount++;
      const t = (x + 0.5 - root.x) * ux + (y + 0.5 - root.y) * uy;
      if (t < bottomT) bottomT = t;
    }
  }
  if (maskCount === 0) throw new Error("객체 마스크가 비어 있다");
  bottomT = Math.min(bottomT, 0); // 뿌리보다 아래가 없어도 프레임은 root 이하 포함
  const totalLen = tipT - bottomT;

  // 정규 프레임 → 이미지 역매핑으로 256² 재샘플 (최근접)
  const mask = createBitMask(size);
  for (let gy = 0; gy < size; gy++) {
    const t = bottomT + ((gy + 0.5) / size) * totalLen;
    for (let gx = 0; gx < size; gx++) {
      const s = ((gx + 0.5) / size - 0.5) * totalLen;
      const px = Math.floor(root.x + ux * t + nx * s);
      const py = Math.floor(root.y + uy * t + ny * s);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      if (imageMask[py * width + px]) setMaskBit(mask, gx, gy);
    }
  }

  // 랜드마크 정규화 (축상 위치)
  const normT = (lm) => {
    const t = (lm.x - root.x) * ux + (lm.y - root.y) * uy;
    return clamp((t - bottomT) / totalLen, 0, 1);
  };
  const landmarksN = {
    tip: 1,
    root: normT(root),
    guardTop: normT(lmByName.guardTop),
    guardBottom: normT(lmByName.guardBottom),
    gripBottom: normT(lmByName.gripBottom),
    bottom: 0,
  };

  return {
    size,
    mask,
    widthProfile: widthProfileFromMask(mask),
    centerProfile: centerProfileFromMask(mask),
    landmarksN,
    parts: partsFromLandmarks(landmarksN),
    view: referenceSpec.image.view,
    // Phase 6 까지 빈 배열 / 기본 가설 (07-phase5 §5.2 — 단면 diamond 기본)
    materialTargets: [],
    hiddenStructureHypotheses: [{ crossSection: "diamond" }],
  };
}

/**
 * 합성 참조 — 우리가 만든 검을 투영해 TargetSpec 을 만든다 (07-phase5 §5.5 라운드트립,
 * UI 데모 겸용). 정답 파라미터를 아는 자기 일관성 검증의 기준.
 */
export function synthesizeTargetSpec(design, size = SILHOUETTE_SIZE) {
  const mask = projectSwordMask(design, size);
  const lm = designLandmarks(design);
  const spans = designPartSpans(design);
  return {
    size,
    mask,
    widthProfile: widthProfileFromMask(mask),
    centerProfile: centerProfileFromMask(mask),
    landmarksN: { tip: 1, bottom: 0, ...lm },
    parts: {
      blade: { start: lm.root, end: 1, span: spans.blade },
      guard: { start: lm.guardBottom, end: lm.guardTop, span: spans.guard },
      grip: { start: lm.gripBottom, end: lm.guardBottom, span: spans.grip },
      pommel: { start: 0, end: lm.gripBottom, span: spans.pommel },
    },
    view: "side",
    materialTargets: [],
    hiddenStructureHypotheses: [{ crossSection: design.blade.crossSection }],
  };
}

/** 부품 구간 내 폭 프로파일 샘플 (정규 단위 → 미터 변환은 호출자) */
function sampleWidth(targetSpec, tn) {
  const i = clamp(Math.floor(tn * targetSpec.size), 0, targetSpec.size - 1);
  return targetSpec.widthProfile[i];
}

/** 중심선 프로파일 샘플 (정규 단위, 빈 행 = 0) — D-18 */
function sampleCenter(targetSpec, tn) {
  const i = clamp(Math.floor(tn * targetSpec.size), 0, targetSpec.size - 1);
  return targetSpec.centerProfile?.[i] ?? 0;
}

/** 구간 내 최대 폭 (정규 단위) */
function maxWidthIn(targetSpec, start, end) {
  let best = 0;
  const from = clamp(Math.floor(start * targetSpec.size), 0, targetSpec.size - 1);
  const to = clamp(Math.ceil(end * targetSpec.size), 0, targetSpec.size - 1);
  for (let i = from; i <= to; i++) best = Math.max(best, targetSpec.widthProfile[i]);
  return best;
}

/** 구간 내 폭 중앙값 (정규 단위) — 0 폭 행(빈 스캔라인)은 제외 */
function medianWidthIn(targetSpec, start, end) {
  const from = clamp(Math.floor(start * targetSpec.size), 0, targetSpec.size - 1);
  const to = clamp(Math.ceil(end * targetSpec.size), 0, targetSpec.size - 1);
  const values = [];
  for (let i = from; i <= to; i++) {
    if (targetSpec.widthProfile[i] > 0) values.push(targetSpec.widthProfile[i]);
  }
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

/**
 * 폭 프로파일에서 직접 초기 SwordDesign — 최적화의 좋은 출발점 (07-phase5 §5.2).
 * 길이·뿌리/중간/끝 폭·가드 폭·손잡이 길이를 프로파일 읽기로 산출.
 * @param opts.bladeLength 물리 칼날 길이 앵커 (m) — 이미지에서 절대 스케일은 관측 불가
 * @returns {{ input, design }} — input 은 makeSwordDesign 입력(UI 슬라이더 적용 가능)
 */
export function createInitialSwordDesign(targetSpec, opts = {}) {
  const bladeLength = clampParam("bladeLength", opts.bladeLength ?? 0.9);
  const bladeSpan = targetSpec.parts.blade.span;
  const metersPerUnit = bladeLength / bladeSpan;
  const rootN = targetSpec.parts.blade.start;

  // 폭 샘플 — 끝 폭은 tip 테이퍼(기본 tipStart 0.8) 직전에서 읽는다
  const widthRoot = clampParam("bladeWidthRoot", sampleWidth(targetSpec, rootN + 0.06 * bladeSpan) * metersPerUnit);
  const widthMid = clampParam("bladeWidthMiddle", sampleWidth(targetSpec, rootN + 0.5 * bladeSpan) * metersPerUnit);
  const widthTip = clampParam("bladeWidthTip", sampleWidth(targetSpec, rootN + 0.75 * bladeSpan) * metersPerUnit);

  const guard = targetSpec.parts.guard;
  const guardWidth = clampParam("guardWidth", maxWidthIn(targetSpec, guard.start, guard.end) * metersPerUnit);
  const guardDepth = clamp(guard.span * metersPerUnit, 0.008, 0.05);

  const grip = targetSpec.parts.grip;
  const gripLength = clampParam("gripLength", grip.span * metersPerUnit);
  const gripRadius = clamp(medianWidthIn(targetSpec, grip.start, grip.end) * metersPerUnit * 0.5, 0.008, 0.03);

  // 폼멜 스케일: sphere 프로파일 깊이 = 0.04·scale (pommel.js makePommelProfile)
  const pommelScale = clamp((targetSpec.parts.pommel.span * metersPerUnit) / 0.04, 0.6, 3);

  // 곡선 초기 추정 (D-18): 칼날 중간의 중심선 이탈 = sagitta,
  // 손잡이 구간 양끝 이탈 차 = tilt — 폭 프로파일 읽기와 같은 원리
  const bladeCurve = clampParam("bladeCurve",
    sampleCenter(targetSpec, rootN + 0.5 * bladeSpan) * metersPerUnit);
  const gripTilt = clampParam("gripTilt",
    (sampleCenter(targetSpec, grip.start + 0.1 * grip.span)
      - sampleCenter(targetSpec, grip.end - 0.1 * grip.span)) * metersPerUnit);

  const crossSection = targetSpec.hiddenStructureHypotheses[0]?.crossSection ?? "diamond";
  const input = {
    blade: {
      length: bladeLength, widthRoot, widthMid, widthTip,
      thicknessRoot: 0.006, thicknessTip: 0.004,
      crossSection, ridgeHeight: crossSection === "diamond" ? 0.5 : 0,
      tipType: "spear", tipStart: 0.8, tipEndScale: 0.05,
      curve: bladeCurve,
      segLong: 32, segCross: 16,
    },
    guard: { shape: "bar", width: guardWidth, thickness: 0.025, depth: guardDepth, bevel: 0.004 },
    grip: {
      length: gripLength, startRadius: gripRadius, endRadius: gripRadius * 0.9,
      tilt: gripTilt,
      wrapGeometry: { enabled: false, turns: 9, depth: 0.0012 },
    },
    pommel: { shape: "sphere", scale: pommelScale },
  };
  return { input, design: makeSwordDesign(input) };
}
