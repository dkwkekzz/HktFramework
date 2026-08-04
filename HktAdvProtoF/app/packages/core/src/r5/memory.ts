// R5-a 기억과 지목 — 무엇이 기억이 되고, 누가 누구를 짚을 수 있는가.
//
// R4 는 "믿는 세계" 를 세우고 두 자리를 비워 두었다. 후보에는 **누가 냈는지가 없고**(`truth-copied`
// 가 막는다), 근거가 될 수 있는 것은 **제 지각뿐이다**(`foreign-belief`). 그 두 자리가 R5 의 일이다.
//
// 여기서 R5 가 새로 정하는 것은 **두 줄뿐**이다.
//
//   ① **다시 볼 수 없게 된 믿음이 기억이다.**
//      자국이 서 있는 동안 그것은 믿음이다 — 의심스러우면 다시 가서 보면 된다. 자국이 삭으면
//      다시 볼 길이 없고, 그때 남은 것이 기억이다. 목록조차 R5 가 만들지 않는다: R4-c
//      `staleBeliefs` 가 "딛고 선 자국이 이미 삭은 믿음들" 을 이미 세어 두었고, R5 는 그것이
//      **이름을 바꾸는 자리**를 판정할 뿐이다. 그래서 사라지지 않는 자국(제거가 바꾼 자리)의
//      믿음은 백 틱이 지나도 기억이 되지 않는다 — 여전히 가서 볼 수 있기 때문이다.
//
//   ② **겪은 자만 누구인지 안다.**
//      지목은 짐작에서 나오지 않는다. 밖에서 자국만 본 자에게 그것은 열둘 중 하나이고 누가
//      냈는지는 어디에도 적혀 있지 않다. 그러나 **제 자리가 바뀐 자는 안다** — 사건의 결과가
//      제 장부에 남았고 그 장부는 제 것이다. 그것이 원한이 설 수 있는 유일한 뿌리다.
//
// **겪음이 주는 것은 지목뿐이다.** 무엇이 있었는지는 겪은 자에게도 여전히 짐작이다 — 제 몸이
// 깎인 것은 알아도 그것이 제거였는지 강요였는지는 그 자리를 움직일 수 있는 원자 전부가 후보이고
// (R2 `atomsMoving` — R4-a 가 쓴 그 재료다) 좁히는 것은 제 문법이다(R4-b `narrowByGrammar`).
// 뒤에서 맞은 자는 누가 때렸는지 알아도 무엇으로 때렸는지는 모른다.
//
// **기억은 바래지 않는다.** 굳는 순간의 확신을 그대로 진다 — 잊음의 시간 축은 선언하지 않았다
// (원문이 주지 않았다). 바래는 것은 값이 아니라 세계와의 어긋남이고, 그것은 이미 값으로 선다.
// 다만 확신은 언제나 **좁힘을 넘지 못한다** — R4 가 세운 상한이 여기서도 그대로 산다.

import { deterministicId, type Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { classify, type Claim } from '../o1/index.ts';
import type { StateDomain } from '../o2/index.ts';
import { ACTION_ATOMS, atomLabel, type ActionAtom } from '../p0/index.ts';
import type { PossibilityGrammar } from '../p2/index.ts';
import type { WorldEvent } from '../r1/index.ts';
import { atomsMoving, standingAt, type PhenomenonField, type WorldPhenomenon } from '../r2/index.ts';
import { narrowByGrammar, spreadOf, type Belief, type BeliefGraph } from '../r4/index.ts';
import { violateMemory, type MemoryViolation } from './violation.ts';

/**
 * 기억에 실려서는 안 되는 이름들 — R4 `BELIEF_TRUTH_FIELDS` 를 그대로 잇는다.
 *
 * `attribution` 은 여기 없다. 그것은 세계의 장부에서 베낀 값이 아니라 **겪음이나 전언에서 온
 * 주장**이고, 틀릴 수 있다 — 그것이 이 계층이 있는 이유다.
 */
export const MEMORY_TRUTH_FIELDS = ['atom', 'actorId', 'effectKind', 'causeEventId'] as const;

/** 무엇으로 아는가 — 기억의 뿌리는 셋뿐이다. */
export const MEMORY_GROUNDS = ['lived', 'seen', 'told'] as const;
export type MemoryGround = (typeof MEMORY_GROUNDS)[number];

export function groundLabel(ground: MemoryGround): string {
  return ground === 'lived' ? '겪었다' : ground === 'seen' ? '보았다' : '들었다';
}

/**
 * 누구의 일이라 여기는가 — **지목**.
 *
 * R4 의 믿음에는 이 자리가 없다. 지목은 짐작이 아니라 겪음이나 전언에서만 오기 때문이다.
 */
export interface Attribution {
  /** 누구를 짚는가 */
  readonly subjectId: Id;
  /** 겪어서 아는가, 들어서 아는가 */
  readonly source: 'lived' | 'told';
  /** 겪음이면 그 사건. 전언이면 null (들은 자는 사건 id 를 알 길이 없다) */
  readonly eventId: Id | null;
  /** 전언이면 거쳐 온 입들 — 말한 순서대로. 겪음이면 비어 있다 */
  readonly viaIds: readonly Id[];
  readonly note: string;
}

/**
 * 지나간 일 하나 — O1 `Claim` 에 R5 가 여덟을 더한다.
 *
 * `confidence` 는 저장된 값이 아니라 `carried` 와 `suspected` 에서 **다시 셀 수 있는** 값이다
 * (R4-b 확신과 같은 태도). 손으로 고쳐 넣으면 `memory-drift` 로 걸린다.
 */
export interface Memory extends Claim {
  readonly ground: MemoryGround;
  /** 언제의 일인가 */
  readonly atTick: Tick;
  /** 언제 다시 볼 수 없게 되었나 — 기억이 된 순간 */
  readonly sealedAtTick: Tick;
  /** 그 자리를 움직일 수 있는 원자 전부 — 누구에게나 같다 */
  readonly candidates: readonly ActionAtom[];
  /** 그중 제 문법이 여는 것 — 주체마다 다르다 */
  readonly suspected: readonly ActionAtom[];
  readonly narrowedBy: 'grammar' | 'none';
  /** 누구의 일이라 여기는가. null 이면 "누군가" 다 */
  readonly attribution: Attribution | null;
  /** 몇 사람의 입을 거쳤나 — 0 이면 제 몸·제 눈이다 */
  readonly hops: number;
  /** 물려받은 확신 — 좁힘 상한에 잘리기 전의 값 */
  readonly carried: number;
  /** 겪음이면 제 어느 자리가 바뀌었나 (제 장부다). 봄·들음이면 null */
  readonly slot: string | null;
}

/** 기억의 id — 유래(지닌 자 · 무엇에 대한 것인가)에서 나온다 (V1 결정적 ID). */
export function memoryIdOf(holderId: Id, aboutId: Id): Id {
  return deterministicId('claim', 'memory', holderId, aboutId);
}

/** 좁힘이 허락하는 상한 — 열여섯 중 하나로 좁혀질수록 1 에 가깝다 (R4-b 와 같은 눈금). */
export function narrowingCap(suspected: readonly ActionAtom[]): number {
  return 1 - spreadOf(suspected.length);
}

/** 확신을 다시 센다 — **물려받은 값은 좁힘을 넘지 못한다.** */
export function memoryConfidence(carried: number, suspected: readonly ActionAtom[]): number {
  return Math.min(Math.max(0, Math.min(1, carried)), narrowingCap(suspected));
}

/** 사람이 읽는 한 줄. */
export function memoryLine(memory: Memory): string {
  const who =
    memory.attribution === null
      ? '누군가'
      : `${memory.attribution.subjectId}${memory.attribution.source === 'told' ? '(들었다)' : ''}`;
  const what = memory.suspected.map(atomLabel).join('·');
  return `${groundLabel(memory.ground)} — ${who} 이(가) ${what} (확신 ${memory.confidence.toFixed(2)}, 거친 입 ${String(memory.hops)})`;
}

/** 기억을 정렬한다 — 언제의 일인가 → 지닌 자 → id. 배치가 결정적이어야 그림도 해시된다. */
export function orderMemories(memories: readonly Memory[]): readonly Memory[] {
  return [...memories].sort((left, right) => {
    if (left.atTick !== right.atTick) return left.atTick - right.atTick;
    if (left.holderId !== right.holderId) return left.holderId < right.holderId ? -1 : 1;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/** 사건 하나가 이 주체의 어느 자리를 바꿨는가 — **제 장부에 남은 것만** 본다. */
export function livedSlots(
  event: WorldEvent,
  subjectId: Id,
): readonly { readonly domain: StateDomain; readonly path: string }[] {
  return event.effects
    .filter((effect) => effect.holderId === subjectId)
    .map((effect) => ({ domain: effect.domain, path: effect.path }));
}

/**
 * 그 사건을 **겪었는가** — 남이 낸 사건이 내 자리를 바꿨는가.
 *
 * 제 손으로 낸 사건은 겪음이 아니다(그것은 한 일이다). 자연 발생은 R1 이 유예했으므로
 * 일으킨 자는 언제나 있다.
 */
export function suffered(event: WorldEvent, subjectId: Id): boolean {
  if (event.actorId === null || event.actorId === subjectId) return false;
  return livedSlots(event, subjectId).length > 0;
}

/**
 * 겪은 일을 기억으로 세운다 — **지목은 확실하고 내용은 짐작이다.**
 *
 * 후보는 그 자리를 움직일 수 있는 원자 전부이고(R2 `atomsMoving`), 좁히는 것은 제 문법이다
 * (R4-b `narrowByGrammar`). 그래서 뒤에서 맞은 자는 **누가** 때렸는지 알아도 **무엇으로**
 * 때렸는지는 모른다.
 */
export function liveMemory(
  event: WorldEvent,
  subjectId: Id,
  grammar: PossibilityGrammar | null,
): { readonly memory: Memory | null; readonly violations: readonly MemoryViolation[] } {
  const violations: MemoryViolation[] = [];
  if (!suffered(event, subjectId)) {
    violateMemory(
      violations,
      subjectId,
      'unlived-attribution',
      '$.event',
      `겪지 않은 사건으로 지목을 세우려 한다 — 이 사건은 ${subjectId} 의 자리를 바꾸지 않았다`,
    );
    return { memory: null, violations };
  }

  const slots = livedSlots(event, subjectId);
  const first = slots[0] as { readonly domain: StateDomain; readonly path: string };
  const candidates = [
    ...new Set(slots.flatMap((entry) => atomsMoving({ domain: entry.domain, path: entry.path }))),
  ].filter((atom) => ACTION_ATOMS.includes(atom));
  const narrowed = narrowByGrammar(candidates, grammar);
  const carried = 1; // 제 자리가 바뀌었다는 것은 확실하다 — 흐린 것은 무엇이었나뿐이다
  const memory: Memory = {
    kind: 'Claim',
    id: memoryIdOf(subjectId, event.id),
    holderId: subjectId,
    aboutId: event.id,
    assertion: `내 ${first.domain}.${first.path} 가 움직였다 — ${event.actorId ?? ''} 이(가) 했다`,
    confidence: memoryConfidence(carried, narrowed.suspected),
    sourceIds: [event.id],
    ground: 'lived',
    atTick: event.tick,
    sealedAtTick: event.tick, // 겪음은 지나간 순간 굳는다 — 다시 겪을 수 없다
    candidates,
    suspected: narrowed.suspected,
    narrowedBy: narrowed.narrowedBy,
    attribution: {
      subjectId: event.actorId as Id,
      source: 'lived',
      eventId: event.id,
      viaIds: [],
      note: '제 자리가 바뀌었다 — 겪은 자는 누가 했는지 안다',
    },
    hops: 0,
    carried,
    slot: `${first.domain}.${first.path}`,
  };
  return { memory, violations };
}

/**
 * 본 것이 기억이 된다 — **자국이 삭은 믿음만**.
 *
 * 지목은 붙지 않는다. 밖에서 본 자는 누가 냈는지 알 길이 없다(R4 가 `actorId` 를 싣지 않는다).
 */
export function sealMemory(
  belief: Belief,
  phenomenon: WorldPhenomenon | null,
): { readonly memory: Memory | null; readonly violations: readonly MemoryViolation[] } {
  const violations: MemoryViolation[] = [];
  const decays = phenomenon?.decaysAtTick ?? null;
  if (decays === null) {
    violateMemory(
      violations,
      belief.holderId,
      'unsealed-memory',
      '$.belief',
      '사라지지 않는 자국의 믿음은 기억이 되지 않는다 — 여전히 가서 볼 수 있다',
    );
    return { memory: null, violations };
  }
  const memory: Memory = {
    kind: 'Claim',
    id: memoryIdOf(belief.holderId, belief.aboutId),
    holderId: belief.holderId,
    aboutId: belief.aboutId,
    assertion: belief.assertion,
    confidence: memoryConfidence(belief.confidence, belief.suspected),
    sourceIds: belief.sourceIds,
    ground: 'seen',
    atTick: belief.firstTick,
    sealedAtTick: decays,
    candidates: belief.candidates,
    suspected: belief.suspected,
    narrowedBy: belief.narrowedBy,
    attribution: null, // 본 자는 누구인지 모른다 — 그것이 R4 가 남긴 자리다
    hops: 0,
    carried: belief.confidence,
    slot: null,
  };
  return { memory, violations };
}

/** 믿음 하나가 굳은 결과 — 굳었으면 기억이, 아니면 사유가 남는다. */
export interface Sealing {
  readonly belief: Belief;
  readonly memory: Memory | null;
  readonly reason: string;
}

/**
 * 지금 굳는 믿음들을 기억으로 옮긴다 — R4-c `staleBeliefs` 가 고른 것에서만.
 *
 * **R5 는 목록을 만들지 않는다.** 어느 믿음이 딛고 선 자국을 잃었는지는 R4-c 가 이미 세어 두었고
 * 여기서는 그것이 이름을 바꾸는 자리를 판정할 뿐이다. 사라지지 않는 자국의 믿음은 그 목록에
 * 아예 없으므로 굳지 않는다 — 백 틱이 지나도 가서 보면 된다.
 */
export function sealAll(
  graph: BeliefGraph,
  field: PhenomenonField,
  tick: Tick,
): { readonly memories: readonly Memory[]; readonly sealings: readonly Sealing[] } {
  const standing = new Set(standingAt(field, tick).map((phenomenon) => phenomenon.id));
  const sealings: Sealing[] = [];
  const memories: Memory[] = [];
  for (const belief of graph.beliefs) {
    const phenomenon = field.phenomena.find((entry) => entry.id === belief.aboutId) ?? null;
    if (standing.has(belief.aboutId)) {
      sealings.push({ belief, memory: null, reason: '자국이 아직 서 있다 — 다시 볼 수 있으므로 믿음이다' });
      continue;
    }
    if (phenomenon === null) {
      sealings.push({ belief, memory: null, reason: '세계에 없는 자국의 믿음이다' });
      continue;
    }
    if (phenomenon.atTick > tick) {
      sealings.push({ belief, memory: null, reason: '아직 나지 않은 자국이다 — 기억이 될 수 없다' });
      continue;
    }
    const sealed = sealMemory(belief, phenomenon);
    if (sealed.memory === null) {
      sealings.push({ belief, memory: null, reason: sealed.violations[0]?.message ?? '' });
      continue;
    }
    memories.push(sealed.memory);
    sealings.push({
      belief,
      memory: sealed.memory,
      reason: `자국이 틱 ${String(phenomenon.decaysAtTick ?? 0)} 에 삭았다 — 다시 볼 길이 없다`,
    });
  }
  return { memories: orderMemories(memories), sealings };
}

/** 기억 하나를 검사한다 — 서지 못하면 사유가 남는다. **틀린 지목은 여기 없다.** */
export function checkMemory(
  memory: Memory,
  out: MemoryViolation[],
  options: { readonly tick?: Tick } = {},
): void {
  const where = `$.memories[${memory.id}]`;
  const violations = classify(memory as unknown as Record<string, unknown>).violations;
  for (const violation of violations) {
    violateMemory(out, memory.holderId, 'groundless-memory', where, `O1 관문 — ${violation.message}`);
  }

  if (memory.holderId === '') {
    violateMemory(out, '', 'unheld-memory', `${where}.holderId`, '지닌 자가 없는 기억이다');
  }
  if (memory.sourceIds.length === 0) {
    violateMemory(
      out,
      memory.holderId,
      'groundless-memory',
      `${where}.sourceIds`,
      '근거 없이 선 기억이다 — 겪었거나 보았거나 들었어야 한다',
    );
  }
  if (memory.sealedAtTick < memory.atTick) {
    violateMemory(
      out,
      memory.holderId,
      'future-memory',
      `${where}.sealedAtTick`,
      `굳은 틱(${String(memory.sealedAtTick)})이 일어난 틱(${String(memory.atTick)})보다 앞선다`,
    );
  }
  if (options.tick !== undefined && memory.atTick > options.tick) {
    violateMemory(
      out,
      memory.holderId,
      'future-memory',
      `${where}.atTick`,
      '아직 오지 않은 일의 기억이다',
    );
  }

  const expected = memoryConfidence(memory.carried, memory.suspected);
  if (Math.abs(expected - memory.confidence) > 1e-9) {
    violateMemory(
      out,
      memory.holderId,
      'memory-drift',
      `${where}.confidence`,
      `기억은 바래지 않는다 — 물려받은 값과 좁힘에서 다시 세면 ${expected.toFixed(3)} 인데 ${memory.confidence.toFixed(3)} 이 적혀 있다`,
    );
  }

  const outside = memory.suspected.filter((atom) => !memory.candidates.includes(atom));
  if (outside.length > 0) {
    violateMemory(
      out,
      memory.holderId,
      'memory-truth-copied',
      `${where}.suspected`,
      `후보 밖의 원자를 짚었다 — ${outside.join(', ')}`,
    );
  }

  for (const field of MEMORY_TRUTH_FIELDS) {
    if (Object.hasOwn(memory as unknown as Record<string, unknown>, field)) {
      violateMemory(
        out,
        memory.holderId,
        'memory-truth-copied',
        `${where}.${field}`,
        `믿음에 없던 진실이 기억에 실렸다 — ${field}`,
      );
    }
  }

  const attribution = memory.attribution;
  if (attribution !== null) {
    if (memory.ground === 'seen') {
      violateMemory(
        out,
        memory.holderId,
        'guessed-attribution',
        `${where}.attribution`,
        '본 것만으로 상대를 짚었다 — 밖에서 자국을 본 자는 누가 냈는지 알 길이 없다',
      );
    }
    if (attribution.source === 'lived' && memory.ground !== 'lived') {
      violateMemory(
        out,
        memory.holderId,
        'unlived-attribution',
        `${where}.attribution.source`,
        '겪었다고 적혔는데 뿌리가 겪음이 아니다',
      );
    }
    if (attribution.source === 'told' && attribution.viaIds.length === 0) {
      violateMemory(
        out,
        memory.holderId,
        'guessed-attribution',
        `${where}.attribution.viaIds`,
        '들었다고 적혔는데 거쳐 온 입이 없다',
      );
    }
    if (attribution.subjectId === memory.holderId && memory.ground === 'lived') {
      violateMemory(
        out,
        memory.holderId,
        'unlived-attribution',
        `${where}.attribution.subjectId`,
        '제 손으로 한 일은 겪음이 아니다',
      );
    }
  }

  if (memory.ground === 'told' && memory.hops === 0) {
    violateMemory(
      out,
      memory.holderId,
      'hopless-chain',
      `${where}.hops`,
      '들었다는데 거친 입이 0 이다',
    );
  }
  if (memory.ground !== 'told' && memory.hops !== 0) {
    violateMemory(
      out,
      memory.holderId,
      'hopless-chain',
      `${where}.hops`,
      '제 몸·제 눈으로 안 것에는 거친 입이 없다',
    );
  }
}
