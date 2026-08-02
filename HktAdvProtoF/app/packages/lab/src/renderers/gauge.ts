// 공용 렌더러 ③ 게이지·추이 — 수치 하나가 어느 단계에 있는지를 눈으로 보인다.
// WORKFLOW §6 공용 렌더러 5종 중 세 번째이며, §6-2 대로 별도 작업 카드(D4-d)로 세운다.
//
// 지금까지 수치는 표의 칸에만 있었다(압력 0.31 · 결핍 0.5). 표는 값을 말하지만 **정도**는
// 말하지 못한다 — 0.31 이 위험한지 아닌지는 막대의 길이와 색으로만 한눈에 들어온다.
// D4 부터는 그 정도가 곧 내용이다: 압력은 목적이 태어나는 문턱이기 때문이다.
//
// 규칙 둘 (그래프 뷰와 같다):
//   ① 출력은 VNode 다 — 브라우저 없이 단언할 수 있다.
//   ② 색은 갈래(단계)에서 오고, 갈래의 이름과 색은 부르는 쪽이 준다. 렌더러는 core 타입을 모른다.

import { h, type VElement } from '../vnode.ts';

/** 게이지 한 줄. */
export interface GaugeRow {
  readonly label: string;
  /** 0~1 */
  readonly value: number;
  /** 색을 정하는 갈래 (충족 5단계 등) */
  readonly level?: string;
  /** 갈래의 한국어 이름 */
  readonly levelLabel?: string;
  /** 막대 오른쪽에 붙는 한 줄 */
  readonly detail?: string;
  /** 마우스를 올렸을 때의 한 줄 */
  readonly hint?: string;
}

/** 추이의 한 점 — 틱 하나. */
export interface TrendPoint {
  readonly label: string;
  /** 0~1 */
  readonly value: number;
  readonly level?: string;
  readonly hint?: string;
}

export interface GaugeOptions {
  /** 갈래 → 색 (기본값은 5단계 색) */
  readonly levelColors?: Readonly<Record<string, string>>;
  readonly caption?: string;
}

/** 충족 5단계의 기본 색 — 초록에서 붉은색으로. */
export const LEVEL_COLORS: Readonly<Record<string, string>> = {
  met: '#4ade80',
  unstable: '#a3e635',
  deficient: '#fbbf24',
  critical: '#fb923c',
  collapsing: '#f87171',
};

/** 0~1 로 자른다. */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function colorOf(level: string | undefined, colors: Readonly<Record<string, string>>): string {
  if (level === undefined) return 'currentColor';
  return colors[level] ?? 'currentColor';
}

/** 게이지 여러 줄 — 이름 · 막대 · 값. */
export function gaugeView(
  rows: readonly GaugeRow[],
  options: GaugeOptions = {},
): VElement {
  const colors = options.levelColors ?? LEVEL_COLORS;
  if (rows.length === 0) {
    return h('p', { class: 'empty' }, ['(잴 것이 없다)']);
  }

  const children = [
    h(
      'ul',
      { class: 'gauge-list' },
      rows.map((row) => {
        const value = clamp01(row.value);
        const color = colorOf(row.level, colors);
        return h('li', { class: 'gauge-row', 'data-level': row.level ?? '' }, [
          h('span', { class: 'gauge-label', title: row.hint ?? row.label }, [row.label]),
          h('span', { class: 'gauge-track' }, [
            h('span', {
              class: 'gauge-fill',
              style: `width: ${String(Math.round(value * 100))}%; background: ${color}`,
            }, []),
          ]),
          h('span', { class: 'gauge-value', style: `color: ${color}` }, [
            `${value.toFixed(2)}${row.levelLabel === undefined ? '' : ` ${row.levelLabel}`}`,
          ]),
          ...(row.detail === undefined
            ? []
            : [h('span', { class: 'gauge-detail' }, [row.detail])]),
        ]);
      }),
    ),
  ];
  if (options.caption !== undefined) {
    children.push(h('p', { class: 'graph-caption' }, [options.caption]));
  }
  return h('div', { class: 'gauge-view' }, children);
}

/** 추이 — 틱이 흐르며 값이 어떻게 오르는가 (세로 막대 열). */
export function trendView(
  points: readonly TrendPoint[],
  options: GaugeOptions = {},
): VElement {
  const colors = options.levelColors ?? LEVEL_COLORS;
  if (points.length === 0) {
    return h('p', { class: 'empty' }, ['(그릴 추이가 없다)']);
  }

  const children = [
    h(
      'ul',
      { class: 'trend-list' },
      points.map((point) => {
        const value = clamp01(point.value);
        const color = colorOf(point.level, colors);
        return h('li', { class: 'trend-col', 'data-level': point.level ?? '' }, [
          h('span', { class: 'trend-bar-track', title: point.hint ?? point.label }, [
            h('span', {
              class: 'trend-bar',
              style: `height: ${String(Math.round(value * 100))}%; background: ${color}`,
            }, []),
          ]),
          h('span', { class: 'trend-value', style: `color: ${color}` }, [value.toFixed(2)]),
          h('span', { class: 'trend-label' }, [point.label]),
        ]);
      }),
    ),
  ];
  if (options.caption !== undefined) {
    children.push(h('p', { class: 'graph-caption' }, [options.caption]));
  }
  return h('div', { class: 'trend-view' }, children);
}

/** 단계 범례 — 어느 색이 어느 단계인가. */
export function levelLegend(
  levels: readonly { readonly level: string; readonly label: string }[],
  options: GaugeOptions = {},
): VElement {
  const colors = options.levelColors ?? LEVEL_COLORS;
  return h(
    'ul',
    { class: 'legend-kinds' },
    levels.map((entry) =>
      h('li', {}, [
        h('span', {
          class: 'swatch',
          style: `background: ${colorOf(entry.level, colors)}`,
        }, []),
        entry.label,
      ]),
    ),
  );
}
