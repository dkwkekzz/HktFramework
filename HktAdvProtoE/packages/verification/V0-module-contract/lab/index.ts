import { runScenario, type ScenarioRun } from '../src/contract.js';
import { createV0Module } from '../src/module.js';
import { v0Scenarios } from '../scenarios/index.js';

export const v0Module = createV0Module(v0Scenarios);

/** Lab 의 [다른 시드] 는 시드만 바꾼다 — 결과가 바뀌면 결정성 위반이다. */
export function runV0Scenarios(seedOffset = 0n): ScenarioRun[] {
  return v0Scenarios.map((scenario) =>
    runScenario(scenario, v0Module.id, scenario.seed + seedOffset),
  );
}

/** Lab 의 [1틱 실행] 은 시나리오 하나만 돌린다. */
export function runV0Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = v0Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, v0Module.id, scenario.seed + seedOffset);
}

export const v0ScenarioCount = v0Scenarios.length;
