// E0-b 묶음과 알아봄 — 겹쳤다고 서로를 아는 것은 아니다.
//
// E0-a 가 걸림을 한 평면에 늘어놓았다. 이제 그 평면에서 **둘 이상이 걸린 자리**만 상황이 된다.
// 여기가 E0 가 실제로 정하는 두 가지가 서는 곳이고, 둘 다 결과를 갖는다.
//
//   ① **혼자 걸린 자리는 상황이 아니다.**
//      세계의 대부분은 상황이 아니다. 이 못이 없으면 모든 의도가 상황이 되고, 상황이 흔해지면
//      아무 뜻도 갖지 못한다 — D5 가 "겹친다고 다툼은 아니다" 로 세운 그 못을 그대로 진다.
//      → **결과**: 혼자 걸린 자리는 `Solitude` 로 남는다. 위반이 아니라 **사실**이다.
//
//   ② **겹쳤다고 서로를 아는 것은 아니다.**
//      D5 는 "이 대상 앞에 이들이 함께 서 있다" 까지였고 주체끼리는 잇지 않았다 — 서로를
//      봐야 알기 때문이다. R3·R4·R5·R6 이 선 지금 그것을 값으로 잴 수 있다. 같은 자리에
//      걸린 둘 사이는 셋으로 갈린다:
//
//        `mutual`     둘이 서로를 겨눈다 — **여기서 처음으로 주체와 주체가 이어진다**
//        `one-sided`  한쪽만 겨눈다 — 상대는 겨누지 않는다
//        `blind`      아무도 겨누지 않는다 — 같은 자리에 걸렸을 뿐이다 (D5 가 멈춘 자리)
//
//      그리고 그 위에 **앎**이 겹친다. R6 는 "겨눌 수 있는 것은 아는 상대뿐" 이라고 못박았으므로
//      겨누는 자는 언제나 상대를 안다 — 그러나 **겨눔당하는 쪽은 그를 모를 수 있다.**
//      → **결과**: `ambush` 가 참인 쌍이 선다. 겨누는데 상대가 그를 모르는 자리다.
//        이 값이 E3 능력 충돌 판정의 **정보 표면** 입력이 된다(MODULES.md E3 — "정보 상태만
//        바꿔 승패가 뒤집히는 장면"). 그 장면이 서려면 정보가 먼저 상황 안에 값으로 있어야 한다.
//
// **E0 는 앎을 다시 재지 않는다.** R6 `knownCounterparts` 가 유일한 자다 — R5 지목이 짚은 자와
// 세계가 사이를 적어 둔 자 둘에서만 온다(D3 "적히지 않은 사이는 없는 사이"). 여기서 따로 재면
// 같은 물음에 두 답이 생긴다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareNumbers, compareStrings, stableSort } from '../v1/stable-sort.ts';
import { emptyWorld, type WorldState } from '../o2/index.ts';
import type { Memory } from '../r5/index.ts';
import { knownCounterparts } from '../r6/index.ts';
import {
  stakeAxisLabel,
  stakeKeyOf,
  stakesByKey,
  type SituationStake,
  type StakeAxis,
} from './stake.ts';

/** 같은 자리에 걸린 둘 사이에 겨눔이 어떻게 서는가. */
export type PairAim = 'mutual' | 'one-sided' | 'blind';

/** 그 둘이 서로를 아는가 — R6 `knownCounterparts` 가 잰 것 그대로다. */
export type PairAwareness = 'both' | 'one-way' | 'neither';

/** 상황 안의 쌍 하나 — **D5 이분 그래프가 긋지 않은 선이 여기서 그어진다.** */
export interface SituationPair {
  readonly id: Id;
  /** 사전순 앞의 주체 */
  readonly leftId: Id;
  readonly rightId: Id;
  readonly aim: PairAim;
  /** 겨눈 자들 — 서로 겨누면 둘, 한쪽만이면 하나, 아무도 겨누지 않으면 빈 배열 */
  readonly aimerIds: readonly Id[];
  readonly awareness: PairAwareness;
  readonly leftKnowsRight: boolean;
  readonly rightKnowsLeft: boolean;
  /**
   * 겨누는데 상대가 그를 모른다 — **매복**.
   *
   * R6 가 "겨눌 수 있는 것은 아는 상대뿐" 으로 못박았으므로 겨누는 쪽은 언제나 안다.
   * 그러니 이 값이 참이라는 것은 **겨눔당하는 쪽만 모른다**는 뜻이고, 그것이 E3 판정에
   * 들어가는 정보 비대칭이다. 서로 겨누는 쌍(`mutual`)에는 설 수 없다.
   */
  readonly ambush: boolean;
  readonly note: string;
}

/** 같은 자리에 둘 이상이 걸린 것 — **상황**. */
export interface Situation {
  readonly id: Id;
  readonly axis: StakeAxis;
  readonly key: string;
  readonly label: string;
  /** 걸린 자들 — 사전순 */
  readonly participants: readonly Id[];
  readonly stakes: readonly SituationStake[];
  readonly pairs: readonly SituationPair[];
  /** 가장 급한 걸림의 급함 — **D5·P4 가 잰 값 그대로**다 */
  readonly urgency: number;
  /** 서로를 알아본 쌍의 수 (`mutual`) */
  readonly recognized: number;
  /** 매복인 쌍의 수 */
  readonly ambushes: number;
  readonly note: string;
}

/** 혼자 걸린 자리 — **위반이 아니라 사실이다.** 세계의 대부분은 상황이 아니다. */
export interface Solitude {
  readonly axis: StakeAxis;
  readonly key: string;
  readonly subjectId: Id;
  readonly note: string;
}

/** 상황의 id — 유래(축 · 자리)에서 나온다 (V1 결정적 ID). */
export function situationIdOf(axis: StakeAxis, key: string): Id {
  return deterministicId('situation', axis, key);
}

/** 쌍의 id — 유래(상황 · 두 사람)에서 나온다. 사전순으로 세우므로 순서가 바뀌어도 같은 id 다. */
export function pairIdOf(situationId: Id, leftId: Id, rightId: Id): Id {
  const [first, second] = leftId <= rightId ? [leftId, rightId] : [rightId, leftId];
  return deterministicId('situation-pair', situationId, first, second);
}

/** 앎 둘을 한 이름으로 접는다. */
export function awarenessOf(leftKnowsRight: boolean, rightKnowsLeft: boolean): PairAwareness {
  if (leftKnowsRight && rightKnowsLeft) return 'both';
  if (leftKnowsRight || rightKnowsLeft) return 'one-way';
  return 'neither';
}

/** 겨눔의 사람이 읽는 이름. */
export function aimLabel(aim: PairAim): string {
  if (aim === 'mutual') return '서로 겨눈다';
  if (aim === 'one-sided') return '한쪽만 겨눈다';
  return '아무도 겨누지 않는다';
}

export interface ClusterSpec {
  readonly stakes: readonly SituationStake[];
  /** 누가 누구를 아는가의 재료 — R6 `knownCounterparts` 가 읽는다 */
  readonly memories?: readonly Memory[];
  readonly world?: WorldState;
}

/** 묶음 한 바퀴의 결과 — 선 상황들과, 상황이 되지 못한 자리들. */
export interface ClusterResult {
  readonly situations: readonly Situation[];
  /** 혼자 걸린 자리 — 사실이다 */
  readonly solitudes: readonly Solitude[];
}

function knowsTable(
  subjectIds: readonly Id[],
  memories: readonly Memory[],
  world: WorldState,
): ReadonlyMap<string, boolean> {
  const table = new Map<string, boolean>();
  for (const subjectId of subjectIds) {
    const known = knownCounterparts(memories, world, subjectId, subjectIds);
    for (const other of subjectIds) {
      if (other === subjectId) continue;
      table.set(
        `${subjectId} ${other}`,
        known.some((entry) => entry.subjectId === other),
      );
    }
  }
  return table;
}

/**
 * 자리 하나에 모인 걸림들에서 쌍을 세운다 — **참여자 둘마다 하나씩.**
 *
 * 겨눔은 사람 축의 걸림(`aimed`)에서만 읽는다. 그 걸림의 `key` 가 겨눔당한 자이므로,
 * "A 의 걸림이 B 를 가리킨다" 는 A→B 겨눔이다. E0 는 겨눔을 새로 고르지 않는다 (R6 가 골랐다).
 */
export function pairsOf(
  situationId: Id,
  participants: readonly Id[],
  aims: ReadonlySet<string>,
  knows: ReadonlyMap<string, boolean>,
): readonly SituationPair[] {
  const pairs: SituationPair[] = [];
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const leftId = participants[i] as Id;
      const rightId = participants[j] as Id;
      const leftAims = aims.has(`${leftId} ${rightId}`);
      const rightAims = aims.has(`${rightId} ${leftId}`);
      const aimerIds = [
        ...(leftAims ? [leftId] : []),
        ...(rightAims ? [rightId] : []),
      ];
      const aim: PairAim =
        leftAims && rightAims ? 'mutual' : leftAims || rightAims ? 'one-sided' : 'blind';
      const leftKnowsRight = knows.get(`${leftId} ${rightId}`) ?? false;
      const rightKnowsLeft = knows.get(`${rightId} ${leftId}`) ?? false;
      // 매복 — 겨누는 쪽이 하나뿐이고, 겨눔당한 쪽이 그를 모른다.
      const ambush =
        aim === 'one-sided' &&
        (leftAims ? !rightKnowsLeft : !leftKnowsRight);
      pairs.push({
        id: pairIdOf(situationId, leftId, rightId),
        leftId,
        rightId,
        aim,
        aimerIds,
        awareness: awarenessOf(leftKnowsRight, rightKnowsLeft),
        leftKnowsRight,
        rightKnowsLeft,
        ambush,
        note: ambush
          ? '겨누는데 상대가 그를 모른다 — 대비할 수 없는 자리다'
          : aim === 'mutual'
            ? '둘이 서로를 겨눈다 — 서로를 알아본 다툼이다'
            : aim === 'blind'
              ? '같은 자리에 걸렸을 뿐 아무도 겨누지 않는다'
              : '한쪽만 겨누고 상대도 그를 안다',
      });
    }
  }
  return pairs;
}

/**
 * 걸림들을 상황으로 묶는다 — **둘 이상 걸린 자리만 선다.**
 *
 * 새로 재는 것은 없다: 급함은 걸림이 진 값의 최대(D5·P4 가 잰 것)이고, 겨눔은 R6 가 고른 것이며,
 * 앎은 R6 `knownCounterparts` 가 잰 것이다. E0-b 가 더하는 것은 **묶는 규칙과 쌍의 이름**뿐이다.
 */
export function clusterStakes(spec: ClusterSpec): ClusterResult {
  const { stakes } = spec;
  const memories = spec.memories ?? [];
  const world = spec.world ?? emptyWorld();

  // 겨눔 표 — 사람 축의 걸림 하나가 "그가 그를 겨눈다" 한 줄이다.
  const aims = new Set(
    stakes
      .filter((stake) => stake.aimed && stake.axis === 'subject')
      .map((stake) => `${stake.subjectId} ${stake.key}`),
  );

  const byKey = stakesByKey(stakes);
  const situations: Situation[] = [];
  const solitudes: Solitude[] = [];

  for (const [, group] of byKey) {
    const first = group[0];
    if (first === undefined) continue;
    const participants = stableSort(
      [...new Set(group.map((stake) => stake.subjectId))],
      compareStrings,
    );
    if (participants.length < 2) {
      solitudes.push({
        axis: first.axis,
        key: first.key,
        subjectId: first.subjectId,
        note: '혼자 걸린 자리는 상황이 아니다 — 세계의 대부분은 상황이 아니다',
      });
      continue;
    }

    const id = situationIdOf(first.axis, first.key);
    const knows = knowsTable(participants, memories, world);
    const pairs = pairsOf(id, participants, aims, knows);
    const urgency = Math.max(...group.map((stake) => stake.urgency));
    const recognized = pairs.filter((pair) => pair.aim === 'mutual').length;
    const ambushes = pairs.filter((pair) => pair.ambush).length;
    situations.push({
      id,
      axis: first.axis,
      key: first.key,
      label: first.label,
      participants,
      stakes: group,
      pairs,
      urgency,
      recognized,
      ambushes,
      note:
        recognized > 0
          ? `${stakeAxisLabel(first.axis)} 앞에 ${String(participants.length)} 이 걸렸고 그중 ${String(recognized)} 쌍이 서로를 알아봤다`
          : `${stakeAxisLabel(first.axis)} 앞에 ${String(participants.length)} 이 걸렸으나 서로를 알아본 쌍은 없다`,
    });
  }

  return {
    situations: stableSort(situations, (left, right) => {
      const urgency = compareNumbers(right.urgency, left.urgency);
      if (urgency !== 0) return urgency;
      const axis = compareStrings(left.axis, right.axis);
      if (axis !== 0) return axis;
      return compareStrings(left.key, right.key);
    }),
    solitudes: stableSort(solitudes, (left, right) => {
      const axis = compareStrings(left.axis, right.axis);
      if (axis !== 0) return axis;
      return compareStrings(left.key, right.key);
    }),
  };
}

/** 그 상황 안에서 그 주체가 낀 쌍들. */
export function pairsFor(situation: Situation, subjectId: Id): readonly SituationPair[] {
  return situation.pairs.filter(
    (pair) => pair.leftId === subjectId || pair.rightId === subjectId,
  );
}

/** 사람이 읽는 한 줄. */
export function situationLine(situation: Situation): string {
  return `${stakeAxisLabel(situation.axis)} ${situation.key} — ${String(situation.participants.length)}명 · 쌍 ${String(situation.pairs.length)} (알아봄 ${String(situation.recognized)} · 매복 ${String(situation.ambushes)}) · 급함 ${situation.urgency.toFixed(2)}`;
}

/** 쌍 하나를 한 줄로. */
export function pairLine(pair: SituationPair): string {
  return `${pair.leftId} ↔ ${pair.rightId} — ${aimLabel(pair.aim)}${pair.ambush ? ' · 매복' : ''} (앎 ${pair.awareness})`;
}

/** 걸림 하나가 어느 상황의 이름 아래 있는가 — 감사(E0-c)가 대조에 쓴다. */
export function situationKeyOf(stake: SituationStake): string {
  return stakeKeyOf(stake);
}
