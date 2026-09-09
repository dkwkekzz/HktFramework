// RULE-POPULATION-LINK-001 — Implements C025 spec R1 (ADDED · 세계 과정)
// Scope          세계의 모든 관계 (방이 `ecology.links` 로 밝힌 것 전부)
// Trigger        철이 바뀌는 그 자리 — 내림 다음이다 (RULE-POPULATION-DECLINE-001 이 부른다)
// Condition      ① 그 관계가 실제로 서는가 (양 끝이 세계에 있고 · 방을 넘으면 이음이 잇는가)
//                ② 그 철의 값들로 잰 from 이 갈래의 문턱을 넘는가 —
//                   CALLS  from ≥ ⌈상한 / 2⌉ · EATS  from ≥ 1 · LEAVES  from ≥ 1
// Transition     판정을 다 마친 뒤 **한꺼번에** —
//                   CALLS  to 의 값 += 1 · EATS  to 의 값 -= 1 (합친 뒤 0..상한으로 자른다)
//                   LEAVES to 인 원천을 세운다 (standSourceState — 이미 서 있으면 그대로)
// Result         (없음 — 값이 옮겨 갈 뿐이다. 무엇이 달라졌는지는 선 자락의 넓이와
//                 거기 무엇이 있고 없는가가 말한다 · spec Observable)
//
// **숲이 스스로 돈다.** 값이 오르내리는 원인이 지금까지 둘이었다면(태어남이 올리고 조건
// 결핍이 내린다) 여기서 셋째가 선다 — **다른 값**이다. 그래서 관찰자가 아무 데도 없어도
// 광식충이 새를 부르고 새가 포식수를 부르고 포식수가 새를 줄이며 사체를 남긴다 (Play §5.6).
//
// **함께 읽고 함께 적용한다** (spec SPEC-004 · 이 Cycle 의 핵심) — 그 철의 값들을 **먼저
// 전부 읽어** 관계를 다 판정한 뒤에야 값을 건드린다. 차례대로 적용하면 앞의 관계가 올린 값을
// 뒤의 관계가 그 철에 곧바로 쓰게 되어 한 철에 사슬이 통째로 돌아 버리고, 데이터의 차례가
// 세계의 답을 바꾼다. 함께 적용하므로 한 철에 사슬이 **한 마디**만 나아가고, 데이터의 차례를
// 뒤집어도 그 철의 답이 글자까지 같다 (경계 ②).
//
// **더한 뒤에 자른다** (SPEC-001 ② · SPEC-002 ②) — 한 철에 같은 개체군이 부름과 먹힘을 함께
// 받을 수 있고(새가 그렇다), 그때 하나씩 자르면 어느 것을 먼저 적용했는가가 답을 바꾼다.
// 모아 더한 뒤 0 과 상한 사이로 한 번 자르면 차례가 뜻을 가지지 않는다.
//
// **관찰자와 무관하다** (spec R1 경계) — 그 방에 몸이 없어도, 세계 어디에도 관찰자가 없어도
// 돈다. 뒤척임 · 되돌아옴 · 내림이 세운 그 선례 그대로 세계 과정이다.
//
// **끊긴 참조는 아무 일도 하지 않는다** (R1 경계) — 세계가 모르는 개체군 · 원천 · 이음을
// 가리킨 관계도, 밝힌 이음이 그 두 방을 실제로 잇지 않는 관계도 조용히 지나간다. 그 판정은
// 여기서 하지 않는다: 세계 사실을 묻는 한 자리(semantic/life.ts 의 populationLinkStands)를
// 그대로 부른다 — 검사 ㉜ 이 그 끊김을 따로 잡는다.
//
// **규칙은 어떤 생명도 어떤 원천도 이름으로 알지 못한다** (Life F13 · R13) — 여기가 아는
// 것은 "관계의 갈래" 셋과 아래 머리 상수뿐이고, 누가 누구를 부르고 먹는지 · 어느 방에
// 사는지 · 무엇을 남기는지는 전부 데이터(content/regions)에 있다.

import {
  findPopulation,
  populationLinkStands,
  populationLinks,
  populationValueOf,
} from '../semantic/life';
import { standSourceState } from '../semantic/region-state';
import { findResourceSource } from '../semantic/resource';
import type { WorldState } from '../semantic/world-state';

// ── 문턱 (spec 데이터 값 표 · 확정 9) ──────────────────────────────────
//
// **갈래가 곧 문턱이다** — 어느 개체군이 어느 문턱을 가지는지는 데이터에 없다. 부르는 것은
// 제 상한의 절반이 차야 하고(무리가 되어야 눈에 띈다), 먹고 남기는 것은 하나만 있어도 된다
// (한 마리가 사냥한다). 그래서 눈금이 개체군마다 갈리지 않고 여기 셋으로 고정된다.

/** 부름의 문턱 — from 이 **제 상한의 이 몫 이상**이면 부른다 (절반 = 상한 / 2) */
const CALLS_SHARE_OF_SCALE = 2;
/** 먹음의 문턱 — from 이 이 값 이상이면 먹는다 */
const EATS_AT_LEAST = 1;
/** 남김의 문턱 — from 이 이 값 이상이면 남긴다 */
const LEAVES_AT_LEAST = 1;
/** 한 철에 값이 움직이는 눈금 — 한 마디씩이다 (사슬이 한 철에 통째로 돌지 않는다) */
const LINK_STEP = 1;

/**
 * 철 하나가 지나갔다 — 관계가 값을 올리고 내리고 원천을 세운다 (spec R1 · SPEC-004).
 *
 * 부르는 쪽은 철의 수를 세는 그 한 자리다 (simulation/population-decline.ts) — 철을 세는
 * 자리가 둘이 되면 적용한 수가 두 벌이 되어 하나가 늦는 날이 온다. 그 자리에서
 * **내림 다음**에 불린다 (SPEC-007 ①).
 */
export function applyPopulationLinks(state: WorldState): void {
  const links = populationLinks();
  if (links.length === 0) return;

  // ① **함께 읽는다** — 이 고리 안에서는 값을 한 글자도 건드리지 않는다. 여기서 읽는 값이
  // 곧 "그 철이 시작할 때의 값" 이고, 관계 전부가 같은 그것을 본다 (SPEC-004 ①).
  const deltas = new Map<string, number>();
  const stands: string[] = [];
  for (const link of links) {
    if (!populationLinkStands(link)) continue;
    const from = findPopulation(link.from);
    if (!from) continue;
    const value = populationValueOf(state.regionStates, link.from);
    if (link.kind === 'CALLS') {
      // 상한의 **절반 이상** — 홀수 상한에서는 올려 잡는다 (절반보다 적으면 부르지 않는다)
      if (value < Math.ceil(from.scale / CALLS_SHARE_OF_SCALE)) continue;
      deltas.set(link.to, (deltas.get(link.to) ?? 0) + LINK_STEP);
    } else if (link.kind === 'EATS') {
      if (value < EATS_AT_LEAST) continue;
      deltas.set(link.to, (deltas.get(link.to) ?? 0) - LINK_STEP);
    } else {
      if (value < LEAVES_AT_LEAST) continue;
      stands.push(link.to);
    }
  }

  // ② **함께 적용한다.** 값이 먼저이고 원천이 다음이다 — 둘은 서로를 읽지 않으므로 차례가
  // 답을 바꾸지 않는다. 차례는 데이터의 차례다 (Map 은 넣은 차례를 지킨다 · 결정론).
  for (const [populationId, delta] of deltas) {
    const population = findPopulation(populationId);
    if (!population) continue;
    const populationState = state.regionStates[population.regionId]?.populations?.[populationId];
    if (!populationState) continue;
    // **더한 뒤에 한 번 자른다** — 상한을 넘지 않고 0 아래로 내려가지 않는다.
    populationState.value = Math.min(
      population.scale,
      Math.max(0, populationState.value + delta),
    );
  }

  // 남긴 것이 **선다** — 거기 없던 것이 서고, 이미 서 있으면 아무 일도 일어나지 않는다
  // (SPEC-003 ① ②). 세우는 전이를 내는 자리는 하나다 (semantic/region-state.ts 의
  // standSourceState) — 시간이 세운 것 · 탄생이 세운 것 · 사냥이 세운 것의 State 가 글자
  // 하나 다르지 않아야 하기 때문이다 (C023 이 세운 그 규율 그대로).
  for (const sourceId of stands) {
    const source = findResourceSource(sourceId);
    if (!source) continue;
    const sourceState = state.regionStates[source.regionId]?.sources?.[sourceId];
    if (!sourceState || sourceState.phase === 'available') continue;
    standSourceState(sourceState);
  }
}
