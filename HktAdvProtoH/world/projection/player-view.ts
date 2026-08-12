// Observer Projection (player) — WorldState 를 GameView Specification 으로 투영한다.
// VIEW-STONE-MINING-001 (cycles/C001-stone-mining/04-gameview.spec.yaml) 이 계약이다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import { evaluateMinePreconditions } from '../rules/mine';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import type { WorldState } from '../semantic/world-state';

export function projectPlayerView(state: WorldState): GameViewSnapshot {
  const deposit = state.deposits[0];
  if (!deposit) throw new Error('C001 world 는 deposit 하나를 전제한다');

  const failure = evaluateMinePreconditions(state, deposit);
  const mineAvailable = failure === null;

  return {
    id: 'VIEW-STONE-MINING-001',
    scene: 'mining-field',
    entities: {
      player: {
        role: 'player-character',
        position: { x: state.actor.position.x, z: state.actor.position.z },
        state: state.actor.moveTarget ? 'moving' : 'idle',
      },
      deposit: {
        role: 'resource-deposit',
        resourceKind: 'stone',
        id: deposit.id,
        position: { x: deposit.position.x, z: deposit.position.z },
        state: deposit.resourceAmount > 0 ? 'available' : 'depleted',
        remaining: deposit.resourceAmount,
      },
    },
    interactions: {
      move: { role: 'move-to', available: true },
      mine: {
        role: 'mine-deposit',
        available: mineAvailable,
        ...(failure ? { unavailableReason: failure } : {}),
      },
    },
    hud: {
      inventory: { stone: itemCount(state.actor.inventory, 'stone') },
      tool: { hasMiningTool: hasMiningTool(state.actor.inventory) },
      mineHint: { available: mineAvailable, ...(failure ? { reason: failure } : {}) },
    },
  };
}
