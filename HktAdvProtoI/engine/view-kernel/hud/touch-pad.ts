// 손가락 조작 자리 (HUD) — 키로만 닿던 것들에 누를 자리를 낸다.
//
// 이 자리는 세계에 아무것도 새로 요청하지 않는다. 버튼이 내놓는 것은
// **그 행동에 이미 배정된 키 코드**(KeyboardEvent.code)이며, 조립 루트는 그것을
// 키보드에서 온 것과 구분하지 않고 같은 길로 흘려보낸다 (app/main.ts).
// 덕분에 손가락으로 한 것과 키로 한 것이 갈라질 수 없다.
//
// 무엇을 걸 수 있는지는 View 가 지어내지 않는다 — 지금 화면에 와 있는 상호작용
// (scene.interactions) 을 그대로 버튼으로 편다. 세계가 하나를 더 보내면 버튼도
// 하나 더 생긴다. 관찰자 쪽에서 끝나는 것(관찰 토글·명령 열기)만 여기 고정돼 있으며,
// 이는 hud.ts 의 키 안내가 이미 그렇게 하고 있는 것과 같다.

import type { SceneInteraction, SceneState } from '../scene/scene-state';
import { engineKeyCode, engineKeyTextCode, type EngineKeyId } from '../input/engine-keys';
import { RAW_CODE, type CodeTextFn } from '../presentation/code-text';
import type { StickView } from '../input/touch';

/**
 * 관찰자 쪽에서 끝나는 것들 — 세계로 나가지 않는다 (C006 · C007 R2 · C009).
 *
 * 코드도 이름도 **원본에서 온다** (`input/engine-keys.ts`) — 여기 손으로 적어 두면
 * 기반이 자리를 옮겨도 이 버튼만 옛 키를 계속 내놓는다. 이름은 이제 문구 코드이며,
 * 무슨 말이 되는지는 팩의 표가 정한다 (문구 반전 ⑤). 그래서 이 버튼에 적히는 말과
 * 조작 안내 줄에 서는 말은 **같은 한 자리**에서 온다.
 */
const OBSERVER_BUTTONS: readonly EngineKeyId[] = ['command', 'colliderObserve', 'attributeInspect'];

export interface TouchPad {
  /** visible 이 false 면 자리를 차지하지 않는다 — 손가락이 닿기 전에는 보이지 않는다 */
  render(scene: SceneState, stick: StickView, visible: boolean): void;
  /** 이번 프레임에 눌린 키 코드들을 한 번만 돌려준다 (keyboard.consumeKeyPresses 와 같은 모양) */
  consumePresses(): string[];
}

/** 버튼으로 펼 상호작용 — 키가 배정돼 있고 이름이 있는 것. 지형 지목은 탭이므로 뺀다. */
function buttonInteractions(scene: SceneState): SceneInteraction[] {
  return scene.interactions.filter((i) => i.key && i.prompt && !i.terrainTarget);
}

/** 행동 버튼 하나의 표시 지시 — 이 능력은 그것이 무슨 행동인지 모른다 */
export interface TouchActionView {
  code: string; // 이 버튼이 내놓는 키 코드
  label: string; // 버튼 이름 (이미 형식화된 문구)
  available: boolean;
  /** 안 되는 사유 — 세계가 판정하고 결정 Layer 가 형식화한 문구를 그대로 비춘다.
   *  되는 버튼에는 없다. 자판 사용자는 자기 패널에서 같은 사유를 읽지만,
   *  손가락 사용자에게는 이 버튼이 그 사유가 닿는 유일한 자리다. */
  reason?: string;
}

/**
 * 화면 상태를 행동 버튼 지시로 옮긴다 — **DOM 을 건드리지 않는 순수 함수**다.
 * 안 되는 버튼이 사라지지 않는가, 사유가 안 되는 버튼에만 붙는가를 브라우저 없이 검사한다.
 */
export function touchActionViews(scene: SceneState): TouchActionView[] {
  return buttonInteractions(scene).map((i) => ({
    code: i.key as string,
    label: i.prompt ?? '',
    available: i.available,
    ...(i.available || !i.unavailableText ? {} : { reason: i.unavailableText }),
  }));
}

export function createTouchPad(container: HTMLElement, textOf: CodeTextFn = RAW_CODE): TouchPad {
  const root = document.createElement('div');
  root.id = 'touchpad';
  root.innerHTML = `
    <div class="tp-stick" id="tp-stick"><i></i></div>
    <div class="tp-observer" id="tp-observer"></div>
    <div class="tp-actions" id="tp-actions"></div>
  `;
  container.appendChild(root);

  const stickEl = root.querySelector('#tp-stick') as HTMLElement;
  const knobEl = stickEl.querySelector('i') as HTMLElement;
  const observerEl = root.querySelector('#tp-observer') as HTMLElement;
  const actionsEl = root.querySelector('#tp-actions') as HTMLElement;

  let presses: string[] = [];
  // 버튼 자리는 매 프레임 다시 만들지 않는다 — 누르는 도중에 자리가 갈리면 안 된다.
  let actionSignature = '';

  // 눌림은 pointerdown 에서 받는다. click 을 기다리면 손가락에서 한 박자 늦다.
  const press = (el: HTMLElement, code: string): void => {
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // 화면 손짓(시점·지목)으로 새어 나가지 않는다
      presses.push(code);
      el.dataset.pressed = 'true';
    });
    const clear = (): void => {
      delete el.dataset.pressed;
    };
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('pointerleave', clear);
  };

  for (const id of OBSERVER_BUTTONS) {
    const el = document.createElement('button');
    el.className = 'tp-button tp-button-observer';
    el.textContent = textOf(engineKeyTextCode(id));
    press(el, engineKeyCode(id));
    observerEl.appendChild(el);
  }

  return {
    render(scene, stick, visible) {
      root.dataset.visible = String(visible);
      if (!visible) return;

      stickEl.dataset.active = String(stick.active);
      if (stick.active) {
        stickEl.style.left = `${stick.originX}px`;
        stickEl.style.top = `${stick.originY}px`;
        knobEl.style.transform = `translate(${stick.knobX - stick.originX}px, ${stick.knobY - stick.originY}px)`;
      }

      const views = touchActionViews(scene);
      const signature = views.map((v) => `${v.code}:${v.label}`).join('|');
      if (signature !== actionSignature) {
        actionSignature = signature;
        actionsEl.replaceChildren();
        for (const view of views) {
          const el = document.createElement('button');
          el.className = 'tp-button tp-button-action';
          const label = document.createElement('span');
          label.className = 'tp-label';
          label.textContent = view.label;
          const reason = document.createElement('span');
          reason.className = 'tp-reason';
          el.append(label, reason);
          press(el, view.code);
          actionsEl.appendChild(el);
        }
      }

      // 지금 되는지 안 되는지는 세계가 정한다 — 그 판정을 흐림과 사유 문구로 비춘다.
      // 눌리지 않게 막지는 않는다. 키를 누를 때와 같이, 안 되는 것을 눌러도
      // 세계가 사유를 붙여 거절한다 (C009).
      const children = actionsEl.children;
      for (let index = 0; index < children.length; index += 1) {
        const el = children[index] as HTMLElement;
        const view = views[index];
        el.dataset.available = String(view?.available ?? false);
        const reasonEl = el.querySelector<HTMLElement>('.tp-reason');
        const reason = view?.reason ?? '';
        if (reasonEl && reasonEl.textContent !== reason) reasonEl.textContent = reason;
      }
    },
    consumePresses() {
      const was = presses;
      presses = [];
      return was;
    },
  };
}
