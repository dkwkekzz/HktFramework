// RULE-GUARD-SET-001 — Implements INTENT-GUARD-STANCE-001 · INTENT-GUARD-BEGIN-GATE-001
// Input          Actor, 요청한 Stance (open | guard)
// Preconditions  guard 로 세우려면 —
//                1. Actor 가 쓰러지지 않았다
//                2. 현재 행동이 대체 가능하다 (휘두르는 중에 자세를 갈아탈 수 없다)
//                3. Cp > 0 (치를 것이 없으면 애초에 막을 수 없다)
//                4. GuardBroken 이 아니다 (무너진 여파가 아직 가시지 않았다)
//                open 으로 놓는 것에는 Precondition 이 없다 — 언제나 놓을 수 있다
// Transition     Stance = 요청값. CurrentAction 은 건드리지 않는다 —
//                걷던 몸은 걷던 채로 자세만 바뀐다. guard 로 세울 때 MoveMode = walk
// Result         Success | Failure(downed | action-busy | insufficient-cp | guard-broken)
//
// 요청은 토글이 아니라 명시값이다 — 같은 요청이 두 번 와도 결과가 같다
// (RULE-MOVE-MODE-001 과 같은 형태).
//
// RULE-GUARD-BREAK-001 — Implements INTENT-GUARD-BREAK-001 · INTENT-GUARD-BREAK-AFTERMATH-001
// Input          막고 있으나 대가를 치를 수 없는 대상 Actor, World.Time
// Preconditions  Stance = guard 이고 Cp < CpPaid
// Transition     Cp = 0, Stance = open, GuardBrokenUntil = World.Time + GUARD_BREAK_LOCK
// Result         Broken(GuardBrokenUntil)
//
// 여파를 거두는 Rule 은 없다 — World.Time 이 그 값을 지나가면 끝난다.
// 새 Tick 단계를 만들지 않기 위한 선택이며, 파생 상태(GuardBroken)로 관찰된다.
//
// RULE-GUARD-ABSORB-001 — Implements INTENT-GUARD-ABSORB-001 · INTENT-GUARD-DIRECTION-001
// 별도의 실행 순서를 갖지 않는다 — RULE-STRIKE-DAMAGE-001 이 이 파일의 판정과 계산을
// 불러 쓴다. 독립 이름을 두는 이유는 "생명 대신 기력" 이 타격 규칙의 곁가지가 아니라
// 이 Cycle 의 중심이기 때문이다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_GUARD_SET } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { CENTER_EPSILON } from '../semantic/collision';
import {
  GUARD_BREAK_LOCK,
  GUARD_CP_PER_DAMAGE,
  GUARD_DAMAGE_RATIO,
  GUARD_FRONT_COS,
  isDowned,
  isGuardBroken,
  type Stance,
} from '../semantic/combat';
import type { WorldPosition } from '../semantic/position';
import { evaluateActionBegin, type ActionBusyReason } from './action-begin';

export type GuardFailureReason =
  | ActionBusyReason
  | 'downed'
  | 'insufficient-cp'
  | 'guard-broken'
  | 'unknown-stance';

/**
 * Precondition 평가 — Observable(Guard.Availability / Guard.FailureReason)과 공유한다.
 * "지금 막을 수 있는가" 를 묻는 것이므로 guard 기준으로 본다.
 * 판정이 한 곳에만 있어야 "왜 안 되는가" 와 실제 거절 사유가 어긋나지 않는다.
 */
export function evaluateGuardSet(actor: ActorState, time: number): GuardFailureReason | null {
  if (isDowned(actor)) return 'downed';
  if (isGuardBroken(actor, time)) return 'guard-broken';

  // 자세를 세우는 것도 지금 하던 일을 그만둘 수 있어야 한다 —
  // 휘두르는 중에 자세를 갈아탈 수는 없다. 다만 자세는 행동을 대체하지는 않는다.
  const busy = evaluateActionBegin(actor, 'idle');
  if (busy) return busy;

  if (actor.cp <= 0) return 'insufficient-cp';
  return null;
}

export function ruleGuardSet(actor: ActorState, stance: Stance, time: number): ActionResult {
  if (stance !== 'open' && stance !== 'guard')
    return { status: 'failure', rule: RULE_GUARD_SET, reason: 'unknown-stance' };

  // 놓는 것은 언제나 된다 — 막기를 그만두지 못할 이유가 없다.
  if (stance === 'open') {
    actor.stance = 'open';
    return { status: 'success', rule: RULE_GUARD_SET };
  }

  const failure = evaluateGuardSet(actor, time);
  if (failure) return { status: 'failure', rule: RULE_GUARD_SET, reason: failure };

  actor.stance = 'guard';
  // 달리며 막지 않는다 — 두 자세를 동시에 가질 수 없다는 것의 반대 방향
  // (RULE-MOVE-MODE-001 은 run 요청이 막기를 놓게 한다).
  actor.moveMode = 'walk';
  return { status: 'success', rule: RULE_GUARD_SET };
}

/**
 * INTENT-GUARD-DIRECTION-001 — 이 타격이 막히는가.
 *
 * 막기는 앞쪽만 막는다. 몸이 향한 방향과 "타격이 들어온 쪽"(대상 → 공격자)의
 * dot 이 GUARD_FRONT_COS 이상이어야 한다.
 * 두 몸이 완전히 겹쳐 방향을 정할 수 없으면 막지 못한 것으로 본다 —
 * 없는 방향을 지어내지 않는다 (결정론).
 */
export function isGuardBlocking(target: ActorState, attackerPosition: WorldPosition): boolean {
  if (target.stance !== 'guard') return false;

  const dx = attackerPosition.x - target.position.x;
  const dz = attackerPosition.z - target.position.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= CENTER_EPSILON) return false;

  const dot = (target.facing.x * dx + target.facing.z * dz) / d;
  return dot >= GUARD_FRONT_COS;
}

/**
 * RULE-GUARD-ABSORB-001 의 계산 — 막아 냈을 때 무엇을 얼마나 치르는가.
 * 상태를 바꾸지 않는다. 값만 돌려주고 적용은 RULE-STRIKE-DAMAGE-001 이 한다.
 *
 * 피해가 사라지는 것이 아니라 어느 자원으로 받을지가 바뀐다 — hpLoss + absorbed = mitigated.
 * 큰 것을 막는 일은 더 비싸다 — cpPaid 가 막아 낸 몫에 비례하기 때문이다.
 */
export function guardCost(mitigated: number): { hpLoss: number; cpPaid: number } {
  const hpLoss = mitigated * GUARD_DAMAGE_RATIO;
  const absorbed = mitigated - hpLoss;
  return { hpLoss, cpPaid: absorbed * GUARD_CP_PER_DAMAGE };
}

/**
 * RULE-GUARD-BREAK-001 — 치를 기력이 없어 방어가 무너진다.
 * 남아 있던 기력은 마지막 대가로 모두 소진된다 — 무너짐은 기력이 모자랐다는 사실 그 자체다.
 */
export function ruleGuardBreak(target: ActorState, time: number): void {
  target.cp = 0;
  target.stance = 'open';
  target.guardBrokenUntil = time + GUARD_BREAK_LOCK;
}
