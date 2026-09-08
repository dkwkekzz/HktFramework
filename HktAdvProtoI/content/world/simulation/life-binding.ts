// RULE-LIFE-BINDING-001 (C022 ADDED · C023 CHANGED) ·
// RULE-LIFE-BIRTH-001 · RULE-LIFE-SPENT-001 (C023 ADDED — 세계 과정 하나에 규칙 셋)
// Scope          모든 방의, 밝혀진 탄생지 전부
// Trigger        세계의 Tick (dt)
// Condition      phase 가 BORN · SPENT 이면 **요구를 묻지 않는다** (머묾의 규칙이 굴린다) ·
//                아니면 그 탄생지의 요구가 다 차 있는가 (RULE-LIFE-CONDITION-001 이 답한다)
// Transition     BORN   → 다음 Tick 에 SPENT (머묾을 밝히지 않았으면 곧장 DORMANT) · 진행 0
//                SPENT  → 그만큼의 세계 시간이 진행에 실리고, 다 차면 DORMANT · 진행 0
//                요구가 모자라면 → DORMANT · **진행은 그 자리에 멎는다** (지워지지 않는다)
//                요구가 다 차면 → BINDING · progress += dt / 결속의 길이 (1 을 넘지 않는다)
//                진행이 다 차고 값이 상한보다 작으면 → **한 Tick 에 다섯**
//                  ① phase = BORN · 진행 0  ② 밝힌 소비 원천이 고갈된다
//                  ③ 밝힌 leaves 원천이 선다  ④ 개체군의 값 += 1  ⑤ 그 방의 소란이 오른다
// Result         (없음 — 세계가 맺고 터질 뿐이다. 무엇이 달라졌는지는 흔적과 조건 코드가 말한다)
//
// **관찰자와 무관하다** (spec SPEC-001 · SPEC-003) — 그 방에 몸이 없어도, 세계 어디에도
// 관찰자가 없어도 돈다. 되돌아옴(RULE-SOURCE-RECOVERY-001)이 세운 그 선례 그대로 세계 과정이다.
//
// **태어남에는 부분 성공이 없다** (spec R1 경계 ① · SPEC-001 경계 ③) — 값이 상한이면 전이가
// **통째로** 일어나지 않는다: phase 도 원천도 값도 소란도 그대로다. 반만 일어나게 두면
// 세계가 재료만 먹고 아무것도 낳지 않는 자리가 생긴다.
//
// **소비의 전이를 여기서 짓지 않는다** — 원천을 다 캔 것으로 만드는 전이도, 다시 세우는
// 전이도 자리가 하나다 (semantic/region-state.ts 의 depleteSourceState · standSourceState).
// 캔 것과 먹힌 것이 **글자 하나 다르지 않아야** 하기 때문이다: 두 벌로 만들면 관찰자가 보는
// "다 캐 간 자리" 가 두 가지가 된다 (spec SPEC-002 — 같은 State 이고 원인만 다르다).
//
// **규칙은 어떤 탄생지도 어떤 원천도 어떤 생명도 이름으로 알지 못한다** (Life F13 · R13 ·
// C004 가 세운 규율). 여기가 아는 것은 "State 를 가진 탄생지" · "그 요구가 지금 차 있는가" ·
// "그것이 밝힌 목록" 이라는 형뿐이고, 그것이 알집인지 뿌리의 알인지 · 무엇을 먹고 무엇을
// 세우는지 · 얼마나 머무는지는 전부 데이터(content/regions)와 세계 사실(semantic/life.ts)의 것이다.
// **결속과 계승도 갈리지 않는다** — mode 마다 규칙을 따로 두지 않는다 (W40 · spec SPEC-008).
//
// 요구는 여기서 다시 판정하지 않는다 — RULE-LIFE-CONDITION-001(lifeUnmetCodes)이 답하는
// 그것을 그대로 읽는다. 그래서 관찰 결과에 실리는 **모자람의 코드**와 실제로 멎는 것이
// **같은 판정**이다 (C013 이 되돌아옴에 세운 그 규율 — 표시가 아니라 원인이다).
//
// 이 규칙 셋은 **새 layer 도 새 Rule 문법도 만들지 않는다** (F13 · Life §3.1) — 되돌아옴 곁에
// 나란히 서는 세계 과정 하나이고, 부르는 자리도 하나다 (world/index.ts 의 SYSTEMS).

import {
  findPopulation,
  isBindablePhase,
  lifeSitesInRegion,
  lifeUnmetCodes,
  populationValueOf,
  type LifeSite,
} from '../semantic/life';
import {
  addDisturbance,
  depleteSourceState,
  initialSourceState,
  regionStateOf,
  standSourceState,
  type LifeSiteState,
} from '../semantic/region-state';
import { findResourceSource } from '../semantic/resource';
import { PROGRESS_EPSILON, type WorldState } from '../semantic/world-state';

export function ruleLifeBinding(state: WorldState, dt: number): void {
  // 방의 State 를 훑는다 — 탄생지 State 가 없는 방은 맺을 것도 없다 (지금은 거목의 방 하나뿐이다).
  // Object.entries 의 순서는 삽입 순서이고 State 는 REGION_SPECS 순서로 세워졌다 (결정론).
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    if (!regionState.lifeSites) continue;
    // 데이터의 탄생지 순서로 돈다 — State 의 키 순서에 기대지 않는다 (결정론).
    for (const site of lifeSitesInRegion(regionId)) {
      const siteState = regionState.lifeSites[site.id];
      if (!siteState) continue;

      // 터진 자리는 머묾의 규칙이 굴린다 — 요구를 묻지 않는다 (spec R3 CHANGED · R2 경계 ①).
      if (!isBindablePhase(siteState.phase)) {
        ruleLifeSpent(site, siteState, dt);
        continue;
      }

      // 요구가 하나라도 모자라면 **그 Tick 에** 맺힘이 풀린다 (spec SPEC-004 경계 ①).
      // 진행은 지우지 않는다 — 늦어지는 것이지 처음부터 다시가 아니다 (C022 기본형 ③ ·
      // C013 이 매달린 원천에 준 "되돌아옴이 멎었다" 와 같은 어법).
      if (lifeUnmetCodes(state.regionStates, site, state.time).length > 0) {
        siteState.phase = 'DORMANT';
        continue;
      }

      siteState.phase = 'BINDING';
      // 세계 시간으로 오른다. 길이가 0 이하인 탄생지는 오르지 않는다 — 나눌 수 없는 것을
      // 나누어 없는 답을 짓지 않는다 (isFlowActive 가 주기 0 에 하는 그대로).
      if (site.bindingSeconds > 0) {
        siteState.progress = advanced(siteState.progress, dt, site.bindingSeconds);
      }

      // 다 찼으면 **그 Tick 에** 태어난다 (spec SPEC-001 — 한 Tick 도 밀리지 않는다).
      if (siteState.progress >= 1) ruleLifeBirth(state, regionId, site, siteState);
    }
  }
}

/**
 * RULE-LIFE-BIRTH-001 (C023 ADDED · spec R1 · SPEC-001 · SPEC-002 · SPEC-004 ~ SPEC-006) —
 * **태어남은 한 Tick 의 전이다.**
 *
 * 다섯이 **함께** 움직인다: phase · 소비 · 세움 · 값 · 소란. 하나라도 따로 일어나면 세계가
 * 두 말을 한다 — 그래서 값을 올릴 수 없으면(상한) **아무것도 하지 않고 돌아간다** (경계 ①).
 * 값을 올릴 수 있는지를 **맨 먼저** 묻는 이유가 그것이다.
 *
 * 먹는 것도 세우는 것도 **다른 방의 원천일 수 있다** (SPEC-002 경계 ③ — 균사는 둥지의 것이다).
 * 세계가 모르는 원천은 그냥 지나간다 — 끊긴 참조는 아무 일도 하지 않고, 그것을 잡는 것은
 * 검사 ㉗ 이다 (C021 R3 의 어법).
 *
 * 밝히지 않은 것은 일어나지 않는다 — 세우는 것이 없는 탄생지는 아무것도 남기지 않고,
 * 소란을 밝히지 않은 개체군은 방을 술렁이게 하지 않는다.
 */
function ruleLifeBirth(
  state: WorldState,
  regionId: string,
  site: LifeSite,
  siteState: LifeSiteState,
): void {
  // ④ 를 **먼저 묻는다** — 값을 올릴 수 없으면 전이가 통째로 일어나지 않는다 (경계 ①).
  // 세계가 모르는 개체군을 올릴 탄생지도 여기서 멎는다 (없는 값을 지어내지 않는다).
  const population = findPopulation(site.population);
  if (!population) return;
  const value = populationValueOf(state.regionStates, site.population);
  if (value >= population.scale) return;

  // ① 태어났다 — BORN 은 한 Tick 이고 진행은 0 에서 다시 시작한다 (spec 기본형 ⑦).
  siteState.phase = 'BORN';
  siteState.progress = 0;

  // ② 밝힌 것을 먹는다 — 캔 것과 **같은 State** 이고 원인만 다르다 (SPEC-002).
  for (const sourceId of site.consumes) {
    const source = findResourceSource(sourceId);
    if (!source) continue;
    const regionSources = (regionStateOf(state.regionStates, source.regionId).sources ??= {});
    const sourceState = (regionSources[source.id] ??= initialSourceState(source));
    depleteSourceState(source, sourceState);
  }

  // ③ 밝힌 것을 세운다 — 거기 없던 것이 선다 (SPEC-004). 그 원천은 시간이 되돌리지
  // 않으므로(RULE-SOURCE-RECOVERY-001 CHANGED) 이 한 줄이 그것을 세우는 유일한 자리다.
  for (const sourceId of site.leaves) {
    const source = findResourceSource(sourceId);
    if (!source) continue;
    const regionSources = (regionStateOf(state.regionStates, source.regionId).sources ??= {});
    const sourceState = (regionSources[source.id] ??= initialSourceState(source));
    standSourceState(sourceState);
  }

  // ④ 값이 하나 오른다 — 상한을 넘지 않는다 (SPEC-005).
  const populations = (regionStateOf(state.regionStates, population.regionId).populations ??= {});
  // C024 CHANGED — 이 철에 요구가 찼는가도 함께 든다 (없던 자리를 여기서 세울 때의 처음
  // 값이다 · createRegionStates 와 **같은 값**이어야 한다: 세우는 자리가 둘이면 갈린다)
  const populationState = (populations[population.id] ??= { value: 0, metThisSeason: false });
  populationState.value = Math.min(population.scale, populationState.value + 1);

  // ⑤ 그 방이 술렁인다 — 올리는 일은 C017 의 그 한 자리가 한다 (RULE-DISTURBANCE-001).
  // 오르는 것은 **그 일이 일어난 방**이고, 임계에서 멈추는 것도 그 규칙이 안다.
  if (population.birthDisturbance !== undefined) {
    addDisturbance(state.regionStates, regionId, population.birthDisturbance);
  }
}

/**
 * RULE-LIFE-SPENT-001 (C023 ADDED · spec R2 · SPEC-003) —
 * **터진 자리는 머물다 돌아온다.**
 *
 * BORN 은 한 Tick 이다 — 다음 Tick 에 SPENT 가 된다. SPENT 는 그만큼의 세계 시간이 흐른 뒤
 * DORMANT 로 돌아가고 진행이 0 이 된다. 그동안 **요구를 묻지 않으므로** 조건이 다 차 있어도
 * 결속이 오르지 않는다 (경계 ①) — 되돌아온 뒤에 다시 물어진다.
 *
 * 머무는 길이를 밝히지 않은 탄생지는 BORN 다음 Tick 에 **곧장 DORMANT** 다 (경계 ②) —
 * 나눌 수 없는 것을 나누지 않는다 (결속의 길이 0 에 하는 그대로).
 *
 * **아무도 보고 있지 않아도 돈다** — 부르는 쪽이 세계 과정이다.
 */
function ruleLifeSpent(site: LifeSite, siteState: LifeSiteState, dt: number): void {
  if (siteState.phase === 'BORN') {
    siteState.phase = site.spentSeconds > 0 ? 'SPENT' : 'DORMANT';
    siteState.progress = 0;
    return;
  }
  if (siteState.phase !== 'SPENT') return;
  // 밝히지 않은 길이로 SPENT 에 선 자리(손잡이가 세운 것)는 곧장 돌아간다 — 나눌 수 없다.
  if (!(site.spentSeconds > 0)) {
    siteState.phase = 'DORMANT';
    siteState.progress = 0;
    return;
  }
  siteState.progress = advanced(siteState.progress, dt, site.spentSeconds);
  if (siteState.progress >= 1) {
    siteState.phase = 'DORMANT';
    siteState.progress = 0;
  }
}

/**
 * 그만큼의 세계 시간을 진행에 싣는다 — 1 을 넘지 않는다 (결속에도 머묾에도 같은 한 자리).
 *
 * **티끌을 여기서 거둔다** (PROGRESS_EPSILON) — `dt / 길이` 를 더해 가면 부동소수의 티끌이
 * 남아 1 에 닿지 못한다 (1/90 을 아흔 번 더하면 0.999…84). 그대로 두면 데이터가 말한 90 초가
 * 91 초가 되어 세계가 자기 데이터와 다른 말을 한다. 1 에 티끌보다 가까우면 다 찬 것이다.
 */
function advanced(progress: number, dt: number, seconds: number): number {
  const next = progress + dt / seconds;
  return next >= 1 - PROGRESS_EPSILON ? 1 : next;
}
