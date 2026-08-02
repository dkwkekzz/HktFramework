// VNode → DOM. 브라우저에서만 쓰이는 유일한 조각이며, 판단 로직을 담지 않는다.

import type { VNode } from './vnode.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG 안에서만 뜻이 있는 태그들 — 그래프 뷰(D1-d)가 쓴다. */
const SVG_TAGS = new Set([
  'svg',
  'g',
  'rect',
  'circle',
  'line',
  'path',
  'text',
  'defs',
  'marker',
  'polygon',
  'title',
]);

function create(node: VNode, doc: Document, svg = false): Node {
  if (typeof node === 'string') return doc.createTextNode(node);
  const inSvg = svg || node.tag === 'svg';
  // SVG 원소는 네임스페이스가 달라야 그려진다 — createElement 로 만들면 화면에 아무것도 안 나온다.
  const element =
    inSvg && SVG_TAGS.has(node.tag)
      ? doc.createElementNS(SVG_NS, node.tag)
      : doc.createElement(node.tag);
  for (const [key, value] of Object.entries(node.attrs ?? {})) element.setAttribute(key, value);
  for (const child of node.children ?? []) {
    element.appendChild(create(child, doc, inSvg && SVG_TAGS.has(node.tag)));
  }
  return element;
}

/** 대상 원소의 내용을 VNode 로 갈아 끼운다. */
export function mount(node: VNode, target: Element, doc: Document = target.ownerDocument): void {
  target.replaceChildren(create(node, doc));
}
