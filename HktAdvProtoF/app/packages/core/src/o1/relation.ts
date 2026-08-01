// O1-c 관계 3종 — 주체가 세계에 "거는 것" 을 적는 세 타입.
//
//   Claim       주체가 참이라 여기는 것 — 실제 상태와 다를 수 있다 (R4 믿음의 원자)
//   Commitment  주체 사이에 걸린 약속 — 퀘스트를 대체한다 (E2)
//   Affordance  무엇이 어떤 행동을 가능케 하는가 (P0 행동 원자가 붙는 자리)
//
// 셋 다 "세계가 그러하다" 가 아니라 "주체가 그렇게 여긴다 / 그렇게 걸었다" 이다.
// 그래서 Claim 은 State 와 값이 달라도 온전한 원소다 — 틀린 믿음이 곧 콘텐츠다
// (원문 §13.1 은 실제 사실과 주체가 믿는 사실을 분리한다).

import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import {
  needEnum,
  needId,
  needIdList,
  needNumber,
  needString,
  needStringList,
  needTickOrNull,
  needUnit,
  type Fields,
} from './check.ts';
import type { OnticBase, OntologyViolation } from './kinds.ts';

/** 약속의 상태 전이 — 제안 → 수락 → (이행 | 위반 | 만료). */
export const COMMITMENT_STATES = [
  'proposed',
  'accepted',
  'fulfilled',
  'breached',
  'expired',
] as const;
export type CommitmentState = (typeof COMMITMENT_STATES)[number];

/** 주체가 참이라 여기는 것. */
export interface Claim extends OnticBase<'Claim'> {
  /** 누가 믿는가 */
  readonly holderId: Id;
  /** 무엇에 대한 주장인가 — State·Entity·Subject·Event 의 id */
  readonly aboutId: Id;
  /** 무엇이라고 여기는가 */
  readonly assertion: string;
  /** 얼마나 확신하는가 0~1 — 확신 1 도 틀릴 수 있다 */
  readonly confidence: number;
  /** 어디서 왔는가 — 현상·전언·다른 주장의 id. 비어 있으면 근거 없는 믿음 */
  readonly sourceIds: readonly Id[];
}

/** 주체 사이에 걸린 약속. 퀘스트가 아니라 계약이다. */
export interface Commitment extends OnticBase<'Commitment'> {
  readonly fromId: Id;
  readonly toId: Id;
  /** 무엇을 하기로 했는가 */
  readonly obligation: string;
  /** 무엇을 받기로 했는가 */
  readonly reward: string;
  /** 언제까지 (tick). 기한 없으면 null */
  readonly dueTick: Tick | null;
  readonly state: CommitmentState;
  /** 어기면 무엇이 남는가 — 위반 결과 없는 약속은 약속이 아니다 (E2) */
  readonly breachEffect: string;
}

/** 무엇이 어떤 행동을 가능케 하는가. */
export interface Affordance extends OnticBase<'Affordance'> {
  /** 무엇이 제공하는가 — Entity·Subject 의 id */
  readonly providerId: Id;
  /** 어떤 행동인가 — 행동 원자 16종의 이름 (P0 이 집합을 확정한다) */
  readonly action: string;
  /** 무엇이 갖춰져야 하는가 */
  readonly requires: readonly string[];
  /** 무엇을 얻는가 — 얻는 것 없는 어포던스는 행동을 유도하지 못한다 */
  readonly yields: readonly string[];
  /** 무엇을 치르는가 (0 초과) — 공짜 가능성은 세계를 붕괴시킨다 (O0 공리·G5) */
  readonly cost: number;
}

/** Claim 필드 검사. */
export function checkClaim(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needId(fields, 'holderId', out);
  needId(fields, 'aboutId', out);
  needString(fields, 'assertion', out);
  needUnit(fields, 'confidence', out);
  // 근거 없는 믿음(빈 목록)은 허용한다 — 소문·직감도 주장이다. 다만 근거가 없다는 사실은 남는다.
  needIdList(fields, 'sourceIds', out);
}

/** Commitment 필드 검사. */
export function checkCommitment(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needId(fields, 'fromId', out);
  needId(fields, 'toId', out);
  needString(fields, 'obligation', out);
  needString(fields, 'reward', out);
  needTickOrNull(fields, 'dueTick', out);
  needEnum(fields, 'state', COMMITMENT_STATES, out);
  needString(fields, 'breachEffect', out);

  // 자기 자신과의 약속은 상대가 없어 위반을 물을 수 없다.
  const from = fields['fromId'];
  if (typeof from === 'string' && from === fields['toId']) {
    out.push({
      rule: 'bad-field',
      path: '$.toId',
      message: '자기 자신과는 약속할 수 없다 — 위반을 물을 상대가 없다',
    });
  }
}

/** Affordance 필드 검사. */
export function checkAffordance(fields: Fields, out: OntologyViolation[]): void {
  needId(fields, 'id', out);
  needId(fields, 'providerId', out);
  needString(fields, 'action', out);
  needStringList(fields, 'requires', out);
  needStringList(fields, 'yields', out);
  needNumber(fields, 'cost', out, { min: 0 });

  if (fields['cost'] === 0) {
    out.push({
      rule: 'bad-field',
      path: '$.cost',
      message: '비용 없는 가능성은 거부한다 — 모든 행동은 무언가를 치른다 (O0 공리)',
    });
  }
  const yields = fields['yields'];
  if (Array.isArray(yields) && yields.length === 0) {
    out.push({
      rule: 'bad-field',
      path: '$.yields',
      message: '얻는 것이 없으면 아무도 이 행동을 고르지 않는다 — 최소 1개',
    });
  }
}

/** 관계 3종의 검사기 묶음. */
export const relationCheckers = {
  Claim: checkClaim,
  Commitment: checkCommitment,
  Affordance: checkAffordance,
} as const;

export function isClaim(value: OnticBase): value is Claim {
  return value.kind === 'Claim';
}

export function isCommitment(value: OnticBase): value is Commitment {
  return value.kind === 'Commitment';
}

export function isAffordance(value: OnticBase): value is Affordance {
  return value.kind === 'Affordance';
}

/** 약속이 기한을 넘겼는가 — 상태 전이(E2)의 판정 재료. */
export function isOverdue(commitment: Commitment, now: Tick): boolean {
  if (commitment.dueTick === null) return false;
  if (commitment.state === 'fulfilled' || commitment.state === 'expired') return false;
  return now > commitment.dueTick;
}
