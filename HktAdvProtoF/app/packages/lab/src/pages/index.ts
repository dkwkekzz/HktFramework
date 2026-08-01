// Lab 페이지 등록부 — 모듈 하나당 페이지 하나 (WORKFLOW §5-6 Lab 페이지 의무).

import type { VElement } from '../vnode.ts';

import { v0Page } from './v0.ts';
import { v1Page } from './v1.ts';
import { v2Page } from './v2.ts';
import { v3Page } from './v3.ts';
import { v4Page } from './v4.ts';
import { o1Page } from './o1.ts';

export interface LabPage {
  /** 해시 라우트 (`#/v1`) */
  readonly route: string;
  readonly id: string;
  readonly title: string;
  readonly render: () => VElement;
}

export const LAB_PAGES: readonly LabPage[] = [
  { route: '/v0', id: 'V0', title: '모듈 계약 레지스트리', render: v0Page },
  { route: '/v1', id: 'V1', title: '결정적 실행 환경', render: v1Page },
  { route: '/v2', id: 'V2', title: '시나리오 실행기', render: v2Page },
  { route: '/v3', id: 'V3', title: '브라우저 검증 Lab', render: v3Page },
  { route: '/v4', id: 'V4', title: '완료 증거 시스템', render: v4Page },
  { route: '/o1', id: 'O1', title: '공통 세계 존재론', render: o1Page },
];

/** 라우트로 페이지를 찾는다. 없으면 첫 페이지. */
export function pageFor(route: string): LabPage {
  return LAB_PAGES.find((page) => page.route === route) ?? (LAB_PAGES[0] as LabPage);
}
