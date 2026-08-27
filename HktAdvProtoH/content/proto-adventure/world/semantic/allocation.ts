// World Semantic — Allocation (C-COMBAT-001 ADDED)
//
// 지금 자신의 힘을 몸 · 능력 · 인지 중 어디에 몰아 두었는가.
// INTENT-BODY-HAS-AN-ALLOCATION-001 · INTENT-THE-SHARES-SUM-THE-SAME-001 ·
// INTENT-EACH-AXIS-OWNS-ITS-OWN-VALUES-001 · INTENT-THE-EVEN-ALLOCATION-ADDS-NOTHING-001
//
// **새 계산 축이 아니다.** 판정이 읽는 값을 매번 다시 세는 얼개는 C023 이 세웠고
// (semantic/combat.ts effectiveStat · RULE-EFFECTIVE-STATS-001), 배분은 그 합에
// 더해지는 **둘째 항**이다. 이 파일이 그 항의 크기를 정하는 값들을 소유한다.
//
// combat.ts 에 두지 않는 이유: combat.ts 는 이 파일을 읽고 이 파일은 아무것도 읽지
// 않는다. 배분은 겨룸의 계산이 아니라 **그 계산이 읽을 값을 정하는 표**이기 때문이다.
//
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 로 열지 않는다).

/** 지금의 배분 — 이름 하나. 몸마다 언제나 정확히 하나다 */
export type AllocationId = 'balanced' | 'reinforce' | 'hatsu' | 'hunter';

/** 힘이 갈 수 있는 세 곳 (UL §13) */
export type AllocationAxis = 'body' | 'ability' | 'awareness';

/**
 * 배분이 보탤 수 있는 값들 (다섯).
 *
 * 걸린 것이 보탤 수 있는 목록(item.ts ContributableStat — 여덟)과 **다른 목록**이다.
 * 둘의 합집합이 "유효 값을 물을 수 있는 값" 이며 그것은 combat.ts 가 소유한다
 * (EffectiveStatName). 걸린 것과 배분은 같은 합에 들어가지만 닿는 곳이 다르다.
 */
export type AllocatableStat =
  | 'physicalAttack'
  | 'armor'
  | 'resistance'
  | 'auraAttack'
  | 'insight';

export interface AllocationShares {
  body: number;
  ability: number;
  awareness: number;
}

/**
 * 세 몫의 합 — 어느 배분에서나 같다 (INTENT-THE-SHARES-SUM-THE-SAME-001).
 *
 * **이것이 "몰면 얇아진다" 의 근거다.** 합이 고정이므로 한 축의 몫이 크다는 것은
 * 다른 축의 몫이 그만큼 작다는 뜻이고, 그것이 검사가 아니라 배분의 생김새로 성립한다.
 * 합이 다른 항목은 배분이 아니다 — 아래 카탈로그가 그 불변식을 지킨다.
 */
export const ALLOCATION_SHARE_TOTAL = 6;

/** 고르게 나눈 몫 — 이 값에서의 거리가 곧 기여다 */
export const ALLOCATION_EVEN_SHARE = 2;

/**
 * 배분을 바꾸는 대가 (기력).
 *
 * **기존 기력에서 나온다** (DC-COMBAT-SHARED-BUDGET) — 배분 전용 자원은 없다.
 * 고급 기술이 30 이고 기본 기술이 12 를 채우므로(C007 의 수지) 15 는 기본 기술
 * 한 대 반이며, 세 번 바꾸면 고급 기술 한 번 반을 잃는다. 잠금(다시 바꾸기까지의
 * 기다림)을 두지 않는 것이 이 값 하나로 성립하는 이유다 — 잠금은 새 상태를 하나 더
 * 낳고 이 Cycle 이 더하는 상태는 하나뿐이다 (03 RULE-ALLOCATION-SET-001).
 */
export const ALLOCATION_SWITCH_CP_COST = 15;

/**
 * 배분의 목록과 각 배분의 세 몫 (World.AllocationCatalog).
 *
 * **판정은 이 이름을 조건으로 삼지 않는다.** 규칙이 묻는 것은 "지금 배분의 몫이
 * 얼마인가" 뿐이므로, 항목을 늘리거나 몫을 고치는 일에 규칙도 관찰도 시험도 열리지
 * 않는다 (C023 이 적용 자리에 대해, C012 가 타입 대응표에 대해 내린 판단 그대로).
 *
 * 이름은 UL §14 의 넷을 그대로 쓴다 — 균형 · 강화 · 발현 · 사냥꾼.
 */
export const ALLOCATION_CATALOG: Readonly<Record<AllocationId, Readonly<AllocationShares>>> = {
  balanced: { body: 2, ability: 2, awareness: 2 },
  reinforce: { body: 4, ability: 1, awareness: 1 },
  hatsu: { body: 1, ability: 4, awareness: 1 },
  hunter: { body: 1, ability: 1, awareness: 4 },
};

/** 카탈로그의 차례 — 관찰이 이 차례로 실린다. 같은 세계 상태면 같은 순서다 */
export const ALLOCATION_IDS = Object.keys(ALLOCATION_CATALOG) as readonly AllocationId[];

/** 아무것도 몰아 두지 않은 몸의 배분 — 모든 값에 0 을 보탠다 */
export const DEFAULT_ALLOCATION: AllocationId = 'balanced';

/**
 * 축이 지닌 값과, 몫 한 점이 그 값에 보태는 양 (World.AllocationAxes).
 *
 * **세 축이 지닌 값은 서로 겹치지 않는다** (INTENT-EACH-AXIS-OWNS-ITS-OWN-VALUES-001).
 * 이 표가 그 사실의 단일 출처이며, 아래 STAT_AXIS 가 그것을 뒤집어 색인한다 —
 * 한 값이 두 축에 있으면 그 색인이 만들어질 때 터진다.
 *
 * 축을 값 이름이 아니라 **의미**로 가른 결과다 (02 DESIGN TRACE 의 물음 ①):
 *
 *     몸    때리고 막고 버티는 값 — 몸 그 자체를 두껍게 하는 쪽 (UL §13 BODY)
 *     능력  기술이 오라로 내보내는 힘 — 몸이 아니라 기술이 내는 쪽 (UL §13 ABILITY)
 *     인지  살펴보지 않고도 아는 범위 (UL §13 AWARENESS)
 *
 * **관통 둘과 치명 둘은 어느 축에도 들지 않는다.** 배분을 바꿔도 움직이지 않으며
 * 그것이 결손이 아니라 그 값들의 성질이다 — 몰아 두는 일과 상관없는 힘이 있다
 * (INTENT-EACH-AXIS-OWNS-ITS-OWN-VALUES-001 의 마지막 문단).
 *
 * 크기의 근거는 03-world-semantic.md 의 BALANCE ②③ 이 소유한다.
 */
export const ALLOCATION_AXIS_STEPS: Readonly<
  Record<AllocationAxis, Readonly<Partial<Record<AllocatableStat, number>>>>
> = {
  body: { physicalAttack: 8, armor: 10, resistance: 6 },
  ability: { auraAttack: 12 },
  awareness: { insight: 20 },
};

/**
 * 값 → 그 값이 든 축 (뒤집은 색인).
 *
 * 겹침이 있으면 여기서 터진다 — "축은 겹치지 않는다" 를 주석이 아니라 구조가 지킨다.
 */
const STAT_AXIS: Readonly<Record<string, AllocationAxis>> = (() => {
  const index: Record<string, AllocationAxis> = {};
  for (const axis of Object.keys(ALLOCATION_AXIS_STEPS) as AllocationAxis[]) {
    for (const stat of Object.keys(ALLOCATION_AXIS_STEPS[axis])) {
      if (index[stat])
        throw new Error(
          `allocation: 값 "${stat}" 이 두 축에 있다 (${index[stat]} · ${axis}) — 축은 겹치지 않는다`,
        );
      index[stat] = axis;
    }
  }
  return index;
})();

/** 이 이름이 세계가 아는 배분인가 (RULE-ALLOCATION-SET-001 의 첫 관문) */
export function isAllocationId(value: string): value is AllocationId {
  return value in ALLOCATION_CATALOG;
}

/** 이 배분의 세 몫. 모르는 이름은 오지 않는다 — 관문이 앞에 선다 */
export function allocationShares(id: AllocationId): Readonly<AllocationShares> {
  return ALLOCATION_CATALOG[id];
}

/**
 * 이 배분이 이 값에 보태는 양 (파생 — 저장하지 않는다).
 *
 *     기여 = (그 값이 든 축의 몫 − 고른 몫) × 그 값의 몫 한 점
 *
 * 어느 축에도 들지 않는 값이면 0 이다. 그리고 **고른 배분(2·2·2)에서는 모든 값이 0
 * 이다** — (2 − 2) × step 이므로 INTENT-THE-EVEN-ALLOCATION-ADDS-NOTHING-001 이
 * 검사가 아니라 산술로 성립한다. 이것이 회귀의 근거다
 * (DC-COMBAT-ONE-LAYER-AT-A-TIME).
 *
 * 음수가 나올 수 있다 — 몰지 않은 축의 값은 실제로 얇아진다. 그 합이 0 아래로
 * 내려가지 않게 하는 바닥은 effectiveStat 이 지닌다 (RULE-EFFECTIVE-STATS-001).
 */
export function allocationContribution(id: AllocationId, stat: string): number {
  const axis = STAT_AXIS[stat];
  if (!axis) return 0;
  const step = ALLOCATION_AXIS_STEPS[axis][stat as AllocatableStat] ?? 0;
  return (allocationShares(id)[axis] - ALLOCATION_EVEN_SHARE) * step;
}
