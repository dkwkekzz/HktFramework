// P3-c 부분 그래프 조립 — 전체를 만들지 않고 지금 걸린 것만 편다.
//
// P2 까지 오면 갈래는 "이 종·이 문화가 낼 수 있는 것" 까지 좁혀져 있다. 그래도 여전히
// **할 수 있는 것 전부**다 — 세계가 커지면 매 틱 그것을 다 펼칠 수 없다. P3-c 가 하는 일은
// 그 위에 P3-b 의 근거를 얹어 **지금 손이 닿는 가지만 펴는 것**이다.
//
// 펴지 않은 가지는 **사라지지 않는다.** 회색으로 남는다 — 왜 지금이 아닌지가 값으로 남아야
// 다음 틱에 무엇이 바뀌면 열리는지를 알 수 있고, 화면이 "없는 길" 과 "아직인 길" 을 구분할 수
// 있다 (P1 이 막힘을 붉은 파선으로 남긴 것과 같은 태도다).
//
// 활성 판정은 대상 하나만 본다. 그 의존이 가리키는 대상이
//
//   보인다      → 지금 편다. 선행이 없다 — **본 것에는 찾기가 필요 없다.**
//   기억만 있다 → 편다. 다만 **찾기가 먼저다** — 기억은 지금을 보증하지 않는다.
//   둘 다 아니다 → 펴지 않는다. 회색으로 남는다.
//   대상이 없다 → 편다. 종류로만 걸린 의존("아무 식량이든")은 관측이 걸릴 자리가 없다.
//
// 그리고 이 하위 작업이 갚는 자리: `Possibility.preconditionIds` 가 **처음으로 찬다.**
// 무엇이 먼저인지는 여기서 새로 정하지 않는다 — P3-a 가 P0 걸림에서 계산해 둔 원자 선행을
// **같은 트리 안의 가능성 id 로 옮길** 뿐이다. 빼앗기 앞에 찾기가 서는 것은 그래서 나온다.
//
// 재료 선행(치를 것)은 여기서 걸지 않는다. 치를 것이 없다는 것이 "막힌 것" 인지 "브레이크가
// 없는 것" 인지는 P4 가 판정한다 — P0 이 남긴 부채 그대로다.

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Possibility } from '../o1/index.ts';
import type { DependencyGraph } from '../d1/index.ts';
import { atomLabel, type ActionAtom } from '../p0/index.ts';
import { directionLabel, possibilityIdOf, type StrategyDirection } from '../p1/index.ts';
import type { NarrowedBranch, NarrowedOption, NarrowedTree } from '../p2/index.ts';
import type { ExpansionContext } from './context.ts';
import { prerequisitesOf } from './prerequisite.ts';
import { violateExpansion, type PossibilityGraphViolation } from './violation.ts';

/** 왜 폈는가 / 왜 안 폈는가. */
export const EXPANSION_REASONS = [
  'blind', // 보지 않고 낼 수 있는 갈래 — 관측을 만드는 쪽이다
  'seen', // 대상이 지금 보인다
  'remembered', // 기억으로만 안다 — 찾기가 먼저다
  'kindOnly', // 대상이 특정되지 않은 의존 — 관측이 걸릴 자리가 없다
  'unreached', // 손이 닿지 않는다
  'unsupplied', // 선행을 대 줄 가지가 이 트리에 없다
  'closed', // P1·P2 가 이미 닫았다
] as const;
export type ExpansionReason = (typeof EXPANSION_REASONS)[number];

/** 가지 하나를 폈는지 안 폈는지, 왜 그런지. */
export interface ExpansionTraceEntry {
  readonly nodeId: Id;
  readonly label: string;
  readonly direction: StrategyDirection;
  readonly possibilityId: Id;
  readonly active: boolean;
  readonly reason: ExpansionReason;
  /** 그 의존이 가리키는 대상. 종류로만 걸리면 null */
  readonly targetId: Id | null;
  readonly preconditionIds: readonly Id[];
  readonly note: string;
}

/** 왜 이렇게 폈는가의 장부. */
export interface ExpansionTrace {
  readonly entries: readonly ExpansionTraceEntry[];
  readonly expanded: number;
  readonly skipped: number;
  readonly byReason: Readonly<Record<string, number>>;
}

/** 전체는 회색으로 두고 지금 걸린 부분만 발광하는 그래프. */
export interface PossibilitySubgraph {
  readonly subjectId: Id;
  readonly tick: Tick;
  /** 열려 있던 갈래 전부 — 펴지 않은 것도 자리를 지킨다 */
  readonly all: readonly Possibility[];
  /** 지금 편 것 (선행이 채워진 것) */
  readonly active: readonly Possibility[];
  readonly activeIds: readonly Id[];
  readonly trace: ExpansionTrace;
  readonly violations: readonly PossibilityGraphViolation[];
  readonly complete: boolean;
}

/** 조립 재료. */
export interface ExpansionSpec {
  readonly tree: NarrowedTree;
  /** 노드가 무엇을 가리키는지 읽는다 — 갈래는 대상 id 를 갖고 있지 않다 */
  readonly graph: DependencyGraph;
  readonly context: ExpansionContext;
}

/** 그 원자가 서려면 먼저 서야 하는 원자들 (관측 선행만 — 재료 선행은 P4 의 몫이다). */
function observationSourcesOf(atom: ActionAtom): readonly ActionAtom[] {
  return prerequisitesOf(atom)
    .filter((requirement) => requirement.route === 'observation')
    .flatMap((requirement) => requirement.satisfiedBy);
}

/**
 * 그 갈래가 관측 없이 설 수 있는가 — 원자 **하나라도** 관측 선행을 갖지 않으면 그렇다.
 * 갈래가 지닌 원자들은 순서열이 아니라 **고를 수 있는 것들**이므로(P1), 보지 않고 낼 수 있는
 * 것이 하나 있으면 그 갈래는 지금 설 수 있다. P0-b 가 보지 않고 되는 원자를 하나(찾다)로
 * 못박았으니 이것은 곧 **관측을 만드는 갈래**다 — 이 갈래마저 "대상을 먼저 보라" 고 하면
 * 아무도 첫 걸음을 떼지 못한다 (P3-a 의 뿌리가 찾기 하나였던 것과 같은 자리다).
 */
function isBlind(option: NarrowedOption): boolean {
  return option.atoms.some((atom) => observationSourcesOf(atom).length === 0);
}

/**
 * 이 트리 안에서 그 원자를 내는 **스스로 서는 갈래**를 찾는다.
 *
 * 선행은 남이 아니라 제 트리가 대되, 그 선행 자체가 회색이면 선행이 아니다 —
 * 서지 못한 것에 기대어 설 수는 없다. 그래서 후보에서 **기억으로만 서는 갈래는 뺀다**:
 * 그것 역시 선행을 필요로 하므로, 그것에 기대면 사슬이 스스로를 떠받치게 된다.
 * 이 계층의 사슬은 한 칸이다 — 긴 사슬(계획)은 P5 의 몫이다.
 */
function supplierOf(
  candidates: readonly PendingOption[],
  sources: readonly ActionAtom[],
  exclude: Id,
): { readonly id: Id; readonly atom: ActionAtom } | null {
  for (const candidate of candidates) {
    if (candidate.id === exclude || !candidate.active) continue;
    if (candidate.reason === 'remembered') continue;
    const atom = candidate.option.atoms.find((entry) => sources.includes(entry));
    if (atom !== undefined) return { id: candidate.id, atom };
  }
  return null;
}

/** 첫 마당에서 정해진 갈래 하나 — 둘째 마당이 선행을 여기에 건다. */
interface PendingOption {
  readonly branch: NarrowedBranch;
  readonly option: NarrowedOption;
  readonly id: Id;
  readonly targetId: Id | null;
  readonly active: boolean;
  readonly reason: ExpansionReason;
  readonly note: string;
}

/** 근거에 걸린 가지만 편다. 던지지 않는다 — 펴지 않은 이유는 값으로 남는다. */
export function expandSubgraph(spec: ExpansionSpec): PossibilitySubgraph {
  const violations: PossibilityGraphViolation[] = [];
  const targets = new Map<Id, Id | null>(
    spec.graph.nodes.map((node) => [node.id, node.target?.id ?? null]),
  );

  // 첫 마당 — 대상 하나만 보고 정한다. 여기서는 아직 선행을 걸지 않는다.
  const pending: PendingOption[] = [];
  for (const branch of spec.tree.branches) {
    if (!targets.has(branch.nodeId)) {
      violateExpansion(
        violations,
        '',
        'unknown-branch-node',
        '$.tree.branches',
        `갈래가 선 노드 ${branch.nodeId} 가 의존 그래프에 없다 — 어느 대상을 두고 하는 말인지 물을 수 없다`,
      );
    }
    for (const option of branch.options) {
      pending.push(classify(branch, option, targets.get(branch.nodeId) ?? null, spec));
    }
  }

  // 둘째 마당 — 기억으로만 아는 갈래에 **이미 선 갈래**로 선행을 건다.
  const entries: ExpansionTraceEntry[] = [];
  const all: Possibility[] = [];
  const active: Possibility[] = [];
  for (const item of pending) {
    const entry = resolve(item, pending, spec);
    entries.push(entry);
    if (entry.reason === 'closed') continue;
    const possibility: Possibility = {
      kind: 'Possibility',
      id: entry.possibilityId,
      subjectId: spec.tree.subjectId,
      forDependencyId: entry.nodeId,
      direction: entry.direction,
      atoms: [...item.option.atoms],
      preconditionIds: entry.preconditionIds,
    };
    all.push(possibility);
    if (entry.active) active.push(possibility);
  }

  const byReason: Record<string, number> = {};
  for (const reason of EXPANSION_REASONS) byReason[reason] = 0;
  for (const entry of entries) byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;

  const subgraph: PossibilitySubgraph = {
    subjectId: spec.tree.subjectId,
    tick: spec.tree.tick,
    all,
    active,
    activeIds: stableSort(
      active.map((possibility) => possibility.id),
      compareStrings,
    ),
    trace: { entries, expanded: active.length, skipped: all.length - active.length, byReason },
    violations,
    complete: false,
  };

  // 마지막 관문 — 선행은 이 그래프 안에 실제로 **서 있어야** 한다.
  // 조립이 옳으면 여기서 아무것도 나오지 않는다. 그래도 둔다: 선행을 손으로 고쳐 넣은 값도
  // 같은 관문을 지나야 하고(P4·P5 가 그럴 것이다), 두 곳이 같은 것을 막으면 한쪽이 뚫려도 드러난다.
  const dangling = checkSubgraph(subgraph);
  const merged = [...violations, ...dangling];
  return { ...subgraph, violations: merged, complete: merged.length === 0 };
}

/** 선행이 실제로 선 것을 가리키는가 — 부분 그래프 하나를 값으로 검사한다. */
export function checkSubgraph(
  subgraph: PossibilitySubgraph,
): readonly PossibilityGraphViolation[] {
  const violations: PossibilityGraphViolation[] = [];
  const standing = new Set(subgraph.activeIds);
  for (const [index, possibility] of subgraph.active.entries()) {
    for (const [order, precondition] of possibility.preconditionIds.entries()) {
      const at = `$.active[${String(index)}].preconditionIds[${String(order)}]`;
      if (precondition === possibility.id) {
        violateExpansion(
          violations,
          '',
          'dangling-precondition',
          at,
          `${possibility.id} 가 자기 자신을 선행으로 갖는다 — 먼저 서야 할 것이 자기라면 아무것도 서지 못한다`,
        );
        continue;
      }
      if (!standing.has(precondition)) {
        violateExpansion(
          violations,
          '',
          'dangling-precondition',
          at,
          `선행 ${precondition} 이 이 부분 그래프에 서 있지 않다 — 서지 못한 것에 기대어 설 수는 없다`,
        );
      }
    }
  }
  return violations;
}

/** 첫 마당 — 이 갈래가 지금 설 수 있는가. */
function classify(
  branch: NarrowedBranch,
  option: NarrowedOption,
  targetId: Id | null,
  spec: ExpansionSpec,
): PendingOption {
  const id = possibilityIdOf(spec.tree.subjectId, branch.nodeId, option.direction);
  const base = { branch, option, id, targetId };

  if (!option.open) {
    return {
      ...base,
      active: false,
      reason: 'closed',
      note: `${directionLabel(option.direction)} 는 이미 닫혀 있다 — ${option.closedBy ?? '사유 없음'}`,
    };
  }
  if (isBlind(option)) {
    return {
      ...base,
      active: true,
      reason: 'blind',
      note: `${directionLabel(option.direction)} 는 보지 않고 낼 수 있다 — 관측을 만드는 갈래이므로 대상을 묻지 않는다`,
    };
  }
  if (targetId === null) {
    return {
      ...base,
      active: true,
      reason: 'kindOnly',
      note: `${branch.label} 은 대상을 가리지 않는 의존이다 — 관측이 걸릴 자리가 없으므로 그대로 편다`,
    };
  }
  if (spec.context.seen.includes(targetId)) {
    return {
      ...base,
      active: true,
      reason: 'seen',
      note: `${branch.label} 의 대상이 지금 보인다 — 본 것에는 찾기가 필요 없다`,
    };
  }
  if (spec.context.remembered.includes(targetId)) {
    return {
      ...base,
      active: true,
      reason: 'remembered',
      note: `${branch.label} 은 기억으로만 안다 — 다시 보는 것이 먼저다 (기억은 지금을 보증하지 않는다)`,
    };
  }
  return {
    ...base,
    active: false,
    reason: 'unreached',
    note: `${branch.label} 의 대상에 손이 닿지 않는다 — 보지도 기억하지도 않는다. 사라진 것이 아니라 아직인 것이다`,
  };
}

/** 둘째 마당 — 기억으로만 아는 갈래에 선행을 건다. 댈 갈래가 없으면 펴지 않는다. */
function resolve(
  item: PendingOption,
  pending: readonly PendingOption[],
  spec: ExpansionSpec,
): ExpansionTraceEntry {
  const base = {
    nodeId: item.branch.nodeId,
    label: item.branch.label,
    direction: item.option.direction,
    possibilityId: item.id,
    targetId: item.targetId,
  };
  if (item.reason !== 'remembered') {
    return {
      ...base,
      active: item.active,
      reason: item.reason,
      preconditionIds: [],
      note: item.note,
    };
  }

  const sources = [...new Set(item.option.atoms.flatMap(observationSourcesOf))];
  const supplier = supplierOf(pending, sources, item.id);
  if (supplier === null) {
    return {
      ...base,
      active: false,
      reason: 'unsupplied',
      preconditionIds: [],
      note: `${item.branch.label} 은 기억으로만 아는데 ${sources.map(atomLabel).join('·')} 를 낼 갈래가 이 트리에 서지 않았다 — 다시 볼 길이 없다`,
    };
  }
  void spec;
  return {
    ...base,
    active: true,
    reason: 'remembered',
    preconditionIds: [supplier.id],
    note: `${item.note} — ${atomLabel(supplier.atom)} 가 먼저다`,
  };
}

/** 조립을 한 줄 판정으로 접는다 — 터미널·배지용. */
export function subgraphVerdict(subgraph: PossibilitySubgraph): string {
  if (!subgraph.complete) {
    const rules = [...new Set(subgraph.violations.map((violation) => violation.rule))];
    return `부분 그래프가 설 수 없다 — ${rules.join(', ')}`;
  }
  const withPre = subgraph.active.filter(
    (possibility) => possibility.preconditionIds.length > 0,
  ).length;
  return `갈래 ${String(subgraph.all.length)} 중 ${String(subgraph.trace.expanded)} 을 편다 (선행이 걸린 것 ${String(withPre)} · 회색 ${String(subgraph.trace.skipped)})`;
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function subgraphSummary(subgraph: PossibilitySubgraph): readonly string[] {
  return EXPANSION_REASONS.map(
    (reason) => `${reason}: ${String(subgraph.trace.byReason[reason] ?? 0)}`,
  );
}
