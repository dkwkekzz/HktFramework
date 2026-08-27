// World Semantic — Growth (C-GROWTH-001 ADDED)
//
// 세계 안에서 한 일이 몸에 남고, 남은 것이 문턱을 넘으면 겨룸에서 읽히는 값이 오른다.
// INTENT-THE-BODY-KEEPS-WHAT-IT-DID-001 · INTENT-THE-WORLD-ADDS-WHAT-WAS-DONE-001 ·
// INTENT-ENOUGH-IS-A-STEP-001 · INTENT-THE-STEP-ENTERS-THE-EFFECTIVE-VALUE-001 ·
// INTENT-WHAT-GROWS-IS-WHAT-THE-CONTEST-READS-001 · INTENT-THE-ZEROTH-STEP-ADDS-NOTHING-001
//
// **새 계산 축이 아니다.** 판정이 읽는 값을 매번 다시 세는 얼개는 C023 이 세웠고
// (semantic/combat.ts effectiveStat · RULE-EFFECTIVE-STATS-001), C-COMBAT-001 이 거기
// 셋째 항(지금의 배분)을 얹었다. 성장은 그 합의 **넷째 항**이다. 이 파일이 그 항의
// 크기를 정하는 값들을 소유한다.
//
// combat.ts 에 두지 않는 이유는 allocation.ts 와 같다 — combat.ts 는 이 파일을 읽고
// 이 파일은 아무것도 읽지 않는다. 성장은 겨룸의 계산이 아니라 **그 계산이 읽을 값을
// 정하는 표**이기 때문이다.
//
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다 (CVar 로 열지 않는다).

/**
 * 쌓임의 원천 — **지금 이 세계에서 실제로 일어나는 일뿐이다**
 * (INTENT-ONLY-REAL-ACTS-COUNT-001).
 *
 * MC-GAIN-LEVEL 의 semantic 은 넷을 든다 — 싸우고 · 탐험하고 · 발견하고 · 사건을
 * 해결한 것. 그중 **탐험과 사건 해결은 세계에 없다**. 땅이 이제 막 법칙을 지녔고
 * (C-TERRAIN-001) 사건이라 부를 것이 아직 없으므로, 없는 원천을 지어내지 않고
 * 결손으로 남긴다 — 08 이 그 이름을 위층에 보고한다.
 */
export type DeedSource = 'strike' | 'down' | 'mine' | 'observe';

/**
 * 어떤 일이 얼마를 쌓는가 (World.DeedCatalog).
 *
 * **같은 일은 언제나 같은 양을 쌓는다** — 피해의 크기도, 캔 것의 종류도, 흔들림도
 * 이 양에 들어가지 않는다 (DC-COMBAT-PLAYER-CAUSALITY).
 *
 * 쓰러뜨림이 한 대의 열네 배인 것은 이 세계에서 **가장 큰 일이 쓰러뜨리는 일**이기
 * 때문이며, 동시에 "때리기만 반복하는 것" 이 가장 느린 길이 되게 한다.
 * 크기의 근거는 03-world-semantic.md 의 BALANCE ②③ 이 소유한다.
 */
export const DEED_AMOUNTS: Readonly<Record<DeedSource, number>> = {
  strike: 1,
  down: 14,
  mine: 4,
  observe: 3,
};

/**
 * 문턱의 표 (World.GrowthThresholds).
 *
 * **판정은 이 표를 조건으로 삼지 않는다.** 규칙이 묻는 것은 "지금 단계가 얼마를
 * 보태는가" 뿐이므로, 문턱을 고치거나 늘리는 일에 규칙도 관찰도 시험도 열리지 않는다
 * (C023 이 적용 자리에 대해, C-COMBAT-001 이 배분 목록에 대해 내린 판단 그대로).
 *
 * 표가 끝나면 더 오르지 않는다 — 최대 5단계다. 상한 없는 축은 잴 수 없고 지금
 * 비교 집합이 이 성장 하나뿐이다 (GBC-GAIN-LEVEL 의 `validation.static: PENDING`).
 *
 * 첫 문턱 20 은 Frontier 의 Playable Result 문장에 맞춘 값이다 — 기본 기술로
 * 자율 존재 하나를 쓰러뜨리면 6 + 14 로 정확히 닿는다 (03 BALANCE ②).
 */
export const GROWTH_THRESHOLDS: readonly number[] = [20, 50, 90, 140, 200];

/** 오를 수 있는 가장 높은 단계 — 표의 칸 수다 */
export const MAX_GROWTH_LEVEL = GROWTH_THRESHOLDS.length;

/**
 * 단계가 보탤 수 있는 값들 (넷).
 *
 * 걸린 것이 보태는 목록(item.ts ContributableStat — 여덟)과도, 배분이 보태는 목록
 * (allocation.ts AllocatableStat — 다섯)과도 다른 목록이다. 셋이 서로 다른 것이
 * 정상이다 — 물건이 통찰을 보태지 않고, 배분이 관통을 움직이지 않으며,
 * **성장은 겨룸에서 읽히는 값에만 닿는다.**
 */
export type GrowableStat = 'physicalAttack' | 'auraAttack' | 'armor' | 'resistance';

/**
 * 한 단계가 어느 값에 얼마를 보태는가 (World.GrowthLevelSteps).
 *
 * **여기 없는 값은 자라지 않는다** — 관통 둘 · 치명 둘 · 통찰은 성질상 자라지 않고
 * (몰아 두는 일과 상관없는 힘이 있는 것과 같은 이유), 생명력 · 기력 · 이동은 아직
 * "유효 값" 이라는 자리를 지니지 않아 걸린 것도 배분도 그것을 건드리지 못한다.
 * 성장만 그 셋을 건드리면 세계에 **세 번째 종류의 값 변경 경로**가 생긴다 —
 * 그 문을 여는 것은 이 Cycle 이 아니다 (02 의 물음이 그렇게 닫혔다).
 *
 * 버티는 쪽이 더 얕은 것(+3)은 방어가 감쇄식을 지나 체감이 크기 때문이다.
 * 크기의 근거는 03-world-semantic.md 의 BALANCE ① 이 소유한다.
 */
export const GROWTH_LEVEL_STEPS: Readonly<Record<GrowableStat, number>> = {
  physicalAttack: 4,
  auraAttack: 4,
  armor: 3,
  resistance: 3,
};

/** 표의 차례 — 관찰이 이 차례로 실린다. 같은 세계 상태면 같은 순서다 */
export const GROWABLE_STATS = Object.keys(GROWTH_LEVEL_STEPS) as readonly GrowableStat[];

/**
 * RULE-GROWTH-LEVEL-001 — Implements INTENT-ENOUGH-IS-A-STEP-001
 *
 * Input          Deeds
 * Preconditions  없음 — 어떤 값에도 답이 있다
 * Transition     없음 (읽기 판정)
 * Result         GROWTH_THRESHOLDS 중 Deeds 가 넘어선 것의 개수
 *
 * **저장하지 않는다.** 저장하면 Deeds 와 Level 이라는 두 개의 진실이 생기고 그것을
 * 맞추는 책임이 Deeds 를 바꾸는 모든 자리로 흩어진다 — C022 가 UsedSlots 에,
 * C023 이 유효 값에 대해 내린 것과 같은 판정이다.
 *
 * **넘어선 문턱의 개수**를 세므로 한 번의 늘어남이 문턱 둘을 넘으면 단계도 둘 오른다.
 * 세계가 한 번에 하나씩만 오르도록 붙잡아 두지 않는다.
 */
export function growthLevel(deeds: number): number {
  let level = 0;
  for (const threshold of GROWTH_THRESHOLDS) {
    if (deeds >= threshold) level += 1;
    else break;
  }
  return level;
}

/**
 * 아직 넘지 않은 첫 문턱 — 최대 단계면 없다 (파생, 저장하지 않는다).
 *
 * 없다는 것이 곧 "더 오를 곳이 없다" 이다.
 */
export function nextGrowthThreshold(deeds: number): number | null {
  const level = growthLevel(deeds);
  return level < GROWTH_THRESHOLDS.length ? (GROWTH_THRESHOLDS[level] as number) : null;
}

/**
 * 다음 문턱까지 남은 양 — 최대 단계면 없다 (파생, 저장하지 않는다).
 *
 * **세계가 빼서 싣는다.** 화면이 두 값을 받아 빼지 않는다
 * (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export function deedsToNextThreshold(deeds: number): number | null {
  const threshold = nextGrowthThreshold(deeds);
  return threshold === null ? null : threshold - deeds;
}

/**
 * 지금 단계가 이 값에 보태는 몫 (파생 — 저장하지 않는다).
 *
 *     기여 = 단계 × 그 값의 한 단계 몫
 *
 * 자라지 않는 값이면 0 이다. 그리고 **단계 0 에서는 모든 값이 0 이다** —
 * 0 × step 이므로 INTENT-THE-ZEROTH-STEP-ADDS-NOTHING-001 이 검사가 아니라 산술로
 * 성립한다. 이것이 회귀의 근거다.
 *
 * 배분과 달리 **음수가 나오지 않는다** — 자라는 것은 얻는 일이지 나누는 일이 아니다.
 */
export function growthContribution(deeds: number, stat: string): number {
  const step = GROWTH_LEVEL_STEPS[stat as GrowableStat];
  if (step === undefined) return 0;
  return growthLevel(deeds) * step;
}

/**
 * World.GrowthEvents 의 한 항목 — 방금 무엇을 해서 얼마가 쌓였고 단계가 올랐는가.
 *
 * World.StrikeEvents · UnharmedContacts · CancelEvents 와 **나란한 자리**이며 같은
 * 수명을 가진다 (STRIKE_EVENT_TTL · RULE-STRIKE-EVENT-EXPIRE-001). 넷이 답하는
 * 질문이 다르다.
 *
 *     StrikeEvent      닿았고 해가 성립했다
 *     UnharmedContact  닿았으나 관계가 막았다
 *     CancelEvent      맞은 쪽이 하려던 것이 사라졌다
 *     GrowthEvent      한 일이 몸에 남았다
 *
 * **오르지 않은 쌓임도 실린다** (levelBefore === levelAfter). 터지지 않은 치명이
 * 실리는 이유와 같다 (C015) — 오르지 않았다는 사실도 관찰이어야 다음 문턱까지의
 * 거리가 읽힌다.
 */
export interface GrowthEvent {
  actorId: string;
  source: DeedSource;
  amount: number;
  deedsAfter: number;
  levelBefore: number;
  levelAfter: number;
  time: number;
}
