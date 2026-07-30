import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createV2Module } from '../src/module.js';
import { v2Scenarios } from '../scenarios/index.js';

export const v2Module = createV2Module(v2Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 장면이 스스로 쓰는 worldSeed 와는 별개다. */
export function runV2Scenarios(seedOffset = 0n): ScenarioRun[] {
  return v2Scenarios.map((scenario) =>
    runScenario(scenario, v2Module.id, scenario.seed + seedOffset),
  );
}

export function runV2Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = v2Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, v2Module.id, scenario.seed + seedOffset);
}

export const v2ScenarioCount = v2Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: v2Module.id,
  version: v2Module.version,
  purpose: v2Module.purpose,
  scenarioIds: v2Scenarios.map((scenario) => scenario.id),
  run: runV2Scenarios,
};
