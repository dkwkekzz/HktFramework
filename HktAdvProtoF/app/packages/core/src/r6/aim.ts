// R6-b 사이가 상대를 고른다 — 원한은 등지는 손을, 신뢰는 내미는 손을 부른다.
//
// 여기가 R6 가 실제로 비어 있던 자리를 채우는 곳이다. P1 의 갈래는 자리와 자원에 대한 것이었고,
// P2 는 "낼 수 있는가" 만 물었으며, P4 는 "무엇을 좇는가" 까지였다 — **누구에게** 는 어디에도
// 없었다. P4-b 조차 사이를 상대를 지목하지 않고 **적힌 상대들의 평균**으로 읽었고, 그것이 P4 가
// 남긴 부채였다("상대를 지목하는 것은 D5·R 의 몫").
//
// R6-b 가 정하는 것은 둘이고 **둘 다 결과를 갖는다.**
//
//   ① **겨눌 수 있는 것은 아는 상대뿐이다.**
//      아는 상대는 둘에서 온다 — **R5 지목이 짚은 자**(기억이 그를 가리킨다)와 **세계가 사이를
//      적어 둔 자**(D3 "적히지 않은 사이는 없는 사이"). 둘 다 아니면 그는 이 주체에게 존재하지
//      않는 것과 같고, 겨눌 수 없다.
//      → **결과**: 밖에서 자국만 본 자는 지목이 없으므로(R4 가 `actorId` 를 싣지 않는다) 남을
//        겨눈 의도를 내지 못한다. 그리고 **지목이 틀린 자는 엉뚱한 사람을 겨눈다** — 오해가
//        사건이 되는 자리가 정확히 여기다.
//
//   ② **누구를 겨누는가는 사이가 고른다.**
//      등지는 원자(P0-b `consent: against`)는 **원한이 가장 큰 상대**를, 내미는 원자(`mutual`)는
//      **신뢰가 가장 큰 상대**를 고른다. 축의 방향을 R6 가 정하지 않는다 — P4-b 가 "같은 신뢰
//      하나가 동의 축에 따라 반대로 읽힌다" 로 쓴 그 축 그대로이고, 값은 R5 가 잰 것 그대로다.
//      → **결과**: 같은 계획인데 사이가 다르면 **다른 사람을 겨눈다.**
//
// 못박는 것 둘: **고를 상대가 없으면 그 걸음은 서지 못한다**(아무나 겨누지 않는다). 그리고
// **그 축의 값이 실제로 선 상대만 후보다** — 원한이 0 인 자를 빼앗을 상대로 고르면 사이가 아무
// 뜻도 갖지 못하고 세계는 아는 사람이면 누구든 손대는 곳이 된다.
// → **결과**: 밖에서 자국만 본 자는 원한이 서지 않아 **빼앗을 상대가 없다**. 그런데 소문을 들으면
//   지목이 붙고 원한이 서서 **그 순간 겨눌 수 있게 된다** — R5 가 R6 로 흘러드는 자리가 이것이다.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { WorldState } from '../o2/index.ts';
import { atomLabel, type ActionAtom } from '../p0/index.ts';
import {
  RELATION_AXES,
  axisLabel,
  regardOf,
  writtenRegard,
  type Memory,
  type RegardOptions,
  type RelationAxis,
} from '../r5/index.ts';
import { consentOf, needsCounterpart, type Aim } from './intent.ts';
import { violateIntent, type IntentViolation } from './violation.ts';

/**
 * 동의 축이 어느 사이 축을 부르는가 — **R6 의 선언이다.**
 *
 * 원문이 "빼앗을 때는 원한이 큰 쪽을 고른다" 고 적어 주지는 않았다. 다만 지어낸 것도 아니다:
 * P0-b 가 등지는 셋(빼앗기·협박·배신)을 전부 **원한을 세우는** 원자로 적어 두었고 내미는 셋 중
 * 주고받기를 **신뢰를 세우는** 유일한 원자로 적어 두었으므로(P3-a 가 그것으로 물결 넷을 세웠다),
 * 등지는 손이 원한 쪽을 · 내미는 손이 신뢰 쪽을 보는 것은 그 표를 뒤집어 읽은 것이다.
 *
 * **결과가 없으면 이 선언은 없어야 한다** — 있다: 같은 계획이 사이에 따라 다른 사람을 겨눈다.
 */
export const CONSENT_AXIS: Readonly<Record<'mutual' | 'against', RelationAxis>> = {
  mutual: 'trust',
  against: 'grudge',
};

/** 그 원자가 어느 축을 보고 상대를 고르는가. 상대를 겨누지 않는 원자면 null. */
export function axisFor(atom: ActionAtom): RelationAxis | null {
  if (!needsCounterpart(atom)) return null;
  const consent = consentOf(atom);
  if (consent === 'none') return null;
  return CONSENT_AXIS[consent];
}

/** 이 주체가 아는 상대 하나 — 어떻게 알게 되었는가가 함께 선다. */
export interface KnownCounterpart {
  readonly subjectId: Id;
  /** 기억이 그를 짚었는가, 세계가 사이를 적어 두었는가 */
  readonly via: 'attribution' | 'written';
  readonly note: string;
}

/**
 * 이 주체가 아는 상대들 — **둘에서만 온다.**
 *
 * 기억의 지목(R5)과 세계에 적힌 사이(O2 `relational`)다. 둘 다 아니면 그는 이 주체에게 없는
 * 사람이다 — D3 이 "적히지 않은 사이는 없는 사이" 로 세운 태도 그대로다.
 */
export function knownCounterparts(
  memories: readonly Memory[],
  world: WorldState,
  subjectId: Id,
  candidates: readonly Id[],
): readonly KnownCounterpart[] {
  const blamed = new Set(
    memories
      .filter((memory) => memory.holderId === subjectId && memory.attribution !== null)
      .map((memory) => (memory.attribution as NonNullable<Memory['attribution']>).subjectId),
  );
  const known: KnownCounterpart[] = [];
  for (const other of candidates) {
    if (other === subjectId) continue;
    if (blamed.has(other)) {
      known.push({
        subjectId: other,
        via: 'attribution',
        note: '기억이 그를 짚었다 — 겪었거나 들었다',
      });
      continue;
    }
    const written = RELATION_AXES.some(
      (axis) => writtenRegard(world, subjectId, other, axis) !== 0,
    );
    if (written) {
      known.push({
        subjectId: other,
        via: 'written',
        note: '세계가 그와의 사이를 적어 두었다',
      });
    }
  }
  return stableSort(known, (left, right) => compareStrings(left.subjectId, right.subjectId));
}

/** 상대 하나를 놓고 잰 값 — 왜 골렸는지·왜 안 골렸는지가 함께 선다. */
export interface AimCandidate {
  readonly subjectId: Id;
  readonly via: KnownCounterpart['via'];
  readonly axis: RelationAxis;
  readonly value: number;
  readonly chosen: boolean;
  readonly note: string;
}

export interface AimSpec {
  readonly atom: ActionAtom;
  readonly subjectId: Id;
  readonly memories: readonly Memory[];
  readonly world: WorldState;
  /** 세계에 서 있는 다른 주체들 — 이 중에서 아는 자만 후보가 된다 */
  readonly candidates: readonly Id[];
  readonly options?: RegardOptions;
}

/** 겨눔이 선 결과 — 골랐으면 겨눔이, 못 골랐으면 사유가 남는다. */
export interface AimResult {
  readonly aim: Aim | null;
  /** 잰 상대 전부 — 안 골린 쪽도 값으로 남는다 */
  readonly candidates: readonly AimCandidate[];
  readonly violations: readonly IntentViolation[];
}

/**
 * 사이를 보고 겨눌 상대를 고른다.
 *
 * 값은 R5 `regardOf` 가 잰 것 그대로다 — 여기서 다시 재지 않는다. 고르는 규칙은 **가장 큰 값**
 * 하나이고, 같으면 id 순으로 갈린다(결정성).
 */
export function chooseAim(spec: AimSpec): AimResult {
  const violations: IntentViolation[] = [];
  const { atom, subjectId, memories, world } = spec;

  if (!needsCounterpart(atom)) {
    return { aim: null, candidates: [], violations };
  }

  const axis = axisFor(atom);
  if (axis === null) {
    violateIntent(
      violations,
      subjectId,
      'aimless-intent',
      '$.aim.axis',
      `${atomLabel(atom)} 가 볼 축이 없다 — 동의 축이 적히지 않은 원자다`,
    );
    return { aim: null, candidates: [], violations };
  }

  const known = knownCounterparts(memories, world, subjectId, spec.candidates);
  const measured = known.map((entry) => {
    const relationship = regardOf(memories, world, subjectId, entry.subjectId, spec.options).find(
      (item) => item.axis === axis,
    );
    return { entry, value: relationship?.value ?? 0 };
  });

  // **값이 없으면 겨눌 이유가 없다.** 원한이 0 인 자를 빼앗을 상대로 고르면 사이가 아무 뜻도
  // 갖지 못하고, 세계는 아는 사람이면 누구든 손대는 곳이 된다. 그래서 그 축의 값이 실제로 선
  // 상대만 후보가 된다 — 불신하는 자(신뢰 음수)와 주고받지 않는 것도 같은 규칙의 다른 면이다.
  const best = measured
    .filter((item) => item.value > 0)
    .reduce<{ entry: KnownCounterpart; value: number } | null>((top, item) => {
      if (top === null) return item;
      if (item.value > top.value) return item;
      if (item.value === top.value && item.entry.subjectId < top.entry.subjectId) return item;
      return top;
    }, null);

  const candidates: readonly AimCandidate[] = measured.map((item) => ({
    subjectId: item.entry.subjectId,
    via: item.entry.via,
    axis,
    value: item.value,
    chosen: best !== null && item.entry.subjectId === best.entry.subjectId,
    note:
      best !== null && item.entry.subjectId === best.entry.subjectId
        ? `그 축(${axisLabel(axis)})이 가장 크다 — ${item.entry.note}`
        : item.value <= 0
          ? `그 축(${axisLabel(axis)})이 서 있지 않다 — 겨눌 이유가 없다`
          : `그 축(${axisLabel(axis)})이 더 작다 — 겨누지 않는다`,
  }));

  if (best === null) {
    violateIntent(
      violations,
      subjectId,
      'aimless-intent',
      '$.aim',
      known.length === 0
        ? `${atomLabel(atom)} 로 겨눌 상대가 없다 — 기억이 짚은 자도 세계가 사이를 적어 둔 자도 없다`
        : `${atomLabel(atom)} 로 겨눌 상대가 없다 — 아는 상대는 ${String(known.length)} 이지만 그 축(${axisLabel(axis)})이 선 자가 하나도 없다`,
    );
    return { aim: null, candidates, violations };
  }

  return {
    aim: {
      counterpartId: best.entry.subjectId,
      axis,
      value: best.value,
      via: best.entry.via,
      note: `${axisLabel(axis)} ${best.value.toFixed(3)} — ${best.entry.note}`,
    },
    candidates,
    violations,
  };
}

/**
 * 겨눔 하나를 검사한다 — **사이에서 다시 고르면 같은 상대여야 한다.**
 *
 * 손으로 바꿔 적으면 `aim-drift` 로 걸린다 (R4 `confidence-drift` · R5 `regard-drift` 와 같은 태도).
 */
export function checkAim(
  aim: Aim,
  spec: AimSpec,
  out: IntentViolation[],
): void {
  const where = '$.intents[].aim';
  if (aim.counterpartId === spec.subjectId) {
    violateIntent(out, spec.subjectId, 'self-aimed', `${where}.counterpartId`, '자기 자신을 겨눴다');
    return;
  }
  const known = knownCounterparts(spec.memories, spec.world, spec.subjectId, spec.candidates);
  if (!known.some((entry) => entry.subjectId === aim.counterpartId)) {
    violateIntent(
      out,
      spec.subjectId,
      'unknown-counterpart',
      `${where}.counterpartId`,
      '모르는 상대를 겨눴다 — 기억이 짚지도 않았고 세계가 사이를 적어 두지도 않았다',
    );
    return;
  }
  const again = chooseAim(spec).aim;
  if (again === null) return;
  if (again.counterpartId !== aim.counterpartId) {
    violateIntent(
      out,
      spec.subjectId,
      'aim-drift',
      `${where}.counterpartId`,
      `사이에서 다시 고르면 ${again.counterpartId} 인데 ${aim.counterpartId} 가 적혀 있다`,
    );
  }
  if (Math.abs(again.value - aim.value) > 1e-9) {
    violateIntent(
      out,
      spec.subjectId,
      'aim-drift',
      `${where}.value`,
      `사이를 다시 재면 ${again.value.toFixed(3)} 인데 ${aim.value.toFixed(3)} 이 적혀 있다`,
    );
  }
}
