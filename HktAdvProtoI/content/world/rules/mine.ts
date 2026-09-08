// RULE-MINE-001 — Implements INTENT-MINING-001 · INTENT-ACTION-STATE-001 (C016 CHANGED — 그 철이 아니면 그 자리에 없다)
// Input          Actor, Resource Source
// Preconditions  0. 지금 철에 그 원천이 선다 (C016 ADDED)
//                1. 대상 원천의 phase 가 available (C012 ADDED · C013 CHANGED — recovering 도 거절이다)
//                2. Mining Capability Item 보유  3. 같은 방의 InteractionRange 이내 (지금 마디로 잰다)
//                4. 현재 행동이 대체 가능하다
// Transition     CurrentAction = mine(Source)           ← 즉시 획득이 아니다
// Result         Success | Failure(not-this-season | source-depleted | source-recovering |
//                                  no-mining-tool | out-of-range | action-busy | unknown-source |
//                                  not-a-source — C022 ADDED: 지목한 것이 탄생지다)
//
// RULE-MINE-COMPLETE-001 — Implements INTENT-MINING-001 · INTENT-ACTION-PROGRESS-001
//                           (C013 CHANGED · C017 CHANGED — 캔 것이 그 방의 소란이 된다)
// Input          채굴 행동이 Duration 을 채운 Actor
// Preconditions  대상 원천을 세계가 알고 그 phase 가 available
// Transition     Inventory.Items[그 원천의 materialId] += 1 · sources[id].taken += 1 ·
//                taken 이 harvests 에 이르면 phase = depleted ·
//                그 원천이 무너지는 것이면 collapsedSites 에 **지금 마디**를 더한다 (C013 ADDED) ·
//                그 방의 소란 += DISTURBANCE_PER_HARVEST (C017 ADDED · RULE-DISTURBANCE-001)
// Result         Success | Failure(unknown-source | source-depleted)
//
// **캐는 것은 세계를 바꾸는 것이다** (C012). 원천마다 캘 수 있는 횟수가 있고(D4), 다 캐면
// 고갈된다. 고갈이 세계에 하는 넷 — 외형 · 흔적 · 통행 · 의존 — 은 전부 이 phase 하나에서
// **유도된다** (spec R2 경계). 그래서 세계 State 를 바꾸는 자리는 여기 한 곳뿐이다 (원칙 4).
//
// **규칙은 재료를 이름으로 알지 못한다** — 원천이 밝힌 materialId 를 그대로 품목으로 쓴다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_MINE, RULE_MINE_COMPLETE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { hasMiningTool, itemCount, setItemCount } from '../semantic/inventory';
import type { ItemKind } from '../semantic/item';
import { distance } from '../semantic/position';
import {
  findResourceSource,
  isSourcePresentAt,
  remembersBrokenSites,
  sourcePositionOf,
  sourceStateOf,
  type ResourceSource,
} from '../semantic/resource';
import { NOT_A_SOURCE, findLifeSite } from '../semantic/life';
import { addDisturbance, regionStateOf } from '../semantic/region-state';
import {
  DISTURBANCE_PER_HARVEST,
  INTERACTION_RANGE,
  type WorldState,
} from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다
export type MineFailureReason =
  // C016 ADDED — 그 철이 아니다. 고갈·되돌아옴과 다른 코드다: 저 둘은 **있던 것이 지금 없는**
  // 것이고 이것은 **그 철에만 있는** 것이다. 기다릴 대상이 다르므로 말도 달라야 한다
  | 'not-this-season'
  | 'source-depleted'
  // C013 ADDED — 되돌아오는 중이다. 고갈과 다른 코드다: 하나는 "이미 캐 갔다" 이고
  // 이것은 "곧 다시 난다" 이므로, 관찰자가 기다릴지 떠날지를 가를 수 있어야 한다
  | 'source-recovering'
  | 'no-mining-tool'
  | 'out-of-range'
  | 'action-busy';

/**
 * Precondition 평가 — Observable(Mine.Availability / Mine.FailureReason)과 Rule 이 같은 판정을 공유한다.
 *
 * 철을 **맨 앞에서** 본다 (C016 ADDED · spec SPEC-004 경계 ①): 그 철이 아니면 그 원천은
 * 아예 그 자리에 없고(관찰 결과에도 실리지 않는다), 없는 것에 대고 고갈이나 거리를 답하면
 * 세계가 두 말을 하는 것이 된다.
 *
 * 그 다음 고갈을 본다 (C012 ADDED · spec R1). 나머지 셋은 그 몸의 사정(연장 · 거리 ·
 * 하던 일)이고 고갈은 **세계의 사실**이다 — 이미 없는 것을 두고 "멀다" 고 답하면 관찰자는
 * 가까이 가 보고서야 없다는 것을 안다. 판이 멀리서도 "이미 캐 간 자리" 를 말해야 한다
 * (SPEC-003 경계 — 같은 사유가 요청 전에도 읽힌다).
 *
 * 방을 그 다음에 본다: 자리는 방마다 따로인 Local Space 좌표이므로, 방을 묻지 않으면 다른 방의
 * 원천이 우연히 가까운 좌표에 있을 때 닿아 버린다. 다른 방의 원천은 **닿지 않는 것**이므로
 * 사유도 out-of-range 다 (spec SPEC-006 경계 — 새 사유를 만들지 않는다).
 */
export function evaluateMinePreconditions(
  state: WorldState,
  actor: ActorState,
  source: ResourceSource,
): MineFailureReason | null {
  // C016 ADDED — 그 철이 아니면 그 자리에 없다 (spec R6 · SPEC-004 경계 ①).
  // 세지 않으면 관찰에 실리지 않는 원천을 요청 하나로 캐 갈 수 있다 — 세계가 판정하는
  // 자리는 여기이지 화면이 아니다 (원칙 1).
  if (!isSourcePresentAt(source, state.time)) return 'not-this-season';
  const phase = sourceStateOf(state.regionStates, source.regionId, source.id).phase;
  if (phase === 'depleted') return 'source-depleted';
  // C013 ADDED — 되돌아오는 중이면 아직 캘 수 없다 (spec R3). 고갈과 나란히 **가장 먼저** 본다.
  if (phase === 'recovering') return 'source-recovering';
  if (!hasMiningTool(actor.inventory)) return 'no-mining-tool';
  if (actor.regionId !== source.regionId) return 'out-of-range';
  // C013 CHANGED — 거리는 **지금 마디**로 잰다. 원천이 자리를 옮기므로 데이터의 마디 0
  // (source.position)으로 재면 아무도 없는 옛 자리까지의 거리가 된다.
  if (distance(actor.position, sourcePositionOf(state.regionStates, source)) > INTERACTION_RANGE) {
    return 'out-of-range';
  }
  return evaluateActionBegin(actor);
}

export function ruleMine(state: WorldState, actor: ActorState, sourceId: string): ActionResult {
  // 원천의 자리와 성질은 State 가 아니다 — 세계 데이터에서 온다 (semantic/resource.ts).
  // 그 위의 "몇 번 캤는가" 만이 방의 State 다.
  const source = findResourceSource(sourceId);
  if (!source) {
    // C022 CHANGED (spec R6 · SPEC-002 경계 ①) — 세계가 아는 것 가운데 **원천이 아닌 것**을
    // 지목했으면 그렇게 말한다. "그런 것이 없다"(unknown-source)와 갈리는 말이다: 알집은
    // 거기 서 있고 보이지만 캘 것이 아니다 — 기다릴 대상도 없다.
    //
    // 판이 미리 답하는 사유와 **같은 판정**이다 (투영이 같은 코드를 싣는다) — 가용하지 않다고
    // 밝혀 놓고 다른 말로 거절하지 않는다.
    //
    // 규칙은 그것이 알집인지 이름으로 알지 못한다 — "세계가 아는 탄생지" 라는 형뿐이다.
    const reason = findLifeSite(sourceId) ? NOT_A_SOURCE : 'unknown-source';
    return { status: 'failure', rule: RULE_MINE, reason };
  }

  const failure = evaluateMinePreconditions(state, actor, source);
  if (failure) return { status: 'failure', rule: RULE_MINE, reason: failure };

  beginAction(actor, 'mine', { targetSourceId: sourceId });
  return { status: 'success', rule: RULE_MINE };
}

// 채굴 행동의 완료 효과 — RULE-ACTION-PROGRESS-001 이 Duration 을 채운 시점에 호출한다.
// 실패해도 행동은 종료된다 (획득만 일어나지 않는다).
//
// **세계가 바뀌는 유일한 자리다** (원칙 4). 캔 것이 손에 들어오고, 같은 전이에서 그 자국이
// 방의 State 에 남는다 — 캐기 시작한 뒤 남이 마지막 한 번을 가져갔을 수도 있으므로
// 여기서도 phase 를 다시 본다 (시작할 때의 판정을 믿지 않는다).
export function ruleMineComplete(state: WorldState, actor: ActorState): ActionResult {
  const sourceId = actor.currentAction.targetSourceId;
  const source = sourceId ? findResourceSource(sourceId) : undefined;
  if (!source) return { status: 'failure', rule: RULE_MINE_COMPLETE, reason: 'unknown-source' };

  // 그 방의 원천 State — 없으면 여기서 세운다 (available · 아직 한 번도 캐지 않았다).
  // C017 CHANGED — 방의 State 를 짓는 자리는 하나다 (semantic/region-state.ts 의 regionStateOf) —
  // 소란이 모든 방에 서므로 소란 없는 State 를 여기서 지어내면 형이 거짓말을 한다.
  const regionState = regionStateOf(state.regionStates, source.regionId);
  const sources = (regionState.sources ??= {});
  const sourceState = (sources[source.id] ??= {
    phase: 'available',
    taken: 0,
    progress: 0,
    siteIndex: 0,
  });

  if (sourceState.phase === 'depleted') {
    return { status: 'failure', rule: RULE_MINE_COMPLETE, reason: 'source-depleted' };
  }

  // 품목의 이름은 원천이 준다 — 규칙은 그것이 무엇인지 묻지 않고 그대로 담는다.
  const kind = source.materialId as ItemKind;
  setItemCount(actor.inventory, kind, itemCount(actor.inventory, kind) + 1);

  // 캔 자국 — 마지막 한 번까지는 available 이다 (SPEC-001 경계: 미리 고갈되지 않는다).
  sourceState.taken += 1;
  if (sourceState.taken >= source.harvests) {
    sourceState.phase = 'depleted';
    // C013 ADDED — 고갈되는 순간 **그 마디**가 무너진다 (spec R6). 원천이 나중에 다음 마디로
    // 옮겨 가도 이 자리는 무너진 채 남는다 — 무너짐은 원천이 아니라 자리가 기억한다.
    // 이미 있는 마디를 두 번 더하지 않는다 (경계).
    //
    // C020 CHANGED — **기억하는 이유가 둘이 되었다** (C020 spec R4). 무너지는 원천에 더해
    // 깨진 마디가 자락을 거는 원천도 그 번호를 기억한다 — 기억하는 자리는 여전히 하나이고
    // (collapsedSites) 판정은 remembersBrokenSites 하나가 낸다. 둘 다 밝히지 않은 원천의
    // State 는 한 값도 달라지지 않는다.
    if (remembersBrokenSites(source)) {
      const collapsed = (sourceState.collapsedSites ??= []);
      if (!collapsed.includes(sourceState.siteIndex)) collapsed.push(sourceState.siteIndex);
    }
  }

  // RULE-DISTURBANCE-001 (C017 ADDED · spec R1 · R11) — **캔 것이 그 방의 소란이 된다.**
  // 위 판정과 결과는 한 값도 바뀌지 않았다: 이 한 줄이 더해졌을 뿐이다.
  // 오르는 것은 **그 일이 일어난 방**이고(spec SPEC-001 경계 ②), 얼마나 오르는지도
  // 임계에서 멈추는 것도 그 규칙 하나가 안다 (semantic/region-state.ts 의 addDisturbance).
  addDisturbance(state.regionStates, source.regionId, DISTURBANCE_PER_HARVEST);

  return { status: 'success', rule: RULE_MINE_COMPLETE };
}
