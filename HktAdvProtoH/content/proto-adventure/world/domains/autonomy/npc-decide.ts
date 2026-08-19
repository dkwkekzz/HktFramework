// RULE-NPC-DECIDE-001 — Implements INTENT-NPC-AUTONOMY-001
// Input          Control = autonomous 인 Actor, 세계의 다른 Actor 들
// Preconditions  현재 행동이 대체 가능하다 (attack · mine 중에는 결정하지 않는다)
// Transition     인지 대상 = PerceptionRange 안의 가장 가까운 다른 Actor
//                  있음 + AttackRange 이내 → RULE-ATTACK-001 (대상 없이 휘두른다)
//                  있음 + AttackRange 밖   → RULE-MOVE-001 (대상 Position 으로)
//                  없음                    → WanderPath 순회 (RULE-MOVE-001)
//                결정한 행동이 현재 행동과 같으면 유지한다
// Result         Decided(ActionKind) | Unchanged
//
// 이 Rule 은 세계 규칙이지 Client 요청이 아니다 — Tick 에서 실행된다.

import type { ActorState } from '../../base/actor';
import { faceToward } from '../../base/physics-constants';
import { distance, type WorldPosition } from '../../base/position';
import type { WorldState } from '../../base/world-state';
import { evaluateActionBegin, isSameAction } from '../../base/action-begin';
import { ruleSkillBegin } from '../combat/skill';
import { ruleMove } from '../movement/move';
import { isDowned } from '../combat/combat';

const ARRIVAL_EPSILON = 1e-6;

// 인지 대상 — PerceptionRange 안의 가장 가까운 다른 Actor.
// 거리가 같으면 Actor.Id 사전순으로 앞선 쪽 (결정론).
export function perceivedTarget(state: WorldState, actor: ActorState): ActorState | null {
  let best: ActorState | null = null;
  let bestDistance = Infinity;

  for (const other of state.actors) {
    if (other.id === actor.id) continue;
    if (isDowned(other)) continue; // 쓰러진 존재는 인지 대상이 되지 않는다 (C007)
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
  // C007 — 쓰러진 존재는 아무것도 결정하지 않는다 (INTENT-DOWNED-001).
  // downed 는 대체 불가능한 행동이므로 아래 관문이 이미 막지만, 의미를 코드에 남긴다.
  if (isDowned(actor)) return 'unchanged';
  if (evaluateActionBegin(actor)) return 'unchanged'; // 대체 불가 행동 중 — 결정하지 않는다

  const target = perceivedTarget(state, actor);

  if (target) {
    if (distance(actor.position, target.position) <= actor.attackRange) {
      // 대상을 넘기지 않는다 — 무엇이 맞을지는 휘두름 구간의 접촉이 정한다 (C006).
      if (isSameAction(actor.currentAction, 'attack', {})) return 'unchanged';
      // RULE-BODY-FACING-001 (C006 R1) — 휘두르기 전에 겨눈 대상을 향해 몸을 돌린다.
      faceToward(actor, target.position.x - actor.position.x, target.position.z - actor.position.z);
      // C007 — 자율 존재는 기본 스킬만 쓴다 (01 EXCLUDED "NPC 의 고급 스킬").
      return ruleSkillBegin(actor, 'attack').status === 'success' ? 'decided' : 'unchanged';
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
