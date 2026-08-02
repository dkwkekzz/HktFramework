// 공용 렌더러 ② 그래프 뷰 — 노드와 간선을 실제로 그린다.
// WORKFLOW §6 공용 렌더러 5종 중 두 번째이며, §6-2 대로 별도 작업 카드(D1-d)로 세운다.
//
// 지금까지 그래프는 표로만 폈다(V0 의존 간선 목록·O0 공리↔관문 대조). 표는 "무엇이 무엇에
// 걸리는가" 는 말하지만 **모양**은 말하지 못한다 — 어디가 병목이고 어디가 끊기면 무엇이
// 함께 무너지는지는 선을 봐야 보인다. D 계층부터는 그 모양이 곧 내용이다.
//
// 규칙 둘:
//   ① 배치는 결정적이다. 뿌리에서의 깊이가 열을 정하고, 같은 열 안의 순서는 선언 순서다.
//      난수도, 물리 시뮬레이션도 쓰지 않는다 — 같은 그래프는 같은 그림이어야 화면도 해시된다.
//   ② 출력은 VNode 다. SVG 도 결국 직렬화 가능한 트리이므로 브라우저 없이 단언할 수 있다.

import { h, type VElement } from '../vnode.ts';

/** 그릴 노드 하나 — 렌더러는 core 타입을 모른다. 그릴 것만 받는다. */
export interface GraphViewNode {
  readonly id: string;
  readonly label: string;
  /** 색을 정하는 갈래 (D0 11종 등) */
  readonly kind: string;
  /** 마우스를 올렸을 때의 한 줄 */
  readonly hint?: string;
  /** 뿌리인가 — 테두리가 굵어진다 */
  readonly root?: boolean;
  /** 문제가 있는 노드인가 — 빨강 파선 */
  readonly bad?: boolean;
}

/** 그릴 간선 하나. */
export interface GraphViewEdge {
  readonly from: string;
  readonly to: string;
  /** 선 위에 적히는 이름 (관계 7종 등) */
  readonly relation: string;
  /** 0~1 — 선 굵기 */
  readonly strength?: number;
  readonly bad?: boolean;
}

/** 배치된 노드 하나. */
export interface PlacedNode extends GraphViewNode {
  readonly x: number;
  readonly y: number;
  /** 뿌리에서의 깊이 — 닿지 않으면 -1 */
  readonly depth: number;
}

export interface GraphLayout {
  readonly nodes: readonly PlacedNode[];
  readonly width: number;
  readonly height: number;
}

const NODE_WIDTH = 168;
const NODE_HEIGHT = 38;
const COLUMN_GAP = 84;
const ROW_GAP = 20;
const MARGIN = 16;

/**
 * 배치 — 뿌리에서의 깊이가 열, 같은 열 안의 선언 순서가 행.
 * 뿌리에서 닿지 않는 노드는 맨 오른쪽 열에 따로 세운다 (숨기지 않는다 — 빠뜨림은 보여야 한다).
 */
export function layoutGraph(
  nodes: readonly GraphViewNode[],
  edges: readonly GraphViewEdge[],
  rootIds: readonly string[],
): GraphLayout {
  const depth = new Map<string, number>();
  let frontier = rootIds.filter((id) => nodes.some((node) => node.id === id));
  let level = 0;
  while (frontier.length > 0 && level < nodes.length + 1) {
    const next: string[] = [];
    for (const id of frontier) {
      if (depth.has(id)) continue;
      depth.set(id, level);
      for (const edge of edges) {
        if (edge.from === id && !depth.has(edge.to)) next.push(edge.to);
      }
    }
    frontier = next;
    level += 1;
  }

  const maxDepth = Math.max(0, ...[...depth.values()]);
  const orphanColumn = depth.size === nodes.length ? maxDepth : maxDepth + 1;

  const rows = new Map<number, number>();
  const placed = nodes.map((node): PlacedNode => {
    const found = depth.get(node.id);
    const column = found ?? orphanColumn;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return {
      ...node,
      depth: found ?? -1,
      x: MARGIN + column * (NODE_WIDTH + COLUMN_GAP),
      y: MARGIN + row * (NODE_HEIGHT + ROW_GAP),
    };
  });

  const columns = Math.max(1, ...placed.map((node) => node.x / (NODE_WIDTH + COLUMN_GAP) + 1));
  const tallest = Math.max(1, ...[...rows.values()]);
  return {
    nodes: placed,
    width: MARGIN * 2 + columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP,
    height: MARGIN * 2 + tallest * NODE_HEIGHT + (tallest - 1) * ROW_GAP,
  };
}

/** 갈래별 색 — 이름이 늘어도 목록 순서로 돌아가므로 색이 흔들리지 않는다. */
const PALETTE = [
  '#e5a13a',
  '#5aa9e6',
  '#7fc78f',
  '#d97b7b',
  '#b48ee0',
  '#e0c56e',
  '#6fd0c4',
  '#c98fb0',
  '#8fa9d0',
  '#c0a080',
  '#9aa5b1',
];

/** 갈래 목록에서 색을 정한다 — 같은 갈래는 언제나 같은 색. */
export function colorOf(kind: string, kinds: readonly string[]): string {
  const index = kinds.indexOf(kind);
  return PALETTE[(index < 0 ? kinds.length : index) % PALETTE.length] as string;
}

/** 관계별 선 모양 — 색 대신 파선 패턴으로 갈라 색맹 대비를 흐리지 않는다. */
const DASHES: Readonly<Record<string, string>> = {
  requires: '',
  consumes: '6 3',
  protected_by: '2 3',
  produced_by: '10 4',
  authorized_by: '1 4',
  informed_by: '4 2 1 2',
  sustained_by: '8 2 2 2',
};

export interface GraphViewOptions {
  /** 색을 배정할 갈래 목록 (D0 11종 순서 등) */
  readonly kinds?: readonly string[];
  /** 범례를 그릴 것인가 */
  readonly legend?: boolean;
  /** 갈래의 한국어 이름 (범례 표기) */
  readonly kindLabels?: Readonly<Record<string, string>>;
  readonly caption?: string;
}

/** 노드 하나를 그린다. */
function nodeView(node: PlacedNode, kinds: readonly string[]): VElement {
  const fill = colorOf(node.kind, kinds);
  const classes = ['gnode', node.root === true ? 'gnode-root' : '', node.bad === true ? 'gnode-bad' : '']
    .filter((name) => name !== '')
    .join(' ');
  return h('g', { class: classes, 'data-node': node.id, 'data-kind': node.kind }, [
    h('rect', {
      x: String(node.x),
      y: String(node.y),
      width: String(NODE_WIDTH),
      height: String(NODE_HEIGHT),
      rx: '8',
      fill,
      'fill-opacity': '0.18',
      stroke: fill,
      'stroke-width': node.root === true ? '2.5' : '1.2',
      ...(node.bad === true ? { 'stroke-dasharray': '4 3' } : {}),
    }),
    h('title', {}, [node.hint ?? node.label]),
    h(
      'text',
      {
        x: String(node.x + NODE_WIDTH / 2),
        y: String(node.y + NODE_HEIGHT / 2 + 4),
        'text-anchor': 'middle',
        fill: 'currentColor',
        'font-size': '12',
      },
      [node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label],
    ),
  ]);
}

/** 간선 하나를 그린다 — 오른쪽 면에서 나가 왼쪽 면으로 들어간다. */
function edgeView(edge: GraphViewEdge, placed: readonly PlacedNode[]): VElement | null {
  const from = placed.find((node) => node.id === edge.from);
  const to = placed.find((node) => node.id === edge.to);
  if (from === undefined || to === undefined) return null;

  const forward = to.x >= from.x;
  const x1 = forward ? from.x + NODE_WIDTH : from.x;
  const x2 = forward ? to.x : to.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const y2 = to.y + NODE_HEIGHT / 2;
  const midX = (x1 + x2) / 2;

  return h('g', { class: edge.bad === true ? 'gedge gedge-bad' : 'gedge', 'data-relation': edge.relation }, [
    h('path', {
      d: `M ${String(x1)} ${String(y1)} C ${String(midX)} ${String(y1)}, ${String(midX)} ${String(y2)}, ${String(x2)} ${String(y2)}`,
      fill: 'none',
      stroke: edge.bad === true ? 'var(--bad)' : 'currentColor',
      'stroke-opacity': edge.bad === true ? '0.9' : '0.5',
      'stroke-width': String(1 + (edge.strength ?? 0.5) * 2.4),
      ...(DASHES[edge.relation] === undefined || DASHES[edge.relation] === ''
        ? {}
        : { 'stroke-dasharray': DASHES[edge.relation] as string }),
      'marker-end': 'url(#arrow)',
    }),
    h(
      'text',
      {
        x: String(midX),
        y: String((y1 + y2) / 2 - 4),
        'text-anchor': 'middle',
        fill: 'currentColor',
        'fill-opacity': '0.65',
        'font-size': '10',
      },
      [edge.relation],
    ),
  ]);
}

/** 범례 — 어느 색이 어느 갈래이고 어느 선이 어느 관계인가. */
function legendView(
  kinds: readonly string[],
  relations: readonly string[],
  labels: Readonly<Record<string, string>>,
): VElement {
  return h('div', { class: 'graph-legend' }, [
    h(
      'ul',
      { class: 'legend-kinds' },
      kinds.map((kind) =>
        h('li', {}, [
          h('span', {
            class: 'swatch',
            style: `background:${colorOf(kind, kinds)}`,
          }, []),
          labels[kind] ?? kind,
        ]),
      ),
    ),
    h(
      'ul',
      { class: 'legend-relations' },
      relations.map((relation) => h('li', {}, [h('code', {}, [relation])])),
    ),
  ]);
}

/**
 * 그래프 뷰.
 * 노드가 없으면 그 사실을 화면에 남긴다 — 빈 그림은 "없음" 과 구별되지 않는다.
 */
export function graphView(
  nodes: readonly GraphViewNode[],
  edges: readonly GraphViewEdge[],
  rootIds: readonly string[] = [],
  options: GraphViewOptions = {},
): VElement {
  if (nodes.length === 0) {
    return h('p', { class: 'empty' }, ['(그릴 노드가 없다)']);
  }
  const kinds = options.kinds ?? [...new Set(nodes.map((node) => node.kind))];
  const layout = layoutGraph(nodes, edges, rootIds);
  const drawnEdges = edges
    .map((edge) => edgeView(edge, layout.nodes))
    .filter((view): view is VElement => view !== null);

  const svg = h(
    'svg',
    {
      class: 'graph-svg',
      viewBox: `0 0 ${String(layout.width)} ${String(layout.height)}`,
      width: String(layout.width),
      height: String(layout.height),
      role: 'img',
    },
    [
      h('defs', {}, [
        h(
          'marker',
          {
            id: 'arrow',
            viewBox: '0 0 10 10',
            refX: '9',
            refY: '5',
            markerWidth: '6',
            markerHeight: '6',
            orient: 'auto-start-reverse',
          },
          [h('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'currentColor', 'fill-opacity': '0.6' }, [])],
        ),
      ]),
      ...drawnEdges,
      ...layout.nodes.map((node) => nodeView(node, kinds)),
    ],
  );

  const children: VElement[] = [svg];
  if (options.caption !== undefined) {
    children.push(h('p', { class: 'graph-caption' }, [options.caption]));
  }
  if (options.legend === true) {
    children.push(
      legendView(kinds, [...new Set(edges.map((edge) => edge.relation))], options.kindLabels ?? {}),
    );
  }
  return h('div', { class: 'graph-view' }, children);
}
