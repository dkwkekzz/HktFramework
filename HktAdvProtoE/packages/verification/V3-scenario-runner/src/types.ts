/**
 * V3 의 계약 타입.
 *
 * 원문 「8」이 V3 에 요구하는 것은 두 가지다 — Scenario Runner 와 Fixture Loader.
 * 여기서 정의하는 형태는 모두 **JSON 으로 표현 가능한 데이터**다. 조건에 함수나 표현식 문자열을 두지
 * 않는 이유는 원문 「23」의 "임의 실행 코드를 콘텐츠 데이터에 삽입" 금지 때문이다 —
 * 조건은 `경로 + 연산자 + 값` 세 조각으로만 쓴다.
 */

import type { JsonSchema } from '@hkt/v1-schema';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

// ---------------------------------------------------------------------------
// Given — 픽스처
// ---------------------------------------------------------------------------

/** 장면의 초기 상태 하나. `schemaId` 가 있으면 적재 시점에 V1 로 검증한다. */
export interface Fixture {
  id: string;
  title: string;
  /** V1 스키마 저장소에 등록된 `$id`. 없으면 형식 검증 없이 적재한다. */
  schemaId?: string;
  state: JsonObject;
}

// ---------------------------------------------------------------------------
// When — 단계
// ---------------------------------------------------------------------------

/** 시나리오가 부르는 단계 하나. `step` 은 등록된 `StepDefinition` 의 id 다. */
export interface StepCall {
  step: string;
  params?: JsonObject;
  /** Lab 에 그대로 보여 주는 설명 */
  note?: string;
}

/** 단계 실행 문맥 — 시간·난수·ID 는 전부 V2 가 준다 (원문 「23」: Math.random·Date.now 금지). */
export interface StepContext {
  scenarioId: string;
  stepId: string;
  /** 시나리오 안에서 몇 번째 단계인지 (0부터) */
  index: number;
  tick: number;
  timeMs: number;
  /** 이 단계 전용 하위 난수 스트림 — 다른 단계의 소비량이 이 열을 흔들지 못한다 */
  random(): number;
  randomInt(minInclusive: number, maxExclusive: number): number;
  /** 결정적 id 발급 */
  nextId(kind: string): string;
}

/**
 * 단계 정의.
 *
 * `apply` 는 받은 상태를 **바꾸지 않고** 새 상태를 돌려준다. 상태를 직접 고치면
 * "이 값을 누가 바꿨는가"를 추적할 수 없고, 전후 비교도 불가능해진다.
 * 규칙 위반을 알릴 때는 `StepRejection` 을 던진다 — 그러면 그 단계는 상태를 전혀 바꾸지 않는다.
 */
export interface StepDefinition {
  id: string;
  title: string;
  /**
   * 이 단계가 받는 `params` 의 스키마. 선언해 두면 실행 전에 V1 이 검사하므로,
   * 잘못 쓴 시나리오가 "실행은 됐는데 아무 일도 없었다"로 끝나지 않는다.
   */
  paramsSchema?: JsonSchema;
  apply(state: JsonObject, params: JsonObject, context: StepContext): JsonObject;
}

/** 단계가 규칙에 따라 거부되었음을 알리는 예외. 실패(버그)와 구분한다. */
export class StepRejection extends Error {
  readonly code: string;
  /** 거부의 근거가 된 상태 내 위치 */
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = 'StepRejection';
    this.code = code;
    this.path = path;
  }
}

// ---------------------------------------------------------------------------
// Then — 조건
// ---------------------------------------------------------------------------

export const CONDITION_OPERATORS = [
  'equals',
  'notEquals',
  'lessThan',
  'atMost',
  'greaterThan',
  'atLeast',
  'changed',
  'unchanged',
  'present',
  'absent',
  'length',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/** 조건을 평가할 시점. 숫자는 그 인덱스의 단계 **직후**를 뜻한다. */
export type ConditionAt = 'given' | 'final' | number;

export interface Condition {
  id: string;
  /** RFC 6901 JSON Pointer. 루트는 빈 문자열이다. */
  path: string;
  op: ConditionOperator;
  /** `equals` 등 비교 연산자가 쓰는 기대값 */
  value?: JsonValue;
  /** 기본은 `final` */
  at?: ConditionAt;
  /** 사람이 읽는 조건 설명 */
  reason?: string;
}

// ---------------------------------------------------------------------------
// 시나리오 명세
// ---------------------------------------------------------------------------

/** V2 의 시드 조합 규칙(원문 29장)에 그대로 넘기는 구성요소. `worldSeed` 는 10진 문자열. */
export interface ScenarioSeed {
  worldSeed: string;
  tick?: number;
  subjectId?: string;
  decisionCounter?: number;
}

export interface ScenarioSpec {
  id: string;
  title: string;
  /** 픽스처 id 로 가리키거나, 상태를 직접 적는다 */
  given: { fixture: string } | { state: JsonObject };
  when: StepCall[];
  then: Condition[];
  seed?: ScenarioSeed;
  /** 틱당 밀리초 — 기본 100 (V2 TickClock 의 기본값) */
  msPerTick?: number;
}

// ---------------------------------------------------------------------------
// 실행 결과
// ---------------------------------------------------------------------------

export interface RunIssue {
  code: string;
  /** 시나리오 명세 내 위치 (JSON Pointer 표기) */
  path: string;
  message: string;
}

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface StateChange {
  path: string;
  kind: ChangeKind;
  before: JsonValue | null;
  after: JsonValue | null;
}

export interface Transition {
  index: number;
  step: string;
  title: string;
  params: JsonObject;
  note: string;
  tick: number;
  timeMs: number;
  before: JsonObject;
  after: JsonObject;
  changes: StateChange[];
  /** 규칙에 따라 거부된 경우 — 이때 `after` 는 `before` 와 같다 */
  rejection: RunIssue | null;
  /** 단계 자체가 터진 경우 (버그). 여기서 시나리오가 멈춘다 */
  error: RunIssue | null;
}

export interface ConditionResult {
  id: string;
  path: string;
  op: ConditionOperator;
  at: ConditionAt;
  passed: boolean;
  expected: JsonValue | null;
  actual: JsonValue | null;
  /** 원문 「8」 V3 직관 검증 — 실패한 조건의 **전** 상태 (given 시점 값) */
  before: JsonValue | null;
  /** 같은 조건의 **후** 상태 (평가 시점 값) */
  after: JsonValue | null;
  /** 이 경로를 마지막으로 바꾼 단계. 아무 단계도 바꾸지 않았으면 null */
  blame: { index: number; step: string } | null;
  reason: string;
}

export interface ScenarioReport {
  scenarioId: string;
  title: string;
  /** 파생된 64비트 시드 (16진수) */
  seed: string;
  seedLabel: string;
  given: JsonObject;
  transitions: Transition[];
  final: JsonObject;
  conditions: ConditionResult[];
  /** 실행 전에 거부된 이유 — 비어 있지 않으면 `transitions` 는 비어 있다 */
  issues: RunIssue[];
  /** 실행이 멈춘 단계 인덱스. 끝까지 갔으면 null */
  stoppedAt: number | null;
  passed: boolean;
  /** 보고 전체의 해시 — 같은 시드·명세면 같은 값이어야 한다 */
  digest: string;
}
