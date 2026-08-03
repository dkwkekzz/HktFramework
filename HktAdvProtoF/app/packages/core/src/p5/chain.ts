// P5-a 계획 사슬 조립 — 한 걸음처럼 보이던 목적을 몇 걸음으로 편다.
//
// P4 가 낸 목적은 아직 한 걸음이다: "마을과 주고받는다". 그런데 주고받으려면 손에 쥔 것이
// 있어야 하고, 쥐려면 협곡에 들어가야 하고, 들어가려면 어디인지 알아야 한다.
//
// **그 순서를 P5 가 지어내지 않는다.** 이미 두 곳에 적혀 있다.
//
//   P3-a  원자 사이의 먼저 — 관측 선행(대상을 봐야 한다)과 재료 선행(치를 것을 먼저 가져야 한다).
//         세계를 보지 않고도 서는 표이고, P0 걸림에서 계산된 것이다.
//   P4-a  그 재료 선행을 세계와 맞댄 결과 — 지금 비어 있는 자리와 그것을 세우는 원자
//         (`PayabilityReport.blockedBy`). 한 칸짜리 먼저다.
//
// P5 가 하는 일은 그 한 칸을 **더 물을 것이 없을 때까지 되풀이하는 것**뿐이다. 뒤에서 앞으로
// 거슬러 올라가다 지금 바로 낼 수 있는 원자에 닿으면 거기가 첫 걸음이다.
//
// 두 자리를 특히 눈여겨볼 것.
//
//   ① **브레이크 없는 자리는 사슬을 늘리지 않는다.** 몸·의념·빚·정당성은 아무 행동도 세우지
//      못하므로(P3-a 선언) "먼저 할 일" 이 생기지 않는다. 계획을 막지 않고 걸음에 위험 표시로 남는다.
//   ② **한 원자는 사슬에 한 번만 선다.** 찾기가 두 걸음을 위해 필요하면 한 번 서서 둘 다 받는다 —
//      앎은 한 번 세우면 남기 때문이다. 그래서 사슬은 나무가 아니라 순서열로 접힌다.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import {
  ACTION_ATOMS,
  atomGrounding,
  atomLabel,
  slotText,
  type ActionAtom,
} from '../p0/index.ts';
import { directionLabel, type StrategyDirection } from '../p1/index.ts';
import { prerequisitesOf } from '../p3/index.ts';
import type { ExpansionContext } from '../p3/index.ts';
import { payabilityOf, type PaymentSpec, type PaymentVerdict } from '../p4/index.ts';
import { violatePlan, type PlanViolation } from './violation.ts';

/**
 * 사슬이 뻗을 수 있는 최대 깊이.
 *
 * P3-a 가 열여섯을 물결 넷으로 세웠으므로 실제 사슬은 넷을 넘지 않는다. 여유를 두되 상한을
 * 둔다 — 상한이 없으면 걸림이 잘못 적힌 날 계획이 영영 돌아간다 (결정론 상수).
 */
export const MAX_PLAN_DEPTH = 8;

/** 걸음 하나가 왜 거기 있는가. */
export const STEP_REASONS = [
  'goal', // 좇는 목적 그 자체다 — 사슬의 끝
  'observation', // 대상을 먼저 봐야 한다 (P3-a 관측 선행)
  'cost', // 치를 것을 먼저 가져야 한다 (P3-a 재료 선행 × P4-a 세계)
] as const;
export type StepReason = (typeof STEP_REASONS)[number];

/** 사유의 한국어 이름. */
export const REASON_LABELS: Readonly<Record<StepReason, string>> = {
  goal: '목적',
  observation: '봐야 한다',
  cost: '치러야 한다',
};

/** 계획의 걸음 하나 — 아직 일어나지 않은 것이다. */
export interface PlanStep {
  /** 낼 순서. 0 이 첫 걸음이다 */
  readonly order: number;
  readonly atom: ActionAtom;
  readonly label: string;
  readonly reason: StepReason;
  /** 어느 걸음을 위해 서는가 — 목적이면 null */
  readonly forAtom: ActionAtom | null;
  /** 어느 자리를 채우려고 서는가 — 목적이면 null */
  readonly forSlot: string | null;
  /** 지금 이 걸음을 낼 수 있는가 (P4-a) */
  readonly verdict: PaymentVerdict;
  /** 되돌려 줄 행동이 없는 자리를 치르는가 — 사슬을 늘리지 않지만 값으로 남는다 */
  readonly unbrakedSlots: readonly string[];
  readonly note: string;
}

/** 사슬이 닿지 못한 자리. */
export interface PlanDeadEnd {
  readonly atom: ActionAtom;
  readonly slot: string;
  readonly reason: 'no-supplier' | 'cycle' | 'too-deep';
  readonly note: string;
}

/** 목적 하나를 편 계획. */
export interface ActionPlan {
  readonly subjectId: Id;
  readonly goalId: Id;
  readonly label: string;
  readonly direction: StrategyDirection;
  /** 낼 순서대로. 마지막이 목적이다 */
  readonly steps: readonly PlanStep[];
  /** 걸음의 원자만 뽑은 순서열 */
  readonly atoms: readonly ActionAtom[];
  readonly deadEnds: readonly PlanDeadEnd[];
  /** 사슬이 몇 칸인가 */
  readonly depth: number;
  readonly violations: readonly PlanViolation[];
  /** 막힌 자리 없이 목적까지 닿는가 */
  readonly complete: boolean;
}

/**
 * 무엇을 펼 것인가.
 *
 * `ActiveGoal`(P4 가 고른 것)도 `GoalScore`(P4 가 미뤄 둔 후보)도 이 모양을 만족한다.
 * **미뤄 둔 것을 펴는 쪽이 이 계층의 요점이다** — P4 는 한 칸만 보고 "지금은 못 고른다" 고 했고,
 * P5 는 그 한 칸을 사슬로 편다. 그래야 원문이 일곱 줄로 적은 사슬이 나온다.
 */
export interface PlanTarget {
  readonly possibilityId: Id;
  readonly label: string;
  readonly direction: StrategyDirection;
  readonly viaAtom: ActionAtom | null;
}

/** 계획을 세울 재료. */
export interface PlanSpec {
  /** 누가 내는가 */
  readonly actorId: Id;
  readonly goal: PlanTarget;
  readonly world: PaymentSpec['world'];
  readonly context: ExpansionContext;
  /**
   * 목적이 가리키는 대상. 지금 보고 있으면 관측 선행이 걸리지 않는다.
   *
   * 걸음마다 다른 대상을 보는지는 이 계층이 묻지 않는다 — 관측은 아직 문법 층이고,
   * 실행 층은 R3 이 갚는다 (P3 이 남긴 자리 그대로).
   */
  readonly targetId?: Id | null;
  readonly schema?: PaymentSpec['schema'];
}

/** 그 원자가 지금 관측 선행에 걸리는가 — 대상을 보고 있으면 걸리지 않는다. */
function needsObservation(atom: ActionAtom, spec: PlanSpec): boolean {
  const grounding = atomGrounding(atom);
  if (grounding === null || !grounding.requiresObservation) return false;
  const target = spec.targetId ?? null;
  if (target === null) return true; // 무엇을 두고 하는 말인지 모르면 먼저 봐야 한다
  return !spec.context.seen.includes(target);
}

/** 요구 하나 — 무엇 때문에 먼저가 필요하고, 무엇이 그것을 세우는가. */
interface Need {
  readonly reason: Exclude<StepReason, 'goal'>;
  readonly slot: string;
  readonly satisfiedBy: readonly ActionAtom[];
}

/** 이 원자가 지금 걸려 있는 요구들 — 관측 하나 + 재료 여럿. */
function needsOf(atom: ActionAtom, spec: PlanSpec): {
  readonly needs: readonly Need[];
  readonly verdict: PaymentVerdict;
  readonly unbraked: readonly string[];
} {
  const payment = payabilityOf(atom, {
    actorId: spec.actorId,
    world: spec.world,
    ...(spec.schema === undefined ? {} : { schema: spec.schema }),
  });
  const needs: Need[] = [];

  if (needsObservation(atom, spec)) {
    const requirement = prerequisitesOf(atom).find((entry) => entry.route === 'observation');
    if (requirement !== undefined) {
      needs.push({
        reason: 'observation',
        slot: slotText(requirement.slot),
        satisfiedBy: requirement.satisfiedBy,
      });
    }
  }
  // 브레이크 없는 자리는 요구가 되지 않는다 — 늘릴 원자가 없기 때문이다.
  for (const requirement of payment.requirements) {
    if (requirement.verdict !== 'blocked') continue;
    needs.push({
      reason: 'cost',
      slot: slotText(requirement.slot),
      satisfiedBy: requirement.satisfiedBy,
    });
  }
  return { needs, verdict: payment.verdict, unbraked: payment.unbrakedSlots };
}

/**
 * 요구 하나를 채울 원자를 고른다.
 *
 * 이미 사슬에 선 것이 있으면 그것을 쓰고(한 원자는 한 번만 선다), 없으면 **지금 바로 낼 수
 * 있는 것**을 앞세운다 — 사슬을 짧게 만드는 쪽이다. 같으면 원자 순서를 따른다(결정성).
 */
function chooseSupplier(
  need: Need,
  spec: PlanSpec,
  scheduled: ReadonlySet<ActionAtom>,
  stack: readonly ActionAtom[],
): ActionAtom | null {
  const candidates = need.satisfiedBy.filter((atom) => !stack.includes(atom));
  if (candidates.length === 0) return null;

  const standing = candidates.find((atom) => scheduled.has(atom));
  if (standing !== undefined) return standing;

  const ordered = stableSort([...candidates], (a, b) =>
    compareStrings(String(ACTION_ATOMS.indexOf(a)), String(ACTION_ATOMS.indexOf(b))),
  );
  const ready = ordered.find((atom) => needsOf(atom, spec).needs.length === 0);
  return ready ?? ordered[0] ?? null;
}

/** 목적 하나를 사슬로 편다. 던지지 않는다 — 닿지 못한 자리는 값으로 남는다. */
export function buildPlan(spec: PlanSpec): ActionPlan {
  const violations: PlanViolation[] = [];
  const deadEnds: PlanDeadEnd[] = [];
  const steps: PlanStep[] = [];
  const scheduled = new Map<ActionAtom, PlanStep>();
  let deepest = 0;

  const goalAtom = spec.goal.viaAtom;
  if (goalAtom === null) {
    violatePlan(
      violations,
      '',
      'goalless-plan',
      '$.goal.viaAtom',
      `${spec.goal.label} 을 낼 원자가 없다 — 무엇을 하겠다는 것인지 물을 자리가 없다`,
    );
  }

  function place(
    atom: ActionAtom,
    reason: StepReason,
    forAtom: ActionAtom | null,
    forSlot: string | null,
    depth: number,
    stack: readonly ActionAtom[],
  ): PlanStep | null {
    const standing = scheduled.get(atom);
    if (standing !== undefined) return standing;
    if (depth > MAX_PLAN_DEPTH) {
      deadEnds.push({
        atom,
        slot: forSlot ?? '',
        reason: 'too-deep',
        note: `${atomLabel(atom)} 까지 사슬이 ${String(depth)} 칸이 됐다 — 상한 ${String(MAX_PLAN_DEPTH)} 를 넘는다`,
      });
      return null;
    }
    deepest = Math.max(deepest, depth);

    const { needs, verdict, unbraked } = needsOf(atom, spec);
    for (const need of needs) {
      const supplier = chooseSupplier(need, spec, new Set(scheduled.keys()), [...stack, atom]);
      if (supplier === null) {
        deadEnds.push({
          atom,
          slot: need.slot,
          reason: need.satisfiedBy.length === 0 ? 'no-supplier' : 'cycle',
          note:
            need.satisfiedBy.length === 0
              ? `${atomLabel(atom)} 가 ${need.slot} 를 요구하는데 그 자리를 세우는 원자가 없다`
              : `${atomLabel(atom)} 가 ${need.slot} 를 요구하는데 세울 수 있는 것이 전부 이 사슬 위에 있다 — 자기를 딛고 설 수는 없다`,
        });
        continue;
      }
      place(supplier, need.reason, atom, need.slot, depth + 1, [...stack, atom]);
    }

    const step: PlanStep = {
      order: steps.length,
      atom,
      label: atomLabel(atom),
      reason,
      forAtom,
      forSlot,
      verdict,
      unbrakedSlots: unbraked,
      note:
        reason === 'goal'
          ? `${directionLabel(spec.goal.direction)} 를 여기서 낸다`
          : reason === 'observation'
            ? `${forAtom === null ? '' : atomLabel(forAtom)} 가 대상을 먼저 봐야 한다 — ${forSlot ?? ''}`
            : `${forAtom === null ? '' : atomLabel(forAtom)} 가 치를 ${forSlot ?? ''} 를 여기서 세운다`,
    };
    steps.push(step);
    scheduled.set(atom, step);
    return step;
  }

  if (goalAtom !== null) place(goalAtom, 'goal', null, null, 0, []);

  const plan: ActionPlan = {
    subjectId: spec.actorId,
    goalId: spec.goal.possibilityId,
    label: spec.goal.label,
    direction: spec.goal.direction,
    steps,
    atoms: steps.map((step) => step.atom),
    deadEnds,
    depth: deepest,
    violations,
    complete: false,
  };

  // 마지막 관문 — 순서가 실제로 서 있는가. 조립이 옳으면 여기서 아무것도 나오지 않는다.
  // 그래도 둔다: 손으로 고쳐 넣은 계획도 같은 문을 지나야 한다 (P3-c·P4-c 와 같은 태도다).
  const checked = checkPlan(plan);
  const merged = [...violations, ...checked];
  return { ...plan, violations: merged, complete: merged.length === 0 && deadEnds.length === 0 };
}

/** 계획 하나가 성립하는가 — 값을 통째로 검사한다. */
export function checkPlan(plan: ActionPlan): readonly PlanViolation[] {
  const violations: PlanViolation[] = [];
  const orderOf = new Map(plan.steps.map((step) => [step.atom, step.order]));

  if (plan.steps.length === 0) {
    return violations; // 걸음이 없는 계획은 goalless-plan 이 이미 말했다
  }
  for (const [index, step] of plan.steps.entries()) {
    const at = `$.steps[${String(index)}]`;
    if (step.order !== index) {
      violatePlan(
        violations,
        step.label,
        'unordered-step',
        `${at}.order`,
        `${step.label} 이 ${String(index)} 번째에 놓였는데 스스로는 ${String(step.order)} 번째라고 한다 — 순서열은 적힌 대로 서야 한다`,
      );
    }
    if (step.forAtom === step.atom) {
      violatePlan(
        violations,
        step.label,
        'self-standing-step',
        `${at}.forAtom`,
        `${step.label} 이 자기 자신을 위해 선다 — 먼저 서야 할 것이 자기라면 아무것도 서지 못한다`,
      );
      continue;
    }
    if (step.reason === 'goal') continue;
    if (step.forAtom === null) {
      violatePlan(
        violations,
        step.label,
        'orphan-step',
        `${at}.forAtom`,
        `${step.label} 이 무엇을 위해 서는지 말하지 못한다 — 목적이 아닌 걸음은 반드시 뒷걸음을 받친다`,
      );
      continue;
    }
    const serves = orderOf.get(step.forAtom);
    if (serves === undefined) {
      violatePlan(
        violations,
        step.label,
        'orphan-step',
        `${at}.forAtom`,
        `${step.label} 이 받치는 ${atomLabel(step.forAtom)} 가 이 계획에 없다`,
      );
      continue;
    }
    if (serves <= step.order) {
      violatePlan(
        violations,
        step.label,
        'unordered-step',
        `${at}.order`,
        `${step.label}(${String(step.order)}) 이 받치는 ${atomLabel(step.forAtom)}(${String(serves)}) 보다 늦게 선다 — 받치는 것은 먼저 서야 한다`,
      );
    }
  }
  if (plan.complete && plan.deadEnds.length > 0) {
    violatePlan(
      violations,
      '',
      'dangling-need',
      '$.deadEnds',
      `닿지 못한 자리가 ${String(plan.deadEnds.length)} 곳 남았는데 계획이 온전하다고 한다`,
    );
  }
  return violations;
}

/** 계획 하나를 한 줄로 접는다 — 터미널·배지용. */
export function planVerdict(plan: ActionPlan): string {
  if (plan.violations.length > 0) {
    const rules = [...new Set(plan.violations.map((violation) => violation.rule))];
    return `계획이 설 수 없다 — ${rules.join(', ')}`;
  }
  const chain = plan.steps.map((step) => step.label).join(' → ');
  if (plan.deadEnds.length > 0) {
    return `${chain} (닿지 못한 자리 ${String(plan.deadEnds.length)})`;
  }
  return `${chain} (${String(plan.steps.length)} 걸음)`;
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function planSummary(plan: ActionPlan): readonly string[] {
  return plan.steps.map(
    (step) =>
      `${String(step.order)}. ${step.label} [${REASON_LABELS[step.reason]}] ${step.note}`,
  );
}
