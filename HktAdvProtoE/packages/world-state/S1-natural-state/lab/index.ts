import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createS1Module } from '../src/module.js';
import { s1Scenarios } from '../scenarios/index.js';

export const s1Module = createS1Module(s1Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 세계 시드는 장면이 스스로 정한다. */
export function runS1Scenarios(seedOffset = 0n): ScenarioRun[] {
  return s1Scenarios.map((scenario) => runScenario(scenario, s1Module.id, scenario.seed + seedOffset));
}

export function runS1Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = s1Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, s1Module.id, scenario.seed + seedOffset);
}

export const s1ScenarioCount = s1Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: s1Module.id,
  version: s1Module.version,
  purpose: s1Module.purpose,
  scenarioIds: s1Scenarios.map((scenario) => scenario.id),
  run: runS1Scenarios,
};
