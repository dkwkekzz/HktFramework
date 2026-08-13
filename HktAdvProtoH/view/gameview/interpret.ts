// GameView Specification 해석 — Snapshot(계약) → Scene State (범용 순회).
// 순수 함수 — World 없이 Fixture 만으로 검증 가능하다.
// entity 가 몇 개든, 어떤 role 이든 이 코드는 바뀌지 않는다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import type { SceneState } from '../scene/scene-state';

export function interpretGameView(snapshot: GameViewSnapshot): SceneState {
  return {
    specId: snapshot.specId,
    entities: snapshot.entities.map((e) => ({
      id: e.id,
      role: e.role,
      spriteId: `${e.role}:${e.state}`,
      position: e.position,
      ...(e.labelValue !== undefined ? { labelValue: e.labelValue } : {}),
    })),
    interactions: snapshot.interactions,
    hud: snapshot.hud,
  };
}
