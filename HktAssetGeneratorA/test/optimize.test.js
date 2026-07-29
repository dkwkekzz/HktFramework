// Phase 5 검증 — Nelder-Mead 최적화·결정성·라운드트립 (07-phase5 §5.4·§5.5)

import { describe, it, expect } from "vitest";
import { makeSwordDesign } from "../src/mesh/sword.js";
import { inputToVector, vectorToInput, OPT_PARAM_DEFS } from "../src/eval/paramspace.js";
import {
  optimizeSword, optimizeContinuousSteps, optimizeSwordExhaustive, listDiscreteCombos,
  applyDiscreteCombo,
} from "../src/eval/optimize.js";
import { synthesizeTargetSpec, createInitialSwordDesign } from "../src/eval/targetspec.js";
import { evaluateSilhouette } from "../src/eval/silhouette.js";

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

describe("파라미터 벡터 (원본 §26, 07-phase5 §5.4)", () => {
  it("10차원이고 [0,1] 정규화 왕복이 보존된다", () => {
    expect(OPT_PARAM_DEFS.length).toBe(10);
    const base = structuredClone(SWORD_PARAMS);
    const v = inputToVector(base);
    expect(v.every((x) => x >= 0 && x <= 1)).toBe(true);
    const restored = vectorToInput(base, v);
    for (const def of OPT_PARAM_DEFS) {
      expect(def.get(restored)).toBeCloseTo(def.get(base), 10);
    }
  });

  it("벡터 적용은 base 를 변형하지 않는다 (깊은 복제)", () => {
    const base = structuredClone(SWORD_PARAMS);
    const v = inputToVector(base).map(() => 0.5);
    vectorToInput(base, v);
    expect(base.blade.length).toBe(0.95);
  });

  it("이산 조합은 48개, 적용 시 단면·tip·가드가 바뀐다", () => {
    const combos = listDiscreteCombos();
    expect(combos.length).toBe(48);
    const input = applyDiscreteCombo(structuredClone(SWORD_PARAMS), combos[0]);
    expect(input.blade.crossSection).toBe("flat");
    expect(input.blade.ridgeHeight).toBe(0);
    expect(input.guard.shape).toBe("bar");
  });
});

describe("Nelder-Mead 최적화 (07-phase5 §5.4)", () => {
  it("결정성: 같은 참조 + 같은 seed → 같은 결과", () => {
    const target = synthesizeTargetSpec(makeSwordDesign(structuredClone(SWORD_PARAMS)));
    const base = structuredClone(SWORD_PARAMS);
    base.blade.widthRoot = 0.08; // 일부러 어긋난 출발점
    base.grip.length = 0.2;
    const opts = { maxEvals: 40, restarts: 1, seed: 777 };
    const a = optimizeSword(target, base, opts);
    const b = optimizeSword(target, base, opts);
    expect(a.vector).toEqual(b.vector);
    expect(a.iou).toBe(b.iou);
    expect(a.evals).toBe(b.evals);
  });

  it("제너레이터가 진행을 yield 하고 손실이 단조 개선된다", () => {
    const target = synthesizeTargetSpec(makeSwordDesign(structuredClone(SWORD_PARAMS)));
    const base = structuredClone(SWORD_PARAMS);
    base.blade.widthRoot = 0.12; // 크게 어긋난 출발점 — 반복 개선이 반드시 일어난다
    base.blade.widthMid = 0.11;
    base.grip.length = 0.32;
    // targetIoU 를 비활성(>1)으로 두어 조기 종료 없이 반복을 관찰한다
    const it = optimizeContinuousSteps(target, base, { maxEvals: 80, restarts: 0, seed: 1, targetIoU: 2 });
    const losses = [];
    let r = it.next();
    while (!r.done) {
      losses.push(r.value.best.loss);
      r = it.next();
    }
    expect(losses.length).toBeGreaterThan(3);
    for (let i = 1; i < losses.length; i++) {
      expect(losses[i]).toBeLessThanOrEqual(losses[i - 1]); // best 는 단조
    }
    expect(losses.at(-1)).toBeLessThan(losses[0]);
    expect(r.value.input.blade.segLong).toBe(32); // 최종 설계는 원 세그먼트로 복원
  });

  it("라운드트립 자기 일관성: 합성 참조에서 IoU ≥ 0.95 회복 (07-phase5 §5.5)", () => {
    // 진값 — 기본과 다른 형상 (넓은 뿌리, 이른 테이퍼, 긴 손잡이)
    const truth = structuredClone(SWORD_PARAMS);
    truth.blade.widthRoot = 0.065;
    truth.blade.widthMid = 0.055;
    truth.blade.widthTip = 0.038;
    truth.blade.tipStart = 0.7;
    truth.grip.length = 0.18;
    truth.guard.width = 0.22;
    const truthDesign = makeSwordDesign(truth);
    const target = synthesizeTargetSpec(truthDesign);

    // 초기값은 프로파일 읽기 (진값 파라미터를 직접 쓰지 않는다)
    const { input: initial } = createInitialSwordDesign(target, { bladeLength: truth.blade.length });
    // 기본 조기 종료(0.92)보다 높은 목표를 줘야 0.95 회복을 검증할 수 있다
    const result = optimizeSword(target, initial, { maxEvals: 150, targetIoU: 0.96, seed: 4242 });

    expect(result.iou).toBeGreaterThanOrEqual(0.95);
    expect(result.evals).toBeLessThanOrEqual(150);
    // 최종 지표는 원 세그먼트 재평가와 일치
    const recheck = evaluateSilhouette(target, result.design);
    expect(recheck.iou).toBe(result.iou);
  });

  it("전수 탐색이 이산 조합을 선택해 반환한다 (스모크)", () => {
    const target = synthesizeTargetSpec(makeSwordDesign(structuredClone(SWORD_PARAMS)));
    const base = structuredClone(SWORD_PARAMS);
    const result = optimizeSwordExhaustive(target, base, {
      comboEvals: 2, maxEvals: 12, restarts: 0, seed: 9,
    });
    expect(result.discrete).toBeDefined();
    expect(listDiscreteCombos().some((c) =>
      c.crossSection === result.discrete.crossSection
      && c.tipType === result.discrete.tipType
      && c.guardShape === result.discrete.guardShape)).toBe(true);
    expect(result.iou).toBeGreaterThan(0.5);
  });
});
