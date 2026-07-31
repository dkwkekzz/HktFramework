import type { EntityId } from '@hkt/k0-entity-state';

/**
 * U0 의 계약 타입.
 *
 * 원문 「11」 U0 의 「포함」은 일곱 항목이다 — **욕구 · 가치 · 특성 · 감정 · 능력 · 자원 · 신체 연결**.
 * 일곱이 모두 여기 있고, 일곱이 모두 무엇인가를 바꾼다. 있기만 한 칸을 두지 않는 것이 이 모듈의
 * 첫 번째 규율이다(장면 `nothing_in_the_subject_is_decoration` 가 하나씩 흔들어 확인한다).
 *
 * 필드 이름은 세계 설계 원본 10장의 `SubjectState` 를 따른다. 원본이 `capabilities: Id[]` 라고
 * 적었으므로 능력은 **주체 실체의 태그**로 둔다 — 태그 배열이 곧 Id 목록이고, K1 의 `has_tag` 가
 * 그것을 읽고 K2 의 `attach_tag`·`remove_tag` 가 그것을 쓴다. 컴포넌트로 바꿔 적으면 원본과
 * 어긋나고(원문 「23」 상위 계약 변경 금지), 법칙이 읽을 수단도 사라진다.
 */

/** 주체의 상태를 담는 K0 컴포넌트 이름. */
export const SUBJECT_COMPONENT = {
  /** 욕구 — 수위 0~10. 몸에서 올라오고, 채워지면 잦아든다. */
  NEEDS: 'needs',
  /** 가치관 — 0~1. 잘 변하지 않는다(변화는 R 페이즈의 몫). */
  VALUES: 'values',
  /** 특성(성격) — 0~1. */
  TRAITS: 'traits',
  /** 감정 — 0~1. 선택의 온도를 흔든다. */
  EMOTIONS: 'emotions',
  /** 자원 — 0 이상. 지금 손에 쥔 것. */
  RESOURCES: 'resources',
  /** 신체 연결 — 이 주체가 세계에 닿아 있는 실체들 */
  BODY: 'body',
} as const;

/**
 * 능력 태그의 앞머리.
 *
 * `cap_forage` 태그 하나가 원본 10장 `capabilities: Id[]` 의 원소 `forage` 하나다.
 */
export const CAPABILITY_PREFIX = 'cap_';

/**
 * 주체가 제출하는 의도의 동사.
 *
 * 주체의 상태가 바뀌는 것도 세계가 바뀌는 것이므로 원인이 되는 사건이 있어야 한다(GI-01).
 * 그래서 **느끼는 일 자체를 의도로 적는다** — 배가 고파지는 것도, 겁이 나는 것도 사건이다.
 *
 * `sense_*` 는 몸마다 하나씩, `weigh_means` 는 주체마다 하나씩 제출된다. 몸이 없는 주체(아직
 * 구성원이 정해지지 않은 조직 같은)도 저울질은 한다.
 */
export const SUBJECT_VERB = {
  /** 몸의 허기를 느낀다 */
  SENSE_HUNGER: 'sense_hunger',
  /** 몸의 상함을 느낀다 */
  SENSE_HARM: 'sense_harm',
  /** 손에 쥔 수단을 저울질한다 */
  WEIGH_MEANS: 'weigh_means',
} as const;

export type SubjectVerb = (typeof SUBJECT_VERB)[keyof typeof SUBJECT_VERB];

/** 욕구 수위의 천장. 스키마의 `maximum` 과 같은 값이며 법칙이 이 위로 밀어 올리지 못한다. */
export const NEED_CEILING = 10;

/**
 * 주체가 자기 자신에 대해 아는 것 — **U0 이 세계를 보는 유일한 창**.
 *
 * 우선순위 계산 함수는 `EntityStore` 를 받지 않고 이것만 받는다. 그래야 "주체는 서버의 실제 세계
 * 상태가 아니라 자기 상태를 통해서만 판단한다"(GI-02)가 규약이 아니라 **타입으로** 강제된다.
 * 세계를 보고 싶으면 U1(지각)을 거쳐야 한다.
 */
export interface SubjectView {
  id: EntityId;
  /** 원본 10장 `SubjectState.kind` — player · person · creature · organization · god … */
  kind: string;
  needs: Record<string, number>;
  values: Record<string, number>;
  traits: Record<string, number>;
  emotions: Record<string, number>;
  /** 능력 id (오름차순). 태그에서 `cap_` 을 떼어낸 것이다. */
  capabilities: string[];
  resources: Record<string, number>;
  /** 신체 연결 (오름차순) */
  bodyEntityIds: EntityId[];
}

/**
 * 욕구 하나의 정의 — **콘텐츠 데이터**다.
 *
 * 어떤 가치와 어떤 성격이 이 욕구를 밀거나 누르는지는 세계가 정할 일이지 코드가 정할 일이 아니다.
 * 원본 10장 `PossibilityNode.activationWeights` 와 같은 자리이며, U0 에는 아직 가능성 노드가
 * 없으므로(G 페이즈) 욕구 자체가 그 무게를 든다.
 */
export interface NeedSpec {
  id: string;
  title: string;
  /** 가치 일치 V — 가치 id → 무게 (음수면 그 가치가 이 욕구를 누른다) */
  valueWeights: Record<string, number>;
  /** 성격 일치 T — 특성 id → 무게 */
  traitWeights: Record<string, number>;
  /** 이 욕구를 스스로 감당하게 해 주는 능력 id */
  capabilityIds: string[];
  /** 이 욕구를 당장 덜어 줄 수 있는 자원 id */
  resourceIds: string[];
}

/**
 * 기질 — 선택의 온도를 만드는 규칙 (원본 9장).
 *
 * > 충동적인 주체는 `Temperature`가 높다. 엄격하고 일관적인 주체는 낮다.
 * > 공포나 혼란은 일시적으로 높일 수 있다.
 */
export interface TemperamentSpec {
  base: number;
  traitWeights: Record<string, number>;
  emotionWeights: Record<string, number>;
  /** 온도의 하한. 0 이면 나눗셈이 무너진다. */
  floor: number;
}

/** 점수 한 항이 어느 상태에서 얼마나 왔는지 — 한 줄이 곱셈 하나다. */
export interface ScoreContribution {
  /** 가치 id 또는 특성 id */
  source: string;
  /** 욕구 정의가 준 무게 */
  weight: number;
  /** 주체가 실제로 가진 값 */
  level: number;
  product: number;
}

/** 원본 9장 `A(v)` 의 한 항. U0 이 실제로 재는 것은 N · V · T 셋이다. */
export interface ScoreTerm {
  /** `N` 욕구 긴급도 · `V` 가치 일치 · `T` 성격 일치 */
  id: 'N' | 'V' | 'T';
  label: string;
  value: number;
  contributions: ScoreContribution[];
}

/** 이 욕구를 감당할 수단이 손에 있는가 — 점수가 아니라 **표시**다. */
export interface MeansReport {
  /** 이 욕구를 다룰 능력을 가졌는가 */
  capable: boolean;
  /** 이 욕구를 덜어 줄 자원을 가졌는가 */
  provisioned: boolean;
  /** 가진 능력 id (오름차순) */
  capabilities: string[];
  /** 가진 자원 id → 양 */
  resources: Record<string, number>;
}

/** 욕구 하나의 활성도와 그 근거. */
export interface NeedScore {
  needId: string;
  title: string;
  /** A = N + V + T */
  activation: number;
  /** N — 욕구 긴급도 */
  urgency: number;
  /** V — 가치관과의 일치 */
  valueFit: number;
  /** T — 성격과의 일치 */
  traitFit: number;
  terms: ScoreTerm[];
  /** Softmax 확률. U0 은 **뽑지 않는다** — 고르는 일은 G3 의 몫이다. */
  probability: number;
  /** 1 이 가장 앞선다 */
  rank: number;
  means: MeansReport;
}

/**
 * 원본 9장 `A(v)` 중 **아직 아무도 재지 않는 항**.
 *
 * 채우지 않은 것을 0 으로 슬쩍 넣어 두면 "이미 다 쟀다"로 읽힌다. 이름을 그대로 남겨
 * 화면과 증거가 무엇이 비어 있는지 말하게 한다.
 */
export const PENDING_TERMS: readonly string[] = [
  'M 관련 기억 — U3',
  'R 대상과의 관계 — U3',
  'F 행동 가능성 — G2',
  'C 비용 — G3',
  'Risk 위험 — G3',
  'Taboo 금기 위반 — G3',
];

/** 주체 하나의 욕구 우선순위. */
export interface NeedRanking {
  subjectId: string;
  kind: string;
  /** 원본 9장의 `Temperature` */
  temperature: number;
  /** 순위 오름차순 */
  scores: NeedScore[];
  /** 순위대로의 욕구 id */
  order: string[];
  /** 가장 앞선 욕구. 잴 욕구가 하나도 없으면 null */
  top: string | null;
  /** 활성도가 0 을 넘은 욕구 (순위 순서) */
  activated: string[];
  pending: readonly string[];
}

/**
 * 원문 「11」 끝의 `DecisionTrace` 중 **U0 이 채울 수 있는 칸**.
 *
 * 원문은 "모든 결정에는 `DecisionTrace`를 남긴다"고 규정하지만, 그 인터페이스의 절반은
 * 지각(U1)·기억(U3)·행동(G)의 것이다. 없는 것을 지어내지 않고 채운 칸과 빈 칸을 함께 남긴다.
 */
export interface PriorityTrace {
  subjectId: string;
  /** `DecisionTrace.activatedNeedIds` */
  activatedNeedIds: string[];
  /** `DecisionTrace.candidateGoalScores` */
  candidateGoalScores: Record<string, number>;
  /** 아직 채울 수 없는 `DecisionTrace` 의 칸과 그 주인 */
  pendingFields: string[];
}

/** 한 틱의 주체 단면. 대표 검증은 이 시계열을 읽는다. */
export interface SubjectSample {
  tick: number;
  /** 주체 id → 우선순위 (키 오름차순) */
  rankings: Record<EntityId, NeedRanking>;
  /** 주체 id → 그 시점의 상태 */
  views: Record<EntityId, SubjectView>;
  /**
   * 몸 실체 id → 그 몸의 자연 상태 (S1 컴포넌트 이름 → 대표 값).
   *
   * 주체가 이것을 읽는 것이 아니다 — 화면과 검증이 "같은 몸인가"를 눈으로 대조하기 위한 자리다.
   * 주체가 세계를 보는 창은 오직 `SubjectView` 다(GI-02).
   */
  bodies: Record<EntityId, Record<string, number>>;
  /** 이 틱에 적용된 법칙 id (오름차순·중복 없음) */
  appliedLaws: string[];
  /** 이 틱에 거부된 의도 — 무엇이 왜 막혔는지 */
  rejections: SubjectRejection[];
}

/** 거부 한 줄 — 원문 「22」 8단계의 "인과 추적"이 여기서 눈에 보인다. */
export interface SubjectRejection {
  intentId: string;
  actor: EntityId;
  verb: string;
  code: string;
  /** 막은 자리 — 규칙 id 와 조건 경로 */
  path: string;
  message: string;
}

/** 두 주체의 우선순위 비교 — 대표 검증이 읽는 값. */
export interface DivergenceReport {
  a: EntityId;
  b: EntityId;
  /** 두 주체의 욕구 **수위가 한 칸도 다르지 않은가** */
  sameNeeds: boolean;
  /** 두 주체가 공유하는 욕구 수위 (sameNeeds 일 때만 채워진다) */
  sharedNeeds: Record<string, number>;
  orderA: string[];
  orderB: string[];
  topA: string | null;
  topB: string | null;
  /** 같은 욕구 수위인데 순위가 갈렸는가 — 원문 「11」 U0 의 대표 검증 그 자체 */
  diverged: boolean;
  /** 무엇이 갈랐는가 (가치·성격의 차이 중 큰 것부터) */
  causes: DivergenceCause[];
}

export interface DivergenceCause {
  needId: string;
  /** `value` 또는 `trait` */
  kind: 'value' | 'trait';
  source: string;
  /** A 의 기여 - B 의 기여 */
  gap: number;
}
