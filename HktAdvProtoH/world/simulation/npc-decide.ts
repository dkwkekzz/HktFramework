// RULE-NPC-DECIDE-001 — Implements INTENT-NPC-AUTONOMY-001
// Input          Control = autonomous 인 Actor, 세계의 다른 Actor 들
// Preconditions  현재 행동이 대체 가능하다 (attack · mine 중에는 결정하지 않는다)
// Transition     인지 대상 = PerceptionRange 안의 가장 가까운 다른 Actor
//                  있음 + AttackRange 이내 → RULE-ATTACK-001
//                  있음 + AttackRange 밖   → RULE-MOVE-001 (대상 Position 으로)
//                  없음                    → WanderPath 순회 (RULE-MOVE-001)
//                결정한 행동이 현재 행동과 같으면 유지한다
// Result         Decided(ActionKind) | Unchanged
//
// 이 Rule 은 세계 규칙이지 Client 요청이 아니다 — Tick 에서 실행된다.

import type { ActorState } from '../semantic/actor';
import { distance, type WorldPosition } from '../semantic/position';
import type { WorldState } from '../semantic/world-state';
import { evaluateActionBegin, isSameAction } from '../rules/action-begin';
import { ruleAttack } from '../rules/attack';
import { ruleMove } from '../rules/move';

const ARRIVAL_EPSILON = 1e-6;

// 인지 대상 — PerceptionRange 안의 가장 가까운 다른 Actor.
// 거리가 같으면 Actor.Id 사전순으로 앞선 쪽 (결정론).
export function perceivedTarget(state: WorldState, actor: ActorState): ActorState | null {
  let best: ActorState | null = null;
  let bestDistance = Infinity;

  for (const other of state.actors) {
    if (other.id === actor.id) continue;
    const d = distance(actor.position, other.position);
    if (d > actor.perceptionRange) continue;

    if (d < bestDistance - ARRIVAL_EPSILON) {
      best = other;
      bestDistance = d;
    } else if (Math.abs(d - bestDistance) <= ARRIVAL_EPSILON && best && other.id < best.id) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

function wanderDestination(actor: ActorState): WorldPosition | null {
  if (actor.wanderPath.length === 0) return null;

  const current = actor.wanderPath[actor.wanderIndex];
  if (current && distance(actor.position, current) <= ARRIVAL_EPSILON) {
    actor.wanderIndex = (actor.wanderIndex + 1) % actor.wanderPath.length;
  }
  return actor.wanderPath[actor.wanderIndex] ?? null;
}

export function ruleNpcDecide(state: WorldState, actor: ActorState): 'decided' | 'unchanged' {
  if (evaluateActionBegin(actor)) return 'unchanged'; // 대체 불가 행동 중 — 결정하지 않는다

  const target = perceivedTarget(state, actor);

  if (target) {
    if (distance(actor.position, target.position) <= actor.attackRange) {
      if (isSameAction(actor.currentAction, 'attack', { targetActorId: target.id })) {
        return 'unchanged';
      }
      return ruleAttack(state, actor, target.id).status === 'success' ? 'decided' : 'unchanged';
    }

    const destination = { x: target.position.x, z: target.position.z };
    if (isSameAction(actor.currentAction, 'move', { targetPosition: destination })) {
      return 'unchanged';
    }
    return ruleMove(state, actor, destination).status === 'success' ? 'decided' : 'unchanged';
  }

  const destination = wanderDestination(actor);
  if (!destination) return 'unchanged';
  if (isSameAction(actor.currentAction, 'move', { targetPosition: destination })) {
    return 'unchanged';
  }
  return ruleMove(state, actor, destination).status === 'success' ? 'decided' : 'unchanged';
}

export function ruleNpcDecideAll(state: WorldState): void {
  for (const actor of state.actors) {
    if (actor.control === 'autonomous') ruleNpcDecide(state, actor);
  }
}
