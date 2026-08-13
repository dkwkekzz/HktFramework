// Cycle Scope — "어느 Cycle 까지의 게임을 굴릴 것인가".
//
// Scope 는 World 의 실행 범위일 뿐 View 계약이 아니다(원칙 12~14). Scope 가 줄면
// GameView Snapshot 이 그만큼 과거의 모습으로 산출될 뿐이다.

import type { CycleModule } from './module';

export interface CycleScope {
  /** 어느 Cycle 까지 포함하는가 */
  target: string;
  /** 포함된 Cycle 들 (진행 순서) */
  cycles: readonly string[];
  /** 합성 대상 모듈 (진행 순서 — 뒤가 앞을 덮는다) */
  modules: readonly CycleModule[];
  /** target 이 마지막 Cycle 인가 = 현재 게임 전체인가 */
  isLatest: boolean;
  /** 해당 Cycle 이 Scope 안에 있는가 */
  has(cycle: string): boolean;
}

export class UnknownCycleError extends Error {
  constructor(requested: string, known: readonly string[]) {
    super(`알 수 없는 Cycle: "${requested}" — 사용 가능: ${known.join(', ')}`);
    this.name = 'UnknownCycleError';
  }
}

/** 마지막 Cycle = 현재 게임 */
export function latestOf(modules: readonly CycleModule[]): string {
  const last = modules[modules.length - 1];
  if (!last) throw new Error('Cycle Registry 가 비어 있다 — 실행 가능한 Cycle 이 없다');
  return last.id;
}

/**
 * 실행 범위를 만든다.
 *
 * @param upTo  포함할 마지막 Cycle. `C001` · `C001-stone-mining` · `latest` · 미지정(=latest) 을 받는다.
 * @throws UnknownCycleError  등록되지 않은 Cycle 을 지정한 경우 — 조용히 최신으로 넘어가지 않는다.
 */
export function resolveCycleScope(
  upTo: string | null | undefined,
  registry: readonly CycleModule[],
): CycleScope {
  const known = registry.map((m) => m.id);
  const requested = (upTo ?? '').trim();

  let index: number;
  if (requested === '' || requested.toLowerCase() === 'latest') {
    index = registry.length - 1;
  } else {
    // C001 · C001-stone-mining · c001 모두 같은 Cycle 을 가리킨다
    const key = requested.toLowerCase();
    index = registry.findIndex((m) => m.id.toLowerCase() === key || m.dir.toLowerCase() === key);
  }

  if (index < 0) throw new UnknownCycleError(requested, known);
  const target = registry[index];
  if (!target) throw new Error('Cycle Registry 가 비어 있다 — 실행 가능한 Cycle 이 없다');

  const modules = registry.slice(0, index + 1);
  const cycles = modules.map((m) => m.id);

  return {
    target: target.id,
    cycles,
    modules,
    isLatest: index === registry.length - 1,
    has: (cycle) => cycles.includes(cycle),
  };
}
