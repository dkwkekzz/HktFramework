// RULE-GUARD-SET-001 — Implements INTENT-GUARD-STANCE-001 · INTENT-GUARD-BEGIN-GATE-001 ·
//                                 INTENT-GUARD-ONSET-001 (C011) ·
//                                 INTENT-PERFECT-GUARD-ONCE-001 (C011)
// Input          Actor, 요청한 Stance (open | guard), World.Time
// Preconditions  guard 로 세우려면 —
//                1. Actor 가 쓰러지지 않았다
//                2. 현재 행동이 대체 가능하다 (휘두르는 중에 자세를 갈아탈 수 없다)
//                3. Cp > 0 (치를 것이 없으면 애초에 막을 수 없다)
//                4. GuardBroken 이 아니다 (무너진 여파가 아직 가시지 않았다)
//                5. World.Time >= GuardStartedAt + GUARD_REARM_LOCK  (C011 ADDED)
//                   직전에 세운 뒤 한 호흡이 지났다
//                open 으로 놓는 것에는 Precondition 이 없다 — 언제나 놓을 수 있다
// Transition     Stance = 요청값. CurrentAction 은 건드리지 않는다 —
//                걷던 몸은 걷던 채로 자세만 바뀐다. guard 로 세울 때 MoveMode = walk.
//                C011 — open → guard 이면 GuardStartedAt = World.Time 도 찍는다
// Result         Success | Failure(downed | action-busy | insufficient-cp | guard-broken |
//                                  guard-rearming)
//
// 요청은 토글이 아니라 명시값이다 — 같은 요청이 두 번 와도 결과가 같다
// (RULE-MOVE-MODE-001 과 같은 형태).
//
// C011 — 그 멱등성이 여기서 두 번째 역할을 한다. 이미 guard 인 몸에 guard 를 다시
// 요청해도 GuardStartedAt 은 바뀌지 않는다 — 세워 둔 자세를 두드려 창을 다시 열 수 없다.
// 새 창은 open 을 거쳐야만 열리고, 그 open → guard 에는 Precondition 5 가 든다.
// 이 둘이 없으면 자세를 여닫는 것만으로 완벽 창이 끊임없이 새로 열려
// INTENT-PERFECT-GUARD-ONCE-001 이 세계에서 성립하지 않는다.
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
//
// RULE-PERFECT-GUARD-001 (C011) — Implements INTENT-PERFECT-GUARD-001 ·
//                                            INTENT-PERFECT-GUARD-REWARD-001
// 같은 형태다 — 실행 순서를 따로 갖지 않고 RULE-STRIKE-DAMAGE-001 이 이 파일의
// isPerfectGuard / perfectGuardGain 을 불러 쓴다. 독립 이름을 두는 이유는
// "읽어 낸 방어는 자원을 번다" 가 이 Cycle 의 중심이기 때문이다.
//
// RULE-EXPOSE-001 (C011) — Implements INTENT-EXPOSED-001 · INTENT-EXPOSED-EXPIRES-001
// Input          완벽하게 막힌 타격을 낸 공격자 Actor, World.Time
// Preconditions  그 타격이 완벽하게 막혔다
// Transition     ExposedUntil = max(ExposedUntil, World.Time + EXPOSED_DURATION)
// Result         Exposed(ExposedUntil)
//
// 행동을 끊지 않고 움직임도 막지 않는다 — 받는 결과만 바뀐다.
// 겹쳐도 깊어지지 않고 끝나는 시각만 뒤로 밀린다. 거두는 Rule 은 RULE-DOWNED-001 뿐이고
// 그 밖에는 World.Time 이 지나가면 끝난다 (GuardBrokenUntil 과 같은 형태 — 새 Tick 단계 없음).

import type { ActionResult } from '../../protocol/actions';
import { RULE_GUARD_SET } from '../../protocol/semantic-id';
import type { ActorState } from '../semantic/actor';
import { CENTER_EPSILON } from '../semantic/collision';
import {
  EXPOSED_DURATION,
  GUARD_BREAK_LOCK,
  GUARD_CP_PER_DAMAGE,
  GUARD_DAMAGE_RATIO,
  GUARD_FRONT_COS,
  guardRearmAt,
  isDowned,
  isGuardBroken,
  PERFECT_GUARD_CP_GAIN,
  PERFECT_GUARD_WINDOW,
  type Stance,
} from '../semantic/combat';
import type { WorldPosition } from '../semantic/position';
import { evaluateActionBegin, type ActionBusyReason } from './action-begin';

export type GuardFailureReason =
  | ActionBusyReason
  | 'downed'
  | 'insufficient-cp'
  | 'guard-broken'
  | 'guard-rearming' // C011 — 직전에 세운 뒤 한 호흡이 아직 지나지 않았다
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

  // C011 — 재세움 간격. 이미 세워 둔 자세에는 걸리지 않는다 —
  // 그 요청은 아무것도 바꾸지 않는 멱등 요청이므로 거절할 것이 없다.
  // 새로 세우는 것(open → guard)만이 한 호흡을 기다린다.
  if (actor.stance !== 'guard' && time < guardRearmAt(actor)) return 'guard-rearming';
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

  // C011 — 이미 세워 둔 자세에 같은 요청이 오면 아무것도 하지 않는다 (멱등).
  // 특히 GuardStartedAt 을 다시 찍지 않는다 — 세워 둔 자세를 두드려 완벽 창을
  // 다시 열 수 없다는 것이 INTENT-PERFECT-GUARD-ONCE-001 의 절반이다.
  if (actor.stance === 'guard') return { status: 'success', rule: RULE_GUARD_SET };

  const failure = evaluateGuardSet(actor, time);
  if (failure) return { status: 'failure', rule: RULE_GUARD_SET, reason: failure };

  actor.stance = 'guard';
  // C011 — 자세는 "언제 세웠는가" 를 함께 지닌다 (INTENT-GUARD-ONSET-001).
  // 이 시각과 타격이 닿은 시각의 관계 하나가 완벽 여부를 가른다.
  actor.guardStartedAt = time;
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

/**
 * INTENT-PERFECT-GUARD-001 — 이미 막힌 것으로 판정된 타격이 **완벽하게** 막혔는가.
 *
 * 부르는 쪽이 Blocked 를 먼저 확인한다 — 방향이 어긋난 타격은 애초에 막힌 것이 아니므로
 * 시점이 맞아도 완벽할 수 없다. 여기서 보는 것은 오직 두 시각의 차이 하나다.
 * 확률도, 스킬 종류도, 거리도 개입하지 않는다 (DC-COMBAT-PLAYER-CAUSALITY).
 */
export function guardElapsed(target: ActorState, time: number): number {
  return time - target.guardStartedAt;
}

export function isPerfectGuard(elapsed: number): boolean {
  return elapsed <= PERFECT_GUARD_WINDOW;
}

/**
 * RULE-PERFECT-GUARD-001 의 계산 — 완벽하게 막아 냈을 때 무엇을 얼마나 얻는가.
 * 상태를 바꾸지 않는다. 값만 돌려주고 적용은 RULE-STRIKE-DAMAGE-001 이 한다.
 *
 * 생명도 기력도 치르지 않는다. 오히려 번다 — 읽어 낸 방어는 공짜가 아니라 이득이다.
 * 얻는 것이 그 몸의 한계를 넘지는 않는다 (기존 clamp 의미 그대로 — 새 자원이 아니다).
 */
export function perfectGuardGain(target: ActorState): number {
  return Math.max(0, Math.min(PERFECT_GUARD_CP_GAIN, target.cpMax - target.cp));
}

/**
 * RULE-EXPOSE-001 — 완벽하게 막힌 자가 잠시 열린다.
 *
 * 열림은 막아 낸 자가 가지는 것이 아니라 막힌 자가 지불하는 것이다.
 * 겹쳐도 깊어지지 않는다 — 끝나는 시각만 뒤로 밀린다 (max).
 * 하던 행동을 끊지도, 움직임을 막지도 않는다. 달라지는 것은 받는 결과뿐이다.
 */
export function ruleExpose(attacker: ActorState, time: number): void {
  attacker.exposedUntil = Math.max(attacker.exposedUntil, time + EXPOSED_DURATION);
}
