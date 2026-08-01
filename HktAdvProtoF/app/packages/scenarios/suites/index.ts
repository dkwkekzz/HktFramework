// 전 모듈 시나리오 등록부 — 모듈이 늘어날 때마다 여기에 붙인다.
// 실행 순서는 실행기가 (모듈, 종류, ID) 로 고정하므로 등록 순서는 결과에 영향을 주지 않는다.

import type { AnyScenario } from '../src/index.ts';

import { v1Scenarios } from './v1.ts';
import { v2Scenarios } from './v2.ts';

export const allScenarios: readonly AnyScenario[] = [...v1Scenarios, ...v2Scenarios];

export { v1Scenarios, v2Scenarios };
