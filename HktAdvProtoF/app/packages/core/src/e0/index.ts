// E0 상황 군집 — 여럿의 의도가 같은 자리에 걸리면 무엇이 서는가.

export {
  situationViolationVerdict,
  violateSituation,
  type SituationViolation,
  type SituationViolationRule,
} from './violation.ts';

export {
  STAKE_AXES,
  checkStakes,
  stakeAxisLabel,
  stakeIdOf,
  stakeKeyOf,
  stakeLine,
  stakeSlotKeyOf,
  stakesByKey,
  stakesFrom,
  stakesFromConflict,
  stakesFromGoal,
  stakesFromIntent,
  stakesOf,
  type SituationStake,
  type StakeAxis,
  type StakeSpec,
  type StakeVia,
} from './stake.ts';

export {
  aimLabel,
  awarenessOf,
  clusterStakes,
  pairIdOf,
  pairLine,
  pairsFor,
  pairsOf,
  situationIdOf,
  situationKeyOf,
  situationLine,
  type ClusterResult,
  type ClusterSpec,
  type PairAim,
  type PairAwareness,
  type Situation,
  type SituationPair,
  type Solitude,
} from './cluster.ts';

export {
  auditSituations,
  calm,
  detectSituations,
  fillSituationField,
  openSituationField,
  situationFieldVerdict,
  situationGraphOf,
  situationsFor,
  type AuditSpec,
  type DetectSituationResult,
  type SituationAudit,
  type SituationEdge,
  type SituationField,
  type SituationGraph,
  type SituationNode,
} from './field.ts';
