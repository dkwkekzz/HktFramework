// R5-c 말과 소문 — 남의 말이 근거가 되는 자리.
//
// R4 는 벽을 하나 세웠다: **근거가 될 수 있는 것은 제 지각뿐이다**(`foreign-belief`). 남의 믿음을
// 제 믿음에 옮겨 담는 것을 막은 것인데, 그것이 없으면 세계가 조용히 전지해지기 때문이다.
//
// **R5 는 그 벽을 허물지 않는다.** 통로를 하나 낼 뿐이다.
//
//   말한다 → 세계에 `report` 통로의 흔적이 난다 → 듣는 자가 **제 귀로** 그것을 읽는다(R3)
//   → 그 지각이 그의 근거가 된다.
//
// 그래서 남의 말이 근거가 되면서도 R4 의 벽은 그대로 선다 — 듣는 자가 딛고 서는 것은 여전히
// 제 지각이다. 그리고 이 통로가 열리자 앞 계층이 이미 정해 둔 것들이 저절로 따라온다.
//
//   누가 들을 수 있는가          R3 감지 그대로 — 귀가 없는 종은 말을 못 듣고(장막벌레), 문턱을
//                                 못 넘는 말은 아무에게도 닿지 않는다. R5 는 감쇠를 정하지 않는다
//   낼 수 없는 일은 빠진다        R4 `narrowByGrammar` 가 이미 좁힌다 — 사제의 이야기에 죽임은 없다
//   말이 한 입마다 옅어지는 것    R4 의 좁힘 상한이 `min` 을 지나며 저절로 그렇게 된다
//
// R5 가 여기서 새로 정하는 것은 **한 줄**이다:
//
//   **말에는 지목이 실리고, 지목은 좁혀지지 않는다.**
//
// 내용은 거치는 사람마다 그의 손이 허락하는 만큼으로 줄어든다. 그런데 "누가 했다" 는 줄지 않는다
// — 그것은 고를 것이 없는 한 마디이기 때문이다. 그래서 **무슨 일이 있었는지는 모르는데 누구 탓인지는
// 아는** 사람이 생기고, 그것이 원문 §20 이 보인 장면이다: 하나의 사건이 여러 이야기가 된다.
//
// **거짓말은 아직 없다.** 말하는 자는 제 기억을 그대로 말한다 — 제 기억과 다른 것을 말하는 일
// (기만)은 E1 의 자리다. 여기서 여는 것은 "거쳐 오면 갈린다" 까지다.

import { deterministicId, type Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { TRACE_LIFESPAN, type WorldPhenomenon } from '../r2/index.ts';
import type { Percept } from '../r3/index.ts';
import { narrowByGrammar, spreadOf } from '../r4/index.ts';
import type { PossibilityGrammar } from '../p2/index.ts';
import type { ActionAtom } from '../p0/index.ts';
import { memoryConfidence, memoryIdOf, type Attribution, type Memory } from './memory.ts';
import { violateMemory, type MemoryViolation } from './violation.ts';

/**
 * 말 하나 — 누가, 무엇을, 어느 흔적으로 냈는가.
 *
 * 흔적은 세계에 나지만 **누가 말했는지는 흔적에 없다** — 그것은 R5 의 장부가 안다. R3 이
 * `Percept.phenomenonId` 를 "체계의 연결이지 주체가 아는 값이 아니다" 로 열어 둔 그 자리를 쓴다.
 */
export interface Telling {
  readonly id: Id;
  readonly speakerId: Id;
  /** 이 말이 낸 흔적 */
  readonly phenomenonId: Id;
  /** 무엇을 말했나 — 말하는 자의 기억 */
  readonly memoryId: Id;
  /** 그 기억이 딛고 선 뿌리 (사건이든 흔적이든) — 같은 뿌리의 이야기끼리 모인다 */
  readonly rootId: Id;
  /** 말한 내용 — 말하는 자가 짚은 것 그대로 */
  readonly claim: readonly ActionAtom[];
  /** 말에 실린 지목. null 이면 "누군가 무언가 했다" 까지다 */
  readonly attribution: Attribution | null;
  readonly confidence: number;
  readonly atTick: Tick;
  /** 몇 번째 입인가 — 처음 말한 자가 1 이다 */
  readonly hops: number;
}

/** 소문장 — 지금까지 난 말들과 그 흔적들. 세계의 현상장과 따로 선다(위 유예 참조). */
export interface RumorField {
  readonly tellings: readonly Telling[];
  readonly phenomena: readonly WorldPhenomenon[];
  /** 흔적 id → 그 흔적을 낸 말 */
  readonly byPhenomenon: ReadonlyMap<Id, Telling>;
}

export function openRumorField(): RumorField {
  return { tellings: [], phenomena: [], byPhenomenon: new Map() };
}

/**
 * 말의 수명 — **R2-b 의 식 그대로**이되 말은 사라지지 않는 자국이 되지 않는다.
 *
 * 봉인은 되돌릴 수 없는 원자가 **바꾼** 자리에 걸리는데(R2-b `decayOf`), 말이 움직이는 것은
 * 정보 자리이고 정보 자리는 되돌릴 수 있다. 그래서 어떤 말도 영원히 들리지는 않는다.
 */
export function rumorDecay(tick: Tick, intensity: number): Tick {
  return tick + Math.max(1, Math.round(intensity * TRACE_LIFESPAN));
}

/** 말이 낸 흔적의 id — 유래(말한 자 · 무엇을 · 언제)에서 나온다. */
export function tellingIdOf(speakerId: Id, memoryId: Id, tick: Tick): Id {
  return deterministicId('phenomenon', 'rumor', speakerId, memoryId, String(tick));
}

export interface SpeakSpec {
  readonly memory: Memory;
  readonly speakerId: Id;
  readonly tick: Tick;
  /** 어디서 말하는가 — 말도 자리에서 난다 (R3 이 거리를 잰다) */
  readonly placeId: Id;
  /** 이 기억의 뿌리 사건 — 흔적은 원인 없이 나지 않는다 (O1 `Phenomenon.causeEventId`) */
  readonly causeEventId: Id;
  /** 그 사건이 실제로 무슨 원자였나 — 세계의 장부이고, 감사만 본다 */
  readonly actualAtom: ActionAtom;
  /** 그 사건을 실제로 누가 냈나 — 세계의 장부이고, 감사만 본다 */
  readonly actualActorId: Id;
}

/** 말하기의 결과 — 서면 말과 흔적이, 서지 못하면 사유가 남는다. */
export interface SpeakResult {
  readonly telling: Telling | null;
  readonly phenomenon: WorldPhenomenon | null;
  readonly violations: readonly MemoryViolation[];
}

/**
 * 제 기억을 말한다 — **말은 흔적이 된다.**
 *
 * **얼마나 힘줘 말하는가와 얼마나 좁게 말하는가는 다르다.** R4 가 세기(R3 지각)와 좁힘(R4 문법)을
 * 따로 잰 것과 같은 자리다 — 그래서 흔적의 세기는 말하는 자가 **물려받은** 확신(`carried`)이고
 * 애매함은 말한 내용의 넓이다. 겪은 자는 확신에 차서 말하지만(제 자리가 움직인 것은 확실하다)
 * 말해 줄 수 있는 것은 여전히 열둘 중 하나다.
 *
 * 그 대신 **말에 실리는 확신**(`Telling.confidence`)은 좁혀진 값이다. 듣는 자가 물려받는 것이
 * 그것이므로 **말은 한 입을 건널 때마다 옅어진다** — R5 가 정한 것이 아니라 R4 의 상한이
 * `min` 을 지나며 저절로 그렇게 된다.
 */
export function speak(spec: SpeakSpec): SpeakResult {
  const violations: MemoryViolation[] = [];
  const { memory, speakerId, tick, placeId } = spec;
  if (memory.holderId !== speakerId) {
    violateMemory(
      violations,
      speakerId,
      'unspoken-telling',
      '$.telling.memoryId',
      '지니지 않은 기억을 말하려 한다 — 말할 수 있는 것은 제 기억뿐이다',
    );
    return { telling: null, phenomenon: null, violations };
  }
  if (memory.atTick > tick) {
    violateMemory(
      violations,
      speakerId,
      'future-memory',
      '$.telling.atTick',
      '아직 오지 않은 일을 말하려 한다',
    );
    return { telling: null, phenomenon: null, violations };
  }

  const phenomenonId = tellingIdOf(speakerId, memory.id, tick);
  const intensity = memory.carried;
  const telling: Telling = {
    id: deterministicId('claim', 'telling', speakerId, memory.id, String(tick)),
    speakerId,
    phenomenonId,
    memoryId: memory.id,
    rootId: memory.aboutId,
    claim: memory.suspected,
    attribution: memory.attribution,
    confidence: memory.confidence,
    atTick: tick,
    hops: memory.hops + 1,
  };
  const phenomenon: WorldPhenomenon = {
    kind: 'Phenomenon',
    id: phenomenonId,
    channel: 'report',
    causeEventId: spec.causeEventId,
    placeId,
    intensity,
    decaysAtTick: rumorDecay(tick, intensity),
    atom: spec.actualAtom,
    atTick: tick,
    actorId: spec.actualActorId,
    domain: 'informational',
    holderId: speakerId,
    path: `rumorSpread.${memory.aboutId}`,
    effectKind: 'change',
    ambiguity: spreadOf(memory.suspected.length),
  };
  return { telling, phenomenon, violations };
}

/** 말 하나를 소문장에 담는다 — 같은 id 는 두 번 담기지 않는다. */
export function recordTelling(
  field: RumorField,
  telling: Telling,
  phenomenon: WorldPhenomenon,
): RumorField {
  if (field.byPhenomenon.has(phenomenon.id)) return field;
  const byPhenomenon = new Map(field.byPhenomenon);
  byPhenomenon.set(phenomenon.id, telling);
  return {
    tellings: [...field.tellings, telling],
    phenomena: [...field.phenomena, phenomenon],
    byPhenomenon,
  };
}

/** 듣기의 결과 — 서면 기억이, 서지 못하면 사유가 남는다. */
export interface HearResult {
  readonly memory: Memory | null;
  readonly violations: readonly MemoryViolation[];
}

/**
 * 들은 것에서 기억이 선다 — **내용은 좁혀지고 지목은 그대로 실린다.**
 *
 * 좁히는 규칙은 R4-b 의 것 그대로다(`narrowByGrammar`) — 낼 손이 없는 일은 남의 말에서도
 * 떠오르지 않는다. 그런데 "누가 했다" 는 좁혀지지 않는다: 고를 것이 하나뿐인 말에는 편향이 낄
 * 자리가 없다. 그래서 **무슨 일이 있었는지는 모르는데 누구 탓인지는 아는** 사람이 생긴다.
 *
 * 세기는 두 값 중 작은 쪽이다 — 말한 자가 확신한 만큼을 넘지 못하고(거쳐서 진해질 수는 없다),
 * 귀에 닿은 만큼을 넘지도 못한다(R3 이 이미 깎았다).
 */
export function hear(
  percept: Percept,
  telling: Telling,
  grammar: PossibilityGrammar | null,
): HearResult {
  const violations: MemoryViolation[] = [];
  if (percept.phenomenonId !== telling.phenomenonId) {
    violateMemory(
      violations,
      percept.subjectId,
      'unheard-telling',
      '$.hear.percept',
      '듣지 않은 말에서 기억을 세우려 한다 — 근거가 되는 것은 제 귀에 닿은 것뿐이다',
    );
    return { memory: null, violations };
  }
  if (percept.subjectId === telling.speakerId) {
    violateMemory(
      violations,
      percept.subjectId,
      'unheard-telling',
      '$.hear.percept.subjectId',
      '제 말을 제가 들어 기억을 세우려 한다',
    );
    return { memory: null, violations };
  }

  const narrowed = narrowByGrammar(telling.claim, grammar);
  const carried = Math.min(telling.confidence, percept.intensity);
  const attribution: Attribution | null =
    telling.attribution === null
      ? null
      : {
          subjectId: telling.attribution.subjectId,
          source: 'told',
          eventId: null, // 들은 자는 사건 id 를 알 길이 없다
          viaIds: [...telling.attribution.viaIds, telling.speakerId],
          note: '들었다 — 내용은 내 손이 허락하는 만큼이지만 지목은 그대로 왔다',
        };

  const memory: Memory = {
    kind: 'Claim',
    id: memoryIdOf(percept.subjectId, telling.rootId),
    holderId: percept.subjectId,
    aboutId: telling.rootId,
    assertion:
      attribution === null
        ? '누군가 무언가 했다고 들었다'
        : `${attribution.subjectId} 이(가) 했다고 들었다`,
    confidence: memoryConfidence(carried, narrowed.suspected),
    sourceIds: [percept.id, telling.id],
    ground: 'told',
    atTick: percept.atTick,
    sealedAtTick: percept.atTick, // 들은 말은 다시 들을 수 없다 — 듣는 순간 굳는다
    candidates: telling.claim,
    suspected: narrowed.suspected,
    narrowedBy: narrowed.narrowedBy,
    attribution,
    hops: telling.hops,
    carried,
    slot: null,
  };
  return { memory, violations };
}

/** 들은 기억 하나를 검사한다 — 거쳐서 진해지거나 넓어질 수는 없다. */
export function checkHearsay(
  memory: Memory,
  telling: Telling,
  out: MemoryViolation[],
): void {
  const where = `$.memories[${memory.id}]`;
  if (memory.carried > telling.confidence + 1e-9) {
    violateMemory(
      out,
      memory.holderId,
      'louder-hearsay',
      `${where}.carried`,
      `들은 말이 말한 자의 확신(${telling.confidence.toFixed(3)})보다 세다 — ${memory.carried.toFixed(3)}`,
    );
  }
  const widened = memory.suspected.filter((atom) => !telling.claim.includes(atom));
  if (widened.length > 0) {
    violateMemory(
      out,
      memory.holderId,
      'widened-hearsay',
      `${where}.suspected`,
      `듣는 자가 내용을 넓혔다 — ${widened.join(', ')} 은 말에 없었다`,
    );
  }
  if (memory.hops !== telling.hops) {
    violateMemory(
      out,
      memory.holderId,
      'hopless-chain',
      `${where}.hops`,
      `거친 입이 말의 것(${String(telling.hops)})과 어긋난다 — ${String(memory.hops)}`,
    );
  }
  if (
    memory.attribution !== null &&
    telling.attribution !== null &&
    memory.attribution.subjectId !== telling.attribution.subjectId
  ) {
    violateMemory(
      out,
      memory.holderId,
      'guessed-attribution',
      `${where}.attribution.subjectId`,
      '들은 지목과 다른 사람을 짚었다 — 지목은 좁혀지지도 바뀌지도 않는다',
    );
  }
}

/** 같은 뿌리에서 갈라진 이야기 하나 — 원문 §20 의 네 이야기가 서는 자리. */
export interface Story {
  readonly holderId: Id;
  readonly label: string;
  readonly ground: Memory['ground'];
  readonly hops: number;
  /** 무엇이 있었다고 아는가 */
  readonly suspected: readonly ActionAtom[];
  /** 누구 탓이라 아는가 */
  readonly blames: Id | null;
  readonly confidence: number;
  readonly line: string;
}

/**
 * 한 사건에서 갈라진 이야기들 — **같은 사건이 몇 개의 이야기가 되었는가.**
 *
 * 뿌리는 여럿일 수 있다: 겪은 자의 기억은 **사건**을 딛고 서고 본 자의 기억은 그 사건이 남긴
 * **흔적**을 딛고 선다. 같은 일에서 온 것이면 한 자리에 놓고 봐야 이야기가 갈리는 것이 보인다.
 *
 * 내용이 서로 다르거나 지목이 서로 다르면 다른 이야기다.
 */
export function storiesOf(
  memories: readonly Memory[],
  rootIds: readonly Id[],
  labels: ReadonlyMap<Id, string> = new Map(),
): readonly Story[] {
  const roots = new Set(rootIds);
  return memories
    .filter((memory) => roots.has(memory.aboutId))
    .map((memory) => ({
      holderId: memory.holderId,
      label: labels.get(memory.holderId) ?? memory.holderId,
      ground: memory.ground,
      hops: memory.hops,
      suspected: memory.suspected,
      blames: memory.attribution?.subjectId ?? null,
      confidence: memory.confidence,
      line:
        memory.attribution === null
          ? `누군가 ${String(memory.suspected.length)} 중 하나를 했다`
          : `${labels.get(memory.attribution.subjectId) ?? memory.attribution.subjectId} 이(가) ${String(memory.suspected.length)} 중 하나를 했다`,
    }));
}

/** 이야기가 몇 갈래로 갈렸는가 — 내용과 지목이 같으면 같은 이야기다. */
export function storyVariants(stories: readonly Story[]): number {
  return new Set(
    stories.map((story) => `${[...story.suspected].sort().join(',')}|${story.blames ?? ''}`),
  ).size;
}
