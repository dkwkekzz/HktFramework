// Web HUD — Spec 의 hud 계약(inventory.stone / tool / mineHint)을 DOM 으로 표시한다.
// 곡괭이 아이콘 + Stone 카운트, 조작 안내, [E] 채굴 프롬프트, 획득 토스트, 광맥 잔량 라벨.

import type { HudModel } from '../scene/scene-state';
import { reasonText } from './reason-text';

export interface Hud {
  render(model: HudModel, depositScreen: { x: number; y: number } | null): void;
}

export function createHud(container: HTMLElement): Hud {
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div class="hud-panel"><span class="hud-icon">⛏</span><span id="hud-stone"></span></div>
    <div class="hud-keys">이동: WASD / 방향키<br/>채굴: E</div>
    <div class="hud-label" id="hud-deposit-label"></div>
    <div class="hud-toast" id="hud-toast"></div>
    <div class="hud-hint" id="hud-mine-hint"></div>
  `;
  container.appendChild(root);

  const stone = root.querySelector('#hud-stone') as HTMLElement;
  const label = root.querySelector('#hud-deposit-label') as HTMLElement;
  const toast = root.querySelector('#hud-toast') as HTMLElement;
  const hint = root.querySelector('#hud-mine-hint') as HTMLElement;

  let lastStone = 0;
  let toastUntil = 0;

  return {
    render(model, depositScreen) {
      stone.textContent = `Stone: ${model.stoneCount}`;

      // 광맥 잔량 라벨 — 광맥 머리 위 화면 좌표에 붙인다
      if (depositScreen) {
        label.style.display = 'block';
        label.style.left = `${depositScreen.x}px`;
        label.style.top = `${depositScreen.y}px`;
        label.textContent = `돌 ${model.depositRemaining}`;
      } else {
        label.style.display = 'none';
      }

      // 획득 토스트 — Snapshot 의 Stone 증가를 감지해 잠시 표시
      if (model.stoneCount > lastStone) {
        toast.textContent = `+${model.stoneCount - lastStone} Stone 획득!`;
        toastUntil = performance.now() + 1600;
      }
      lastStone = model.stoneCount;
      toast.style.opacity = performance.now() < toastUntil ? '1' : '0';

      if (model.mineAvailable) {
        hint.textContent = '[E] 채굴';
        hint.dataset.state = 'available';
      } else if (model.mineReason === 'out-of-range') {
        // 이동 중 상시 노출은 소음이라 잔잔하게 — 사유는 접근 안내로만
        hint.textContent = reasonText(model.mineReason);
        hint.dataset.state = 'unavailable';
      } else {
        hint.textContent = model.mineReason ? reasonText(model.mineReason) : '';
        hint.dataset.state = 'unavailable';
      }
    },
  };
}
