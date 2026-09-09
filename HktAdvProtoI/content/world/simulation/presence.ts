// RULE-PRESENCE-SCHEDULE-001 — Implements C018 spec R1 (ADDED · 세계 과정)
// Scope          밝힌 경로 전부
// Trigger        세계의 Tick
// Condition      그 경로가 지나고 있지 않고 · 지금 철·낮밤이 그 경로의 시간표에 들고 ·
//                이번 바퀴가 그 경로의 바퀴 조건에 맞고 · 이번 바퀴에 아직 시작하지 않았다
// Transition     presences[route].startedAt = 지금 · .startedCycle = 이번 바퀴 ·
//                .route = 마디마다 고른 방들 (RULE-PRESENCE-BEND-001 이 정한다)
// Result         (없음 — 세계에 무엇이 지나가기 시작할 뿐이다. 그것은 관찰 결과가 말한다)
//
// RULE-PRESENCE-PASS-001 — Implements C018 spec R2 (ADDED · 세계 과정)
//                          · C034 spec R5 (CHANGED — 방에 **드는 전이**를 그 방이 센다:
//                            이번 Tick 이 덮는 구간에 든 마디마다 그 방의 passages 가 오른다)
// Scope          지나고 있는 경로 전부
// Trigger        세계의 Tick (dt)
// Condition      지난 시간이 마디 수 × PRESENCE_SECONDS_PER_NODE 에 닿았다
// Transition     .passes += 1 · .startedAt 과 .route 를 지운다 ·
//                남기는 원천이 **실제로 지난 방**에 있으면 그 원천이 선다
//                (phase = available · taken 0 · progress 0 · siteIndex = 마친 수가 정한 마디)
// Result         (없음 — 지나간 자리에 무엇이 서 있을 뿐이다)
//
// RULE-PRESENCE-DISTURBANCE-001 — Implements C018 spec R5 (ADDED · 세계 과정)
// Scope          지나는 동안 소란을 밝힌 경로
// Trigger        세계의 Tick (dt)
// Transition     지금 지나는 방의 소란 += 밝힌 초당 값 × dt (C017 의 올리는 그 한 자리로)
// Result         (없음 — 값이 오를 뿐이다. 깨어남은 C017 의 판정 자리가 정한다)
//
// **관찰자와 무관하다** (spec SPEC-001 경계 ④) — 그 방에 몸이 없어도, 세계 어디에도 관찰자가
// 없어도 지나간다. 되돌아옴(C013) · 뒤척임(C016) · 가라앉음(C017)이 세운 선례 그대로다.
//
// **규칙은 어떤 경로도 어떤 방도 어떤 원천도 이름으로 알지 못한다** (T1 · T4 · spec R1 경계 ③).
// 여기가 아는 것은 "시간표를 밝힌 경로" 라는 형과 시계가 낸 때와 소란이라는 값 하나뿐이고,
// 어느 철에 무엇이 어디를 지나 무엇을 남기는지는 데이터(content/regions)에만 있다.
// 경로 데이터를 지우면 이 세계 과정은 아무 일도 하지 않는다 (spec SPEC-007 경계 ①).
//
// **한 바퀴에 두 번 시작하지 않는다** (SPEC-001 경계 ①) — 시작한 바퀴를 적어 두고 그 바퀴에는
// 다시 시작하지 않기 때문이다. 뒤척임이 "적용한 수" 로 두 번 세지 않는 것과 같은 어법이고
// (C016 기본형 ⑤), 부르기(RULE-PRESENCE-SUMMON-001)도 같은 자리에 적어 그 한 번으로 센다.
//
// **큰 걸음으로 통째로 지나가도 남긴다** (spec R2 경계 ①) — 끝났는지는 "지난 시간이 닿았는가"
// 로 재므로 Tick 이 마디 몇 개를 한꺼번에 건너뛰어도 마침이 빠지지 않는다.

import { addDisturbance, remember } from '../semantic/region-state';
import {
  PRESENCE_ROUTES,
  type PresenceRoute,
} from '../../regions';
import {
  bendRoute,
  isScheduledAt,
  leftBehindSiteIndex,
  passingNodeIndex,
  passingRegionOf,
  presenceCycleAt,
  type PresencePassState,
} from '../semantic/presence';
import { findResourceSource } from '../semantic/resource';
import { PRESENCE_SECONDS_PER_NODE, type WorldState } from '../semantic/world-state';

/**
 * 세계 과정 하나 — 시간표로 시작하고(R1) · 지나는 동안 하고(R5) · 끝나면 남긴다(R2).
 *
 * 셋을 한 자리에 두는 이유는 **한 Tick 안의 차례**다: 이번 Tick 에 시작한 것은 이번 Tick 부터
 * 소란을 올리고, 이번 Tick 에 끝난 것은 더 올리지 않는다. 세 자리로 흩으면 그 차례가
 * 시스템 배열의 순서에 매달려 읽히지 않는다.
 *
 * 경로 순서는 데이터 순서 그대로다 (결정론).
 */
export function rulePresence(state: WorldState, dt: number): void {
  for (const route of PRESENCE_ROUTES) {
    const pass = (state.presences[route.id] ??= { passes: 0 });
    ruleStartBySchedule(state, route, pass);
    ruleDisturbWhilePassing(state, route, pass, dt);
    // 드는 것을 세는 자리는 **시작과 마침 사이**다 (C034 ADDED) — 시작 뒤라야 이번 Tick 에
    // 시작한 지나감의 첫 마디가 서고, 마침 앞이라야 마치는 Tick 의 마지막 마디가 빠지지
    // 않는다 (마치는 순간 startedAt 과 route 가 지워진다).
    ruleRememberPassing(state, route, pass, dt);
    ruleFinishAndLeave(state, route, pass);
  }
}

/**
 * RULE-PRESENCE-SCHEDULE-001 (C018 ADDED · spec R1) — **시간표가 오면 지나간다**.
 *
 * 이미 지나고 있으면 아무것도 하지 않고, 이번 바퀴에 이미 시작했으면 그 철이 이어지는
 * 동안에도 다시 시작하지 않는다 (경계 ①). 철·낮밤·바퀴가 맞는지는 데이터와 시계를 맞춰
 * 보는 한 함수가 답한다 (semantic/presence.ts 의 isScheduledAt).
 */
function ruleStartBySchedule(
  state: WorldState,
  route: PresenceRoute,
  pass: PresencePassState,
): void {
  if (pass.startedAt !== undefined) return;
  const cycle = presenceCycleAt(state.time);
  if (pass.startedCycle === cycle) return;
  if (!isScheduledAt(route, state.time)) return;
  beginPass(state, route, pass, cycle);
}

/**
 * RULE-PRESENCE-SCHEDULE-001 · RULE-PRESENCE-BEND-001 (C018 ADDED · spec R1 · R3) —
 * **지나가기 시작한다**. 시간표가 부르든 사람이 부르든 여기 한 자리로 온다 (rules/summon-presence.ts).
 *
 * 어디로 휠지는 **여기서 한 번** 정해진다 (R3 경계 ① · 기본형 ⑦) — 지나는 도중에 소란이
 * 뒤집혀도 그 지나감은 바뀌지 않는다. 마디가 하나도 없는 경로는 시작하지 않는다:
 * 지날 곳이 없는 것을 지나간다고 하지 않는다.
 */
export function beginPass(
  state: WorldState,
  route: PresenceRoute,
  pass: PresencePassState,
  cycle: number,
): void {
  const chosen = bendRoute(route, state.regionStates);
  if (chosen.length === 0) return;
  pass.startedAt = state.time;
  pass.startedCycle = cycle;
  pass.route = chosen;
}

/**
 * RULE-PRESENCE-DISTURBANCE-001 (C018 ADDED · spec R5) — **지나는 것이 소란을 올린다**.
 *
 * 밝히지 않은 경로는 한 값도 올리지 않는다 (T3 · SPEC-004 경계 ③). 올리는 일은 C017 의
 * 그 한 자리(addDisturbance)가 하므로 임계에서 멈추는 것도 위상 판정도 그대로다 —
 * 원인이 하나 는 것뿐이다 (spec R5 경계).
 */
function ruleDisturbWhilePassing(
  state: WorldState,
  route: PresenceRoute,
  pass: PresencePassState,
  dt: number,
): void {
  const perSecond = route.effectWhilePassing?.disturbancePerSecond;
  if (!perSecond) return;
  const here = passingRegionOf(pass, state.time);
  if (here === undefined) return;
  addDisturbance(state.regionStates, here, perSecond * dt);
}

/**
 * RULE-PRESENCE-PASS-001 (C034 CHANGED · spec R5) · RULE-REGION-MEMORY-001 —
 * **지나가면 그 방이 센다**.
 *
 * 세는 것은 **방에 드는 전이**다 (spec R5 경계 ① ②) — 한 지나감이 지나는 방마다 한 번씩이고,
 * 한 방에 머무는 동안 두 번 세지 않는다.
 *
 * **새 State 를 만들지 않고 시각으로 유도한다.** 세계는 "몇 번째 마디인가" 를 저장하지 않고
 * (semantic/presence.ts 가 시작 시각 하나에서 그것을 낸다), 저장하기 시작하면 같은 사실이
 * 두 벌이 되어 되살린 세계에서 갈릴 수 있다. 마디 k 에 드는 시각은 언제나
 * `startedAt + k × PRESENCE_SECONDS_PER_NODE` 이므로, **이번 Tick 이 덮는 구간**에 든 k 를
 * 세면 된다.
 *
 * 구간은 `(state.time − dt, state.time]` 이다 — 세계 시각은 시스템이 다 돈 **뒤**에 오르므로
 * (RULE-WORLD-TICK-001 의 3번), 이 자리에서 보이는 `state.time` 은 이번 Tick 이 시작한 시각이고
 * 지난 Tick 이 본 것은 그보다 dt 앞이다. 왼쪽을 열어 두는 것이 "두 번 세지 않는다" 이고
 * (한 Tick 의 오른쪽 끝은 다음 Tick 의 왼쪽 끝이다), 구간이 마디 여럿을 덮을 수 있게 둔 것이
 * "큰 걸음이 건너뛰어도 빠뜨리지 않는다" 다 (경계 ③ 의 어법 그대로 · SPEC-004 경계 ②).
 *
 * 불러서 일으킨 지나감도 여기로 온다 (경계 ③) — 부르기는 시작 시각을 세울 뿐이고
 * (rules/summon-presence.ts 의 beginPass), 세는 것은 언제나 이 한 자리다. 손잡이가 규칙을
 * 우회하지 않는다.
 */
function ruleRememberPassing(
  state: WorldState,
  route: PresenceRoute,
  pass: PresencePassState,
  dt: number,
): void {
  const chosen = pass.route;
  const startedAt = pass.startedAt;
  if (startedAt === undefined || !chosen) return;

  // 지난 Tick 이 본 시각까지는 이미 세어졌다 — 그 뒤부터 지금까지 든 마디들이 이번 몫이다.
  const seen = (state.time - dt - startedAt) / PRESENCE_SECONDS_PER_NODE;
  const now = (state.time - startedAt) / PRESENCE_SECONDS_PER_NODE;
  const first = Math.max(0, Math.floor(seen) + 1);
  // 마디 수를 넘는 것은 이 지나감의 것이 아니다 — 그 뒤는 마침의 일이다.
  const last = Math.min(chosen.length - 1, Math.floor(now));

  for (let node = first; node <= last; node++) {
    const regionId = chosen[node];
    if (regionId === undefined) continue;
    // 세는 일은 그 한 자리가 한다 — **무엇이 지났는지도 넘기지 않는다**: 방이 기억하는
    // 열쇠는 경로 id 이고, 그것이 무엇인지는 데이터가 안다 (규칙은 이름을 모른다 · R13).
    remember(state.regionStates, regionId, state.time, { kind: 'passage', routeId: route.id });
  }
}

/**
 * RULE-PRESENCE-PASS-001 (C018 ADDED · spec R2) — **끝나면 남긴다**.
 *
 * 지난 시간이 마디 수 × 마디당 시간에 닿으면 그 지나감이 끝난다. 마친 수를 먼저 올리고,
 * 그 수로 남긴 것이 설 마디를 정한다 (SPEC-006 경계 ④ — 몇 번째 지나감인지가 마디를 정한다).
 *
 * 남기는 것은 **실제로 지난 방**에 있는 원천뿐이다 (경계 ③) — 휘어 다른 방으로 갔으면 그
 * 방에 없는 원천은 서지 않는다. 그리고 같은 지나감이 두 번 남기지 않는다 (경계 ②):
 * 끝나는 순간 startedAt 을 지우므로 다음 Tick 에는 여기 오지 않는다.
 */
function ruleFinishAndLeave(
  state: WorldState,
  route: PresenceRoute,
  pass: PresencePassState,
): void {
  const chosen = pass.route;
  if (pass.startedAt === undefined || !chosen) return;
  // 아직 마디가 남았으면 지나는 중이다 — 판정하는 식은 관찰과 같은 하나다 (passingNodeIndex).
  if (passingNodeIndex(pass, state.time) !== null) return;

  const visited = new Set(chosen);
  delete pass.startedAt;
  delete pass.route;
  pass.passes += 1;

  for (const sourceId of route.leavesBehind ?? []) {
    const source = findResourceSource(sourceId);
    // 세계가 모르는 원천 · 지나지 않은 방의 원천은 조용히 지나간다 — 없는 것을 세우지 않는다.
    if (!source || !visited.has(source.regionId)) continue;
    const regionState = state.regionStates[source.regionId];
    const sourceState = regionState?.sources?.[source.id];
    if (!sourceState) continue;
    // 규칙이 스스로 도달할 수 있는 State 만 세운다 — 되돌아옴이 다 온 것과 한 값도 다르지
    // 않다 (RULE-SOURCE-RECOVERY-001 의 마지막 문턱과 같은 셋). 다른 것은 **자리**뿐이다.
    sourceState.phase = 'available';
    sourceState.taken = 0;
    sourceState.progress = 0;
    sourceState.siteIndex = leftBehindSiteIndex(route.id, pass.passes, source.sites.length);
  }
}

/**
 * 세계가 설 때 지나감을 **밝힌 대로 시작시킨다** — 검증·촬영용 초기 배치 (C018 ADDED).
 *
 * disturbances · clock · sourcePhases 와 **같은 갈래**의 손잡이다: 기다려서 닿을 수 있는
 * 때를 기다리지 않고 시작하기 위한 것이며 **세계의 규칙을 하나도 바꾸지 않는다.** 시작하는
 * 일은 위 beginPass 한 자리가 하고, 그 뒤로는 세계 자신의 규칙이 마디를 옮기고 끝을 낸다.
 *
 * 왜 필요한가 — 낮에 철 바퀴 셋에 한 번 오는 것은 한 바퀴가 2220 세계 초(37 분)라 촬영
 * 하네스가 기다릴 수 없다. 시간표가 그것을 부른다는 것은 시나리오 테스트가 증명하고,
 * 그림은 **그때 무엇이 보이는가**를 보인다 (regionPatterns 와 같은 논리).
 *
 * 부른 것도 그 바퀴의 한 번으로 센다 — 그래서 이 뒤에 시간표가 또 시작하지 않는다.
 * 모르는 경로 이름은 조용히 무시한다 (손잡이가 세계에 없는 것을 지어내지 않는다).
 */
export function applyPresenceSetup(state: WorldState, routeIds: readonly string[] | undefined): void {
  if (!routeIds) return;
  for (const routeId of routeIds) {
    const route = PRESENCE_ROUTES.find((entry) => entry.id === routeId);
    if (!route) continue;
    const pass = (state.presences[route.id] ??= { passes: 0 });
    beginPass(state, route, pass, presenceCycleAt(state.time));
  }
}
