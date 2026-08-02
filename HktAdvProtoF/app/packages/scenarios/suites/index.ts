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
};
