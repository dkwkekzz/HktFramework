// Authoritative World — Cycle 모듈의 합성 결과.
//
// World 는 고정된 구현이 아니라 "Scope 안의 Cycle 을 합성한 것" 이다(원칙 6·9).
// State 는 합성된 World 내부에만 존재하고, 외부는 dispatch / tick / project 로만 접근한다.

import { composeWorld, type World } from './kernel/compose';
import { latestOf, type CycleScope } from './kernel/scope';
import type { CycleModule } from './kernel/module';
import type { WorldSetup as KernelWorldSetup } from './kernel/state';
import { CYCLE_REGISTRY } from './registry';

export interface WorldSetup extends KernelWorldSetup {
  /** Cycle Registry 주입 (테스트용) — 미지정이면 실제 Registry */
  cycleRegistry?: readonly CycleModule[];
}

export function createWorld(setup: WorldSetup = {}): World {
  return composeWorld(setup.cycleRegistry ?? CYCLE_REGISTRY, setup);
}

/** 등록된 Cycle 목록 (진행 순서) */
export function listCycles(
  registry: readonly CycleModule[] = CYCLE_REGISTRY,
): readonly CycleModule[] {
  return registry;
}

/** 마지막 Cycle = 현재 게임 */
export function latestCycleId(registry: readonly CycleModule[] = CYCLE_REGISTRY): string {
  return latestOf(registry);
}

export { CYCLE_REGISTRY } from './registry';
export { NO_RULE } from './kernel/compose';
export { UnknownCycleError, resolveCycleScope } from './kernel/scope';
export type { World } from './kernel/compose';
export type { CycleScope };
export type { CycleModule } from './kernel/module';
export type { WorldState } from './kernel/state';
