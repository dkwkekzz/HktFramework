// Phase 5 검증 — CPU 실루엣 투영·IoU·평가 리포트 (07-phase5 §5.3·§5.5)

import { describe, it, expect } from "vitest";
import { makeSwordDesign } from "../src/mesh/sword.js";
import {
  projectSwordMask, silhouetteIoU, countMaskBits, popcount32,
  designLandmarks, designPartSpans, evaluateSilhouette, LOSS_WEIGHTS,
} from "../src/eval/silhouette.js";
import { synthesizeTargetSpec } from "../src/eval/targetspec.js";
import { evaluateSwordQuality, assertBuildQuality } from "../src/eval/metrics.js";

const SWORD_PARAMS = {
  blade: {
    length: 0.95, widthRoot: 0.055, widthMid: 0.048, widthTip: 0.03,
    thicknessRoot: 0.006, thicknessTip: 0.004,
    crossSection: "diamond", ridgeHeight: 0.5,
    tipType: "spear", tipStart: 0.8, tipEndScale: 0.05, segLong: 32, segCross: 16,
  },
  guard: { shape: "bar", width: 0.18, thickness: 0.025, depth: 0.02, bevel: 0.004 },
  grip: { length: 0.14, startRadius: 0.014, endRadius: 0.012 },
  pommel: { shape: "sphere", scale: 1.5 },
};

const defaultDesign = () => makeSwordDesign(structuredClone(SWORD_PARAMS));

describe("실루엣 투영 (07-phase5 §5.3)", () => {
  it("popcount32 가 정확하다", () => {
    expect(popcount32(0)).toBe(0);
    expect(popcount32(0xffffffff)).toBe(32);
    expect(popcount32(0b1011)).toBe(3);
  });

  it("기본 검의 side 투영은 비어 있지 않고 결정적이다", () => {
    const a = projectSwordMask(defaultDesign());
    const b = projectSwordMask(defaultDesign());
    expect(countMaskBits(a)).toBeGreaterThan(1000);
    expect(Array.from(a.words)).toEqual(Array.from(b.words));
  });

  it("자기 자신과의 IoU = 1, 다른 설계와는 < 1", () => {
    const base = projectSwordMask(defaultDesign());
    expect(silhouetteIoU(base, base)).toBe(1);

    const other = structuredClone(SWORD_PARAMS);
    other.grip.length = 0.3;
    other.blade.widthRoot = 0.09;
    const otherMask = projectSwordMask(makeSwordDesign(other));
    expect(silhouetteIoU(base, otherMask)).toBeLessThan(0.95);
  });

  it("해석 랜드마크·부품 비율이 기하와 일치한다", () => {
    const design = defaultDesign();
    const lm = designLandmarks(design);
    const spans = designPartSpans(design);
    // 정규 프레임: tip = 1, bottom = 0, root 는 그 사이
    expect(lm.root).toBeGreaterThan(0);
    expect(lm.root).toBeLessThan(1);
    expect(lm.guardBottom).toBeLessThan(lm.guardTop);
    expect(lm.gripBottom).toBeLessThan(lm.guardBottom);
    // 부품 span 합 = 1
    const total = spans.blade + spans.guard + spans.grip + spans.pommel;
    expect(total).toBeCloseTo(1, 10);
    // 물리 비율 확인: blade 0.95m / 전체 (0.95 + 0.02 + 0.14 + 폼멜 0.06)
    expect(spans.blade).toBeCloseTo(0.95 / (0.95 + 0.02 + 0.14 + 0.06), 6);
  });

  it("합성 참조(자기 자신)에 대한 손실이 0 에 수렴한다", () => {
    const design = defaultDesign();
    const target = synthesizeTargetSpec(design);
    const m = evaluateSilhouette(target, design);
    expect(m.iou).toBe(1);
    expect(m.landmarkError).toBeCloseTo(0, 10);
    expect(m.proportionError).toBeCloseTo(0, 10);
    expect(m.aggregateLoss).toBeCloseTo(0, 10);
  });

  it("aggregateLoss 가중치 공식이 유지된다", () => {
    const design = defaultDesign();
    const other = structuredClone(SWORD_PARAMS);
    other.grip.length = 0.25;
    const target = synthesizeTargetSpec(makeSwordDesign(other));
    const m = evaluateSilhouette(target, design);
    const expected = LOSS_WEIGHTS.iou * (1 - m.iou)
      + LOSS_WEIGHTS.landmark * m.landmarkError
      + LOSS_WEIGHTS.proportion * m.proportionError;
    expect(m.aggregateLoss).toBeCloseTo(expected, 12);
  });

  it("1 회 평가가 성능 예산 안이다 (목표 20ms — CI 여유 100ms)", () => {
    const params = structuredClone(SWORD_PARAMS);
    params.blade.segLong = 24; // 최적화 평가 경로와 같은 세그먼트
    const design = makeSwordDesign(params);
    const target = synthesizeTargetSpec(defaultDesign());
    evaluateSilhouette(target, design); // 워밍업 (JIT)
    const t0 = performance.now();
    const runs = 10;
    for (let i = 0; i < runs; i++) evaluateSilhouette(target, design);
    const avg = (performance.now() - t0) / runs;
    expect(avg).toBeLessThan(100);
  });
});

describe("평가 리포트 (07-phase5 §5.5, 원본 §27)", () => {
  it("기본 검은 하드 컨스트레인트를 통과한다", () => {
    const design = defaultDesign();
    const target = synthesizeTargetSpec(design);
    const report = evaluateSwordQuality(design, { targetSpec: target });
    expect(report.silhouetteIoU).toBe(1);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.uvOverlaps).toBe(0);
    expect(report.triangleCount).toBeLessThanOrEqual(15000);
    expect(report.seamVisibility).toBe(0); // MVP 유예 값
    expect(() => assertBuildQuality(report)).not.toThrow();
  });

  it("컨스트레인트 위반 리포트는 차단된다", () => {
    const good = evaluateSwordQuality(defaultDesign());
    expect(() => assertBuildQuality({ ...good, uvOverlaps: 1 })).toThrow(/UV overlap/);
    expect(() => assertBuildQuality({ ...good, nonManifoldEdges: 2 })).toThrow(/Non-manifold/);
    expect(() => assertBuildQuality({ ...good, triangleCount: 15001 })).toThrow(/budget/);
    expect(() => assertBuildQuality({ ...good, seamVisibility: 0.1 })).toThrow(/seams/);
  });
});
