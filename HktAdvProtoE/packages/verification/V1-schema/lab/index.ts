import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createV1Module } from '../src/module.js';
import { v1Scenarios } from '../scenarios/index.js';

export const v1Module = createV1Module(v1Scenarios);

/** Lab 의 [다른 시드] 는 시드만 바꾼다 — 결과가 바뀌면 결정성 위반이다. */
export function runV1Scenarios(seedOffset = 0n): ScenarioRun[] {
  return v1Scenarios.map((scenario) =>
    runScenario(scenario, v1Module.id, scenario.seed + seedOffset),
  );
}

export function runV1Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = v1Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, v1Module.id, scenario.seed + seedOffset);
}

export const v1ScenarioCount = v1Scenarios.length;
