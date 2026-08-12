// GameView Specification 해석 — Snapshot(계약) → Scene State.
// 순수 함수 — World 없이 Fixture 만으로 검증 가능하다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import type { SceneState } from '../scene/scene-state';

export function interpretGameView(snapshot: GameViewSnapshot): SceneState {
  const { player, deposit } = snapshot.entities;

  return {
    entities: [
      {
        key: 'player',
        spriteId: `${player.role}:${player.state}`, // player-character:idle | :moving
        position: player.position,
      },
      {
        key: 'deposit',
        spriteId: `${deposit.role}:${deposit.state}`, // resource-deposit:available | :depleted
        position: deposit.position,
      },
    ],
    hud: {
      stoneCount: snapshot.hud.inventory.stone,
      hasMiningTool: snapshot.hud.tool.hasMiningTool,
      mineAvailable: snapshot.hud.mineHint.available,
      mineReason: snapshot.hud.mineHint.reason ?? null,
      depositRemaining: deposit.remaining,
    },
    mineTargetDepositId: deposit.id,
  };
}
