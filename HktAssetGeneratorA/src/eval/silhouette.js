// CPU 실루엣 평가 — 렌더러 없는 직교 투영 마스크 + IoU (07-phase5 §5.3, D-11).
// side 뷰 = X-Y 평면 투영 (검 규약: +Y 칼끝, ±X 칼날 폭 — 02-architecture §3).
// 결정 경로: GPU·Canvas 금지, 자체 edge-function 래스터만 (bake/raster.js 와 같은 원리,
// 커버리지만 기록하므로 top-left rule 대신 포함 경계로 단순화 — OR 누적이라 이중 채움 무해).

import { buildSwordParts } from "../mesh/sword.js";

/** 실루엣 마스크 한 변 (07-phase5 §5.2 — 256² 비트마스크) */
export const SILHOUETTE_SIZE = 256;

/** aggregateLoss 가중치 — 튜닝 노브 (07-phase5 §5.3: 상수 모듈로 노출) */
export const LOSS_WEIGHTS = { iou: 1.0, landmark: 0.5, proportion: 0.3 };

// ── 비트마스크 (Uint32 워드) ────────────────────────────────────────────────

/** @returns {{ size, words: Uint32Array }} — 비트 idx = y*size + x, y = 정규 프레임 위쪽(+칼끝) */
export function createBitMask(size = SILHOUETTE_SIZE) {
  return { size, words: new Uint32Array((size * size) >> 5) };
}

export const setMaskBit = (mask, x, y) => {
  const idx = y * mask.size + x;
  mask.words[idx >> 5] |= 1 << (idx & 31);
};

export const getMaskBit = (mask, x, y) => {
  const idx = y * mask.size + x;
  return (mask.words[idx >> 5] >>> (idx & 31)) & 1;
};

/** 32bit popcount (Hamming weight) */
export function popcount32(v) {
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  v = (v + (v >>> 4)) & 0x0f0f0f0f;
  return (v * 0x01010101) >>> 24;
}

export function countMaskBits(mask) {
  let n = 0;
  for (let i = 0; i < mask.words.length; i++) n += popcount32(mask.words[i]);
  return n;
}

/** IoU = |AND| / |OR| — 워드 단위 비트 연산 (07-phase5 §5.3) */
export function silhouetteIoU(a, b) {
  if (a.size !== b.size) throw new Error("마스크 크기 불일치");
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.words.length; i++) {
    inter += popcount32(a.words[i] & b.words[i]);
    union += popcount32(a.words[i] | b.words[i]);
  }
  return union === 0 ? 0 : inter / union;
}

// ── 검 축 범위 (정규 프레임) ────────────────────────────────────────────────
// 정규 프레임: 검 축 = y, 실루엣 최하단(폼멜 바닥) = 0, 칼끝 = 1, x 는 축 중심 ±0.5
// (같은 스케일 — 종횡비 보존). 절대 스케일은 이미지에서 관측 불가하므로 목표·후보 모두
// 이 프레임으로 정규화해 비교한다 — 07-phase5 §5.2 "회전·스케일 보정"의 구체화.

/** 폼멜 프로파일 깊이 (profile y 는 0 → 음수) */
export const pommelDepth = (design) =>
  design.pommel.profile.reduce((m, p) => Math.max(m, -p[1]), 0);

/** @returns {{ tipY, bottomY, total }} — 조립 좌표(blade 원점 기준, 미터) */
export function designAxisExtent(design) {
  const tipY = design.blade.length;
  const bottomY = -(design.guard.depth + design.grip.length + pommelDepth(design));
  return { tipY, bottomY, total: tipY - bottomY };
}

/** 설계에서 해석적으로 얻는 정규 랜드마크 축상 위치 (tip=1, bottom=0 은 구성상 자명) */
export function designLandmarks(design) {
  const { bottomY, total } = designAxisExtent(design);
  const norm = (y) => (y - bottomY) / total;
  return {
    root: norm(0),
    guardTop: norm(0), // 칼날 뿌리 = 가드 앞면 (소켓 규약)
    guardBottom: norm(-design.guard.depth),
    gripBottom: norm(-(design.guard.depth + design.grip.length)),
  };
}

/** 부품별 정규 축 길이 비율 (합 = 1) */
export function designPartSpans(design) {
  const lm = designLandmarks(design);
  return {
    blade: 1 - lm.root,
    guard: lm.guardTop - lm.guardBottom,
    grip: lm.guardBottom - lm.gripBottom,
    pommel: lm.gripBottom,
  };
}

// ── 투영 래스터 ─────────────────────────────────────────────────────────────

/** 2D 삼각형을 비트 그리드에 채움 — 픽셀 중심 샘플, 경계 포함(coverage OR 이라 안전) */
function fillTriangleBits(mask, ax, ay, bx, by, cx, cy) {
  const size = mask.size;
  let area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (area === 0) return;
  if (area < 0) {
    [bx, cx] = [cx, bx];
    [by, cy] = [cy, by];
    area = -area;
  }
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
  const e01a = ay - by, e01b = bx - ax, e01c = -(e01a * ax + e01b * ay);
  const e12a = by - cy, e12b = cx - bx, e12c = -(e12a * bx + e12b * by);
  const e20a = cy - ay, e20b = ax - cx, e20c = -(e20a * cx + e20b * cy);
  for (let py = minY; py <= maxY; py++) {
    const sy = py + 0.5;
    for (let px = minX; px <= maxX; px++) {
      const sx = px + 0.5;
      if (e01a * sx + e01b * sy + e01c < 0) continue;
      if (e12a * sx + e12b * sy + e12c < 0) continue;
      if (e20a * sx + e20b * sy + e20c < 0) continue;
      const idx = py * size + px;
      mask.words[idx >> 5] |= 1 << (idx & 31);
    }
  }
}

/**
 * SwordDesign → 정규 프레임 side 실루엣 비트마스크.
 * 부품 메시(Transform 적용)의 삼각형을 X-Y 로 직교 투영 (z 무시).
 */
export function projectSwordMask(design, size = SILHOUETTE_SIZE) {
  const { parts } = buildSwordParts(design);
  const { bottomY, total } = designAxisExtent(design);
  const mask = createBitMask(size);
  for (const part of parts) {
    const { positions, indices } = part.mesh;
    const [tx, ty] = part.transform;
    const triCount = indices.length / 3;
    for (let t = 0; t < triCount; t++) {
      const ia = indices[t * 3], ib = indices[t * 3 + 1], ic = indices[t * 3 + 2];
      // 정규 프레임 → 픽셀: x ∈ [-0.5,0.5]·total → [0,size], y ∈ [bottomY,tipY] → [0,size]
      const ax = ((positions[ia * 3] + tx) / total + 0.5) * size;
      const ay = ((positions[ia * 3 + 1] + ty - bottomY) / total) * size;
      const bx = ((positions[ib * 3] + tx) / total + 0.5) * size;
      const by = ((positions[ib * 3 + 1] + ty - bottomY) / total) * size;
      const cx = ((positions[ic * 3] + tx) / total + 0.5) * size;
      const cy = ((positions[ic * 3 + 1] + ty - bottomY) / total) * size;
      fillTriangleBits(mask, ax, ay, bx, by, cx, cy);
    }
  }
  return mask;
}

// ── 오차·손실 ───────────────────────────────────────────────────────────────

/** 대응 랜드마크(축상 정규 위치) RMS — tip(=1)·bottom(=0)은 정규화 구성상 자명해 제외 */
export function landmarkError(targetSpec, design) {
  const cand = designLandmarks(design);
  const names = ["root", "guardTop", "guardBottom", "gripBottom"];
  let sum = 0;
  for (const name of names) {
    const d = targetSpec.landmarksN[name] - cand[name];
    sum += d * d;
  }
  return Math.sqrt(sum / names.length);
}

/** 부품별 축 길이 비율 차 — 평균 절대 오차 */
export function partProportionError(targetSpec, design) {
  const cand = designPartSpans(design);
  const names = ["blade", "guard", "grip", "pommel"];
  let sum = 0;
  for (const name of names) sum += Math.abs(targetSpec.parts[name].span - cand[name]);
  return sum / names.length;
}

/**
 * 한 후보의 전체 평가 (07-phase5 §5.3).
 * aggregateLoss = (1 − IoU) + 0.5·landmarkError + 0.3·proportionError (LOSS_WEIGHTS)
 */
export function evaluateSilhouette(targetSpec, design) {
  const mask = projectSwordMask(design, targetSpec.mask.size);
  const iou = silhouetteIoU(targetSpec.mask, mask);
  const lmErr = landmarkError(targetSpec, design);
  const propErr = partProportionError(targetSpec, design);
  const aggregateLoss =
    LOSS_WEIGHTS.iou * (1 - iou) + LOSS_WEIGHTS.landmark * lmErr + LOSS_WEIGHTS.proportion * propErr;
  return { iou, landmarkError: lmErr, proportionError: propErr, aggregateLoss, mask };
}
