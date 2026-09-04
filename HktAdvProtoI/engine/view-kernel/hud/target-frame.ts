// 늘 떠 있는 판 (범용 capability) — 화면 중앙 상단에 서는 판 하나를 그리는 능력만 제공한다.
//
// 이 파일은 판이 **무엇에 대한** 판인지 알지 못한다. 지목한 자리인지 몸인지 내 발밑인지
// 묻지 않고, 결정 Layer 가 만든 SceneTargetFrame 의 지시를 그대로 그린다 (설계 반전 ⑤).
//
// SceneSlotBar(hud/slot-bar.ts)의 **형제**다 — 늘 서 있고 자판을 잡지 않는다.
// 겹쳐 뜨는 표면(hud/surface.ts)과는 다른 원소다: 그쪽은 열리면 자판을 붙잡지만,
// 이쪽이 붙잡으면 판이 떠 있는 동안 몸이 움직이지 않는다.
//
// 이 능력이 소유하는 것:
//   · 제목 · 곁제목 · 줄들을 나란히 그리는 일과 그 자리(화면 위 가운데)
//   · 이름과 값을 **각각 다른 자리**에 두는 일
//   · 값에 딸린 막대를 그리는 일 (막대는 곁들이는 표시이고, 같은 값이 언제나 글자로도 선다)
//   · 값이 없는 줄을 **자리를 차지한 채** 남기는 일 — 없는 줄과 다르다
//
// 이 능력이 소유하지 않는 것:
//   · 무엇을 어떤 순서로 적는가 (결정 Layer 가 정한 순서 그대로 그린다)
//   · 왜 그 줄이 옅은가 (muted 로 실려 온다)
//   · **사람이 읽을 말** — 제목도 이름도 값도 전부 형식화가 끝나 실려 온다.
//     문구 표를 부르지 않는다 (문구 반전 ⑤)
//   · 자판 — tabindex 도 키 이벤트도 초점도 없다. 눌러도 아무 일이 없고,
//     누름은 판을 지나 세계로 간다 (pointer-events: none)

import type { SceneTargetFrame } from '../scene/scene-state';

export interface TargetFrameLayer {
  /** 지시가 없으면 판 자체가 없다 */
  render(frame: SceneTargetFrame | undefined): void;
}

function escape(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

/**
 * 판 하나의 표시 지시를 글자로 옮긴다 — **DOM 을 건드리지 않는 순수 함수**다.
 *
 * 떼어 둔 이유는 slot-bar 와 같다: 값이 없는 줄이 사라지지 않는가, 막대가 있어도 값 글자가
 * 함께 서는가, 준 순서가 그대로 지켜지는가 — 전부 브라우저 없이 확인해야 하는 성질이다.
 */
export function targetFrameMarkup(frame: SceneTargetFrame): string {
  const rows = frame.rows
    .map((row) => {
      // 막대는 **곁들이는 표시**다. 같은 값이 언제나 글자로도 서 있어야 하므로
      // (SceneSurfaceCell.level 과 같은 규율) 막대는 읽어 주는 장치에서 감춘다.
      const ratio = row.progress === undefined ? null : Math.max(0, Math.min(1, row.progress));
      const bar =
        ratio === null
          ? ''
          : `<span class="tf-bar" aria-hidden="true">` +
            `<span class="tf-bar-fill" style="width:${(ratio * 100).toFixed(1)}%"></span></span>`;
      return (
        `<div class="tf-row" data-row="${escape(row.id)}"` +
        (row.muted ? ` data-muted="true"` : '') +
        `>` +
        `<span class="tf-label">${escape(row.label)}</span>` +
        // 값이 비어 있어도 자리는 남는다 — 없는 줄과 비어 있는 줄은 다른 것이다
        `<span class="tf-value">${escape(row.value)}</span>` +
        bar +
        `</div>`
      );
    })
    .join('');

  return (
    `<div class="tf-panel" role="group" aria-label="${escape(frame.title)}">` +
    `<div class="tf-title">${escape(frame.title)}</div>` +
    (frame.subtitle ? `<div class="tf-subtitle">${escape(frame.subtitle)}</div>` : '') +
    (rows ? `<div class="tf-rows">${rows}</div>` : '') +
    `</div>`
  );
}

/**
 * 판의 모양 — 이 능력이 혼자 서기 위해 자기 규칙을 한 번만 얹는다.
 *
 * 화면 위 가운데에 서고, 누름을 가로막지 않으며(pointer-events: none), 초점을 받을 수
 * 있는 원소를 하나도 두지 않는다. 색과 크기는 슬롯 띠와 같은 계열이며,
 * 다른 HUD 능력과 마찬가지로 그 규칙은 index.html 에 있다 (`#targetframe` · `.tf-*`).
 */
export function createTargetFrame(container: HTMLElement): TargetFrameLayer {
  const root = document.createElement('div');
  root.id = 'targetframe';
  root.hidden = true;
  container.appendChild(root);

  // 프레임마다 innerHTML 을 갈아 끼우지 않기 위해 마지막으로 그린 것을 기억한다 (슬롯 띠와 같은 관용구)
  let drawn = '';

  return {
    render(frame) {
      // 지시가 없으면 판 자체가 없다 — 빈 판이 떠 있으면 그것이 거짓말이다
      if (!frame) {
        root.hidden = true;
        if (drawn !== '') {
          root.innerHTML = '';
          drawn = '';
        }
        return;
      }
      const html = targetFrameMarkup(frame);
      root.hidden = false;
      if (html === drawn) return;
      root.innerHTML = html;
      drawn = html;
    },
  };
}
