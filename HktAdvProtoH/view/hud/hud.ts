// Web HUD — Spec 의 hud 계약(inventory.stone / tool.hasMiningTool / mineHint)을 DOM 으로 표시한다.

import type { HudModel } from '../scene/scene-state';
import { reasonText } from './reason-text';

export interface Hud {
  render(model: HudModel): void;
}

export function createHud(container: HTMLElement): Hud {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="hud-panel">
      <div id="hud-stone"></div>
      <div id="hud-tool"></div>
      <div id="hud-deposit"></div>
    </div>
    <div class="hud-hint" id="hud-mine-hint"></div>
  `;
  container.appendChild(root);

  const stone = root.querySelector('#hud-stone') as HTMLElement;
  const tool = root.querySelector('#hud-tool') as HTMLElement;
  const deposit = root.querySelector('#hud-deposit') as HTMLElement;
  const hint = root.querySelector('#hud-mine-hint') as HTMLElement;

  return {
    render(model) {
      stone.textContent = `Stone: ${model.stoneCount}`;
      tool.textContent = model.hasMiningTool ? '장비: 곡괭이' : '장비: 없음';
      deposit.textContent = `광맥 잔량: ${model.depositRemaining}`;
      if (model.mineAvailable) {
        hint.textContent = '광맥을 클릭해 캐자!';
        hint.dataset.state = 'available';
      } else {
        hint.textContent = model.mineReason ? reasonText(model.mineReason) : '';
        hint.dataset.state = 'unavailable';
      }
    },
  };
}
