// R4 검증 장면 — 붉은 장막의 겨울이 남긴 자국을 셋이 **무엇으로 읽는가**.
//
// R3 은 넷을 세워 "누가 읽는가" 를 갈랐다. 그러나 거기서 갈린 것은 **종**이었다 — 사냥꾼은
// 자국을 보고 장막벌레는 냄새를 맡았으며, 몸 없는 둘은 아무것도 몰랐다. 눈이 다르면 다른
// 세계를 사는 것은 당연하다.
//
// 이 장면은 그 다음을 묻는다. **눈이 같으면 같은 세계를 사는가.**
//
// 그래서 협곡에 셋을 세운다 — 같은 사냥꾼 종, 같은 감각, 같은 자리. 다른 것은 **손**뿐이다
// (P2 가 이미 갈라 놓은 셋: 자국을 쫓는 자들·어미를 섬기는 자들·고개를 넘는 상단).
//
//   ① **같은 자국을 읽고 셋의 짐작이 갈린다.** 후보는 통로가 정하므로 셋에게 같고(열둘),
//      좁힘은 문법이 정하므로 셋이 다르다.
//   ② **사제의 짐작에는 죽임이 없다.** 그런데 그 자국을 낸 것은 제거다 — 그래서 사제는 틀린다.
//      낼 손이 없는 일은 떠오르지도 않는다.
//   ③ **더 좁게 짚은 자가 더 확신하는데 틀렸다.** 확신은 옳음과 무관하다 (O1 `Claim` 이
//      "확신 1 도 틀릴 수 있다" 고 적어 둔 그 자리다).
//   ④ **사라지지 않는 자국은 다시 읽힌다** — 두 번째 읽기는 새 믿음이 아니라 굳은 같은 믿음이다.
//   ⑤ **아무도 아무것도 믿지 않는 흔적이 남고, 삭은 자국 위의 믿음은 남는다.** 둘 다 사실이다.
//
// 세계도 흔적도 새로 짓지 않는다 — R2 장면의 현상장(`VEIL_FIELD`)과 R3 장면의 세계를 그대로 쓰고,
// 더하는 것은 **협곡에 선 셋과 그들의 문법**뿐이다. 셋 중 누구도 그 사건을 일으킨 자가 아니다
// (일으킨 자가 제 일을 아는가는 R4 가 묻지 않는다 — 기억은 R5 의 자리다).

import { deterministicId, type Id } from '@hkt/core/v1';
import type { State } from '@hkt/core/o1';
import { assembleWorld, disassembleWorld, slotStateId, type WorldState } from '@hkt/core/o2';
import { perceptionOf } from '@hkt/core/s1';
import { latest, type WorldStateSnapshot } from '@hkt/core/r0';
import { standingAt, type WorldPhenomenon } from '@hkt/core/r2';
import {
  openPerceptField,
  recordPercepts,
  sweep,
  type Observer,
  type Percept,
  type PerceptField,
} from '@hkt/core/r3';
import {
  CHANNEL_GUESSES,
  auditBeliefs,
  checkBelief,
  checkGuesses,
  compareToTruth,
  confidenceCap,
  confidenceFactors,
  confidenceOf,
  formBelief,
  interpret,
  openBeliefGraph,
  readingTable,
  reinforce,
  staleBeliefs,
  unbelieved,
  type Belief,
  type BeliefAudit,
  type BeliefCheck,
  type BeliefGraph,
  type BeliefViolation,
  type Believer,
  type GuessReport,
  type Reading,
  type ReadingRow,
} from '@hkt/core/r4';

import type { ActionAtom } from '@hkt/core/p0';

import { hunterArchetype } from './s1-veil-species.ts';
import { CULTURE_CASES } from './p2-veil-grammars.ts';
import { NOW, VEIL_FIELD, VEIL_STORE, actorId } from './r2-veil-phenomena.ts';
import { canyonId, hamletId } from './d4-veil-world.ts';
import { CANYON_TO_HAMLET, LOOK_TICK } from './r3-veil-perception.ts';

export { NOW, LOOK_TICK, VEIL_FIELD, actorId, canyonId, hamletId };

/** 겨울이 끝난 뒤의 세계 — R2·R3 이 쓴 그 세계다. */
const winterWorld = (latest(VEIL_STORE) as WorldStateSnapshot).world;

const slot = (domain: State['domain'], ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

const witnessId = (name: string): Id => deterministicId('subject', 'person', name);

/** 협곡에 선 셋 — 같은 종, 같은 눈, 다른 손. 누구도 그 사건을 일으킨 자가 아니다. */
export const WITNESS_IDS = {
  tracker: witnessId('겨울의 목격자 · 몰이꾼'),
  priest: witnessId('겨울의 목격자 · 사제'),
  trader: witnessId('겨울의 목격자 · 상단'),
} as const;

/** 셋을 협곡에 세운 세계 — 거리는 R3 이 적어 둔 값을 그대로 쓴다. */
export const VEIL_WORLD: WorldState = assembleWorld([
  ...disassembleWorld(winterWorld),
  slot('physical', canyonId, `distance.${hamletId}`, CANYON_TO_HAMLET),
  slot('physical', WITNESS_IDS.tracker, 'region', canyonId),
  slot('physical', WITNESS_IDS.priest, 'region', canyonId),
  slot('physical', WITNESS_IDS.trader, 'region', canyonId),
]).world;

/** 사냥꾼 종의 눈 — 성체 기준. 셋이 같은 눈을 쓴다(갈리는 것이 손뿐이어야 한다). */
const hunterEyes = perceptionOf(hunterArchetype.senses, 1);

/** 셋의 관측자 자리 (R3) — 감각·선 곳이 같다. */
export const OBSERVERS: readonly Observer[] = [
  { subjectId: WITNESS_IDS.tracker, label: '몰이꾼 (자국을 쫓는 자들)', perception: hunterEyes },
  { subjectId: WITNESS_IDS.priest, label: '사제 (어미를 섬기는 자들)', perception: hunterEyes },
  { subjectId: WITNESS_IDS.trader, label: '상단 (고개를 넘는 자들)', perception: hunterEyes },
];

/** 셋의 믿는 자 자리 (R4) — 문법이 P2 에서 그대로 온다. */
export const BELIEVERS: readonly Believer[] = OBSERVERS.map((observer, index) => ({
  subjectId: observer.subjectId,
  label: observer.label,
  grammar: CULTURE_CASES[index]?.grammar ?? null,
}));

/** 셋이 무엇을 하지 않는가 — 화면과 시나리오가 같은 문장을 쓴다 (P2 가 정한 것이다). */
export const HANDS: readonly { readonly label: string; readonly tells: string }[] =
  CULTURE_CASES.map((entry, index) => ({
    label: OBSERVERS[index]?.label ?? entry.label,
    tells: entry.tells,
  }));

/**
 * 셋이 겨울을 **세 번** 둘러본다 — 흔적은 났다가 삭으므로 언제 보느냐가 무엇을 보느냐다.
 *
 * 406 두 걸음 뒤   빛 0.29 (창고가 움직인 자국)
 * 409 세 걸음 뒤   빛 0.29 를 **다시** 보고, 빛 0.21 을 새로 본다
 * 415 다섯 걸음 뒤 앞의 빛들은 이미 삭았고, 사라지지 않는 자국 하나가 남아 있다
 */
export interface Look {
  readonly tick: number;
  readonly note: string;
  readonly standing: number;
  readonly read: number;
}

const LOOK_TICKS: readonly (readonly [number, string])[] = [
  [NOW + 6, '두 걸음 뒤'],
  [NOW + 9, '세 걸음 뒤'],
  [LOOK_TICK, '다섯 걸음 뒤'],
];

const walked = LOOK_TICKS.reduce<{
  percepts: PerceptField;
  graph: BeliefGraph;
  readings: Reading[];
  looks: Look[];
}>(
  (acc, [tick, note]) => {
    const look = sweep(OBSERVERS, VEIL_FIELD, VEIL_WORLD, tick);
    const percepts = recordPercepts(acc.percepts, look.field.percepts);
    const read = interpret(BELIEVERS, look.field, acc.graph);
    return {
      percepts,
      graph: read.graph,
      readings: [...acc.readings, ...read.readings],
      looks: [
        ...acc.looks,
        {
          tick,
          note,
          standing: standingAt(VEIL_FIELD, tick).length,
          read: look.field.percepts.length,
        },
      ],
    };
  },
  { percepts: openPerceptField(), graph: openBeliefGraph(), readings: [], looks: [] },
);

/** 세 번의 둘러봄 — 언제 보느냐가 무엇을 보느냐다. */
export const LOOKS: readonly Look[] = walked.looks;
/** 셋이 읽은 것 전부 — 눈도 자리도 같으므로 **읽는 것도 같다**. */
export const VEIL_PERCEPTS: PerceptField = walked.percepts;
/** 마지막 둘러봄의 틱에 서 있던 흔적들. */
export const STANDING: readonly WorldPhenomenon[] = standingAt(VEIL_FIELD, LOOK_TICK);
/** 세 번을 통틀어 주체별로 읽은 것의 수 — 셋이 같아야 한다. */
export const READ_COUNTS: readonly (readonly [string, number])[] = BELIEVERS.map((believer) => [
  believer.label,
  (VEIL_PERCEPTS.bySubject.get(believer.subjectId) ?? []).length,
]);

/** 셋의 믿음. */
export const VEIL_BELIEFS: BeliefGraph = walked.graph;
export const READINGS: readonly Reading[] = walked.readings;
/** 흔적마다 셋이 무엇으로 읽는가 (+ 실제) — Lab 대조표의 재료. */
export const READING_TABLE: readonly ReadingRow[] = readingTable(
  VEIL_BELIEFS,
  VEIL_FIELD.phenomena,
  BELIEVERS,
);
/** 실제와의 대조 — **감사의 열이다**. */
export const TRUTH_CHECKS: readonly BeliefCheck[] = compareToTruth(
  VEIL_BELIEFS,
  VEIL_FIELD.phenomena,
  new Map(BELIEVERS.map((believer) => [believer.subjectId, believer.label])),
);
/** 믿음 그래프 감사 (마지막 둘러봄의 틱에서). */
export const VEIL_AUDIT: BeliefAudit = auditBeliefs(
  VEIL_BELIEFS,
  VEIL_PERCEPTS,
  VEIL_FIELD,
  BELIEVERS,
  LOOK_TICK,
);
/** 통로별 후보표 검사 (R4-a). */
export const GUESSES: GuessReport = checkGuesses();
export const GUESS_TABLE = CHANNEL_GUESSES;

/** 아무도 아무것도 믿지 않는 흔적들 — 위반이 아니라 사실이다. */
export const UNBELIEVED: readonly WorldPhenomenon[] = unbelieved(VEIL_BELIEFS, STANDING);
/** 그것을 어떻게 다루는가 — 화면과 시나리오가 같은 문장을 쓴다. */
export const SILENT_NOTE =
  '아니다 — 읽지 못한 것에는 믿음이 서지 않는다. 세계는 아무도 짐작하지 못하는 채로도 굴러간다';
/** 빗나간 믿음을 어떻게 다루는가. */
export const WRONG_NOTE =
  '아니다 — 빗나간 짐작을 막으면 R4 는 짐작이 아니라 한 틱 늦은 전지(全知)가 되고, 원문 §6.1 이 갈라 놓은 "객관적 상태와 관찰된 현상" 이 도로 붙는다';
/** 삭은 자국 위에 남는 믿음을 어떻게 다루는가. */
export const STALE_NOTE =
  '아니다 — 자국은 삭아도 믿음은 남는다. 사라진 창고가 기억에 남는 것과 같은 자리이고(P3-b), 세계가 바뀔 때마다 모두의 머릿속이 함께 고쳐지면 오래된 오해가 설 자리가 없다';

/** 셋의 믿음을 나란히 (같은 흔적에 대해). */
export interface BeliefRow {
  readonly label: string;
  readonly assertion: string;
  readonly suspected: number;
  readonly confidence: number;
  readonly verdict: BeliefCheck['verdict'];
  readonly missing: readonly ActionAtom[];
  readonly tells: string;
}

/** 사라지지 않는 자국 하나 — 셋이 전부 읽은 것이고, 실제로는 제거가 냈다. */
export const SHARED_TRACE: WorldPhenomenon = STANDING.find(
  (phenomenon) => phenomenon.channel === 'trace' && phenomenon.decaysAtTick === null,
) as WorldPhenomenon;

/** 옅게 본 뒤 다시 본 자국 하나 — 재관측이 확신을 올리는 자리다. */
export const REREAD_TRACE: WorldPhenomenon = VEIL_FIELD.phenomena.find(
  (phenomenon) => phenomenon.channel === 'light' && phenomenon.atTick === NOW + 6,
) as WorldPhenomenon;

function rowsFor(phenomenon: WorldPhenomenon): readonly BeliefRow[] {
  return BELIEVERS.map((believer, index) => {
    const belief = VEIL_BELIEFS.beliefs.find(
      (entry) => entry.holderId === believer.subjectId && entry.aboutId === phenomenon.id,
    );
    const check = TRUTH_CHECKS.find(
      (entry) => entry.subjectId === believer.subjectId && entry.phenomenonId === phenomenon.id,
    );
    return {
      label: believer.label,
      assertion: belief?.assertion ?? '(읽지 못했다)',
      suspected: belief?.suspected.length ?? 0,
      confidence: belief?.confidence ?? 0,
      verdict: check?.verdict ?? 'wrong',
      missing: (belief?.candidates ?? []).filter(
        (atom) => !(belief?.suspected ?? []).includes(atom),
      ),
      tells: HANDS[index]?.tells ?? '',
    };
  });
}

/** 같은 자국(제거가 낸 것) 앞에 선 셋. */
export const BELIEF_ROWS: readonly BeliefRow[] = rowsFor(SHARED_TRACE);

/** 굳기 — 같은 믿음 하나가 두 번째 읽기에서 어떻게 달라지는가. */
export interface HardeningRow {
  readonly label: string;
  readonly phenomenon: string;
  readonly observations: number;
  readonly intensity: number;
  /** 한 번만 봤을 때의 확신 — 같은 요소에서 반복만 1 로 되돌린 값이다 */
  readonly first: number;
  readonly confidence: number;
  readonly cap: number;
  readonly capped: boolean;
}

const hardeningOf = (phenomenon: WorldPhenomenon, label: string): readonly HardeningRow[] =>
  BELIEVERS.map((believer) => {
    const belief = VEIL_BELIEFS.beliefs.find(
      (entry) => entry.holderId === believer.subjectId && entry.aboutId === phenomenon.id,
    );
    const cap = confidenceCap(belief?.factors ?? []);
    return {
      label: believer.label,
      phenomenon: label,
      observations: belief?.observations ?? 0,
      intensity: belief?.intensity ?? 0,
      first: confidenceOf(confidenceFactors(belief?.suspected ?? [], belief?.intensity ?? 0, 1)),
      confidence: belief?.confidence ?? 0,
      cap,
      capped: Math.abs((belief?.confidence ?? 0) - cap) < 1e-9,
    };
  });

/** 두 번 본 옅은 빛과 한 번 본 진한 자국 — 반복이 드는 자리와 들지 않는 자리. */
export const HARDENING: readonly HardeningRow[] = [
  ...hardeningOf(REREAD_TRACE, '빛 0.29 (두 번 보았다)'),
  ...hardeningOf(SHARED_TRACE, '자국 0.60 (한 번 보았다)'),
];

/** 세 번째 둘러봄의 틱에서 이미 삭은 자국 위에 남는 믿음들 — 위반이 아니라 사실이다. */
export const STALE_BELIEFS: readonly Belief[] = staleBeliefs(VEIL_BELIEFS, VEIL_FIELD, LOOK_TICK);

/** 설 수 없는 믿음 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenBelief {
  readonly broke: string;
  readonly expected: string;
  /** 믿음을 세우는 자리에서 걸리는가(form), 믿음을 검사할 때 걸리는가(audit) */
  readonly at: 'form' | 'audit';
  readonly rules: readonly string[];
  readonly messages: readonly string[];
}

const anyBelief = VEIL_BELIEFS.beliefs[0] as Belief;
const anyPercept = VEIL_PERCEPTS.percepts.find(
  (percept) => percept.id === anyBelief.sourceIds[0],
) as Percept;

const rulesOf = (violations: readonly { readonly rule: string }[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const messagesOf = (violations: readonly { readonly message: string }[]): readonly string[] =>
  violations.map((violation) => violation.message);

const checkOne = (belief: Belief, pool: readonly Percept[] = VEIL_PERCEPTS.percepts) => {
  const out: BeliefViolation[] = [];
  checkBelief(belief, pool, out);
  return out;
};

/** ① 흔적을 통째로 스프레드한 믿음 — truth-copied 의 실제 모습. */
const leaked = checkOne({ ...SHARED_TRACE, ...anyBelief } as unknown as Belief);

/** ② 읽은 것 없이 선 믿음. */
const groundless = checkOne({ ...anyBelief, sourceIds: [] });

/** ③ 남의 눈으로 읽은 것을 제 근거로 삼는다. */
const borrowed = checkOne({
  ...anyBelief,
  holderId: WITNESS_IDS.trader,
  sourceIds: [anyPercept.id],
});

/** ④ 통로가 열지 않은 원자를 짚는다. */
const offCandidate = checkOne({ ...anyBelief, suspected: ['persuade'] });

/** ⑤ 후보를 손으로 늘린다. */
const stretched = checkOne({
  ...anyBelief,
  candidates: [...anyBelief.candidates, 'persuade'],
});

/** ⑥ 확신을 손으로 고쳐 넣는다. */
const drifted = checkOne({ ...anyBelief, confidence: 0.99 });

/** ⑦ 0~1 밖의 확신. */
const outOfRange = checkOne({ ...anyBelief, confidence: 2 });

/** ⑧ 좁힘이 허락한 상한을 넘는 확신 (요소의 좁힘만 낮춘 것처럼 꾸민다). */
const overconfident = checkOne({
  ...anyBelief,
  factors: anyBelief.factors.map((factor) =>
    factor.key === 'narrowing' ? { ...factor, value: 0.05 } : factor,
  ),
});

/** ⑨ 믿는 자가 없는 믿음. */
const unheld = checkOne({ ...anyBelief, holderId: '' });

/** ⑩ 짐작할 수 없는 통로의 지각으로 믿음을 세우려 한다 (세우는 자리에서 걸린다). */
const alien = formBelief(
  { ...anyPercept, channel: 'telepathy' as never },
  BELIEVERS[0]?.grammar ?? null,
);

/** ⑪ 남이 읽은 것으로 내 믿음을 굳히려 한다 (굳히는 자리에서 걸린다). */
const foreignReinforce = reinforce(anyBelief, {
  ...anyPercept,
  subjectId: WITNESS_IDS.trader,
});

export const BROKEN_BELIEFS: readonly BrokenBelief[] = [
  {
    broke: '흔적을 통째로 스프레드해 믿음을 만든다 (진실이 실린다)',
    expected: 'truth-copied',
    at: 'audit',
    rules: rulesOf(leaked),
    messages: messagesOf(leaked),
  },
  {
    broke: '읽은 것 없이 믿는다',
    expected: 'unperceived-belief',
    at: 'audit',
    rules: rulesOf(groundless),
    messages: messagesOf(groundless),
  },
  {
    broke: '남의 눈으로 읽은 것을 제 근거로 삼는다',
    expected: 'foreign-belief',
    at: 'audit',
    rules: rulesOf(borrowed),
    messages: messagesOf(borrowed),
  },
  {
    broke: '통로가 열지 않은 원자를 짚는다',
    expected: 'off-candidate-belief',
    at: 'audit',
    rules: rulesOf(offCandidate),
    messages: messagesOf(offCandidate),
  },
  {
    broke: '후보를 손으로 늘린다',
    expected: 'off-candidate-belief',
    at: 'audit',
    rules: rulesOf(stretched),
    messages: messagesOf(stretched),
  },
  {
    broke: '확신을 손으로 고쳐 넣는다',
    expected: 'confidence-drift',
    at: 'audit',
    rules: rulesOf(drifted),
    messages: messagesOf(drifted),
  },
  {
    broke: '0~1 밖의 확신을 적는다',
    expected: 'bad-confidence',
    at: 'audit',
    rules: rulesOf(outOfRange),
    messages: messagesOf(outOfRange),
  },
  {
    broke: '좁힘이 허락한 상한을 넘는 확신을 적는다',
    expected: 'overconfident-belief',
    at: 'audit',
    rules: rulesOf(overconfident),
    messages: messagesOf(overconfident),
  },
  {
    broke: '믿는 자가 없는 믿음을 적는다',
    expected: 'unheld-belief',
    at: 'audit',
    rules: rulesOf(unheld),
    messages: messagesOf(unheld),
  },
  {
    broke: '통로 6종 밖의 지각으로 믿음을 세운다',
    expected: 'unknown-channel',
    at: 'form',
    rules: rulesOf(alien.violations),
    messages: messagesOf(alien.violations),
  },
  {
    broke: '남이 읽은 것으로 내 믿음을 굳힌다',
    expected: 'foreign-belief',
    at: 'form',
    rules: rulesOf(foreignReinforce.violations),
    messages: messagesOf(foreignReinforce.violations),
  },
];

/** 한참 뒤 다시 둘러봐도 사라지지 않는 자국은 여전히 읽힌다 (경계). */
export const LATER_TICK = NOW + 60;
const lateLook = sweep(OBSERVERS, VEIL_FIELD, VEIL_WORLD, LATER_TICK);
const lateRead = interpret(BELIEVERS, lateLook.field, VEIL_BELIEFS);
export const LATER_BELIEFS: BeliefGraph = lateRead.graph;
export const LATER_READINGS: readonly Reading[] = lateRead.readings;

/** 빈 믿음 그래프는 아무 어긋남도 내지 않는다 (경계). */
export const EMPTY_AUDIT: BeliefAudit = auditBeliefs(
  openBeliefGraph(),
  VEIL_PERCEPTS,
  VEIL_FIELD,
  BELIEVERS,
  LOOK_TICK,
);

/** 아무것도 읽지 않은 자에게는 아무 믿음도 서지 않는다 (경계). */
export const BLIND_READING: Reading = interpret(
  [
    {
      subjectId: witnessId('아무것도 읽지 못한 자'),
      label: '아무것도 읽지 못한 자',
      grammar: BELIEVERS[0]?.grammar ?? null,
    },
  ],
  VEIL_PERCEPTS,
).readings[0] as Reading;
