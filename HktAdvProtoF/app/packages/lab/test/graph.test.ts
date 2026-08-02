// D1-d 단위 테스트 — 공용 그래프 뷰. 배치는 결정적이고, 빠뜨림은 숨지 않는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '@hkt/core/v1';

import {
  colorOf,
  findAll,
  findByClass,
  graphView,
  layoutGraph,
  textOf,
  toHtml,
  type GraphViewEdge,
  type GraphViewNode,
} from '../src/index.ts';

const KINDS = ['body', 'resource', 'space', 'institution', 'time'];

const NODES: readonly GraphViewNode[] = [
  { id: 'n1', label: '주린 몸', kind: 'body', root: true },
  { id: 'n2', label: '겨울 식량', kind: 'resource' },
  { id: 'n3', label: '사냥터', kind: 'space' },
  { id: 'n4', label: '고개 통행권', kind: 'institution' },
  { id: 'n5', label: '장막 주기', kind: 'time' },
];

const EDGES: readonly GraphViewEdge[] = [
  { from: 'n1', to: 'n2', relation: 'consumes', strength: 0.8 },
  { from: 'n2', to: 'n3', relation: 'requires', strength: 0.6 },
  { from: 'n3', to: 'n4', relation: 'authorized_by', strength: 0.5 },
  { from: 'n3', to: 'n5', relation: 'sustained_by', strength: 0.4 },
];

describe('배치는 뿌리에서의 깊이를 따른다', () => {
  const layout = layoutGraph(NODES, EDGES, ['n1']);

  test('깊이가 열을 정한다', () => {
    assert.deepEqual(
      layout.nodes.map((node) => [node.id, node.depth]),
      [
        ['n1', 0],
        ['n2', 1],
        ['n3', 2],
        ['n4', 3],
        ['n5', 3],
      ],
    );
  });

  test('같은 열의 둘은 같은 x, 다른 y 다', () => {
    const fourth = layout.nodes.filter((node) => node.depth === 3);
    assert.equal(fourth[0]?.x, fourth[1]?.x);
    assert.notEqual(fourth[0]?.y, fourth[1]?.y);
  });

  test('그림의 크기가 노드를 담는다', () => {
    const rightmost = Math.max(...layout.nodes.map((node) => node.x));
    assert.ok(layout.width > rightmost);
    assert.ok(layout.height > Math.max(...layout.nodes.map((node) => node.y)));
  });

  test('뿌리에서 닿지 않는 노드는 숨지 않고 맨 오른쪽에 선다', () => {
    const orphaned = layoutGraph(NODES, EDGES.slice(0, 2), ['n1']);
    const lonely = orphaned.nodes.filter((node) => node.depth === -1);
    assert.deepEqual(lonely.map((node) => node.id), ['n4', 'n5']);
    const reached = orphaned.nodes.filter((node) => node.depth >= 0);
    assert.ok((lonely[0]?.x ?? 0) > Math.max(...reached.map((node) => node.x)));
  });

  test('뿌리가 없으면 전부 닿지 않는다', () => {
    const rootless = layoutGraph(NODES, EDGES, []);
    assert.equal(rootless.nodes.every((node) => node.depth === -1), true);
  });

  test('배치는 결정적이다 — 100번 그려도 같은 그림', () => {
    const hashes = new Set(
      Array.from({ length: 100 }, () => stateHash(layoutGraph(NODES, EDGES, ['n1']))),
    );
    assert.equal(hashes.size, 1);
  });
});

describe('그래프 뷰가 실제로 그린다', () => {
  const view = graphView(NODES, EDGES, ['n1'], {
    kinds: KINDS,
    legend: true,
    kindLabels: { body: '신체', resource: '자원' },
    caption: '몰이꾼 04 의 겨울',
  });

  test('노드 다섯과 간선 넷이 SVG 로 나온다', () => {
    assert.equal(findByClass(view, 'gnode').length, 5);
    assert.equal(findByClass(view, 'gedge').length, 4);
    assert.equal(findAll(view, (element) => element.tag === 'svg').length, 1);
  });

  test('뿌리는 굵은 테두리로 갈린다', () => {
    assert.equal(findByClass(view, 'gnode-root').length, 1);
  });

  test('갈래마다 다른 색이 배정되고 같은 갈래는 언제나 같은 색이다', () => {
    const colors = new Set(KINDS.map((kind) => colorOf(kind, KINDS)));
    assert.equal(colors.size, KINDS.length);
    assert.equal(colorOf('body', KINDS), colorOf('body', KINDS));
    // 목록에 없는 갈래도 색을 얻는다 — 그리지 못하는 노드는 없다
    assert.notEqual(colorOf('없는갈래', KINDS), '');
  });

  test('관계 이름과 범례가 화면에 실린다', () => {
    const text = textOf(view);
    for (const relation of ['consumes', 'requires', 'authorized_by', 'sustained_by']) {
      assert.ok(text.includes(relation), relation);
    }
    assert.ok(text.includes('신체'));
    assert.ok(text.includes('몰이꾼 04 의 겨울'));
  });

  test('문제 있는 노드·간선은 표시가 남는다', () => {
    const broken = graphView(
      NODES.map((node) => (node.id === 'n4' ? { ...node, bad: true } : node)),
      EDGES.map((edge) => (edge.to === 'n4' ? { ...edge, bad: true } : edge)),
      ['n1'],
      { kinds: KINDS },
    );
    assert.equal(findByClass(broken, 'gnode-bad').length, 1);
    assert.equal(findByClass(broken, 'gedge-bad').length, 1);
  });

  test('없는 노드를 가리키는 간선은 그리지 않고 넘어간다', () => {
    const dangling = graphView(NODES, [...EDGES, { from: 'n1', to: 'nowhere', relation: 'requires' }], ['n1']);
    assert.equal(findByClass(dangling, 'gedge').length, 4);
  });

  test('노드가 없으면 없다고 말한다 — 빈 그림은 없음과 구별되지 않는다', () => {
    const empty = graphView([], [], []);
    assert.ok(textOf(empty).includes('그릴 노드가 없다'));
  });

  test('그림도 직렬화된다 — 브라우저 없이 단언한다', () => {
    const html = toHtml(view);
    assert.ok(html.startsWith('<div class="graph-view">'));
    assert.ok(html.includes('<svg'));
    assert.equal(stateHash(view), stateHash(graphView(NODES, EDGES, ['n1'], {
      kinds: KINDS,
      legend: true,
      kindLabels: { body: '신체', resource: '자원' },
      caption: '몰이꾼 04 의 겨울',
    })));
  });
});
