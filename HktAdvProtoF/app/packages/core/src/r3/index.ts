// R3 감각과 위치에 따른 감지 — 놓인 흔적과 읽히는 흔적이 갈린다.

export {
  COVER_RESISTANCES,
  UNREACHABLE,
  attenuationVerdict,
  checkAttenuation,
  coverOf,
  coverResistance,
  distanceBetween,
  reachLine,
  reachOf,
  standsIn,
  type AttenuationReport,
  type CoverResistance,
  type Reach,
} from './reach.ts';

export {
  perceptViolationVerdict,
  violatePercept,
  type PerceptViolation,
  type PerceptViolationRule,
} from './violation.ts';
