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

import type { ActionResult } from '../../protocol/actions';
import { RULE_ATTRIBUTE_SET } from '../../protocol/semantic-id';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { findMutableAttribute, isDowned, type MoveMode, type Stance } from '../semantic/combat';
import { findActor, type WorldState } from '../semantic/world-state';
import { ruleDowned } from './strike-damage';

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
    // C010 — 자세를 밖에서 세우는 것은 RULE-GUARD-SET-001 의 Precondition 을 거치지 않는
    // 세계 밖의 손이다. 다만 바뀐 뒤의 세계는 자기 규칙대로 간다 (아래 후처리 그대로).
    else if (attribute.id === 'stance') {
      target.stance = value as Stance;
      // C011 — 자세를 세웠으면 세운 시각도 함께 찍는다. 찍지 않으면 지난 시각이 남아
      // 창이 이미 닫힌 채로 자세만 서게 되고, 밖의 손이 만든 상태가 세계의 규칙으로는
      // 도달할 수 없는 것이 된다 (RULE-GUARD-SET-001 은 언제나 둘을 함께 세운다).
      if (target.stance === 'guard') target.guardStartedAt = state.time;
    }
  } else {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'value-out-of-range' };
    const min = attribute.min ?? -Infinity;
    const max = attribute.max ?? Infinity;
    if (value < min || value > max)
      return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'value-out-of-range' };
    applyNumeric(target, attribute.id, value, state.time);
  }

  // 값이 바뀐 뒤에도 세계는 자기 규칙대로 간다.
  if (target.hp === 0) ruleDowned(target);
  // 쓰러진 몸에 생명이 돌아오면 일어난다 — 규칙이 되돌리지 않는 것을 밖에서 되돌린 것이다.
  else if (wasDowned && target.currentAction.kind === 'downed') target.currentAction = idleAction();

  return { status: 'success', rule: RULE_ATTRIBUTE_SET };
}

function applyNumeric(actor: ActorState, id: string, value: number, time: number): void {
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
    case 'moveSpeed':
      actor.moveSpeed = value;
      return;
    case 'runSpeedMultiplier':
      actor.runSpeedMultiplier = value;
      return;
    case 'actionSpeed':
      actor.actionSpeed = value;
      return;
    case 'defense':
      // C010 — 크게 올려 보면 "아무리 두꺼워도 피해가 0 이 되지 않는다" 가
      // strikeEvents 의 내역(base 대비 mitigated)으로 직접 확인된다.
      actor.defense = value;
      return;
    case 'exposedFor':
      // C011 — "지금부터 몇 초 동안 열려 있게 한다". 0 이면 그 자리에서 닫힌다.
      // 세계 시각을 직접 받지 않는 이유는 밖에서 의미 있는 값을 고를 수 없기 때문이다.
      // 이것으로 자율 존재의 공격을 기다리지 않고도 되받아침을 재현할 수 있다.
      actor.exposedUntil = value > 0 ? time + value : 0;
      return;
  }
}
