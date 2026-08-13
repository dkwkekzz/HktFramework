// C001 Observer Projection (player) — 이 Cycle 의 Observable 을 Snapshot 에 더한다.
// VIEW-STONE-MINING-001 (cycles/C001-stone-mining/04-gameview.spec.yaml) 이 계약이다.
//
// 의미만 투영한다 — role/state/값/사유 코드. 표현(sprite·크기·라벨 형식·문구)은
// View 의 Presentation 결정 Layer 책임이며 여기 싣지 않는다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import { evaluateMinePreconditions } from '../rules/mine';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import type { WorldState } from '../semantic/world-state';

export function projectC001(state: WorldState, snapshot: GameViewSnapshot): void {
  snapshot.specId = 'VIEW-STONE-MINING-001';
  snapshot.scene = 'mining-field';

  snapshot.entities.push({
    id: 'player',
    role: 'player-character',
    state: state.actor.moveTarget ? 'moving' : 'idle',
    position: { x: state.actor.position.x, z: state.actor.position.z },
  });

  snapshot.interactions.push({ id: 'move', role: 'move-to', available: true });

  for (const deposit of state.deposits) {
    snapshot.entities.push({
      id: deposit.id,
      role: 'resource-deposit',
      state: deposit.resourceAmount > 0 ? 'available' : 'depleted',
      position: { x: deposit.position.x, z: deposit.position.z },
      labelValue: deposit.resourceAmount,
    });

    const failure = evaluateMinePreconditions(state, deposit);
    snapshot.interactions.push({
      id: 'mine',
      role: 'mine-deposit',
      targetEntityId: deposit.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
    });
  }

  snapshot.hud.push(
    { id: 'inventory.stone', kind: 'counter', value: itemCount(state.actor.inventory, 'stone') },
    { id: 'tool.hasMiningTool', kind: 'flag', value: hasMiningTool(state.actor.inventory) },
  );
}
