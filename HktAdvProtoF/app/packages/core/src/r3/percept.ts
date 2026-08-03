// R3-b 감지와 Percept — 놓인 흔적 중 무엇이 이 주체에게 읽히는가.
//
// 판정은 새로 만들지 않는다. S0-b `perceives(profile, phenomenon, distance)` 가 통로·문턱·거리
// 셋을 이미 묻고, 못 읽었으면 왜 못 읽었는지(`no-channel` · `too-faint` · `too-far`)까지 낸다.
// R3-b 가 하는 일은 그 함수에 **세계를 먹이는 것**이다: 거리는 R3-a 가 자리에서 재고, 세기는
// R3-a 가 차폐로 깎은 것을 넘긴다.
//
// 그리고 하나를 못박는다 — 이 계층에서 가장 중요한 한 줄이다.
//
//   **지각에는 진실이 실리지 않는다.**
//
// R2 흔적(`WorldPhenomenon`)은 자기가 어느 자리에서 났는지 안다(`domain`·`holderId`·`path`),
// 누가 냈는지 알고(`actorId`), 무슨 원자였는지 안다(`atom`). 그것은 **세계의 장부**이지 본 사람의
// 눈이 아니다. 그것을 그대로 주체에게 건네면 본 순간 다 알아 버리고, 그러면 R4 의 거짓 믿음도
// 오인도 소문도 설 자리가 없다 — 원문 §6.1 이 갈라 놓은 "객관적 상태와 관찰된 현상" 이 도로 붙는다.
//
// 그래서 Percept 가 싣는 것은 **밖에서 잴 수 있는 것**뿐이다: 어느 통로로 왔는가 · 얼마나 셌는가 ·
// 어디서 왔는가 · 얼마나 멀었는가 · 그리고 **얼마나 애매한가**(R2 가 이미 센 값 — 그 자국을 남길
// 수 있는 원자가 몇인가). 무엇이 일어났는지를 그중에서 짐작하는 것은 R4 의 일이다.
//
// 실린 것을 검사로 막는다(`truth-leak`) — 주장으로 두면 언젠가 흔적을 통째로 스프레드해서
// Percept 를 만들게 되고, 그 순간 세계가 조용히 전지해진다.
//
// Percept 는 O1 12타입에 없다. **없는 것이 옳다** — O1 은 세계에 적히는 것을 세고, 지각은 세계가
// 아니라 주체 안에 있다. 세계에 적히는 것은 R2 흔적까지이고 주체가 갖는 것은 R4 `BeliefGraph` 이며,
// Percept 는 그 사이를 지나가는 것이다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Tick } from '../v1/tick.ts';
import type { PhenomenonChannel } from '../o1/operation.ts';
import { PHENOMENON_CHANNELS } from '../o1/operation.ts';
import type { WorldState } from '../o2/world.ts';
import {
  channelSpec,
  perceives,
  type PerceptionMiss,
  type PerceptionProfile,
} from '../s0/perception.ts';
import type { WorldPhenomenon } from '../r2/index.ts';
import { UNREACHABLE, reachOf, standsIn, type CoverResistance, type Reach } from './reach.ts';
import { violatePercept, type PerceptViolation } from './violation.ts';

/**
 * 주체 하나가 흔적 하나를 읽은 것.
 *
 * 여기 없는 것이 여기 있는 것만큼 중요하다 — 어느 자리가 움직였는지도, 누가 냈는지도,
 * 무슨 원자였는지도 없다. 감지한 자가 아는 것은 "저기서 이만한 무엇이 났다" 까지다.
 */
export interface Percept {
  readonly id: Id;
  readonly subjectId: Id;
  /** 어느 흔적을 읽은 것인가 — **체계의 연결이지 주체가 아는 값이 아니다** (R4 가 대조에 쓴다) */
  readonly phenomenonId: Id;
  readonly channel: PhenomenonChannel;
  /** 거리와 차폐를 지나 실제로 닿은 세기 (0~1) — 원래 세기보다 셀 수 없다 */
  readonly intensity: number;
  /** 어디서 왔는가 — 방향은 알 수 있다 */
  readonly placeId: Id;
  readonly distance: number;
  readonly atTick: Tick;
  /** 그 자국을 남길 수 있는 원자가 몇인가 (R2). 클수록 무엇이었는지 알기 어렵다 */
  readonly ambiguity: number;
}

/**
 * 지각에 실려서는 안 되는 이름들 — R2 흔적이 가진 **세계의 장부** 쪽 필드다.
 * 흔적을 통째로 스프레드해서 Percept 를 만드는 순간 여기 걸린다.
 */
export const TRUTH_FIELDS = ['domain', 'holderId', 'path', 'actorId', 'atom', 'effectKind', 'causeEventId'] as const;

/** 감지 시도 하나의 결과 — 읽었으면 지각이, 못 읽었으면 사유가 남는다. */
export interface PerceptionAttempt {
  readonly subjectId: Id;
  readonly phenomenon: WorldPhenomenon;
  readonly reach: Reach;
  readonly percept: Percept | null;
  readonly miss: PerceptionMiss | null;
  /** 사람이 읽는 한 줄 — 읽었든 못 읽었든 왜 그런지가 남는다 */
  readonly message: string;
}

/** 감지에 필요한 주체 한 명 — 누구이고, 무엇이 열려 있고, 어디에 서 있는가. */
export interface Observer {
  readonly subjectId: Id;
  readonly label: string;
  readonly perception: PerceptionProfile;
}

export interface PerceiveOptions {
  readonly resistances?: readonly CoverResistance[];
}

/** 지각의 id — 유래(주체 · 흔적)에서 나온다 (V1 결정적 ID). */
export function perceptIdOf(subjectId: Id, phenomenonId: Id): Id {
  return deterministicId('percept', subjectId, phenomenonId);
}

/**
 * 주체 하나가 흔적 하나를 읽으려 한다.
 *
 * 순서: 선 곳을 세계에서 읽고 → 거리와 차폐를 재고(R3-a) → S0-b 판정에 넘긴다.
 * 앞이 없으면 뒤는 묻지 않는다 — 세계에 서 있지 않은 자는 아무것도 감지하지 못한다.
 */
export function perceiveOne(
  observer: Observer,
  phenomenon: WorldPhenomenon,
  world: WorldState,
  options: PerceiveOptions = {},
): PerceptionAttempt {
  const placeId = standsIn(world, observer.subjectId);
  if (placeId === null) {
    return {
      subjectId: observer.subjectId,
      phenomenon,
      reach: { distance: UNREACHABLE, crossesCover: false, cover: 0, factor: 0, intensity: 0 },
      percept: null,
      miss: 'too-far',
      message: `${observer.label} 은 세계에 선 곳이 없다 — 거리를 잴 수 없으므로 아무것도 감지하지 못한다`,
    };
  }

  const reach = reachOf(world, placeId, phenomenon, options.resistances);
  const verdict = perceives(
    observer.perception,
    { channel: phenomenon.channel, intensity: reach.intensity },
    reach.distance,
  );

  if (!verdict.perceived) {
    return {
      subjectId: observer.subjectId,
      phenomenon,
      reach,
      percept: null,
      miss: verdict.miss,
      message: `${observer.label}: ${verdict.message}`,
    };
  }

  return {
    subjectId: observer.subjectId,
    phenomenon,
    reach,
    percept: {
      id: perceptIdOf(observer.subjectId, phenomenon.id),
      subjectId: observer.subjectId,
      phenomenonId: phenomenon.id,
      channel: phenomenon.channel,
      intensity: reach.intensity,
      placeId: phenomenon.placeId,
      distance: reach.distance,
      atTick: phenomenon.atTick,
      ambiguity: phenomenon.ambiguity,
    },
    miss: null,
    message: `${observer.label}: ${verdict.message}`,
  };
}

/** 주체 하나가 흔적 여럿을 읽으려 한다 — 시도마다 결과가 남는다(못 읽은 것도). */
export function perceiveAll(
  observer: Observer,
  phenomena: readonly WorldPhenomenon[],
  world: WorldState,
  options: PerceiveOptions = {},
): readonly PerceptionAttempt[] {
  return phenomena.map((phenomenon) => perceiveOne(observer, phenomenon, world, options));
}

/** 시도들에서 실제로 선 지각만 — 순서는 통로·자리 순으로 결정적이다. */
export function perceptsOf(attempts: readonly PerceptionAttempt[]): readonly Percept[] {
  const percepts = attempts
    .map((attempt) => attempt.percept)
    .filter((percept): percept is Percept => percept !== null);
  return stableSort(percepts, (left, right) =>
    compareStrings(`${left.channel}/${left.phenomenonId}`, `${right.channel}/${right.phenomenonId}`),
  );
}

/**
 * 지각 하나가 온전한가 — **진실이 실리지 않았는가**가 첫 물음이다.
 *
 * 그다음에야 그 흔적이 실재하는지, 세기가 부풀지 않았는지를 묻는다. 던지지 않는다.
 */
export function checkPercept(
  percept: Percept,
  phenomena: readonly WorldPhenomenon[],
  out: PerceptViolation[],
  path = '$.percept',
): void {
  const fields = percept as unknown as Record<string, unknown>;
  const carried = TRUTH_FIELDS.filter((field) => field in fields);
  if (carried.length > 0) {
    violatePercept(
      out,
      percept.subjectId,
      'truth-leak',
      path,
      `지각에 흔적의 유래 ${carried.join(', ')} 가 실렸다 — 감지한 자는 저기서 무언가 났다는 것까지만 안다. 이것이 새면 본 순간 다 알아 버려 R4 의 오인도 소문도 설 자리가 없다`,
    );
  }

  if (!(PHENOMENON_CHANNELS as readonly string[]).includes(percept.channel)) {
    violatePercept(
      out,
      percept.subjectId,
      'unknown-channel',
      `${path}.channel`,
      `O1 이 연 통로 6종에 없는 통로 ${JSON.stringify(percept.channel)} 로 감지했다고 적었다`,
    );
    return;
  }

  const source = phenomena.find((phenomenon) => phenomenon.id === percept.phenomenonId);
  if (source === undefined) {
    violatePercept(
      out,
      percept.subjectId,
      'phantom-percept',
      `${path}.phenomenonId`,
      `세계에 없는 흔적 ${percept.phenomenonId} 를 감지했다고 적었다 — 나지 않은 것은 보이지 않는다`,
    );
    return;
  }

  if (
    !Number.isFinite(percept.intensity) ||
    percept.intensity <= 0 ||
    percept.intensity > 1 ||
    percept.intensity > source.intensity + Number.EPSILON
  ) {
    violatePercept(
      out,
      percept.subjectId,
      'bad-intensity',
      `${path}.intensity`,
      `감지 세기 ${String(percept.intensity)} 가 설 수 없다 — 0 초과 1 이하여야 하고 원래 세기 ${String(source.intensity)} 를 넘을 수 없다. 거리와 차폐는 깎기만 한다`,
    );
  }

  if (percept.channel !== source.channel || percept.placeId !== source.placeId) {
    violatePercept(
      out,
      percept.subjectId,
      'phantom-percept',
      path,
      `흔적은 ${channelSpec(source.channel)?.label ?? source.channel}·${source.placeId} 인데 지각은 ${channelSpec(percept.channel)?.label ?? percept.channel}·${percept.placeId} 라고 적었다`,
    );
  }
}

/** 감지 결과 하나를 사람이 읽는 한 줄로 — 터미널·화면이 같은 문장을 쓴다. */
export function attemptLine(attempt: PerceptionAttempt): string {
  return attempt.message;
}

/** 지각 하나를 사람이 읽는 한 줄로. */
export function perceptLine(percept: Percept): string {
  const label = channelSpec(percept.channel)?.label ?? percept.channel;
  return `${label} 세기 ${percept.intensity.toFixed(2)} · ${String(percept.distance)}m · 애매함 ${percept.ambiguity.toFixed(2)} (틱 ${String(percept.atTick)})`;
}

/** 시도들을 한 줄 판정으로 접는다. */
export function perceiveVerdict(
  observer: Observer,
  attempts: readonly PerceptionAttempt[],
): string {
  const got = attempts.filter((attempt) => attempt.percept !== null);
  if (got.length === 0) {
    const misses = [...new Set(attempts.map((attempt) => attempt.miss))].filter(
      (miss): miss is PerceptionMiss => miss !== null,
    );
    return `${observer.label}: 아무것도 감지하지 못한다 (${misses.join(', ') || '흔적이 없다'})`;
  }
  const channels = [...new Set(got.map((attempt) => attempt.phenomenon.channel))];
  return `${observer.label}: ${String(got.length)}/${String(attempts.length)} 감지 (${channels.map((channel) => channelSpec(channel)?.label ?? channel).join('·')})`;
}
