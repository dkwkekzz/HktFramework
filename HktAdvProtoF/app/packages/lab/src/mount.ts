// VNode → DOM. 브라우저에서만 쓰이는 유일한 조각이며, 판단 로직을 담지 않는다.

import type { VNode } from './vnode.ts';

function create(node: VNode, doc: Document): Node {
  if (typeof node === 'string') return doc.createTextNode(node);
  const element = doc.createElement(node.tag);
  for (const [key, value] of Object.entries(node.attrs ?? {})) element.setAttribute(key, value);
  for (const child of node.children ?? []) element.appendChild(create(child, doc));
  return element;
}

/** 대상 원소의 내용을 VNode 로 갈아 끼운다. */
export function mount(node: VNode, target: Element, doc: Document = target.ownerDocument): void {
  target.replaceChildren(create(node, doc));
}
