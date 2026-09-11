// RULE-ATTRIBUTE-SET-001 — Implements INTENT-ATTRIBUTE-MUTATE-001 (기반만)
// Input          대상 ActorId, AttributeId, 새 값
// Preconditions  1. World.DebugAuthority.Open 이 참이다
//                2. 대상 ActorId 가 세계에 있다
//                3. AttributeId 가 MutableAttribute 목록에 있다
//                4. 새 값이 그 속성의 Range 안에 있다
// Transition     그 속성에 새 값을 넣는다.
//                Hp 가 0 이 되면 RULE-DOWNED-001 이 이어서 일어나고,
//                쓰러진 몸의 Hp 를 올리면 다시 일어난다 (downed → idle).
//                C039 CHANGED — **HpMax/CpMax 는 더 넣을 수 없다** (spec 규칙 3 · R2):
//                그 둘은 몸의 성질(유도값)이 되었고, 넣은 Hp · Cp 는 그 성질에 잘린다
//                (clampBodyVitals — 이 규칙 id 위의 데이터).
// Result         Success | Failure(debug-closed | unknown-target | unknown-attribute |
//                                  value-out-of-range)
//                사유 코드가 value- 로 시작하는 이유: out-of-range 는 채광이 이미
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
import { clampBodyVitals } from '../semantic/body-property';
import { findMutableAttribute, isDowned, type MoveMode } from '../semantic/combat';
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
  } else {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'value-out-of-range' };
    const min = attribute.min ?? -Infinity;
    const max = attribute.max ?? Infinity;
    if (value < min || value > max)
      return { status: 'failure', rule: RULE_ATTRIBUTE_SET, reason: 'value-out-of-range' };
    applyNumeric(target, attribute.id, value);
  }

  // C039 ADDED — **현재값은 성질을 넘지 않는다** (spec 규칙 3 ②③ · 이 규칙 id 위의 데이터).
  // 밖에서 넣은 Hp · Cp 도 그 몸의 지금 최대에 잘린다 — 넣은 수가 그보다 크면 최대가 된다
  // (전에는 필드를 읽어 여기서 잘랐다 · 이제 묻는 자리 하나가 그 최대를 안다).
  clampBodyVitals(state, target);

  // 값이 바뀐 뒤에도 세계는 자기 규칙대로 간다.
  if (target.hp === 0) ruleDowned(target);
  // 쓰러진 몸에 생명이 돌아오면 일어난다 — 규칙이 되돌리지 않는 것을 밖에서 되돌린 것이다.
  else if (wasDowned && target.currentAction.kind === 'downed') target.currentAction = idleAction();

  return { status: 'success', rule: RULE_ATTRIBUTE_SET };
}

function applyNumeric(actor: ActorState, id: string, value: number): void {
  switch (id) {
    // 넣은 값을 그대로 둔다 — 성질에 자르는 것은 위 한 자리(clampBodyVitals)가 한다
    case 'hp':
      actor.hp = value;
      return;
    case 'cp':
      actor.cp = value;
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
