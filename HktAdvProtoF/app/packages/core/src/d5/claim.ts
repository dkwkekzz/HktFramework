// D5-a 요구의 자리 — 노드 하나가 세계의 **무엇을** 요구하는가.
//
// 다툼을 찾으려면 먼저 무엇을 놓고 다투는지를 한 모양으로 적어야 한다. 그 모양이 요구
// (`DependencyClaim`)다. 여기서 새로 정하는 것은 없다 — D1 노드가 이미 자리와 대역을 갖고 있고,
// 대상도, 대체 가능성도 D1 이 적어 둔 값이다. D5-a 가 하는 일은 **여러 그래프의 노드들을 한
// 평면 위에 늘어놓는 것**뿐이다. 그래야 겹침이 보인다.
//
// 못박는 것이 하나 있다.
//
//   **시간은 요구가 아니다.** 주기 조건(`clock`)은 세계의 어느 자리도 잡지 않는다 — 장막이
//   걷히는 주기는 누구에게나 같은 속도로 오고, 한 사람이 그것을 많이 쓴다고 남의 몫이 줄지
//   않는다. 그래서 시간은 겹치지도 다투지도 않는다. 이것을 요구로 세우면 걸린다(`clock-claim`).
//   (시간이 다툼이 되는 자리는 있다 — 같은 시각에 두 곳에 있을 수 없는 일이다. 그러나 그것은
//    시간이 아니라 **몸이라는 자리**를 놓고 다투는 것이고, 아래 `physical.region` 요구가 그 다툼을
//    이미 값으로 만든다.)
//
// 요구는 두 개의 이름을 함께 진다. **자리**(어느 영역·누구의·어느 경로)와 **대상**(무엇을
// 가리키는가). 겹침이 두 축에서 나기 때문이다 — 같은 자리를 둘이 보는 것과, 자리는 달라도
// 세계에 하나뿐인 것을 둘이 보는 것은 다른 다툼이다 (D5-b).

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { SlotRef } from '../o0/definition.ts';
import type { DependencyKind } from '../d0/index.ts';
import { describeBand, type Band } from '../s0/index.ts';
import type { DependencyGraph, DependencyNode } from '../d1/index.ts';
import { violateConflict, type ConflictViolation } from './violation.ts';

/**
 * 주체 하나가 세계의 한 자리에 건 요구 — D1 노드를 다툼이 읽을 수 있는 모양으로 편 것.
 *
 * 여기 있는 것은 전부 D1 이 이미 적어 둔 값이다. **얼마나 급한가는 없다** — 그것은 D4 가 재고,
 * 다툼이 설 때 그쪽에서 읽어 온다 (D5-b). 두 곳에서 재면 두 값이 갈린다.
 */
export interface DependencyClaim {
  readonly id: Id;
  readonly subjectId: Id;
  readonly graphId: Id;
  readonly nodeId: Id;
  readonly label: string;
  readonly kind: DependencyKind;
  /** 어느 자리를 요구하는가 — **자리 축의 겹침**이 여기서 난다 */
  readonly slot: SlotRef;
  /** 누구의 자리인가 (제 것일 수도, 남의 것일 수도 있다) */
  readonly holderId: Id;
  readonly band: Band;
  /** 무엇을 가리키는가 — **대상 축의 겹침**이 여기서 난다. 종류로만 걸리면 null */
  readonly targetId: Id | null;
  readonly targetName: string;
  /**
   * 대신할 수 있는가 0~1 — 이 노드에 **기대는** 간선들의 최대값 (D1).
   * **뿌리는 0 이다** — 제 몸에 기대는 간선은 없고, 몸은 다른 것으로 대신할 수 없다.
   */
  readonly substitutability: number;
  /** 왜 이 요구인가 — D1 노드의 근거를 그대로 옮긴다 */
  readonly note: string;
}

/** 요구의 id — 유래(주체 · 노드)에서 나온다 (V1 결정적 ID). */
export function claimIdOf(subjectId: Id, nodeId: Id): Id {
  return deterministicId('claim', subjectId, nodeId);
}

/** 자리 축의 이름 — 이 값이 같으면 **문자 그대로 한 값을 둘이 본다**. */
export function slotKeyOf(claim: DependencyClaim): string {
  return `${claim.slot.domain}.${claim.holderId}.${claim.slot.path}`;
}

/** 대상 축의 이름 — 이 값이 같으면 **세계에 하나뿐인 것을 둘이 본다**. 종류로만 걸리면 null. */
export function targetKeyOf(claim: DependencyClaim): string | null {
  return claim.targetId;
}

/**
 * 이 요구를 **다른 것으로 대신할 수 있는가** — 이 노드에 기대는 간선들의 최대 대체 가능성.
 *
 * 방향을 뒤집지 않는다: D1 간선은 `from`(기대는 쪽) → `to`(기대어지는 쪽)이므로, "말린 고기를
 * 다른 것으로 바꿀 수 있는가" 는 **말린 고기를 가리키는 간선**(`to === node.id`)이 답한다.
 * **뿌리에는 그런 간선이 없으므로 0 이다** — 제 몸은 대신할 수 없다.
 */
export function substitutabilityOf(graph: DependencyGraph, node: DependencyNode): number {
  const dependents = graph.edges.filter((edge) => edge.to === node.id);
  if (dependents.length === 0) return 0;
  return Math.max(...dependents.map((edge) => edge.substitutability));
}

/**
 * 그래프 하나의 요구들 — **주기 조건은 빠진다**(시간은 자리를 잡지 않는다).
 * 순서는 자리·노드 순으로 결정적이다.
 */
export function claimsOf(graph: DependencyGraph): readonly DependencyClaim[] {
  const claims = graph.nodes
    .filter((node) => node.condition.kind === 'slot')
    .map((node) => {
      const condition = node.condition as Extract<DependencyNode['condition'], { kind: 'slot' }>;
      return {
        id: claimIdOf(graph.subjectId, node.id),
        subjectId: graph.subjectId,
        graphId: graph.id,
        nodeId: node.id,
        label: node.label,
        kind: node.kind,
        slot: condition.slot,
        holderId: condition.holderId,
        band: condition.band,
        targetId: node.target?.id ?? null,
        targetName: node.target?.name ?? '(종류로만)',
        substitutability: substitutabilityOf(graph, node),
        note: node.note,
      } satisfies DependencyClaim;
    });
  return stableSort(claims, (left, right) =>
    compareStrings(`${slotKeyOf(left)}/${left.nodeId}`, `${slotKeyOf(right)}/${right.nodeId}`),
  );
}

/** 여러 그래프의 요구들을 한 평면에 늘어놓는다 — 겹침은 여기서부터 보인다. */
export function claimsFrom(graphs: readonly DependencyGraph[]): readonly DependencyClaim[] {
  const all = graphs.flatMap((graph) => claimsOf(graph));
  return stableSort(all, (left, right) =>
    compareStrings(`${slotKeyOf(left)}/${left.subjectId}/${left.nodeId}`, `${slotKeyOf(right)}/${right.subjectId}/${right.nodeId}`),
  );
}

/** 시간에 걸린 노드들 — 요구가 되지 않은 것들. 빠뜨림이 아니라 결과다. */
export function timeNodes(graphs: readonly DependencyGraph[]): readonly DependencyNode[] {
  return graphs.flatMap((graph) => graph.nodes.filter((node) => node.condition.kind === 'clock'));
}

/**
 * 요구 하나가 온전한가 — 그래프에 실재하는 노드에서 왔는가, 시간을 요구로 세우지 않았는가.
 * 던지지 않는다.
 */
export function checkClaim(
  claim: DependencyClaim,
  graphs: readonly DependencyGraph[],
  out: ConflictViolation[],
  path = '$.claim',
): void {
  const graph = graphs.find((entry) => entry.id === claim.graphId);
  const node = graph?.nodes.find((entry) => entry.id === claim.nodeId) ?? null;

  if (graph === undefined || node === null) {
    violateConflict(
      out,
      claim.subjectId,
      'phantom-claim',
      `${path}.nodeId`,
      `그래프에 없는 노드 ${claim.nodeId} 의 요구다 — 기대지 않는 것을 놓고 다툴 수는 없다`,
    );
    return;
  }

  if (graph.subjectId !== claim.subjectId) {
    violateConflict(
      out,
      claim.subjectId,
      'foreign-claim',
      `${path}.subjectId`,
      `${graph.name} 의 노드인데 다른 주체의 요구로 적혔다 — 그래프는 한 주체의 것이다 (D1)`,
    );
  }

  if (node.condition.kind === 'clock') {
    violateConflict(
      out,
      claim.subjectId,
      'clock-claim',
      `${path}.slot`,
      `${node.label} 은 주기에 걸린 기댐인데 자리를 요구한다고 적혔다 — 시간은 세계의 어느 자리도 잡지 않으므로 겹치지도 다투지도 않는다`,
    );
  }

  if (
    !Number.isFinite(claim.substitutability) ||
    claim.substitutability < 0 ||
    claim.substitutability > 1
  ) {
    violateConflict(
      out,
      claim.subjectId,
      'bad-substitutability',
      `${path}.substitutability`,
      `대체 가능성 ${String(claim.substitutability)} 이 설 수 없다 — 0 이상 1 이하여야 한다 (D1 간선)`,
    );
  }
}

/** 요구들을 한꺼번에 검사한다. */
export function checkClaims(
  claims: readonly DependencyClaim[],
  graphs: readonly DependencyGraph[],
): readonly ConflictViolation[] {
  const out: ConflictViolation[] = [];
  for (const [index, claim] of claims.entries()) {
    checkClaim(claim, graphs, out, `$.claims[${String(index)}]`);
  }
  return out;
}

/** 요구 하나를 사람이 읽는 한 줄로. */
export function claimLine(claim: DependencyClaim): string {
  return `${claim.label} — ${slotKeyOf(claim)} ${describeBand(claim.band)} (${claim.targetName}, 대체 ${claim.substitutability.toFixed(2)})`;
}
