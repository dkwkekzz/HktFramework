// 관찰 신호 (기획서 §23)
// shared 에 두는 이유: 신호는 스냅샷에 실려 경계를 넘는 순수 데이터이기 때문이다.
import type { Position } from "./state";

/** §23 관찰 채널 목록 — Phase 1 이 사용하는 부분집합 */
export type ObservationChannel =
  | "sight"
  | "sound"
  | "smell"
  | "vibration"
  | "energy_sense"
  | "trace"
  | "talk"
  | "report";

/**
 * 신호가 주장하는 "믿음 후보".
 * 관찰에 성공한 주체는 이 주장을 자신의 믿음(§10 BeliefRecord)에 기록한다.
 * 주장 값은 실제 상태와 다를 수 있다 — 실제/믿음 분리(§10)의 근거가 여기서 생긴다.
 */
export interface ObservationClaim {
  subjectId: string;
  stateKey: string;
  value: unknown;
  confidence: number;
  /**
   * 관찰에 성공한 주체 *자신의* 상태 중 이 신호가 갱신하는 것 (예: known_threat_level).
   * "위협 목격 → 공포" 같은 규칙이 state_changed 트리거로 이어붙는 지점이다(Phase-1 규칙 분류의 사회 4).
   */
  observerStateKey?: string;
}

export interface ObservationSignal {
  id: string;
  sourceId?: string;
  locationId: string;
  channels: ObservationChannel[];
  strength: number;
  tags: string[];
  payload: Record<string, unknown>;
  createdAt: number;
  /**
   * §23 원문에는 없는 Phase 1 추가 필드.
   * 거리 판정을 3D 유클리드로 하기 위해 신호 발생 지점을 싣는다 (Phase-1 §1.4 공간 거리 규약).
   */
  position: Position;
  /** 관찰자가 받아들일 주장 (없으면 "무언가 있었다" 만 전달) */
  claim?: ObservationClaim;
}
