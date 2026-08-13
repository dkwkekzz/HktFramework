// Presentation Resolver — 결정 Layer 의 진입점.
// Semantic Snapshot(role/state/값/사유 코드)을 Presentation 데이터로 해석해
// Capability Layer 가 소비할 Render Plan 을 만든다. 순수 함수 — Fixture 로 검증 가능.
//
// 결정은 전부 *-presentation.ts 의 role/id 단위 단일 항목에서 온다.
// 이 파일과 capability 코드는 Cycle 이 늘어도 수정되지 않는다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import type { SceneState } from '../scene/scene-state';
import { hudPresentation } from './hud-presentation';
import { interactionPresentation } from './interaction-presentation';
import { reasonText } from './reason-text';
import { rolePresentation } from './role-presentation';

export function resolvePresentation(snapshot: GameViewSnapshot): SceneState {
  return {
    specId: snapshot.specId,
    terrain: snapshot.scene,
    entities: snapshot.entities.map((e) => {
      const p = rolePresentation(e.role);
      return {
        id: e.id,
        spriteId: `${p.sprite}:${e.state}`,
        size: p.size,
        position: e.position,
        ...(e.labelValue !== undefined
          ? { label: p.labelFormat ? p.labelFormat(e.labelValue) : String(e.labelValue) }
          : {}),
        cameraFollow: p.cameraFollow ?? false,
        trail: p.trail ?? false,
      };
    }),
    interactions: snapshot.interactions.map((i) => {
      const p = interactionPresentation(i.role);
      return {
        id: i.id,
        available: i.available,
        ...(i.targetEntityId ? { targetEntityId: i.targetEntityId } : {}),
        ...(p.terrainTarget ? { terrainTarget: true } : {}),
        ...(p.key ? { key: p.key } : {}),
        ...(p.keyLabel ? { keyLabel: p.keyLabel } : {}),
        ...(p.prompt ? { prompt: p.prompt } : {}),
        ...(i.reason ? { unavailableText: reasonText(i.reason) } : {}),
      };
    }),
    hud: snapshot.hud.map((h) => {
      const p = hudPresentation(h.id);
      return {
        id: h.id,
        widget: h.kind,
        label: p.label,
        ...(p.icon ? { icon: p.icon } : {}),
        value: h.value,
        ...(p.celebrateGain ? { celebrateGain: true } : {}),
      };
    }),
  };
}
