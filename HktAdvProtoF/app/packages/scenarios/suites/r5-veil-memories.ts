// R5 검증 장면 — 붉은 장막의 겨울이 지나간 뒤, **누가 누구를 원망하게 되는가**.
//
// R4 는 같은 겨울에 셋을 세우고 "같은 것을 본 셋이 다른 세계에 산다" 를 보였다. 그런데 그 셋은
// 서로를 원망할 수 없었다 — 믿음에는 **누가 냈는지가 없기** 때문이다(`truth-copied` 가 막는다).
// 자국은 열둘 중 하나를 가리킬 뿐 아무 이름도 대지 않는다.
//
// 여기서 그 자리를 갚는다. 세우는 것은 넷이다.
//
//   ① **겪은 자 하나.** 04 가 낸 제거 사건(R1 장면의 다섯째)은 상단 11 의 몸을 0.8 → 0.2 로
//      깎았다. 11 은 그 자국을 보지 않았어도 **제 자리가 움직인 것을 안다** — 그 장부는 제 것이다.
//      그래서 11 만 04 를 짚을 수 있다. **그런데 무엇으로 당했는지는 모른다**(열둘 중 열하나).
//   ② **본 자 셋.** R4 의 목격자들이 협곡에서 읽은 아홉 믿음 중 **여섯이 굳어 기억이 된다** —
//      자국이 삭아 다시 볼 길이 없어졌기 때문이다. 셋 다 지목이 없다.
//   ③ **말 한 마디.** 11 이 마을에서 제 기억을 말한다. 흔적이 나고 셋이 **제 귀로** 듣는다
//      (R4 의 벽은 그대로 선다). 장막벌레는 듣지 못한다 — 귀가 없다.
//   ④ **거친 뒤의 사이.** 듣고 나면 셋은 **04 를 원망한다** — 세계의 장부에는 그들 사이에
//      아무것도 적혀 있지 않은데.
//
// 세계도 사건도 흔적도 믿음도 새로 짓지 않는다. R1 로그·R2 현상장·R4 믿음 그래프를 그대로 쓰고
// 더하는 것은 **11 을 마을에 세우는 것과 귀 없는 이웃 하나**뿐이다.

import { deterministicId, type Id } from '@hkt/core/v1';
import type { State } from '@hkt/core/o1';
import {
  assembleWorld,
  disassembleWorld,
  readSlot,
  slotStateId,
  type WorldState,
} from '@hkt/core/o2';
import { perceptionOf } from '@hkt/core/s1';
import type { ActionAtom } from '@hkt/core/p0';
import type { WorldEvent } from '@hkt/core/r1';
import type { PhenomenonField, WorldPhenomenon } from '@hkt/core/r2';
import { openPerceptField, recordPercepts, sweep, type Observer, type Percept } from '@hkt/core/r3';
import type { Belief } from '@hkt/core/r4';
import {
  RELATION_AXES,
  auditMemories,
  checkHearsay,
  checkMemory,
  checkRegard,
  compareBlame,
  hear,
  liveMemory,
  memoryLedgerVerdict,
  openMemoryLedger,
  openRumorField,
  pushTable,
  recordMemories,
  recordTelling,
  regardLedger,
  regardOf,
  sealAll,
  speak,
  storiesOf,
  storyVariants,
  suffered,
  unattributed,
  unheard,
  unspoken,
  type BlameCheck,
  type Memory,
  type MemoryAudit,
  type MemoryLedger,
  type MemoryViolation,
  type PushRow,
  type RegardLedger,
  type RegardTrace,
  type RelationAxis,
  type Relationship,
  type RumorField,
  type Sealing,
  type Story,
  type Telling,
} from '@hkt/core/r5';

import { veilWormArchetype } from './s1-veil-species.ts';
import { CULTURE_CASES } from './p2-veil-grammars.ts';
import { VEIL_LOG, actorId, rivalId } from './r1-veil-events.ts';
import { NOW, VEIL_FIELD } from './r2-veil-phenomena.ts';
import {
  BELIEVERS,
  LOOK_TICK,
  OBSERVERS,
  VEIL_BELIEFS,
  VEIL_WORLD as WITNESSED_WORLD,
  WITNESS_IDS,
  canyonId,
  hamletId,
} from './r4-veil-beliefs.ts';

export { NOW, LOOK_TICK, WITNESS_IDS, actorId, rivalId, canyonId, hamletId };

/** 말하는 틱과 듣는 틱 — 겨울이 끝나고 다섯 걸음 뒤에 11 이 입을 연다. */
export const SPEAK_TICK = NOW + 20;
export const HEAR_TICK = NOW + 21;
export const RETELL_TICK = NOW + 24;
export const LATER_TICK = NOW + 25;

const slot = (domain: State['domain'], ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 귀가 없는 이웃 — 장막벌레는 냄새와 의념만 읽는다(S1). 말은 그에게 나지 않은 것과 같다. */
export const WORM_ID: Id = deterministicId('subject', 'veilworm', '마을 어귀의 장막벌레');

/** R4 의 세계에 둘을 더한다 — 마을에 선 11 과 귀 없는 이웃. */
export const VEIL_WORLD: WorldState = assembleWorld([
  ...disassembleWorld(WITNESSED_WORLD),
  slot('physical', rivalId, 'region', hamletId),
  slot('physical', WORM_ID, 'region', hamletId),
]).world;

/** 04 가 낸 제거 사건 — R1 장면의 다섯째다. 새로 짓지 않는다. */
export const STRIKE: WorldEvent = VEIL_LOG.events.find(
  (event) => event.atom === 'destroy',
) as WorldEvent;

/** 그 사건이 남긴 흔적들 — 본 자들의 기억이 딛고 설 뿌리다. */
export const STRIKE_TRACES: readonly WorldPhenomenon[] = VEIL_FIELD.phenomena.filter(
  (phenomenon) => phenomenon.causeEventId === STRIKE.id,
);

/** 11 의 손 — 고개를 넘는 상단이다(빼앗지 않는다). P2 가 이미 갈라 둔 문법 그대로. */
const rivalGrammar = CULTURE_CASES[2]?.grammar ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// ① 겪은 자 하나 — 제 자리가 움직인 자만 상대를 짚는다
// ─────────────────────────────────────────────────────────────────────────────

/** 그 사건을 누가 겪었는가 — 화면과 시나리오가 같은 문장을 쓴다. */
export interface SufferedRow {
  readonly label: string;
  readonly subjectId: Id;
  readonly suffered: boolean;
  readonly why: string;
}

export const SUFFERED_ROWS: readonly SufferedRow[] = [
  {
    label: '상단 11 (몸이 깎였다)',
    subjectId: rivalId,
    suffered: suffered(STRIKE, rivalId),
    why: '남이 낸 사건이 제 장부의 한 자리를 바꿨다 — 그 장부는 제 것이다',
  },
  {
    label: '몰이꾼 04 (제 손으로 냈다)',
    subjectId: actorId,
    suffered: suffered(STRIKE, actorId),
    why: '제 손으로 낸 것은 겪음이 아니다 — 그것은 한 일이다',
  },
  ...OBSERVERS.map((observer) => ({
    label: `${observer.label} (협곡에서 보았다)`,
    subjectId: observer.subjectId,
    suffered: suffered(STRIKE, observer.subjectId),
    why: '자국을 보았을 뿐 제 자리는 하나도 움직이지 않았다 — 그래서 누구인지 모른다',
  })),
];

/** 11 의 기억 — 지목은 확실하고 내용은 짐작이다. */
export const LIVED: Memory = liveMemory(STRIKE, rivalId, rivalGrammar).memory as Memory;

// ─────────────────────────────────────────────────────────────────────────────
// ② 본 자 셋 — 다시 볼 수 없게 된 믿음이 기억이 된다
// ─────────────────────────────────────────────────────────────────────────────

const sealed = sealAll(VEIL_BELIEFS, VEIL_FIELD, LATER_TICK);

/** 굳은 것과 굳지 않은 것 — 사유가 함께 선다. */
export const SEALINGS: readonly Sealing[] = sealed.sealings;
/** 자국이 삭아 기억이 된 믿음들. */
export const SEEN_MEMORIES: readonly Memory[] = sealed.memories;
/** 아직 서 있는 자국의 믿음들 — 기억이 되지 않는다. 가서 보면 되기 때문이다. */
export const STILL_BELIEFS: readonly Belief[] = SEALINGS.filter(
  (sealing) => sealing.memory === null,
).map((sealing) => sealing.belief);

// ─────────────────────────────────────────────────────────────────────────────
// ③ 말 한 마디 — 말은 흔적이 되고 듣는 자는 제 귀로 읽는다
// ─────────────────────────────────────────────────────────────────────────────

const said = speak({
  memory: LIVED,
  speakerId: rivalId,
  tick: SPEAK_TICK,
  placeId: hamletId,
  causeEventId: STRIKE.id,
  actualAtom: STRIKE.atom,
  actualActorId: STRIKE.actorId as Id,
});

export const FIRST_TELLING: Telling = said.telling as Telling;
export const FIRST_RUMOR: WorldPhenomenon = said.phenomenon as WorldPhenomenon;

/** 귀 없는 이웃 — 종이 열어 준 통로에 보고가 없다 (S1 장막벌레). */
export const WORM_LISTENER: Observer = {
  subjectId: WORM_ID,
  label: '마을 어귀의 장막벌레 (귀가 없다)',
  perception: perceptionOf(veilWormArchetype.senses, 1),
};

/** 말을 들을 수 있는 자리에 선 넷 — 눈은 R3 이 준 것 그대로다. */
export const LISTENERS: readonly Observer[] = [...OBSERVERS, WORM_LISTENER];

const rumorFieldOf = (phenomena: readonly WorldPhenomenon[]): PhenomenonField =>
  ({ phenomena }) as PhenomenonField;

const firstSweep = sweep(LISTENERS, rumorFieldOf([FIRST_RUMOR]), VEIL_WORLD, HEAR_TICK);

/** 누가 듣고 누가 못 듣는가 — 못 들은 칸에는 왜 못 들었는지가 선다. */
export interface HearingRow {
  readonly label: string;
  readonly subjectId: Id;
  readonly heard: boolean;
  readonly message: string;
}

export const HEARING_ROWS: readonly HearingRow[] = firstSweep.sweeps.map((entry) => ({
  label: entry.observer.label,
  subjectId: entry.observer.subjectId,
  heard: entry.percepts.length > 0,
  message: entry.attempts[0]?.message ?? '',
}));

const heardPercepts: readonly Percept[] = firstSweep.field.percepts;

/** 들은 셋의 기억 — 내용은 제 손이 좁히고 지목은 그대로 온다. */
const hearings = BELIEVERS.map((believer) => {
  const percept = heardPercepts.find((entry) => entry.subjectId === believer.subjectId);
  if (percept === undefined) return null;
  const result = hear(percept, FIRST_TELLING, believer.grammar);
  return result.memory === null ? null : { believer, percept, memory: result.memory };
}).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

export const TOLD_MEMORIES: readonly Memory[] = hearings.map((entry) => entry.memory);

/** 들은 것이 어떻게 갈리는가 — 같은 말인데 셋이 다른 것을 지닌다. */
export interface HearsayRow {
  readonly label: string;
  readonly said: number;
  readonly kept: number;
  readonly dropped: readonly ActionAtom[];
  readonly blames: Id | null;
  readonly confidence: number;
  readonly hops: number;
  readonly tells: string;
}

export const HEARSAY_ROWS: readonly HearsayRow[] = hearings.map((entry, index) => ({
  label: entry.believer.label,
  said: FIRST_TELLING.claim.length,
  kept: entry.memory.suspected.length,
  dropped: FIRST_TELLING.claim.filter((atom) => !entry.memory.suspected.includes(atom)),
  blames: entry.memory.attribution?.subjectId ?? null,
  confidence: entry.memory.confidence,
  hops: entry.memory.hops,
  tells: CULTURE_CASES[index]?.tells ?? '',
}));

// 사제가 들은 것을 다시 말한다 — 그런데 아무도 듣지 못한다.
const priestMemory = hearings.find((entry) => entry.believer.subjectId === WITNESS_IDS.priest)
  ?.memory as Memory;

const retold = speak({
  memory: priestMemory,
  speakerId: WITNESS_IDS.priest,
  tick: RETELL_TICK,
  placeId: canyonId,
  causeEventId: STRIKE.id,
  actualAtom: STRIKE.atom,
  actualActorId: STRIKE.actorId as Id,
});

export const SECOND_TELLING: Telling = retold.telling as Telling;
export const SECOND_RUMOR: WorldPhenomenon = retold.phenomenon as WorldPhenomenon;

const secondSweep = sweep(LISTENERS, rumorFieldOf([SECOND_RUMOR]), VEIL_WORLD, LATER_TICK);

/** 두 번째 말은 누가 듣는가 — **아무도 못 듣는다.** 그리고 그 사유가 R5 의 것이 아니다. */
export const RETELL_ROWS: readonly HearingRow[] = secondSweep.sweeps.map((entry) => ({
  label: entry.observer.label,
  subjectId: entry.observer.subjectId,
  heard: entry.percepts.length > 0,
  message: entry.attempts[0]?.message ?? '',
}));

/** 말이 한 입을 건너며 어떻게 옅어지는가. */
export interface FadeRow {
  readonly step: string;
  readonly intensity: number;
  readonly carried: number;
  readonly threshold: number;
  readonly heardBy: number;
}

export const FADE_ROWS: readonly FadeRow[] = [
  {
    step: '① 겪은 자가 말한다 (11)',
    intensity: FIRST_RUMOR.intensity,
    carried: FIRST_TELLING.confidence,
    threshold: 0.5,
    heardBy: HEARING_ROWS.filter((row) => row.heard).length,
  },
  {
    step: '② 들은 자가 다시 말한다 (사제)',
    intensity: SECOND_RUMOR.intensity,
    carried: SECOND_TELLING.confidence,
    threshold: 0.5,
    heardBy: RETELL_ROWS.filter((row) => row.heard).length,
  },
];

/** 소문장 — 두 마디와 그 흔적들. */
export const VEIL_RUMORS: RumorField = recordTelling(
  recordTelling(openRumorField(), FIRST_TELLING, FIRST_RUMOR),
  SECOND_TELLING,
  SECOND_RUMOR,
);

/** 들린 흔적들 — 두 번째 말은 여기에 없다. */
export const HEARD_PHENOMENON_IDS: readonly Id[] = [
  ...heardPercepts.map((percept) => percept.phenomenonId),
  ...secondSweep.field.percepts.map((percept) => percept.phenomenonId),
];

export const VEIL_PERCEPTS = recordPercepts(openPerceptField(), heardPercepts);

// ─────────────────────────────────────────────────────────────────────────────
// 기억장과 감사
// ─────────────────────────────────────────────────────────────────────────────

export const VEIL_MEMORIES: MemoryLedger = recordMemories(openMemoryLedger(), [
  LIVED,
  ...SEEN_MEMORIES,
  ...TOLD_MEMORIES,
]);

/** 이름표 — 화면과 시나리오가 같은 문장을 쓴다. */
export const LABELS: ReadonlyMap<Id, string> = new Map<Id, string>([
  [actorId, '몰이꾼 04'],
  [rivalId, '상단 11'],
  [WORM_ID, '장막벌레'],
  ...OBSERVERS.map((observer) => [observer.subjectId, observer.label] as const),
]);

/** 그 사건에서 비롯된 뿌리들 — 사건 하나와 그것이 남긴 흔적들. */
export const STRIKE_ROOTS: readonly Id[] = [STRIKE.id, ...STRIKE_TRACES.map((entry) => entry.id)];

/** 하나의 사건이 몇 개의 이야기가 되었는가 (원문 §20). */
export const STORIES: readonly Story[] = storiesOf(
  VEIL_MEMORIES.memories,
  STRIKE_ROOTS,
  LABELS,
);
export const STORY_VARIANTS = storyVariants(STORIES);

/** 지목을 실제와 대조한 결과 — **감사만 본다.** */
export const BLAME_CHECKS: readonly BlameCheck[] = compareBlame(
  VEIL_MEMORIES,
  new Map(STRIKE_ROOTS.map((rootId) => [rootId, STRIKE.actorId as Id])),
  LABELS,
);

// ─────────────────────────────────────────────────────────────────────────────
// ④ 사이 — 적힌 것과 지닌 것이 갈린다
// ─────────────────────────────────────────────────────────────────────────────

/** 사이가 걸리는 주체들 — 04 · 11 · 목격자 셋. */
export const REGARD_SUBJECTS: readonly Id[] = [
  actorId,
  rivalId,
  ...OBSERVERS.map((observer) => observer.subjectId),
];

/** 말을 듣기 **전**의 사이 — 겪은 11 하나만 움직인다. */
export const BEFORE_RUMOR: RegardLedger = regardLedger(
  [LIVED, ...SEEN_MEMORIES],
  VEIL_WORLD,
  REGARD_SUBJECTS,
);

/** 말을 들은 **뒤**의 사이 — 겪지 않은 셋도 04 를 원망한다. */
export const AFTER_RUMOR: RegardLedger = regardLedger(
  VEIL_MEMORIES.memories,
  VEIL_WORLD,
  REGARD_SUBJECTS,
);

/** 원자 열여섯이 사이 여섯 축을 어떻게 미는가 — 전부 P0-b 에서 읽어 온 표다. */
export const PUSH_TABLE: readonly PushRow[] = pushTable([
  'seek',
  'acquire',
  'produce',
  'exchange',
  'seize',
  'protect',
  'destroy',
  'conceal',
  'investigate',
  'persuade',
  'coerce',
  'ally',
  'betray',
  'adapt',
  'substitute',
  'shed',
]);

/** 04 에 대한 사이 한 줄 — 누가 무엇을 근거로 얼마나 원망하는가. */
export interface RegardRow {
  readonly label: string;
  readonly axis: RelationAxis;
  readonly written: number;
  readonly carried: number;
  readonly value: number;
  readonly drift: number;
  readonly traces: readonly RegardTrace[];
}

const rowsToward = (ledger: RegardLedger, axis: RelationAxis): readonly RegardRow[] =>
  ledger.relationships
    .filter((entry) => entry.toId === actorId && entry.axis === axis)
    .map((entry) => ({
      label: LABELS.get(entry.fromId) ?? entry.fromId,
      axis: entry.axis,
      written: entry.written,
      carried: entry.carried,
      value: entry.value,
      drift: entry.drift,
      traces: entry.traces,
    }));

/** 04 를 향한 원한 — 말하기 전에는 하나, 들은 뒤에는 넷. */
export const GRUDGE_BEFORE: readonly RegardRow[] = rowsToward(BEFORE_RUMOR, 'grudge');
export const GRUDGE_AFTER: readonly RegardRow[] = rowsToward(AFTER_RUMOR, 'grudge');

/**
 * P4-b 가 사이를 읽는 방식 — **적힌 상대들의 평균**이다 (`p4/factor.ts` `relationAverage`).
 *
 * P4 가 남긴 부채를 값으로 세우기 위해 같은 셈을 여기서 그대로 되풀이한다. **P4 를 고치지
 * 않는다** — 그것을 실제로 먹이는 것은 R6 의 일이고, 여기서는 두 값이 얼마나 다른지를 보인다.
 */
export function writtenAverage(
  world: WorldState,
  subjectId: Id,
  counterparts: readonly Id[],
  axis: RelationAxis,
): number {
  const values = counterparts
    .map((other) => readSlot(world, 'relational', subjectId, `${axis}.${other}`))
    .filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 평균으로 읽는 것과 지목해 읽는 것 — 같은 주체·같은 축에서 값이 갈린다. */
export interface PointedRow {
  readonly label: string;
  readonly axis: RelationAxis;
  /** P4-b 방식 — 적힌 상대들의 평균 */
  readonly average: number;
  /** R5 방식 — 04 를 지목해 읽은 값 */
  readonly pointed: number;
  readonly gap: number;
}

export const POINTED_ROWS: readonly PointedRow[] = REGARD_SUBJECTS.filter(
  (subjectId) => subjectId !== actorId,
).flatMap((subjectId) => {
  const counterparts = REGARD_SUBJECTS.filter((other) => other !== subjectId);
  return (['trust', 'grudge'] as const).map((axis) => {
    const pointed = regardOf(VEIL_MEMORIES.memories, VEIL_WORLD, subjectId, actorId).find(
      (entry) => entry.axis === axis,
    ) as Relationship;
    const average = writtenAverage(VEIL_WORLD, subjectId, counterparts, axis);
    return {
      label: LABELS.get(subjectId) ?? subjectId,
      axis,
      average,
      pointed: pointed.value,
      gap: pointed.value - average,
    };
  });
});

/** 기억장 감사 — 위반과 사실을 가른다. */
export const VEIL_AUDIT: MemoryAudit = auditMemories({
  ledger: VEIL_MEMORIES,
  rumors: VEIL_RUMORS,
  heardPhenomenonIds: HEARD_PHENOMENON_IDS,
  tick: LATER_TICK,
  regard: AFTER_RUMOR,
});

export const AUDIT_VERDICT = memoryLedgerVerdict(VEIL_AUDIT);

/** 아무도 듣지 못한 말 — 위반이 아니라 사실이다. */
export const UNHEARD_TELLINGS: readonly Telling[] = unheard(VEIL_RUMORS, HEARD_PHENOMENON_IDS);
/** 아무도 말하지 않은 기억 — 품고만 있는 것이 대부분이다. */
export const UNSPOKEN_MEMORIES: readonly Memory[] = unspoken(VEIL_MEMORIES, VEIL_RUMORS);
/** 지목 없는 기억 — 밖에서 본 자는 누구인지 모른다. */
export const UNATTRIBUTED_MEMORIES: readonly Memory[] = unattributed(VEIL_MEMORIES);

/** 그것들을 어떻게 다루는가 — 화면과 시나리오가 같은 문장을 쓴다. */
export const SILENT_NOTE =
  '아니다 — 아무도 듣지 못한 말은 위반이 아니다. 세계는 아무도 안 들을 때도 말해지고, 문턱을 못 넘는 말은 아무 데도 닿지 않은 채 삭는다';
export const BLIND_NOTE =
  '아니다 — 지목 없는 기억이 대부분이다. 이것을 위반으로 세면 모든 목격자가 곧바로 범인을 아는 세계가 되고 소문이 설 자리가 없다';
export const WRONG_NOTE =
  '아니다 — 빗나간 지목을 막으면 R5 는 전언이 아니라 한 입 늦은 전지(全知)가 되고, R4 가 빗나간 믿음을 허용한 이유가 통째로 사라진다';

// ─────────────────────────────────────────────────────────────────────────────
// 설 수 없는 것들
// ─────────────────────────────────────────────────────────────────────────────

export interface BrokenMemory {
  readonly broke: string;
  readonly expected: string;
  /** 세우는 자리에서 걸리는가(form), 검사할 때 걸리는가(audit) */
  readonly at: 'form' | 'audit';
  readonly rules: readonly string[];
  readonly messages: readonly string[];
}

const rulesOf = (violations: readonly MemoryViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const messagesOf = (violations: readonly MemoryViolation[]): readonly string[] =>
  violations.map((violation) => violation.message);

const checkOne = (memory: Memory, tick = LATER_TICK): readonly MemoryViolation[] => {
  const out: MemoryViolation[] = [];
  checkMemory(memory, out, { tick });
  return out;
};

const anySeen = SEEN_MEMORIES[0] as Memory;
const anyTold = TOLD_MEMORIES[0] as Memory;

/** ① 겪지도 않은 사건으로 지목을 세운다. */
const notLived = liveMemory(STRIKE, WITNESS_IDS.tracker, null);

/** ② 아직 서 있는 자국의 믿음을 굳히려 한다. */
const stillStanding = (() => {
  const belief = STILL_BELIEFS[0] as Belief;
  const phenomenon = VEIL_FIELD.phenomena.find(
    (entry) => entry.id === belief.aboutId && entry.decaysAtTick === null,
  );
  const out: MemoryViolation[] = [];
  if (phenomenon !== undefined) {
    const sealedOne = sealAll(
      { beliefs: [belief], bySubject: new Map(), byPhenomenon: new Map() },
      VEIL_FIELD,
      LATER_TICK,
    );
    if (sealedOne.memories.length === 0) {
      out.push({
        rule: 'unsealed-memory',
        subject: belief.holderId,
        path: '$.belief',
        message: sealedOne.sealings[0]?.reason ?? '',
      });
    }
  }
  return out;
})();

/** ③ 본 것만으로 상대를 짚는다. */
const guessedBlame = checkOne({
  ...anySeen,
  attribution: {
    subjectId: actorId,
    source: 'told',
    eventId: null,
    viaIds: [rivalId],
    note: '',
  },
});

/** ④ 기억이 바랜다 (확신을 손으로 고친다). */
const drifted = checkOne({ ...LIVED, confidence: 0.99 });

/** ⑤ 근거 없이 선 기억. */
const groundless = checkOne({ ...LIVED, sourceIds: [] });

/** ⑥ 지닌 자가 없는 기억. */
const unheld = checkOne({ ...LIVED, holderId: '' });

/** ⑦ 아직 오지 않은 일의 기억. */
const future = checkOne(LIVED, STRIKE.tick - 1);

/** ⑧ 후보 밖의 원자를 짚는다. */
const offCandidate = checkOne({ ...LIVED, suspected: ['persuade'] });

/** ⑨ 믿음에 없던 진실이 실린다. */
const leaked = checkOne({ ...LIVED, actorId: STRIKE.actorId } as unknown as Memory);

/** ⑩ 지니지 않은 기억을 말한다. */
const stolenTelling = speak({
  memory: LIVED,
  speakerId: WITNESS_IDS.priest,
  tick: SPEAK_TICK,
  placeId: hamletId,
  causeEventId: STRIKE.id,
  actualAtom: STRIKE.atom,
  actualActorId: STRIKE.actorId as Id,
});

/** ⑪ 듣지 않은 말에서 기억을 세운다 (R4 의 벽). */
const notHeard = hear(
  { ...(heardPercepts[0] as Percept), phenomenonId: SECOND_RUMOR.id },
  FIRST_TELLING,
  null,
);

/** ⑫ 거쳐서 내용을 넓힌다. */
const widened = (() => {
  const out: MemoryViolation[] = [];
  checkHearsay({ ...anyTold, suspected: [...anyTold.suspected, 'persuade'] }, FIRST_TELLING, out);
  return out;
})();

/** ⑬ 거쳐서 진해진다. */
const louder = (() => {
  const out: MemoryViolation[] = [];
  checkHearsay({ ...anyTold, carried: 1 }, FIRST_TELLING, out);
  return out;
})();

/** ⑭ 지목 없는 기억이 사이를 민다. */
const forcedRegard = (() => {
  const relationship = AFTER_RUMOR.relationships.find(
    (entry) => entry.axis === 'grudge',
  ) as Relationship;
  const out: MemoryViolation[] = [];
  checkRegard(
    relationship,
    VEIL_MEMORIES.memories.map((memory) => ({ ...memory, attribution: null })),
    out,
  );
  return out;
})();

/** ⑮ O2 가 적어 두지 않은 축으로 사이를 센다. */
const unknownAxis = (() => {
  const relationship = AFTER_RUMOR.relationships[0] as Relationship;
  const out: MemoryViolation[] = [];
  checkRegard({ ...relationship, axis: 'envy' as RelationAxis }, VEIL_MEMORIES.memories, out);
  return out;
})();

export const BROKEN_MEMORIES: readonly BrokenMemory[] = [
  {
    broke: '겪지 않은 사건으로 지목을 세운다',
    expected: 'unlived-attribution',
    at: 'form',
    rules: rulesOf(notLived.violations),
    messages: messagesOf(notLived.violations),
  },
  {
    broke: '아직 서 있는 자국의 믿음을 기억으로 굳힌다',
    expected: 'unsealed-memory',
    at: 'form',
    rules: rulesOf(stillStanding),
    messages: messagesOf(stillStanding),
  },
  {
    broke: '본 것만으로 상대를 짚는다',
    expected: 'guessed-attribution',
    at: 'audit',
    rules: rulesOf(guessedBlame),
    messages: messagesOf(guessedBlame),
  },
  {
    broke: '확신을 손으로 고친다 (기억이 바랜다)',
    expected: 'memory-drift',
    at: 'audit',
    rules: rulesOf(drifted),
    messages: messagesOf(drifted),
  },
  {
    broke: '근거 없이 기억한다',
    expected: 'groundless-memory',
    at: 'audit',
    rules: rulesOf(groundless),
    messages: messagesOf(groundless),
  },
  {
    broke: '지닌 자가 없는 기억을 적는다',
    expected: 'unheld-memory',
    at: 'audit',
    rules: rulesOf(unheld),
    messages: messagesOf(unheld),
  },
  {
    broke: '아직 오지 않은 일을 기억한다',
    expected: 'future-memory',
    at: 'audit',
    rules: rulesOf(future),
    messages: messagesOf(future),
  },
  {
    broke: '후보 밖의 원자를 짚는다',
    expected: 'memory-truth-copied',
    at: 'audit',
    rules: rulesOf(offCandidate),
    messages: messagesOf(offCandidate),
  },
  {
    broke: '믿음에 없던 진실(누가 냈는지)을 기억에 싣는다',
    expected: 'memory-truth-copied',
    at: 'audit',
    rules: rulesOf(leaked),
    messages: messagesOf(leaked),
  },
  {
    broke: '지니지 않은 기억을 말한다',
    expected: 'unspoken-telling',
    at: 'form',
    rules: rulesOf(stolenTelling.violations),
    messages: messagesOf(stolenTelling.violations),
  },
  {
    broke: '듣지 않은 말에서 기억을 세운다 (R4 의 벽)',
    expected: 'unheard-telling',
    at: 'form',
    rules: rulesOf(notHeard.violations),
    messages: messagesOf(notHeard.violations),
  },
  {
    broke: '거쳐서 내용을 넓힌다',
    expected: 'widened-hearsay',
    at: 'audit',
    rules: rulesOf(widened),
    messages: messagesOf(widened),
  },
  {
    broke: '거쳐서 진해진다',
    expected: 'louder-hearsay',
    at: 'audit',
    rules: rulesOf(louder),
    messages: messagesOf(louder),
  },
  {
    broke: '지목 없는 기억이 사이를 민다',
    expected: 'unattributed-regard',
    at: 'audit',
    rules: rulesOf(forcedRegard),
    messages: messagesOf(forcedRegard),
  },
  {
    broke: 'O2 가 적어 두지 않은 축으로 사이를 센다',
    expected: 'unknown-axis',
    at: 'audit',
    rules: rulesOf(unknownAxis),
    messages: messagesOf(unknownAxis),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 경계
// ─────────────────────────────────────────────────────────────────────────────

/** 빈 기억장은 아무 어긋남도 내지 않는다. */
export const EMPTY_AUDIT: MemoryAudit = auditMemories({
  ledger: openMemoryLedger(),
  rumors: openRumorField(),
  heardPhenomenonIds: [],
  tick: LATER_TICK,
});

/** 같은 기억을 두 번 담아도 늘지 않는다. */
export const IDEMPOTENT =
  recordMemories(VEIL_MEMORIES, VEIL_MEMORIES.memories) === VEIL_MEMORIES;

/** 아무도 겪지 않고 아무도 못 본 세계에서는 사이가 하나도 움직이지 않는다. */
export const EMPTY_REGARD: RegardLedger = regardLedger([], VEIL_WORLD, REGARD_SUBJECTS);

/** 축은 여섯이다 — 화면과 시나리오가 같은 목록을 쓴다. */
export const AXES: readonly RelationAxis[] = RELATION_AXES;
