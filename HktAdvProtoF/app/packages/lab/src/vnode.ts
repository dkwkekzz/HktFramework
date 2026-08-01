// V3 화면 노드 — 렌더러의 출력은 DOM 이 아니라 **직렬화 가능한 트리**다.
//
// 왜: 원칙 ③ 은 "모든 개념은 최소 세계 상태 원소(직렬화 가능한 데이터)로 환원된다" 고 못박는다.
// 화면도 예외가 아니다. 렌더러가 순수 함수 `상태 → VNode` 이면
//   ① 브라우저 없이 node:test 로 화면을 단언할 수 있고
//   ② 화면 자체를 stateHash 로 비교할 수 있으며
//   ③ 브라우저는 VNode 를 DOM 으로 옮기기만 하면 된다 (mount.ts).

/** 화면 노드. 문자열은 텍스트 노드다. */
export type VNode = string | VElement;

export interface VElement {
  readonly tag: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly children?: readonly VNode[];
}

/** 노드를 만든다. */
export function h(
  tag: string,
  attrs: Readonly<Record<string, string>> = {},
  children: readonly VNode[] = [],
): VElement {
  const node: { tag: string; attrs?: Readonly<Record<string, string>>; children?: readonly VNode[] } = { tag };
  if (Object.keys(attrs).length > 0) node.attrs = attrs;
  if (children.length > 0) node.children = children;
  return node as VElement;
}

/** 트리에서 조건에 맞는 원소를 전부 찾는다 (테스트·시나리오용). */
export function findAll(node: VNode, predicate: (element: VElement) => boolean): VElement[] {
  if (typeof node === 'string') return [];
  const found = predicate(node) ? [node] : [];
  for (const child of node.children ?? []) found.push(...findAll(child, predicate));
  return found;
}

/** class 속성에 해당 클래스가 있는 원소를 찾는다. */
export function findByClass(node: VNode, className: string): VElement[] {
  return findAll(node, (element) => (element.attrs?.['class'] ?? '').split(/\s+/).includes(className));
}

/** 트리의 모든 텍스트를 이어 붙인다 — "화면에 이 글자가 보이는가" 를 단언할 때 쓴다. */
export function textOf(node: VNode): string {
  if (typeof node === 'string') return node;
  return (node.children ?? []).map((child) => textOf(child)).join('');
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeText(text).replace(/"/g, '&quot;');
}

/** VNode → HTML 문자열. 브라우저 없이 화면을 확인하거나 정적 페이지를 뽑을 때 쓴다. */
export function toHtml(node: VNode): string {
  if (typeof node === 'string') return escapeText(node);
  const attrs = Object.entries(node.attrs ?? {})
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join('');
  if (VOID_TAGS.has(node.tag)) return `<${node.tag}${attrs}>`;
  const children = (node.children ?? []).map((child) => toHtml(child)).join('');
  return `<${node.tag}${attrs}>${children}</${node.tag}>`;
}
