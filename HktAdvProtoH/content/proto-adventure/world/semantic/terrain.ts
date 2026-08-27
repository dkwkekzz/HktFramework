// World Semantic — Terrain (C-TERRAIN-001 ADDED)
//
// 이 세계의 장소에 대해 세계가 알던 것은 사각형 하나의 경계뿐이었다 (WORLD_BOUNDS).
// 그 안 어디에 서 있든 성질이 같았으므로 **위치는 거리를 재는 값**이었지 그 자체로
// 겪는 것이 아니었다 — 닿는가 · 사거리 안인가 · 지키는 자리 안인가는 전부 두 몸
// *사이*의 물음이다.
//
// 이 파일이 자리를 **무대 자체**에 붙인다. 위치가 처음으로 한 몸 혼자만으로 답이
// 정해지는 물음이 된다.
//
// 지키는 자리(relation.ts#GuardedGround)와 형태가 같고 소유가 다르다 —
// 그쪽은 **존재가 지닌 것**이라 그 존재가 사라지면 함께 사라지고, 이쪽은 무대의
// 것이라 아무도 없어도 거기 있다.

import { distance, type WorldPosition } from './position';

/**
 * 법칙의 이름 — **의미 코드다.** 규칙은 이 값을 비교할 뿐 분기하지 않는다.
 *
 * 여덟 대지형이 이 자리로 들어올 때 열려야 하는 것은 GROUND_LAWS 의 정의이지
 * 규칙이어야 한다 (INTENT-GROUND-LAW-IS-CONDITION-AND-RESULT-001).
 */
export type GroundLawId = 'heat-binding';

/** 자리가 그 법칙에 대해 어떤 자리인가 */
export type GroundZoneRole =
  | 'law' // 그 법칙이 작용하는 범위
  | 'respite'; // 그 법칙이 **멎는** 범위

/**
 * World.GroundZones 의 한 항목 — 범위 하나와 그것이 무엇의 자리인가.
 *
 * **`respite` 가 자기가 멎게 하는 법칙의 이름을 지니는 것이 요점이다.** 예외를 별도
 * 목록(SafeZones)으로 두면 그것은 법칙 *옆*에 놓인 다른 규칙이 되고 "안전은 위험이
 * 낮게 설정된 것이 아니다" 가 형태에서 무너진다. 이 모양에서는 예외가 그 법칙 없이는
 * 적을 수조차 없다 — 그리고 부수 효과로 **"모든 것을 막는 안전지대" 를 적을 방법이
 * 없다** (DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION).
 *
 * 자리는 겹칠 수 있다. 예외 자리가 법칙의 자리 안에 있다는 것이 곧 겹침이다.
 */
export interface GroundZone {
  id: string;
  law: GroundLawId;
  role: GroundZoneRole;
  center: WorldPosition;
  radius: number;
}

/**
 * 법칙 하나의 정의 — **이름이 아니라 조건과 결과다**
 * (DC-WORLD-TERRAIN-IS-A-PRINCIPLE · BT §15.2).
 *
 * "죽음의 땅" 은 법칙이 될 수 없고 "그 안에 있는 몸에서 열을 거두어 간다" 는 될 수
 * 있다 — 뒤엣것만이 조건과 결과를 지니므로 관찰되고 예측되고 이용될 수 있다.
 */
export interface GroundLawDefinition {
  id: GroundLawId;
  /** 몸의 어느 값을 거두어 가는가 — 의미 코드 */
  takes: 'warmth';
  /** 그 값을 초당 얼마나 거두어 가는가 */
  rate: number;
  /** 그 값이 다한 뒤 생명을 초당 얼마나 거두어 가는가 */
  lifeRate: number;
}

/**
 * GROUND_LAWS — 법칙의 정의들. **이 목록의 단일 출처는 여기다.**
 *
 * 지금 항목은 하나다. 법칙이 하나 늘어나는 일은 이 표에 줄이 하나 느는 일이며,
 * 그때 RULE-GROUND-LAW-APPLY-001 도 관찰도 고치지 않는다
 * (HOSTILITY_REASONS 가 선 형태 그대로).
 *
 * 결정론에 영향을 주는 값이므로 헤더 상수로 고정한다 — CVar 로 열지 않는다.
 *
 * ── heat-binding (열결속, BT §5.1) ────────────────────────────────
 *
 * 빙원 아래의 검은 광맥이 주변의 열을 흡수해 결정 속에 결속한다. 이곳은 위도가
 * 높아서 추운 것이 아니라 **대지가 살아 있는 모든 것으로부터 열을 거두어 가기
 * 때문에** 춥다.
 *
 * rate 4.0 — 가득한 몸(WARMTH_MAX 100)이 25초를 버틴다. 관찰자의 몸은 걷는 속도가
 * 6.0 이므로 지름 14 를 가로지르는 데 2.3초, 열 9 를 치른다. **스쳐 지나가는 것은
 * 거의 공짜이고 머무는 것은 값을 치른다** — 그것이 이 Cycle 이 묻는 판단의 전부다.
 *
 * **속도가 상수인 것은 모델링 주장이 아니라 범위 결정이다.** BT §5.2 는 광맥이
 * 일정한 속도로 흡수하지 *않는다* 고 적는다(굵기 · 포화 상태 · 지하 흐름). 갑작스러운
 * 흡수는 예고(원형 서리 무늬 · BT §5.4)와 한 몸이라 다음 후보가 함께 받는다
 * (02-intent.md REVIEW QUESTION 3 · 05-review.md 승인 ③).
 */
export const GROUND_LAWS: Readonly<Record<GroundLawId, GroundLawDefinition>> = {
  'heat-binding': { id: 'heat-binding', takes: 'warmth', rate: 4.0, lifeRate: 2.0 },
};

/** 그 자리 안에 있는가 — 몸의 반경을 더하지 않는다. 걸치는 것이 아니라 들어와 있는가를 묻는다 */
export function isInsideGroundZone(zone: GroundZone, position: WorldPosition): boolean {
  return distance(zone.center, position) <= zone.radius;
}

/**
 * 지금 이 위치에 작용하는 법칙들 — RULE-GROUND-LAW-APPLY-001 의 판정 본체.
 *
 * 읽는 것은 **위치와 자리 목록뿐이다.** 누구인지도, 무엇을 지녔는지도, 무엇을 하는
 * 중인지도 묻지 않는다 (INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001).
 *
 * 예외 판정이 **같은 법칙**을 묻는 것이 요점이다 — 다른 법칙의 예외 자리는 이 법칙을
 * 멎게 하지 못한다.
 *
 * 겹친 law 자리가 여럿이면 전부 돌려준다. 하나를 고르지 않는다 — 고르는 순간 어느
 * 것을 고를지의 판단이 규칙에 들어오고, 그것은 법칙이 아니라 조정이 된다.
 *
 * **어디에도 적히지 않는다.** 매 Tick 위치에서 다시 계산되므로 나가면 저절로 멎고,
 * 멎게 하는 규칙이 따로 없다 (DC-CONDITION-OPENS-WITHOUT-RECORDING).
 */
export function activeGroundLaws(zones: readonly GroundZone[], position: WorldPosition): GroundLawId[] {
  const active: GroundLawId[] = [];
  for (const zone of zones) {
    if (zone.role !== 'law') continue;
    if (!isInsideGroundZone(zone, position)) continue;
    if (active.includes(zone.law)) continue;
    if (isSheltered(zones, position, zone.law)) continue;
    active.push(zone.law);
  }
  return active;
}

/** 그 법칙이 멎는 자리 안에 있는가 — 같은 법칙의 respite 만이 멎게 한다 */
export function isSheltered(
  zones: readonly GroundZone[],
  position: WorldPosition,
  law: GroundLawId,
): boolean {
  return zones.some(
    (zone) => zone.role === 'respite' && zone.law === law && isInsideGroundZone(zone, position),
  );
}

/**
 * 지금 이 위치가 어느 법칙의 자리 안인가 — 멎어 있든 아니든.
 * 관찰이 `sheltered` 와 `none` 을 가르는 데 쓴다 (INTENT-GROUND-LAW-IS-OBSERVED-001).
 */
export function coveringGroundLaws(
  zones: readonly GroundZone[],
  position: WorldPosition,
): GroundLawId[] {
  const covering: GroundLawId[] = [];
  for (const zone of zones) {
    if (zone.role !== 'law') continue;
    if (!isInsideGroundZone(zone, position)) continue;
    if (!covering.includes(zone.law)) covering.push(zone.law);
  }
  return covering;
}
