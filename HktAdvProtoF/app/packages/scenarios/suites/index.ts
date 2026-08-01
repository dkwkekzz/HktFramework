// 전 모듈 시나리오 등록부 — 모듈이 늘어날 때마다 여기에 붙인다.
// 실행 순서는 실행기가 (모듈, 종류, ID) 로 고정하므로 등록 순서는 결과에 영향을 주지 않는다.

import type { AnyScenario } from '../src/index.ts';

import { v0Scenarios } from './v0.ts';
import { v1Scenarios } from './v1.ts';
import { v2Scenarios } from './v2.ts';
import { v4Scenarios } from './v4.ts';
import { o1Scenarios } from './o1.ts';

export const allScenarios: readonly AnyScenario[] = [
  ...v0Scenarios,
  ...v1Scenarios,
  ...v2Scenarios,
  ...v4Scenarios,
  ...o1Scenarios,
];

export { v0Scenarios, v1Scenarios, v2Scenarios, v4Scenarios, o1Scenarios };
