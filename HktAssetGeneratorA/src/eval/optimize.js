// 수치 최적화 — Nelder-Mead + 재시작 (07-phase5 §5.4, 원본 §26 의 랜덤 루프 대체).
// 결정성: 초기 심플렉스 jitter·재시작 섭동은 deriveSeed(seed,"optimize") 스트림 —
// 같은 참조 + 같은 seed → 같은 결과 (02-architecture §5-2).
// 제너레이터로 구현해 UI 가 진행(반복별 IoU)을 그리고 언제든 중단할 수 있다.

import { mulberry32, deriveSeed } from "../core/rng.js";
import { clamp01 } from "../core/math.js";
import { makeSwordDesign } from "../mesh/sword.js";
import { inputToVector, vectorToInput } from "./paramspace.js";
import { evaluateSilhouette } from "./silhouette.js";

/** 최적화 기본값 — 튜닝 노브 (07-phase5 §5.4: IoU ≥ 0.92 또는 200 평가 종료) */
export const OPTIMIZE_DEFAULTS = {
  maxEvals: 200,
  targetIoU: 0.92,
  restarts: 2, // 수렴 시 최고점 주변 재시작 횟수
  simplexStep: 0.15, // 초기 심플렉스 변 길이 (정규화 공간)
  restartStep: 0.08, // 재시작 섭동 크기
  evalSegLong: 24, // 평가용 칼날 길이 세그먼트 상한 (< 20ms 예산 — 최종 설계는 원 세그먼트)
  comboEvals: 24, // 전수 탐색의 조합별 짧은 최적화 예산
  seed: 12345,
};

/** 이산 선택 전수 시도 축 (07-phase5 §5.4 — 4×3×4 = 48 조합, AI 대체는 Phase 6) */
export const DISCRETE_CHOICES = {
  crossSection: ["flat", "diamond", "lenticular", "hexagonal"],
  tipType: ["needle", "spear", "rounded"],
  guardShape: ["bar", "tapered", "oval", "diamond"],
};

/** 단면별 기본 능선 돌출 — 이산 선택 시 함께 정해지는 종속값 */
const RIDGE_BY_CROSS_SECTION = { flat: 0, diamond: 0.5, lenticular: 0, hexagonal: 0.3 };

/** 평가기 — 벡터 → 손실. 평가 수·최고점을 state 에 누적한다. */
function makeEvaluator(targetSpec, baseInput, opts, state) {
  return (x) => {
    const input = vectorToInput(baseInput, x);
    input.blade.segLong = Math.min(input.blade.segLong, opts.evalSegLong);
    const m = evaluateSilhouette(targetSpec, makeSwordDesign(input));
    state.evals++;
    const point = {
      x: x.slice(), loss: m.aggregateLoss, iou: m.iou,
      landmarkError: m.landmarkError, proportionError: m.proportionError,
    };
    if (!state.best || point.loss < state.best.loss) state.best = point;
    return point;
  };
}

const shouldStop = (state, opts) =>
  state.evals >= opts.maxEvals || (state.best && state.best.iou >= opts.targetIoU);

/**
 * Nelder-Mead 1회 실행 (정규화 [0,1] 공간, 클램프). 반복마다 진행을 yield.
 * 반사 α=1, 확장 γ=2, 수축 ρ=0.5, 축소 σ=0.5 — 표준 계수.
 */
function* nelderMeadRun(evaluate, x0, runBudget, state, opts, rng, phase) {
  const n = x0.length;
  const startEvals = state.evals;
  const budgetLeft = () => runBudget - (state.evals - startEvals);
  const progress = () => ({ phase, evals: state.evals, best: state.best });

  // 초기 심플렉스: x0 + step·e_i (+ 소폭 jitter — 결정적 rng 스트림)
  const simplex = [evaluate(x0)];
  for (let i = 0; i < n; i++) {
    if (budgetLeft() <= 0 || shouldStop(state, opts)) { yield progress(); return; }
    const x = x0.slice();
    const jitter = (rng() - 0.5) * 0.04;
    x[i] = clamp01(x[i] + (x[i] > 0.5 ? -1 : 1) * opts.simplexStep + jitter);
    simplex.push(evaluate(x));
  }
  simplex.sort((a, b) => a.loss - b.loss);
  yield progress();

  while (budgetLeft() > 0 && !shouldStop(state, opts)) {
    const worst = simplex[n];
    // 최고 n 개의 무게중심
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j] / n;
    }
    const towards = (from, factor) =>
      centroid.map((c, j) => clamp01(c + factor * (c - from[j])));

    const reflected = evaluate(towards(worst.x, 1));
    if (reflected.loss < simplex[0].loss) {
      // 확장 시도
      if (budgetLeft() > 0) {
        const expanded = evaluate(towards(worst.x, 2));
        simplex[n] = expanded.loss < reflected.loss ? expanded : reflected;
      } else {
        simplex[n] = reflected;
      }
    } else if (reflected.loss < simplex[n - 1].loss) {
      simplex[n] = reflected;
    } else {
      // 수축 (바깥/안쪽 중 반사 결과가 나은 쪽 기준)
      const base = reflected.loss < worst.loss ? reflected : worst;
      const contracted = budgetLeft() > 0 ? evaluate(towards(base.x, -0.5)) : base;
      if (contracted.loss < base.loss) {
        simplex[n] = contracted;
      } else {
        // 축소 — 최고점 방향으로 전체 절반 이동
        for (let i = 1; i <= n; i++) {
          if (budgetLeft() <= 0 || shouldStop(state, opts)) break;
          const x = simplex[i].x.map((v, j) => clamp01(simplex[0].x[j] + 0.5 * (v - simplex[0].x[j])));
          simplex[i] = evaluate(x);
        }
      }
    }
    simplex.sort((a, b) => a.loss - b.loss);
    yield progress();
  }
}

/** 최종 결과 — 최고 벡터를 원 세그먼트로 다시 빌드해 정직한 지표를 보고한다. */
function finalizeResult(targetSpec, baseInput, state, discrete = null) {
  const input = vectorToInput(baseInput, state.best.x);
  const design = makeSwordDesign(input);
  const m = evaluateSilhouette(targetSpec, design);
  return {
    input, design, vector: state.best.x.slice(), evals: state.evals, discrete,
    iou: m.iou, landmarkError: m.landmarkError, proportionError: m.proportionError,
    aggregateLoss: m.aggregateLoss, mask: m.mask,
  };
}

/**
 * 연속 파라미터 최적화 (이산 선택은 baseInput 그대로).
 * yield: { phase, evals, best:{x,loss,iou,…} } / return: finalizeResult 결과.
 */
export function* optimizeContinuousSteps(targetSpec, baseInput, options = {}) {
  const opts = { ...OPTIMIZE_DEFAULTS, ...options };
  const rng = mulberry32(deriveSeed(opts.seed, "optimize"));
  const state = { evals: 0, best: null };
  const evaluate = makeEvaluator(targetSpec, baseInput, opts, state);

  // 예산 배분: 본 실행 절반, 재시작이 나머지를 균등 분할
  const mainBudget = opts.restarts > 0 ? Math.ceil(opts.maxEvals / 2) : opts.maxEvals;
  yield* nelderMeadRun(evaluate, inputToVector(baseInput), mainBudget, state, opts, rng, "main");

  for (let r = 0; r < opts.restarts; r++) {
    if (shouldStop(state, opts)) break;
    const restartBudget = Math.ceil((opts.maxEvals - state.evals) / (opts.restarts - r));
    const x0 = state.best.x.map((v) => clamp01(v + (rng() - 0.5) * 2 * opts.restartStep));
    yield* nelderMeadRun(evaluate, x0, restartBudget, state, opts, rng, `restart-${r + 1}`);
  }
  return finalizeResult(targetSpec, baseInput, state);
}

/** 동기 래퍼 — 제너레이터를 끝까지 소진하고 결과만 반환. */
export function optimizeSword(targetSpec, baseInput, options = {}) {
  const it = optimizeContinuousSteps(targetSpec, baseInput, options);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/** 이산 조합 목록 (순서 고정 — 동률이면 앞선 조합 선택 = 결정적) */
export function listDiscreteCombos() {
  const combos = [];
  for (const crossSection of DISCRETE_CHOICES.crossSection) {
    for (const tipType of DISCRETE_CHOICES.tipType) {
      for (const guardShape of DISCRETE_CHOICES.guardShape) {
        combos.push({ crossSection, tipType, guardShape });
      }
    }
  }
  return combos;
}

/** 이산 조합을 SwordInput 에 적용한 복제본 */
export function applyDiscreteCombo(baseInput, combo) {
  const input = structuredClone(baseInput);
  input.blade.crossSection = combo.crossSection;
  input.blade.ridgeHeight = RIDGE_BY_CROSS_SECTION[combo.crossSection];
  input.blade.tipType = combo.tipType;
  input.guard.shape = combo.guardShape;
  return input;
}

/**
 * 전수 탐색: 48 조합 각각에 짧은 최적화 → 최고 조합을 본 예산으로 다듬는다 (07-phase5 §5.4).
 * yield: 조합마다 { phase:"combo", comboIndex, comboTotal, combo, comboIoU, best } +
 *        polish 단계의 연속 진행. return: finalizeResult + discrete(선택 조합).
 */
export function* optimizeExhaustiveSteps(targetSpec, baseInput, options = {}) {
  const opts = { ...OPTIMIZE_DEFAULTS, ...options };
  const combos = listDiscreteCombos();
  let best = null;
  let comboEvalsTotal = 0;

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    const comboInput = applyDiscreteCombo(baseInput, combo);
    const result = optimizeSword(targetSpec, comboInput, {
      ...opts, maxEvals: opts.comboEvals, restarts: 0,
    });
    comboEvalsTotal += result.evals;
    if (!best || result.aggregateLoss < best.result.aggregateLoss) {
      best = { combo, result };
    }
    yield {
      phase: "combo", comboIndex: i + 1, comboTotal: combos.length, combo,
      comboIoU: result.iou, evals: comboEvalsTotal, bestCombo: best.combo,
      best: { x: best.result.vector, loss: best.result.aggregateLoss, iou: best.result.iou },
    };
  }

  // 최고 조합의 최적 벡터에서 출발해 본 예산으로 폴리시.
  // yield 에 bestCombo 를 실어 UI 가 중단 시에도 이산 선택을 복원할 수 있게 한다.
  const it = optimizeContinuousSteps(targetSpec, best.result.input, opts);
  let r = it.next();
  while (!r.done) {
    yield { ...r.value, phase: "polish", bestCombo: best.combo };
    r = it.next();
  }
  const final = r.value;
  final.discrete = best.combo;
  final.evals += comboEvalsTotal; // 조합 시도 + 폴리시 합산
  return final;
}

/** 동기 래퍼 (전수 탐색) */
export function optimizeSwordExhaustive(targetSpec, baseInput, options = {}) {
  const it = optimizeExhaustiveSteps(targetSpec, baseInput, options);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
