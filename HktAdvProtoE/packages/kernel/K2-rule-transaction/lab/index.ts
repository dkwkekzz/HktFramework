import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createK2Module } from '../src/module.js';
import { k2Scenarios } from '../scenarios/index.js';

export const k2Module = createK2Module(k2Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 규칙 처리는 무작위성을 쓰지 않는다. */
export function runK2Scenarios(seedOffset = 0n): ScenarioRun[] {
  return k2Scenarios.map((scenario) => runScenario(scenario, k2Module.id, scenario.seed + seedOffset));
}

export function runK2Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = k2Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, k2Module.id, scenario.seed + seedOffset);
}

export const k2ScenarioCount = k2Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: k2Module.id,
  version: k2Module.version,
  purpose: k2Module.purpose,
  scenarioIds: k2Scenarios.map((scenario) => scenario.id),
  run: runK2Scenarios,
};
