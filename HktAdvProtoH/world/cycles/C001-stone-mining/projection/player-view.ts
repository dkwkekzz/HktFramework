// Observer Projection (player) — C001 이 Snapshot 에 채우는 몫.
// VIEW-STONE-MINING-001 (cycles/C001-stone-mining/04-gameview.spec.yaml) 이 계약이다.
//
// 이후 Cycle 은 이 함수를 고치지 않고 자기 모듈에서 draft 에 자기 필드를 더한다 —
// 그래서 "C001 까지" 실행하면 Snapshot 도 C001 시점의 모습으로 산출된다.

import type { GameViewDraft } from '../../../kernel/module';
import type { WorldState } from '../../../kernel/state';
import { evaluateMinePreconditions } from '../rules/mine';
import { hasMiningTool, itemCount } from '../semantic/inventory';

export function projectPlayerView(state: WorldState, draft: GameViewDraft): void {
  const deposit = state.deposits[0];
  if (!deposit) throw new Error('C001 world 는 deposit 하나를 전제한다');

  const failure = evaluateMinePreconditions(state, deposit);
  const mineAvailable = failure === null;

  draft.id = 'VIEW-STONE-MINING-001';
  draft.scene = 'mining-field';
  draft.entities = {
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
  };
  draft.interactions = {
    move: { role: 'move-to', available: true },
    mine: {
      role: 'mine-deposit',
      available: mineAvailable,
      ...(failure ? { unavailableReason: failure } : {}),
    },
  };
  draft.hud = {
    inventory: { stone: itemCount(state.actor.inventory, 'stone') },
    tool: { hasMiningTool: hasMiningTool(state.actor.inventory) },
    mineHint: { available: mineAvailable, ...(failure ? { reason: failure } : {}) },
  };
}
