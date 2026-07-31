import { runScenario, type ScenarioRun } from '@hkt/v0-module-contract';
import { createK3Module } from '../src/module.js';
import { k3Scenarios } from '../scenarios/index.js';

export const k3Module = createK3Module(k3Scenarios);

/**
 * Lab 의 [다른 시드] 는 장면의 시드만 바꾼다.
 *
 * 세계의 시드(`worldSeed`)는 장면이 스스로 정한다 — 그것까지 바꾸면 "같은 시드면 같은 재생"을
 * 확인할 수 없다.
 */
export function runK3Scenarios(seedOffset = 0n): ScenarioRun[] {
  return k3Scenarios.map((scenario) => runScenario(scenario, k3Module.id, scenario.seed + seedOffset));
}

export function runK3Scenario(index: number, seedOffset = 0n): ScenarioRun {
  const scenario = k3Scenarios[index];
  if (!scenario) throw new RangeError(`시나리오 인덱스 범위를 벗어났다: ${index}`);
  return runScenario(scenario, k3Module.id, scenario.seed + seedOffset);
}

export const k3ScenarioCount = k3Scenarios.length;

/** Lab 등록 규약 — 형태 설명은 V0 의 `lab/index.ts` 참조. */
export const labModule = {
  id: k3Module.id,
  version: k3Module.version,
  purpose: k3Module.purpose,
  scenarioIds: k3Scenarios.map((scenario) => scenario.id),
  run: runK3Scenarios,
};
