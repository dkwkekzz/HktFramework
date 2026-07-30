import { parsePointer } from '@hkt/v1-schema';
import { canonicalJson, readPath, showValue } from './json.js';
import {
  CONDITION_OPERATORS,
  type Condition,
  type ConditionAt,
  type ConditionResult,
  type JsonObject,
  type JsonValue,
  type RunIssue,
  type StateChange,
  type Transition,
} from './types.js';

/** 조건 명세 자체의 형식 검사 — 실행 전에 돌린다. */
export function checkCondition(condition: Condition, index: number, stepCount: number): RunIssue[] {
  const issues: RunIssue[] = [];
  const at = `/then/${index}`;

  if (typeof condition.id !== 'string' || condition.id.trim() === '') {
    issues.push({ code: 'E_CONDITION_ID', path: `${at}/id`, message: '조건에는 id 가 있어야 한다.' });
  }
  if (typeof condition.path !== 'string') {
    issues.push({ code: 'E_CONDITION_PATH', path: `${at}/path`, message: '조건의 path 는 문자열이어야 한다.' });
  } else {
    try {
      parsePointer(condition.path);
    } catch (error) {
      issues.push({
        code: 'E_CONDITION_PATH',
        path: `${at}/path`,
        message: `JSON Pointer 가 아니다: ${(error as Error).message}`,
      });
    }
  }
  if (!(CONDITION_OPERATORS as readonly string[]).includes(condition.op)) {
    issues.push({
      code: 'E_CONDITION_OPERATOR',
      path: `${at}/op`,
      message: `모르는 연산자다: ${JSON.stringify(condition.op)}. 쓸 수 있는 것: ${CONDITION_OPERATORS.join(', ')}`,
    });
  }
  if (NEEDS_VALUE.has(condition.op) && condition.value === undefined) {
    issues.push({
      code: 'E_CONDITION_VALUE_REQUIRED',
      path: `${at}/value`,
      message: `\`${condition.op}\` 는 기대값이 있어야 한다.`,
    });
  }
  const at2 = condition.at;
  if (typeof at2 === 'number' && (!Number.isInteger(at2) || at2 < 0 || at2 >= stepCount)) {
    issues.push({
      code: 'E_CONDITION_AT_RANGE',
      path: `${at}/at`,
      message: `단계 인덱스가 범위를 벗어났다: ${at2} (단계 ${stepCount}개)`,
    });
  }
  if (typeof at2 === 'string' && at2 !== 'given' && at2 !== 'final') {
    issues.push({
      code: 'E_CONDITION_AT',
      path: `${at}/at`,
      message: `at 은 'given' · 'final' · 단계 인덱스 중 하나여야 한다: ${JSON.stringify(at2)}`,
    });
  }
  return issues;
}

const NEEDS_VALUE = new Set(['equals', 'notEquals', 'lessThan', 'atMost', 'greaterThan', 'atLeast', 'length']);

/** 조건을 평가할 상태를 고른다. 단계가 도중에 멈췄으면 그 시점까지의 상태만 있다. */
function stateAt(at: ConditionAt, given: JsonObject, transitions: readonly Transition[]): JsonObject {
  if (at === 'given') return given;
  if (at === 'final') {
    const last = transitions[transitions.length - 1];
    return last ? last.after : given;
  }
  const transition = transitions[at];
  return transition ? transition.after : given;
}

/**
 * 조건 하나를 판정한다.
 *
 * 실패했을 때 화면에 필요한 것은 "틀렸다"가 아니라 **무엇이 어떻게 달라졌는가**이므로,
 * 결과에 항상 given 시점 값(`before`)·평가 시점 값(`after`)·그 값을 마지막으로 바꾼 단계(`blame`)를 함께 담는다.
 * 원문 「8」이 V3 에 요구한 "실패한 조건의 전후 상태가 한 화면에 표시"가 이 세 조각이다.
 */
export function evaluateCondition(
  condition: Condition,
  given: JsonObject,
  transitions: readonly Transition[],
): ConditionResult {
  const at: ConditionAt = condition.at ?? 'final';
  const observed = stateAt(at, given, transitions);
  const before = readPath(given, condition.path);
  const after = readPath(observed, condition.path);
  const expected = condition.value;

  const verdict = judge(condition.op, before, after, expected);

  return {
    id: condition.id,
    path: condition.path,
    op: condition.op,
    at,
    passed: verdict.passed,
    expected: (expected ?? null) as JsonValue | null,
    actual: (after ?? null) as JsonValue | null,
    before: (before ?? null) as JsonValue | null,
    after: (after ?? null) as JsonValue | null,
    blame: blameFor(condition.path, transitions),
    reason: condition.reason ?? verdict.reason,
  };
}

interface Verdict {
  passed: boolean;
  reason: string;
}

function judge(
  op: Condition['op'],
  before: JsonValue | undefined,
  after: JsonValue | undefined,
  expected: JsonValue | undefined,
): Verdict {
  const show = `${showValue(before)} → ${showValue(after)}`;
  switch (op) {
    case 'equals':
      return {
        passed: canonicalJson((after ?? null) as JsonValue) === canonicalJson((expected ?? null) as JsonValue),
        reason: `${showValue(after)} 가 ${showValue(expected)} 인가`,
      };
    case 'notEquals':
      return {
        passed: canonicalJson((after ?? null) as JsonValue) !== canonicalJson((expected ?? null) as JsonValue),
        reason: `${showValue(after)} 가 ${showValue(expected)} 가 아닌가`,
      };
    case 'lessThan':
      return { passed: compare(after, expected, (a, b) => a < b), reason: `${showValue(after)} < ${showValue(expected)}` };
    case 'atMost':
      return { passed: compare(after, expected, (a, b) => a <= b), reason: `${showValue(after)} ≤ ${showValue(expected)}` };
    case 'greaterThan':
      return { passed: compare(after, expected, (a, b) => a > b), reason: `${showValue(after)} > ${showValue(expected)}` };
    case 'atLeast':
      return { passed: compare(after, expected, (a, b) => a >= b), reason: `${showValue(after)} ≥ ${showValue(expected)}` };
    case 'changed':
      return {
        passed: canonicalJson((before ?? null) as JsonValue) !== canonicalJson((after ?? null) as JsonValue),
        reason: `값이 바뀌었는가 (${show})`,
      };
    case 'unchanged':
      return {
        passed: canonicalJson((before ?? null) as JsonValue) === canonicalJson((after ?? null) as JsonValue),
        reason: `값이 그대로인가 (${show})`,
      };
    case 'present':
      return { passed: after !== undefined, reason: `값이 있는가 (${showValue(after)})` };
    case 'absent':
      return { passed: after === undefined, reason: `값이 없는가 (${showValue(after)})` };
    case 'length': {
      const actualLength = Array.isArray(after) ? after.length : typeof after === 'string' ? after.length : null;
      return {
        passed: actualLength !== null && actualLength === expected,
        reason: `길이 ${actualLength ?? '측정 불가'} 가 ${showValue(expected)} 인가`,
      };
    }
    default: {
      const never: never = op;
      return { passed: false, reason: `모르는 연산자: ${String(never)}` };
    }
  }
}

function compare(
  actual: JsonValue | undefined,
  expected: JsonValue | undefined,
  predicate: (a: number, b: number) => boolean,
): boolean {
  if (typeof actual !== 'number' || typeof expected !== 'number') return false;
  return predicate(actual, expected);
}

/**
 * 이 경로를 **마지막으로 바꾼** 단계를 찾는다.
 *
 * 경로가 정확히 같은 변경뿐 아니라 부모·자식 관계의 변경도 센다 —
 * `/energy` 를 보는 조건은 `/energy` 를 바꾼 단계가 원인이고, `/log` 를 보는 조건은 `/log/2` 를
 * 추가한 단계가 원인이다.
 */
export function blameFor(
  path: string,
  transitions: readonly Transition[],
): { index: number; step: string } | null {
  for (let index = transitions.length - 1; index >= 0; index -= 1) {
    const transition = transitions[index] as Transition;
    if (transition.changes.some((change) => touches(change, path))) {
      return { index: transition.index, step: transition.step };
    }
  }
  return null;
}

function touches(change: StateChange, path: string): boolean {
  return (
    change.path === path ||
    change.path.startsWith(`${path}/`) ||
    path.startsWith(`${change.path}/`)
  );
}
