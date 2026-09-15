// HUD 자리 배치 (기반) — **패널이 서로 위에 포개지지 않는다**는 것을 이 파일이 소유한다.
//
// 그전까지 패널의 자리는 조립의 그리기 규칙(index.html)에 박힌 상수였다:
// `top: 14px` · `bottom: 88px` · `top: 104px` — 각자 자기 모서리에서 절대 좌표로 떠 있고,
// 서로가 어디까지 자랐는지 알지 못했다. 그래서 세계가 자라 패널의 줄이 늘 때마다
// (26 Cycle 이 지나 self 패널은 서른 줄, 키 안내는 스물한 줄이 되었다) 옆 패널 위로
// 흘러들어 글자가 포개졌다. 좁은 화면에서는 화면 밖으로 나가 조용히 사라지기도 했다.
//
// 여기서 하는 일은 상수를 더 고르는 것이 아니라 **자리를 자리로 만드는 것**이다.
//
//     열(column) 셋    왼쪽 · 가운데 · 오른쪽 — 화면을 가로로 나눈다 (grid 3열)
//     자리(region) 둘  각 열의 위와 아래 — 열의 높이를 나눠 쓴다 (flex · space-between)
//
// 한 자리에 놓인 것들은 세로로 쌓이고(겹칠 수 없다), 서로 다른 자리는 grid 열과 flex
// 줄이 갈라 놓으므로 역시 겹칠 수 없다. 겹침은 이제 배치의 실수가 아니라 **불가능**이다.
//
// 세로 몫을 **열마다** 나누는 것이 요점이다 — 위아래로 먼저 나누면, 왼쪽 위가 짧아서
// 남긴 자리를 왼쪽 아래가 쓰지 못한 채 잘린다. 열로 나누면 그 열의 위아래가 서로의
// 남는 자리를 물려받고, 가운데의 빈 하늘(세계를 보는 자리)은 아무도 침범하지 않는다.
// 그래도 모자라면 자리 안에서 잘린다 — 이웃을 밀거나 덮지 않는다.
//
// 이 파일은 **무엇이 놓이는지 모른다.** 자기 정보인지 키 안내인지 이어짐 수치인지 묻지
// 않고, 부르는 쪽이 지목한 자리에 놓을 뿐이다 (설계 반전 ⑤와 같은 결). 모양(색 · 여백 ·
// 글자)은 여전히 조립의 그리기 규칙이 지닌다 — 여기 있는 것은 **자리**뿐이다.

/** 자리 — 띠(위·아래) × 열(왼쪽·가운데·오른쪽) */
export type HudRegion =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const HUD_REGIONS: readonly HudRegion[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export interface HudLayout {
  /**
   * 요소를 자리에 놓는다 — 같은 자리의 것들은 놓인 차례대로 쌓인다.
   *
   * `coarse` 를 주면 손가락 기기(pointer: coarse)에서는 그쪽 자리로 간다. 그 기기에서는
   * 조작 버튼이 오른쪽 아래·오른쪽 위를 쓰므로 비켜 주어야 하는 것들이 있다.
   */
  place(element: HTMLElement, region: HudRegion, coarse?: HudRegion): void;
  /** 자리 배분 밖의 층 — 화면 전체를 덮는다 (몸에 붙어 다니는 표시 따위) */
  overlay(element: HTMLElement): void;
  /** 배치 뿌리 — 조립이 z 축이나 표시 여부를 만질 때만 쓴다 */
  readonly root: HTMLElement;
}

/**
 * 지금 놓일 자리를 고른다 — **DOM 을 건드리지 않는 순수 함수**다.
 *
 * 떼어 둔 이유는 검사할 수 있게 하기 위해서다. 손가락 기기에서 비켜 주기로 한 것이
 * 실제로 비키는가, 비켜 줄 자리를 밝히지 않은 것이 제자리에 남는가는 브라우저 없이
 * 확인해야 하는 성질이다.
 */
export function resolveRegion(
  region: HudRegion,
  coarse: HudRegion | undefined,
  isCoarse: boolean,
): HudRegion {
  return isCoarse && coarse ? coarse : region;
}

const STYLE_ID = 'hud-layout-style';

// 자리 규칙 — 이 문자열이 "겹치지 않는다" 의 전부다.
//
// 열은 가로로 나뉘고(grid 3열) 열 안에서 위·아래 자리가 높이를 나눠 쓴다(flex).
// 가운데 열의 양옆이 같은 몫(minmax(0,1fr))이라 가운데에 놓인 것은 화면 한가운데에
// 선다 — 왼쪽 패널이 아무리 넓어져도 그렇다. 자리마다 min-width:0 · overflow:hidden
// 이므로 넓은 것은 이웃을 밀어내는 대신 자기 자리 안에서 접히고 잘린다.
const LAYOUT_CSS = `
#hud-layout {
  position: absolute; inset: 0; z-index: 20;
  display: grid; gap: 12px;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
  padding: calc(12px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right))
           calc(12px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));
  pointer-events: none;
}
/* 가운데에 놓인 것이 있으면 양옆이 같은 몫을 받는다 — 그래야 가운데가 **화면
   한가운데**에 선다 (슬롯 띠와 안내 줄의 자리다). 없으면 양옆이 넓게 쓴다.
   :has 를 모르는 브라우저에서는 위의 기본 규칙이 남는다 — 가운데가 덜 가운데일
   뿐 겹치지는 않는다 (겹치지 않음은 열 나눔이 지니지 이 규칙이 지니지 않는다). */
#hud-layout:has(.hl-column[data-column="center"] .hl-region > *) {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}
/* 열 — 위 자리는 위에, 아래 자리는 아래에. 사이의 남는 높이는 둘이 나눠 가진다 */
.hl-column {
  display: flex; flex-direction: column; justify-content: space-between;
  gap: 10px; min-width: 0; min-height: 0;
}
/* 가운데 열은 화면의 절반 언저리까지만 벌어진다 — 그러지 않으면 넓은 것 하나가
   (칸이 늘어난 슬롯 띠 따위) 양옆의 몫을 다 가져간다. vw 로 재는 이유는 퍼센트가
   자기 열의 폭을 되묻는 순환이 되기 때문이다. */
.hl-column[data-column="center"] { max-width: 46vw; }
/* 자리 — 놓인 것들이 세로로 쌓인다. 자리보다 길면 자리 안에서 잘린다.
   flex 라야 놓인 것들이 남은 높이에 맞춰 함께 줄어든다 (grid 로 하면 저마다
   제 높이를 고집해 자리 밖으로 자란다). 넘칠 때 위쪽 줄이 먼저 살아남는 것도
   flex 의 넘침 규칙이 하는 일이다 — 읽어야 할 첫 줄이 잘려 나가지 않는다. */
.hl-region {
  display: flex; flex-direction: column; gap: 8px;
  flex: 0 1 auto; min-width: 0; min-height: 0; overflow: hidden;
}
.hl-column[data-column="left"] .hl-region { align-items: flex-start; }
.hl-column[data-column="center"] .hl-region { align-items: center; }
.hl-column[data-column="right"] .hl-region { align-items: flex-end; }
.hl-region[data-region^="bottom-"] { justify-content: flex-end; }
/* 놓인 것은 자기 자리를 넘지 않는다 — 넘으면 이웃이 아니라 자신이 잘린다.
   보이는 것을 자르는 것은 자리의 overflow:hidden 이고, 여기 셋은 **자를 일이 적게**
   한다: 안 접히던 글자를 접고(overflow-wrap), 자리 폭을 넘지 않으려 하고(max-width),
   자기 안의 넘침은 자기가 감춘다(overflow). 그래도 안 접히는 것(nowrap 로 못박은 줄)이
   있으면 상자가 자리 밖으로 밀려 나가는데, 그 밀린 만큼은 보이지 않아도 사실이므로
   검사가 "자리 밖" 으로 따로 센다 (tools/fx-lab/test/hud-shot.js). */
.hl-region > * {
  /* border-box 라야 max-width 가 여백까지 포함해 잰다 — 아니면 패널이 제 여백만큼
     (10px 씩) 자리 밖으로 자란다 */
  box-sizing: border-box;
  max-width: 100%; min-width: 0; min-height: 0; flex: 0 1 auto;
  overflow: hidden; overflow-wrap: anywhere;
}
/* 자리 배분 밖의 층 — 몸에 붙어 다니는 표시는 화면 전체를 쓴다.
   자리판 **밖**(컨테이너 바로 아래)에 단다 — 자리판 안에 달면 자리판의 여백만큼
   좌표가 밀려서, 세계가 투영해 준 자리와 화면에 찍히는 자리가 어긋난다. */
.hl-overlay { position: absolute; inset: 0; pointer-events: none; }
/* 손가락 기기 — 오른쪽 위·아래는 조작 버튼의 자리다 (touch-pad.ts 의 .tp-observer ·
   .tp-actions). 그 자리를 비워 준다. 비켜야 할 패널은 아예 다른 자리로 가고
   (place 의 coarse 인자), 남는 것들은 버튼 앞에서 멈춘다. */
#hud-layout[data-coarse="true"] .hl-region[data-region="bottom-center"],
#hud-layout[data-coarse="true"] .hl-region[data-region="bottom-right"] { padding-bottom: 96px; }
#hud-layout[data-coarse="true"] .hl-region[data-region="top-right"] { padding-top: 56px; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = LAYOUT_CSS;
  document.head.appendChild(style);
}

// 컨테이너마다 하나 — 여럿이 부르더라도 자리는 한 벌이다 (hud · 슬롯 띠가 같은 판을 쓴다)
const LAYOUTS = new WeakMap<HTMLElement, HudLayout>();

/**
 * 이 컨테이너의 자리판을 얻는다 — 없으면 만든다.
 *
 * 여러 능력(HUD 패널 · 슬롯 띠 · …)이 같은 판을 나눠 쓴다. 그래야 서로의 자리를 알고,
 * 알아야 겹치지 않는다.
 */
export function hudLayout(container: HTMLElement): HudLayout {
  const existing = LAYOUTS.get(container);
  if (existing) return existing;

  ensureStyle();

  const root = document.createElement('div');
  root.id = 'hud-layout';

  const regions = new Map<HudRegion, HTMLElement>();
  for (const column of ['left', 'center', 'right'] as const) {
    const columnNode = document.createElement('div');
    columnNode.className = 'hl-column';
    columnNode.dataset.column = column;
    for (const band of ['top', 'bottom'] as const) {
      const region = document.createElement('div');
      region.className = 'hl-region';
      region.dataset.region = `${band}-${column}`;
      columnNode.appendChild(region);
      regions.set(`${band}-${column}` as HudRegion, region);
    }
    root.appendChild(columnNode);
  }
  container.appendChild(root);

  // 손가락 기기인지 — 판정은 브라우저가 하고, 바뀌면 놓인 것을 다시 놓는다
  // (기기가 바뀌지 않아도 개발 도구의 기기 흉내로 바뀔 수 있다)
  const coarseQuery =
    typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : undefined;
  const placed: { element: HTMLElement; region: HudRegion; coarse?: HudRegion }[] = [];

  const applyPlacement = (): void => {
    const isCoarse = coarseQuery?.matches ?? false;
    root.dataset.coarse = String(isCoarse);
    for (const entry of placed) {
      const target = regions.get(resolveRegion(entry.region, entry.coarse, isCoarse));
      if (target && entry.element.parentElement !== target) target.appendChild(entry.element);
    }
  };

  coarseQuery?.addEventListener?.('change', applyPlacement);

  const layout: HudLayout = {
    root,
    place(element, region, coarse) {
      placed.push({ element, region, coarse });
      applyPlacement();
    },
    overlay(element) {
      element.classList.add('hl-overlay');
      // 자리판이 아니라 컨테이너에 단다 — 위 CSS 주석의 이유로 여백을 물려받으면 안 된다.
      // 자리판(z-index 20)보다 아래에 깔리므로 패널이 늘 표시 위에 선다.
      container.appendChild(element);
    },
  };

  LAYOUTS.set(container, layout);
  return layout;
}
