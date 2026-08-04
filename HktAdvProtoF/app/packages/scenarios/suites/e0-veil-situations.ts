// E0 검증 장면 — **둘이 서로를 알아보고 다툰다.**
//
// D5 는 넷을 고기 하나 앞에 세웠다. 거기까지가 D5 였다 — **넷은 서로를 몰랐다.** 이분 그래프의
// 선은 주체에서 대상으로만 갔고, "누가 누구와 싸우는지는 서로를 봐야 알고, 상황으로 묶는 것은
// E0 다" 라는 한 줄이 남았다.
//
// R6 는 원한을 손으로 만들었다. 거기까지가 R6 였다 — **의도는 한 사람의 것이었다.** 둘이 같은
// 사람을 겨눠도 그 둘이 같은 자리에 서 있다는 것을 보는 눈이 없었다.
//
// 여기서 그 둘이 만난다. 그리고 그 과정에서 넷이 값으로 선다.
//
//   ① **세계의 대부분은 상황이 아니다.** D5 의 자리 다툼 넷은 전부 제 안의 겹침이라(`internal`)
//      혼자 걸린 자리다 — 상황이 되지 않고 사실로 남는다.
//   ② **넷이 같은 고기 앞에 섰는데 서로를 알아본 쌍은 없다.** 여섯 쌍 전부 눈멂이다.
//      D5 가 멈춘 자리가 여기서 **값으로** 보인다.
//   ③ **둘이 04 를 겨누는데 04 는 그 둘을 모른다.** 매복 둘이 선다 — 겨누는 쪽은 언제나 상대를
//      알지만(R6 "겨눌 수 있는 것은 아는 상대뿐"), 겨눔당하는 쪽은 모를 수 있다.
//   ④ **04 의 장부에 사이가 적히는 순간 매복이 알아본 다툼으로 바뀐다.** 겨눔은 하나도 바꾸지
//      않았다 — 바뀐 것은 **누가 누구를 아는가**뿐이고, 그것만으로 값이 갈린다.
//      이것이 E3 가 받을 정보 표면이다 (MODULES.md E3 — "정보 상태만 바꿔 승패가 뒤집히는 장면").
//
// 세계도 기억도 의도도 새로 짓지 않는다 — D5 장면의 다툼과 R6 장면의 의도를 그대로 겹쳐 놓고,
// ④ 에서만 **04 의 장부 한 줄**을 더한다(그리고 그 한 줄에서 04 의 되받는 겨눔은 R6 가 만든다).

import type { Id } from '@hkt/core/v1';
import { assembleWorld, disassembleWorld, slotStateId, type WorldState } from '@hkt/core/o2';
import type { State } from '@hkt/core/o1';
import type { ChangeRef } from '@hkt/core/p0';
import type { ActiveGoal } from '@hkt/core/p4';
import type { ActionPlan, PlanStep } from '@hkt/core/p5';
import type { DependencyConflict } from '@hkt/core/d5';
import {
  chooseAim,
  formIntent,
  knownCounterparts,
  type ActionIntent,
} from '@hkt/core/r6';
import {
  auditSituations,
  detectSituations,
  situationGraphOf,
  situationFieldVerdict,
  stakeAxisLabel,
  type DetectSituationResult,
  type Situation,
  type SituationAudit,
  type SituationGraph,
  type SituationPair,
  type SituationStake,
} from '@hkt/core/e0';

import { EMPTY as D5_EMPTY, LABELS as D5_LABELS } from './d5-veil-conflicts.ts';
import {
  ACTORS,
  ACT_TICK,
  CANDIDATES,
  AFTER_MEMORIES,
  INTENTS,
  NAMES as R6_NAMES,
  VEIL_WORLD,
  actorId,
  WITNESS_IDS,
} from './r6-veil-intents.ts';

export { actorId, ACT_TICK, CANDIDATES };

/** 되받아 겨누는 틱 — 겨눔들이 선 다음 걸음이다. */
export const BACK_TICK = ACT_TICK + 10;

/** 이름표 — R6 의 것에 D5 장면의 주체들을 더한다. */
export const NAMES: ReadonlyMap<Id, string> = new Map<Id, string>([
  ...D5_LABELS,
  ...R6_NAMES,
]);

export const nameOf = (id: Id): string => NAMES.get(id) ?? id;

/** D5 가 세운 다툼 다섯 — 자리 넷(제 안의 겹침)과 대상 하나(넷이 함께 보는 고기). */
export const CONFLICTS: readonly DependencyConflict[] = D5_EMPTY.field.conflicts;

/** 04 를 겨눈 몰이꾼. 되받는 겨눔이 향할 상대다. */
export const trackerId: Id = WITNESS_IDS.tracker;
export const priestId: Id = WITNESS_IDS.priest;

// ─────────────────────────────────────────────────────────────────────────────
// ①②③ 서로를 알아보기 전 — D5 의 다툼과 R6 의 의도를 한 세계에 겹친다
// ─────────────────────────────────────────────────────────────────────────────

export const BEFORE: DetectSituationResult = detectSituations({
  conflicts: CONFLICTS,
  intents: INTENTS,
  memories: AFTER_MEMORIES,
  world: VEIL_WORLD,
});

/** 세계에 서 있는 주체 전부 — 아무 상황에도 끼지 않은 자를 세는 재료다. */
export const SUBJECT_IDS: readonly Id[] = [
  ...new Set([
    ...CANDIDATES,
    ...CONFLICTS.flatMap((conflict) => conflict.sides.map((side) => side.subjectId)),
  ]),
];

export const BEFORE_AUDIT: SituationAudit = auditSituations({
  field: BEFORE.field,
  stakes: BEFORE.stakes,
  subjectIds: SUBJECT_IDS,
});

export const BEFORE_VERDICT = situationFieldVerdict(BEFORE_AUDIT);
export const BEFORE_GRAPH: SituationGraph = situationGraphOf(BEFORE.field);

// ─────────────────────────────────────────────────────────────────────────────
// ④ 04 의 장부에 사이가 적히면 — 겨눔은 그대로인데 값이 갈린다
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 04 도 그 둘을 알게 된 세계 — **한 줄만 더한다.**
 *
 * 세계가 04 의 장부에 몰이꾼과의 사이를 적는다(D3 "적히지 않은 사이는 없는 사이" 의 반대편).
 * 그 한 줄이 R6 `knownCounterparts` 를 통과해 04 에게 겨눌 상대를 준다 — **E0 가 만든 것은
 * 아무것도 없다.** E0 는 그 결과로 쌍의 값이 어떻게 갈리는지를 보일 뿐이다.
 */
export const AFTER_WORLD: WorldState = assembleWorld([
  ...disassembleWorld(VEIL_WORLD),
  {
    kind: 'State',
    id: slotStateId('relational', actorId, `grudge.${trackerId}`),
    domain: 'relational',
    ofId: actorId,
    path: `grudge.${trackerId}`,
    value: 0.6,
  } as State,
]).world;

const planOf = (subjectId: Id): ActionPlan => {
  const step: PlanStep = {
    order: 0,
    atom: 'seize',
    label: '빼앗다',
    reason: 'goal',
    forAtom: null,
    forSlot: null,
    verdict: 'payable',
    unbrakedSlots: [],
    note: '지금 낼 수 있다',
  };
  return {
    subjectId,
    goalId: 'possibility:되받음',
    label: '되받음',
    direction: 'fulfill',
    steps: [step],
    atoms: ['seize'],
    deadEnds: [],
    depth: 1,
    violations: [],
    complete: true,
  };
};

const goalOf = (subjectId: Id): ActiveGoal =>
  ({
    subjectId,
    tick: BACK_TICK,
    nodeId: 'possibility:되받음',
    label: '되받음',
    direction: 'fulfill',
    viaAtom: 'seize',
    score: 0.6,
    commitmentInertia: 0,
    heldTicks: 0,
    changed: true,
    change: 'first',
    note: '',
  }) as unknown as ActiveGoal;

const backAim = chooseAim({
  atom: 'seize',
  subjectId: actorId,
  memories: AFTER_MEMORIES,
  world: AFTER_WORLD,
  candidates: CANDIDATES,
});

const backChanges: readonly ChangeRef[] = [
  { domain: 'relational', holderId: actorId, path: `grudge.${backAim.aim?.counterpartId ?? ''}` },
];
const backPayments: readonly ChangeRef[] = [
  { domain: 'biological', holderId: actorId, path: 'vitality' },
];

const backFormed = formIntent({
  plan: planOf(actorId),
  goal: goalOf(actorId),
  tick: BACK_TICK,
  grammar: ACTORS[0]?.grammar as never,
  aim: backAim.aim,
  changes: backChanges,
  payments: backPayments,
  observedIds: backAim.aim === null ? [] : [backAim.aim.counterpartId],
});

/** 04 가 되받아 겨눈 의도. 세계가 사이를 적어 주기 전에는 설 수 없었다. */
export const BACK_INTENT: ActionIntent | null = backFormed.intent;

/** 04 가 겨눌 상대를 몇이나 아는가 — 장부 한 줄 전과 후. */
export const KNOWN_BEFORE = knownCounterparts(AFTER_MEMORIES, VEIL_WORLD, actorId, CANDIDATES).length;
export const KNOWN_AFTER = knownCounterparts(AFTER_MEMORIES, AFTER_WORLD, actorId, CANDIDATES).length;

export const AFTER: DetectSituationResult = detectSituations({
  conflicts: CONFLICTS,
  intents: BACK_INTENT === null ? INTENTS : [...INTENTS, BACK_INTENT],
  memories: AFTER_MEMORIES,
  world: AFTER_WORLD,
});

export const AFTER_AUDIT: SituationAudit = auditSituations({
  field: AFTER.field,
  stakes: AFTER.stakes,
  subjectIds: SUBJECT_IDS,
});

export const AFTER_VERDICT = situationFieldVerdict(AFTER_AUDIT);
export const AFTER_GRAPH: SituationGraph = situationGraphOf(AFTER.field);

// ─────────────────────────────────────────────────────────────────────────────
// 화면과 시나리오가 함께 읽는 표
// ─────────────────────────────────────────────────────────────────────────────

/** 상황 한 줄 — 어느 자리에 몇이 걸렸고 그 안에서 무엇이 갈렸는가. */
export interface SituationRow {
  readonly axis: string;
  readonly axisLabel: string;
  readonly key: string;
  readonly who: readonly string[];
  readonly pairs: number;
  readonly recognized: number;
  readonly ambushes: number;
  readonly blind: number;
  readonly urgency: number;
}

const rowOf = (situation: Situation): SituationRow => ({
  axis: situation.axis,
  axisLabel: stakeAxisLabel(situation.axis),
  key: situation.key,
  who: situation.participants.map(nameOf),
  pairs: situation.pairs.length,
  recognized: situation.recognized,
  ambushes: situation.ambushes,
  blind: situation.pairs.filter((pair) => pair.aim === 'blind').length,
  urgency: Number(situation.urgency.toFixed(4)),
});

export const BEFORE_ROWS: readonly SituationRow[] = BEFORE.field.situations.map(rowOf);
export const AFTER_ROWS: readonly SituationRow[] = AFTER.field.situations.map(rowOf);

/** 쌍 한 줄 — 누구와 누구 사이가 무엇인가. */
export interface PairRow {
  readonly where: string;
  readonly left: string;
  readonly right: string;
  readonly aim: SituationPair['aim'];
  readonly ambush: boolean;
  readonly awareness: SituationPair['awareness'];
  readonly note: string;
}

const pairRowsOf = (result: DetectSituationResult): readonly PairRow[] =>
  result.field.situations.flatMap((situation) =>
    situation.pairs.map((pair) => ({
      where: `${stakeAxisLabel(situation.axis)} ${nameOf(situation.key)}`,
      left: nameOf(pair.leftId),
      right: nameOf(pair.rightId),
      aim: pair.aim,
      ambush: pair.ambush,
      awareness: pair.awareness,
      note: pair.note,
    })),
  );

export const BEFORE_PAIRS: readonly PairRow[] = pairRowsOf(BEFORE);
export const AFTER_PAIRS: readonly PairRow[] = pairRowsOf(AFTER);

/** 혼자 걸린 자리 — 위반이 아니라 사실이다. */
export interface SolitudeRow {
  readonly axisLabel: string;
  readonly key: string;
  readonly who: string;
}

export const SOLITUDE_ROWS: readonly SolitudeRow[] = BEFORE.field.solitudes.map((solitude) => ({
  axisLabel: stakeAxisLabel(solitude.axis),
  key: solitude.key,
  who: nameOf(solitude.subjectId),
}));

/** 걸림이 어느 축에서 몇 개 났는가 — 사람 축이 E0 가 새로 연 것이다. */
export const STAKES_BY_AXIS: Readonly<Record<string, number>> = BEFORE.stakes.reduce<
  Record<string, number>
>((acc, stake: SituationStake) => {
  acc[stake.axis] = (acc[stake.axis] ?? 0) + 1;
  return acc;
}, {});

/** 한 줄만 더했는데 무엇이 갈렸는가 — E0 의 값이 여기서 보인다. */
export const SHIFT = {
  knownBefore: KNOWN_BEFORE,
  knownAfter: KNOWN_AFTER,
  recognizedBefore: BEFORE_AUDIT.recognized,
  recognizedAfter: AFTER_AUDIT.recognized,
  ambushBefore: BEFORE_AUDIT.ambushes,
  ambushAfter: AFTER_AUDIT.ambushes,
  situationsBefore: BEFORE_AUDIT.situations,
  situationsAfter: AFTER_AUDIT.situations,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 설 수 없는 상황들 — 던지지 않고 사유를 값으로 남긴다
// ─────────────────────────────────────────────────────────────────────────────

export interface BrokenSituation {
  readonly label: string;
  readonly rule: string;
  readonly why: string;
  readonly caught: boolean;
}

const firstSituation = BEFORE.field.situations[0] as Situation;

const brokenAudit = (situations: readonly Situation[], stakes: readonly SituationStake[] = []) =>
  auditSituations({
    field: {
      situations,
      solitudes: [],
      bySubject: new Map(),
      byKey: new Map(situations.map((situation) => [`${situation.axis}:${situation.key}`, situation])),
    },
    stakes,
  });

export const BROKEN_SITUATIONS: readonly BrokenSituation[] = [
  (() => {
    const audit = brokenAudit([{ ...firstSituation, participants: [actorId], pairs: [] }]);
    return {
      label: '참여자가 하나뿐인 상황',
      rule: 'solitary-situation',
      why: '혼자 걸린 자리는 상황이 아니다 — 세계의 대부분은 상황이 아니다',
      caught: audit.violations.some((violation) => violation.rule === 'solitary-situation'),
    };
  })(),
  (() => {
    const audit = brokenAudit([{ ...firstSituation, stakes: [] }]);
    return {
      label: '걸림 없이 세운 상황',
      rule: 'groundless-situation',
      why: '무엇에 걸렸는지 대지 못하는 상황이다',
      caught: audit.violations.some((violation) => violation.rule === 'groundless-situation'),
    };
  })(),
  (() => {
    const audit = brokenAudit([
      { ...firstSituation, winnerId: actorId } as unknown as Situation,
    ]);
    return {
      label: '이기는 자를 적은 상황',
      rule: 'outcome-declared',
      why: '상황이 섰다는 것까지가 E0 이고, 결과를 확정하는 것은 E3 다',
      caught: audit.violations.some((violation) => violation.rule === 'outcome-declared'),
    };
  })(),
  (() => {
    const pair = firstSituation.pairs[0] as SituationPair;
    const audit = brokenAudit([
      { ...firstSituation, pairs: [{ ...pair, leftId: actorId, rightId: actorId }] },
    ]);
    return {
      label: '자기 자신과의 쌍',
      rule: 'self-pair',
      why: '혼자서는 알아볼 것이 없다',
      caught: audit.violations.some((violation) => violation.rule === 'self-pair'),
    };
  })(),
  (() => {
    const pair = firstSituation.pairs[0] as SituationPair;
    const audit = brokenAudit([
      { ...firstSituation, pairs: [{ ...pair, aim: 'mutual' as const, ambush: true }] },
    ]);
    return {
      label: '서로 겨누는데 매복이라 적은 쌍',
      rule: 'awareness-drift',
      why: '매복은 한쪽만 겨눌 때만 선다 — 서로 겨누는 둘은 둘 다 상대를 안다(R6)',
      caught: audit.violations.some((violation) => violation.rule === 'awareness-drift'),
    };
  })(),
  (() => {
    const audit = brokenAudit([], BEFORE.stakes);
    return {
      label: '둘이 걸린 자리를 빠뜨린 상황장',
      rule: 'missing-situation',
      why: '빠뜨리지 않는다는 것은 주장이 아니라 검사여야 한다 (D5-c missing-contest 와 같은 자리)',
      caught: audit.violations.some((violation) => violation.rule === 'missing-situation'),
    };
  })(),
];

// ─────────────────────────────────────────────────────────────────────────────
// 경계 — 비어 있는 것과 하나뿐인 것
// ─────────────────────────────────────────────────────────────────────────────

/** 아무것도 없는 세계 — 상황도 없고 위반도 없다. */
export const EMPTY_RESULT: DetectSituationResult = detectSituations({});
export const EMPTY_AUDIT: SituationAudit = auditSituations({ field: EMPTY_RESULT.field });

/** 혼자 선 세계 — 걸림은 있는데 상황은 없다. */
export const ALONE_RESULT: DetectSituationResult = detectSituations({
  intents: INTENTS.slice(0, 1),
  memories: AFTER_MEMORIES,
  world: VEIL_WORLD,
});
export const ALONE_AUDIT: SituationAudit = auditSituations({
  field: ALONE_RESULT.field,
  stakes: ALONE_RESULT.stakes,
  subjectIds: SUBJECT_IDS,
});

/** 같은 재료로 상황 묶기를 다시 돌린다 — 결정성 검사(V1)가 쓴다. */
export const runDetect = (): unknown =>
  detectSituations({
    conflicts: CONFLICTS,
    intents: INTENTS,
    memories: AFTER_MEMORIES,
    world: VEIL_WORLD,
  }).field.situations;

/** 같은 재료를 두 번 돌려도 같은 결과인가 — 결정성 (V1). */
export const IDEMPOTENT =
  JSON.stringify(
    detectSituations({
      conflicts: CONFLICTS,
      intents: INTENTS,
      memories: AFTER_MEMORIES,
      world: VEIL_WORLD,
    }).field.situations,
  ) === JSON.stringify(BEFORE.field.situations);

/** 화면과 시나리오가 같은 문장을 쓴다. */
export const SOLITUDE_NOTE =
  '아니다 — 혼자 걸린 자리가 있는 것은 위반이 아니다. 세계의 대부분은 상황이 아니고, 그 사실이 값으로 남아야 "왜 여기서는 아무 일도 없는가" 를 물을 수 있다';
export const BLIND_NOTE =
  'D5 가 멈춘 자리다 — 넷이 같은 고기 앞에 서 있다는 것까지가 D5 였고, 그 넷이 서로를 아는지는 아무도 재지 않았다. 여기서 재 보면 여섯 쌍 전부 눈멂이다';
export const SHIFT_NOTE =
  '겨눔은 하나도 바꾸지 않았다 — 바뀐 것은 04 의 장부 한 줄, 곧 **누가 누구를 아는가**뿐이다. 그것만으로 매복이 알아본 다툼으로 바뀐다. 이 값이 E3 가 받을 정보 표면이다';
export const NO_OUTCOME_NOTE =
  'E0 는 이기는 자를 정하지 않는다 — 상황이 섰다는 것과 그 안에서 누가 누구를 알아보는가까지다. 결과를 확정하는 것은 E3 이고, 상황에 결과를 적으면 outcome-declared 로 걸린다';

/** 이 계층이 새로 그은 선 — D5 이분 그래프와의 대조. */
export const GRAPH_NOTE =
  'D5 이분 그래프는 한쪽에 주체를 다른 쪽에 대상을 놓고 선을 주체→대상으로만 그었다. 여기서는 노드가 전부 주체이고 선이 주체↔주체로 간다';
