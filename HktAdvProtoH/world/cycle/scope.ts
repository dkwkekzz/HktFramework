// Cycle Scope — "어느 Cycle 까지의 게임을 굴릴 것인가" 를 결정하는 실행 범위.
//
// Scope 는 World 의 실행 범위일 뿐 계약이 아니다. View 는 Scope 를 모른다 —
// Scope 가 줄어들면 GameView Snapshot 이 그만큼 과거의 모습으로 산출될 뿐이다(원칙 12~14).

import { CYCLE_REGISTRY, type CycleEntry, type CycleId } from './registry';

export interface CycleScope {
  /** 어느 Cycle 까지 포함하는가 */
  target: CycleId;
  /** 포함된 Cycle 들 (진행 순서) */
  cycles: readonly CycleId[];
  /** target 이 마지막 Cycle 인가 = 현재 게임 전체인가 */
  isLatest: boolean;
  /** 해당 Cycle 이 Scope 안에 있는가 */
  has(cycle: CycleId): boolean;
  /** 해당 Rule 이 Scope 안의 Cycle 에서 도입되었는가 — 미등록 Rule 은 항상 false */
  allowsRule(ruleId: string): boolean;
}

/** Scope 밖 Rule 이 요청되었을 때의 ActionResult 실패 사유 */
export const OUT_OF_CYCLE_SCOPE = 'out-of-cycle-scope';

export class UnknownCycleError extends Error {
  constructor(requested: string, known: readonly CycleId[]) {
    super(`알 수 없는 Cycle: "${requested}" — 사용 가능: ${known.join(', ')}`);
    this.name = 'UnknownCycleError';
  }
}

/** 등록된 Cycle 목록 (진행 순서) */
export function listCycles(registry: readonly CycleEntry[] = CYCLE_REGISTRY): readonly CycleEntry[] {
  return registry;
}

/** 마지막 Cycle = 현재 게임 */
export function latestCycleId(registry: readonly CycleEntry[] = CYCLE_REGISTRY): CycleId {
  const last = registry[registry.length - 1];
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
  upTo?: string | null,
  registry: readonly CycleEntry[] = CYCLE_REGISTRY,
): CycleScope {
  const known = registry.map((c) => c.id);
  const requested = (upTo ?? '').trim();

  let index: number;
  if (requested === '' || requested.toLowerCase() === 'latest') {
    index = registry.length - 1;
  } else {
    // C001 · C001-stone-mining · c001 모두 같은 Cycle 을 가리킨다
    const key = requested.toLowerCase();
    index = registry.findIndex((c) => c.id.toLowerCase() === key || c.dir.toLowerCase() === key);
  }

  if (index < 0) throw new UnknownCycleError(requested, known);
  const target = registry[index];
  if (!target) throw new Error('Cycle Registry 가 비어 있다 — 실행 가능한 Cycle 이 없다');

  const included = registry.slice(0, index + 1);
  const cycles = included.map((c) => c.id);
  const rules = new Set(included.flatMap((c) => c.rules));

  return {
    target: target.id,
    cycles,
    isLatest: index === registry.length - 1,
    has: (cycle) => cycles.includes(cycle),
    allowsRule: (ruleId) => rules.has(ruleId),
  };
}
