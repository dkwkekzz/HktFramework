// P5-c 단위 테스트 — 공용 타임라인 뷰. 왼쪽이 먼저이고, 순서가 곧 배치라 그림이 결정적이다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '@hkt/core/v1';

import {
  findAll,
  findByClass,
  stepLegend,
  STEP_COLORS,
  textOf,
  timelineView,
  toHtml,
  type TimelineEntry,
} from '../src/index.ts';

const STEPS: readonly TimelineEntry[] = [
  { order: 0, label: '찾다', kind: 'observation', note: '획득이 대상을 먼저 봐야 한다', badge: '브레이크 없음' },
  { order: 1, label: '획득', kind: 'cost', note: '생산이 치를 재고를 여기서 세운다' },
  { order: 2, label: '생산', kind: 'goal', note: '충족을 여기서 낸다', emphasis: true },
];

describe('P5-c 공용 타임라인 뷰', () => {
  test('걸음이 순서대로 서고 번호가 화면에 적힌다', () => {
    const view = timelineView(STEPS);
    const marks = findByClass(view, 'timeline-mark');
    assert.equal(marks.length, 3);
    assert.deepEqual(
      marks.map((mark) => textOf(mark)),
      ['0', '1', '2'],
    );
    assert.deepEqual(
      findByClass(view, 'timeline-label').map((label) => textOf(label)),
      ['찾다', '획득', '생산'],
    );
  });

  test('마지막 걸음 뒤에는 화살표가 없다 — 사슬이 거기서 끝난다', () => {
    assert.equal(findByClass(timelineView(STEPS), 'timeline-arrow').length, 2);
    assert.equal(findByClass(timelineView([STEPS[0] as TimelineEntry]), 'timeline-arrow').length, 0);
  });

  test('갈래마다 색이 갈리고 목적 걸음은 눈에 띈다', () => {
    const view = timelineView(STEPS);
    const html = toHtml(view);
    for (const kind of ['observation', 'cost', 'goal'] as const) {
      assert.ok(html.includes(STEP_COLORS[kind] as string), kind);
      assert.ok(html.includes(`data-kind="${kind}"`), kind);
    }
    assert.equal(findAll(view, (node) => (node.attrs?.['class'] ?? '').includes('is-goal')).length, 1);
  });

  test('왜 그 자리인지가 걸음마다 붙는다', () => {
    const view = timelineView(STEPS);
    assert.deepEqual(
      findByClass(view, 'timeline-note').map((note) => textOf(note)),
      ['획득이 대상을 먼저 봐야 한다', '생산이 치를 재고를 여기서 세운다', '충족을 여기서 낸다'],
    );
    // 배지는 있는 걸음에만 붙는다 — 없는 것을 빈칸으로 그리지 않는다.
    assert.equal(findByClass(view, 'timeline-badge').length, 1);
  });

  test('걸음이 없어도 죽지 않는다 — 비었다는 것도 결과다', () => {
    const view = timelineView([], { emptyText: '고를 것이 없어 계획도 없다' });
    assert.equal(textOf(view), '고를 것이 없어 계획도 없다');
    // 빈칸(.empty)으로 흘리지 않는다 — 여기서의 0 걸음은 빠뜨림이 아니라 결과다.
    assert.equal(findByClass(view, 'empty').length, 0);
    assert.equal(textOf(timelineView([])), '(걸음이 없다)');
  });

  test('설명과 범례가 함께 선다', () => {
    const view = timelineView(STEPS, { caption: '왼쪽이 먼저다' });
    assert.equal(findByClass(view, 'graph-caption').length, 1);
    const legend = stepLegend([
      { kind: 'observation', label: '봐야 한다' },
      { kind: 'cost', label: '치러야 한다' },
      { kind: 'goal', label: '목적' },
    ]);
    assert.equal(findAll(legend, (node) => node.tag === 'li').length, 3);
    assert.equal(findByClass(legend, 'legend-swatch').length, 3);
  });

  test('같은 걸음이면 같은 그림이다 — 순서가 곧 배치다', () => {
    assert.equal(stateHash(timelineView(STEPS)), stateHash(timelineView(STEPS)));
    // 순서를 바꾸면 그림이 바뀐다 — 같은 원자들이라도 순서가 다르면 다른 계획이다.
    assert.notEqual(
      stateHash(timelineView(STEPS)),
      stateHash(timelineView([...STEPS].reverse())),
    );
  });
});
