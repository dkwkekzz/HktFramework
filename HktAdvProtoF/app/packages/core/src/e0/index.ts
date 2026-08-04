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
