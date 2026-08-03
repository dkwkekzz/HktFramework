// D5-c 충돌장과 감사 — 다툼들을 담고, 다툼이 아닌 것도 사유와 함께 남긴다.
//
// D5-b 는 겹침 하나를 판정했다. 세계에는 그래프가 여럿이고 겹침도 여럿이다 — 그것을 담는 자리다.
// R2-c 현상장 · R3-c 지각장 · R4-c 믿음 그래프와 같은 모양이다: 담기만 하고 지우지 않으며,
// 감사가 **위반**과 **사실**을 가른다.
//
//   위반 — 한쪽뿐인 다툼, 겹치지도 않은 요구들의 다툼, 까닭을 대지 못하는 다툼,
//          세계를 보지 않은 모자람 주장, D4 와 어긋난 급함, **이기는 자를 적은 다툼**,
//          그리고 **조건을 갖췄는데 충돌장에 없는 겹침**(`missing-contest` — 이것이 "다툼을
//          빠뜨리지 않는다" 를 주장이 아니라 검사로 만든다).
//   사실 — **다툼이 되지 못한 겹침**(`Peace`). 이것이 이 계층의 절반이다. 겹침의 대부분은
//          다툼이 아니고, 그 사실이 값으로 남아야 "왜 여기서는 안 싸우는가" 를 물을 수 있다.
//
// 그리고 여기서 **주체↔경합 대상 이분 그래프**의 재료가 선다 (MODULES.md D5 시각화).
// 이분 그래프인 이유는 다툼의 모양 자체가 그렇기 때문이다 — 한쪽에는 주체가, 다른 쪽에는
// 그들이 함께 보는 것이 있고, 선은 언제나 주체에서 대상으로만 간다. 주체끼리는 잇지 않는다:
// **누가 누구와 싸우는지는 아직 아무도 모른다**(서로를 봐야 알고, 그것은 R3·R4 다).

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { DependencyGraph } from '../d1/index.ts';
import { checkClaims, claimsFrom, type DependencyClaim } from './claim.ts';
import {
  checkConflict,
  contestsOf,
  judgeAll,
  type Contest,
  type DependencyConflict,
  type JudgeOptions,
  type Peace,
} from './conflict.ts';
import { violateConflict, type ConflictViolation } from './violation.ts';

/** 세계에 선 다툼들. */
export interface ConflictField {
  readonly conflicts: readonly DependencyConflict[];
  /** 다툼이 되지 못한 겹침들 — 위반이 아니라 사실이다 */
  readonly peaces: readonly Peace[];
  /** 주체 id → 그가 낀 다툼들 */
  readonly bySubject: ReadonlyMap<Id, readonly DependencyConflict[]>;
  /** 겹침의 이름 → 다툼 */
  readonly byKey: ReadonlyMap<string, DependencyConflict>;
}

/** 빈 충돌장. */
export function openConflictField(): ConflictField {
  return { conflicts: [], peaces: [], bySubject: new Map(), byKey: new Map() };
}

function indexOf(
  conflicts: readonly DependencyConflict[],
  peaces: readonly Peace[],
): ConflictField {
  const bySubject = new Map<Id, DependencyConflict[]>();
  const byKey = new Map<string, DependencyConflict>();
  for (const conflict of conflicts) {
    byKey.set(conflict.key, conflict);
    for (const subjectId of [...new Set(conflict.sides.map((side) => side.subjectId))]) {
      bySubject.set(subjectId, [...(bySubject.get(subjectId) ?? []), conflict]);
    }
  }
  return { conflicts, peaces, bySubject, byKey };
}

/** 다툼 탐지 한 바퀴 — 요구를 펴고, 겹침을 찾고, 판정한다. */
export interface DetectResult {
  readonly claims: readonly DependencyClaim[];
  readonly contests: readonly Contest[];
  readonly field: ConflictField;
}

/**
 * 여러 그래프를 한 세계에 겹쳐 놓고 다툼을 찾는다.
 *
 * 세 걸음이 전부다: 요구를 편다(D5-a) → 겹침을 찾는다(D5-b) → 판정한다(D5-b).
 * 새로 정하는 것은 없고, 순서만 있다.
 */
export function detectConflicts(
  graphs: readonly DependencyGraph[],
  options: JudgeOptions = {},
): DetectResult {
  const claims = claimsFrom(graphs);
  const contests = contestsOf(claims);
  const { conflicts, peaces } = judgeAll(contests, options);
  return { claims, contests, field: indexOf(conflicts, peaces) };
}

/** 그 주체가 낀 다툼들. */
export function conflictsFor(field: ConflictField, subjectId: Id): readonly DependencyConflict[] {
  return field.bySubject.get(subjectId) ?? [];
}

/** 아무 다툼에도 끼지 않은 주체들 — 위반이 아니라 사실이다. */
export function unconflicted(
  field: ConflictField,
  graphs: readonly DependencyGraph[],
): readonly Id[] {
  return graphs
    .map((graph) => graph.subjectId)
    .filter((subjectId) => conflictsFor(field, subjectId).length === 0);
}

/** 충돌장 감사 결과. */
export interface ConflictAudit {
  readonly contests: number;
  readonly conflicts: number;
  /** 다툼이 되지 못한 겹침 수 (사실) */
  readonly peaces: number;
  readonly opposed: number;
  readonly scarcity: number;
  readonly internal: number;
  readonly between: number;
  /** 아무 다툼에도 끼지 않은 주체 수 (사실) */
  readonly calm: number;
  /** 가장 급한 다툼의 급함 */
  readonly peak: number;
  readonly violations: readonly ConflictViolation[];
  readonly complete: boolean;
}

/**
 * 충돌장을 감사한다 — 요구가 온전한가, 다툼마다 까닭이 서는가, 그리고 **빠뜨린 다툼이 없는가**.
 * 던지지 않는다. R4-c `auditBeliefs` 의 짝이다.
 */
export function auditConflicts(
  field: ConflictField,
  result: DetectResult,
  graphs: readonly DependencyGraph[],
  options: JudgeOptions = {},
): ConflictAudit {
  const violations: ConflictViolation[] = [...checkClaims(result.claims, graphs)];

  for (const [index, conflict] of field.conflicts.entries()) {
    checkConflict(conflict, result.claims, options, violations, `$.conflicts[${String(index)}]`);
  }

  // 빠뜨린 다툼이 없는가 — 같은 재료로 다시 판정해 충돌장과 대조한다.
  // 이것이 "다툼을 빠뜨리지 않는다" 를 주장이 아니라 검사로 만든다 (R1-b `witnessViolations` 의 짝).
  const expected = judgeAll(result.contests, options).conflicts;
  for (const conflict of expected) {
    if (field.byKey.has(conflict.key)) continue;
    violateConflict(
      violations,
      conflict.sides[0]?.subjectId ?? '',
      'missing-contest',
      '$.conflicts',
      `${conflict.label} 은 ${conflict.reason} 의 조건을 갖췄는데 충돌장에 없다 — 다투는데 아무도 모르는 다툼은 없다`,
    );
  }

  return {
    contests: result.contests.length,
    conflicts: field.conflicts.length,
    peaces: field.peaces.length,
    opposed: field.conflicts.filter((conflict) => conflict.reason === 'opposed').length,
    scarcity: field.conflicts.filter((conflict) => conflict.reason === 'scarcity').length,
    internal: field.conflicts.filter((conflict) => conflict.scope === 'internal').length,
    between: field.conflicts.filter((conflict) => conflict.scope === 'between').length,
    calm: unconflicted(field, graphs).length,
    peak: field.conflicts.reduce((top, conflict) => Math.max(top, conflict.severity), 0),
    violations,
    complete: violations.length === 0,
  };
}

/** 감사를 한 줄로 접는다 — 터미널·배지용. */
export function conflictFieldVerdict(audit: ConflictAudit): string {
  if (!audit.complete) {
    return `충돌장이 어긋났다 — ${[...new Set(audit.violations.map((violation) => violation.rule))].join(', ')}`;
  }
  return `겹침 ${String(audit.contests)} · 다툼 ${String(audit.conflicts)}(양립 불가 ${String(audit.opposed)} · 모자람 ${String(audit.scarcity)}) · 다툼 아닌 겹침 ${String(audit.peaces)} · 주체 안 ${String(audit.internal)} · 사이 ${String(audit.between)}`;
}

/** 이분 그래프의 점 하나 — 주체이거나 그들이 함께 보는 것이다. */
export interface BipartiteNode {
  readonly id: string;
  readonly label: string;
  /** `subject` 이거나 다툼의 까닭(`opposed`·`scarcity`) — 색이 여기서 갈린다 */
  readonly kind: 'subject' | 'opposed' | 'scarcity';
  readonly hint: string;
  /** 주체 쪽인가 — 뿌리로 그려 한쪽 열이 되게 한다 */
  readonly root: boolean;
}

/** 이분 그래프의 선 하나 — **언제나 주체에서 대상으로 간다**. */
export interface BipartiteEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly strength: number;
}

/** 주체↔경합 대상 이분 그래프 — 공용 렌더러 ②의 재료 (MODULES.md D5 시각화). */
export interface Bipartite {
  readonly nodes: readonly BipartiteNode[];
  readonly edges: readonly BipartiteEdge[];
}

/**
 * 충돌장을 이분 그래프로 편다.
 *
 * 한쪽 열은 주체, 다른 열은 그들이 함께 보는 것이다. **주체끼리는 잇지 않는다** — 누가 누구와
 * 싸우는지는 아직 아무도 모른다(서로를 봐야 알고, 그것은 R3·R4 다). D5 가 아는 것은
 * "이 대상 앞에 이들이 함께 서 있다" 까지다.
 */
export function bipartiteOf(
  field: ConflictField,
  labels: ReadonlyMap<Id, string> = new Map(),
): Bipartite {
  const nodes = new Map<string, BipartiteNode>();
  const edges: BipartiteEdge[] = [];

  for (const conflict of field.conflicts) {
    nodes.set(conflict.id, {
      id: conflict.id,
      label: conflict.label,
      kind: conflict.reason,
      hint: conflict.note,
      root: false,
    });
    for (const side of conflict.sides) {
      if (!nodes.has(side.subjectId)) {
        nodes.set(side.subjectId, {
          id: side.subjectId,
          label: labels.get(side.subjectId) ?? side.subjectId,
          kind: 'subject',
          hint: '이 주체가 낀 다툼들',
          root: true,
        });
      }
      edges.push({
        from: side.subjectId,
        to: conflict.id,
        relation: side.label,
        strength: side.pressure,
      });
    }
  }

  return {
    nodes: stableSort([...nodes.values()], (left, right) =>
      compareStrings(`${left.root ? '0' : '1'}/${left.id}`, `${right.root ? '0' : '1'}/${right.id}`),
    ),
    edges: stableSort(edges, (left, right) =>
      compareStrings(`${left.from}/${left.to}/${left.relation}`, `${right.from}/${right.to}/${right.relation}`),
    ),
  };
}

/** 주체마다 무엇에 끼어 있는가 — Lab 표의 재료. */
export interface ConflictRow {
  readonly subjectId: Id;
  readonly label: string;
  readonly conflicts: number;
  readonly internal: number;
  readonly between: number;
  readonly worst: string;
  readonly severity: number;
}

export function conflictTable(
  field: ConflictField,
  graphs: readonly DependencyGraph[],
  labels: ReadonlyMap<Id, string> = new Map(),
): readonly ConflictRow[] {
  return graphs.map((graph) => {
    const mine = conflictsFor(field, graph.subjectId);
    const worst = mine.reduce<DependencyConflict | null>(
      (top, conflict) => (top === null || conflict.severity > top.severity ? conflict : top),
      null,
    );
    return {
      subjectId: graph.subjectId,
      label: labels.get(graph.subjectId) ?? graph.name,
      conflicts: mine.length,
      internal: mine.filter((conflict) => conflict.scope === 'internal').length,
      between: mine.filter((conflict) => conflict.scope === 'between').length,
      worst: worst === null ? '(다툼 없음)' : worst.label,
      severity: worst?.severity ?? 0,
    };
  });
}
