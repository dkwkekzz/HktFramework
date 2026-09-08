// World Semantic — Presence (C018 ADDED)
//
// 세계를 **지나가는 것**이 선다. 몸도 생명도 아닌 **현상**이다 (L2-World-Time 원칙 T7) —
// 지나는 동안 그 방에 무엇을 하고 지나간 뒤에 무엇을 남길 뿐, 싸울 것이 아니라 때를 맞출 것이다.
//
// **저장되는 것은 넷뿐이다** (spec State). 시간표도 마디도 지나는 동안 하는 일도 남기는 것도
// 전부 데이터(content/regions 의 PRESENCE_ROUTES)에서 다시 오고, 세계가 기억하는 것은
// "언제 시작했는가 · 어느 바퀴에 시작했는가 · 몇 번 마쳤는가 · 이번에 어디로 휘었는가" 다.
// 지금 몇 번째 마디인가 · 지금 어느 방을 지나는가 · 끝났는가는 그 넷과 세계 시각에서
// **유도된다** — 시계(semantic/clock.ts) · 물길(isFlowActive)과 같은 갈래의 유도된 사실이다.
//
// **규칙은 어떤 경로도 어떤 방도 이름으로 알지 못한다** (T1 · T4). 여기가 하는 일은 데이터가
// 밝힌 시간표와 시계가 낸 때를 맞춰 보고, 후보들 가운데 **값 하나(소란)** 가 가장 큰 것을
// 고르는 것뿐이다. 어느 철에 무엇이 어디를 지나 무엇을 남기는지는 데이터에만 있고,
// 그 데이터를 지우면 세계는 C017 과 한 값도 다르지 않다 (spec SPEC-007 경계 ①).
//
// 이 파일은 **읽기만** 한다 — State 를 바꾸는 것은 세계 과정(simulation/presence.ts)과
// 부르기(rules/summon-presence.ts)의 전이뿐이다 (원칙 4).

import {
  PRESENCE_ROUTES,
  presenceRoute,
  type PresenceRoute,
  type RegionPhase,
} from '../../regions';
import { dayPhaseAt, worldClockAt } from './clock';
import { isSeasonListed } from './region-phase';
import type { RegionState } from './region-state';
import { PRESENCE_SECONDS_PER_NODE } from './world-state';

/**
 * 지나가는 것 하나의 **지금** (C018 ADDED · spec State).
 *
 * 지나고 있지 않으면 `startedAt` 과 `route` 는 **자리 자체가 없다** — 없는 것을 0 이나 빈
 * 배열로 지어내지 않는다 (RegionState 의 rule? · sources? 가 세운 그 규율).
 * `startedCycle` 은 지나감이 끝난 뒤에도 남는다: 한 바퀴에 두 번 시작하지 않게 하는 것이
 * 그 값의 일이기 때문이다.
 */
export interface PresencePassState {
  /** 이번 지나감이 시작한 세계 시각. 지나고 있지 않으면 자리가 없다 */
  startedAt?: number;
  /** 마지막으로 시작한 철 바퀴. 한 번도 시작하지 않았으면 자리가 없다 */
  startedCycle?: number;
  /** 지금까지 **마친** 지나감의 수 (0 부터). 남긴 것의 마디를 정한다 */
  passes: number;
  /** 이번 지나감이 마디마다 고른 방들 — 휨의 결과다 (시작할 때 한 번 정해진다) */
  route?: string[];
}

/**
 * 세계가 설 때의 지나감들 — **밝힌 경로 전부**에 자리가 선다 (spec State).
 *
 * 아직 아무것도 지나가지 않았으므로 마친 수가 0 이고 나머지는 자리가 없다.
 * 되살린 세계는 이것을 부르지 않는다 — State 는 스냅샷에서 그대로 온다.
 */
export function createPresenceStates(): Record<string, PresencePassState> {
  const states: Record<string, PresencePassState> = {};
  for (const route of PRESENCE_ROUTES) states[route.id] = { passes: 0 };
  return states;
}

/** 그 경로의 지금 — 되살린 옛 세계에 자리가 없으면 "아직 지나가지 않았다" 로 친다 */
export function presenceStateOf(
  states: Record<string, PresencePassState>,
  routeId: string,
): PresencePassState {
  return states[routeId] ?? { passes: 0 };
}

/**
 * RULE-PRESENCE-SCHEDULE-001 (C018 ADDED · spec R1) — **지금이 그 경로의 때인가**.
 *
 * 묻는 것 셋뿐이다 — 밝힌 철에 드는가 · 밝힌 낮밤인가 · 이번 바퀴가 그 바퀴인가.
 * **밝히지 않은 것은 묻지 않는다**: 철을 밝히지 않은 경로는 어느 철에나 때가 맞고,
 * 낮밤을 밝히지 않은 경로는 낮에도 밤에도 맞는다 (원천의 occurrence 가 세운 그 어법).
 *
 * 철을 맞춰 보는 함수는 C016 이 세운 그것(isSeasonListed) 하나를 그대로 쓴다 — 문의 활성도
 * 원천의 출현도 소란의 가라앉음도 같은 물음을 그 함수 하나에 묻는다.
 *
 * 바퀴 조건이 0 이하이면 시간표가 없는 것으로 친다 — 나눌 수 없는 것을 나누지 않는다.
 */
export function isScheduledAt(route: PresenceRoute, time: number): boolean {
  const { seasons, dayPhase, everyNCycles } = route.schedule;
  if (!(everyNCycles > 0)) return false;
  if (!isSeasonListed(seasons, time)) return false;
  if (dayPhase !== undefined && dayPhaseAt(time) !== dayPhase) return false;
  return worldClockAt(time).seasonCycle % everyNCycles === 0;
}

/** 지금이 몇 바퀴째인가 — 한 바퀴에 두 번 시작하지 않게 하는 값 (시각에서 유도된다) */
export function presenceCycleAt(time: number): number {
  return worldClockAt(time).seasonCycle;
}

/**
 * RULE-PRESENCE-BEND-001 (C018 ADDED · spec R3) — **소란이 높은 쪽으로 휜다**.
 *
 * 마디마다 후보들 가운데 그 방의 소란이 가장 큰 것을 고른다. 같으면 데이터 순서의 앞선
 * 것이다 (결정론). 후보가 하나뿐인 마디는 그 하나이므로 휘지 않는다.
 *
 * **규칙은 어느 방이 어디인지 알지 못한다** (경계 ②) — 값 하나를 견줄 뿐이고, 어느 방이
 * 후보인지도 왜 그것이 후보인지도 데이터에만 있다. State 가 없는 방(되살린 옛 세계)은
 * 소란 0 으로 친다 — 아무 일도 겪지 않은 것과 같은 뜻이다.
 *
 * 판정은 **지나기 시작할 때 한 번**이다 (경계 ① · 기본형 ⑦) — 그래서 이 함수는 시작의
 * 전이에서만 불린다. 매 Tick 다시 정하면 지나가던 것이 방 사이를 오가고, 관찰자는
 * "내가 낸 소란이 그것을 불렀다" 를 한 번의 사실로 볼 수 없다.
 */
export function bendRoute(
  route: PresenceRoute,
  regionStates: Record<string, RegionState>,
): string[] {
  const chosen: string[] = [];
  for (const candidates of route.nodes) {
    let best: string | undefined;
    let bestValue = -Infinity;
    for (const candidate of candidates) {
      const value = regionStates[candidate.region]?.disturbance.value ?? 0;
      if (value > bestValue) {
        bestValue = value;
        best = candidate.region;
      }
    }
    // 후보가 하나도 없는 마디는 건너뛰지 않는다 — 마디 수가 곧 지나가는 길이이므로
    // 자리를 비워 두면 길이가 짧아진다. 그런 데이터는 검사가 잡는다.
    if (best !== undefined) chosen.push(best);
  }
  return chosen;
}

/**
 * 지금 **몇 번째 마디**인가 — 지나고 있지 않으면 null (C018 ADDED · spec State 유도되는 것).
 *
 * 마디 수에 이르렀으면 그 지나감은 끝난 것이므로 null 이다. 세계 과정이 그 Tick 에 그것을
 * 거두지만, 관찰이 세계 과정보다 먼저 올 수도 있으므로 여기서도 같은 답을 낸다
 * (판정이 두 벌이 아니라 **같은 식**이다).
 */
export function passingNodeIndex(pass: PresencePassState, time: number): number | null {
  if (pass.startedAt === undefined || !pass.route || pass.route.length === 0) return null;
  const index = Math.floor((time - pass.startedAt) / PRESENCE_SECONDS_PER_NODE);
  if (index < 0 || index >= pass.route.length) return null;
  return index;
}

/** 지금 어느 방을 지나는가 — 지나고 있지 않으면 undefined */
export function passingRegionOf(
  pass: PresencePassState,
  time: number,
): string | undefined {
  const index = passingNodeIndex(pass, time);
  return index === null ? undefined : pass.route?.[index];
}

/** 그 경로가 그 방을 지날 때 쓰는 **선의 이름** — 그 마디의 후보 가운데 그 방의 것 */
function curveOf(route: PresenceRoute, nodeIndex: number, regionId: string): string | undefined {
  return route.nodes[nodeIndex]?.find((candidate) => candidate.region === regionId)?.curve;
}

/** 그 방을 지금 지나는 것 하나 — 무엇이 · 어느 선으로 */
export interface PassingHere {
  presence: string;
  curve: string;
}

/**
 * RULE-OBSERVE-PROJECTION (C018 CHANGED · spec R9) — **그 방을 지금 지나는 것들**.
 *
 * 관찰은 방으로 잘린다 — 다른 방을 지나는 것은 여기 나오지 않는다 (SPEC-003 경계 ①).
 * 하나도 없으면 빈 배열이고, 순서는 데이터 순서 그대로다 (결정론).
 *
 * 시간표도 남은 시간도 다음 방도 몇 번째 지나감인지도 내지 않는다 — 세계는 "지금 여기를
 * 무엇이 지난다" 까지만 말한다 (T8 · spec Observable).
 */
export function passingIn(
  states: Record<string, PresencePassState>,
  regionId: string,
  time: number,
): PassingHere[] {
  const here: PassingHere[] = [];
  for (const route of PRESENCE_ROUTES) {
    const pass = presenceStateOf(states, route.id);
    const index = passingNodeIndex(pass, time);
    if (index === null || pass.route?.[index] !== regionId) continue;
    const curve = curveOf(route, index, regionId);
    if (curve === undefined) continue;
    here.push({ presence: route.presence, curve });
  }
  return here;
}

/**
 * RULE-REGION-PHASE-001 (C018 CHANGED · spec R4) — **지나는 것이 그 방에 거는 덧씌움들**.
 *
 * 위상을 거는 원인이 셋째가 되었다 (철 · 소란 · 지나가는 것). 형은 C016 의 것 그대로이고
 * 겹침을 다루는 어법도 그대로다 — 여기가 하는 일은 지금 이 방을 지나는 것들이 밝힌
 * 덧씌움을 모아 내는 것뿐이고, 걸린 것을 어떻게 합치는지는 부르는 쪽이 안다.
 *
 * 한 경로가 여러 방을 지나므로 밝힌 자락 목록에는 방마다의 것이 함께 든다 — 그 가운데
 * **이 방 Description 에 있는 op id** 만 실제로 무엇을 덮는다 (region-phase.ts 가 그 방의
 * area 를 훑어 짚는다). 그래서 여기서 방을 가려 내지 않는다: 가리는 자리는 하나여야 한다.
 */
export function passingOverlaysIn(
  states: Record<string, PresencePassState>,
  regionId: string,
  time: number,
): RegionPhase[] {
  const overlays: RegionPhase[] = [];
  for (const route of PRESENCE_ROUTES) {
    const effect = route.effectWhilePassing;
    if (!effect?.hazardExtend) continue;
    const pass = presenceStateOf(states, route.id);
    if (passingRegionOf(pass, time) !== regionId) continue;
    overlays.push({ hazardExtend: effect.hazardExtend });
  }
  return overlays;
}

/**
 * RULE-SOURCE-CONDITION-001 (C018 CHANGED · spec R7) — 그 원천을 **남기는 경로**.
 *
 * 모르는 원천 · 아무도 남기지 않는 원천은 undefined 다. 원천은 자기가 무엇에 매달렸는지
 * 말하지 않는다 — 무엇이 무엇을 남기는지는 지나가는 것 쪽 데이터(leavesBehind)가 안다.
 * 흐름의 도착 원천을 흐름 표에서 찾는 것(inflowOf)과 같은 어법이다.
 */
export function leavingRouteOf(sourceId: string): PresenceRoute | undefined {
  return PRESENCE_ROUTES.find((route) => route.leavesBehind?.includes(sourceId));
}

/**
 * 그 경로가 **지금 그 방을 지나고 있는가** (C018 ADDED · spec R7 이 묻는 값).
 *
 * "지나고 있는가" 가 아니라 "**여기를** 지나고 있는가" 인 이유 — 남겨지는 원천은 그 방의
 * 것이고, 그 경로가 다른 방으로 휘어 간 동안 그 방에서는 아무 일도 일어나지 않기 때문이다
 * (spec SPEC-006 경계 ③). 방을 묻지 않으면 휘어 간 지나감의 시간이 그 방 원천의 되돌아옴을
 * 밀어 올려, 그것이 한 번도 오지 않은 방에 시간만으로 서 버린다 (경계 ② 가 막는 그 일이다).
 */
export function isPassingRegion(
  states: Record<string, PresencePassState>,
  routeId: string,
  regionId: string,
  time: number,
): boolean {
  return passingRegionOf(presenceStateOf(states, routeId), time) === regionId;
}

/**
 * RULE-PRESENCE-PASS-001 (C018 ADDED · spec R2) — 남긴 것이 설 **마디의 번호**.
 *
 * **경로 이름과 마친 수**로 정해진다 (spec State 유도되는 것) — 같은 세계를 두 번 돌리면
 * 몇 번째 지나감의 것이 같은 마디에 선다 (SPEC-006 경계 ④). 이름을 함께 접는 것은
 * 경로마다 첫 자리가 갈리게 하기 위해서다: 마친 수만 쓰면 어느 경로든 처음은 언제나
 * 마디 0 이라 "임의의 마디" 가 아니게 된다 (기본형 ⑤ — 마디는 임의이되 결정론이다).
 *
 * 마디가 하나뿐이면 언제나 0 이다. 규칙은 그 마디가 어디인지 알지 못한다 — 자리는
 * 데이터(그 방의 경로 선)가 소유하고 여기 있는 것은 번호뿐이다.
 */
export function leftBehindSiteIndex(routeId: string, passes: number, siteCount: number): number {
  if (siteCount <= 1) return 0;
  let folded = 0;
  for (let i = 0; i < routeId.length; i++) folded = (folded * 31 + routeId.charCodeAt(i)) % 1000003;
  return (folded + passes) % siteCount;
}

/** 그 경로 — 모르는 id 면 undefined. 데이터의 표를 그대로 통과시킨다 */
export function findPresenceRoute(id: string): PresenceRoute | undefined {
  return presenceRoute(id);
}
