// Observer Projection (player) — WorldState 를 범용 GameView Snapshot 으로 투영한다.
// VIEW-STONE-MINING-001 (cycles/C001-stone-mining/04-gameview.spec.yaml) 이 의미 계약이다.
// Cycle 이 늘면 이 Projection 이 entities/interactions/hud 항목을 늘린다 —
// Snapshot 구조 자체는 바뀌지 않는다.

import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { evaluateMinePreconditions } from '../rules/mine';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import type { WorldState } from '../semantic/world-state';

export function projectPlayerView(state: WorldState): GameViewSnapshot {
  const entities: EntityView[] = [
    {
      id: 'player',
      role: 'player-character',
      state: state.actor.moveTarget ? 'moving' : 'idle',
      position: { x: state.actor.position.x, z: state.actor.position.z },
    },
  ];

  const interactions: InteractionView[] = [{ id: 'move', role: 'move-to', available: true }];

  for (const deposit of state.deposits) {
    entities.push({
      id: deposit.id,
      role: 'resource-deposit',
      state: deposit.resourceAmount > 0 ? 'available' : 'depleted',
      position: { x: deposit.position.x, z: deposit.position.z },
      labelValue: deposit.resourceAmount,
    });

    const failure = evaluateMinePreconditions(state, deposit);
    interactions.push({
      id: 'mine',
      role: 'mine-deposit',
      targetEntityId: deposit.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
    });
  }

  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: 'mining-field',
    entities,
    interactions,
    hud: [
      { id: 'inventory.stone', kind: 'counter', value: itemCount(state.actor.inventory, 'stone') },
      { id: 'tool.hasMiningTool', kind: 'flag', value: hasMiningTool(state.actor.inventory) },
    ],
  };
}
