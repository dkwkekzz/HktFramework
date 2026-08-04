// R6 행동 의도 생성 — 계획이 요청이 되고, 겨눌 상대를 사이가 고른다.

export {
  CONSENT_AXIS,
  axisFor,
  checkAim,
  chooseAim,
  knownCounterparts,
  type AimCandidate,
  type AimResult,
  type AimSpec,
  type KnownCounterpart,
} from './aim.ts';

export {
  aimingAtoms,
  consentOf,
  formIntent,
  intentIdOf,
  intentLine,
  needsCounterpart,
  nextStep,
  orderIntents,
  type ActionIntent,
  type Aim,
  type IntentResult,
  type IntentSpec,
} from './intent.ts';

export {
  auditIntents,
  closeLoop,
  enqueue,
  idle,
  intentQueueVerdict,
  intentsAt,
  intentsFor,
  openIntentQueue,
  type IntentAudit,
  type IntentAuditSpec,
  type IntentQueue,
  type LoopResult,
  type LoopSpec,
  type LoopStep,
} from './queue.ts';

export {
  intentViolationVerdict,
  violateIntent,
  type IntentViolation,
  type IntentViolationRule,
} from './violation.ts';
