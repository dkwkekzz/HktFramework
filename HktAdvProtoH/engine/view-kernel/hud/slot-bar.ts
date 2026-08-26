// Slot Bar Capability (범용) — 화면 아래에 늘 서 있는 칸 띠를 그리는 능력만 제공한다.
//
// 이 파일은 칸이 무엇인지 알지 못한다. 기술인지 물건인지 명령인지 묻지 않고,
// 결정 Layer 가 만든 SceneSlotBar 의 지시를 그대로 그린다 (설계 반전 ⑤).
//
// 겹쳐 뜨는 표면(hud/surface.ts)과 **다른 원소**다. 그쪽은 열고 닫으며 자판을
// 붙잡지만, 이쪽은 늘 서 있고 자판을 잡지 않는다 — 붙잡으면 몸이 움직이지 않는다.
//
// 이 능력이 소유하는 것:
//   · 칸을 나란히 그리는 일과 그 자리(화면 아래 가운데)
//   · 부르는 자리 표기 · 이름 · 값 한 줄 · 지금 어떤가를 **각각 다른 자리**에 두는 일
//   · 되는 것과 안 되는 것과 기다리는 것을 **색만이 아니라 테두리로도** 가르는 일
//   · 눌리면 그 칸의 id 를 돌려주는 일 (무슨 뜻인지는 조립이 정한다)
//
// 이 능력이 소유하지 않는 것:
//   · 칸이 왜 안 되는가 (state 로 실려 온다 — 세계가 판정한 것이다)
//   · 어떤 키가 그 칸을 부르는가 (key 는 이미 형식화된 글자다)
//   · 칸의 순서 (결정 Layer 가 정한 순서 그대로 그린다)
//   · **사람이 읽을 말** — 부를 수 없다는 말도, 부르는 자리를 무엇이라 이르는지도
//     짓지 않는다. 코드로 부르고 팩의 문구 표가 말을 준다 (문구 반전 ⑤)

import { RAW_CODE, type CodeTextFn } from '../presentation/code-text';
import type { SceneSlotBar } from '../scene/scene-state';

/** 이 능력이 부르는 문구 코드 전부 — 팩이 덮지 못한 것을 검사가 잡는다 */
export const SLOT_BAR_TEXT_CODES = ['slot.key', 'slot.no-key'] as const;

export interface SlotBarLayer {
  render(bars: readonly SceneSlotBar[]): void;
}

export interface SlotBarHandlers {
  /** 칸이 눌렸다 — 그 칸의 id. 무엇을 할지는 조립이 정한다 */
  onPress(cellId: string): void;
}

function escape(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

/**
 * 띠 하나의 표시 지시를 글자로 옮긴다 — **DOM 을 건드리지 않는 순수 함수**다.
 *
 * 떼어 둔 이유는 검사할 수 있게 하기 위해서다. 안 되는 칸이 사라지지 않는가,
 * 부를 수 없는 칸도 그려지는가, 접근성 이름에 이름·자리·상태가 함께 들어가는가 —
 * 전부 브라우저 없이 확인해야 하는 성질이다.
 */
export function slotBarMarkup(bar: SceneSlotBar, textOf: CodeTextFn = RAW_CODE): string {
  return bar.cells
    .map((cell) => {
      // 접근성 이름 — 이름 · 부르는 자리 · 지금 어떤가를 한 줄로.
      // **부를 수 없는 칸도 이름을 가진다** (있다는 사실이 관찰이다).
      // 자리 표기(`cell.key`)는 이미 형식화된 글자이고, 그것을 무엇이라 이르는지는
      // 팩의 문구 표가 정한다 — 기반은 표기를 값으로 넘길 뿐이다.
      const spoken = [
        cell.title,
        cell.key ? textOf('slot.key', cell.key) : textOf('slot.no-key'),
        cell.status,
      ]
        .filter((part): part is string => Boolean(part))
        .join(', ');
      return (
        `<button type="button" class="sb-cell" data-cell="${escape(cell.id)}"` +
        ` data-state="${escape(cell.state)}"` +
        ` aria-label="${escape(spoken)}">` +
        `<span class="sb-key">${cell.key ? escape(cell.key) : ''}</span>` +
        `<span class="sb-title">${escape(cell.title)}</span>` +
        (cell.detail ? `<span class="sb-detail">${escape(cell.detail)}</span>` : '') +
        (cell.status ? `<span class="sb-status">${escape(cell.status)}</span>` : '') +
        `</button>`
      );
    })
    .join('');
}

export function createSlotBarLayer(
  container: HTMLElement,
  handlers: SlotBarHandlers,
  textOf: CodeTextFn = RAW_CODE,
): SlotBarLayer {
  const root = document.createElement('div');
  root.id = 'slotbars';
  container.appendChild(root);

  root.addEventListener('pointerdown', (ev) => {
    const target = ev.target as HTMLElement | null;
    const cell = target?.closest<HTMLElement>('.sb-cell');
    if (!cell) return;
    // 띠를 누른 것은 세계를 짚은 것이 아니다 — 뒤의 지면으로 흘려보내지 않는다
    ev.preventDefault();
    ev.stopPropagation();
    const id = cell.dataset.cell;
    if (id) handlers.onPress(id);
  });

  // 프레임마다 innerHTML 을 갈아 끼우지 않기 위해 마지막으로 그린 것을 기억한다
  const drawn = new Map<string, { node: HTMLElement; html: string }>();

  return {
    render(bars) {
      const alive = new Set(bars.map((bar) => bar.id));
      for (const [id, entry] of drawn) {
        if (alive.has(id)) continue;
        entry.node.remove();
        drawn.delete(id);
      }

      for (const bar of bars) {
        const html = slotBarMarkup(bar, textOf);
        let entry = drawn.get(bar.id);
        if (!entry) {
          const node = document.createElement('div');
          node.className = 'sb-bar';
          node.dataset.bar = bar.id;
          root.appendChild(node);
          entry = { node, html: '' };
          drawn.set(bar.id, entry);
        }
        // 칸이 하나도 없으면 자리를 비운다 — 빈 띠가 떠 있으면 그것이 거짓말이다
        entry.node.hidden = bar.cells.length === 0;
        if (entry.html === html) continue;
        entry.node.innerHTML = html;
        entry.html = html;
      }
    },
  };
}
