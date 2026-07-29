// 최적화 파라미터 공간 — 원본 §26 SwordOptimizationVector (10차원) 의 웹 대응.
// 각 파라미터 [min,max] 를 정의하고 정규화된 [0,1] 벡터 ↔ SwordInput(중첩 파라미터)로
// 오간다 (07-phase5 §5.4). 범위는 UI 슬라이더(panels.js)와 같은 값 — 튜닝 노브.

import { clamp, clamp01, lerp } from "../core/math.js";

/**
 * 10차원 벡터 정의. get/set 은 makeSwordDesign 입력(중첩 SwordInput)을 대상으로 한다.
 * 순서 = 원본 §26 필드 순서 (벡터 인덱스 규약 — 변경 금지).
 */
export const OPT_PARAM_DEFS = [
  { key: "bladeLength", min: 0.3, max: 1.8, get: (p) => p.blade.length, set: (p, v) => { p.blade.length = v; } },
  { key: "bladeWidthRoot", min: 0.02, max: 0.14, get: (p) => p.blade.widthRoot, set: (p, v) => { p.blade.widthRoot = v; } },
  { key: "bladeWidthMiddle", min: 0.015, max: 0.13, get: (p) => p.blade.widthMid, set: (p, v) => { p.blade.widthMid = v; } },
  { key: "bladeWidthTip", min: 0.005, max: 0.1, get: (p) => p.blade.widthTip, set: (p, v) => { p.blade.widthTip = v; } },
  { key: "bladeThicknessRoot", min: 0.003, max: 0.02, get: (p) => p.blade.thicknessRoot, set: (p, v) => { p.blade.thicknessRoot = v; } },
  { key: "bladeThicknessTip", min: 0.002, max: 0.015, get: (p) => p.blade.thicknessTip, set: (p, v) => { p.blade.thicknessTip = v; } },
  { key: "taperStart", min: 0.4, max: 0.95, get: (p) => p.blade.tipStart, set: (p, v) => { p.blade.tipStart = v; } },
  { key: "tipEndScale", min: 0.01, max: 0.5, get: (p) => p.blade.tipEndScale, set: (p, v) => { p.blade.tipEndScale = v; } },
  { key: "guardWidth", min: 0.08, max: 0.3, get: (p) => p.guard.width, set: (p, v) => { p.guard.width = v; } },
  { key: "gripLength", min: 0.08, max: 0.4, get: (p) => p.grip.length, set: (p, v) => { p.grip.length = v; } },
];

/** 파라미터 키의 [min,max] 로 클램프 — 초기 설계 추정(targetspec)도 같은 범위를 쓴다. */
export function clampParam(key, value) {
  const def = OPT_PARAM_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`알 수 없는 최적화 파라미터: ${key}`);
  return clamp(value, def.min, def.max);
}

/** SwordInput → 정규화 벡터 [0,1]^10 */
export function inputToVector(input) {
  return OPT_PARAM_DEFS.map((d) => clamp01((d.get(input) - d.min) / (d.max - d.min)));
}

/** 정규화 벡터 → base SwordInput 의 깊은 복제에 덮어쓴 새 입력 */
export function vectorToInput(baseInput, vector) {
  const input = structuredClone(baseInput);
  for (let i = 0; i < OPT_PARAM_DEFS.length; i++) {
    const d = OPT_PARAM_DEFS[i];
    d.set(input, lerp(d.min, d.max, clamp01(vector[i])));
  }
  return input;
}
