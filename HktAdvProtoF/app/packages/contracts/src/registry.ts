// V0-b 모듈 계약 레지스트리 — 계약을 등록하고 결함 계약을 거부한다.
//
// 원문 V0 검증 조항 그대로:
//   목적 없는 모듈 등록 불가 · 입출력 없는 처리 모듈 등록 불가 ·
//   순환 의존 등록 불가 · 시나리오 없는 모듈 완료 불가
//
// 여기에 WORKFLOW 가 더한 조항:
//   증거 없는 VERIFIED 불가 (§5-7) · 미검증 모듈에 의존한 채 완료 불가 (§5-1 게이트) ·
//   하위 작업이 열려 있으면 완료 불가 (§3)

import { compareStrings, stableSort } from '@hkt/core/v1';

import { readContract, type ContractViolation, type ModuleContract } from './contract.ts';
import { parseYaml, YamlParseError } from './yaml.ts';

/** 등록된 모듈 하나. */
export interface RegistryEntry {
  readonly contract: ModuleContract;
  /** 이 모듈이 어긴 규칙들 — 비어 있어야 등록 성립 */
  readonly violations: readonly ContractViolation[];
  readonly registered: boolean;
}

/** 레지스트리 — 의존 DAG + 구현·검증 상태. */
export interface ModuleRegistry {
  /** 등록에 성공한 모듈 (id 순) */
  readonly modules: readonly RegistryEntry[];
  /** 등록이 거부된 계약의 사유 */
  readonly rejected: readonly ContractViolation[];
  /** 의존 DAG — from 이 to 에 의존한다 */
  readonly edges: readonly DependencyEdge[];
  /** 의존 위상 순서 (착수 가능 순서). 순환이 있으면 null */
  readonly topologicalOrder: readonly string[] | null;
  /** 지금 착수 가능한 모듈 — depends 가 전부 VERIFIED 인 미완료 모듈 */
  readonly ready: readonly string[];
}

export interface DependencyEdge {
  readonly from: string;
  readonly to: string;
}

/** 계약 하나의 입력 — 파일에서 읽었든 문자열이든 같게 다룬다. */
export interface ContractSource {
  /** 파일명 등, 사유 출력에 쓸 이름 */
  readonly name: string;
  readonly text: string;
}

/** 처리 모듈이 아닌(입출력 없이 정의만 하는) 모듈은 없다 — 예외를 두면 계약이 무의미해진다. */
function checkContract(
  contract: ModuleContract,
  byId: ReadonlyMap<string, ModuleContract>,
): ContractViolation[] {
  const violations: ContractViolation[] = [];
  const add = (rule: ContractViolation['rule'], message: string): void => {
    violations.push({ module: contract.id, rule, message });
  };

  if (contract.purpose === '') {
    add('no-purpose', '목적이 없다 — 목적 없는 모듈은 등록할 수 없다');
  }
  if (contract.inputs.length === 0 && contract.outputs.length === 0) {
    add('no-io', '입력도 출력도 없다 — 처리 모듈로 등록할 수 없다');
  }

  for (const dependency of contract.depends) {
    if (!byId.has(dependency)) {
      add('unknown-dependency', `존재하지 않는 모듈에 의존한다 — ${dependency}`);
    }
  }

  // 완료(VERIFIED) 를 주장할 때만 걸리는 조항들.
  if (contract.status === 'VERIFIED') {
    if (contract.scenarios.length === 0) {
      add('no-scenario', '시나리오가 없다 — 시나리오 없는 모듈은 완료할 수 없다');
    }
    if (contract.evidence === null || contract.evidence === '') {
      add('no-evidence', '증거 파일이 없다 — 완료 선언은 증거로만 한다');
    }
    for (const dependency of contract.depends) {
      const target = byId.get(dependency);
      if (target !== undefined && target.status !== 'VERIFIED') {
        add(
          'dependency-not-verified',
          `미검증 모듈에 의존한 채 완료를 주장한다 — ${dependency} 는 ${target.status}`,
        );
      }
    }
    const open = contract.subtasks.filter((subtask) => subtask.status !== 'DONE');
    if (open.length > 0) {
      add(
        'open-subtask',
        `하위 작업이 열려 있다 — ${open.map((subtask) => subtask.id).join(', ')}`,
      );
    }
  }

  return violations;
}

/** 순환 의존을 찾는다 — 있으면 순환에 낀 모듈 ID 집합, 없으면 위상 순서. */
function topologicalSort(
  ids: readonly string[],
  dependsOf: ReadonlyMap<string, readonly string[]>,
): { readonly order: string[] | null; readonly cyclic: readonly string[] } {
  const remaining = new Set(ids);
  const order: string[] = [];

  for (;;) {
    // 남은 것 중 의존이 모두 해결된 모듈을 ID 순으로 꺼낸다 (결정적 순서).
    const ready = stableSort(
      [...remaining].filter((id) =>
        (dependsOf.get(id) ?? []).every((dependency) => !remaining.has(dependency)),
      ),
      compareStrings,
    );
    if (ready.length === 0) break;
    for (const id of ready) {
      remaining.delete(id);
      order.push(id);
    }
  }

  if (remaining.size > 0) {
    return { order: null, cyclic: stableSort([...remaining], compareStrings) };
  }
  return { order, cyclic: [] };
}

/** 계약들을 등록한다. 결함 계약은 사유와 함께 거부되고, 나머지는 그대로 등록된다. */
export function buildRegistry(sources: readonly ContractSource[]): ModuleRegistry {
  const rejected: ContractViolation[] = [];
  /** 스키마 단계에서 나온 위반 — 계약별로 들고 있다가 등록 항목에 그대로 붙인다. */
  const schemaViolations = new Map<string, readonly ContractViolation[]>();
  const contracts: ModuleContract[] = [];
  const byId = new Map<string, ModuleContract>();

  for (const source of stableSort(sources, (a, b) => compareStrings(a.name, b.name))) {
    let parsed;
    try {
      parsed = parseYaml(source.text);
    } catch (error) {
      rejected.push({
        module: source.name,
        rule: 'not-a-mapping',
        message: error instanceof YamlParseError ? error.message : String(error),
      });
      continue;
    }

    const { contract, violations } = readContract(parsed, source.name);
    if (contract === null) {
      rejected.push(...violations);
      continue;
    }
    if (byId.has(contract.id)) {
      // 먼저 등록된 계약은 그대로 두고, 뒤에 온 사본만 거부한다.
      rejected.push({
        module: contract.id,
        rule: 'duplicate-id',
        message: `같은 ID 의 계약이 이미 등록됐다 — ${source.name}`,
      });
      continue;
    }
    // 스키마 위반(bad-type 등)은 아래 규칙 검사 결과와 합쳐 한 번에 보고한다.
    byId.set(contract.id, contract);
    contracts.push(contract);
    schemaViolations.set(contract.id, violations);
  }

  const ids = contracts.map((contract) => contract.id);
  const dependsOf = new Map<string, readonly string[]>(
    contracts.map((contract) => [contract.id, contract.depends]),
  );
  const { order, cyclic } = topologicalSort(ids, dependsOf);

  const entries: RegistryEntry[] = stableSort(contracts, (a, b) => compareStrings(a.id, b.id)).map(
    (contract) => {
      const violations = checkContract(contract, byId);
      if (cyclic.includes(contract.id)) {
        violations.push({
          module: contract.id,
          rule: 'dependency-cycle',
          message: `순환 의존에 낀다 — ${cyclic.join(' → ')}`,
        });
      }
      const all = [...(schemaViolations.get(contract.id) ?? []), ...violations];
      return { contract, violations: all, registered: all.length === 0 };
    },
  );

  const statusOf = new Map(entries.map((entry) => [entry.contract.id, entry.contract.status]));
  const ready = entries
    .filter(
      (entry) =>
        entry.registered &&
        entry.contract.status !== 'VERIFIED' &&
        entry.contract.depends.every((dependency) => statusOf.get(dependency) === 'VERIFIED'),
    )
    .map((entry) => entry.contract.id);

  const edges: DependencyEdge[] = [];
  for (const contract of contracts) {
    for (const dependency of contract.depends) {
      edges.push({ from: contract.id, to: dependency });
    }
  }

  return {
    modules: entries,
    rejected,
    edges: stableSort(edges, (a, b) => compareStrings(`${a.from}->${a.to}`, `${b.from}->${b.to}`)),
    topologicalOrder: order,
    ready,
  };
}

/** 레지스트리를 사람이 읽는 표로 — V3 Lab 그래프 뷰의 텍스트판. */
export function formatRegistry(registry: ModuleRegistry): string {
  const lines: string[] = [];
  lines.push('모듈  상태          의존        시나리오 증거   판정');
  for (const entry of registry.modules) {
    const contract = entry.contract;
    lines.push(
      `${contract.id.padEnd(5)} ${contract.status.padEnd(13)} ${(contract.depends.join(',') || '—').padEnd(11)} ${String(contract.scenarios.length).padStart(4)}개 ${(contract.evidence === null ? '없음' : '있음').padEnd(6)} ${
        entry.registered ? '등록 ✔' : '거부 ✘'
      }`,
    );
    for (const violation of entry.violations) {
      lines.push(`        └ [${violation.rule}] ${violation.message}`);
    }
  }
  for (const violation of registry.rejected) {
    lines.push(`${violation.module.padEnd(5)} 등록 거부 ✘  [${violation.rule}] ${violation.message}`);
  }
  lines.push('');
  lines.push(
    `위상 순서: ${registry.topologicalOrder === null ? '없음 ✘ (순환 의존)' : registry.topologicalOrder.join(' → ')}`,
  );
  lines.push(`착수 가능: ${registry.ready.length === 0 ? '없음' : registry.ready.join(', ')}`);
  return lines.join('\n');
}
