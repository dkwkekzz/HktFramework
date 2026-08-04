// R6 검증 장면 — 원한이 행동이 되고, 그래서 **고리가 닫힌다**.
//
// R5 는 넷을 04 앞에 세웠다: 몸이 깎인 11 은 겪어서, 나머지 셋은 들어서 04 를 원망한다. 그런데
// 거기까지가 R5 였다 — **원망은 아직 아무것도 하지 않았다.**
//
// 여기서 그 원망이 손이 된다. 그리고 그 과정에서 넷이 값으로 선다.
//
//   ① **말 한 마디가 셋의 손을 움직인다.** 소문을 듣기 전의 목격자 셋에게는 겨눌 상대가 없다 —
//      밖에서 자국만 본 자에게는 지목이 없고(R4), 지목이 없으면 원한이 서지 않으며(R5),
//      원한이 서지 않으면 빼앗을 상대가 없다(R6). **들은 뒤에는 셋 다 04 를 겨눈다.**
//   ② **원망해도 못 내는 손이 있다.** 상단은 04 를 원망하지만 **빼앗지 못한다** — P2 가 "다음
//      겨울에 문이 닫히기 때문" 이라고 그 손을 닫아 두었다. 원한과 손은 다른 것이다.
//   ③ **같은 사람이 내미는 손으로는 다른 사람을 겨눈다.** 사이의 축이 갈리면 상대가 갈린다.
//   ④ **고리가 닫힌다.** 04 를 겨눈 의도가 R1 에서 사건이 되고 R2 가 흔적을 낸다 — 그 흔적은
//      다시 읽힐 수 있는 모양이고, 그것이 단계 3 이 한 바퀴를 돈다는 뜻이다.
//
// 세계도 기억도 사이도 새로 짓지 않는다 — R5 장면의 것을 그대로 쓰고, 더하는 것은 **넷의 계획**
// 뿐이다(빼앗기 한 걸음 · 주고받기 한 걸음).

import type { Id } from '@hkt/core/v1';
import { disassembleWorld, readSlot } from '@hkt/core/o2';
import { atomLabel, type ActionAtom, type ChangeRef } from '@hkt/core/p0';
import { CULTURE_CASES } from './p2-veil-grammars.ts';
import type { PossibilityGrammar } from '@hkt/core/p2';
import type { ActiveGoal } from '@hkt/core/p4';
import type { ActionPlan, PlanStep } from '@hkt/core/p5';
import {
  commit,
  genesisCause,
  latest,
  openStore,
  type WorldStateSnapshot,
  type WorldStateStore,
} from '@hkt/core/r0';
import { openLog } from '@hkt/core/r1';
import type { Memory } from '@hkt/core/r5';
import {
  auditIntents,
  chooseAim,
  closeLoop,
  enqueue,
  formIntent,
  intentQueueVerdict,
  knownCounterparts,
  openIntentQueue,
  type ActionIntent,
  type Aim,
  type AimCandidate,
  type IntentAudit,
  type IntentQueue,
  type IntentViolation,
  type LoopResult,
} from '@hkt/core/r6';

import { meatId, villagersId } from './r1-veil-events.ts';
import {
  LABELS,
  LIVED,
  REGARD_SUBJECTS,
  SEEN_MEMORIES,
  TOLD_MEMORIES,
  VEIL_MEMORIES,
  VEIL_WORLD,
  WITNESS_IDS,
  actorId,
  rivalId,
} from './r5-veil-memories.ts';

export { LABELS, actorId, rivalId, WITNESS_IDS, VEIL_WORLD };

/** 의도를 내는 틱 — 소문이 퍼진 다음 걸음이다. */
export const ACT_TICK = 430;

/** 이름표 — R5 의 것에 마을을 더한다. */
export const NAMES: ReadonlyMap<Id, string> = new Map<Id, string>([
  ...LABELS,
  [villagersId, '마을 사람들'],
]);

const nameOf = (id: Id): string => NAMES.get(id) ?? id;

/** 원망하는 넷 — 겪은 11 과 들은 셋. 문법은 P2 가 갈라 둔 그대로다. */
export interface Actor {
  readonly subjectId: Id;
  readonly label: string;
  readonly grammar: PossibilityGrammar;
  /** 그의 손이 무엇을 하지 않는가 (P2) */
  readonly tells: string;
}

export const ACTORS: readonly Actor[] = [
  {
    subjectId: actorId,
    label: nameOf(actorId),
    grammar: CULTURE_CASES[0]?.grammar as PossibilityGrammar,
    tells: CULTURE_CASES[0]?.tells ?? '',
  },
  {
    subjectId: rivalId,
    label: nameOf(rivalId),
    grammar: CULTURE_CASES[2]?.grammar as PossibilityGrammar,
    tells: CULTURE_CASES[2]?.tells ?? '',
  },
  ...[WITNESS_IDS.tracker, WITNESS_IDS.priest, WITNESS_IDS.trader].map((subjectId, index) => ({
    subjectId,
    label: nameOf(subjectId),
    grammar: CULTURE_CASES[index]?.grammar as PossibilityGrammar,
    tells: CULTURE_CASES[index]?.tells ?? '',
  })),
];

/**
 * 겨눔의 후보 — R5 가 사이를 잰 다섯에 **마을**을 더한다.
 *
 * 마을은 R1 장면에서 04 와 주고받은 상대이고 세계가 그 신뢰를 적어 두었다(0.8). 그래서 04 에게는
 * **내밀 손이 있는 상대**가 하나 있고, 그것이 "같은 사람이 축에 따라 다른 사람을 겨눈다" 를
 * 값으로 세우는 자리다.
 */
export const CANDIDATES: readonly Id[] = [...REGARD_SUBJECTS, villagersId];

/** 말을 듣기 전에 다섯이 지녔던 기억 — 겪음 하나와 본 것 여섯뿐이다. */
export const BEFORE_MEMORIES: readonly Memory[] = [LIVED, ...SEEN_MEMORIES];
/** 말을 들은 뒤 — 들은 셋이 더해진다. */
export const AFTER_MEMORIES: readonly Memory[] = VEIL_MEMORIES.memories;

const planOf = (subjectId: Id, atom: ActionAtom, label: string): ActionPlan => {
  const step: PlanStep = {
    order: 0,
    atom,
    label: atomLabel(atom),
    reason: 'goal',
    forAtom: null,
    forSlot: null,
    verdict: 'payable',
    unbrakedSlots: [],
    note: '지금 낼 수 있다',
  };
  return {
    subjectId,
    goalId: `possibility:${label}`,
    label,
    direction: 'fulfill',
    steps: [step],
    atoms: [atom],
    deadEnds: [],
    depth: 1,
    violations: [],
    complete: true,
  };
};

const goalOf = (subjectId: Id, atom: ActionAtom, label: string): ActiveGoal =>
  ({
    subjectId,
    tick: ACT_TICK,
    nodeId: `possibility:${label}`,
    label,
    direction: 'fulfill',
    viaAtom: atom,
    score: 0.6,
    commitmentInertia: 0,
    heldTicks: 0,
    changed: true,
    change: 'first',
    note: '',
  }) as unknown as ActiveGoal;


/** 고기 하나 — 요청서가 가리키는 물건이다 (P5 걸음이 준 대상 자리에 해당한다). */
export const MEAT_ID: Id = meatId;

/**
 * 요청서의 자리 — **원자마다 P0-b 가 연 자리 중 하나씩 고른 것이고, 호출자가 준다.**
 *
 * R6 는 이것을 고르지 않는다(`IntentSpec.changes` 주석) — 장면이 준다. 고르는 규칙은 하나다:
 * 바꾸는 자리는 **그 겨눔이 실제로 건드리는 사이 자리**를, 치르는 자리는 그 원자가 여는 것 중
 * 이 주체가 실제로 가진 자리를 쓴다.
 */
function refsFor(
  atom: ActionAtom,
  subjectId: Id,
  counterpartId: Id | null,
): { readonly changes: readonly ChangeRef[]; readonly payments: readonly ChangeRef[] } {
  if (atom === 'seize') {
    return {
      changes: [
        { domain: 'relational', holderId: subjectId, path: `grudge.${counterpartId ?? ''}` },
      ],
      payments: [{ domain: 'biological', holderId: subjectId, path: 'vitality' }],
    };
  }
  if (atom === 'exchange') {
    return {
      changes: [
        { domain: 'relational', holderId: subjectId, path: `trust.${counterpartId ?? ''}` },
      ],
      payments: [{ domain: 'economic', holderId: subjectId, path: `stock.${meatId}` }],
    };
  }
  return {
    changes: [{ domain: 'biological', holderId: subjectId, path: 'hunger' }],
    payments: [{ domain: 'biological', holderId: subjectId, path: 'vitality' }],
  };
}

/** 한 주체가 한 원자로 의도를 내려 한 결과 — 섰든 못 섰든 값으로 남는다. */
export interface Attempt {
  readonly label: string;
  readonly subjectId: Id;
  readonly atom: ActionAtom;
  readonly known: number;
  readonly candidates: readonly AimCandidate[];
  readonly aim: Aim | null;
  readonly intent: ActionIntent | null;
  readonly violations: readonly IntentViolation[];
  readonly why: string;
}

function attempt(
  actor: Actor,
  atom: ActionAtom,
  memories: readonly Memory[],
  label: string,
  tick: number = ACT_TICK,
): Attempt {
  const known = knownCounterparts(memories, VEIL_WORLD, actor.subjectId, CANDIDATES);
  const aimed = chooseAim({
    atom,
    subjectId: actor.subjectId,
    memories,
    world: VEIL_WORLD,
    candidates: CANDIDATES,
  });
  const refs = refsFor(atom, actor.subjectId, aimed.aim?.counterpartId ?? null);
  const formed = formIntent({
    plan: planOf(actor.subjectId, atom, label),
    goal: goalOf(actor.subjectId, atom, label),
    tick,
    grammar: actor.grammar,
    aim: aimed.aim,
    changes: refs.changes,
    payments: refs.payments,
    observedIds: aimed.aim === null ? [] : [aimed.aim.counterpartId],
  });
  const violations = [...aimed.violations, ...formed.violations];
  return {
    label: actor.label,
    subjectId: actor.subjectId,
    atom,
    known: known.length,
    candidates: aimed.candidates,
    aim: aimed.aim,
    intent: formed.intent,
    violations,
    why:
      formed.intent !== null
        ? `${nameOf(aimed.aim?.counterpartId ?? '')} 를 겨눈다 — ${aimed.aim?.note ?? ''}`
        : (violations[0]?.message ?? ''),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ① 말 한 마디가 셋의 손을 움직인다
// ─────────────────────────────────────────────────────────────────────────────

/** 말을 듣기 전 — 넷이 빼앗으려 한다. */
export const BEFORE_ATTEMPTS: readonly Attempt[] = ACTORS.map((actor, index) =>
  attempt(actor, 'seize', BEFORE_MEMORIES, '겨울 식량', ACT_TICK + index),
);

/** 말을 들은 뒤 — 같은 넷, 같은 계획. */
export const AFTER_ATTEMPTS: readonly Attempt[] = ACTORS.map((actor, index) =>
  attempt(actor, 'seize', AFTER_MEMORIES, '겨울 식량', ACT_TICK + index),
);

/** 소문 하나가 손을 몇 개 움직였는가. */
export const MOVED_BY_RUMOR = ACTORS.filter((actor) => {
  const before = BEFORE_ATTEMPTS.find((entry) => entry.subjectId === actor.subjectId);
  const after = AFTER_ATTEMPTS.find((entry) => entry.subjectId === actor.subjectId);
  return before?.aim === null && after?.aim !== null;
}).length;

// ─────────────────────────────────────────────────────────────────────────────
// ② 원망해도 못 내는 손이 있다 / ③ 내미는 손은 다른 사람을 겨눈다
// ─────────────────────────────────────────────────────────────────────────────

/** 넷이 원망하는데 빼앗는 손은 몇인가 — 문법이 닫은 자리를 값으로 본다. */
export interface HandRow {
  readonly label: string;
  readonly resents: boolean;
  readonly aims: boolean;
  readonly stands: boolean;
  readonly tells: string;
  readonly why: string;
}

export const HAND_ROWS: readonly HandRow[] = AFTER_ATTEMPTS.map((entry, index) => ({
  label: entry.label,
  resents: entry.aim !== null,
  aims: entry.aim !== null,
  stands: entry.intent !== null,
  tells: ACTORS[index]?.tells ?? '',
  why: entry.why,
}));

/** 같은 넷이 내미는 손(주고받기)으로는 누구를 겨누는가. */
export const MUTUAL_ATTEMPTS: readonly Attempt[] = ACTORS.map((actor, index) =>
  attempt(actor, 'exchange', AFTER_MEMORIES, '겨울 식량', ACT_TICK + index),
);

/** 등지는 손과 내미는 손이 같은 사람을 겨누는가. */
export interface AxisRow {
  readonly label: string;
  readonly againstAim: string;
  readonly mutualAim: string;
  readonly split: boolean;
}

export const AXIS_ROWS: readonly AxisRow[] = ACTORS.map((actor, index) => {
  const against = AFTER_ATTEMPTS[index];
  const mutual = MUTUAL_ATTEMPTS[index];
  const a = against?.aim?.counterpartId ?? null;
  const m = mutual?.aim?.counterpartId ?? null;
  return {
    label: actor.label,
    againstAim: a === null ? '(겨눌 상대 없음)' : nameOf(a),
    mutualAim: m === null ? '(겨눌 상대 없음)' : nameOf(m),
    split: a !== m,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ 고리가 닫힌다
// ─────────────────────────────────────────────────────────────────────────────

/** 실제로 선 의도들. */
export const INTENTS: readonly ActionIntent[] = AFTER_ATTEMPTS.map((entry) => entry.intent).filter(
  (intent): intent is ActionIntent => intent !== null,
);

export const VEIL_QUEUE: IntentQueue = enqueue(openIntentQueue(), INTENTS);

const vitalityNow = (world: Parameters<typeof readSlot>[0], subjectId: Id): number =>
  Number(readSlot(world, 'biological', subjectId, 'vitality') ?? 0.5);

/** 고리 한 바퀴 — 의도가 사건이 되고 흔적이 난다. */
/**
 * 고리가 도는 세계 — **R5 장면의 세계를 그대로 원장에 담는다.**
 *
 * R1 원장(`VEIL_STORE`)에는 목격자 셋이 서 있지 않다(R4 가 그들을 세계에 더했다). 그 원장 위에서
 * 고리를 돌리면 흔적이 날 자리를 못 찾는다 — R2-b 가 "흔적은 지닌 자가 선 곳에서 난다" 로
 * 못박은 그 자리다. 그래서 넷이 실제로 서 있는 세계를 담는다.
 */
export const BASE_STORE: WorldStateStore = commit(openStore(), {
  tick: ACT_TICK - 5,
  states: disassembleWorld(VEIL_WORLD),
  cause: genesisCause('소문이 지나간 겨울'),
}).store;

export const LOOP: LoopResult = closeLoop({
  store: BASE_STORE,
  log: openLog(),
  intents: INTENTS,
  valuesFor: (intent, world) => [
    {
      kind: 'change' as const,
      domain: 'relational' as const,
      holderId: intent.providerId,
      path: `grudge.${intent.aim?.counterpartId ?? ''}`,
      to: 0.5,
    },
    {
      kind: 'payment' as const,
      domain: 'biological' as const,
      holderId: intent.providerId,
      path: 'vitality',
      to: Number(Math.max(0, vitalityNow(world, intent.providerId) - 0.05).toFixed(2)),
    },
  ],
});

/** 고리의 걸음마다 무엇이 났는가. */
export interface LoopRow {
  readonly label: string;
  readonly atom: string;
  readonly aimedAt: string;
  readonly enacted: boolean;
  readonly phenomena: number;
  readonly channels: readonly string[];
  readonly note: string;
}

export const LOOP_ROWS: readonly LoopRow[] = LOOP.steps.map((step) => ({
  label: nameOf(step.intent.providerId),
  atom: atomLabel(step.intent.atom),
  aimedAt: nameOf(step.intent.aim?.counterpartId ?? ''),
  enacted: step.event !== null,
  phenomena: step.phenomena.length,
  channels: [...new Set(step.phenomena.map((entry) => entry.channel))].sort(),
  note: step.note,
}));

/** 원장이 실제로 움직였는가 — 고리는 주장이 아니라 검사다. */
export const LEDGER_BEFORE = BASE_STORE.snapshots.length;
export const LEDGER_AFTER = LOOP.store.snapshots.length;
export const LAST_WORLD = (latest(LOOP.store) as WorldStateSnapshot).world;

export const VEIL_AUDIT: IntentAudit = auditIntents({
  queue: VEIL_QUEUE,
  subjectIds: CANDIDATES,
  loop: LOOP,
});

export const AUDIT_VERDICT = intentQueueVerdict(VEIL_AUDIT);

/** 그것들을 어떻게 다루는가 — 화면과 시나리오가 같은 문장을 쓴다. */
export const IDLE_NOTE =
  '아니다 — 아무 의도도 내지 못한 주체가 있는 것은 위반이 아니다. 겨눌 상대가 없거나 손이 닫혀 있을 뿐이고, 세계는 아무도 손대지 않는 틱에도 굴러간다';
export const CLOSED_NOTE =
  '고리는 주장이 아니라 검사다 — closeLoop 이 의도를 R1 에 실제로 먹여 사건을 세우고 R2 흔적이 나는지를 값으로 낸다. 나지 않으면 고리가 끊긴 것이고 사유가 남는다';

// ─────────────────────────────────────────────────────────────────────────────
// 설 수 없는 것들
// ─────────────────────────────────────────────────────────────────────────────

export interface BrokenIntent {
  readonly broke: string;
  readonly expected: string;
  readonly at: 'aim' | 'form' | 'loop';
  readonly rules: readonly string[];
  readonly messages: readonly string[];
}

const rulesOf = (violations: readonly IntentViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const messagesOf = (violations: readonly IntentViolation[]): readonly string[] =>
  violations.map((violation) => violation.message);

// 결함 표는 **실제로 빼앗기를 낸 손**으로 세운다 — 앞에서 걸리는 손이면 뒤의 사유가 안 보인다.
const someActor = ACTORS.find(
  (actor) => AFTER_ATTEMPTS.some((entry) => entry.subjectId === actor.subjectId && entry.intent !== null),
) as Actor;
const someGoal = goalOf(someActor.subjectId, 'seize', '겨울 식량');

const formWith = (overrides: Partial<Parameters<typeof formIntent>[0]>) =>
  formIntent({
    plan: planOf(someActor.subjectId, 'seize', '겨울 식량'),
    goal: someGoal,
    tick: ACT_TICK,
    grammar: someActor.grammar,
    aim: AIMED_SEIZE?.aim ?? null,
    changes: refsFor('seize', someActor.subjectId, actorId).changes,
    payments: refsFor('seize', someActor.subjectId, actorId).payments,
    observedIds: [actorId],
    ...overrides,
  });

/** 빼앗기를 실제로 낸 시도 하나 — 결함 표의 기준이다. */
const AIMED_SEIZE = AFTER_ATTEMPTS.find((entry) => entry.intent !== null);

/** ① 겨눌 상대가 없다 (말을 듣기 전의 목격자). */
const aimless = BEFORE_ATTEMPTS.find((entry) => entry.aim === null) as Attempt;

/** ② 문법이 닫은 원자를 내려 한다 (상단의 빼앗기). */
const forbidden = formWith({
  plan: planOf(someActor.subjectId, 'seize', '겨울 식량'),
  grammar: CULTURE_CASES[2]?.grammar as PossibilityGrammar,
});

/** ③ 빈 계획. */
const empty = formWith({
  plan: { ...planOf(someActor.subjectId, 'seize', '겨울 식량'), steps: [], atoms: [] },
});

/** ④ 걸음이 전부 막혔다. */
const blocked = formWith({
  plan: {
    ...planOf(someActor.subjectId, 'seize', '겨울 식량'),
    steps: [
      {
        ...(planOf(someActor.subjectId, 'seize', '겨울 식량').steps[0] as PlanStep),
        verdict: 'blocked',
      },
    ],
  },
});

/** ⑤ 상대를 겨누지 않는 원자에 상대를 적는다. */
const misAimed = formWith({
  plan: planOf(someActor.subjectId, 'acquire', '겨울 식량'),
  changes: refsFor('acquire', someActor.subjectId, null).changes,
  payments: refsFor('acquire', someActor.subjectId, null).payments,
});

/** ⑥ 자기 자신을 겨눈다. */
const selfAimed = formWith({
  aim: { ...(AIMED_SEIZE?.aim as Aim), counterpartId: someActor.subjectId },
});

/** ⑦ 공짜 요청 (P0-c 관문이 그대로 잡는다). */
const free = formWith({ payments: [] });

/** ⑧ 한 틱에 둘을 낸다. */
const doubled = (() => {
  const first = INTENTS[0] as ActionIntent;
  const queue = enqueue(openIntentQueue(), [first, { ...first, id: `${first.id}:둘째`, goalId: 'possibility:다른 목적' }]);
  return auditIntents({ queue, subjectIds: CANDIDATES }).violations;
})();

/** ⑨ 세계가 서기 전에 의도를 얹는다. */
const rootless = closeLoop({
  store: { snapshots: [], ledgerHash: null, schema: BASE_STORE.schema },
  log: openLog(),
  intents: INTENTS,
  valuesFor: () => [],
}).violations;

export const BROKEN_INTENTS: readonly BrokenIntent[] = [
  {
    broke: '겨눌 상대가 없는데 등지는 손을 내려 한다',
    expected: 'aimless-intent',
    at: 'aim',
    rules: rulesOf(aimless.violations),
    messages: messagesOf(aimless.violations),
  },
  {
    broke: '문법이 닫은 원자를 내려 한다 (상단의 빼앗기)',
    expected: 'ungrammatical-intent',
    at: 'form',
    rules: rulesOf(forbidden.violations),
    messages: messagesOf(forbidden.violations),
  },
  {
    broke: '빈 계획으로 의도를 세운다',
    expected: 'no-step',
    at: 'form',
    rules: rulesOf(empty.violations),
    messages: messagesOf(empty.violations),
  },
  {
    broke: '걸음이 전부 막힌 계획을 낸다',
    expected: 'blocked-step',
    at: 'form',
    rules: rulesOf(blocked.violations),
    messages: messagesOf(blocked.violations),
  },
  {
    broke: '상대를 겨누지 않는 원자에 상대를 적는다',
    expected: 'targetless-atom',
    at: 'form',
    rules: rulesOf(misAimed.violations),
    messages: messagesOf(misAimed.violations),
  },
  {
    broke: '자기 자신을 겨눈다',
    expected: 'self-aimed',
    at: 'form',
    rules: rulesOf(selfAimed.violations),
    messages: messagesOf(selfAimed.violations),
  },
  {
    broke: '공짜 요청을 낸다',
    expected: 'malformed-request',
    at: 'form',
    rules: rulesOf(free.violations),
    messages: messagesOf(free.violations),
  },
  {
    broke: '한 주체가 한 틱에 둘을 낸다',
    expected: 'unqueued-intent',
    at: 'loop',
    rules: rulesOf(doubled),
    messages: messagesOf(doubled),
  },
  {
    broke: '세계가 서기 전에 의도를 얹는다',
    expected: 'uncaused-event',
    at: 'loop',
    rules: rulesOf(rootless),
    messages: messagesOf(rootless),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 경계
// ─────────────────────────────────────────────────────────────────────────────

/** 빈 의도장은 아무 어긋남도 내지 않는다. */
export const EMPTY_AUDIT: IntentAudit = auditIntents({
  queue: openIntentQueue(),
  subjectIds: CANDIDATES,
});

/** 같은 의도를 두 번 담아도 큐는 그대로다. */
export const IDEMPOTENT = enqueue(VEIL_QUEUE, VEIL_QUEUE.intents) === VEIL_QUEUE;

/** 아무 의도도 내지 못한 주체들 — 사실이다. */
export const IDLE_SUBJECTS: readonly Id[] = VEIL_AUDIT.idle;

/** 들은 셋이 겨눌 수 있게 되기까지 무엇이 필요했는가 — 계층별로 한 줄씩. */
export const CHAIN_NOTES: readonly (readonly [string, string])[] = [
  ['R4', '자국을 보면 믿음이 서지만 누가 냈는지는 실리지 않는다 (truth-copied)'],
  ['R5', '겪은 자만 짚고, 그 지목이 말을 타고 건넌다 — 들은 자에게 원한이 선다'],
  ['R6', '원한이 선 상대만 겨눌 수 있다 — 그래서 말 한 마디가 손을 움직인다'],
];
