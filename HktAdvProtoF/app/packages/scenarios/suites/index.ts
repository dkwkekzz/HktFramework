// 전 모듈 시나리오 등록부 — 모듈이 늘어날 때마다 여기에 붙인다.
// 실행 순서는 실행기가 (모듈, 종류, ID) 로 고정하므로 등록 순서는 결과에 영향을 주지 않는다.

import type { AnyScenario } from '../src/index.ts';

import { v0Scenarios } from './v0.ts';
import { v1Scenarios } from './v1.ts';
import { v2Scenarios } from './v2.ts';
import { v4Scenarios } from './v4.ts';
import { o0Scenarios } from './o0.ts';
import { o1Scenarios } from './o1.ts';
import { o2Scenarios } from './o2.ts';
import { s0Scenarios } from './s0.ts';
import { s1Scenarios } from './s1.ts';
import { s2Scenarios } from './s2.ts';
import { s3Scenarios } from './s3.ts';
import { d0Scenarios } from './d0.ts';
import { d1Scenarios } from './d1.ts';
import { d2Scenarios } from './d2.ts';
import { d3Scenarios } from './d3.ts';
import { d4Scenarios } from './d4.ts';
import { p0Scenarios } from './p0.ts';
import { p1Scenarios } from './p1.ts';
import { p2Scenarios } from './p2.ts';
import { p3Scenarios } from './p3.ts';

export const allScenarios: readonly AnyScenario[] = [
  ...v0Scenarios,
  ...v1Scenarios,
  ...v2Scenarios,
  ...v4Scenarios,
  ...o0Scenarios,
  ...o1Scenarios,
  ...o2Scenarios,
  ...s0Scenarios,
  ...s1Scenarios,
  ...s2Scenarios,
  ...s3Scenarios,
  ...d0Scenarios,
  ...d1Scenarios,
  ...d2Scenarios,
  ...d3Scenarios,
  ...d4Scenarios,
  ...p0Scenarios,
  ...p1Scenarios,
  ...p2Scenarios,
  ...p3Scenarios,
];

export {
  v0Scenarios,
  v1Scenarios,
  v2Scenarios,
  v4Scenarios,
  o0Scenarios,
  o1Scenarios,
  o2Scenarios,
  s0Scenarios,
  s1Scenarios,
  s2Scenarios,
  s3Scenarios,
  d0Scenarios,
  d1Scenarios,
  d2Scenarios,
  d3Scenarios,
  d4Scenarios,
  p0Scenarios,
  p1Scenarios,
  p2Scenarios,
  p3Scenarios,
};
