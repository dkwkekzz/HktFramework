// RULE-ITEM-USE-001 — Implements INTENT-USE-ITEM-001 · INTENT-USE-TARGET-POLICY-001 ·
//                                INTENT-ITEM-EFFECT-IS-DECLARED-001 · INTENT-ACTION-STATE-001
// Input          World, Actor, 요청한 ObserverId, ItemKind
// Preconditions  1. 그 종류의 정의가 있다                  (unknown-item)
//                2. 그 정의가 Use 를 지닌다                (not-usable)
//                3. Items[kind] >= Use.Consumes           (not-enough)
//                그 다음은 **효과 갈래가 정한다**
// Transition     begin-declared-act 이면 그 행동의 시작 규칙에 **그대로 위임한다**
//                deliver-force 이면
//                    4. 고른 것이 있고 요구 종류와 맞다   (no-target-selected /
//                                                        target-kind-mismatch)
//                    5. 그 대상이 그 물건의 사거리 이내     (out-of-range)
//                       사거리는 **정의가 지닌다** — 밝히지 않으면 손이 닿는 거리다
//                    6. 현재 행동이 대체 가능하다          (action-busy)
//                    CurrentAction = use-item(kind, 고른 대상)
// Result         Success | Failure(reason)
//
// **여기서는 아무것도 줄지 않는다.** 수량은 3 에서 확인만 되고, 줄어드는 것은 완료
// 시점이다. 시작만 하고 끊긴 사용이 수량을 축내지 않는다 (DC-ITEM-CHANGE-IS-ONE-UNIT).
//
// RULE-ITEM-USE-COMPLETE-001 — Implements INTENT-USE-ITEM-001 · INTENT-ITEM-CONSUME-001 ·
//                                         INTENT-ITEM-ATOMIC-CHANGE-001 ·
//                                         INTENT-ACTION-PROGRESS-001
// Input          World, use-item 행동이 Duration 을 채운 Actor
// Preconditions  **다시 검증한다** — 시작과 완료 사이에 세계가 움직였을 수 있다
// Transition     ① 효과를 적용한다  ② 수량을 줄인다 — **하나의 성공 단위다**
// Result         Success | Failure(reason)
//
// RULE-ITEM-EFFECT-DELIVER-FORCE-001 — Implements INTENT-EFFECT-DELIVER-FORCE-001
// Input          World, 쓰는 Actor, 대상 Actor, Force
// Preconditions  대상이 쓰러지지 않았다                    (target-downed)
// Transition     관문이 거절이면 UnharmedContacts 에 남고, 허락이면 피해의 길을 지난다
// Result         Delivered
//
// **새 판정이 하나도 없다.** 관문(C018)도 계산(C010)도 치명(C015)도 막기(C011)도
// 사건 기록(C007)도 전부 이미 있는 것이다. 이 규칙이 하는 일은 정의가 지닌 위력을
// 그 길에 넣는 것뿐이다 (DC-COMBAT-ONE-LAYER-AT-A-TIME — 층이 올라가지 않는다).

import type { ActionResult } from '../../protocol/actions';
import { RULE_ITEM_USE, RULE_ITEM_USE_COMPLETE } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { isDowned } from '../semantic/combat';
import {
  itemDefinition,
  type DeclaredAct,
  type Force,
  type ItemDefinition,
  type ItemUse,
} from '../semantic/item';
import { itemCount } from '../semantic/inventory';
import { distance } from '../semantic/position';
import { selectedEntityId } from '../semantic/target-selection';
import { INTERACTION_RANGE, type WorldState } from '../semantic/world-state';
import { beginAction, evaluateActionBegin } from './action-begin';
import { ruleInventoryRemove } from './inventory';
import { evaluateMineTargeted, ruleMine } from './mine';
import { ruleHarmGate } from './relation';
import { ruleStrikeDamage } from './strike-damage';

// 실패 사유 코드 — Rule 이 소유하며 protocol 로는 문자열 코드로 흐른다.
// 위임 갈래는 그 행동의 사유가 그대로 나오므로 여기 목록에 없는 코드도 올 수 있다.
export type ItemUseFailureReason =
  | 'unknown-item' // 세계가 모르는 종류다
  | 'not-usable' // 쓸 수 있는 물건이 아니다 (정의에 Use 가 없다)
  | 'not-enough' // 필요한 만큼 지니지 않았다
  | 'no-target-selected'
  | 'target-kind-mismatch'
  | 'out-of-range'
  | 'target-gone' // 완료 시점에 대상이 세계에서 사라졌다
  | 'action-busy';

/**
 * 선언된 행동의 표 — begin-declared-act 갈래가 무엇에 위임하는가.
 *
 * **분기가 아니라 표다.** 아이템 종류를 묻지 않는다 — 정의가 밝힌 행동 이름으로
 * 찾을 뿐이며, 새 행동이 선언 가능해지면 항목이 하나 늘어난다
 * (INTENT-EFFECT-BEGIN-DECLARED-ACT-001).
 */
const DECLARED_ACTS: Readonly<
  Record<
    DeclaredAct,
    {
      evaluate(state: WorldState, actor: ActorState, observerId: string): string | null;
      begin(state: WorldState, actor: ActorState, observerId: string): ActionResult;
    }
  >
> = {
  mine: {
    evaluate: (state, actor, observerId) => evaluateMineTargeted(state, actor, observerId),
    begin: (state, actor, observerId) => ruleMine(state, actor, observerId),
  },
};

/**
 * 이 사용이 닿을 수 있는 거리 — 정의가 밝히지 않으면 손이 닿는 거리다.
 *
 * 규칙은 종류를 묻지 않는다. 물건마다 닿는 거리가 다른 것은 데이터이며,
 * 새 아이템이 자기 거리를 지녀도 이 함수는 바뀌지 않는다.
 */
function useRange(use: ItemUse): number {
  return use.range ?? INTERACTION_RANGE;
}

/** 이 사용이 요구하는 대상을 찾는다. 요구하지 않으면 null 을 돌려준다 */
function resolveTarget(
  state: WorldState,
  observerId: string,
  use: ItemUse,
): { actor: ActorState } | { failure: ItemUseFailureReason } | null {
  if (use.targeting.requires === 'none') return null;

  const targetId = selectedEntityId(state.targetSelections, observerId);
  if (targetId === undefined) return { failure: 'no-target-selected' };

  // 지금 요구할 수 있는 것은 존재뿐이다. 다른 종류를 요구하는 정의가 생기면
  // 여기에 그 종류를 찾는 줄이 하나 늘어난다 — 판정의 형태는 바뀌지 않는다.
  if (use.targeting.entityKind === 'character') {
    const target = state.actors.find((a) => a.id === targetId);
    if (!target) return { failure: 'target-kind-mismatch' };
    return { actor: target };
  }
  return { failure: 'target-kind-mismatch' };
}

/** 정의와 Use 를 함께 찾는다 — 둘 중 하나라도 없으면 사유가 나온다 */
function resolveUse(
  kind: string,
): { definition: ItemDefinition; use: ItemUse } | { failure: ItemUseFailureReason } {
  const definition = itemDefinition(kind);
  if (!definition) return { failure: 'unknown-item' };
  if (!definition.use) return { failure: 'not-usable' };
  return { definition, use: definition.use };
}

/**
 * Observable(소지품 항목의 가능/사유)과 Rule 이 **같은 판정을 공유한다.**
 * 화면에서 불가로 보이는 것을 억지로 요청해도 같은 사유로 거절된다
 * (DC-WORLD-OWNS-THE-SURFACE-LIST · INTENT-USE-AVAILABILITY-001).
 */
export function evaluateItemUse(
  state: WorldState,
  actor: ActorState,
  observerId: string,
  kind: string,
): string | null {
  const resolved = resolveUse(kind);
  if ('failure' in resolved) return resolved.failure;
  const { use } = resolved;

  if (itemCount(actor.inventory, kind as never) < use.consumes) return 'not-enough';

  // 갈래가 그 다음을 정한다.
  if (use.effect.kind === 'begin-declared-act') {
    return DECLARED_ACTS[use.effect.act].evaluate(state, actor, observerId);
  }

  const target = resolveTarget(state, observerId, use);
  if (target && 'failure' in target) return target.failure;
  if (target && distance(actor.position, target.actor.position) > useRange(use)) {
    return 'out-of-range';
  }
  return evaluateActionBegin(actor);
}

export function ruleItemUse(
  state: WorldState,
  actor: ActorState,
  observerId: string,
  kind: string,
): ActionResult {
  const resolved = resolveUse(kind);
  if ('failure' in resolved) {
    return { status: 'failure', rule: RULE_ITEM_USE, reason: resolved.failure };
  }
  const { use } = resolved;

  if (itemCount(actor.inventory, kind as never) < use.consumes) {
    return { status: 'failure', rule: RULE_ITEM_USE, reason: 'not-enough' };
  }

  // 위임 — 시작될 수 있는지도, 사유도, 시작하는 일도 전부 그 행동의 것이다.
  // 사용이 그 판정을 대신하거나 건너뛰지 않는다.
  if (use.effect.kind === 'begin-declared-act') {
    return DECLARED_ACTS[use.effect.act].begin(state, actor, observerId);
  }

  const failure = evaluateItemUse(state, actor, observerId, kind);
  if (failure) return { status: 'failure', rule: RULE_ITEM_USE, reason: failure };

  const target = resolveTarget(state, observerId, use);
  beginAction(
    actor,
    'use-item',
    {
      usedItemKind: kind,
      ...(target && 'actor' in target ? { usedItemTargetId: target.actor.id } : {}),
    },
    use.duration,
  );
  return { status: 'success', rule: RULE_ITEM_USE };
}

/** 위력을 전한다 — 무슨 일이 벌어지는지는 관계가 정한다 */
export function ruleItemEffectDeliverForce(
  state: WorldState,
  actor: ActorState,
  target: ActorState,
  force: Force,
  label: string,
): void {
  // C018 의 관문 그대로. 아이템이라고 관문 밖에 있지 않다.
  const gate = ruleHarmGate(actor, target);
  if (gate.status === 'refused') {
    state.unharmedContacts.push({
      attackerId: actor.id,
      targetId: target.id,
      skill: label,
      position: { x: target.position.x, z: target.position.z },
      time: state.time,
      reason: gate.reason,
    });
    return;
  }
  ruleStrikeDamage(state, actor, target, force, label);
}

/**
 * 완료 — 재검증 → 효과 → 소모. **하나의 성공 단위다.**
 *
 * 실패해도 행동은 끝난다 (채집의 완료와 같다). 효과도 소모도 일어나지 않을 뿐이다.
 * Consumes 가 0 인 갈래는 ②가 아무 일도 하지 않는다 — 그것도 성공이다.
 *
 * "효과가 성립한다" 는 **위력이 전해졌다**는 뜻이지 상대가 상했다는 뜻이 아니다.
 * 관계가 해를 허락하지 않아 아무 일도 일어나지 않은 접촉도 효과는 성립한 것이며
 * 돌은 줄어든다 — 던진 돌은 던진 것이다 (05-review.md 판단 4).
 */
export function ruleItemUseComplete(state: WorldState, actor: ActorState): ActionResult {
  const kind = actor.currentAction.usedItemKind;
  if (kind === undefined) {
    return { status: 'failure', rule: RULE_ITEM_USE_COMPLETE, reason: 'unknown-item' };
  }

  const resolved = resolveUse(kind);
  if ('failure' in resolved) {
    return { status: 'failure', rule: RULE_ITEM_USE_COMPLETE, reason: resolved.failure };
  }
  const { use } = resolved;

  // ── 재검증 — 시작과 완료 사이에 세계가 움직였을 수 있다 ──────────────
  if (itemCount(actor.inventory, kind as never) < use.consumes) {
    return { status: 'failure', rule: RULE_ITEM_USE_COMPLETE, reason: 'not-enough' };
  }

  let target: ActorState | undefined;
  if (use.targeting.requires === 'selected') {
    const targetId = actor.currentAction.usedItemTargetId;
    target = state.actors.find((a) => a.id === targetId);
    if (!target) return { status: 'failure', rule: RULE_ITEM_USE_COMPLETE, reason: 'target-gone' };
    if (distance(actor.position, target.position) > useRange(use)) {
      return { status: 'failure', rule: RULE_ITEM_USE_COMPLETE, reason: 'out-of-range' };
    }
    if (isDowned(target)) {
      return { status: 'failure', rule: RULE_ITEM_USE_COMPLETE, reason: 'target-downed' };
    }
  }

  // ── ① 효과 ─────────────────────────────────────────────────────────
  if (use.effect.kind === 'deliver-force' && target) {
    ruleItemEffectDeliverForce(state, actor, target, use.effect.force, kind);
  }

  // ── ② 소모 ─────────────────────────────────────────────────────────
  // 여기까지 왔다는 것은 ①이 성립했다는 뜻이다. 앞의 재검증이 수량을 이미 확인했으므로
  // 이 호출은 실패하지 않는다 — 반쪽 상태가 생길 자리가 없다.
  ruleInventoryRemove(actor, kind, use.consumes);
  return { status: 'success', rule: RULE_ITEM_USE_COMPLETE };
}
