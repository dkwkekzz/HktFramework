// GameView Specification 해석 — Snapshot(계약) → Scene State.
// 순수 함수 — World 없이 Fixture 만으로 검증 가능하다.
//
// 여기에 특정 존재(player · deposit …)의 이름이 나오면 안 된다. 목록을 목록으로 옮길 뿐이다.

import type { GameViewSnapshot } from '../../protocol/gameview';
import { hasSprite } from '../assets/registry';
import { PLACEHOLDER_SPRITE } from '../assets/registry';
import type { SceneEntity, SceneState, ScenePrompt } from '../scene/scene-state';

/** 역할과 상태로 에셋 키를 만든다 — `role:state` 가 없으면 `role`, 그것도 없으면 대체 표현 */
export function spriteIdFor(role: string, state?: string): { id: string; placeholder: boolean } {
  const withState = state ? `${role}:${state}` : role;
  if (hasSprite(withState)) return { id: withState, placeholder: false };
  if (hasSprite(role)) return { id: role, placeholder: false };
  return { id: PLACEHOLDER_SPRITE, placeholder: true };
}

export function interpretGameView(snapshot: GameViewSnapshot): SceneState {
  const entities: SceneEntity[] = snapshot.entities.map((entity) => {
    const sprite = spriteIdFor(entity.role, entity.state);
    return {
      id: entity.id,
      spriteId: sprite.id,
      placeholder: sprite.placeholder,
      position: entity.position,
      focus: entity.focus === true,
      label: entity.label ?? null,
    };
  });

  // 키가 달린 상호작용만 화면 안내로 올린다 — 가능하면 프롬프트, 아니면 불가 문구
  const prompts: ScenePrompt[] = [];
  for (const interaction of snapshot.interactions) {
    if (!interaction.key) continue;
    if (interaction.available) {
      if (interaction.prompt) {
        prompts.push({ text: `[${interaction.key}] ${interaction.prompt}`, available: true });
      }
    } else if (interaction.unavailableText) {
      prompts.push({ text: interaction.unavailableText, available: false });
    }
  }

  return {
    scene: snapshot.scene,
    entities,
    interactions: snapshot.interactions,
    hud: snapshot.hud,
    prompts,
  };
}
