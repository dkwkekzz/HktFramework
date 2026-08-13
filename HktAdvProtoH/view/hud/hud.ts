// Web HUD — Snapshot 의 hud 목록과 안내 문구를 그대로 그린다.
//
// 여기에 게임 의미가 없다. 항목이 무엇을 뜻하는지, 사유 문구가 무엇인지 View 는 모른다 —
// 목록이 오면 목록을 그리고, 값이 늘면 명세가 준 알림 틀로 알린다.

import type { SceneState } from '../scene/scene-state';

export interface Hud {
  render(state: SceneState, labelScreen: Map<string, { x: number; y: number }>): void;
}

export function createHud(container: HTMLElement): Hud {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="hud-panel" id="hud-items"></div>
    <div class="hud-keys" id="hud-keys"></div>
    <div class="hud-labels" id="hud-labels"></div>
    <div class="hud-toast" id="hud-toast"></div>
    <div class="hud-prompts" id="hud-prompts"></div>
  `;
  container.appendChild(root);

  const items = root.querySelector('#hud-items') as HTMLElement;
  const keys = root.querySelector('#hud-keys') as HTMLElement;
  const labels = root.querySelector('#hud-labels') as HTMLElement;
  const toast = root.querySelector('#hud-toast') as HTMLElement;
  const prompts = root.querySelector('#hud-prompts') as HTMLElement;

  const lastValues = new Map<string, number>();
  const labelNodes = new Map<string, HTMLElement>();
  let toastUntil = 0;

  return {
    render(state, labelScreen) {
      // 좌상단 항목 — 아이콘 · 이름 · 값
      items.textContent = '';
      for (const item of state.hud.items) {
        const node = document.createElement('span');
        node.className = 'hud-item';
        node.textContent = `${item.icon ? `${item.icon} ` : ''}${item.label}: ${item.value}`;
        items.appendChild(node);

        // 값이 늘면 명세가 준 알림 틀을 채워 띄운다
        const numeric = typeof item.value === 'number' ? item.value : null;
        const before = lastValues.get(item.id);
        if (numeric !== null) {
          if (item.notifyOnIncrease && before !== undefined && numeric > before) {
            toast.textContent = item.notifyOnIncrease
              .replace('{delta}', String(numeric - before))
              .replace('{label}', item.label);
            toastUntil = performance.now() + 1600;
          }
          lastValues.set(item.id, numeric);
        }
      }
      toast.style.opacity = performance.now() < toastUntil ? '1' : '0';

      keys.innerHTML = (state.hud.keyHints ?? []).join('<br/>');

      // 존재 머리 위 라벨 — 라벨을 가진 존재만, 화면 좌표가 있을 때만
      const alive = new Set<string>();
      for (const entity of state.entities) {
        if (!entity.label) continue;
        const screen = labelScreen.get(entity.id);
        if (!screen) continue;
        alive.add(entity.id);
        let node = labelNodes.get(entity.id);
        if (!node) {
          node = document.createElement('div');
          node.className = 'hud-label';
          labels.appendChild(node);
          labelNodes.set(entity.id, node);
        }
        node.style.left = `${screen.x}px`;
        node.style.top = `${screen.y}px`;
        node.textContent = entity.label;
      }
      for (const [id, node] of labelNodes) {
        if (alive.has(id)) continue;
        node.remove();
        labelNodes.delete(id);
      }

      // 하단 안내 — 명세가 준 문구를 그대로
      prompts.textContent = '';
      for (const prompt of state.prompts) {
        const node = document.createElement('div');
        node.className = 'hud-hint';
        node.dataset.state = prompt.available ? 'available' : 'unavailable';
        node.textContent = prompt.text;
        prompts.appendChild(node);
      }
    },
  };
}
