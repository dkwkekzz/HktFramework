import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createK0Module } from '../src/module.js';
import { k0Scenarios } from '../scenarios/index.js';

export const k0Module = createK0Module(k0Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — K0 의 결과는 시드에 의존하지 않는다(저장소는 결정적이다). */
export function runK0Scenarios(seedOffset = 0n): ScenarioRun[] {
  return k0Scenarios.map((scenario) => runScenario(scenario, k0Module.id, scenario.seed + seedOffset));
}

export function runK0Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = k0Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, k0Module.id, scenario.seed + seedOffset);
}

export const k0ScenarioCount = k0Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: k0Module.id,
  version: k0Module.version,
  purpose: k0Module.purpose,
  scenarioIds: k0Scenarios.map((scenario) => scenario.id),
  run: runK0Scenarios,
};
