// RULE-POPULATION-DECLINE-001 — Implements C024 spec R3 (ADDED · 세계 과정)
//                                · C025 spec R2 (CHANGED — 철의 자리에 관계와 방향이 얹힌다)
// Scope          모든 방의, **요구(declineWhen)를 밝힌** 개체군 전부 (내림) ·
//                모든 개체군 (방향) — 관계의 Scope 는 그 규칙이 안다
// Trigger        세계의 Tick
// Condition      ① 매 Tick — 그 요구가 지금 다 차 있는가
//                ② 시각이 낸 철의 수(seasonsStartedAt)가 적용한 수(World.seasonsApplied)보다 많은가
// Transition     ① 다 차 있으면 metThisSeason = true
//                ② 지난 철마다 **차례대로** —
//                   ㄱ 그 철의 **처음** 값들을 뜬다 (방향이 견줄 자리다)
//                   ㄴ **내림이 먼저다**: metThisSeason 이 거짓인 개체군은 값 -= 1 (0 미만 없음) ·
//                      그리고 metThisSeason 을 거짓으로 되돌린다
//                   ㄷ **관계가 다음이다**: RULE-POPULATION-LINK-001 을 그 자리에서 부른다
//                   ㄹ 그 철의 처음과 끝을 견주어 `trend` 를 적는다 (오름 · 내림 · 멈춤)
//                   그 뒤 World.seasonsApplied 를 지금까지 바뀐 수로 맞춘다
// Result         (없음 — 세계가 마르고 값이 옮겨 갈 뿐이다. 무엇이 달라졌는지는 선 자락의
//                 넓이와 멎은 원천의 사유가 말한다 · spec Observable)
//
// **철의 자리가 하나인 이유** (C025 CHANGED · spec SPEC-007) — 내림과 관계는 둘 다 "철이
// 바뀌었는가" 를 묻는다. 세는 자리를 둘로 두면 적용한 수(seasonsApplied)가 두 벌이 되어
// 하나가 늦는 날이 오고, 큰 걸음으로 철을 건너뛸 때 둘이 다른 수의 철을 굴린다. 그래서
// 철을 세는 자리는 여기 하나이고, 관계는 그 자리에서 **내림 다음**에 불린다.
//
// **내림이 먼저인 까닭** (spec 기본형 ④) — 내림은 "지난 철이 어땠는가" 의 결산이고 관계는
// "이번 철에 무엇이 오는가" 다. 반대로 두면 그 철에 관계가 올린 값이 같은 철의 내림에
// 곧바로 깎인다. 그래서 관계가 읽는 "그 철이 시작할 때의 값" 은 지난 철의 결산이 끝난 값이다.
//
// **Respawn Timer 가 세계 안의 원인으로 갈아 끼워지는 그 짝의 뒷면이다.** 되돌아옴의 배속이
// 개체군의 값에 매이고(RULE-RECOVERY-SPEED-001), 그 값을 내리는 것이 여기다 — 그래서 관찰자가
// 사슬을 끊으면 한 철 한 철 떼의 자락이 줄고 마침내 허물이 아주 마른다 (Play §5.7).
//
// **관찰자와 무관하다** (spec R3 경계 ③) — 그 방에 몸이 없어도, 세계 어디에도 관찰자가 없어도
// 돈다. 뒤척임(RULE-SEASON-TURN-001)과 되돌아옴(RULE-SOURCE-RECOVERY-001)이 세운 그 선례
// 그대로 세계 과정이다.
//
// **철 단위로 재는 이유** (spec 기본형 ② · SPEC-003 ①) — "이어졌는가" 를 그 철 동안 **한
// 번이라도 찼는가**로 잰다. 매 Tick 의 결핍으로 세면 태어남이 재료를 잠깐 먹어 비는 것까지
// 결핍이 되어 값이 결코 자라지 못한다: 값이 오르는 그 일이 값을 내리는 원인이 된다.
//
// **수로 세는 이유** (spec R3 경계 ⑤ ⑥) — 값이 내리는 것은 시각이 아니라 **사건**이다.
// 지금까지 바뀐 철의 수(시각에서 유도된다 · semantic/clock.ts 의 seasonsStartedAt)와 적용한
// 수(저장된다 · World.seasonsApplied)를 견주므로
//   ① 그 철 안에 Tick 이 몇 번을 지나도 한 번만 내리고,
//   ② 큰 걸음으로 철을 통째로 건너뛰어도 빠뜨리지 않으며 (지난 것은 지난 만큼 일어난다),
//   ③ 껐다 켠 세계가 같은 철을 두 번 세지 않는다 (적용한 수가 스냅샷에 실려 온다).
// 뒤척임의 수 세기와 **한 어법**이다 (C016 이 세운 그것 그대로).
//
// **밝힌 개체군만이다** (spec R3 경계 ④ · SPEC-003 경계 ④) — 요구를 밝히지 않은 개체군은
// 이 규칙이 아예 건드리지 않는다. `phases` 를 밝히지 않은 방이 철을 타지 않는 것과 같은 규율이다.
//
// **규칙은 어떤 생명도 어떤 원천도 이름으로 알지 못한다** (Life F13 · R13 · C004 가 세운 규율).
// 여기가 아는 것은 "요구를 밝힌 개체군" 이라는 형과 시계가 낸 **수** 뿐이고, 무엇이 무엇을
// 요구하는지 · 그 요구가 어떤 글자를 지는지는 전부 데이터(content/regions)에 있다.
//
// 요구는 여기서 다시 판정하지 않는다 — 결속의 요구를 재는 그 한 자리를 그대로 부른다
// (semantic/life.ts 의 populationRequirementsMet). 어휘가 같으므로 판정도 하나여야 한다.

import { populationRequirementsMet, populationsInRegion } from '../semantic/life';
import { seasonsStartedAt } from '../semantic/clock';
import { applyPopulationLinks } from './population-link';
import type { WorldState } from '../semantic/world-state';

export function rulePopulationDecline(state: WorldState): void {
  // 되살린 옛 세계에는 이 값이 아예 없을 수 있다 — 없는 것은 **아직 한 철도 적용하지
  // 않았다**로 읽는다 (없는 것을 지어내지 않는 그 규율). 그러면 지나온 철이 지난 만큼
  // 한 번에 일어나고, 그것은 큰 걸음이 오는 것과 같은 답이다 (경계 ⑤).
  const applied = Number.isFinite(state.seasonsApplied) ? state.seasonsApplied : 0;
  const started = seasonsStartedAt(state.time);

  // 건너뛴 철까지 **지난 만큼** 일어난다 (경계 ⑤). 보통은 한 바퀴다: Tick 하나에 두 철이
  // 지나지 않는다. **첫 철만 metThisSeason 을 쓰고 나머지는 거짓으로 친다** — 아래에서
  // 매번 거짓으로 되돌리므로 두 번째부터는 저절로 그렇게 된다.
  if (started > applied) {
    for (let season = applied; season < started; season++) applyOneSeason(state);
    state.seasonsApplied = started;
  }

  // 그리고 **이 Tick 의 답을 이 철에 적는다** — 철을 넘긴 뒤에 적어야 새 철의 답이 된다
  // (넘기기 전에 적으면 방금 끝난 철의 마지막 Tick 이 새 철의 답으로 옮아간다).
  markMetThisSeason(state);
}

/**
 * 철 하나가 지나갔다 — **내림 · 관계 · 방향**이 이 차례로 일어난다 (C025 CHANGED · spec R2).
 *
 * 차례가 뜻을 가진다 (SPEC-007) — 지난 철의 결산(내림)이 먼저 끝나야 그 값이 곧 "이 철이
 * 시작할 때의 값" 이 되고, 관계는 그것을 함께 읽어 함께 적용한다. 방향은 맨 나중이다:
 * 그 철의 **처음과 끝**을 견주는 답이므로 둘 다 끝나야 잴 수 있다 (경계 ②).
 */
function applyOneSeason(state: WorldState): void {
  // ㄱ 그 철의 **처음** — 모든 개체군의 값을 한 번 뜬다. 요구를 밝히지 않은 개체군도 함께
  // 뜬다: 그 값을 굴리는 것이 관계이므로 방향은 그것들에게도 뜻이 있다 (SPEC-006).
  const opening = openingValues(state);
  // ㄴ 내림이 먼저다
  applyOneSeasonDecline(state);
  // ㄷ 관계가 다음이다 — 그 철의 판정을 함께 읽고 함께 적용한다 (RULE-POPULATION-LINK-001)
  applyPopulationLinks(state);
  // ㄹ 그리고 그 철의 처음과 끝을 견준다
  markTrend(state, opening);
}

/** 그 철이 시작할 때의 값들 — 개체군 id 로 엮는다 (방향이 견줄 자리다 · C025 ADDED) */
function openingValues(state: WorldState): Map<string, number> {
  const values = new Map<string, number>();
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    const populations = regionState.populations;
    if (!populations) continue;
    for (const population of populationsInRegion(regionId)) {
      const populationState = populations[population.id];
      if (populationState) values.set(population.id, populationState.value);
    }
  }
  return values;
}

/**
 * RULE-POPULATION-DECLINE-001 (C025 CHANGED · spec R2) — 그 철의 **방향**을 적는다.
 *
 * 그 철의 처음과 끝을 견줄 뿐이다 — 그 사이에 오르고 내려 제자리로 돌아왔으면 **멈춤**이다
 * (SPEC-006 경계 ③ · 한 철의 결과만 본다). 처음 값을 못 뜬 개체군(그 철에 State 가 생긴
 * 것)은 건드리지 않는다 — 견줄 자리가 없는 것을 멈춤으로 지어내지 않는다.
 *
 * 방 차례 · 그 방 데이터 차례로 돈다 (결정론).
 */
function markTrend(state: WorldState, opening: Map<string, number>): void {
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    const populations = regionState.populations;
    if (!populations) continue;
    for (const population of populationsInRegion(regionId)) {
      const populationState = populations[population.id];
      if (!populationState) continue;
      const before = opening.get(population.id);
      if (before === undefined) continue;
      populationState.trend =
        populationState.value > before
          ? 'rising'
          : populationState.value < before
            ? 'falling'
            : 'steady';
    }
  }
}

/**
 * 못 찬 개체군의 값이 1 준다 (spec R3 · SPEC-003 ② ③).
 *
 * 값은 0 아래로 내려가지 않는다. **0 은 종점이 아니다** — 값이 0 이 되면 결속의 요구
 * ("이 개체군이 0 이하")가 다시 차므로 알집이 처음처럼 맺힌다 (SPEC-005 · 멸종은 없다).
 * 그 일을 하는 규칙은 여기 없다: C022 가 세운 요구가 그대로 그 일을 한다.
 *
 * 방 차례 · 그 방 데이터 차례로 돈다 — State 의 키 순서에 기대지 않는다 (결정론).
 */
function applyOneSeasonDecline(state: WorldState): void {
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    const populations = regionState.populations;
    if (!populations) continue;
    for (const population of populationsInRegion(regionId)) {
      // 요구를 밝히지 않은 개체군은 건드리지 않는다 — 값도 metThisSeason 도 그대로다.
      if (!population.declineWhen || population.declineWhen.length === 0) continue;
      const populationState = populations[population.id];
      if (!populationState) continue;
      if (!populationState.metThisSeason) {
        populationState.value = Math.max(0, populationState.value - 1);
      }
      // 새 철의 답은 아직 없다 — 그 철에 실제로 차야 참이 된다.
      populationState.metThisSeason = false;
    }
  }
}

/**
 * 이 Tick 에 요구가 다 차 있으면 **이 철은 찼다**고 적는다 (spec R3 · SPEC-003 ①).
 *
 * 한 번 참이 되면 그 철이 끝날 때까지 참이다 — 거짓으로 되돌리는 자리는 철이 바뀌는
 * 위의 한 곳뿐이다. 그래야 "한 번이라도 찼으면 내리지 않는다" 가 참이 된다.
 *
 * 요구를 밝히지 않은 개체군은 여기서도 건드리지 않는다 (경계 ④).
 */
function markMetThisSeason(state: WorldState): void {
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    const populations = regionState.populations;
    if (!populations) continue;
    for (const population of populationsInRegion(regionId)) {
      if (!population.declineWhen || population.declineWhen.length === 0) continue;
      const populationState = populations[population.id];
      if (!populationState || populationState.metThisSeason) continue;
      if (populationRequirementsMet(state.regionStates, population, state.time)) {
        populationState.metThisSeason = true;
      }
    }
  }
}
