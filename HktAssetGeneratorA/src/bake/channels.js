// 채널 프래그먼트 함수 — 원본 §18.3~18.5 GLSL 수식의 JS 이식 (05-phase3 §3.4).
// 모든 함수는 순수: (uniforms, frag) 만 읽고 frag.out 에 기록. 노이즈는 core/noise 만.
// AO 는 D-7 근사: cavity + fuller + 감기 골 — 부품 간 차폐는 Phase 7.
// Phase 4: 전역 SurfaceState 에 Operation 상태 필드가 **가산**되고(06 §4.2), 긁힘·조각은
// 캡슐/마스크 샘플로 높이·거칠기·색을 보정한다(06 §4.3~4.4). 로그가 비면 가산량이 정확히 0 —
// Phase 3 산출물과 비트 동일하다.

import { fbm, directionalNoise, periodicValueNoise2 } from "../core/noise.js";
import { clamp01, clamp, lerp } from "../core/math.js";
import { wrapGroove } from "../mesh/grip.js";
import { sampleAccum } from "../material/operations.js";
import { sampleScratchDepth } from "../material/scratch.js";
import { sampleEngravings } from "../material/masks.js";

// metric UV (1 단위 = 10cm/5cm) → 노이즈 좌표 스케일: primitive.scale 을
// "1m 당 셀 수" 로 해석한다. 칼날 metric 1 단위 = 0.1m 이므로 셀좌표 = metric × scale × 0.1 / 10
const noiseCoordScale = (specScale) => specScale * 0.01;

/** 둘레(V) 주기 — 아일랜드의 metric 둘레 길이를 노이즈 주기로 (D-10 완화). MVP: 비주기 0. */
function colorVariationAt(prim, frag, seed) {
  const s = noiseCoordScale(prim.colorVariation.scale);
  return fbm(frag.uvMetricU * s, frag.uvMetricV * s, {
    octaves: 3, seed: seed + prim.colorVariation.seedOffset,
  }) - 0.5;
}

function microHeightAt(prim, frag, seed) {
  const spec = prim.microNormal;
  const s = noiseCoordScale(spec.scale);
  if (spec.type === "directional") {
    // 연마 흔적 — 길이 방향(metric U 축) 줄무늬
    return (directionalNoise(frag.uvMetricU * s, frag.uvMetricV * s, {
      angle: 0, stretch: spec.stretch ?? 8, seed: seed + spec.seedOffset,
    }) - 0.5) * spec.strength;
  }
  return (fbm(frag.uvMetricU * s, frag.uvMetricV * s, {
    octaves: 4, seed: seed + spec.seedOffset,
  }) - 0.5) * spec.strength;
}

/** 부품 uniform + frag → 마스크 공통 계산. */
function computeMasks(u, frag) {
  const { state, prim, ops } = u;
  const wrap = u.wrapMask ? wrapGroove(frag.uvLocalU, frag.uvLocalV, u.wrapMask.turns) : 0;
  // 전역 상태 + Operation 상태 필드 (06 §4.2) — 물질별 반응 계수는 아래에서 그대로 곱해져
  // 물질 간 차이가 유지된다.
  const oxidationAmount = clamp01(state.oxidation + sampleAccum(ops.oxidation, frag));
  const dirtAmount = clamp01(state.dirt + sampleAccum(ops.dirt, frag));
  // 원본 §18.3: cavity·fuller 기반(틈새 우선) + 반점 확산 —
  // cavity 만으로는 매끈한 면이 상태와 무관하게 깨끗해서, 상태가 높을수록
  // 노이즈 문턱이 낮아져 열린 면까지 번지는 항을 더한다 (원본 §0 "반점 분포").
  const crevice = clamp01(frag.cavity * 0.6 + frag.fullerWeight * 0.45 + wrap * 0.3);
  const oxSpread = clamp01(
    (fbm(frag.uvMetricU * 1.2, frag.uvMetricV * 1.2, { octaves: 3, seed: u.seed + 7777 })
      - (1 - oxidationAmount)) * 2);
  const oxidation = clamp01((crevice + oxSpread * 0.7)
    * oxidationAmount * (prim.rules.cavityOxidationResponse / 0.55));
  const dirtSpread = clamp01(
    (fbm(frag.uvMetricU * 1.6 + 13.7, frag.uvMetricV * 1.6, { octaves: 3, seed: u.seed + 8888 })
      - (1 - dirtAmount)) * 1.5);
  const dirt = clamp01((frag.cavity * 0.7 + wrap * 0.4 + dirtSpread * 0.6) * dirtAmount);
  // 연마: 전역 상태는 날·능선을 따라, Operation 은 자기 선택자 가중으로 (D-15)
  const polish = Math.max(frag.edgeWeight, frag.ridgeWeight) * state.polish
    + sampleAccum(ops.polish, frag);
  // 긁힘(metric 공간 캡슐 SDF) · 조각(uvLocal 마스크) — 없으면 정확히 0
  const scratch = sampleScratchDepth(ops.scratchGrid, frag.uvMetricU, frag.uvMetricV);
  const engrave = sampleEngravings(ops.engravings, frag.uvLocalU, frag.uvLocalV);
  return { wrap, oxidation, dirt, polish, scratch, engrave };
}

/**
 * 채널 통합 셰이더 — 한 번의 래스터 순회로 모든 채널 평가 (05-phase3 §3.3).
 * @param uniformsByPart compileSurfaceGraph 결과 (partId 인덱스)
 */
export function createSwordShader(uniformsByPart) {
  return function shade(frag) {
    const u = uniformsByPart[frag.partId];
    const { prim, inst, state } = u;
    const m = computeMasks(u, frag);

    // ── BaseColor (원본 §18.3) ──
    const variation = colorVariationAt(prim, frag, u.seed) * prim.colorVariation.strength * 2;
    let r = prim.baseColor[0] * inst.colorTint[0] * (1 + variation);
    let g = prim.baseColor[1] * inst.colorTint[1] * (1 + variation);
    let b = prim.baseColor[2] * inst.colorTint[2] * (1 + variation);
    r = lerp(r, prim.oxidationColor[0], m.oxidation);
    g = lerp(g, prim.oxidationColor[1], m.oxidation);
    b = lerp(b, prim.oxidationColor[2], m.oxidation);
    r = lerp(r, prim.dirtColor[0], m.dirt);
    g = lerp(g, prim.dirtColor[1], m.dirt);
    b = lerp(b, prim.dirtColor[2], m.dirt);
    // 감기 골 어둡기 (가죽 감기 시각화 — 원본 §8)
    if (m.wrap > 0) { const dk = 1 - m.wrap * 0.25; r *= dk; g *= dk; b *= dk; }
    // 긁힘은 금속 노출로 미세하게 밝게, 조각은 골이라 어둡게 (06 §4.3~4.4)
    const surface = (1 + m.scratch * 0.5) * (1 - m.engrave * 0.35);
    r *= surface; g *= surface; b *= surface;
    frag.out.r = clamp01(r); frag.out.g = clamp01(g); frag.out.b = clamp01(b);

    // ── Roughness (원본 §18.4) ──
    frag.out.rough = clamp(
      prim.roughness + inst.roughnessOffset
      - m.polish * prim.rules.edgePolishResponse
      + m.oxidation * 0.3
      + m.wrap * 0.1
      + state.moisture * prim.rules.moistureRoughnessResponse
      + m.scratch * 0.5 * prim.rules.scratchNormalResponse
      + m.engrave * 0.3,
      0.04, 1);

    // ── Metallic (원본 §18.5) ──
    frag.out.metal = clamp01(prim.metallic - m.oxidation * 0.25);

    // ── AO (D-7 근사) ──
    frag.out.ao = 1 - clamp01(frag.cavity * 0.7 + frag.fullerWeight * 0.3 + m.wrap * 0.4) * 0.85;

    // ── Height (→ Normal, 원본 §20) — 미세 표면 + 감기 골 + 긁힘/조각 ──
    frag.out.height = microHeightAt(prim, frag, u.seed) * inst.normalStrength
      - m.wrap * 0.35 * inst.normalStrength
      - (m.scratch + m.engrave) * inst.normalStrength;
  };
}
