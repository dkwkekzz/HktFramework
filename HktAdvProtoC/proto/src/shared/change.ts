// 상태 변화 원시 기록 (기획서 §28)
// Phase 4 사건 탐지의 입력이다. Phase 1 부터 빠짐없이 쌓는다.

export interface StateChange {
  entityId: string;
  stateKey: string;
  before: unknown;
  after: unknown;
}

export interface RawWorldChange {
  /** 발급 순번 — 사건이 자기 재료를 가리키는 유일한 손잡이 (§28 changes) */
  id: number;
  time: number;
  sourceId?: string;
  targetIds: string[];
  locationId?: string;
  tags: string[];
  changedStates: StateChange[];
}

/**
 * 변경 로그 보관 한도.
 * 무한 증가를 막되(§24 기억과 같은 이유), 잘라내는 방식은 "가장 오래된 것부터"로 고정해
 * 같은 시드면 같은 로그가 남도록 한다(결정론).
 */
export const MAX_CHANGE_LOG = 20000;
