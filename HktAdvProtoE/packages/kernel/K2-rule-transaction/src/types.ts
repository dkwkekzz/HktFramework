import type { EntityId, JsonObject, JsonValue } from '@hkt/k0-entity-state';
import type { BindingTable, PredicateCause, PredicateSpec } from '@hkt/k1-predicate-query';

/**
 * K2 의 계약 타입.
 *
 * `RuleSpec` · `EffectSpec` 은 세계 설계 원본 [Design-MMO.md](../../../../design/Design-MMO.md) 15.3 의
 * DSL 을 그대로 따른다. 규칙은 **임의 JavaScript 실행 코드가 아니라 데이터 AST** 다 —
 * AI 나 콘텐츠 생성기가 규칙을 제안할 수 있어야 하지만 임의 코드를 서버에 삽입할 수는 없기 때문이다.
 */

/**
 * 규칙 우선순위 (원본 15.1).
 *
 * ```text
 * L0. 메타 공리
 * L1. 물리·생명 기본 규칙
 * L2. 종과 신체 규칙
 * L3. 의념·마물 기관·신적 능력 규칙
 * L4. 지역 특수 규칙
 * L5. 사회·제도 규칙
 * L6. 개인의 계약·맹세·능력 제약
 * ```
 */
export const RULE_SCOPES = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

/** L0 가 가장 권위가 높다. 숫자가 클수록 국소적인 예외다. */
export function scopeRank(scope: RuleScope): number {
  return RULE_SCOPES.indexOf(scope);
}

/** 효과 AST (원본 15.3 의 `EffectSpec`). */
export type EffectSpec =
  | { op: 'add'; path: string; value: number }
  | { op: 'multiply'; path: string; value: number }
  | { op: 'set'; path: string; value: JsonValue }
  | { op: 'transfer'; from: string; to: string; amount: number }
  | { op: 'attach_tag'; target: string; tag: string }
  | { op: 'remove_tag'; target: string; tag: string }
  | { op: 'create_commitment'; templateId: string }
  | { op: 'breach_commitment'; commitmentIdPath: string }
  | { op: 'schedule_event'; eventTemplateId: string; delayTicks: number };

export type EffectOp = EffectSpec['op'];

/** 현상 명세 (원본 15.3 의 `PhenomenonSpec`). K2 는 방출 목록만 만들고, 전파는 I 페이즈가 맡는다. */
export interface PhenomenonSpec {
  id: string;
  channels: string[];
  tags?: string[];
}

/** 규칙 AST (원본 15.3 의 `RuleSpec`). */
export interface RuleSpec {
  id: string;
  scope: RuleScope;
  /** 같은 scope 안에서의 우선순위. 클수록 먼저 본다. */
  priority: number;
  /** 이 규칙이 다루는 의도인가 */
  when: PredicateSpec;
  /** 이 규칙이 허용하기 위해 반드시 참이어야 하는 조건 */
  requires?: PredicateSpec;
  costs: EffectSpec[];
  effects: EffectSpec[];
  emits: PhenomenonSpec[];
  failureEffects?: EffectSpec[];
  tags: string[];
  /** 사람이 읽는 설명 — 판정에 쓰지 않는다. */
  title?: string;
}

/**
 * 행동 의도 (원본 19.3 의 `Intent` 중 K2 가 쓰는 부분).
 *
 * 전체 `Intent` 는 믿음·관계·비밀 등 U·I 페이즈의 항목까지 포함한다. K2 는 세계 커널이므로
 * **누가 무엇에게 무엇을 하려 하는가**만 본다.
 */
export interface Intent {
  id: string;
  actor: EntityId;
  verb: string;
  targets?: EntityId[];
  /** 규칙의 조건식이 읽는 추가 결합 (`ally` · `place` …) */
  bindings?: BindingTable;
  /** 의도에 딸린 값 (`amount` 같은 것). 조건식이 읽지는 않는다. */
  params?: JsonObject;
}

/** 상태 변화 한 줄 (원본 19.4 의 `stateDelta`). */
export interface StateDelta {
  /** `entity/<id>/components/<type>/<field>` 또는 `entity/<id>/tags` */
  path: string;
  op: EffectOp;
  before: JsonValue | null;
  after: JsonValue | null;
}

/** 규칙이 예약한 사건. K3 의 Scheduler 가 집어 간다. */
export interface ScheduledEffect {
  eventTemplateId: string;
  /** 몇 틱 뒤에 일어나는가 */
  delayTicks: number;
}

export interface TransactionRejection {
  code: string;
  /** 거부 근거의 위치 — 규칙 id 이거나 세계 안 좌표 */
  path: string;
  message: string;
  /** 조건이 어긋나 거부된 경우, 어느 조건이 왜 어긋났는지 */
  causes: PredicateCause[];
}

export interface RuleMatch {
  ruleId: string;
  scope: RuleScope;
  priority: number;
  matched: boolean;
  /** `requires` 판정. 규칙이 `when` 에 맞지 않으면 `null` */
  allowed: boolean | null;
  causes: PredicateCause[];
}

export interface TransactionOutcome {
  intentId: string;
  ok: boolean;
  /** 적용된 규칙 id. 실패면 `null` */
  appliedRuleId: string | null;
  /** 후보로 검토된 모든 규칙 — 왜 그 규칙이 골라졌는지의 근거 */
  matches: RuleMatch[];
  /** 비용으로 인한 변화 */
  costDelta: StateDelta[];
  /** 효과로 인한 변화 */
  effectDelta: StateDelta[];
  /** 비용 + 효과. 세계에 실제로 일어난 변화 전부다. */
  delta: StateDelta[];
  emitted: PhenomenonSpec[];
  scheduled: ScheduledEffect[];
  rejection: TransactionRejection | null;
}

export const TRANSACTION_ISSUE = {
  NO_RULE: 'E_NO_RULE_FOR_INTENT',
  FORBIDDEN: 'E_FORBIDDEN_BY_HIGHER_AUTHORITY',
  REQUIRES_UNMET: 'E_REQUIRES_UNMET',
  UNAFFORDABLE: 'E_UNAFFORDABLE_COST',
  BAD_EFFECT: 'E_BAD_EFFECT',
  BAD_RULE: 'E_BAD_RULE',
  UNKNOWN_ACTOR: 'E_UNKNOWN_ACTOR',
} as const;

export type TransactionIssueCode = (typeof TRANSACTION_ISSUE)[keyof typeof TRANSACTION_ISSUE];
