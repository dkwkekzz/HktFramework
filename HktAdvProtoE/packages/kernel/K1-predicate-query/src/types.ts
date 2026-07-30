import type { EntityId } from '@hkt/k0-entity-state';

/**
 * 조건식 AST.
 *
 * **원문 「9」 K1 의 `PredicateSpec` 을 한 줄도 늘리지 않고 그대로 옮긴 것이다.**
 * 연산자를 더하고 싶은 유혹이 계속 생긴다 — 예컨대 "체력 50 이하"는 `lte` 하나면 끝난다.
 * 그러나 그것은 상위 계약 변경이므로 여기서 하지 않는다(원문 「23」). `not(gt(...))` 로 적는다.
 */
export type PredicateSpec =
  | { op: 'eq'; path: string; value: unknown }
  | { op: 'gt'; path: string; value: number }
  | { op: 'lt'; path: string; value: number }
  | { op: 'has_tag'; target: string; tag: string }
  | { op: 'within_distance'; a: string; b: string; max: number }
  | { op: 'and'; items: PredicateSpec[] }
  | { op: 'or'; items: PredicateSpec[] }
  | { op: 'not'; item: PredicateSpec };

export type PredicateOp = PredicateSpec['op'];

/** 이름 → 실체 id. 조건식의 `path` · `target` · `a` · `b` 앞머리가 이 이름이다. */
export type BindingTable = Readonly<Record<string, EntityId>>;

/**
 * 경로 문법.
 *
 * ```text
 * <binding>.id                     실체 id
 * <binding>.kind                   실체 종류
 * <binding>.tags                   태그 배열
 * <binding>.<component>            컴포넌트 전체
 * <binding>.<component>.<field...> 컴포넌트 안의 값
 * ```
 */
export const PATH_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

/** 판정 한 마디의 기록. 참이든 거짓이든 왜 그런지가 남는다. */
export interface PredicateTrace {
  op: PredicateOp;
  passed: boolean;
  /** 이 마디가 본 위치 (`subject.health.current` 같은 경로나 결합 이름) */
  at: string;
  expected: unknown;
  actual: unknown;
  reason: string;
  children: PredicateTrace[];
}

/** 거짓의 원인 — 어느 조건이 어디서 어긋났는가. */
export interface PredicateCause {
  op: PredicateOp;
  at: string;
  expected: unknown;
  actual: unknown;
  reason: string;
}

export interface PredicateResult {
  passed: boolean;
  trace: PredicateTrace;
  /** 거짓일 때만 채워진다. 참이면 빈 배열이다. */
  causes: PredicateCause[];
}

/** 후보 모집단 제한. 없으면 세계 전체가 후보다. */
export interface QuerySource {
  kind?: string;
  withComponent?: string;
  tag?: string;
}

export interface QuerySpec {
  /** 후보 하나하나가 이 이름으로 조건식에 들어간다. */
  as: string;
  from?: QuerySource;
  where: PredicateSpec;
  /** `as` 이외의 고정 결합 (예: 기준이 되는 주체) */
  bindings?: BindingTable;
}

export type PlanSource = 'by_kind' | 'by_component' | 'by_tag' | 'full_scan';

/** 어느 인덱스로 후보를 좁혔는지. 판정이 아니라 **성능의 근거**다. */
export interface QueryPlan {
  source: PlanSource;
  key: string | null;
  reason: string;
  /** 좁힌 뒤 실제로 조건식을 돌린 실체 수 */
  scanned: number;
  /** 세계 전체의 실체 수 */
  total: number;
}

export interface QueryCandidate {
  id: EntityId;
  passed: boolean;
  causes: PredicateCause[];
}

export interface QueryReport {
  /** 조건을 만족한 실체 id — 언제나 오름차순이다. */
  matched: EntityId[];
  plan: QueryPlan;
  /** 후보별 판정. 왜 떨어졌는지가 여기 남는다. */
  candidates: QueryCandidate[];
  digest: string;
}

export const QUERY_ISSUE = {
  BAD_PATH: 'E_BAD_PATH',
  UNKNOWN_BINDING: 'E_UNKNOWN_BINDING',
  UNKNOWN_COMPONENT: 'E_UNKNOWN_COMPONENT',
  BAD_PREDICATE: 'E_BAD_PREDICATE',
  MISSING_VALUE: 'E_MISSING_VALUE',
  NOT_COMPARABLE: 'E_NOT_COMPARABLE',
  MISSING_POSITION: 'E_MISSING_POSITION',
} as const;

export type QueryIssueCode = (typeof QUERY_ISSUE)[keyof typeof QUERY_ISSUE];

/** 위치 컴포넌트의 이름. `within_distance` 가 이 컴포넌트를 읽는다. */
export const POSITION_COMPONENT = 'position';
