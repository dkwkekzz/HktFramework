import type { ComponentSnapshot, EntityId } from '@hkt/k0-entity-state';
import type { Intent, PhenomenonSpec, StateDelta, TransactionRejection } from '@hkt/k2-rule-transaction';
import type { ClockSnapshot, IdSnapshot } from '@hkt/v2-determinism';

/**
 * 세계 사건 (원본 19.4 의 `WorldEvent` 중 K 커널이 채울 수 있는 항목).
 *
 * 원본의 `situationId` · `createdCommitmentIds` · `breachedCommitmentIds` · `unresolvedHookIds` 는
 * I·C 페이즈가 오면 채워진다. 지금 채울 수 없는 칸을 거짓으로 채우지 않는다.
 */
export interface WorldEvent {
  id: string;
  tick: number;
  /** 이 사건을 부른 사건들 (예약 사건이면 예약을 만든 사건) */
  causeEventIds: string[];
  intentIds: string[];
  appliedRuleIds: string[];
  participantSubjectIds: EntityId[];
  affectedEntityIds: EntityId[];
  stateDelta: StateDelta[];
  emittedPhenomena: PhenomenonSpec[];
}

/** 예약된 사건 하나 (K2 의 `schedule_event` 가 만든다). */
export interface ScheduledEntry {
  id: string;
  /** 이 틱에 일어난다 */
  fireAtTick: number;
  eventTemplateId: string;
  /** 예약을 만든 행위자 */
  actor: EntityId;
  targets: EntityId[];
  /** 예약을 만든 사건 */
  causeEventId: string;
}

/**
 * 예약 사건의 본체.
 *
 * 예약이 무엇을 하는지도 **데이터**로 적는다. 함수를 넘기면 스냅샷을 뜰 수도, 재생할 수도 없다.
 */
export interface ScheduledEventTemplate {
  id: string;
  verb: string;
  title?: string;
}

/** 제출된 의도의 일지 — 재시뮬레이션의 입력이다. */
export interface JournalEntry {
  tick: number;
  intent: Intent;
}

export interface SubmitResult {
  accepted: boolean;
  event: WorldEvent | null;
  rejection: TransactionRejection | null;
  appliedRuleId: string | null;
}

export interface WorldSnapshot {
  worldSeed: string;
  tick: number;
  store: ComponentSnapshot;
  log: WorldEvent[];
  pending: ScheduledEntry[];
  journal: JournalEntry[];
  ids: IdSnapshot;
  clock: ClockSnapshot;
  /** 위 전체의 해시. 같은 세계면 만들어진 경로와 무관하게 같다. */
  hash: string;
}

export interface InvariantReport {
  /** GI-01 — 사건 로그만으로 현재 상태를 다시 만들 수 있는가 */
  everyChangeHasAnEvent: boolean;
  /** GI-12 — 같은 일지를 다시 굴리면 같은 사건이 나오는가 */
  replayIsIdentical: boolean;
  /** 로그가 덧붙이기만 되었는가 (틱 단조 · id 유일) */
  logIsAppendOnly: boolean;
  /** K0 의 자기 감사 (GI-11 포함) */
  storeIssues: { code: string; path: string; message: string }[];
  violations: { code: string; path: string; message: string }[];
  /** 사건 로그의 해시 */
  logHash: string;
  /** 로그를 되짚어 만든 최종 상태의 해시 */
  replayedStoreHash: string;
  /** 실제 현재 상태의 해시 */
  storeHash: string;
}

export const REPLAY_ISSUE = {
  UNEXPLAINED_STATE: 'E_UNEXPLAINED_STATE_CHANGE',
  REPLAY_MISMATCH: 'E_REPLAY_MISMATCH',
  LOG_NOT_APPEND_ONLY: 'E_LOG_NOT_APPEND_ONLY',
  DUPLICATE_EVENT_ID: 'E_DUPLICATE_EVENT_ID',
  UNKNOWN_TEMPLATE: 'E_UNKNOWN_EVENT_TEMPLATE',
  BAD_DELTA: 'E_BAD_DELTA',
} as const;

export type ReplayIssueCode = (typeof REPLAY_ISSUE)[keyof typeof REPLAY_ISSUE];
