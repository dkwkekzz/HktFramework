import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createU0Module } from '../src/module.js';
import { u0Scenarios } from '../scenarios/index.js';

export const u0Module = createU0Module(u0Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 세계 시드는 장면이 스스로 정한다. */
export function runU0Scenarios(seedOffset = 0n): ScenarioRun[] {
  return u0Scenarios.map((scenario) => runScenario(scenario, u0Module.id, scenario.seed + seedOffset));
}

export function runU0Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = u0Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, u0Module.id, scenario.seed + seedOffset);
}

export const u0ScenarioCount = u0Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: u0Module.id,
  version: u0Module.version,
  purpose: u0Module.purpose,
  scenarioIds: u0Scenarios.map((scenario) => scenario.id),
  run: runU0Scenarios,
};
