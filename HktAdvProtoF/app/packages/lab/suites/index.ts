// Lab 이 아는 전체 시나리오 — 아래 계층(scenarios)의 등록부에 V3 을 얹는다.
// V3 시나리오가 여기 있는 이유: 화면을 검증하려면 Lab 을 import 해야 하고,
// scenarios 패키지가 Lab 을 import 하면 순환이 된다. 의존 순서는 core → contracts → scenarios → lab.

import type { AnyScenario } from '@hkt/scenarios';
import { allScenarios as lowerScenarios } from '@hkt/scenarios/suites';

import { v3Scenarios } from './v3.ts';

export const allScenarios: readonly AnyScenario[] = [...lowerScenarios, ...v3Scenarios];

export { v3Scenarios };
