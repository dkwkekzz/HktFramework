// Render 지시 해석 — Snapshot(계약) → Scene State.
// 순수 함수 — World 없이 Fixture 만으로 검증 가능하다.
// 표현 결정은 하지 않는다 — 지시에 없는 값만 엔진 기본값으로 채운다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import type { SceneState } from '../scene/scene-state';

const DEFAULT_SIZE = 2.5;
const DEFAULT_VARIANT = 'default';

export function interpretGameView(snapshot: GameViewSnapshot): SceneState {
  return {
    specId: snapshot.specId,
    terrain: snapshot.scene.terrain,
    entities: snapshot.entities.map((e) => {
      const r = e.representation; // 현재 capability: sprite (이후 kind 별 분기 추가)
      return {
        id: e.id,
        spriteId: `${r.sprite}:${r.variant ?? DEFAULT_VARIANT}`,
        size: r.size ?? DEFAULT_SIZE,
        position: e.position,
        ...(r.label !== undefined ? { label: r.label } : {}),
        cameraFollow: r.cameraFollow ?? false,
        trail: r.trail ?? false,
      };
    }),
    interactions: snapshot.interactions,
    hud: snapshot.hud,
  };
}
