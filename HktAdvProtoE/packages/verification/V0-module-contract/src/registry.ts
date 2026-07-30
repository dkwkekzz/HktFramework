import type { VerificationIssue } from './contract.js';
import { parseModuleContract } from './parse.js';
import { sha256Tagged } from './sha256.js';
import {
  ISSUE,
  type ModuleContract,
  type ModuleContractDocument,
  type ModuleRegistry,
  type RegistrationReport,
  type RejectedDocument,
} from './types.js';

/**
 * 계약 문서 집합을 모듈 레지스트리로 만든다.
 *
 * 결함이 있는 문서만 거부하고 나머지는 등록한다. 거부된 모듈을 선행으로 삼는 모듈은
 * 연쇄로 거부한다(원문 「4」의 `BLOCKED` = 선행 모듈이 검증되지 않음 과 같은 방향).
 *
 * 입력 문서의 배열 순서에 결과가 의존하지 않는다 — 모든 중간 단계를 경로/id 오름차순으로 고정한다.
 */
export function buildRegistry(documents: readonly ModuleContractDocument[]): RegistrationReport {
  const sorted = [...documents].sort((a, b) => compare(a.path, b.path));

  const accepted = new Map<string, ModuleContract>();
  const rejected = new Map<string, RejectedDocument>();
  const issues: VerificationIssue[] = [];

  const reject = (path: string, id: string | null, docIssues: VerificationIssue[]): void => {
    const existing = rejected.get(path);
    if (existing) {
      rejected.set(path, { path, id: existing.id ?? id, issues: [...existing.issues, ...docIssues] });
    } else {
      rejected.set(path, { path, id, issues: docIssues });
    }
    issues.push(...docIssues);
  };

  // 1) 문서 단위 파싱·구조 검증
  const parsed: { path: string; id: string | null; contract: ModuleContract | null }[] = [];
  for (const doc of sorted) {
    const result = parseModuleContract(doc);
    parsed.push({ path: doc.path, id: result.id, contract: result.contract });
    if (result.contract === null) reject(doc.path, result.id, result.issues);
  }

  // 2) id 중복 — 어느 쪽도 등록하지 않는다 (임의 선택은 결정적이지만 은폐가 된다)
  const byId = new Map<string, string[]>();
  for (const entry of parsed) {
    if (entry.contract === null) continue;
    const paths = byId.get(entry.contract.id) ?? [];
    paths.push(entry.path);
    byId.set(entry.contract.id, paths);
  }
  const duplicated = new Set<string>();
  for (const [id, paths] of [...byId].sort((a, b) => compare(a[0], b[0]))) {
    if (paths.length < 2) continue;
    duplicated.add(id);
    for (const path of paths) {
      reject(path, id, [
        {
          code: ISSUE.DUPLICATE_ID,
          path: `${path}#/id`,
          message: `id \`${id}\` 가 중복 선언되었다: ${paths.join(', ')}`,
        },
      ]);
    }
  }

  for (const entry of parsed) {
    if (entry.contract === null) continue;
    if (duplicated.has(entry.contract.id)) continue;
    accepted.set(entry.contract.id, entry.contract);
  }

  // 3) 자기 참조
  for (const id of [...accepted.keys()].sort(compare)) {
    const contract = accepted.get(id) as ModuleContract;
    if (!contract.dependsOn.includes(id)) continue;
    accepted.delete(id);
    reject(contract.sourcePath, id, [
      {
        code: ISSUE.SELF_DEPENDENCY,
        path: `${contract.sourcePath}#/depends_on`,
        message: `모듈 \`${id}\` 가 자신을 선행으로 선언했다.`,
      },
    ]);
  }

  // 4) 미등록/거부된 선행 참조 — 고정점까지 연쇄 거부
  const knownIds = new Set<string>(
    parsed.map((entry) => entry.id).filter((id): id is string => id !== null),
  );
  for (;;) {
    let removed = false;
    for (const id of [...accepted.keys()].sort(compare)) {
      const contract = accepted.get(id) as ModuleContract;
      const missing = contract.dependsOn.filter((dep) => !accepted.has(dep));
      if (missing.length === 0) continue;
      accepted.delete(id);
      removed = true;
      reject(
        contract.sourcePath,
        id,
        missing.map((dep) => ({
          code: knownIds.has(dep) ? ISSUE.DEPENDENCY_REJECTED : ISSUE.UNKNOWN_DEPENDENCY,
          path: `${contract.sourcePath}#/depends_on`,
          message: knownIds.has(dep)
            ? `선행 모듈 \`${dep}\` 의 계약이 거부되어 \`${id}\` 도 등록할 수 없다.`
            : `선행 모듈 \`${dep}\` 이 등록되어 있지 않다.`,
        })),
      );
    }
    if (!removed) break;
  }

  // 5) 순환 — 위상 정렬로 남는 노드를 걸러낸다
  const { order, leftover } = topologicalOrder(accepted);
  if (leftover.length > 0) {
    // 판정은 삭제 전 스냅샷으로 한다 — 삭제하며 판정하면 뒤 노드의 순환이 보이지 않는다.
    const snapshot = new Map(accepted);
    for (const id of leftover) {
      const contract = snapshot.get(id) as ModuleContract;
      const onCycle = isOnCycle(id, snapshot);
      accepted.delete(id);
      reject(contract.sourcePath, id, [
        {
          code: onCycle ? ISSUE.DEPENDENCY_CYCLE : ISSUE.DEPENDENCY_REJECTED,
          path: `${contract.sourcePath}#/depends_on`,
          message: onCycle
            ? `의존성 순환에 포함되어 있다: ${describeCycle(id, snapshot, leftover)}`
            : `순환에 포함된 선행 모듈에 의존한다: ${contract.dependsOn.join(', ')}`,
        },
      ]);
    }
  }

  const finalOrder =
    leftover.length > 0 ? topologicalOrder(accepted).order : order;

  const modules = [...accepted.values()].sort((a, b) => compare(a.id, b.id));
  const dependents: Record<string, string[]> = {};
  for (const contract of modules) dependents[contract.id] = [];
  for (const contract of modules) {
    for (const dep of contract.dependsOn) {
      (dependents[dep] as string[]).push(contract.id);
    }
  }
  for (const key of Object.keys(dependents)) {
    (dependents[key] as string[]).sort(compare);
  }

  const registry: ModuleRegistry = {
    modules,
    order: finalOrder,
    dependents,
    hash: sha256Tagged(canonicalize(modules)),
  };

  return {
    registry,
    registered: modules.map((m) => m.id),
    rejected: [...rejected.values()].sort((a, b) => compare(a.path, b.path)),
    issues,
  };
}

/**
 * 위상 정렬. 동시에 선택 가능한 노드가 여럿이면 id 오름차순으로 깨서 결정적으로 만든다.
 * 순환에 걸려 배출되지 않은 노드는 leftover 로 돌려준다.
 */
export function topologicalOrder(modules: ReadonlyMap<string, ModuleContract>): {
  order: string[];
  leftover: string[];
} {
  const indegree = new Map<string, number>();
  for (const [id, contract] of modules) {
    indegree.set(id, contract.dependsOn.filter((dep) => modules.has(dep)).length);
  }

  const order: string[] = [];
  for (;;) {
    const ready = [...indegree.entries()]
      .filter(([, degree]) => degree === 0)
      .map(([id]) => id)
      .sort(compare);
    if (ready.length === 0) break;
    const next = ready[0] as string;
    order.push(next);
    indegree.delete(next);
    for (const [id, contract] of modules) {
      if (!indegree.has(id)) continue;
      if (contract.dependsOn.includes(next)) {
        indegree.set(id, (indegree.get(id) as number) - 1);
      }
    }
  }

  return { order, leftover: [...indegree.keys()].sort(compare) };
}

/** id 에서 선행 방향으로 따라가 자신에게 되돌아오면 순환 위의 노드다. */
function isOnCycle(id: string, modules: ReadonlyMap<string, ModuleContract>): boolean {
  const seen = new Set<string>();
  const stack = [...(modules.get(id)?.dependsOn ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === id) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(modules.get(current)?.dependsOn ?? []));
  }
  return false;
}

/** 순환 경로를 사람이 읽을 형태로 만든다 (id → dep → … → id). */
function describeCycle(
  id: string,
  modules: ReadonlyMap<string, ModuleContract>,
  candidates: readonly string[],
): string {
  const inScope = new Set(candidates);
  const path: string[] = [];
  const visit = (current: string): boolean => {
    path.push(current);
    for (const dep of [...(modules.get(current)?.dependsOn ?? [])].sort(compare)) {
      if (dep === id) {
        path.push(id);
        return true;
      }
      if (!inScope.has(dep) || path.includes(dep)) continue;
      if (visit(dep)) return true;
    }
    path.pop();
    return false;
  };
  return visit(id) ? path.join(' → ') : id;
}

/** 해시 대상 정규화 JSON — 키 순서를 고정해 순서 의존을 제거한다. */
export function canonicalize(modules: readonly ModuleContract[]): string {
  return JSON.stringify(
    [...modules]
      .sort((a, b) => compare(a.id, b.id))
      .map((m) => [
        m.id,
        m.name,
        m.purpose,
        m.dependsOn,
        m.ownsState,
        m.inputs,
        m.outputs,
        m.invariants,
        m.scenarios,
        [m.commands.test, m.commands.lab, m.commands.verify],
        m.sourcePath,
      ]),
  );
}

/** 로케일 영향을 받지 않는 코드 포인트 비교 — 정렬 결정성의 근거. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 모듈 하나와 그 선행 폐쇄(transitive dependencies)를 돌려준다. */
export function dependencyClosure(registry: ModuleRegistry, id: string): string[] {
  const byId = new Map(registry.modules.map((m) => [m.id, m]));
  const result = new Set<string>();
  const stack = [...(byId.get(id)?.dependsOn ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...(byId.get(current)?.dependsOn ?? []));
  }
  return [...result].sort(compare);
}

/** id 를 선행으로 삼는 모듈의 전이 폐쇄 — 계약 변경 시 검증을 무효화할 대상이다. */
export function dependentClosure(registry: ModuleRegistry, id: string): string[] {
  const result = new Set<string>();
  const stack = [...(registry.dependents[id] ?? [])];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...(registry.dependents[current] ?? []));
  }
  return [...result].sort(compare);
}
