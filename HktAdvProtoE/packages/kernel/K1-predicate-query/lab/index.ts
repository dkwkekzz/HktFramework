import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createK1Module } from '../src/module.js';
import { k1Scenarios } from '../scenarios/index.js';

export const k1Module = createK1Module(k1Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 질의는 무작위성을 쓰지 않는다. */
export function runK1Scenarios(seedOffset = 0n): ScenarioRun[] {
  return k1Scenarios.map((scenario) => runScenario(scenario, k1Module.id, scenario.seed + seedOffset));
}

export function runK1Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = k1Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, k1Module.id, scenario.seed + seedOffset);
}

export const k1ScenarioCount = k1Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: k1Module.id,
  version: k1Module.version,
  purpose: k1Module.purpose,
  scenarioIds: k1Scenarios.map((scenario) => scenario.id),
  run: runK1Scenarios,
};
