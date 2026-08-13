// Web HUD — HUD Capability 엔진. counter / flag 위젯 · 프롬프트 · 획득 토스트 ·
// entity 라벨을 그릴 뿐, 라벨·아이콘·문구는 전부 Snapshot 의 지시를 그대로 표시한다.

import type { SceneState } from '../scene/scene-state';

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
      // HUD 위젯 — 지시받은 widget 종류대로 그린다
      const parts: string[] = [];
      for (const item of scene.hud) {
        if (item.widget === 'counter') {
          const value = item.value as number;
          parts.push(`<span class="hud-item">${item.icon ?? ''} ${item.label}: ${value}</span>`);
          // 획득 토스트 — celebrateGain 지시가 있는 counter 의 증가를 표시
          const prev = lastCounters.get(item.id);
          if (item.celebrateGain && prev !== undefined && value > prev) {
            toast.textContent = `+${value - prev} ${item.label} 획득!`;
            toastUntil = performance.now() + 1600;
          }
          lastCounters.set(item.id, value);
        } else {
          parts.push(
            `<span class="hud-item hud-flag" data-on="${item.value}">${item.label} ${item.value ? '✓' : '✗'}</span>`,
          );
        }
      }
      items.innerHTML = parts.join('');
      toast.style.opacity = performance.now() < toastUntil ? '1' : '0';

      // 조작 안내 — 이동(엔진 기본) + 키 지시가 있는 interaction
      const keyLines = ['이동: WASD / 방향키'];
      for (const i of scene.interactions) {
        if (i.key && i.prompt) keyLines.push(`${i.prompt}: ${i.keyLabel ?? i.key}`);
      }
      keys.innerHTML = keyLines.join('<br/>');

      // entity 라벨 (worldToScreen 투영 결과)
      labelLayer.innerHTML = labels
        .map(
          (l) =>
            `<div class="hud-label" style="left:${l.x}px;top:${l.y}px;display:block">${l.text}</div>`,
        )
        .join('');

      // 프롬프트 — 키 지시 interaction 중: 가용한 것 우선, 아니면 불가 문구
      const keyed = scene.interactions.filter((i) => i.key);
      const active = keyed.find((i) => i.available) ?? keyed.find((i) => i.unavailableText);
      if (active?.available) {
        hint.textContent = `[${active.keyLabel ?? active.key}] ${active.prompt ?? ''}`.trim();
        hint.dataset.state = 'available';
      } else if (active?.unavailableText) {
        hint.textContent = active.unavailableText;
        hint.dataset.state = 'unavailable';
      } else {
        hint.textContent = '';
      }
    },
  };
}
