// 공용 렌더러 ① 상태 diff 뷰 — 임의 상태 트리의 전/후(기대/실제)를 나란히 보이고
// 최초로 갈라진 경로를 강조한다. WORKFLOW §6 공용 렌더러 5종 중 첫 번째.

import { canonicalize } from '@hkt/core/v1';
import { divergences, type Divergence } from '@hkt/scenarios';

import { h, type VElement } from '../vnode.ts';

/** 한 줄로 접힌 값 — 직렬화 불가능한 값도 표기는 남긴다. */
function show(value: unknown): string {
  if (value === undefined) return '(없음)';
  try {
    return canonicalize(value);
  } catch {
    return `(직렬화 불가: ${typeof value})`;
  }
}

export interface DiffViewOptions {
  /** 왼쪽 열 이름 (기본 "기대 / 전") */
  readonly leftLabel?: string;
  /** 오른쪽 열 이름 (기본 "실제 / 후") */
  readonly rightLabel?: string;
  /** 표시할 최대 차이 개수 */
  readonly limit?: number;
}

/**
 * 두 상태의 diff 뷰.
 * 차이가 없으면 "동일" 배지를, 있으면 경로별 표를 그리고 첫 행에 `divergent-first` 를 붙인다.
 */
export function diffView(left: unknown, right: unknown, options: DiffViewOptions = {}): VElement {
  const leftLabel = options.leftLabel ?? '기대 / 전';
  const rightLabel = options.rightLabel ?? '실제 / 후';

  let found: Divergence[];
  try {
    found = divergences(left, right, options.limit ?? 20);
  } catch {
    // 직렬화 불가능한 값이 섞이면 경로를 셀 수 없다 — 그 사실을 화면에 남긴다.
    found = [{ path: '$', expected: left, actual: right }];
  }

  if (found.length === 0) {
    return h('div', { class: 'diff diff-same' }, [
      h('span', { class: 'badge badge-ok' }, ['동일']),
      h('code', { class: 'value' }, [show(left)]),
    ]);
  }

  return h('div', { class: 'diff diff-changed' }, [
    h('table', { class: 'diff-table' }, [
      h('thead', {}, [
        h('tr', {}, [
          h('th', { class: 'col-path' }, ['상태 경로']),
          h('th', { class: 'col-left' }, [leftLabel]),
          h('th', { class: 'col-right' }, [rightLabel]),
        ]),
      ]),
      h(
        'tbody',
        {},
        found.map((divergence, index) =>
          h('tr', { class: index === 0 ? 'divergent divergent-first' : 'divergent' }, [
            h('td', { class: 'path' }, [divergence.path]),
            h('td', { class: 'left' }, [h('code', {}, [show(divergence.expected)])]),
            h('td', { class: 'right' }, [h('code', {}, [show(divergence.actual)])]),
          ]),
        ),
      ),
    ]),
    h('p', { class: 'diff-note' }, [
      `최초 분기 경로: ${found[0]?.path ?? '(없음)'} · 차이 ${String(found.length)}곳`,
    ]),
  ]);
}

/** 키-값 표 — 입력·설정처럼 평평한 값을 보일 때. */
export function keyValueView(rows: readonly (readonly [string, unknown])[]): VElement {
  return h('table', { class: 'kv-table' }, [
    h(
      'tbody',
      {},
      rows.map(([key, value]) =>
        h('tr', {}, [h('th', {}, [key]), h('td', {}, [h('code', {}, [show(value)])])]),
      ),
    ),
  ]);
}

/** 값 하나를 코드 블록으로. */
export function valueView(value: unknown): VElement {
  return h('pre', { class: 'value-block' }, [h('code', {}, [show(value)])]);
}
