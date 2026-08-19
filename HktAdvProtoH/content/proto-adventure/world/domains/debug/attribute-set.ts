// RULE-ATTRIBUTE-SET-001 — Implements INTENT-ATTRIBUTE-MUTATE-001 (C007 R2 — 기반만)
// Input          대상 ActorId, AttributeId, 새 값
// Preconditions  1. World.DebugAuthority.Open 이 참이다
//                2. 대상 ActorId 가 세계에 있다
//                3. AttributeId 가 MutableAttribute 목록에 있다
//                4. 새 값이 그 속성의 Range 안에 있다
// Transition     그 속성에 새 값을 넣는다.
//                Hp 가 0 이 되면 RULE-DOWNED-001 이 이어서 일어나고,
//                쓰러진 몸의 Hp 를 올리면 다시 일어난다 (downed → idle).
//                HpMax/CpMax 를 낮추면 현재값도 함께 그 안으로 들어온다.
// Result         Success | Failure(debug-closed | unknown-target | unknown-attribute |
//                                  value-out-of-range)
//                사유 코드가 value- 로 시작하는 이유: out-of-range 는 C001 이 이미
//                "너무 멀다" 로 쓰고 있다. 같은 코드가 두 뜻을 가지면 문구가 어긋난다.
//
// 이 Rule 은 값을 바꿀 뿐 새로운 게임 의미를 만들지 않는다.
// 세계의 규칙 안이 아니라 밖에서 손을 대는 자리이며 — 값이 바뀐 뒤의 세계는
// 여전히 자기 규칙대로 굴러간다. 치트 명령 체계는 이후 Cycle 이 이 위에 얹는다.
//
// 바꾸는 것은 언제나 세계다. 요청하는 이는 상태를 직접 건드리지 않는다 (World Authority).

import type { ActionResult } from '../../../protocol/actions';
import { RULE_ATTRIBUTE_SET } from '../../../protocol/semantic-id';
import { idleAction } from '../../base/action';
import type { ActorState } from '../../base/actor';
import { findMutableAttribute, isDowned } from '../combat/combat';
import type { MoveMode } from '../movement/move-mode';
import { findActor, type WorldState } from '../../base/world-state';
import { ruleDowned } from '../combat/strike-damage';

export type AttributeSetFailureReason =
  | 'debug-closed'
  | 'unknown-target'
  | 'unknown-attribute'
  | 'value-out-of-range';

// Observable(AttributeSet.Availability) 과 공유하는 판정 — 지금 세계가 조작을 허용하는가.
export function evaluateAttributeSetAvailability(
  state: WorldState,
): AttributeSetFailureReason | null {
  return state.debugAuthority.open ? null : 'debug-closed';
}

export function ruleAttributeSet(
  state: WorldState,
  targetId: string,
  attributeId: string,
  value: number | string,
): ActionResult {
  const closed = evaluateAttributeSetAvailability(state);
  if (closed) return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: closed };

  const target = findActor(state, targetId);
  if (!target) return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'unknown-target' };

  const attribute = findMutableAttribute(attributeId);
  if (!attribute)
    return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'unknown-attribute' };

  const wasDowned = isDowned(target);

  if (attribute.values) {
    if (typeof value !== 'string' || !attribute.values.includes(value))
      return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'value-out-of-range' };
    if (attribute.id === 'moveMode') target.moveMode = value as MoveMode;
  } else {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'value-out-of-range' };
    const min = attribute.min ?? -Infinity;
    const max = attribute.max ?? Infinity;
    if (value < min || value > max)
      return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'value-out-of-range' };
    applyNumeric(target, attribute.id, value);
  }

  // 값이 바뀐 뒤에도 세계는 자기 규칙대로 간다.
  if (target.hp === 0) ruleDowned(target);
  // 쓰러진 몸에 생명이 돌아오면 일어난다 — 규칙이 되돌리지 않는 것을 밖에서 되돌린 것이다.
  else if (wasDowned && target.currentAction.kind === 'downed') target.currentAction = idleAction();

  return { status: 'success', rule: RULE_ATTRIBUTE_SET };
}

function applyNumeric(actor: ActorState, id: string, value: number): void {
  switch (id) {
    case 'hp':
      actor.hp = Math.min(value, actor.hpMax);
      return;
    case 'hpMax':
      actor.hpMax = value;
      actor.hp = Math.min(actor.hp, actor.hpMax); // 최대치를 낮추면 현재값도 따라 들어온다
      return;
    case 'cp':
      actor.cp = Math.min(value, actor.cpMax);
      return;
    case 'cpMax':
      actor.cpMax = value;
      actor.cp = Math.min(actor.cp, actor.cpMax);
      return;
    // C010 → C012 — 네 능력은 다른 값을 끌고 오지 않는다. 다음 타격부터 그대로 반영된다.
    // 방어 둘을 따로 세울 수 있어야 약점이 고정된 성질이 아니라 값의 관계임이 드러난다.
    case 'physicalAttack':
      actor.physicalAttack = value;
      return;
    case 'auraAttack':
      actor.auraAttack = value;
      return;
    case 'armor':
      actor.armor = value;
      return;
    case 'resistance':
      actor.resistance = value;
      return;
    // C013 — 관통 둘. 이 값도 다른 값을 끌고 오지 않는다. 상대의 방어를 두껍게 만들고
    // 자기 관통을 올려 보는 것이 이 층을 플레이로 확인하는 경로다 (01 SCOPE NOTE).
    case 'armorPenetration':
      actor.armorPenetration = value;
      return;
    case 'resistancePenetration':
      actor.resistancePenetration = value;
      return;
    case 'moveSpeed':
      actor.moveSpeed = value;
      return;
    case 'runSpeedMultiplier':
      actor.runSpeedMultiplier = value;
      return;
    case 'actionSpeed':
      actor.actionSpeed = value;
      return;
  }
}
