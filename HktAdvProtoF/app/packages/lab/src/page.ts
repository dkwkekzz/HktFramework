// V3 Lab 페이지 셸 — 모든 모듈 페이지는 화면 7요소를 갖는다 (원문 V3).
//   ① 입력 ② 처리 과정 ③ 후보 결과 ④ 선택 결과 ⑤ 상태 전후 ⑥ 실패 이유 ⑦ 인과관계
// 섹션을 비워 두는 것은 허용하지만, 비었다는 사실이 화면에 드러난다 — 빠뜨림이 숨지 않는다.

import { h, type VElement, type VNode } from './vnode.ts';

/** 7요소의 순서와 이름은 고정이다. */
export const SECTION_KEYS = [
  'input',
  'process',
  'candidates',
  'selection',
  'beforeAfter',
  'failure',
  'causality',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_TITLES: Readonly<Record<SectionKey, string>> = {
  input: '① 입력',
  process: '② 처리 과정',
  candidates: '③ 후보 결과',
  selection: '④ 선택 결과',
  beforeAfter: '⑤ 상태 전후',
  failure: '⑥ 실패 이유',
  causality: '⑦ 인과관계',
};

export interface PageSpec {
  /** 모듈 ID */
  readonly id: string;
  readonly title: string;
  /** 이 모듈의 목적 한 문장 */
  readonly purpose: string;
  /** 판정 배지 — 페이지 상단에 크게 */
  readonly verdict: { readonly passed: boolean; readonly label: string };
  readonly sections: Partial<Record<SectionKey, VNode | readonly VNode[]>>;
}

function sectionBody(content: VNode | readonly VNode[] | undefined): readonly VNode[] {
  if (content === undefined) {
    return [h('p', { class: 'empty' }, ['(이 모듈에는 해당 없음)'])];
  }
  return Array.isArray(content) ? (content as readonly VNode[]) : [content as VNode];
}

/** 모듈 페이지 하나를 그린다. */
export function pageView(spec: PageSpec): VElement {
  return h('main', { class: 'page', 'data-module': spec.id }, [
    h('header', { class: 'page-header' }, [
      h('h1', {}, [`${spec.id} — ${spec.title}`]),
      h('p', { class: 'purpose' }, [spec.purpose]),
      h('p', { class: spec.verdict.passed ? 'verdict ok' : 'verdict bad' }, [
        `${spec.verdict.passed ? '✔' : '✘'} ${spec.verdict.label}`,
      ]),
    ]),
    ...SECTION_KEYS.map((key) =>
      h('section', { class: 'section', 'data-section': key }, [
        h('h2', {}, [SECTION_TITLES[key]]),
        ...sectionBody(spec.sections[key]),
      ]),
    ),
  ]);
}

/** 목록 유틸 — 문장 여러 줄을 한 덩이로. */
export function lines(...texts: readonly string[]): VElement {
  return h('ul', { class: 'lines' }, texts.map((text) => h('li', {}, [text])));
}
