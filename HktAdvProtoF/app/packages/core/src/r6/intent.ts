// R6-a 의도의 모양과 겨눔 — 계획의 걸음 하나가 요청이 된다.
//
// P5 가 남긴 한 줄을 갚는다: **"계획은 아직 요청이 아니다."** `ActionPlan` 은 낼 순서까지 적힌
// 사슬이지만 일어나지 않은 것이고, 그것을 세계에 내놓는 통로가 없었다.
//
// **여기서 형식을 새로 만들지 않는다.** P0-c `ActionProposal` 이 원문 §19 `WorldChangeRequest` 를
// 이미 갖고 있고(겨눌 것·바꿀 자리·치를 자리·보고 있는 것), 그것이 설 수 있는지도 P0-c
// `fitAction` 이 이미 판정한다. R6-a 가 하는 일은 셋뿐이다.
//
//   ① **낼 수 있는 첫 걸음을 고른다.** 계획의 걸음은 이미 순서대로 서 있고(P5) 걸음마다
//      "지금 낼 수 있는가" 가 적혀 있다(P4-a `PaymentVerdict`). 고르는 것이지 새로 재지 않는다.
//   ② **그 걸음을 요청서로 옮긴다.** 바꿀 자리와 치를 자리는 **호출자가 준다** — R6 가 고를 근거가
//      없고 골라도 달라지는 것이 없기 때문이다(`IntentSpec.changes` 주석). R6 가 더하는 것은 원자와
//      겨눈 상대이고, 그 요청서는 P0-c `fitAction` 관문을 그대로 지난다.
//   ③ **상대가 필요한 원자인지 묻는다.** P0-b `touches: 'between'` 여섯만 상대를 요구한다 —
//      나머지 열은 자리와 물건을 겨누므로 P5 가 준 대상이 그대로 간다.
//
// **의도는 아직 세계가 아니다.** 여기서 나오는 것은 제출까지이고, 그것을 사건으로 세우는 것은
// R1 이다 — 그래서 R6 는 세계를 쓰지 않는다(`writes: []`). 그 대신 고리가 여기서 닫힌다:
// 의도 → 사건(R1) → 흔적(R2) → 지각(R3) → 믿음(R4) → 기억·사이(R5) → **다시 의도**.

import { deterministicId, type Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { classify } from '../o1/index.ts';
import type { StateDomain } from '../o2/index.ts';
import {
  ACTION_ATOMS,
  atomGrounding,
  atomLabel,
  fitAction,
  type ActionAtom,
  type ActionProposal,
  type AtomGrounding,
  type ChangeRef,
} from '../p0/index.ts';
import type { PossibilityGrammar } from '../p2/index.ts';
import type { ActiveGoal } from '../p4/index.ts';
import type { ActionPlan, PlanStep } from '../p5/index.ts';
import { violateIntent, type IntentViolation } from './violation.ts';

/**
 * 상대를 겨누는 원자 — **P0-b 가 `touches: 'between'` 으로 이미 갈라 두었다.**
 *
 * 여섯이고, 동의 축이 그 여섯을 셋씩 나눈다(주고받기·설득·동맹 / 빼앗기·협박·배신).
 * R6 는 그 목록을 만들지 않고 걸림에서 읽어 온다 — 원자가 늘거나 걸림이 바뀌면 여기가 따라 움직인다.
 */
export function aimingAtoms(
  groundings: readonly AtomGrounding[] = [],
): readonly ActionAtom[] {
  const table = groundings.length > 0 ? groundings : null;
  return ACTION_ATOMS.filter((atom) => {
    const grounding = table === null ? atomGrounding(atom) : table.find((entry) => entry.atom === atom);
    return grounding?.touches === 'between';
  });
}

/** 그 원자가 상대를 요구하는가. */
export function needsCounterpart(atom: ActionAtom): boolean {
  return atomGrounding(atom)?.touches === 'between';
}

/** 등지고 서는가 내밀고 서는가 — P0-b `consent` 그대로다. */
export function consentOf(atom: ActionAtom): 'mutual' | 'against' | 'none' {
  return atomGrounding(atom)?.consent ?? 'none';
}

/** 겨눔 하나 — 누구를, 왜 골랐는가. */
export interface Aim {
  readonly counterpartId: Id;
  /** 어느 축이 골랐는가 (`grudge` · `trust`) */
  readonly axis: string;
  readonly value: number;
  /** 지목에서 왔는가, 세계의 장부에서 왔는가 */
  readonly via: 'attribution' | 'written';
  readonly note: string;
}

/**
 * 낼 행동 하나 — O1 `Affordance` 에 R6 가 여섯을 더한다.
 *
 * `Affordance` 는 "누가 무엇에 무엇을 할 수 있는가" 를 이미 갖고 있고 `action` 은 P0-c 가 16종으로
 * 닫아 두었다. R6 는 겨눈 상대·고른 사유·요청서·어느 목적에서 나왔는가를 더할 뿐이다.
 */
export interface ActionIntent {
  readonly kind: 'Affordance';
  readonly id: Id;
  /** 내는 자 — `Affordance.providerId` 다 */
  readonly providerId: Id;
  readonly action: string;
  readonly requires: readonly string[];
  readonly yields: readonly string[];
  readonly cost: number;
  readonly tick: Tick;
  readonly atom: ActionAtom;
  /** 어느 목적에서 나왔는가 (P4) */
  readonly goalId: Id;
  /** 계획의 몇째 걸음인가 (P5) */
  readonly stepOrder: number;
  /** 겨눈 상대. 상대를 겨누지 않는 원자면 null */
  readonly aim: Aim | null;
  /** 세계에 내는 요청서 (P0-c) — R1 이 이것을 사건으로 세운다 */
  readonly proposal: ActionProposal;
  readonly note: string;
}

/** 의도의 id — 유래(내는 자 · 목적 · 틱)에서 나온다 (V1 결정적 ID). */
export function intentIdOf(actorId: Id, goalId: Id, tick: Tick): Id {
  return deterministicId('affordance', actorId, goalId, String(tick));
}

/**
 * 계획에서 지금 낼 걸음을 고른다 — **새로 재지 않는다.**
 *
 * 걸음은 이미 순서대로 서 있고(P5) 걸음마다 "지금 낼 수 있는가" 가 P4-a 판정으로 적혀 있다.
 * 고르는 규칙은 하나다: **막히지 않은 첫 걸음.** 브레이크가 없는 걸음(`unbraked`)도 낼 수 있다 —
 * 되돌려 줄 행동이 없다는 것은 위험이지 막힘이 아니라고 P4-a 가 이미 갈라 두었다.
 */
export function nextStep(plan: ActionPlan): PlanStep | null {
  return plan.steps.find((step) => step.verdict !== 'blocked') ?? null;
}

/** 자리 하나를 사람이 읽는 한 줄로. */
const slotText = (ref: { readonly domain: StateDomain; readonly path: string }): string =>
  `${ref.domain}.${ref.path}`;

export interface IntentSpec {
  readonly plan: ActionPlan;
  readonly goal: ActiveGoal;
  readonly tick: Tick;
  readonly grammar: PossibilityGrammar;
  /** 상대를 겨누는 원자면 여기에 겨눔이 온다 (R6-b 가 고른다) */
  readonly aim?: Aim | null;
  /** 상대를 겨누지 않는 원자가 겨눌 것 — P5 가 준 대상 그대로 */
  readonly targetIds?: readonly Id[];
  /**
   * 어느 자리를 바꾸고 무엇을 치르겠다는 것인가 — **호출자가 준다.**
   *
   * R6 가 고르지 않는 이유는 하나다: **고를 근거가 없고, 골라도 달라지는 것이 없다.** P0-b 걸림은
   * 원자마다 자리의 **패턴**을 적어 두었지 어느 물건·어느 주장인지는 적지 않았고(`{entity}`·
   * `{claim}`), 사이 자리가 누구의 장부에 서는지도 적지 않았다. 여기서 그것을 지어내면 R6 가
   * 세계의 셈을 새로 정하는 것이 된다 — **얼마나 깎이고 얼마나 차는지의 셈은 E2·G 계층이 갚는다**
   * 는 R1 의 선언이 그대로 여기에도 걸린다. R6 가 더하는 것은 **누구를 겨누는가** 하나다.
   */
  readonly changes?: readonly ChangeRef[];
  readonly payments?: readonly ChangeRef[];
  /** 지금 보고 있는 것 (P0-c 관측 선행) */
  readonly observedIds?: readonly Id[];
}

/** 의도 하나가 선 결과 — 서면 의도가, 서지 못하면 사유가 남는다. */
export interface IntentResult {
  readonly intent: ActionIntent | null;
  readonly step: PlanStep | null;
  readonly violations: readonly IntentViolation[];
}

/**
 * 계획의 걸음 하나를 의도로 세운다.
 *
 * R6 가 더하는 것은 **원자와 겨눈 상대**뿐이고, 바꿀 자리·치를 자리는 호출자가 준다
 * (`IntentSpec.changes` 주석 — 고를 근거가 없고 골라도 달라지는 것이 없다). 그렇게 만든 요청서는
 * P0-c `fitAction` 관문을 그대로 지난다: **여기서 새 문법을 만들지 않았다는 것이 그 관문을
 * 통과하는 것으로 드러난다.**
 */
export function formIntent(spec: IntentSpec): IntentResult {
  const violations: IntentViolation[] = [];
  const { plan, goal, tick, grammar } = spec;
  const actorId = plan.subjectId;

  if (actorId === '') {
    violateIntent(violations, '', 'actorless-intent', '$.plan.subjectId', '내는 자가 없는 계획이다');
    return { intent: null, step: null, violations };
  }

  const step = nextStep(plan);
  if (step === null) {
    violateIntent(
      violations,
      actorId,
      plan.steps.length === 0 ? 'no-step' : 'blocked-step',
      '$.plan.steps',
      plan.steps.length === 0
        ? '낼 걸음이 없는 계획이다 — 빈 계획은 의도가 되지 않는다'
        : '걸음이 전부 막혔다 — 지금 낼 수 있는 것이 하나도 없다',
    );
    return { intent: null, step: null, violations };
  }

  if (!ACTION_ATOMS.includes(step.atom)) {
    violateIntent(violations, actorId, 'unknown-atom', '$.step.atom', `16종 밖의 원자다 — ${step.atom}`);
    return { intent: null, step, violations };
  }

  if (!grammar.allowed.includes(step.atom)) {
    violateIntent(
      violations,
      actorId,
      'ungrammatical-intent',
      '$.step.atom',
      `${atomLabel(step.atom)} 는 이 주체가 낼 수 없는 것이다 — P2 문법이 닫았다`,
    );
    return { intent: null, step, violations };
  }

  if (atomGrounding(step.atom) === null) {
    violateIntent(violations, actorId, 'unknown-atom', '$.step.atom', '걸림이 없는 원자다');
    return { intent: null, step, violations };
  }

  const aim = spec.aim ?? null;
  const aiming = needsCounterpart(step.atom);
  if (aiming && aim === null) {
    violateIntent(
      violations,
      actorId,
      'aimless-intent',
      '$.aim',
      `${atomLabel(step.atom)} 는 상대가 있어야 서는 원자인데 겨눈 상대가 없다 — 아는 상대가 하나도 없으면 이 걸음은 서지 못한다`,
    );
    return { intent: null, step, violations };
  }
  if (!aiming && aim !== null) {
    violateIntent(
      violations,
      actorId,
      'targetless-atom',
      '$.aim',
      `${atomLabel(step.atom)} 는 상대를 겨누지 않는 원자다 — 자리와 물건을 겨눈다`,
    );
    return { intent: null, step, violations };
  }
  if (aim !== null && aim.counterpartId === actorId) {
    violateIntent(violations, actorId, 'self-aimed', '$.aim.counterpartId', '자기 자신을 겨눌 수는 없다');
    return { intent: null, step, violations };
  }

  const targetIds = aim === null ? (spec.targetIds ?? []) : [aim.counterpartId];
  const changes = spec.changes ?? [];
  const payments = spec.payments ?? [];
  const proposal: ActionProposal = {
    atom: step.atom,
    actorId,
    targetIds,
    changes,
    payments,
    observedIds: spec.observedIds ?? targetIds,
  };

  const fit = fitAction(proposal);
  if (!fit.fits) {
    for (const violation of fit.violations) {
      violateIntent(
        violations,
        actorId,
        'malformed-request',
        '$.proposal',
        `P0-c 관문 — ${violation.message}`,
      );
    }
    return { intent: null, step, violations };
  }

  const intent: ActionIntent = {
    kind: 'Affordance',
    id: intentIdOf(actorId, goal.nodeId, tick),
    providerId: actorId,
    action: step.atom,
    requires: [
      ...(step.forSlot === null ? [] : [`먼저 ${step.forSlot}`]),
      ...(aim === null ? [] : [`상대 ${aim.counterpartId}`]),
    ],
    yields: changes.map(slotText),
    cost: payments.length,
    tick,
    atom: step.atom,
    goalId: goal.nodeId,
    stepOrder: step.order,
    aim,
    proposal,
    note:
      aim === null
        ? `${atomLabel(step.atom)} — ${step.note}`
        : `${atomLabel(step.atom)} 로 ${aim.counterpartId} 를 겨눈다 (${aim.note})`,
  };

  const gate = classify(intent as unknown as Record<string, unknown>).violations;
  for (const violation of gate) {
    violateIntent(violations, actorId, 'malformed-request', '$.intent', `O1 관문 — ${violation.message}`);
  }
  if (gate.length > 0) return { intent: null, step, violations };

  return { intent, step, violations };
}

/** 사람이 읽는 한 줄. */
export function intentLine(intent: ActionIntent): string {
  const who = intent.aim === null ? '(상대 없음)' : intent.aim.counterpartId;
  return `틱 ${String(intent.tick)} · ${atomLabel(intent.atom)} → ${who} (걸음 ${String(intent.stepOrder)} · 치르는 자리 ${String(intent.cost)})`;
}

/** 의도를 정렬한다 — 틱 → 내는 자 → id. 배치가 결정적이어야 그림도 해시된다. */
export function orderIntents(intents: readonly ActionIntent[]): readonly ActionIntent[] {
  return [...intents].sort((left, right) => {
    if (left.tick !== right.tick) return left.tick - right.tick;
    if (left.providerId !== right.providerId) return left.providerId < right.providerId ? -1 : 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}
