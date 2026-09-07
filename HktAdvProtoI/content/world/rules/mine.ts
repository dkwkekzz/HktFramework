// RULE-MINE-001 — Implements INTENT-MINING-001 · INTENT-ACTION-STATE-001 (C013 CHANGED — 되돌아오는 중에도 캘 수 없다)
// Input          Actor, Resource Source
// Preconditions  1. 대상 원천의 phase 가 available (C012 ADDED · C013 CHANGED — recovering 도 거절이다)
//                2. Mining Capability Item 보유  3. 같은 방의 InteractionRange 이내 (지금 마디로 잰다)
//                4. 현재 행동이 대체 가능하다
// Transition     CurrentAction = mine(Source)           ← 즉시 획득이 아니다
// Result         Success | Failure(source-depleted | source-recovering | no-mining-tool |
//                                  out-of-range | action-busy | unknown-source)
//
// RULE-MINE-COMPLETE-001 — Implements INTENT-MINING-001 · INTENT-ACTION-PROGRESS-001 (C013 CHANGED)
// Input          채굴 행동이 Duration 을 채운 Actor
// Preconditions  대상 원천을 세계가 알고 그 phase 가 available
// Transition     Inventory.Items[그 원천의 materialId] += 1 · sources[id].taken += 1 ·
//                taken 이 harvests 에 이르면 phase = depleted ·
//                그 원천이 무너지는 것이면 collapsedSites 에 **지금 마디**를 더한다 (C013 ADDED)
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
  sourcePositionOf,
  sourceStateOf,
  type ResourceSource,
} from '../semantic/resource';
import { INTERACTION_RANGE, type WorldState } from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다
export type MineFailureReason =
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
 * 고갈을 **가장 먼저** 본다 (C012 ADDED · spec R1). 나머지 셋은 그 몸의 사정(연장 · 거리 ·
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
  if (!source) return { status: 'failure', rule: RULE_MINE, reason: 'unknown-source' };

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
  const regionState = (state.regionStates[source.regionId] ??= {});
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
    if (source.collapses) {
      const collapsed = (sourceState.collapsedSites ??= []);
      if (!collapsed.includes(sourceState.siteIndex)) collapsed.push(sourceState.siteIndex);
    }
  }

  return { status: 'success', rule: RULE_MINE_COMPLETE };
}
