// World Semantic — 능력의 성립 사정 (C-COMBAT-003 ADDED)
//
// 능력이 지금 가능한가와 그 한 방이 얼마나 큰가를 가르는 **세계의 사실**들.
// INTENT-ABILITY-HAS-CIRCUMSTANCES-001 · INTENT-CIRCUMSTANCES-ARE-A-LIST-001 ·
// INTENT-CIRCUMSTANCE-IS-DERIVED-NOT-RECORDED-001
//
// 이 파일의 성질 넷이 이 Cycle 의 핵심이다.
//   1. 사정은 **목록**이다. 판정은 목록을 읽을 뿐이며 어떤 사정도 자기 안에 적지 않는다 —
//      `relation.ts` 의 HOSTILITY_REASONS (C018) 와 같은 꼴이고 같은 이유다. 항목을
//      더해도 관문(rules/skill.ts)도 위력 선택(rules/ability-circumstance.ts)도
//      관찰(projection/observer-view.ts)도 한 줄 열리지 않는다.
//   2. 사정은 **저장되지 않는다.** 물을 때마다 지금의 세계에서 다시 센다. 그래서
//      사정이 연 것을 닫는 규칙이 세계에 없다 (DC-CONDITION-OPENS-WITHOUT-RECORDING).
//      `struck-by-them` 이 지나간 일을 보지만 그 일은 세계가 **이미 지니고 스스로
//      사라지는** 것이다 (World.StrikeEvents · STRIKE_EVENT_TTL) — 이 사정 때문에
//      새로 적히는 것은 없다 (Q61(a)).
//   3. **한 목록을 두 자리가 읽는다.** 갖춰져야 시작되는 자리(요구)와 참인 동안 커지는
//      자리(조건)가 같은 항목을 부른다. 무엇이 요구이고 무엇이 조건인지는 **기술이**
//      정한다 (SkillDefinition.requires / amplifiedBy) — 사정 자신이 아니다.
//   4. 사정은 **주체의 종류를 묻지 않는다.** 사람이 조종하는 몸인지 스스로 판단하는
//      몸인지는 어떤 항목의 입력도 아니다 (HOSTILITY_REASONS 와 같은 자리).
//
// combat.ts 에 두지 않는 이유: 이 파일은 combat.ts 를 읽지 않고 combat.ts 가 이 파일을
// 읽는다. 사정은 겨룸의 계산이 아니라 **그 계산이 성립하는지와 무엇을 입력받는지를
// 정하는 표**이기 때문이다 (allocation.ts 가 선 자리와 같다).
//
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 로 열지 않는다).

import type { ActorState } from './actor';
import { allocationShares } from './allocation';

/** 세계가 아는 사정의 이름 */
export type CircumstanceId = 'power-in-ability' | 'struck-by-them' | 'life-below-half';

/**
 * 갖춰지지 않았을 때 세계가 내보내는 사유 코드.
 *
 * 사정마다 자기 코드를 지닌다 (DC-WORLD-OWNS-THE-SURFACE-LIST 의 prefers —
 * "목록의 각 항목이 자기 사유 코드를 함께 지니는 것"). 사정이 늘면 이 갈래가 늘고,
 * 그것을 문구로 옮기는 자리(view/code-text.ts)가 한 줄 는다 — 그 밖에는 열리지 않는다.
 */
export type CircumstanceUnmetReason =
  | 'power-not-in-ability'
  | 'not-struck-by-them'
  | 'life-not-below-half';

/**
 * 사정이 읽는 **지금** — 수명이 정해진 세계의 사실들.
 *
 * World.StrikeEvents 를 그대로 받지 않고 필요한 자리만 좁혀 받는다. 그래야 이 파일이
 * combat.ts 를 읽지 않고, 사정이 세계의 무엇이든 볼 수 있다는 착각도 생기지 않는다.
 */
export interface CircumstanceNow {
  /**
   * 아직 살아 있는 타격 결과들 — RULE-STRIKE-EVENT-EXPIRE-001 이 지운 뒤의 것.
   *
   * 이름과 모양을 World.StrikeEvents 에 맞춰 둔다. 그래서 세계 자체가 이 형에 그대로
   * 들어맞고, 사정을 물을 때 중간 자료를 짓지 않아도 된다.
   */
  strikeEvents: readonly { attackerId: string; targetId: string }[];
}

/**
 * 사정 하나. `holds(self, other, now)` 는 "지금 이것이 참인가" 를 답한다.
 *
 * `other` 는 **관문 자리에서 없다** (쓰기 전이라 대상이 정해지지 않았다). 그러므로
 * 상대를 읽는 사정은 관문에서 언제나 거짓이며, 그런 사정을 요구로 걸면 그 기술은
 * 결코 나가지 않는다 — **세계는 지금 그런 조합을 만들지 않는다.** 그것이 필요해지는
 * 날은 관문이 고른 대상을 받는 날이다 (표식이 요구가 되는 Cycle).
 */
export interface AbilityCircumstance {
  id: CircumstanceId;
  /** 갖춰지지 않았을 때 세계가 내보내는 사유 코드 (DC-COMBAT-UNAVAILABLE-HAS-A-REASON) */
  unmetReason: CircumstanceUnmetReason;
  holds(self: ActorState, other: ActorState | null, now: CircumstanceNow): boolean;
}

/**
 * 능력 축에 이만큼 이상 몰려 있어야 한다 (UL §18 의 `Aura Ability ≥ 3`).
 *
 * 지금 세계의 배분 넷 중 이 문턱을 넘는 것은 `hatsu`(4) 하나다. 고른 배분(2)보다
 * 크다는 것이 곧 "몰아 두었다" 의 뜻이며, 2 로 두면 `balanced` 에서도 열려 그 뜻이
 * 사라진다 (03-world-semantic.md BALANCE ④).
 */
export const ABILITY_ALLOCATION_REQUIREMENT = 3;

/**
 * ABILITY_CIRCUMSTANCES — 세계가 아는 사정들. **이 목록의 단일 출처는 여기다.**
 *
 * 지금 셋이다. 무엇이 능력의 성립을 가르는지는 이후 Cycle 이 이 배열에 항목을 더하며
 * 정하고, 그때 RULE-SKILL-BEGIN-001 도 RULE-ABILITY-CONDITION-001 도 Observer
 * Projection 도 고치지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export const ABILITY_CIRCUMSTANCES: readonly AbilityCircumstance[] = [
  {
    // 지금의 배분이 능력 축에 몰려 있다 (UL §15 · §18).
    // **C-COMBAT-001 이 남긴 결손을 닫는 항목이다** — 배분이 값만 바꾸고 무엇을 할 수
    // 있는가의 목록을 바꾸지 않던 자리에, 목록을 바꾸는 첫 사정이 선다.
    id: 'power-in-ability',
    unmetReason: 'power-not-in-ability',
    holds: (self) => allocationShares(self.allocation).ability >= ABILITY_ALLOCATION_REQUIREMENT,
  },
  {
    // 그 상대가 최근에 나를 쳤다 (UL §19 의 첫 예).
    // 상대를 읽으므로 **관문 자리에서는 언제나 거짓**이다 — 조건으로만 걸린다.
    id: 'struck-by-them',
    unmetReason: 'not-struck-by-them',
    holds: (self, other, now) =>
      other !== null &&
      now.strikeEvents.some((e) => e.attackerId === other.id && e.targetId === self.id),
  },
  {
    // 내 생명이 절반 이하다 (UL §19 의 넷째 예).
    // 지금의 값에서 매번 다시 센다 — `isDowned` 와 같은 자리, 같은 꼴이다.
    id: 'life-below-half',
    unmetReason: 'life-not-below-half',
    holds: (self) => self.hp * 2 <= self.hpMax,
  },
];

/** 이름으로 사정을 찾는다. 모르는 이름은 오지 않는다 — 기술의 정의가 앞에 선다 */
export function abilityCircumstance(id: CircumstanceId): AbilityCircumstance {
  const found = ABILITY_CIRCUMSTANCES.find((c) => c.id === id);
  if (!found) throw new Error(`circumstance: 세계가 모르는 사정 "${id}"`);
  return found;
}

/** 이 사정이 지금 참인가 (파생 — 저장하지 않는다) */
export function circumstanceHolds(
  id: CircumstanceId,
  self: ActorState,
  other: ActorState | null,
  now: CircumstanceNow,
): boolean {
  return abilityCircumstance(id).holds(self, other, now);
}

/** 아무 사실도 없는 지금 — 사정을 물을 자리에 세계가 없을 때의 기준값 */
export const EMPTY_NOW: CircumstanceNow = { strikeEvents: [] };
