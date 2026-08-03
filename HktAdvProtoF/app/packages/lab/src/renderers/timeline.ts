// 공용 렌더러 ④ 타임라인 (P5-c) — 순서가 있는 것을 순서대로 그린다.
//
// 그래프 뷰는 "무엇이 무엇에 걸리는가" 를 그린다. 게이지는 "얼마나" 를 그린다. 둘 다
// **순서**를 그리지 못한다 — 계획은 같은 원자들이라도 순서가 다르면 다른 계획이다.
//
// 그래서 이 렌더러가 지키는 것은 하나다: **왼쪽이 먼저다.** 걸음마다 번호가 붙고, 왜 그 자리에
// 있는지가 함께 서고, 지금 낼 수 있는지가 색으로 갈린다. 배치는 순서열 그대로라 결정적이다
// (그래프 뷰가 좌표를 계산해야 했던 것과 달리, 여기서는 순서가 곧 배치다).
//
// 소비자: `/lab/p5`. 뒤에 올 R1(사건 로그)·W5·E2(계약 상태 전이)·N3 이 같은 것을 쓴다
// (WORKFLOW §6 렌더러 표).

import { h, type VElement } from '../vnode.ts';

/** 걸음 하나. */
export interface TimelineEntry {
  /** 왼쪽에서부터의 자리. 화면에 그대로 적힌다 */
  readonly order: number;
  readonly label: string;
  /** 왜 그 자리인가 — 걸음 아래에 작게 */
  readonly note?: string;
  /** 갈래 이름 — 색을 가른다 (계획이면 목적·봐야 한다·치러야 한다) */
  readonly kind?: string;
  /** 지금 낼 수 있는가 등 한 마디 배지 */
  readonly badge?: string;
  /** 마우스를 올렸을 때 */
  readonly hint?: string;
  /** 눈에 띄게 — 목적 걸음처럼 */
  readonly emphasis?: boolean;
}

export interface TimelineOptions {
  /** 갈래 → 색 */
  readonly kindColors?: Readonly<Record<string, string>>;
  readonly caption?: string;
  /** 걸음이 하나도 없을 때의 문장 — 비었다는 것도 결과다 */
  readonly emptyText?: string;
}

/** 걸음 갈래의 기본 색 — 앞칸(치러야 한다·봐야 한다)에서 목적으로 갈수록 밝아진다. */
export const STEP_COLORS: Readonly<Record<string, string>> = {
  observation: '#60a5fa',
  cost: '#fbbf24',
  goal: '#4ade80',
};

function colorOf(kind: string | undefined, colors: Readonly<Record<string, string>>): string {
  if (kind === undefined) return 'currentColor';
  return colors[kind] ?? 'currentColor';
}

/**
 * 걸음들을 순서대로 그린다.
 *
 * 던지지 않는다 — 걸음이 없으면 "왜 없는지" 를 문장으로 세운다. 비었다는 것을 `.empty` 로
 * 흘리지 않는 이유는 V3 화면 7요소 검사가 빈칸을 세기 때문이다: 여기서의 0 걸음은 빠뜨림이
 * 아니라 결과이므로 문장으로 선다.
 */
export function timelineView(
  entries: readonly TimelineEntry[],
  options: TimelineOptions = {},
): VElement {
  const colors = options.kindColors ?? STEP_COLORS;
  if (entries.length === 0) {
    return h('div', { class: 'timeline-view' }, [
      h('p', { class: 'timeline-none' }, [options.emptyText ?? '(걸음이 없다)']),
    ]);
  }

  const children = [
    h(
      'ol',
      { class: 'timeline-list' },
      entries.map((entry, index) => {
        const color = colorOf(entry.kind, colors);
        return h(
          'li',
          {
            class: entry.emphasis === true ? 'timeline-step is-goal' : 'timeline-step',
            'data-kind': entry.kind ?? '',
            title: entry.hint ?? entry.label,
          },
          [
            h('span', { class: 'timeline-mark', style: `background: ${color}` }, [
              String(entry.order),
            ]),
            h('span', { class: 'timeline-body' }, [
              h('span', { class: 'timeline-label', style: `color: ${color}` }, [entry.label]),
              ...(entry.badge === undefined
                ? []
                : [h('span', { class: 'timeline-badge' }, [entry.badge])]),
              ...(entry.note === undefined
                ? []
                : [h('span', { class: 'timeline-note' }, [entry.note])]),
            ]),
            // 마지막 걸음 뒤에는 화살표를 두지 않는다 — 사슬이 거기서 끝난다.
            ...(index === entries.length - 1
              ? []
              : [h('span', { class: 'timeline-arrow' }, ['→'])]),
          ],
        );
      }),
    ),
  ];
  if (options.caption !== undefined) {
    children.push(h('p', { class: 'graph-caption' }, [options.caption]));
  }
  return h('div', { class: 'timeline-view' }, children);
}

/** 갈래 범례 — 어느 색이 어느 걸음인가. */
export function stepLegend(
  kinds: readonly { readonly kind: string; readonly label: string }[],
  options: TimelineOptions = {},
): VElement {
  const colors = options.kindColors ?? STEP_COLORS;
  return h(
    'ul',
    { class: 'legend-kinds' },
    kinds.map((entry) =>
      h('li', {}, [
        h('span', {
          class: 'legend-swatch',
          style: `background: ${colorOf(entry.kind, colors)}`,
        }, []),
        entry.label,
      ]),
    ),
  );
}
