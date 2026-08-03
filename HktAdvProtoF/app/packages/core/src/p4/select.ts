// P4-c 점수·선택·관성 — 편 것 중 하나를 고르고, 다음 틱에 쉽게 놓지 않는다.
//
// 여기서 값이 하나로 접힌다. 접는 일은 근거를 잃기 쉬우므로 규칙을 셋만 둔다.
//
//   ① **점수는 요소에서 재계산된다.** `score = Σ(값 × 무게) ÷ Σ무게` 하나뿐이고,
//      손으로 고쳐 넣은 점수는 `score-drift` 로 걸린다. 왜 뽑혔는지는 언제나 아홉 줄로 펴진다.
//   ② **선행이 선 것만 지금 고를 수 있다.** 관측 선행(P3)이 걸렸거나 재료 선행(P4-a)이
//      막혔으면 후보이되 `ready` 가 아니다 — 그 자리에서 **선행 자체가 후보로 서 있으므로**
//      고르는 일이 저절로 앞칸으로 옮겨 간다. 굶주림이 위기인데도 찾기가 뽑히는 것이 그것이다.
//   ③ **관성은 갈아타기 문턱이지 점수가 아니다.** 이전 목적을 밀어내려면 문턱을 넘어야 한다.
//      문턱은 자라지 않는다 — 자라는 몫은 매몰비용 요소가 이미 맡았다(P4-b). 같은 재료를
//      두 번 세면 한 번 고른 목적을 영영 놓지 못한다.
//
// 관성이 즉시 풀리는 자리는 둘이고, 둘 다 세계가 정한다: 그 결핍이 사라졌거나(갈래가 서지
// 않는다 = 채워졌다), 그 길이 닫혔거나(결핍은 남았는데 그 가능성이 서지 않는다).

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Possibility } from '../o1/index.ts';
import { atomLabel, type ActionAtom } from '../p0/index.ts';
import { directionLabel, type StrategyDirection } from '../p1/index.ts';
import {
  factorsOf,
  checkFactors,
  FACTOR_LABELS,
  type CandidateFactors,
  type FactorSpec,
  type GoalFactor,
  type GoalHistory,
} from './factor.ts';
import { violateGoal, type GoalViolation } from './violation.ts';

/**
 * 갈아타기 문턱 — 이전 목적을 밀어내려면 점수가 이만큼 더 높아야 한다.
 *
 * 자라지 않는다. 자라는 몫은 매몰비용 요소(P4-b)가 맡는다 — 문턱까지 함께 자라면
 * 같은 재료를 두 번 세게 되고, 한 번 고른 목적을 영영 놓지 못한다 (결정론 상수).
 */
export const INERTIA_MARGIN = 0.15;

/** 목적이 바뀌거나 지켜진 사유. */
export const GOAL_CHANGES = [
  'first', // 처음 고른다 — 밀어낼 것이 없다
  'kept', // 지켰다 — 새 후보가 문턱을 넘지 못했다
  'outscored', // 밀려났다 — 새 후보가 문턱을 넘었다
  'fulfilled', // 그 결핍이 사라졌다 — 갈래가 더는 서지 않는다
  'gone', // 그 길이 닫혔다 — 결핍은 남았는데 그 가능성이 서지 않는다
  'none', // 지금 고를 수 있는 것이 없다
] as const;
export type GoalChange = (typeof GOAL_CHANGES)[number];

/** 사유의 한국어 이름. */
export const CHANGE_LABELS: Readonly<Record<GoalChange, string>> = {
  first: '처음',
  kept: '지킴',
  outscored: '밀려남',
  fulfilled: '채워짐',
  gone: '길이 닫힘',
  none: '없음',
};

/** 후보 하나의 점수 — 요소 아홉을 접은 값과, 왜 그 값인가. */
export interface GoalScore {
  readonly possibilityId: Id;
  readonly nodeId: Id;
  readonly label: string;
  readonly direction: StrategyDirection;
  readonly viaAtom: ActionAtom | null;
  readonly factors: readonly GoalFactor[];
  /** −1~1 */
  readonly score: number;
  /** 지금 고를 수 있는가 — 선행이 서지 않았으면 후보이되 아직이다 */
  readonly ready: boolean;
  /** 먼저 서야 할 가능성 (관측 선행 — P3 이 걸었다) */
  readonly blockedBy: readonly Id[];
  /** 먼저 내야 할 원자 (재료 선행 — P4-a 가 걸었다) */
  readonly awaits: readonly ActionAtom[];
  readonly note: string;
}

/** 지금 좇는 목적 하나. 고른 목적은 그 가능성 자체다 — 새 타입을 만들지 않는다. */
export interface ActiveGoal extends GoalHistory {
  readonly subjectId: Id;
  readonly tick: Tick;
  readonly nodeId: Id;
  readonly label: string;
  readonly direction: StrategyDirection;
  readonly viaAtom: ActionAtom | null;
  readonly score: number;
  /** 이번 틱에 이 목적을 지키는 데 쓰인 문턱. 처음 고르는 것이면 0 */
  readonly commitmentInertia: number;
  readonly heldTicks: number;
  readonly changed: boolean;
  readonly change: GoalChange;
  readonly note: string;
}

/** 고르는 데 필요한 재료 — 요소를 세울 재료에 이전 목적을 얹은 것. */
export interface SelectSpec extends FactorSpec {
  readonly previousGoal?: ActiveGoal | null;
}

/** 한 틱의 선택 — 후보 전부의 점수와 그중 하나. */
export interface GoalSelection {
  readonly subjectId: Id;
  readonly tick: Tick;
  /** 점수 내림차순. 같으면 id 순 (결정성) */
  readonly scores: readonly GoalScore[];
  readonly goal: ActiveGoal | null;
  /** 지금 고를 수 있는 것 중 1위 */
  readonly best: GoalScore | null;
  /** 압력이 가장 높은 후보 — 1위와 다를 수 있다 */
  readonly mostPressing: GoalScore | null;
  /** 1위가 이전 목적을 넘어선 폭. 이전 목적이 없으면 0 */
  readonly margin: number;
  readonly violations: readonly GoalViolation[];
  readonly complete: boolean;
}

/** 무게의 총합 — 점수를 −1~1 로 접는 나눗셈의 분모다. */
export function totalWeight(factors: readonly GoalFactor[]): number {
  return factors.reduce((sum, factor) => sum + Math.abs(factor.weight), 0);
}

/** 요소 아홉을 한 값으로 접는다. 이 식이 유일한 점수 공식이다. */
export function scoreOf(factors: readonly GoalFactor[]): number {
  const weight = totalWeight(factors);
  if (weight === 0) return 0;
  const sum = factors.reduce((total, factor) => total + factor.contribution, 0);
  return sum / weight;
}

/** 후보 하나를 점수로 접는다. */
export function scoreCandidate(candidate: CandidateFactors, preconditionIds: readonly Id[]): GoalScore {
  const awaits = candidate.payment?.verdict === 'blocked' ? candidate.payment.blockedBy : [];
  const ready = preconditionIds.length === 0 && awaits.length === 0;
  const note = ready
    ? `지금 낼 수 있다 — ${candidate.viaAtom === null ? '낼 원자 없음' : atomLabel(candidate.viaAtom)}`
    : preconditionIds.length > 0
      ? `먼저 서야 할 갈래가 있다 (${String(preconditionIds.length)}칸)`
      : `먼저 ${awaits.map(atomLabel).join('·')} 를 내야 한다 — 치를 것이 없다`;
  return {
    possibilityId: candidate.possibilityId,
    nodeId: candidate.nodeId,
    label: candidate.label,
    direction: candidate.direction,
    viaAtom: candidate.viaAtom,
    factors: candidate.factors,
    score: scoreOf(candidate.factors),
    ready,
    blockedBy: preconditionIds,
    awaits,
    note,
  };
}

/** 점수 내림차순, 같으면 id 순 — 같은 세계면 언제나 같은 줄이다. */
function rank(scores: readonly GoalScore[]): readonly GoalScore[] {
  return stableSort([...scores], (a, b) =>
    a.score === b.score ? compareStrings(a.possibilityId, b.possibilityId) : b.score - a.score,
  );
}

/** 요소 중 압력 하나만 꺼내 본다 — "가장 급한 것" 을 따로 세기 위해서다. */
function pressureOf(score: GoalScore): number {
  return score.factors.find((factor) => factor.id === 'pressure')?.value ?? 0;
}

/**
 * 편 것 중 하나를 고른다. 던지지 않는다 — 고를 것이 없으면 목적도 없다.
 */
export function selectGoal(
  candidates: readonly Possibility[],
  spec: SelectSpec,
): GoalSelection {
  const violations: GoalViolation[] = [];
  const scores: GoalScore[] = [];
  for (const candidate of candidates) {
    const factors = factorsOf(candidate, spec);
    violations.push(...factors.violations, ...checkFactors(factors));
    scores.push(scoreCandidate(factors, candidate.preconditionIds));
  }
  const ranked = rank(scores);
  const ready = ranked.filter((score) => score.ready);
  const best = ready[0] ?? null;
  // 가장 급한 후보는 따로 센다 — 1위와 다를 수 있고, 다른 것이 이 계층의 요점이다.
  const mostPressing = ranked.reduce<GoalScore | null>(
    (most, score) => (most === null || pressureOf(score) > pressureOf(most) ? score : most),
    null,
  );

  const previous = spec.previousGoal ?? null;
  const held = previous === null ? null : (ranked.find((score) => score.possibilityId === previous.possibilityId) ?? null);
  const branchStands = previous !== null && spec.tree.branches.some((branch) => branch.nodeId === previous.nodeId);

  const selection = decide({
    spec,
    previous,
    held,
    best,
    branchStands,
  });

  const result: GoalSelection = {
    subjectId: spec.subject.id,
    tick: spec.tick,
    scores: ranked,
    goal: selection.goal,
    best,
    mostPressing,
    margin: selection.margin,
    violations,
    complete: false,
  };

  // 마지막 관문 — 고른 목적이 실제로 서 있는가. 조립이 옳으면 여기서 아무것도 나오지 않는다.
  // 그래도 둔다: 손으로 고쳐 넣은 목적도 같은 문을 지나야 한다 (P3-c 가 선행에 문을 둔 것과 같다).
  const checked = checkSelection(result);
  const merged = [...violations, ...checked];
  return { ...result, violations: merged, complete: merged.length === 0 };
}

interface DecideSpec {
  readonly spec: SelectSpec;
  readonly previous: ActiveGoal | null;
  readonly held: GoalScore | null;
  readonly best: GoalScore | null;
  readonly branchStands: boolean;
}

/** 관성이 걸린 자리 — 지킬 것인가 갈아탈 것인가. */
function decide(input: DecideSpec): { readonly goal: ActiveGoal | null; readonly margin: number } {
  const { spec, previous, held, best, branchStands } = input;
  const tick = spec.tick;
  const subjectId = spec.subject.id;

  const goalOf = (
    score: GoalScore,
    sinceTick: Tick,
    inertia: number,
    change: GoalChange,
    note: string,
  ): ActiveGoal => ({
    subjectId,
    tick,
    possibilityId: score.possibilityId,
    nodeId: score.nodeId,
    label: score.label,
    direction: score.direction,
    viaAtom: score.viaAtom,
    score: score.score,
    commitmentInertia: inertia,
    sinceTick,
    heldTicks: Math.max(0, tick - sinceTick),
    changed: change !== 'kept',
    change,
    note,
  });

  if (best === null) {
    return { goal: null, margin: 0 };
  }
  if (previous === null) {
    return {
      goal: goalOf(best, tick, 0, 'first', `${directionLabel(best.direction)} 를 처음 고른다 — 밀어낼 것이 없다`),
      margin: 0,
    };
  }
  // 이전 목적이 후보로 서 있지 않다 — 관성은 없는 것을 붙들지 못한다.
  if (held === null || !held.ready) {
    const change: GoalChange = branchStands ? 'gone' : 'fulfilled';
    return {
      goal: goalOf(
        best,
        tick,
        0,
        change,
        change === 'fulfilled'
          ? `${previous.label} 이 더는 결핍이 아니다 — 관성이 붙들 자리가 없다`
          : `${previous.label} 의 ${directionLabel(previous.direction)} 가 지금은 서지 않는다 — 관성이 붙들 자리가 없다`,
      ),
      margin: 0,
    };
  }
  const margin = best.score - held.score;
  if (best.possibilityId === held.possibilityId) {
    return {
      goal: goalOf(
        held,
        previous.sinceTick,
        INERTIA_MARGIN,
        'kept',
        `${directionLabel(held.direction)} 를 그대로 좇는다 — 여전히 1위다`,
      ),
      margin: 0,
    };
  }
  if (margin > INERTIA_MARGIN) {
    return {
      goal: goalOf(
        best,
        tick,
        INERTIA_MARGIN,
        'outscored',
        `${directionLabel(best.direction)} 가 문턱 ${INERTIA_MARGIN.toFixed(2)} 를 넘었다 (차이 ${margin.toFixed(3)})`,
      ),
      margin,
    };
  }
  return {
    goal: goalOf(
      held,
      previous.sinceTick,
      INERTIA_MARGIN,
      'kept',
      `${directionLabel(best.direction)} 가 앞섰지만 차이 ${margin.toFixed(3)} 가 문턱 ${INERTIA_MARGIN.toFixed(2)} 를 넘지 못했다`,
    ),
    margin,
  };
}

/** 고른 목적이 성립하는가 — 값 하나를 통째로 검사한다. */
export function checkSelection(selection: GoalSelection): readonly GoalViolation[] {
  const violations: GoalViolation[] = [];

  for (const [index, score] of selection.scores.entries()) {
    const recomputed = scoreOf(score.factors);
    if (Math.abs(recomputed - score.score) > 1e-9) {
      violateGoal(
        violations,
        score.possibilityId,
        'score-drift',
        `$.scores[${String(index)}].score`,
        `점수 ${score.score.toFixed(4)} 가 요소 아홉에서 다시 나오지 않는다 (${recomputed.toFixed(4)}) — 손으로 적은 점수는 근거가 아니다`,
      );
    }
  }

  const goal = selection.goal;
  if (goal === null) return violations;

  const standing = selection.scores.find((score) => score.possibilityId === goal.possibilityId);
  if (standing === undefined) {
    violateGoal(
      violations,
      goal.possibilityId,
      'unheld-goal',
      '$.goal.possibilityId',
      `${goal.possibilityId} 는 후보에 없다 — 놓이지 않은 길을 좇을 수는 없다`,
    );
    return violations;
  }
  if (!standing.ready) {
    violateGoal(
      violations,
      goal.possibilityId,
      'premature-goal',
      '$.goal',
      `${standing.label} 의 ${directionLabel(standing.direction)} 는 선행이 서지 않았다 — ${
        standing.blockedBy.length > 0
          ? `먼저 서야 할 갈래가 ${String(standing.blockedBy.length)}칸 있다`
          : `먼저 ${standing.awaits.map(atomLabel).join('·')} 를 내야 한다`
      }`,
    );
  }
  if (Math.abs(standing.score - goal.score) > 1e-9) {
    violateGoal(
      violations,
      goal.possibilityId,
      'score-drift',
      '$.goal.score',
      `고른 목적의 점수 ${goal.score.toFixed(4)} 가 후보표의 ${standing.score.toFixed(4)} 와 다르다`,
    );
  }
  if (goal.change === 'first' && goal.commitmentInertia !== 0) {
    violateGoal(
      violations,
      goal.possibilityId,
      'inertia-without-history',
      '$.goal.commitmentInertia',
      `처음 고르는 목적에 관성 ${goal.commitmentInertia.toFixed(2)} 가 붙었다 — 밀어낼 것이 없는데 문턱이 있을 수 없다`,
    );
  }
  if (goal.heldTicks < 0 || goal.sinceTick > goal.tick) {
    violateGoal(
      violations,
      goal.possibilityId,
      'inertia-without-history',
      '$.goal.sinceTick',
      `아직 오지 않은 시각(${String(goal.sinceTick)})부터 좇고 있다고 한다`,
    );
  }
  return violations;
}

/** 선택 하나를 한 줄로 접는다 — 터미널·배지용. */
export function selectionVerdict(selection: GoalSelection): string {
  if (!selection.complete) {
    const rules = [...new Set(selection.violations.map((violation) => violation.rule))];
    return `목적이 설 수 없다 — ${rules.join(', ')}`;
  }
  if (selection.goal === null) {
    return `후보 ${String(selection.scores.length)} 중 지금 고를 수 있는 것이 없다`;
  }
  const goal = selection.goal;
  return `${goal.label} — ${directionLabel(goal.direction)} (점수 ${goal.score.toFixed(3)} · ${CHANGE_LABELS[goal.change]}${
    goal.heldTicks > 0 ? ` · ${String(goal.heldTicks)}틱째` : ''
  })`;
}

/** 화면·터미널이 함께 쓰는 요약 줄 — 왜 그것이 뽑혔는가. */
export function selectionSummary(selection: GoalSelection): readonly string[] {
  const goal = selection.goal;
  if (goal === null) return ['고를 수 있는 후보가 없다'];
  const standing = selection.scores.find((score) => score.possibilityId === goal.possibilityId);
  return (standing?.factors ?? []).map(
    (factor) =>
      `${FACTOR_LABELS[factor.id]}: ${factor.value.toFixed(2)} × ${factor.weight.toFixed(1)} = ${factor.contribution.toFixed(3)}`,
  );
}
