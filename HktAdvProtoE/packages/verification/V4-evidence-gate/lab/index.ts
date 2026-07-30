import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createV4Module } from '../src/module.js';
import { v4Scenarios } from '../scenarios/index.js';

export const v4Module = createV4Module(v4Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 장면 안의 합성 저장소와는 별개다. */
export function runV4Scenarios(seedOffset = 0n): ScenarioRun[] {
  return v4Scenarios.map((scenario) =>
    runScenario(scenario, v4Module.id, scenario.seed + seedOffset),
  );
}

export function runV4Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = v4Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, v4Module.id, scenario.seed + seedOffset);
}

export const v4ScenarioCount = v4Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: v4Module.id,
  version: v4Module.version,
  purpose: v4Module.purpose,
  scenarioIds: v4Scenarios.map((scenario) => scenario.id),
  run: runV4Scenarios,
};
