import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createS0Module } from '../src/module.js';
import { s0Scenarios } from '../scenarios/index.js';

export const s0Module = createS0Module(s0Scenarios);

/** Lab 의 [다른 시드] 는 장면의 시드만 바꾼다 — 공간 계산은 무작위성을 쓰지 않는다. */
export function runS0Scenarios(seedOffset = 0n): ScenarioRun[] {
  return s0Scenarios.map((scenario) => runScenario(scenario, s0Module.id, scenario.seed + seedOffset));
}

export function runS0Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = s0Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, s0Module.id, scenario.seed + seedOffset);
}

export const s0ScenarioCount = s0Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: s0Module.id,
  version: s0Module.version,
  purpose: s0Module.purpose,
  scenarioIds: s0Scenarios.map((scenario) => scenario.id),
  run: runS0Scenarios,
};
