// 표현 생성의 입출력 계약 (기획서 §33.3 / Phase-8 §8.2)
//
// **여기 있는 것은 전부 순수 데이터다.** 그래서 Event Interpreter 는 세계를 만질 방법이 없다 —
// WorldRuntime 도 WorldState 도 이 파일에 등장하지 않고, Interpreter 는 이 타입만 받는다(§33 마지막 문단).
// 읽기 전용 강제를 주석의 약속이 아니라 **타입의 모양**으로 만드는 것이 이 파일의 목적이다.

/** §33.3 "생성 대상" 6종 그대로 */
export type NarrationKind =
  | "event_title"
  | "dialogue"
  | "rumor"
  | "document"
  | "observation"
  | "event_summary";

export const NARRATION_KINDS: NarrationKind[] = [
  "event_title",
  "dialogue",
  "rumor",
  "document",
  "observation",
  "event_summary",
];

/** §33.3 예시 JSON 의 speaker — 상태 전체가 아니라 "말하는 데 필요한 것"만 */
export interface NarrationSpeaker {
  id: string;
  name: string;
  values: string[];
  fear: string;
  currentGoal: string;
  /** 관찰자(= 대화 상대)와의 관계 수치 */
  relationshipToObserver?: { trust: number; respect: number; fear: number };
}

/**
 * 생성 호출 하나의 입력 (§33 "월드 상태 전체를 매번 전달하지 않는다").
 * 캐시 키는 (kind, eventId, at, observerId) 다 — 같은 사건·같은 시점·같은 관찰자면 같은 문장이다.
 */
/**
 * 관찰자가 모르는 사실 하나 — **말하면 안 되는 것**의 구조화 형태 (§8.2).
 *
 * 왜 문장이 아니라 구조인가: 누출 판정을 "단어가 등장했는가"로 하면 관찰자가 이미 아는 이름
 * (사건이 벌어진 지역, 아는 참여자)까지 금지어가 되어 버린다. 비밀은 이름이 아니라
 * **"그 대상의 그 상태가 그 값이다"** 이므로, 판정도 그 세 쪽이 함께 등장했는지로 한다.
 */
export interface ForbiddenFact {
  /** 사람이 읽는 형태 — 프롬프트의 "말하면 안 되는 것" 목록에 실린다 */
  sentence: string;
  /** 상태 비밀: 이 셋이 함께 나타나면 누출이다 */
  subjectLabel?: string;
  stateKey?: string;
  value?: string;
  /** 정체 비밀: 이 이름이 나타나면 누출이다 (아직 정체를 모르는 참여자) */
  identityLabel?: string;
}

export interface NarrationRequest {
  kind: NarrationKind;
  eventId: string;
  /** 사건의 시점 (tick) — 시간이 흐르면 문장도 다시 만들어진다 */
  at: number;
  /** 이 문장을 읽는 사람 — 정보 비대칭의 기준점 */
  observerId: string;
  eventType: string;
  /** 사건이 벌어진 자리 */
  locationLabel: string;
  participantLabels: string[];
  speaker?: NarrationSpeaker;
  /** 관찰자가 아는 사실 (§30 knownFacts) */
  knownFacts: string[];
  /**
   * 관찰자가 **모르는** 사실.
   * 프롬프트에는 "말하면 안 되는 것"으로 실리고, 생성 결과는 이 목록으로 다시 검사된다 —
   * 정보 비대칭이 대화에서 새지 않게 하는 핵심 장치(§8.2).
   */
  unknownFacts: ForbiddenFact[];
  conversationPurpose?: string;
  /** 템플릿 치환용 표시 수치 */
  metrics: { key: string; value: string }[];
  tags: string[];
}

export interface NarrationResult {
  kind: NarrationKind;
  text: string;
  /** template=폴백 문장, generated=포트가 만든 문장 */
  source: "template" | "generated";
  fromCache: boolean;
  /** 생성 문장이 금지 사실을 흘려 폐기된 경우 그 근거 */
  rejectedLeaks?: string[];
}

/**
 * 표현 생성 포트 (§2.1).
 * generation/TextGenerationPort 와 같은 자리에 있지만 **입력이 다르다** —
 * 세계 생성은 정의를 만들고, 이쪽은 이미 있는 사건을 문장으로 옮긴다. 없으면 템플릿으로 돈다.
 */
export interface NarrationPort {
  narrate(request: NarrationRequest, forbidden: ForbiddenFact[]): Promise<string>;
}
