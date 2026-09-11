// engine/world-authoring — **조건은 하나의 형이다** (Condition · 평가기).
//
// 세계의 조건(문이 열리는 때 · 원천이 나는 철 · 결속의 조건 · 기억을 읽는 것)이 서로 다른
// 데이터 모양으로 흩어져 있던 것을 **한 형**으로 읽게 하는 기구다. 여기에는 게임 명사가 없다 —
// 방도 원천도 철도 경로도 이름으로 알지 못하고, 형(Target · Query · Operator · Value ·
// Qualifier · 집합)과 그것을 판정하는 산수만 있다. 값이 어디서 오는지는 호출자가 `ConditionRead`
// 로 준다 (검사의 `CheckContract` · 컴파일의 `CompileRules` 와 같은 어법 — 기반은 컨텐츠를
// 부르지 않는다).
//
// 지키는 것 셋.
//   ① **아무것도 저장하지 않는다** — change qualifier 의 직전 값은 호출자가 든다 (유도).
//      같은 조건 · 같은 읽기면 언제나 같은 답이다 (결정론).
//   ② **자리만인 것은 "판정 불가"** 다 — 거짓으로 읽지 않는다. player · faction Target,
//      distance · contains · relation · knowledge Query, chance 는 형에 있되
//      그 층이 오기 전까지 평가기가 `undecidable` 을 낸다.
//   ③ **읽을 수 없는 것도 판정 불가** 다 — 호출자의 read 가 그 Target 을 모르면(undefined 가
//      아니라 `unreadable`) 거짓이 아니라 판정 불가다. **없는 것**(undefined)은 EXISTS 의 거짓이다 —
//      둘은 다르다: 없다는 사실과 알 수 없다는 사실.

/** Target 의 갈래 아홉 + 자리만인 둘 (player · faction) */
export type ConditionTargetKind =
  | 'region'
  | 'area'
  | 'connector'
  | 'source'
  | 'process'
  | 'route'
  | 'clock'
  | 'history'
  | 'actor'
  | 'player'
  | 'faction';

/** 지금 판정하는 Target — 이 밖의 것은 자리만이다 */
export const DECIDABLE_TARGET_KINDS: readonly ConditionTargetKind[] = [
  'region',
  'area',
  'connector',
  'source',
  'process',
  'route',
  'clock',
  'history',
  'actor',
];

/** 자리만인 Target — 평가기가 `undecidable` 을 낸다 (그 층이 오면 빠진다) */
export const DEFERRED_TARGET_KINDS: readonly ConditionTargetKind[] = ['player', 'faction'];

/** ref 없이 서는 Target — 세계에 하나뿐인 것 */
export const SINGLETON_TARGET_KINDS: readonly ConditionTargetKind[] = ['clock'];

/**
 * ref 없이 **설 수 있는** Target — 그 대상을 id 로 가리키지 않고 **부르는 쪽이 자리로 고르는**
 * 것이다 (「문 앞의 몸」처럼 판정하는 자리가 대상을 고른다). 밝혔으면 어휘의 id 이어야 하는 것은
 * 같다.
 *
 * 세계에 하나뿐이라 ref 가 **없는** `SINGLETON_TARGET_KINDS` 와 갈리고, 평가기가 판정하지
 * 못하는 `DEFERRED_TARGET_KINDS` 와도 갈린다 — 판정 가능한 갈래도 자리로 골라지는 것일 수 있다.
 */
export const REF_OPTIONAL_TARGET_KINDS: readonly ConditionTargetKind[] = [
  'actor',
  'player',
  'faction',
];

/** Query 의 갈래 여섯 + 자리만인 넷 */
export type ConditionQueryKind =
  | 'property'
  | 'exists'
  | 'count'
  | 'state'
  | 'history'
  | 'distance'
  | 'contains'
  | 'relation'
  | 'capability'
  | 'knowledge';

export const DECIDABLE_QUERY_KINDS: readonly ConditionQueryKind[] = [
  'property',
  'exists',
  'count',
  'state',
  'history',
  'capability',
];

export const DEFERRED_QUERY_KINDS: readonly ConditionQueryKind[] = [
  'distance',
  'contains',
  'relation',
  'knowledge',
];

/** Operator 아홉 */
export type ConditionOperator =
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'IN'
  | 'EXISTS'
  | 'NOT_EXISTS';

export const CONDITION_OPERATORS: readonly ConditionOperator[] = [
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'IN',
  'EXISTS',
  'NOT_EXISTS',
];

/** 값을 요구하지 않는 Operator */
export const VALUELESS_OPERATORS: readonly ConditionOperator[] = ['EXISTS', 'NOT_EXISTS'];

/** 값 하나 또는 값의 목록 (IN 이 읽는다) */
export type ConditionScalar = string | number | boolean;
export type ConditionValue = ConditionScalar | readonly ConditionScalar[];

/**
 * 시간 qualifier — 읽힌 값이 **시각**(세계 초)일 때 지금(`read.now`)과 견준다.
 *
 *   WITHIN s   지금 - 값 <= s        (s 초 안에 일어났다)
 *   AFTER  s   지금 - 값 >  s        (s 초보다 오래됐다)
 *   SINCE  t   값 >= t                (절대 시각 t 이후에 일어났다)
 *   BEFORE t   값 <  t                (절대 시각 t 이전에 일어났다)
 *   FOR    s   지금 - heldSince >= s  (그 값이 s 초 이상 유지됐다 — `read.heldSince` 가 없으면 판정 불가)
 *
 * `read.now` 가 없으면 WITHIN · AFTER · FOR 는 판정 불가다.
 */
export interface TimeQualifier {
  kind: 'time';
  mode: 'FOR' | 'SINCE' | 'WITHIN' | 'BEFORE' | 'AFTER';
  seconds: number;
}

/**
 * 변화 qualifier — 직전 값(`read.previous`)과 지금 값을 견준다. 직전 값을 주지 않으면 판정 불가다.
 *
 *   BECAME     직전에는 거짓이던 조건이 지금 참이다 (operator 판정을 직전 값에도 건다)
 *   CROSSED    직전 값과 지금 값 사이에 `value` 가 있다 (한쪽은 미만 · 한쪽은 이상)
 *   INCREASED  지금 값 > 직전 값
 *   DECREASED  지금 값 < 직전 값
 */
export interface ChangeQualifier {
  kind: 'change';
  mode: 'BECAME' | 'CROSSED' | 'INCREASED' | 'DECREASED';
}

export type ConditionQualifier = TimeQualifier | ChangeQualifier;

export const TIME_QUALIFIER_MODES: readonly TimeQualifier['mode'][] = [
  'FOR',
  'SINCE',
  'WITHIN',
  'BEFORE',
  'AFTER',
];
export const CHANGE_QUALIFIER_MODES: readonly ChangeQualifier['mode'][] = [
  'BECAME',
  'CROSSED',
  'INCREASED',
  'DECREASED',
];

/** Target 하나 — 갈래와 그 id. clock 처럼 세계에 하나뿐인 것은 ref 가 없다 */
export interface ConditionTarget {
  kind: ConditionTargetKind;
  ref?: string;
}

/**
 * Query 하나 — 갈래와 경로.
 *
 * `path` 는 그 Target 의 어느 값을 읽는가다 (property 의 이름 · state 의 이름 · history 의
 * 경로 `passages.<routeId>` 처럼 점으로 잇는다). exists · count 처럼 Target 자체를 묻는
 * Query 는 path 가 없어도 된다. 어느 Target 에 어느 path 가 있는지는 기반이 모른다 —
 * 검사 ㊹ 이 컨텐츠의 어휘(`CheckConditionVocabulary`)로 잰다.
 */
export interface ConditionQuery {
  kind: ConditionQueryKind;
  path?: string;
}

/** 잎 하나 — Target + Query + Operator + Value + Qualifier(하나까지) + chance(자리만) */
export interface ConditionLeaf {
  target: ConditionTarget;
  query: ConditionQuery;
  operator: ConditionOperator;
  value?: ConditionValue;
  qualifier?: ConditionQualifier;
  /** 자리만 — 밝히면 판정 불가다 (5층 이후의 것) */
  chance?: number;
}

/** 집합 — 전부 참(all) · 하나라도 참(any). 빈 all 은 참, 빈 any 는 거짓이다 */
export interface ConditionAll {
  all: readonly Condition[];
}
export interface ConditionAny {
  any: readonly Condition[];
}

export type Condition = ConditionLeaf | ConditionAll | ConditionAny;

/**
 * 판정 셋 — 참 · 거짓 · **판정 불가**.
 *
 * 집합의 어법: all 은 거짓이 하나라도 있으면 거짓, 아니면 판정 불가가 하나라도 있으면 판정 불가,
 * 아니면 참. any 는 참이 하나라도 있으면 참, 아니면 판정 불가가 하나라도 있으면 판정 불가,
 * 아니면 거짓. (판정 불가는 거짓으로 눌리지 않고 위로 오른다 — 지키는 것 ②)
 */
export type ConditionVerdict = 'met' | 'unmet' | 'undecidable';

/** 읽을 수 없다 — 호출자의 read 가 그 잎을 모른다는 표. `undefined`(없다)와 다르다 */
export const UNREADABLE: unique symbol = Symbol('unreadable');
export type Unreadable = typeof UNREADABLE;

/**
 * 호출자가 주는 조회 — **값이 어디서 오는지는 기반이 모른다.**
 *
 * `value` 는 잎 하나의 지금 값을 준다: 없는 것은 `undefined`(EXISTS 의 거짓 · 비교의 거짓),
 * 모르는 것은 `UNREADABLE`(판정 불가). 나머지 셋은 선택이다 — 주지 않으면 그것을 요구하는
 * qualifier 가 판정 불가다.
 */
export interface ConditionRead {
  value(leaf: ConditionLeaf): ConditionValue | undefined | Unreadable;
  /** change qualifier 의 직전 값 — 호출자가 tick 사이에 들고 준다 (기반은 저장하지 않는다) */
  previous?(leaf: ConditionLeaf): ConditionValue | undefined | Unreadable;
  /** FOR 가 읽는 "그 값이 언제부터 유지됐는가"(세계 초) */
  heldSince?(leaf: ConditionLeaf): number | undefined;
  /** 지금 시각(세계 초) — WITHIN · AFTER · FOR 가 읽는다 */
  now?: number;
}

/** 집합인가 */
export function isConditionGroup(condition: Condition): condition is ConditionAll | ConditionAny {
  return 'all' in condition || 'any' in condition;
}

/** 스칼라인가 — 문자열 · 수 · 참거짓 */
function isScalar(value: unknown): value is ConditionScalar {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** 값의 목록인가 (IN 이 읽는 쪽) */
function isList(value: unknown): value is readonly ConditionScalar[] {
  return Array.isArray(value);
}

/** 유한한 수인가 — 시각 · 견줌에 쓸 수 있는 수 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 스칼라 둘을 operator 로 견준다 — 수는 여섯 전부, 문자열 · 참거짓은 == · != 만.
 * 형이 어긋나면(수 대 문자열 · 문자열에 >) 판정 불가다 — 거짓으로 눌리지 않는다.
 */
function compareScalars(
  operator: ConditionOperator,
  current: ConditionScalar,
  expected: ConditionScalar,
): ConditionVerdict {
  if (typeof current !== typeof expected) return 'undecidable';
  if (typeof current === 'number' && typeof expected === 'number') {
    switch (operator) {
      case '==':
        return current === expected ? 'met' : 'unmet';
      case '!=':
        return current !== expected ? 'met' : 'unmet';
      case '>':
        return current > expected ? 'met' : 'unmet';
      case '>=':
        return current >= expected ? 'met' : 'unmet';
      case '<':
        return current < expected ? 'met' : 'unmet';
      case '<=':
        return current <= expected ? 'met' : 'unmet';
      default:
        return 'undecidable';
    }
  }
  switch (operator) {
    case '==':
      return current === expected ? 'met' : 'unmet';
    case '!=':
      return current !== expected ? 'met' : 'unmet';
    default:
      return 'undecidable';
  }
}

/**
 * qualifier 를 걸기 전의 판정 — operator 와 잎의 value 로 읽힌 값 하나를 본다.
 * 없는 것(undefined)은 EXISTS 의 거짓이고 비교의 거짓이다. IN 은 value 가 목록이어야 하고
 * 나머지는 스칼라여야 한다 — 형이 어긋나면 판정 불가다. (BECAME 이 직전 값에도 이것을 건다)
 */
function baseVerdict(leaf: ConditionLeaf, current: ConditionValue | undefined): ConditionVerdict {
  const { operator, value } = leaf;
  if (operator === 'EXISTS') return current !== undefined ? 'met' : 'unmet';
  if (operator === 'NOT_EXISTS') return current === undefined ? 'met' : 'unmet';
  if (operator === 'IN') {
    if (!isList(value)) return 'undecidable';
    if (current === undefined) return 'unmet';
    if (!isScalar(current)) return 'undecidable';
    return value.includes(current) ? 'met' : 'unmet';
  }
  if (!CONDITION_OPERATORS.includes(operator)) return 'undecidable';
  if (!isScalar(value)) return 'undecidable';
  if (current === undefined) return 'unmet';
  if (!isScalar(current)) return 'undecidable';
  return compareScalars(operator, current, value);
}

/** 시간 qualifier — 읽힌 값이 시각(유한한 수)이어야 한다. 표는 `TimeQualifier` 의 주석 */
function timeVerdict(
  leaf: ConditionLeaf,
  qualifier: TimeQualifier,
  current: ConditionValue | undefined,
  read: ConditionRead,
): ConditionVerdict {
  if (!isFiniteNumber(current)) return 'undecidable';
  const { mode, seconds } = qualifier;
  if (mode === 'SINCE') return current >= seconds ? 'met' : 'unmet';
  if (mode === 'BEFORE') return current < seconds ? 'met' : 'unmet';
  const now = read.now;
  if (!isFiniteNumber(now)) return 'undecidable';
  if (mode === 'WITHIN') return now - current <= seconds ? 'met' : 'unmet';
  if (mode === 'AFTER') return now - current > seconds ? 'met' : 'unmet';
  // FOR — 그 값이 언제부터 유지됐는가를 호출자가 준다
  const heldSince = read.heldSince?.(leaf);
  if (!isFiniteNumber(heldSince)) return 'undecidable';
  return now - heldSince >= seconds ? 'met' : 'unmet';
}

/** 변화 qualifier — 직전 값을 호출자가 주어야 한다 (기반은 저장하지 않는다) */
function changeVerdict(
  leaf: ConditionLeaf,
  qualifier: ChangeQualifier,
  current: ConditionValue | undefined,
  read: ConditionRead,
): ConditionVerdict {
  if (!read.previous) return 'undecidable';
  const previous = read.previous(leaf);
  if (previous === UNREADABLE) return 'undecidable';
  const { mode } = qualifier;
  if (mode === 'BECAME') {
    // 직전에는 거짓이고 지금은 참 — 지금 참인 것은 호출자가 이미 확인했다
    const before = baseVerdict(leaf, previous);
    if (before === 'undecidable') return 'undecidable';
    return before === 'unmet' ? 'met' : 'unmet';
  }
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return 'undecidable';
  if (mode === 'INCREASED') return current > previous ? 'met' : 'unmet';
  if (mode === 'DECREASED') return current < previous ? 'met' : 'unmet';
  // CROSSED — 직전 값과 지금 값 사이에 value 가 있다 (한쪽은 미만 · 한쪽은 이상)
  const pivot = leaf.value;
  if (!isFiniteNumber(pivot)) return 'undecidable';
  const crossed = (previous < pivot && current >= pivot) || (previous >= pivot && current < pivot);
  return crossed ? 'met' : 'unmet';
}

/** 잎 하나 — 주석의 차례 ①~⑤ 그대로 */
function evaluateLeaf(leaf: ConditionLeaf, read: ConditionRead): ConditionVerdict {
  // ① 자리만인 것은 판정 불가다 — 거짓이 아니다
  if (DEFERRED_TARGET_KINDS.includes(leaf.target.kind)) return 'undecidable';
  if (DEFERRED_QUERY_KINDS.includes(leaf.query.kind)) return 'undecidable';
  if (leaf.chance !== undefined) return 'undecidable';
  // ② 읽는다 — 모르는 것은 판정 불가, 없는 것은 undefined 로 아래에 흐른다
  const current = read.value(leaf);
  if (current === UNREADABLE) return 'undecidable';
  // ③ ④ operator 의 판정 — 거짓이면 qualifier 를 묻지 않고 거짓이다
  const base = baseVerdict(leaf, current);
  if (base !== 'met') return base;
  // ⑤ qualifier 를 덧건다
  const { qualifier } = leaf;
  if (qualifier === undefined) return 'met';
  if (qualifier.kind === 'time') return timeVerdict(leaf, qualifier, current, read);
  if (qualifier.kind === 'change') return changeVerdict(leaf, qualifier, current, read);
  return 'undecidable';
}

/** 집합의 어법 — `ConditionVerdict` 의 주석 그대로. 판정 불가는 위로 오른다 */
function combine(verdicts: readonly ConditionVerdict[], mode: 'all' | 'any'): ConditionVerdict {
  const short: ConditionVerdict = mode === 'all' ? 'unmet' : 'met';
  const rest: ConditionVerdict = mode === 'all' ? 'met' : 'unmet';
  if (verdicts.includes(short)) return short;
  if (verdicts.includes('undecidable')) return 'undecidable';
  return rest;
}

/**
 * 조건 하나를 판정한다 — 게임 명사 0 · 저장 0.
 *
 * 잎의 판정 차례: ① 자리만인 Target · Query · chance → undecidable ② read.value ③ EXISTS /
 * NOT_EXISTS 는 값의 유무 ④ 나머지 operator 는 값을 견준다 (IN 은 `value` 가 목록 · 나머지는
 * 스칼라 — 형이 어긋나면 undecidable) ⑤ qualifier 가 있으면 그것을 덧건다 (time 은 읽힌 값이
 * 수(시각)여야 하고, change 는 previous 가 있어야 한다 — 아니면 undecidable).
 * 집합은 위 `ConditionVerdict` 의 어법.
 */
export function evaluateCondition(condition: Condition, read: ConditionRead): ConditionVerdict {
  if ('all' in condition) {
    return combine(
      condition.all.map((child) => evaluateCondition(child, read)),
      'all',
    );
  }
  if ('any' in condition) {
    return combine(
      condition.any.map((child) => evaluateCondition(child, read)),
      'any',
    );
  }
  return evaluateLeaf(condition, read);
}

/** 그 조건의 잎 전부 — 적힌 차례 그대로 (검사 ㊹ 과 조건 표가 읽는다) */
export function conditionLeaves(condition: Condition): ConditionLeaf[] {
  if ('all' in condition) return condition.all.flatMap(conditionLeaves);
  if ('any' in condition) return condition.any.flatMap(conditionLeaves);
  return [condition];
}

/**
 * 잎 하나를 한 줄로 — 사람이 읽을 말이 아니라 **기계가 읽는 표기**다 (검사의 refs · 조건 표가
 * 그대로 싣는다). `clock.property(season) IN [s1,s2]` · `history(A).history(passages.R1) EXISTS`
 * · qualifier 는 뒤에 `WITHIN 240` · `BECAME` 식으로 붙는다.
 */
export function formatConditionLeaf(leaf: ConditionLeaf): string {
  const { target, query, operator, value, qualifier } = leaf;
  const targetText = target.ref === undefined ? target.kind : `${target.kind}(${target.ref})`;
  const queryText = query.path === undefined ? query.kind : `${query.kind}(${query.path})`;
  let line = `${targetText}.${queryText} ${operator}`;
  if (value !== undefined) {
    line += isList(value) ? ` [${value.map(String).join(',')}]` : ` ${String(value)}`;
  }
  if (qualifier !== undefined) {
    line += qualifier.kind === 'time' ? ` ${qualifier.mode} ${qualifier.seconds}` : ` ${qualifier.mode}`;
  }
  return line;
}
