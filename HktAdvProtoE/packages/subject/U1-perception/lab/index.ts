import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createU1Module } from '../src/module.js';
import { u1Scenarios } from '../scenarios/index.js';

export const u1Module = createU1Module(u1Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 세계 시드는 장면이 스스로 정한다. */
export function runU1Scenarios(seedOffset = 0n): ScenarioRun[] {
  return u1Scenarios.map((scenario) => runScenario(scenario, u1Module.id, scenario.seed + seedOffset));
}

export function runU1Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = u1Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, u1Module.id, scenario.seed + seedOffset);
}

export const u1ScenarioCount = u1Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: u1Module.id,
  version: u1Module.version,
  purpose: u1Module.purpose,
  scenarioIds: u1Scenarios.map((scenario) => scenario.id),
  run: runU1Scenarios,
};
