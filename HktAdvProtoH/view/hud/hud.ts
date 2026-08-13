// Web HUD (범용 엔진) — hud 항목 배열·interaction 배열을 순회하며 표시한다.
// 항목별 표시 특성은 HUD/Interaction Registry 가 정하고, 미등록 항목도 기본 형식으로 그린다.

import { hudTraits } from '../engine/hud-registry';
import { interactionTraits } from '../engine/interaction-registry';
import type { SceneState } from '../scene/scene-state';
import { reasonText } from './reason-text';

export interface EntityLabel {
  x: number;
  y: number;
  text: string;
}

export interface Hud {
  render(scene: SceneState, labels: EntityLabel[]): void;
}

export function createHud(container: HTMLElement): Hud {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="hud-panel" id="hud-items"></div>
    <div class="hud-keys" id="hud-keys"></div>
    <div id="hud-labels"></div>
    <div class="hud-toast" id="hud-toast"></div>
    <div class="hud-hint" id="hud-mine-hint"></div>
  `;
  container.appendChild(root);

  const items = root.querySelector('#hud-items') as HTMLElement;
  const keys = root.querySelector('#hud-keys') as HTMLElement;
  const labelLayer = root.querySelector('#hud-labels') as HTMLElement;
  const toast = root.querySelector('#hud-toast') as HTMLElement;
  const hint = root.querySelector('#hud-mine-hint') as HTMLElement;

  const lastCounters = new Map<string, number>();
  let toastUntil = 0;

  return {
    render(scene, labels) {
      // HUD 항목 — counter / flag 를 Registry 특성대로 표시
      const parts: string[] = [];
      for (const item of scene.hud) {
        const traits = hudTraits(item.id);
        if (item.kind === 'counter') {
          const value = item.value as number;
          parts.push(
            `<span class="hud-item">${traits.icon ?? ''} ${traits.label}: ${value}</span>`,
          );
          // 획득 토스트 — counter 증가 감지 (판정이 아니라 Snapshot 값 변화 표시)
          const prev = lastCounters.get(item.id);
          if (traits.celebrateGain && prev !== undefined && value > prev) {
            toast.textContent = `+${value - prev} ${traits.label} 획득!`;
            toastUntil = performance.now() + 1600;
          }
          lastCounters.set(item.id, value);
        } else {
          parts.push(
            `<span class="hud-item hud-flag" data-on="${item.value}">${traits.label} ${item.value ? '✓' : '✗'}</span>`,
          );
        }
      }
      items.innerHTML = parts.join('');
      toast.style.opacity = performance.now() < toastUntil ? '1' : '0';

      // 조작 안내 — 이동(엔진 기본) + 키 바인딩이 등록된 interaction 들
      const keyLines = ['이동: WASD / 방향키'];
      for (const i of scene.interactions) {
        const t = interactionTraits(i.role);
        if (t.key && t.promptLabel) keyLines.push(`${t.promptLabel}: ${t.keyLabel ?? t.key}`);
      }
      keys.innerHTML = keyLines.join('<br/>');

      // entity 라벨 (worldToScreen 투영 결과)
      labelLayer.innerHTML = labels
        .map(
          (l) =>
            `<div class="hud-label" style="left:${l.x}px;top:${l.y}px;display:block">${l.text}</div>`,
        )
        .join('');

      // 프롬프트 — 키 바인딩 interaction 중: 가용한 것 우선, 아니면 사유 표시
      const keyed = scene.interactions.filter((i) => interactionTraits(i.role).key);
      const active = keyed.find((i) => i.available) ?? keyed.find((i) => i.reason);
      if (active && active.available) {
        const t = interactionTraits(active.role);
        hint.textContent = `[${t.keyLabel ?? t.key}] ${t.promptLabel ?? active.role}`;
        hint.dataset.state = 'available';
      } else if (active?.reason) {
        hint.textContent = reasonText(active.reason);
        hint.dataset.state = 'unavailable';
      } else {
        hint.textContent = '';
      }
    },
  };
}
