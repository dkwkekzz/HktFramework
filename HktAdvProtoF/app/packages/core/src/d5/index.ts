// D5 의존 충돌 탐지 — 여러 그래프를 한 세계에 겹쳐 놓으면 무엇이 부딪히는가.

export {
  claimIdOf,
  claimLine,
  claimsFrom,
  claimsOf,
  checkClaim,
  checkClaims,
  slotKeyOf,
  substitutabilityOf,
  targetKeyOf,
  timeNodes,
  type DependencyClaim,
} from './claim.ts';

export {
  auditConflicts,
  bipartiteOf,
  conflictFieldVerdict,
  conflictTable,
  conflictsFor,
  detectConflicts,
  openConflictField,
  unconflicted,
  type Bipartite,
  type BipartiteEdge,
  type BipartiteNode,
  type ConflictAudit,
  type ConflictField,
  type ConflictRow,
  type DetectResult,
} from './field.ts';

export {
  bandsCompatible,
  checkConflict,
  conflictLine,
  contestIdOf,
  contestsOf,
  demandOf,
  judge,
  judgeAll,
  pressureOf,
  severityOf,
  supplyOf,
  type ConflictReason,
  type ConflictSide,
  type Contest,
  type DependencyConflict,
  type JudgeOptions,
  type Judgement,
  type Peace,
} from './conflict.ts';

export {
  conflictViolationVerdict,
  violateConflict,
  type ConflictViolation,
  type ConflictViolationRule,
} from './violation.ts';
