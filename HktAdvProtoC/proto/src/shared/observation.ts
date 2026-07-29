// 관찰 신호 (기획서 §23)
// shared 에 두는 이유: 신호는 스냅샷에 실려 경계를 넘는 순수 데이터이기 때문이다.
import type { Position } from "./state";

/**
 * §23 관찰 채널 12종 전부 (2차 재검증 F-3 — 촉각·열·문서·소문이 마지막으로 채워졌다).
 * 채널은 타입만으로 존재하지 않는다: 각 채널에는 **신호를 내는 자리**(행동·규칙의 visibleSignals)와
 * **그것을 받는 감각**(§15 senses)이 함께 있어야 한다 — `npm run review:2` 가 그 짝을 센다.
 */
export type ObservationChannel =
  /** 시각 */
  | "sight"
  /** 청각 */
  | "sound"
  /** 후각 */
  | "smell"
  /** 촉각 — 닿아야 알 수 있다. 사거리가 가장 짧고 확신이 가장 높다(닿은 것은 속일 수 없다) */
  | "touch"
  /** 진동 */
  | "vibration"
  /** 열 — 몸·불이 남기는 온기. 어둠·차폐를 넘어 오지만 무엇인지는 말해 주지 않는다 */
  | "heat"
  /** 의력 감지 */
  | "energy_sense"
  /** 흔적 */
  | "trace"
  /** 대화 — 마주 보고 말한다 */
  | "talk"
  /** 문서 — 남는다. 남긴 자가 자리에 없어도 읽히고, 낡아도 그대로 남는다(읽을 수 있는 자만 받는다) */
  | "document"
  /** 소문 — 전달자의 믿음이 실려 온다(relayBelief). 멀리 가고 부정확하다 */
  | "rumor"
  /** 조직 보고 */
  | "report";

/**
 * 채널 목록의 단일 출처. Record 로 적어 두므로 채널을 하나 더하면 **여기를 채우지 않는 한 컴파일되지 않는다** —
 * "타입에는 있는데 아무도 모르는 채널"이 다시 생기지 않게 하는 장치다.
 */
const CHANNEL_TABLE: Record<ObservationChannel, true> = {
  sight: true,
  sound: true,
  smell: true,
  touch: true,
  vibration: true,
  heat: true,
  energy_sense: true,
  trace: true,
  talk: true,
  document: true,
  rumor: true,
  report: true,
};

/** §23 채널 12종 (선언 순서 = 기획서 목록 순서) */
export const OBSERVATION_CHANNELS = Object.keys(CHANNEL_TABLE) as ObservationChannel[];

/**
 * 몸으로 직접 받는 채널 — 말·글·보고처럼 **누군가 전해 주는** 채널을 뺀 나머지.
 * 능력의 관찰 가능한 현상(§16 observableSignals)은 이쪽에서만 난다: 능력은 소문을 내지 않는다.
 */
export const SENSORY_CHANNELS: ObservationChannel[] = OBSERVATION_CHANNELS.filter(
  (channel) => !["talk", "document", "rumor", "report"].includes(channel),
);

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
