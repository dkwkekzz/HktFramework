// Lab 페이지 등록부 — 모듈 하나당 페이지 하나 (WORKFLOW §5-6 Lab 페이지 의무).

import type { VElement } from '../vnode.ts';

import { v0Page } from './v0.ts';
import { v1Page } from './v1.ts';
import { v2Page } from './v2.ts';
import { v3Page } from './v3.ts';
import { v4Page } from './v4.ts';
import { o0Page } from './o0.ts';
import { o1Page } from './o1.ts';
import { o2Page } from './o2.ts';
import { s0Page } from './s0.ts';
import { s1Page } from './s1.ts';
import { s2Page } from './s2.ts';
import { s3Page } from './s3.ts';
import { d0Page } from './d0.ts';
import { d1Page } from './d1.ts';
import { d2Page } from './d2.ts';
import { d3Page } from './d3.ts';
import { d4Page } from './d4.ts';
import { p0Page } from './p0.ts';
import { p1Page } from './p1.ts';
import { p2Page } from './p2.ts';
import { p3Page } from './p3.ts';
import { p4Page } from './p4.ts';
import { p5Page } from './p5.ts';
import { r0Page } from './r0.ts';
import { r1Page } from './r1.ts';
import { r2Page } from './r2.ts';
import { r3Page } from './r3.ts';

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
  { route: '/o0', id: 'O0', title: '세계관 공리', render: o0Page },
  { route: '/o1', id: 'O1', title: '공통 세계 존재론', render: o1Page },
  { route: '/o2', id: 'O2', title: '상태 스키마', render: o2Page },
  { route: '/s0', id: 'S0', title: '공통 주체 모델', render: s0Page },
  { route: '/s1', id: 'S1', title: '종 원형', render: s1Page },
  { route: '/s2', id: 'S2', title: '문화·역할 원형', render: s2Page },
  { route: '/s3', id: 'S3', title: '개별 주체 생성', render: s3Page },
  { route: '/d0', id: 'D0', title: '의존 대상 타입', render: d0Page },
  { route: '/d1', id: 'D1', title: '의존 그래프 스키마', render: d1Page },
  { route: '/d2', id: 'D2', title: '종 기본 의존 그래프 생성', render: d2Page },
  { route: '/d3', id: 'D3', title: '개인·문화·능력에 의한 의존 변형', render: d3Page },
  { route: '/d4', id: 'D4', title: '의존 충족도 평가', render: d4Page },
  { route: '/p0', id: 'P0', title: '행동 원자', render: p0Page },
  { route: '/p1', id: 'P1', title: '의존 대응 전략 생성', render: p1Page },
  { route: '/p2', id: 'P2', title: '종·문화·개인 가능성 문법', render: p2Page },
  { route: '/p3', id: 'P3', title: '가능성 그래프 지연 확장', render: p3Page },
  { route: '/p4', id: 'P4', title: '목적 선택과 유지', render: p4Page },
  { route: '/p5', id: 'P5', title: '전략과 행동 계획', render: p5Page },
  { route: '/r0', id: 'R0', title: '세계 상태 저장소', render: r0Page },
  { route: '/r1', id: 'R1', title: '사건으로만 바뀌는 세계', render: r1Page },
  { route: '/r2', id: 'R2', title: '사건이 남기는 흔적', render: r2Page },
  { route: '/r3', id: 'R3', title: '감각과 위치에 따른 감지', render: r3Page },
];

/** 라우트로 페이지를 찾는다. 없으면 첫 페이지. */
export function pageFor(route: string): LabPage {
  return LAB_PAGES.find((page) => page.route === route) ?? (LAB_PAGES[0] as LabPage);
}
