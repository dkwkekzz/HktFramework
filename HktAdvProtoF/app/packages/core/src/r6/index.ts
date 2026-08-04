// R6 행동 의도 생성 — 계획이 요청이 되고, 겨눌 상대를 사이가 고른다.

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
  intentViolationVerdict,
  violateIntent,
  type IntentViolation,
  type IntentViolationRule,
} from './violation.ts';
