// 명령 표면 Capability (C009) — 04 commandSurface 를 그리는 능력만 제공한다.
//
// 이 파일은 어떤 명령이 있는지, 무엇이 세계로 가는지 알지 못한다.
// 결정 Layer 가 만든 SceneCommandSurface 의 지시를 그대로 그릴 뿐이다.
//
// 표면의 형태는 05-review.md 의 검토자 지시를 따른다 — **목록 우선 + 타이핑**.
// 열면 걸 수 있는 것 전부가 먼저 보이고, 그 상태에서 타이핑하면 후보가 좁혀진다.
// 아무것도 모르는 사람은 읽고 고르며, 아는 사람은 바로 친다.

import type { SceneCommandSurface } from '../scene/scene-state';

export interface CommandConsole {
  render(surface: SceneCommandSurface): void;
  /** 지금 타이핑을 받고 있는가 — 조립 루트가 이동·시점 입력을 멈출 기준 */
  capturing(): boolean;
}

export interface CommandConsoleHandlers {
  /** 쓰는 내용이 바뀌었다 */
  onText(text: string): void;
  /** 걸었다 (Enter) */
  onSubmit(): void;
  /** 닫았다 (Escape) */
  onClose(): void;
}

export function createCommandConsole(
  container: HTMLElement,
  handlers: CommandConsoleHandlers,
): CommandConsole {
  const root = document.createElement('div');
  root.id = 'command-console';
  root.innerHTML = `
    <div class="cc-list" id="cc-list"></div>
    <div class="cc-guide" id="cc-guide"></div>
    <div class="cc-line">
      <span class="cc-caret">&gt;</span>
      <input class="cc-input" id="cc-input" autocomplete="off" spellcheck="false" />
      <button class="cc-close" id="cc-close" title="닫기" aria-label="닫기">✕</button>
    </div>
    <div class="cc-history" id="cc-history"></div>
  `;
  container.appendChild(root);

  const list = root.querySelector<HTMLElement>('#cc-list')!;
  const guide = root.querySelector<HTMLElement>('#cc-guide')!;
  const history = root.querySelector<HTMLElement>('#cc-history')!;
  const input = root.querySelector<HTMLInputElement>('#cc-input')!;
  const close = root.querySelector<HTMLElement>('#cc-close')!;

  let open = false;

  // 닫는 자리 — Escape 는 자판이 있는 기기에만 있다. 손가락뿐인 기기에서
  // 열기만 되고 닫히지 않으면 그 표면은 갇힌 것이다.
  close.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    handlers.onClose();
  });

  input.addEventListener('input', () => handlers.onText(input.value));
  input.addEventListener('keydown', (ev) => {
    // 여기서 멈추지 않으면 같은 키가 세계로도 나간다.
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      handlers.onSubmit();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      handlers.onClose();
    }
  });

  function escape(text: string): string {
    return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  }

  return {
    capturing: () => open,
    render(surface) {
      if (surface.open !== open) {
        open = surface.open;
        root.classList.toggle('cc-open', open);
        if (open) input.focus();
        else input.blur();
      }
      if (!open) return;

      if (input.value !== surface.composition.text) input.value = surface.composition.text;

      // 목록 — 좁혀진 후보가 있으면 그것만, 없으면 전부. 열면 먼저 보이는 것이 이것이다.
      const shown =
        surface.composition.candidates.length > 0 && surface.composition.text.length > 0
          ? surface.composition.candidates
          : surface.entries;
      list.innerHTML = shown
        .map((entry) => {
          const slots = entry.slots
            .map(
              (slot) =>
                `<span class="cc-slot">${escape(slot.id)}<span class="cc-hint">${escape(
                  slot.hint,
                )}</span>${
                  slot.required
                    ? ''
                    : `<span class="cc-omit">비우면 ${escape(slot.omittedMeaning ?? '없음')}</span>`
                }</span>`,
            )
            .join('');
          const badge = entry.origin === 'world' ? '세계' : '내 화면';
          const state = entry.stateText ? `<span class="cc-state">${escape(entry.stateText)}</span>` : '';
          const blocked = entry.available
            ? ''
            : `<span class="cc-blocked">${escape(entry.unavailableText ?? '지금은 걸 수 없다')}</span>`;
          return `<div class="cc-entry${entry.available ? '' : ' cc-entry-blocked'}">
            <div class="cc-entry-head">
              <span class="cc-origin cc-origin-${entry.origin}">${badge}</span>
              <code class="cc-usage">${escape(entry.usage)}</code>
              ${state}${blocked}
            </div>
            <div class="cc-entry-title">${escape(entry.title)}</div>
            <div class="cc-slots">${slots}</div>
          </div>`;
        })
        .join('');

      // 안내 — 무엇을 더 적어야 하는지, 무엇이 틀렸는지.
      const composition = surface.composition;
      const parts: string[] = [];
      if (composition.nextSlot) {
        parts.push(
          `<span class="cc-next">다음: ${escape(composition.nextSlot.id)} <span class="cc-hint">${escape(
            composition.nextSlot.hint,
          )}</span></span>`,
        );
      }
      if (composition.suggestions.length > 0) {
        parts.push(
          `<span class="cc-suggest">${composition.suggestions
            .slice(0, 12)
            .map((s) => `<code>${escape(s)}</code>`)
            .join(' ')}</span>`,
        );
      }
      if (composition.problem) {
        parts.push(`<span class="cc-problem">${escape(composition.problem)}</span>`);
      }
      guide.innerHTML = parts.join('');

      // 기록 — 늦게 온 것이 아래다.
      history.innerHTML = surface.history
        .slice(-8)
        .map(
          (line) =>
            `<div class="cc-hline${
              line.accepted === undefined ? '' : line.accepted ? ' cc-ok' : ' cc-no'
            }"><code>${escape(line.text)}</code><span>${escape(line.answer ?? '…')}</span></div>`,
        )
        .join('');
    },
  };
}
