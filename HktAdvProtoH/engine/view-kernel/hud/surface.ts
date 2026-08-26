// Surface Capability (범용) — 겹쳐 뜨는 표면을 그리는 능력만 제공한다.
//
// 이 파일은 무엇의 목록인지, 칸이 무엇을 담는지, 줄이 무슨 행동인지 알지 못한다.
// 결정 Layer 가 만든 SceneSurface 의 지시를 그대로 그릴 뿐이다
// (설계 반전 ⑤: capability 는 엔진, 표·문구·바인딩은 팩).
//
// 이 능력이 소유하는 것:
//   · 열림과 닫힘, 그리고 여러 개가 겹쳤을 때 **위의 것부터** 닫히는 순서
//   · 자판을 잡고 있는가 (capturing) — 조립 루트가 이동·시점 입력을 멈출 기준
//   · Escape 로 닫는 길, 그리고 손가락뿐인 기기를 위한 닫는 자리
//   · 초점 링을 고른 것과 **다르게** 그리는 일
//   · **눌리면 그 칸·줄의 id 를 돌려주는 일** — 한 번 누름 · 두 번 누름 · 목록 청함이
//     서로 다른 소식이다. 무슨 뜻인지는 결정 Layer 가 정한다 (슬롯 띠와 같은 규칙)
//   · **글자를 받아 그대로 돌려주는 일** (SceneSurfaceField) — 그 글자가 무엇을 하는지
//     알지 못한다. 쥐고 있지도 않는다: 실려 온 것을 비추고, 쳐 넣은 것을 돌려준다
//
// 이 능력이 소유하지 않는 것:
//   · 무엇이 고른 것인가 (cell.selected 로 실려 온다 — 결정 Layer 가 쥔다)
//   · 초점이 지금 어디인가 (surface.focusId 로 실려 온다 — 옮기는 산수는 input/focus.ts)
//   · 되는지 안 되는지 (row.state 로 실려 온다 — 세계가 판정한 것이다)

import type { SceneSurface, SceneSurfaceSection } from '../scene/scene-state';

export interface SurfaceLayer {
  render(surfaces: readonly SceneSurface[]): void;
  /** 지금 자판을 잡고 있는가 — 하나라도 열려 있으면 참 */
  capturing(): boolean;
}

export interface SurfaceHandlers {
  /** 닫혔다 — 어느 표면인지 알려 준다. 실제로 닫는 것은 결정 Layer 다 */
  onClose(surfaceId: string): void;
  /**
   * 칸이 한 번 눌렸다. **고르기라고 부르지 않는다** — 무엇이 고르기인지는 결정
   * Layer 의 뜻이고, 이 능력이 아는 것은 "이 칸이 눌렸다" 뿐이다.
   */
  onPickCell?(surfaceId: string, cellId: string): void;
  /** 칸이 두 번 눌렸다 — 한 번 누름도 함께 온다 (누름이 먼저, 두 번이 나중) */
  onCommitCell?(surfaceId: string, cellId: string): void;
  /** 칸에서 목록을 청했다 (오른 단추) — 브라우저의 기본 목록은 뜨지 않는다 */
  onMenuCell?(surfaceId: string, cellId: string): void;
  /** 줄이 눌렸다 — 되는 줄인지 안 되는 줄인지는 묻지 않는다 (state 는 실려 온 것이다) */
  onPressRow?(surfaceId: string, rowId: string): void;
  /**
   * 글자 받는 자리에 무언가 쳐 넣었다 — **그 글자를 그대로 돌려준다.**
   *
   * 그리는 쪽은 이 글자를 쥐지 않는다. 결정 Layer 가 받아 자기 상태로 삼고, 다음
   * 프레임의 `field.text` 로 되돌아온다. 그래서 화면에 있는 글자와 판단에 쓰인 글자가
   * 갈라질 자리가 없다.
   */
  onFieldInput?(surfaceId: string, fieldId: string, text: string): void;
}

function escape(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

function renderSection(section: SceneSurfaceSection, focusId: string | undefined): string {
  const title = section.title ? `<div class="sf-section-title">${escape(section.title)}</div>` : '';

  // 글자를 받는 자리 — 제목 아래, 칸·줄 위. **글자는 실려 온 것을 비출 뿐이다.**
  const field = section.field;
  const head =
    title +
    (field
      ? `<input type="text" class="sf-field" data-id="${escape(field.id)}"` +
        ` value="${escape(field.text)}"` +
        (field.placeholder ? ` placeholder="${escape(field.placeholder)}"` : '') +
        ` aria-label="${escape(field.label)}"` +
        ` data-claim-focus="${field.claimFocus === true}"` +
        ` autocomplete="off" spellcheck="false" />`
      : '');

  // 칸들 — **빈 칸도 그린다.** 남은 자리가 자리로 읽히는 것이 이 원소의 값어치다.
  if (section.cells) {
    if (section.cells.length === 0 && section.emptyText) {
      return `<div class="sf-section">${head}<div class="sf-empty">${escape(section.emptyText)}</div></div>`;
    }
    const columns = section.columns && section.columns > 0 ? section.columns : 6;
    const shape = section.shape ?? 'slot';
    const cells = section.cells
      .map((cell) => {
        // 접근성 이름 — 이름과 곁글자를 한 줄로. **빈 자리도 이름을 가진다**
        const label = cell.empty
          ? cell.text || '빈 자리'
          : [cell.text, cell.detail].filter(Boolean).join(', ');
        return (
          `<button type="button" class="sf-cell" data-id="${escape(cell.id)}"` +
          ` data-empty="${cell.empty}" data-selected="${cell.selected}"` +
          ` data-focused="${cell.id === focusId}"` +
          ` aria-label="${escape(label)}" aria-pressed="${cell.selected}">` +
          `<span class="sf-cell-text">${escape(cell.text)}</span>` +
          (cell.detail ? `<span class="sf-cell-detail">${escape(cell.detail)}</span>` : '') +
          `</button>`
        );
      })
      .join('');
    return (
      `<div class="sf-section">${head}` +
      `<div class="sf-cells" data-shape="${shape}" style="--sf-columns:${columns}"` +
      ` role="group">${cells}</div></div>`
    );
  }

  // 줄들 — 되는 것도 안 되는 것도 여기 선다. 안 되는 것이 목록에서 빠지지 않는다
  const rows = section.rows ?? [];
  if (rows.length === 0 && section.emptyText) {
    return `<div class="sf-section">${head}<div class="sf-empty">${escape(section.emptyText)}</div></div>`;
  }
  const body = rows
    .map((row) => {
      // 상태를 색 하나로 전하지 않는다 — 표식 글자를 함께 둔다
      const badge =
        row.state === 'blocked'
          ? '✗'
          : row.state === 'pending'
            ? '…'
            : row.state === 'available'
              ? '✓'
              : '';
      // 소리로 읽는 사람에게 표식은 글자가 아니다 — 상태를 말로도 둔다
      const spokenState =
        row.state === 'blocked'
          ? '불가'
          : row.state === 'pending'
            ? '기다리는 중'
            : row.state === 'available'
              ? '가능'
              : '';
      const spoken = [row.text, row.hint, spokenState].filter(Boolean).join(', ');
      // **줄도 단추다.** div 였던 동안 이 자리는 손가락으로 닿지 않았고 자판 초점도
      // 받지 못했다 — 되는 것을 눌러 실행하는 길이 자판에만 있었다는 뜻이다.
      // 안 되는 줄도 단추로 둔다 (disabled 로 만들지 않는다): 사유를 읽는 것이
      // 그 자리의 값어치이고, 읽으려면 초점이 닿아야 한다.
      return (
        `<button type="button" class="sf-row" data-id="${escape(row.id)}"` +
        (row.state ? ` data-state="${row.state}"` : '') +
        ` data-focused="${row.id === focusId}"` +
        (row.state === 'blocked' ? ' aria-disabled="true"' : '') +
        ` aria-label="${escape(spoken)}">` +
        (badge ? `<span class="sf-row-badge">${badge}</span>` : '') +
        `<span class="sf-row-text">${escape(row.text)}</span>` +
        (row.hint ? `<span class="sf-row-hint">${escape(row.hint)}</span>` : '') +
        `</button>`
      );
    })
    .join('');
  return `<div class="sf-section">${head}<div class="sf-rows">${body}</div></div>`;
}

/**
 * 표면 하나의 표시 지시를 글자로 옮긴다 — **DOM 을 건드리지 않는 순수 함수**다.
 *
 * 그리는 일에서 이 부분만 떼어 둔 이유는 검사할 수 있게 하기 위해서다.
 * 빈 칸이 그려지는가, 안 되는 줄이 사라지지 않는가, 초점과 고른 것이 다른 자리에
 * 표시되는가 — 전부 브라우저 없이 확인할 수 있어야 하는 성질이다.
 */
export function surfaceMarkup(surface: SceneSurface): string {
  return (
    `<header class="sf-head"><h2 class="sf-title">${escape(surface.title)}</h2>` +
    `<button type="button" class="sf-close" data-surface="${escape(surface.id)}"` +
    ` title="닫기" aria-label="닫기">✕</button></header>` +
    `<div class="sf-body">${surface.sections
      .map((section) => renderSection(section, surface.focusId))
      .join('')}</div>` +
    (surface.footer.length > 0
      ? `<footer class="sf-foot">${surface.footer
          .map((line) => `<span>${escape(line)}</span>`)
          .join('')}</footer>`
      : '')
  );
}

export function createSurfaceLayer(container: HTMLElement, handlers: SurfaceHandlers): SurfaceLayer {
  const root = document.createElement('div');
  root.id = 'surfaces';
  container.appendChild(root);

  // 지금 열려 있는 것들 — 뒤가 위다. Escape 는 위의 것부터 닫는다
  let openIds: string[] = [];
  // 프레임마다 innerHTML 을 갈아 끼우지 않기 위해 마지막으로 그린 것을 기억한다
  const drawn = new Map<string, { node: HTMLElement; html: string }>();

  window.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Escape' || openIds.length === 0) return;
      // 글자를 쓰고 있는 자리의 Escape 는 그 자리의 것이다 — 붙잡는 단계에서 받으므로
      // 여기서 비켜 주지 않으면 다른 표면의 Escape 를 이쪽이 가로챈다.
      const target = ev.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      ev.preventDefault();
      ev.stopPropagation();
      handlers.onClose(openIds[openIds.length - 1]!);
    },
    // 붙잡는 단계에서 받는다 — 다른 처리가 먼저 삼키지 않게
    true,
  );

  /** 이 자리가 어느 표면의 것인가 — 표면 마디가 자기 id 를 지닌다 */
  function surfaceOf(target: HTMLElement | null): string | undefined {
    return target?.closest<HTMLElement>('.sf')?.dataset.surface;
  }

  // 쳐 넣은 글자를 그대로 돌려준다 — 쥐지 않는다.
  root.addEventListener('input', (ev) => {
    const target = ev.target as HTMLElement | null;
    const field = target?.closest<HTMLInputElement>('.sf-field');
    const surfaceId = surfaceOf(target);
    if (!field || field.dataset.id === undefined || !surfaceId) return;
    handlers.onFieldInput?.(surfaceId, field.dataset.id, field.value);
  });

  // 글자를 쓰는 동안 그 키는 **그 자리의 것이다.** 여기서 멈추지 않으면 같은 키가
  // 세계로도 나가, 이름을 치는 동안 몸이 움직이거나 표면의 규칙이 함께 불린다.
  // Escape 만은 흘려보낸다 — 닫는 길은 붙잡는 단계가 이미 지니고 있고
  // (위 keydown), 그것마저 막으면 자판으로 이 자리를 빠져나갈 수 없다.
  root.addEventListener('keydown', (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target?.closest('.sf-field')) return;
    if (ev.key === 'Escape') return;
    ev.stopPropagation();
  });

  // 닫는 자리 — Escape 는 자판이 있는 기기에만 있다. 손가락뿐인 기기에서 열기만 되고
  // 닫히지 않으면 그 표면은 갇힌 것이다 (명령 콘솔이 같은 이유로 같은 자리를 둔다).
  //
  // 같은 자리에서 칸과 줄의 눌림도 받는다. **무슨 뜻인지는 묻지 않는다** — 눌린
  // 것의 id 를 그대로 돌려줄 뿐이다 (슬롯 띠의 onPress 와 같은 규칙).
  root.addEventListener('pointerdown', (ev) => {
    const target = ev.target as HTMLElement | null;
    const close = target?.closest<HTMLElement>('.sf-close');
    if (close) {
      ev.preventDefault();
      ev.stopPropagation();
      const id = close.dataset.surface;
      if (id) handlers.onClose(id);
      return;
    }
    const surfaceId = surfaceOf(target);
    if (!surfaceId) return;
    // **누른 것으로 치는 것은 주 단추뿐이다.** 오른 단추는 목록을 청하는 손짓이고
    // (아래 contextmenu) 가운데 단추는 이 표면의 손짓이 아니다 — 그것들까지 누름으로
    // 세면 오른 단추 한 번이 줄을 **실행해 버린다**.
    // 자리는 그래도 표면의 것이다: 어느 단추든 뒤의 세계로 흘려보내지 않는다
    // (흘리면 오른 단추 끌기가 표면 위에서 시점을 돌린다).
    const primary = ev.button === 0;
    const cell = target?.closest<HTMLElement>('.sf-cell');
    if (cell?.dataset.id !== undefined) {
      ev.stopPropagation();
      if (primary) handlers.onPickCell?.(surfaceId, cell.dataset.id);
      return;
    }
    const row = target?.closest<HTMLElement>('.sf-row');
    if (row?.dataset.id !== undefined) {
      ev.stopPropagation();
      if (primary) handlers.onPressRow?.(surfaceId, row.dataset.id);
    }
  });

  // 두 번 누름 — 한 번 누름 둘이 먼저 가고 이것이 뒤따른다. 같은 칸을 두 번 고르는
  // 것은 아무것도 바꾸지 않으므로 그 앞선 소식이 해를 끼치지 않는다.
  root.addEventListener('dblclick', (ev) => {
    const target = ev.target as HTMLElement | null;
    const surfaceId = surfaceOf(target);
    const cell = target?.closest<HTMLElement>('.sf-cell');
    if (!surfaceId || cell?.dataset.id === undefined) return;
    ev.preventDefault();
    handlers.onCommitCell?.(surfaceId, cell.dataset.id);
  });

  // 목록 청함 — 브라우저의 기본 목록을 대신한다. 막지 않으면 게임 화면 위에
  // 브라우저 메뉴가 뜨고, 그 순간 이 표면은 사라진 것처럼 보인다.
  //
  // **표면 위라면 어디서든 막는다** — 칸이 아닌 자리에서만 브라우저 목록이 뜨면
  // 같은 판 안에서 오른 단추가 두 가지 뜻이 된다. 게임의 다른 자리도 이미 같다
  // (engine/view-kernel/input/pointer.ts · fx 캔버스).
  root.addEventListener('contextmenu', (ev) => {
    const target = ev.target as HTMLElement | null;
    const surfaceId = surfaceOf(target);
    if (!surfaceId) return;
    ev.preventDefault();
    const cell = target?.closest<HTMLElement>('.sf-cell');
    if (cell?.dataset.id !== undefined) handlers.onMenuCell?.(surfaceId, cell.dataset.id);
  });

  return {
    capturing: () => openIds.length > 0,

    render(surfaces) {
      const seen = new Set<string>();
      const nowOpen: string[] = [];

      for (const surface of surfaces) {
        seen.add(surface.id);
        let entry = drawn.get(surface.id);
        if (!entry) {
          const node = document.createElement('section');
          node.className = 'sf';
          // 눌린 자리가 어느 표면의 것인지 되읽는 열쇠 — 닫는 단추만 알던 것을
          // 마디 자신이 지닌다
          node.dataset.surface = surface.id;
          root.appendChild(node);
          entry = { node, html: '' };
          drawn.set(surface.id, entry);
        }

        entry.node.classList.toggle('sf-open', surface.open);
        entry.node.setAttribute('aria-hidden', String(!surface.open));
        if (!surface.open) continue;
        nowOpen.push(surface.id);

        const html = surfaceMarkup(surface);

        // 값이 그대로면 DOM 을 건드리지 않는다 — 프레임마다 글자를 다시 래스터화하지 않게
        if (entry.html !== html) {
          // 글자를 쓰는 중이었다면 **어디까지 썼는지**를 붙들었다 놓아 준다.
          // 이 표면은 통째로 다시 그려지므로(innerHTML), 붙들지 않으면 한 글자를 칠
          // 때마다 초점이 튀어나가고 커서가 맨 앞으로 간다 — 두 글자를 이어 칠 수 없다.
          const active = document.activeElement as HTMLInputElement | null;
          const typing =
            active?.classList.contains('sf-field') && entry.node.contains(active)
              ? { id: active.dataset.id, at: active.selectionStart }
              : null;

          entry.node.innerHTML = html;
          entry.html = html;

          if (typing?.id !== undefined) {
            const again = entry.node.querySelector<HTMLInputElement>(
              `.sf-field[data-id="${CSS.escape(typing.id)}"]`,
            );
            if (again) {
              again.focus();
              const at = typing.at ?? again.value.length;
              again.setSelectionRange(at, at);
            }
          }

          // 결정 Layer 가 캐럿을 청했으면 그리로 옮긴다 — 자판만 쓰는 사람이 이 자리에
          // 닿는 유일한 길이다 (Tab 은 화면의 다른 단추들을 먼저 지난다).
          const claimed = entry.node.querySelector<HTMLInputElement>(
            '.sf-field[data-claim-focus="true"]',
          );
          if (claimed && document.activeElement !== claimed) {
            claimed.focus();
            claimed.setSelectionRange(claimed.value.length, claimed.value.length);
          }
        }
      }

      // 지시에서 사라진 표면은 함께 사라진다
      for (const [id, entry] of drawn) {
        if (seen.has(id)) continue;
        entry.node.remove();
        drawn.delete(id);
      }

      openIds = nowOpen;
    },
  };
}
