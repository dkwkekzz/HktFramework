// World Semantic — 표식 (C-COMBAT-004 ADDED)
//
// 상대의 몸에 **남는** 것. INTENT-A-MARK-RESTS-ON-THE-OTHER-001 ·
// INTENT-THE-MARK-CLOSES-BY-ITSELF-001 · INTENT-MARKS-DO-NOT-PILE-UP-001
//
// 이 파일의 성질 넷이 이 Cycle 의 핵심이다.
//   1. 표식은 **걸린 쪽이 지닌다.** 지목(C017)은 관찰자 장부에 살고 태도(C018)는
//      지금의 사실에서 유도되는데, 표식은 그 둘과 다른 셋째 자리다 — 남긴 자가 무엇을
//      하든, 어디를 보든, 그 몸에 그대로 있다. 그것이 지목과 표식을 가르는 성질이다.
//   2. 표식은 깃발이 아니라 **시각**이다. 담기는 것은 "붙어 있다" 가 아니라 "언제
//      남겼는가" 하나이며, 지금 붙어 있는가는 그 시각에서 매번 다시 세어진다.
//      그래서 **세우는 규칙만 있고 지우는 규칙이 없다** —
//      `combat.ts` 의 `isGuardBroken`(C011)이 선 자리, 같은 꼴이다
//      (DC-CONDITION-OPENS-WITHOUT-RECORDING · Q61(a)).
//   3. 표식은 **그 자체로 아무 일도 하지 않는다.** 생명도 움직임도 겨루는 값도
//      건드리지 않는다. 이 파일을 읽는 것은 사정 목록(circumstance.ts) 둘뿐이며,
//      다음에 올 것의 자리를 만드는 것이 표식이 하는 전부다.
//   4. **쌍마다 하나다.** 같은 자가 같은 대상에게 남긴 표식은 언제나 하나이고, 다른
//      자가 남긴 것은 다른 자리다. 그래서 한 몸이 여럿에게 표식을 지닐 수 있고 한 자가
//      여럿에게 남길 수 있으되, 겹쳐 커지는 일은 없다.
//
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 로 열지 않는다).

/**
 * Actor.Marks — 이 몸에 남은 표식들. **남긴 자의 Id → 남긴 시각.**
 *
 * 자리는 늘기만 하고 줄지 않는다. 그러나 **몸의 수만큼만 는다** — 세계에서 존재가
 * 사라지는 경로가 아직 0건이므로(C017 08 주①) 실제로 자라지 않는다. 존재를 없애는
 * 개념이 오는 Cycle 이 이 자리를 함께 본다.
 */
export type Marks = Record<string, number>;

/**
 * 표식이 붙어 있는 동안 (초).
 *
 * 표식을 걸고(0.6) 발현 일격을 쓰는 데(0.9) 1.5 초가 든다. 6.0 은 그 넷 배쯤이며,
 * 한 번 자리를 잡으면 다가가거나 기력을 모을 틈이 남는다. 영구가 아니므로 걸린
 * 쪽에게는 물러날 값이, 건 쪽에게는 쓸 시한이 생긴다
 * (03-world-semantic.md BALANCE ②).
 */
export const MARK_DURATION = 6.0;

/** 표식 하나 — 관찰에 실릴 모양 (파생: 지금 붙어 있는 것만 나간다) */
export interface BorneMark {
  /** 누가 남겼는가 */
  byId: string;
  /** 언제 남겼는가 (세계 시각). **언제까지인지는 싣지 않는다** — 그것은 규칙이다 */
  since: number;
}

/**
 * RULE-MARK-BORNE-001 — Implements INTENT-THE-MARK-CLOSES-BY-ITSELF-001
 * Input          몸, 남긴 자의 Id, 지금 시각
 * Preconditions  없음
 * Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
 * Result         Borne | NotBorne
 *
 * `isGuardBroken` 과 같은 모양이다. **이 판정이 있는 한 표식을 지우는 규칙이
 * 필요하지 않다** — 시간이 지나면 같은 자리에서 거짓이 된다.
 */
export function isMarkedBy(marks: Marks, byId: string, worldTime: number): boolean {
  const left = marks[byId];
  return left !== undefined && worldTime < left + MARK_DURATION;
}

/** 지금 이 몸에 붙어 있는 표식들 (파생 — 닫힌 것은 나가지 않는다). 남긴 자 Id 차례로 */
export function borneMarks(marks: Marks, worldTime: number): BorneMark[] {
  return Object.keys(marks)
    .filter((byId) => isMarkedBy(marks, byId, worldTime))
    .sort()
    .map((byId) => ({ byId, since: marks[byId]! }));
}
