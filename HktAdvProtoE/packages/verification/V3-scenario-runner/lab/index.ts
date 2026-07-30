import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createV3Module } from '../src/module.js';
import { v3Scenarios } from '../scenarios/index.js';

export const v3Module = createV3Module(v3Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 장면 안의 시나리오가 쓰는 worldSeed 와는 별개다. */
export function runV3Scenarios(seedOffset = 0n): ScenarioRun[] {
  return v3Scenarios.map((scenario) =>
    runScenario(scenario, v3Module.id, scenario.seed + seedOffset),
  );
}

export function runV3Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = v3Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, v3Module.id, scenario.seed + seedOffset);
}

export const v3ScenarioCount = v3Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: v3Module.id,
  version: v3Module.version,
  purpose: v3Module.purpose,
  scenarioIds: v3Scenarios.map((scenario) => scenario.id),
  run: runV3Scenarios,
};
