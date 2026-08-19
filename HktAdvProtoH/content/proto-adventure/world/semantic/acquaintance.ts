// World Semantic — World.Acquaintances (C014 ADDED)
//
// 누가 어떤 존재의 겨루는 힘을 알고 있는가 (INTENT-OBSERVE-KNOWLEDGE-001).
//
// 이 장부의 성질 셋이 이 Cycle 의 핵심이다.
//   1. 앎은 **세계가 지니는 사실**이다. 보는 이가 자기 쪽에 적어 두는 것이 아니다 —
//      그러면 Client 가 세계 상태를 소유하게 된다 (World Authority).
//   2. 담는 것은 **Id 뿐**이다. 능력치를 베껴 담지 않는다. 알게 된 것은 값이 아니라
//      자리가 열리는 것이며, 열린 뒤에는 언제나 그 순간의 Actor 에서 읽는다 —
//      베끼면 세계가 값을 바꿔도 보는 이의 손에는 옛 숫자가 남는다.
//   3. 열은 **ObserverId** 다. 한 사람이 알게 되었다고 다른 사람이 함께 알게 되지 않는다
//      (INTENT-PER-OBSERVER-PROJECTION-001 이 세운 구조에 얹히는 두 번째 관찰자별 사실).
//
// 항목이 없는 관찰자는 아무것도 모른다 — "모름" 을 따로 저장하지 않는다.
// 자율 존재는 이 장부를 쓰지 않는다. 가려짐은 **관찰 계약의 성질**이고
// 자율 존재는 관찰 계약이 아니라 세계 상태를 직접 읽는다 (RULE-NPC-DECIDE-001 무변경).
//
// C016 CHANGED — 앎의 단위가 존재에서 **자리**로 넓어진다 (INTENT-OBSERVE-KNOWLEDGE-001).
// 이 장부는 그대로다 — 살펴봄으로 얻은 앎만 담으며 모양이 바뀌지 않는다.
// 더해지는 것은 두 번째 길이다: 보는 이의 몸이 지닌 통찰이 자리를 연다.
// 두 길의 성질이 다르다는 것이 이 파일의 핵심이다.
//
//   살펴봄  장부에 남는다  → 되돌리면 사라진다  → 그 존재의 **모든** 자리를 연다
//   통찰    아무 데도 안 남는다 → 값이 내려가면 닫힌다 → 문턱을 넘은 자리만 연다
//
// 통찰이 연 것을 어디에도 적어 두지 않는 것이 규칙이다. 적어 두면 값을 내려도
// 열린 채 남아 "지금의 조건" 이 "지나간 기록" 으로 바뀐다 (INTENT-INSIGHT-OPENS-001).

/** 한 관찰자가 알게 된 존재들 */
export interface AcquaintanceState {
  observerId: string;
  knownActorIds: string[];
}

// 살펴본 뒤에만 관찰에 실리는 항목의 이름들 (INTENT-UNSEEN-IS-OBSERVABLE-001).
// **이 목록의 단일 출처는 여기다.** View 는 관찰에 실려 온 concealed 를 읽을 뿐이며
// "가려질 수 있는 것은 이 셋" 을 자기 코드에 적지 않는다
// (DC-WORLD-OWNS-THE-SURFACE-LIST). 가리는 항목이 늘거나 줄면 이 배열만 고친다.
export const CONCEALABLE_ATTRIBUTE_KEYS = [
  'combatStats',
  'versusObserver',
  'defenseShape',
] as const;

export type ConcealableAttributeKey = (typeof CONCEALABLE_ATTRIBUTE_KEYS)[number];

// 자리마다 요구하는 통찰 (C016 ADDED — INTENT-INSIGHT-OPENS-001).
// **목록 바로 옆에 둔다.** 문턱이 다른 파일에 있으면 자리를 늘릴 때 한쪽만 고쳐질 수 있다.
//
// 차례는 이해의 깊이를 따른다 (03 BALANCE · 05-review 판단 2).
//   30  defenseShape    얕다 — 어느 버팀이 무른가, 형태를 읽는 일
//   60  versusObserver  중간 — 내 통함이 저 버팀에 얼마로 닿는가, 나와 저것 사이
//   90  combatStats     깊다 — 저 존재가 지닌 값들 그 자체
//
// 문턱은 **대상을 읽지 않는다.** 어떤 존재는 더 읽기 어렵다는 의미를 이 층이 세우지
// 않는다 — 가리는 쪽의 능력은 아직 세계에 없다 (01 EXCLUDED).
export const INSIGHT_REVEAL_THRESHOLDS: Readonly<Record<ConcealableAttributeKey, number>> = {
  defenseShape: 30,
  versusObserver: 60,
  combatStats: 90,
};

// 왜 비어 있는가 — 지금 사유는 하나뿐이지만 자리를 사유 코드로 둔다.
// 값 하나로 굳혀 두면 다음 사유가 생길 때 계약이 깨진다.
export type UnacquaintedReason = 'not-observed';

export function findAcquaintance(
  acquaintances: AcquaintanceState[],
  observerId: string,
): AcquaintanceState | undefined {
  return acquaintances.find((entry) => entry.observerId === observerId);
}

/**
 * 이 관찰자가 이 존재의 겨루는 힘을 아는가.
 * 자기 몸은 언제나 참이다 — 자기 것을 아는 것은 장부의 일이 아니다.
 */
export function isAcquainted(
  acquaintances: AcquaintanceState[],
  observerId: string,
  actorId: string,
  selfActorId: string,
): boolean {
  if (actorId === selfActorId) return true;
  return findAcquaintance(acquaintances, observerId)?.knownActorIds.includes(actorId) ?? false;
}

/** 알게 한다 — 같은 존재를 두 번 담지 않는다 (집합이다) */
export function learnActor(
  acquaintances: AcquaintanceState[],
  observerId: string,
  actorId: string,
): void {
  const entry = findAcquaintance(acquaintances, observerId);
  if (!entry) {
    acquaintances.push({ observerId, knownActorIds: [actorId] });
    return;
  }
  if (!entry.knownActorIds.includes(actorId)) entry.knownActorIds.push(actorId);
}

/** 되돌린다 — 대상을 밝히지 않으면 알고 있는 전부다 */
export function forgetActor(
  acquaintances: AcquaintanceState[],
  observerId: string,
  actorId?: string,
): boolean {
  const entry = findAcquaintance(acquaintances, observerId);
  if (!entry) return false;
  if (actorId === undefined) {
    const had = entry.knownActorIds.length > 0;
    entry.knownActorIds = [];
    return had;
  }
  const at = entry.knownActorIds.indexOf(actorId);
  if (at < 0) return false;
  entry.knownActorIds.splice(at, 1);
  return true;
}

/**
 * RULE-INSIGHT-REVEAL-001 — 지금 이 존재에 대해 가려진 자리들.
 *
 * 상태를 바꾸지 않는 판정이다. 세계의 사실(Actor 가 지닌 값)은 그대로 있고,
 * 관찰에 실릴 때 이 관문을 지난다 (C014 06 NOTES ④ 의 자리 그대로).
 *
 *   살펴본 존재거나 자기 몸이면   → 빈 배열 (모든 자리가 열린다)
 *   그 외                        → 보는 이의 통찰이 문턱에 미치지 못한 자리들
 *
 * 통찰이 내려가면 같은 판정이 다시 가려진 목록을 내놓는다 — 연 것을 적어 두지 않기
 * 때문이다. 그래서 되돌림(RULE-OBSERVE-FORGET-001)이 장부만 지워도 두 길이 갈린다.
 */
export function concealedKeys(acquainted: boolean, observerInsight = 0): string[] {
  if (acquainted) return [];
  return CONCEALABLE_ATTRIBUTE_KEYS.filter(
    (key) => observerInsight < INSIGHT_REVEAL_THRESHOLDS[key],
  );
}

/** 이 자리가 지금 열려 있는가 — concealedKeys 의 반대편. 투영이 자리마다 묻는다 */
export function isSeatOpen(
  key: ConcealableAttributeKey,
  acquainted: boolean,
  observerInsight = 0,
): boolean {
  return acquainted || observerInsight >= INSIGHT_REVEAL_THRESHOLDS[key];
}
