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
//   · 칸이 **얼마나 찼는지**(level)를 명암으로, **표식**(badge)을 귀퉁이 글자로 옮기는 일 —
//     무엇의 양인지도 무슨 표식인지도 알지 못한다
//   · **곁말**(tip)을 여는 일 — 손을 얹었을 때와 **초점이 닿았을 때 똑같이** 열고,
//     Escape 로 닫는다. 곁말의 Escape 는 표면의 Escape 보다 먼저다: 읽던 것을 닫자고
//     누른 손이 표면째 닫아 버리면 그 자리로 돌아오는 길이 사라진다
//   · **자판이 표면 안을 다니는 길** — 잡아 둔 자판이 갈 곳을 주는 일이다
//     (판단은 `surface-focus.ts`, 여기서는 마디를 만진다)
//       Tab 은 표면 안에서 감긴다 — 뒤의 페이지로 새어 나가지 않는다
//       Tab 자리는 무리마다 하나다 — 무리 안을 걷는 것은 방향키의 일이다
//       실려 온 초점(`focusId`)이 곧 브라우저의 초점이다 — 링과 캐럿이 갈라지지 않는다
//       글자 자리의 Escape 는 그 자리에서 나온다 — 표면은 열린 채다
//       열기 전에 초점이 있던 자리는 닫힐 때 되돌려 준다
//
// 이 능력이 소유하지 않는 것:
//   · 무엇이 고른 것인가 (cell.selected 로 실려 온다 — 결정 Layer 가 쥔다)
//   · 초점이 지금 어디인가 (surface.focusId 로 실려 온다 — 옮기는 산수는 input/focus.ts)
//   · 되는지 안 되는지 (row.state 로 실려 온다 — 세계가 판정한 것이다)
//   · **사람이 읽을 말** — 닫는 자리의 이름도, 빈 자리를 부르는 말도, 상태를 소리로
//     옮기는 말도 짓지 않는다. 코드로 부르고 팩의 문구 표가 말을 준다
//     (문구 반전 ⑤ — 명령 표면이 간 길 그대로)

import { nextIndex } from '../input/focus';
import { RAW_CODE, type CodeTextFn } from '../presentation/code-text';
import type { SceneSurface, SceneSurfaceSection } from '../scene/scene-state';
import { enterStop, escapeMeans, focusToClaim, tabStopId } from './surface-focus';

/**
 * Tab 이 서는 자리들 — **문서에 놓인 차례 그대로**다 (querySelectorAll 이 그 차례를 준다).
 *
 * 칸·줄은 `tabindex="0"` 인 것만 여기 든다. 나머지는 `-1` 이라 Tab 에 걸리지 않지만
 * 초점 자체는 받을 수 있다 — 방향키가 옮겨 주는 자리이기 때문이다.
 */
const TAB_STOPS = '.sf-close, .sf-field, .sf-cell[tabindex="0"], .sf-row[tabindex="0"]';

/**
 * 이 능력이 부르는 문구 코드 전부 — 팩이 덮지 못한 것을 검사가 잡는다.
 * 덮지 않아도 게임은 멈추지 않는다 (코드가 그대로 보인다).
 */
export const SURFACE_TEXT_CODES = [
  'surface.close',
  'surface.empty-cell',
  'surface.state.available',
  'surface.state.blocked',
  'surface.state.pending',
] as const;

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

/**
 * 다시 그린 뒤 **같은 자리를 되찾는 열쇠** — 없으면 null.
 *
 * 표면은 통째로 다시 그려지므로(innerHTML) 마디는 매번 새것이다. 붙들 수 있는 것은
 * 마디가 아니라 그 자리를 가리키는 말뿐이다.
 */
function holdSelector(el: HTMLElement | null): string | null {
  if (!el) return null;
  if (el.classList.contains('sf-close')) return '.sf-close';
  const id = el.dataset.id;
  if (id === undefined) return null;
  if (el.classList.contains('sf-cell')) return `.sf-cell[data-id="${CSS.escape(id)}"]`;
  if (el.classList.contains('sf-row')) return `.sf-row[data-id="${CSS.escape(id)}"]`;
  return null;
}

function escape(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

function renderSection(
  section: SceneSurfaceSection,
  focusId: string | undefined,
  textOf: CodeTextFn,
): string {
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
        ' tabindex="0"' +
        ` autocomplete="off" spellcheck="false" />`
      : '');

  // 칸들 — **빈 칸도 그린다.** 남은 자리가 자리로 읽히는 것이 이 원소의 값어치다.
  if (section.cells) {
    if (section.cells.length === 0 && section.emptyText) {
      return `<div class="sf-section">${head}<div class="sf-empty">${escape(section.emptyText)}</div></div>`;
    }
    const columns = section.columns && section.columns > 0 ? section.columns : 6;
    const shape = section.shape ?? 'slot';
    // 이 무리에서 Tab 이 서는 한 자리 — 나머지는 방향키가 옮겨 주는 자리다.
    // **실려 온 초점이 없으면 전부 Tab 자리로 둔다**: 링을 모는 손이 없다는 뜻이므로,
    // 그때 한 자리로 줄이면 나머지 칸에 닿는 길이 자판에서 사라진다
    const cellStop =
      focusId === undefined
        ? undefined
        : tabStopId(
            section.cells.map((cell) => cell.id),
            focusId,
          );
    const cells = section.cells
      .map((cell) => {
        // 접근성 이름 — 이름과 곁글자와 표식을 한 줄로. **빈 자리도 이름을 가진다**.
        // 명암(level)은 여기 없다 — 같은 값이 곁글자로 이미 서 있고, 같은 것을 두 번
        // 읽어 주면 목록이 길어지기만 한다
        // 곁말은 **읽어 주는 이름에도 실린다** — 손을 얹어야만 열리는 정보는
        // 눈과 손이 있는 사람에게만 있는 정보다
        const label = cell.empty
          ? cell.text || textOf('surface.empty-cell')
          : [cell.badge, cell.text, cell.detail, ...(cell.tip ?? [])].filter(Boolean).join(', ');
        const tip = cell.tip?.length
          ? `<span class="sf-tip" role="tooltip">${cell.tip
              .map((line) => `<span>${escape(line)}</span>`)
              .join('')}</span>`
          : '';
        // 얼마나 찼는가 — 0..1 밖의 값은 그 끝으로 붙인다 (그리는 쪽의 산수다)
        const level =
          cell.level === undefined ? undefined : Math.max(0, Math.min(1, cell.level));
        return (
          `<button type="button" class="sf-cell" data-id="${escape(cell.id)}"` +
          ` data-empty="${cell.empty}" data-selected="${cell.selected}"` +
          ` data-focused="${cell.id === focusId}"` +
          ` tabindex="${cellStop === undefined || cell.id === cellStop ? 0 : -1}"` +
          (tip ? ' data-tip="true"' : '') +
          (level === undefined ? '' : ` style="--sf-level:${level.toFixed(3)}"`) +
          ` aria-label="${escape(label)}" aria-pressed="${cell.selected}">` +
          (cell.badge ? `<span class="sf-cell-badge">${escape(cell.badge)}</span>` : '') +
          `<span class="sf-cell-text">${escape(cell.text)}</span>` +
          (cell.detail ? `<span class="sf-cell-detail">${escape(cell.detail)}</span>` : '') +
          tip +
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
  const rowStop =
    focusId === undefined ? undefined : tabStopId(rows.map((row) => row.id), focusId);
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
      const spokenState = row.state ? textOf(`surface.state.${row.state}`) : '';
      const spoken = [row.text, row.hint, spokenState].filter(Boolean).join(', ');
      // **줄도 단추다.** div 였던 동안 이 자리는 손가락으로 닿지 않았고 자판 초점도
      // 받지 못했다 — 되는 것을 눌러 실행하는 길이 자판에만 있었다는 뜻이다.
      // 안 되는 줄도 단추로 둔다 (disabled 로 만들지 않는다): 사유를 읽는 것이
      // 그 자리의 값어치이고, 읽으려면 초점이 닿아야 한다.
      return (
        `<button type="button" class="sf-row" data-id="${escape(row.id)}"` +
        (row.state ? ` data-state="${row.state}"` : '') +
        ` data-focused="${row.id === focusId}"` +
        ` tabindex="${rowStop === undefined || row.id === rowStop ? 0 : -1}"` +
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
export function surfaceMarkup(surface: SceneSurface, textOf: CodeTextFn = RAW_CODE): string {
  // 닫는 자리의 이름 — 글자가 아니라 ✕ 하나이므로, 이 이름이 없으면 손가락과
  // 읽어 주는 장치에게 이 버튼은 이름 없는 무엇이 된다 (명령 표면과 같은 이유).
  const closeText = escape(textOf('surface.close'));
  return (
    `<header class="sf-head"><h2 class="sf-title">${escape(surface.title)}</h2>` +
    `<button type="button" class="sf-close" data-surface="${escape(surface.id)}"` +
    ` tabindex="0" title="${closeText}" aria-label="${closeText}">✕</button></header>` +
    `<div class="sf-body">${surface.sections
      .map((section) => renderSection(section, surface.focusId, textOf))
      .join('')}</div>` +
    (surface.footer.length > 0
      ? `<footer class="sf-foot">${surface.footer
          .map((line) => `<span>${escape(line)}</span>`)
          .join('')}</footer>`
      : '')
  );
}

export function createSurfaceLayer(
  container: HTMLElement,
  handlers: SurfaceHandlers,
  textOf: CodeTextFn = RAW_CODE,
): SurfaceLayer {
  const root = document.createElement('div');
  root.id = 'surfaces';
  container.appendChild(root);

  // 지금 열려 있는 것들 — 뒤가 위다. Escape 는 위의 것부터 닫는다
  let openIds: string[] = [];
  // 프레임마다 innerHTML 을 갈아 끼우지 않기 위해 마지막으로 그린 것을 기억한다
  const drawn = new Map<string, { node: HTMLElement; html: string }>();
  // 표면마다 지난 프레임에 실려 온 초점 — 링이 움직였는지는 이 둘의 차이가 말한다
  const lastFocus = new Map<string, string | undefined>();
  /**
   * 표면이 열리기 전에 초점이 있던 자리 — 닫히면 그리로 되돌려 준다.
   *
   * 표면을 여는 것은 대개 화면의 어떤 단추이고, 닫고 나면 겪는 사람은 그 자리에서
   * 하던 일을 잇는다. 되돌리지 않으면 초점은 문서의 맨 앞으로 떨어지고, 자판만 쓰는
   * 사람은 방금 있던 자리를 처음부터 다시 찾아가야 한다.
   */
  let focusBefore: HTMLElement | null = null;

  // ── 곁말 (tip) ──────────────────────────────────────────────────
  //
  // 손을 얹은 것과 초점이 닿은 것을 **같은 하나의 상태**로 다룬다. 둘을 따로 두면
  // 손이 얹힌 채 초점이 옮겨갈 때 곁말이 둘 열리고, 어느 것이 지금 것인지 알 수 없다.
  //
  // 닫은 것은 기억한다 — Escape 로 닫았는데 손이 그 자리에 그대로 있으면 다음
  // 손짓 하나에 곧바로 다시 열리고, 그러면 닫은 것이 닫힌 것이 아니게 된다.
  // 그 자리를 **떠나면** 잊는다: 다시 오는 것은 다시 읽겠다는 뜻이다.
  let openTip: { surfaceId: string; cellId: string } | null = null;
  let dismissedTip: string | null = null;
  const tipKey = (surfaceId: string, cellId: string): string => `${surfaceId}\u0000${cellId}`;

  /** 상태를 DOM 에 바른다 — 다시 그린 뒤에도 같은 함수가 다시 바른다 */
  function paintTip(): void {
    for (const entry of drawn.values()) {
      const cells = Array.from(entry.node.querySelectorAll<HTMLElement>('.sf-cell[data-tip]'));
      for (const el of cells) {
        const on =
          openTip !== null &&
          entry.node.dataset.surface === openTip.surfaceId &&
          el.dataset.id === openTip.cellId;
        if (on) el.dataset.tipOpen = 'true';
        else delete el.dataset.tipOpen;
      }
    }
  }

  function showTip(surfaceId: string, cellId: string): void {
    if (dismissedTip === tipKey(surfaceId, cellId)) return;
    if (openTip?.surfaceId === surfaceId && openTip.cellId === cellId) return;
    openTip = { surfaceId, cellId };
    paintTip();
  }

  function hideTip(surfaceId?: string, cellId?: string): void {
    if (!openTip) return;
    if (surfaceId !== undefined && (openTip.surfaceId !== surfaceId || openTip.cellId !== cellId)) {
      return;
    }
    openTip = null;
    paintTip();
  }

  /** 곁말을 지닌 칸인가 — 지니지 않은 칸은 이 길에 아무 일도 일으키지 않는다 */
  function tipCellOf(target: EventTarget | null): { surfaceId: string; cellId: string } | null {
    const el = (target as HTMLElement | null)?.closest<HTMLElement>('.sf-cell[data-tip]');
    const surfaceId = surfaceOf(el ?? null);
    if (!el || el.dataset.id === undefined || !surfaceId) return null;
    return { surfaceId, cellId: el.dataset.id };
  }

  root.addEventListener('pointerover', (ev) => {
    const at = tipCellOf(ev.target);
    if (at) showTip(at.surfaceId, at.cellId);
  });
  root.addEventListener('pointerout', (ev) => {
    const at = tipCellOf(ev.target);
    // 자리를 떠났다 — 닫은 기억도 함께 잊는다 (다시 오면 다시 읽는다)
    if (at) {
      if (dismissedTip === tipKey(at.surfaceId, at.cellId)) dismissedTip = null;
      hideTip(at.surfaceId, at.cellId);
    }
  });
  // 초점은 손과 **같은 자격**이다 — 자판만 쓰는 사람에게 이것이 곁말에 닿는 유일한 길이다
  root.addEventListener('focusin', (ev) => {
    const at = tipCellOf(ev.target);
    if (at) showTip(at.surfaceId, at.cellId);
  });
  root.addEventListener('focusout', (ev) => {
    const at = tipCellOf(ev.target);
    if (at) {
      if (dismissedTip === tipKey(at.surfaceId, at.cellId)) dismissedTip = null;
      hideTip(at.surfaceId, at.cellId);
    }
  });

  // ── 자판이 다니는 길 ────────────────────────────────────────────
  //
  // 판단은 `surface-focus.ts` 가 지닌다. 여기 있는 것은 그 판단대로 마디를 만지는 일뿐이다.

  /** 맨 위 표면의 마디 — 겹쳐 있으면 뒤의 것이 위다 (닫히는 차례와 같다) */
  function topSurfaceNode(): HTMLElement | undefined {
    const id = openIds[openIds.length - 1];
    return id === undefined ? undefined : drawn.get(id)?.node;
  }

  function tabStopsOf(node: HTMLElement): HTMLElement[] {
    return Array.from(node.querySelectorAll<HTMLElement>(TAB_STOPS));
  }

  /** 지금 링이 그려진 자리 — 실려 온 초점을 마디에서 되읽는다 */
  function ringOf(node: HTMLElement): HTMLElement | null {
    return node.querySelector<HTMLElement>('[data-focused="true"]');
  }

  /**
   * 표면 안으로 들어간다 — 링이 있으면 그 자리, 없으면 **표면 자신**이다.
   *
   * 첫 Tab 자리(닫는 단추)로 들어가지 않는 이유가 있다. 그 자리에 서면 Enter 한 번이
   * 곧 닫기가 되고, 방금 연 표면이 무엇을 하는 곳인지 읽기도 전에 닫힌다. 표면 자신에
   * 서면 읽어 주는 장치는 제목과 "대화 상자" 를 먼저 말하고, 다음 Tab 이 안으로 들어간다.
   */
  function focusInto(node: HTMLElement): void {
    (ringOf(node) ?? node).focus();
  }

  /**
   * Tab 은 표면 안에서 감긴다.
   *
   * 표면은 이미 자판을 잡고 있다 (`capturing`). 그런데 Tab 만은 뒤의 페이지로 새어
   * 나갔고, 그러면 자판을 쥔 채 화면 밖으로 걸어 나간 꼴이 된다 — 돌아오는 길은
   * 눈에 보이지 않는다. 감기는 이유는 `input/focus.ts` 와 같다: 감기지 않으면 양 끝이
   * 막다른 곳이 되고, 그때 겪는 사람은 끝에 선 것인지 조작이 죽은 것인지 알 수 없다.
   */
  window.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Tab') return;
      const node = topSurfaceNode();
      if (!node) return;
      const stops = tabStopsOf(node);
      // 설 자리가 하나도 없는 표면은 가두지 않는다 — 가두면 Tab 이 아무 데도 가지
      // 못하는 자리가 되고, 그것은 붙잡은 것이 아니라 막아 둔 것이다
      if (stops.length === 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const to =
        at < 0
          ? enterStop(stops.length, ev.shiftKey)
          : nextIndex(stops.length, at, ev.shiftKey ? -1 : 1);
      stops[to]?.focus();
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Escape') return;
      const target = ev.target as HTMLElement | null;
      // 우리 표면의 글자 자리인가 — 표면 밖의 글자 자리(다른 화면의 입력)는 그 자리의
      // 것이므로 건드리지 않는다
      const field = target?.closest<HTMLElement>('.sf-field') ?? null;
      const inField = field !== null && root.contains(field);
      if (!inField) {
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      }
      const meaning = escapeMeans({
        anyOpen: openIds.length > 0,
        inField,
        tipOpen: openTip !== null,
      });
      if (meaning === 'none') return;
      ev.preventDefault();
      ev.stopPropagation();
      if (meaning === 'leave-field') {
        // **표면은 열린 채다.** 한 번에 하나씩 닫히므로 다음 Escape 가 표면을 닫는다 —
        // 그 전까지 이 자리를 떠나는 것만으로 자판이 표면 안을 다시 다닐 수 있다
        // (글자 자리에 있는 동안 방향키·Tab 은 전부 그 자리의 것이었다).
        const node = target?.closest<HTMLElement>('.sf');
        if (node) focusInto(node);
        return;
      }
      if (meaning === 'close-tip') {
        dismissedTip = tipKey(openTip!.surfaceId, openTip!.cellId);
        hideTip();
        return;
      }
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
      const wasOpen = openIds;
      // 아무것도 열려 있지 않은 동안에는 지금 초점이 있는 자리가 곧 "열기 전 자리" 다.
      // 열린 뒤에 재면 이미 표면 안이라 되돌릴 자리가 아니다
      if (wasOpen.length === 0) {
        const active = document.activeElement as HTMLElement | null;
        focusBefore = active && !root.contains(active) ? active : null;
      }

      for (const surface of surfaces) {
        seen.add(surface.id);
        let entry = drawn.get(surface.id);
        if (!entry) {
          const node = document.createElement('section');
          node.className = 'sf';
          // 눌린 자리가 어느 표면의 것인지 되읽는 열쇠 — 닫는 단추만 알던 것을
          // 마디 자신이 지닌다
          node.dataset.surface = surface.id;
          // 자판을 가두는 자리는 **가둔다고 말해야 한다** — 읽어 주는 장치는 이 표시가
          // 없으면 뒤의 페이지를 계속 읽고, 그러면 갇힌 것은 초점뿐이고 목소리는 밖에 있다
          node.setAttribute('role', 'dialog');
          node.setAttribute('aria-modal', 'true');
          // 마디 자신이 초점을 받을 수 있어야 한다 — 열린 표면이 처음 서는 자리다.
          // Tab 자리는 아니다 (-1): 다니는 차례는 안의 것들이 지닌다
          node.tabIndex = -1;
          root.appendChild(node);
          entry = { node, html: '' };
          drawn.set(surface.id, entry);
        }

        entry.node.classList.toggle('sf-open', surface.open);
        entry.node.setAttribute('aria-hidden', String(!surface.open));
        // 이름 없는 대화 상자가 되지 않게 — 제목이 곧 이 자리의 이름이다
        entry.node.setAttribute('aria-label', surface.title);
        if (!surface.open) continue;
        nowOpen.push(surface.id);

        const html = surfaceMarkup(surface, textOf);

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
          // 칸·줄·닫는 자리에 닿아 있던 초점도 붙들었다 놓아 준다. 붙들지 않으면 목록이
          // 한 번 다시 그려질 때마다 초점이 화면 밖으로 튀어나가고, 자판만 쓰는
          // 사람은 방금 읽던 자리를 잃는다 — 곁말도 함께 닫힌다.
          //
          // **닫는 자리도 함께 센다.** Tab 이 표면 안에서 감기게 된 뒤로 그 자리에
          // 서 있는 시간이 생겼고, 세지 않으면 거기 선 채로 한 번 다시 그려질 때
          // 초점이 통째로 사라진다.
          const held =
            active && entry.node.contains(active) && !typing
              ? holdSelector(active.closest<HTMLElement>('.sf-cell, .sf-row, .sf-close'))
              : null;

          entry.node.innerHTML = html;
          entry.html = html;

          if (held) entry.node.querySelector<HTMLElement>(held)?.focus();

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

        // 실려 온 초점을 브라우저의 초점으로 삼는다 — 링과 캐럿이 갈라지지 않게.
        // 판단은 surface-focus.ts 가 하고 여기서는 그대로 옮긴다
        const active = document.activeElement as HTMLElement | null;
        const claim = focusToClaim({
          focusId: surface.focusId,
          lastFocus: lastFocus.get(surface.id),
          justOpened: !wasOpen.includes(surface.id),
          typing: active !== null && entry.node.contains(active) && active.closest('.sf-field') !== null,
        });
        lastFocus.set(surface.id, surface.focusId);
        if (claim.move === 'ring') {
          entry.node
            .querySelector<HTMLElement>(
              `.sf-cell[data-id="${CSS.escape(claim.id)}"], .sf-row[data-id="${CSS.escape(claim.id)}"]`,
            )
            ?.focus();
        } else if (claim.move === 'enter') {
          focusInto(entry.node);
        }
      }

      // 지시에서 사라진 표면은 함께 사라진다
      for (const [id, entry] of drawn) {
        if (seen.has(id)) continue;
        entry.node.remove();
        drawn.delete(id);
      }

      // 닫힌 표면은 지난 초점도 함께 잊는다 — 다시 열리면 그때 실려 오는 것이 참이다
      for (const id of lastFocus.keys()) {
        if (!nowOpen.includes(id)) lastFocus.delete(id);
      }

      // 마지막 표면이 닫혔다 — 열기 전 자리로 되돌려 준다.
      //
      // 그 자리가 사라졌으면(`isConnected` 가 거짓이면) 아무 데도 옮기지 않는다: 없는
      // 자리를 찾아 헤매느니 브라우저가 정한 자리에 두는 편이 예측된다.
      //
      // 그리고 **빼앗지 않는다.** 되돌리는 것은 초점이 표면과 함께 사라졌을 때뿐이다 —
      // 닫히는 사이에 겪는 사람이 표면 밖 어딘가를 짚었으면 그 자리가 그 사람의 뜻이다.
      // 표면이 숨겨지는 순간 브라우저가 초점을 놓아 버리므로(문서 몸통으로 떨어진다)
      // 그 자리도 "사라진 초점" 으로 함께 센다.
      if (wasOpen.length > 0 && nowOpen.length === 0) {
        const active = document.activeElement as HTMLElement | null;
        const lost = active === null || active === document.body || root.contains(active);
        if (focusBefore?.isConnected && lost) focusBefore.focus();
        focusBefore = null;
      }

      openIds = nowOpen;
      // 닫힌 표면의 곁말은 함께 사라진다 — 없는 자리에 열린 곁말이 남으면
      // 다음에 그 표면을 열었을 때 아무도 손을 얹지 않았는데 곁말이 떠 있다
      if (openTip && !nowOpen.includes(openTip.surfaceId)) {
        openTip = null;
        dismissedTip = null;
      }
      paintTip();
    },
  };
}
