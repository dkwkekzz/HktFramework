// World Semantic — Terrain (C-TERRAIN-001 ADDED · C-TERRAIN-002 CHANGED)
//
// 이 세계의 장소에 대해 세계가 알던 것은 사각형 하나의 경계뿐이었다 (WORLD_BOUNDS).
// 그 안 어디에 서 있든 성질이 같았으므로 **위치는 거리를 재는 값**이었지 그 자체로
// 겪는 것이 아니었다 — 닿는가 · 사거리 안인가 · 지키는 자리 안인가는 전부 두 몸
// *사이*의 물음이다.
//
// C-TERRAIN-001 이 자리를 **무대 자체**에 붙였다. 위치가 처음으로 한 몸 혼자만으로
// 답이 정해지는 물음이 되었다.
//
// ── C-TERRAIN-002 가 더하는 것: 자리에 **시간**이 생긴다 ─────────────────
//
// 그때 땅은 거두기만 하는 상수였다 — 거둔 것이 어디로도 가지 않고 사라졌고, 법칙이
// 멎는 자리는 손으로 놓여 "왜 하필 거기가 안전한가" 에 세계가 답하지 못했다.
//
// 이 판이 그 둘을 하나로 잇는다. **거둔 것을 자리가 간직하면 예외는 저절로 법칙의
// 결과가 된다.** 그래서 `role` 이 사라졌다 — 자리는 전부 자기 법칙의 맥이고, 법칙이
// 멎는 자리란 지금 넘쳐서 뿜는 중인 맥이다. 이 세계에는 이제 **영구히 안전한 자리를
// 적을 방법이 없다** (DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION).
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

/**
 * 자리가 지금 어느 단계인가 (C-TERRAIN-002 ADDED — `GroundZoneRole` 을 대신한다).
 *
 * **State 이지 파생값이 아니다.** `kept >= saturation` 으로 매번 계산하면 넘친 순간
 * 곧바로 아래로 떨어져 뿜음이 한 Tick 만 일어난다. 뿜는 일이 시간을 지니려면
 * "넘쳤다" 와 "뿜는 중" 이 갈라져야 한다 (03-world-semantic.md WORLD STATE).
 */
export type GroundZonePhase =
  | 'binding' // 거두는 중 — 그 안의 몸에서 법칙이 거두어 간다
  | 'venting'; // 뿜는 중 — 그 자리에서 법칙이 멎고, 지닌 것을 내보낸다

/**
 * World.GroundZones 의 한 항목 — 범위 하나와 그 자리가 지금 지닌 것.
 *
 * **`role` 이 없는 것이 요점이다.** 예외를 놓을 형이 없으므로 "여기는 안전한 곳" 을
 * 세계에 적을 수 없고, 안전은 속성이 아니라 **지금의 상태**가 된다
 * (INTENT-THE-EXCEPTION-IS-NOT-PLACED-001).
 *
 * 자리는 겹칠 수 있다. 겹친 채로 서로 다른 단계에 있을 수 있다 — 하나는 차오르고
 * 하나는 뿜는다.
 */
export interface GroundZone {
  id: string;
  law: GroundLawId;
  center: WorldPosition;
  radius: number;
  /** 이 자리가 지금 지닌 것 — 몸에서 거둔 만큼 쌓인다. 0 이상, saturation 을 넘지 않는다 */
  kept: number;
  /** 지금 어느 단계인가 */
  phase: GroundZonePhase;
}

/**
 * 법칙 하나의 정의 — **이름이 아니라 조건과 결과다**
 * (DC-WORLD-TERRAIN-IS-A-PRINCIPLE · BT §15.2).
 *
 * "죽음의 땅" 은 법칙이 될 수 없고 "그 안에 있는 몸에서 열을 거두어 간다" 는 될 수
 * 있다 — 뒤엣것만이 조건과 결과를 지니므로 관찰되고 예측되고 이용될 수 있다.
 *
 * C-TERRAIN-002 가 항 셋을 더한다. **셋 다 자리가 아니라 법칙이 지닌다** — 자리마다
 * 손으로 정하는 값이면 "이 자리는 오래 열려 있다" 를 적을 수 있게 되고, 그것은 놓인
 * 예외가 이름을 바꿔 돌아온 것이다.
 */
export interface GroundLawDefinition {
  id: GroundLawId;
  /** 몸의 어느 값을 거두어 가는가 — 의미 코드 */
  takes: 'warmth';
  /** 그 값을 초당 얼마나 거두어 가는가 */
  rate: number;
  /** 그 값이 다한 뒤 생명을 초당 얼마나 거두어 가는가 */
  lifeRate: number;
  /** 넘침 지점 — 자리에 쌓인 것이 이에 이르면 뿜기 시작한다 (C-TERRAIN-002 ADDED) */
  saturation: number;
  /** 뿜을 때 그 자리 안의 몸 하나가 초당 받는 양 (C-TERRAIN-002 ADDED) */
  ventRate: number;
  /** 받는 몸이 없을 때 초당 하늘로 흩어지는 양 (C-TERRAIN-002 ADDED) */
  escapeRate: number;
}

/**
 * GROUND_LAWS — 법칙의 정의들. **이 목록의 단일 출처는 여기다.**
 *
 * 지금 항목은 하나다. 법칙이 하나 늘어나는 일은 이 표에 줄이 하나 느는 일이며,
 * 그때 RULE-GROUND-LAW-APPLY-001 도 RULE-GROUND-VENT-001 도 관찰도 고치지 않는다.
 *
 * 결정론에 영향을 주는 값이므로 헤더 상수로 고정한다 — CVar 로 열지 않는다.
 *
 * ── heat-binding (열결속, BT §5.1) ────────────────────────────────
 *
 * 빙원 아래의 검은 광맥이 주변의 열을 흡수해 결정 속에 결속한다. 이곳은 위도가
 * 높아서 추운 것이 아니라 **대지가 살아 있는 모든 것으로부터 열을 거두어 가기
 * 때문에** 춥다. 포화되면 거둔 열을 도로 뿜고, 그 자리가 따뜻하다 (BT §5.3).
 *
 * 값의 근거 (03-world-semantic.md BALANCE 1):
 *
 *   rate       4.0   가득한 몸(WARMTH_MAX 100)이 25초를 버틴다
 *   lifeRate   2.0   열이 다한 뒤 생명에 닿는 속도
 *   saturation  60   **한 몸이 지닌 것의 60% 로 자리 하나를 넘치게 한다.** 빈 자리를
 *                    혼자 넘치게 하려면 15초를 머물러야 하고, 반경 5 를 가로지르는
 *                    것(1.7초 · 열 7)으로는 결코 넘치지 않는다 — 머무는 것과 지나는
 *                    것이 갈리는 자리가 이 값이다
 *   ventRate   6.0   거두는 속도보다 빠르다. 느리면 "돌려받는다" 가 플레이에서
 *                    "덜 잃는다" 로 읽히고 그것은 다른 뜻이다
 *   escapeRate 1.5   아무도 받지 않는 분출구는 40초 만에 닫힌다. **이 값이 "어제 쉬어
 *                    간 자리가 오늘은 닫혀 있다" 를 한 판 안에서 겪히게 한다** —
 *                    0 이면 아무도 쓰지 않은 자리가 영영 열려 있고 예외는 다시 상수가 된다
 *
 * **거두는 속도가 상수인 것은 모델링 주장이 아니라 범위 결정이다.** BT §5.2 는 광맥이
 * 일정한 속도로 흡수하지 *않는다* 고 적는다(굵기 · 포화 상태 · 지하 흐름). 갑작스러운
 * 흡수는 예고(원형 서리 무늬 · BT §5.4)와 한 몸이라 다음 후보가 함께 받는다.
 */
export const GROUND_LAWS: Readonly<Record<GroundLawId, GroundLawDefinition>> = {
  'heat-binding': {
    id: 'heat-binding',
    takes: 'warmth',
    rate: 4.0,
    lifeRate: 2.0,
    saturation: 60,
    ventRate: 6.0,
    escapeRate: 1.5,
  },
};

/** 그 자리 안에 있는가 — 몸의 반경을 더하지 않는다. 걸치는 것이 아니라 들어와 있는가를 묻는다 */
export function isInsideGroundZone(zone: GroundZone, position: WorldPosition): boolean {
  return distance(zone.center, position) <= zone.radius;
}

/**
 * 지금 이 위치에서 거두는 자리들 — RULE-GROUND-LAW-APPLY-001 의 판정 본체.
 * (C-TERRAIN-002 CHANGED — was `activeGroundLaws`, 법칙 이름 대신 **자리**를 돌려준다)
 *
 * 자리를 돌려주는 이유는 보존이다. 거두어 간 것이 어디로 가는지를 규칙이 알아야 하며,
 * 법칙 이름만으로는 받는 자리를 지목할 수 없다 (INTENT-ONE-PLACE-RECEIVES-WHAT-IS-TAKEN-001).
 *
 * 읽는 것은 **위치와 자리 목록뿐이다.** 누구인지도, 무엇을 지녔는지도, 무엇을 하는
 * 중인지도 묻지 않는다 (INTENT-GROUND-LAW-DOES-NOT-CHOOSE-WHOM-001).
 *
 * 법칙당 하나만 돌려준다 — 겹친 자리가 여럿이어도 거두는 일은 한 번이고, 그러므로
 * 받는 자리도 하나여야 한다. 둘에 나누어 넣거나 양쪽에 같은 만큼 넣는 것은 **없던 열을
 * 만들거나 지우는 일**이다. 고르는 기준은 **중심이 가장 가까운 자리**이고, 같으면
 * 목록에서 앞선 것이다 — 그래서 맥의 중심 가까이 머물수록 그 맥이 빨리 찬다.
 *
 * 예외 판정이 **같은 법칙**을 묻는 것이 요점이다 — 다른 법칙의 뿜는 자리는 이 법칙을
 * 멎게 하지 못한다.
 *
 * **어디에도 적히지 않는다.** 매 Tick 위치에서 다시 계산되므로 나가면 저절로 멎고,
 * 멎게 하는 규칙이 따로 없다 (DC-CONDITION-OPENS-WITHOUT-RECORDING).
 */
export function bindingZonesAt(
  zones: readonly GroundZone[],
  position: WorldPosition,
): GroundZone[] {
  const chosen = new Map<GroundLawId, { zone: GroundZone; d: number }>();

  for (const zone of zones) {
    if (zone.phase !== 'binding') continue;
    if (!isInsideGroundZone(zone, position)) continue;
    if (isSheltered(zones, position, zone.law)) continue;

    const d = distance(zone.center, position);
    const best = chosen.get(zone.law);
    // 같은 거리면 앞선 것을 지킨다 — 목록 순서가 결정론을 소유한다
    if (best === undefined || d < best.d) chosen.set(zone.law, { zone, d });
  }

  return [...chosen.values()].map((c) => c.zone);
}

/** 지금 이 위치에 걸린 법칙들 — 관찰과 옛 호출부가 쓰는 얇은 껍데기 */
export function activeGroundLaws(
  zones: readonly GroundZone[],
  position: WorldPosition,
): GroundLawId[] {
  return bindingZonesAt(zones, position).map((z) => z.law);
}

/**
 * 그 법칙이 멎는 자리 안에 있는가 (C-TERRAIN-002 CHANGED).
 *
 * 멎게 하는 것은 **같은 법칙의 뿜는 중인 자리**뿐이다. 놓인 예외 자리가 아니라
 * 지금 넘쳐서 뿜고 있는 맥이며, 그것이 이 Cycle 의 전부다
 * (INTENT-VENTING-STOPS-THE-LAW-THERE-001).
 */
export function isSheltered(
  zones: readonly GroundZone[],
  position: WorldPosition,
  law: GroundLawId,
): boolean {
  return zones.some(
    (zone) => zone.phase === 'venting' && zone.law === law && isInsideGroundZone(zone, position),
  );
}

/** 지금 이 위치를 품은, 뿜는 중인 자리들 — RULE-GROUND-VENT-001 이 돌려줄 자리를 고른다 */
export function ventingZonesAt(
  zones: readonly GroundZone[],
  position: WorldPosition,
): GroundZone[] {
  return zones.filter((zone) => zone.phase === 'venting' && isInsideGroundZone(zone, position));
}

/**
 * 지금 이 위치가 어느 법칙의 자리 안인가 — 거두든 뿜든.
 * 관찰이 `sheltered`·`warming` 과 `none` 을 가르는 데 쓴다
 * (INTENT-GROUND-LAW-IS-OBSERVED-001).
 */
export function coveringGroundLaws(
  zones: readonly GroundZone[],
  position: WorldPosition,
): GroundLawId[] {
  const covering: GroundLawId[] = [];
  for (const zone of zones) {
    if (!isInsideGroundZone(zone, position)) continue;
    if (!covering.includes(zone.law)) covering.push(zone.law);
  }
  return covering;
}

/**
 * 그 자리가 지금 얼마나 찼는가 — 0..1 (C-TERRAIN-002 ADDED).
 *
 * **관찰은 이 비율만 받는다.** 날값(kept)과 넘침 지점(saturation)을 따로 실으면 화면이
 * 둘을 견주어 "곧 넘친다" 를 스스로 판정할 수 있게 되고, 그 순간 판정이 세계와 화면
 * 두 곳에 산다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export function groundZoneFill(zone: GroundZone): number {
  const law = GROUND_LAWS[zone.law];
  if (law.saturation <= 0) return 0;
  return Math.min(1, Math.max(0, zone.kept / law.saturation));
}
