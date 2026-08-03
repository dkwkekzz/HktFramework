// R3 검증 장면 — 붉은 장막의 겨울이 남긴 것을 **누가 읽는가**.
//
// R2 는 다섯 사건에서 열다섯 흔적을 냈다. 그 흔적은 세계에 놓였을 뿐 아직 아무의 것도 아니다.
// 여기서 넷이 그것을 둘러본다. 그러면 넷이 눈에 보인다.
//
//   ① **같은 자리에 서 있는데도 읽는 것이 하나도 겹치지 않는다.** 사냥꾼은 빛과 흔적을 읽고
//      장막벌레는 냄새만 읽는다 — 둘은 같은 협곡에서 다른 세계를 산다.
//   ② **몸 없는 자는 보고로만 아는데, 이 겨울의 보고는 문턱에 못 미친다.** 상단도 어머니신도
//      겨울에 무슨 일이 있었는지 모른다. 조직이 늘 늦게 아는 것이 이 자리다.
//   ③ **선 곳 하나가 읽는 것을 0 으로 만든다.** 같은 사냥꾼의 눈이라도 마을에 서 있으면
//      협곡의 가림막이 빛을 죽이고 자국은 도달 거리에서 걸린다.
//   ④ **아무도 보지 못한 흔적이 남는다.** 세계는 아무도 안 볼 때도 바뀌고, 그 자국은 볼
//      사람이 오기를 기다리다 삭는다. 위반이 아니라 사실이다.
//
// 세계도 흔적도 새로 짓지 않는다 — R2 장면(`r2-veil-phenomena.ts`)을 그대로 읽는다.
// 더하는 것은 **관측자 넷과 그들이 선 자리**뿐이고, 감지는 세계를 바꾸지 않으므로 사건이
// 필요 없다(D4 가 넷을 세운 것과 같은 자리 — genesis 다).

import { deterministicId } from '@hkt/core/v1';
import type { State } from '@hkt/core/o1';
import { assembleWorld, disassembleWorld, slotStateId, type WorldState } from '@hkt/core/o2';
import { perceptionOf, type SpeciesArchetype } from '@hkt/core/s1';
import { latest, type WorldStateSnapshot } from '@hkt/core/r0';
import { standingAt, type WorldPhenomenon } from '@hkt/core/r2';
import {
  COVER_RESISTANCES,
  auditPercepts,
  checkAttenuation,
  checkPercept,
  openPerceptField,
  perceiveOne,
  recordPercepts,
  sweep,
  unwitnessed,
  witnessTable,
  type AttenuationReport,
  type Observer,
  type Percept,
  type PerceptAudit,
  type PerceptField,
  type PerceptViolation,
  type Sweep,
  type WitnessRow,
} from '@hkt/core/r3';

import {
  guildArchetype,
  hunterArchetype,
  motherGodArchetype,
  veilWormArchetype,
} from './s1-veil-species.ts';
import { NOW, VEIL_FIELD, VEIL_STORE, actorId } from './r2-veil-phenomena.ts';
import { canyonId, hamletId } from './d4-veil-world.ts';

export { NOW, VEIL_FIELD, actorId, canyonId, hamletId };

/** 겨울이 끝난 뒤의 세계 — R2 가 흔적을 낸 그 세계다. */
const winterWorld = (latest(VEIL_STORE) as WorldStateSnapshot).world;

const slot = (domain: State['domain'], ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 협곡과 마을 사이의 거리 — 세계가 적어 두지 않았으면 아무도 서로를 보지 못한다 (R3-a). */
export const CANYON_TO_HAMLET = 200;

/**
 * 겨울의 세계에 관측자 셋을 더 세운다.
 *
 * 04 는 이미 협곡에 서 있다(D4). 장막벌레도 협곡에 두고, 상단과 어머니신은 마을에 둔다.
 * 그리고 두 자리 사이의 거리를 적는다 — 적지 않으면 마을의 둘에게 협곡은 없는 곳이다.
 */
function worldWithObservers(extra: readonly State[]): WorldState {
  return assembleWorld([...disassembleWorld(winterWorld), ...extra]).world;
}

const wormSubjectId = deterministicId('subject', 'beast', '장막벌레 (겨울의 관측자)');
const guildSubjectId = deterministicId('subject', 'guild', '상단 (겨울의 관측자)');
const godSubjectId = deterministicId('subject', 'god', '어머니신 (겨울의 관측자)');
/** 마을에 선 사냥꾼 — 같은 눈, 다른 자리. 선 곳 하나가 무엇을 바꾸는지 보이는 대조군이다. */
const distantHunterId = deterministicId('subject', 'person', '마을의 사냥꾼');

export const OBSERVER_IDS = {
  hunter: actorId,
  worm: wormSubjectId,
  guild: guildSubjectId,
  god: godSubjectId,
  distantHunter: distantHunterId,
} as const;

export const VEIL_WORLD: WorldState = worldWithObservers([
  slot('physical', canyonId, `distance.${hamletId}`, CANYON_TO_HAMLET),
  slot('physical', wormSubjectId, 'region', canyonId),
  slot('physical', guildSubjectId, 'region', hamletId),
  slot('physical', godSubjectId, 'region', hamletId),
  slot('physical', distantHunterId, 'region', hamletId),
]);

/**
 * 종의 눈 — S1 원형의 감각을 **성체 기준**(감각 배수 1)으로 편다.
 * S1 `perceptionOf` 그대로이고, 배수는 생애 단계가 정한다(어린 것은 문턱이 높다 — S1 `senseScale`).
 * 여기서 성체로 고정하는 이유는 하나다: 이 장면이 보이려는 것은 나이가 아니라 **종의 차이**다.
 */
const eyesOf = (archetype: SpeciesArchetype): Observer['perception'] =>
  perceptionOf(archetype.senses, 1);

/** 겨울을 둘러보는 넷. 종이 다르면 열린 통로가 다르다 (S1). */
export const OBSERVERS: readonly Observer[] = [
  { subjectId: actorId, label: '몰이꾼 04 (사냥꾼·협곡)', perception: eyesOf(hunterArchetype) },
  { subjectId: wormSubjectId, label: '장막벌레 (짐승·협곡)', perception: eyesOf(veilWormArchetype) },
  { subjectId: guildSubjectId, label: '상단 (조직·마을)', perception: eyesOf(guildArchetype) },
  { subjectId: godSubjectId, label: '어머니신 (신·마을)', perception: eyesOf(motherGodArchetype) },
];

/** 대조군 — 같은 사냥꾼의 눈인데 마을에 서 있다. */
export const DISTANT_HUNTER: Observer = {
  subjectId: distantHunterId,
  label: '마을의 사냥꾼 (같은 눈·다른 자리)',
  perception: eyesOf(hunterArchetype),
};

/** 마지막 사건의 틱 — 이때 흔적이 가장 많이 서 있다. */
export const LOOK_TICK = NOW + 15;

const run = sweep(OBSERVERS, VEIL_FIELD, VEIL_WORLD, LOOK_TICK);

/** 넷이 둘러본 결과. */
export const VEIL_SWEEPS: readonly Sweep[] = run.sweeps;
/** 그 결과로 선 지각장. */
export const VEIL_PERCEPTS: PerceptField = run.field;
/** 그 틱에 서 있던 흔적들. */
export const STANDING: readonly WorldPhenomenon[] = standingAt(VEIL_FIELD, LOOK_TICK);
/** 흔적마다 누가 보고 누가 못 보는가 (Lab diff 뷰의 재료). */
export const WITNESS_TABLE: readonly WitnessRow[] = witnessTable(VEIL_SWEEPS);
/** 아무도 보지 못한 흔적들 — 위반이 아니라 사실이다. */
export const UNWITNESSED: readonly WorldPhenomenon[] = unwitnessed(VEIL_PERCEPTS, STANDING);
/** 아무도 보지 못한 흔적을 어떻게 다루는가 — 화면과 시나리오가 같은 문장을 쓴다. */
export const SILENT_NOTE =
  '아니다 — 세계는 아무도 안 볼 때도 바뀌고, 그 자국은 볼 사람이 오기를 기다리다 삭는다. 이것이 막히면 아무도 몰래 무언가 할 수 없다';

/** 지각장 감사. */
export const VEIL_AUDIT: PerceptAudit = auditPercepts(
  VEIL_PERCEPTS,
  VEIL_FIELD,
  OBSERVERS,
  LOOK_TICK,
);
/** 차폐 감쇠표 검사 (R3-a). */
export const ATTENUATION: AttenuationReport = checkAttenuation();

/** 대조군의 결과 — 같은 눈, 다른 자리. */
export const DISTANT_SWEEP: Sweep = sweep([DISTANT_HUNTER], VEIL_FIELD, VEIL_WORLD, LOOK_TICK)
  .sweeps[0] as Sweep;

/** 거리를 적지 않았다면 — 마을의 둘에게 협곡은 아예 없는 곳이다 (경계). */
export const WITHOUT_DISTANCE = (() => {
  const world = worldWithObservers([
    slot('physical', distantHunterId, 'region', hamletId),
  ]);
  return sweep([DISTANT_HUNTER], VEIL_FIELD, world, LOOK_TICK).sweeps[0] as Sweep;
})();

/** 시간이 지나면 누가 무엇을 읽는가 — 흔적이 삭으면 읽을 것도 준다. */
export interface LookAt {
  readonly tick: number;
  readonly note: string;
  readonly standing: number;
  readonly percepts: number;
}

export const LOOK_WALK: readonly LookAt[] = [
  { tick: NOW, note: '겨울이 시작될 때', ...counts(NOW) },
  { tick: NOW + 6, note: '두 걸음 뒤', ...counts(NOW + 6) },
  { tick: LOOK_TICK, note: '다섯 걸음 뒤', ...counts(LOOK_TICK) },
  { tick: NOW + 25, note: '열흘 뒤', ...counts(NOW + 25) },
  { tick: NOW + 500, note: '한참 뒤', ...counts(NOW + 500) },
];

function counts(tick: number): { readonly standing: number; readonly percepts: number } {
  const standing = standingAt(VEIL_FIELD, tick);
  const look = sweep(OBSERVERS, VEIL_FIELD, VEIL_WORLD, tick);
  return { standing: standing.length, percepts: look.field.percepts.length };
}

/** 설 수 없는 지각 하나 — 무엇을 어겼고 어느 사유로 걸려야 하는가. */
export interface BrokenPercept {
  readonly broke: string;
  readonly expected: string;
  /** 감지 자리에서 걸리는가(perceive), 지각을 검사할 때 걸리는가(audit) */
  readonly at: 'perceive' | 'audit';
  readonly rules: readonly string[];
  readonly messages: readonly string[];
}

const anyPercept = VEIL_PERCEPTS.percepts[0] as Percept;
const anyPhenomenon = STANDING[0] as WorldPhenomenon;

const rulesOf = (violations: readonly { readonly rule: string }[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];
const messagesOf = (violations: readonly { readonly message: string }[]): readonly string[] =>
  violations.map((violation) => violation.message);

const checkOne = (percept: Percept): readonly PerceptViolation[] => {
  const out: PerceptViolation[] = [];
  checkPercept(percept, VEIL_FIELD.phenomena, out);
  return out;
};

/** ① 흔적을 통째로 스프레드한 지각 — truth-leak 의 실제 모습. */
const leaked = checkOne({ ...anyPhenomenon, ...anyPercept } as unknown as Percept);

/** ② 세계에 없는 흔적을 읽었다고 적는다. */
const phantom = checkOne({
  ...anyPercept,
  phenomenonId: deterministicId('phenomenon', '나지 않은 것'),
});

/** ③ 원래보다 센 감지 — 거리와 차폐는 깎기만 한다. */
const louder = checkOne({ ...anyPercept, intensity: 1 });

/** ④ 통로 6종 밖으로 감지했다고 적는다. */
const alien = checkOne({ ...anyPercept, channel: 'telepathy' as never });

/** ⑤ 세계에 선 곳이 없는 관측자. */
const placeless = perceiveOne(
  {
    subjectId: deterministicId('subject', 'person', '떠도는 자'),
    label: '떠도는 자',
    perception: OBSERVERS[0]?.perception ?? { channels: [] },
  },
  anyPhenomenon,
  VEIL_WORLD,
);

/** ⑥ 감지 프로필이 빈 주체가 읽었다고 적는다. */
const unprofiled = auditPercepts(
  VEIL_PERCEPTS,
  VEIL_FIELD,
  OBSERVERS.map((observer) =>
    observer.subjectId === actorId ? { ...observer, perception: { channels: [] } } : observer,
  ),
  LOOK_TICK,
);

/** ⑦ 이미 삭은 틱에서 읽었다고 적는다. */
const stale = auditPercepts(VEIL_PERCEPTS, VEIL_FIELD, OBSERVERS, NOW + 500);

/** ⑧ 통로 하나를 빼먹은 감쇠표 (R3-a). */
const holedAttenuation = checkAttenuation(
  COVER_RESISTANCES.filter((entry) => entry.channel !== 'light'),
);

/** ⑨ 1 을 넘는 감쇠 — 가림막이 없던 세기를 만들어 낼 수는 없다. */
const loudAttenuation = checkAttenuation(
  COVER_RESISTANCES.map((entry) => (entry.channel === 'sound' ? { ...entry, factor: 2 } : entry)),
);

export const BROKEN_PERCEPTS: readonly BrokenPercept[] = [
  {
    broke: '흔적을 통째로 스프레드해 지각을 만든다 (진실이 실린다)',
    expected: 'truth-leak',
    at: 'audit',
    rules: rulesOf(leaked),
    messages: messagesOf(leaked),
  },
  {
    broke: '세계에 없는 흔적을 읽었다고 적는다',
    expected: 'phantom-percept',
    at: 'audit',
    rules: rulesOf(phantom),
    messages: messagesOf(phantom),
  },
  {
    broke: '원래보다 센 감지 (거리와 차폐는 깎기만 한다)',
    expected: 'bad-intensity',
    at: 'audit',
    rules: rulesOf(louder),
    messages: messagesOf(louder),
  },
  {
    broke: '통로 6종 밖으로 감지했다고 적는다',
    expected: 'unknown-channel',
    at: 'audit',
    rules: rulesOf(alien),
    messages: messagesOf(alien),
  },
  {
    broke: '세계에 선 곳이 없는 자가 감지하려 한다',
    expected: 'placeless-observer',
    at: 'perceive',
    rules: placeless.percept === null ? ['placeless-observer'] : [],
    messages: [placeless.message],
  },
  {
    broke: '감지 프로필이 빈 주체가 읽었다고 적는다',
    expected: 'unprofiled-subject',
    at: 'audit',
    rules: rulesOf(unprofiled.violations),
    messages: messagesOf(unprofiled.violations),
  },
  {
    broke: '이미 삭은 흔적을 읽었다고 적는다',
    expected: 'stale-percept',
    at: 'audit',
    rules: rulesOf(stale.violations),
    messages: messagesOf(stale.violations),
  },
  {
    broke: '통로 하나의 차폐 감쇠를 빼먹는다',
    expected: 'bad-attenuation',
    at: 'perceive',
    rules: rulesOf(holedAttenuation.violations),
    messages: messagesOf(holedAttenuation.violations),
  },
  {
    broke: '1 을 넘는 차폐 감쇠를 적는다',
    expected: 'bad-attenuation',
    at: 'perceive',
    rules: rulesOf(loudAttenuation.violations),
    messages: messagesOf(loudAttenuation.violations),
  },
];

/** 빈 지각장은 아무 어긋남도 내지 않는다 (경계). */
export const EMPTY_AUDIT: PerceptAudit = auditPercepts(
  openPerceptField(),
  VEIL_FIELD,
  OBSERVERS,
  LOOK_TICK,
);

/** 같은 지각을 두 번 담아도 늘지 않는다 (경계). */
export const IDEMPOTENT = recordPercepts(VEIL_PERCEPTS, VEIL_PERCEPTS.percepts) === VEIL_PERCEPTS;
