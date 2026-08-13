// Observer Projection (player) — WorldState 를 Semantic Snapshot 으로 투영한다.
// VIEW-WORLD-SERVER-001 (cycles/C003-world-server-separation/04-gameview.spec.yaml) 이 계약이다.
//
// 의미만 투영한다 — role/state/값/사유 코드. 표현(sprite·모션 파일·크기·라벨 형식·문구)은
// View 의 Presentation 결정 Layer 책임이며 여기 싣지 않는다.
// 특히 어떤 모션이 존재하는지 World 는 알지 못한다 — kind 와 state 까지만 알린다.

import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { actionProgress, actionTargetId } from '../semantic/action';
import { evaluateAttackPreconditions } from '../rules/attack';
import { evaluateMinePreconditions } from '../rules/mine';
import { evaluateMoveAvailability } from '../rules/move';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import { playerActor, type WorldState } from '../semantic/world-state';

export const SPEC_ID = 'VIEW-WORLD-SERVER-001';

export function projectPlayerView(state: WorldState): GameViewSnapshot {
  const player = playerActor(state);
  const entities: EntityView[] = [];
  const interactions: InteractionView[] = [];

  // entities.character — 세계의 모든 Actor 를 같은 계약으로 투영한다 (cardinality: many)
  for (const actor of state.actors) {
    const progress = actionProgress(actor.currentAction);
    const target = actionTargetId(actor.currentAction);
    entities.push({
      id: actor.id,
      role: actor.control === 'player' ? 'player-character' : 'npc-character',
      state: actor.currentAction.kind, // idle | move | attack | mine
      kind: actor.characterKind,
      position: { x: actor.position.x, z: actor.position.z },
      ...(progress !== null ? { progress } : {}),
      ...(target ? { targetEntityId: target } : {}),
    });
  }

  // interactions.move — 목적지는 요청 시점에 정해지므로 가용성은 행동 대체 가능성만 판정한다
  const moveFailure = evaluateMoveAvailability(player);
  interactions.push({
    id: 'move',
    role: 'move-to',
    available: moveFailure === null,
    ...(moveFailure ? { reason: moveFailure } : {}),
  });

  // interactions.attack — 대상 Actor 별로 평가한다
  for (const actor of state.actors) {
    if (actor.id === player.id) continue;
    const failure = evaluateAttackPreconditions(player, actor);
    interactions.push({
      id: 'attack',
      role: 'attack-character',
      targetEntityId: actor.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
    });
  }

  // entities.deposit + interactions.mine
  for (const deposit of state.deposits) {
    entities.push({
      id: deposit.id,
      role: 'resource-deposit',
      state: deposit.resourceAmount > 0 ? 'available' : 'depleted',
      kind: deposit.resourceKind,
      position: { x: deposit.position.x, z: deposit.position.z },
      labelValue: deposit.resourceAmount,
    });

    const failure = evaluateMinePreconditions(player, deposit);
    interactions.push({
      id: 'mine',
      role: 'mine-deposit',
      targetEntityId: deposit.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
    });
  }

  const playerProgress = actionProgress(player.currentAction);

  return {
    specId: SPEC_ID,
    scene: 'mining-field',
    entities,
    interactions,
    hud: [
      { id: 'inventory.stone', kind: 'counter', value: itemCount(player.inventory, 'stone') },
      { id: 'tool.hasMiningTool', kind: 'flag', value: hasMiningTool(player.inventory) },
      {
        id: 'player.action',
        kind: 'label',
        value: player.currentAction.kind,
        ...(playerProgress !== null ? { progress: playerProgress } : {}),
      },
      // World.Time (C003) — 세계가 자기 시계로 어디까지 왔는가.
      // 관찰자가 보지 않은 동안에도 이 값이 흘러 있다는 사실이 세계의 독립성을 보인다.
      { id: 'world.time', kind: 'counter', value: state.time },
    ],
  };
}
