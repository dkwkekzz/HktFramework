import { describe, expect, it } from 'vitest';
import { blameFor, checkCondition, evaluateCondition } from '../../src/conditions.js';
import type { Condition, JsonObject, Transition } from '../../src/types.js';

const given: JsonObject = { actor: { energy: 10 }, log: [] };

function transition(index: number, step: string, paths: string[]): Transition {
  return {
    index,
    step,
    title: step,
    params: {},
    note: '',
    tick: index,
    timeMs: index * 100,
    before: given,
    after: given,
    changes: paths.map((path) => ({ path, kind: 'changed', before: null, after: 1 })),
    rejection: null,
    error: null,
  };
}

describe('조건 형식 검사', () => {
  const base: Condition = { id: 'c', path: '/actor/energy', op: 'equals', value: 1 };

  it('JSON Pointer 가 아니면 거부한다', () => {
    expect(checkCondition({ ...base, path: 'actor/energy' }, 0, 1)[0]?.code).toBe('E_CONDITION_PATH');
  });

  it('모르는 연산자를 거부한다', () => {
    expect(checkCondition({ ...base, op: 'matches' as Condition['op'] }, 0, 1)[0]?.code).toBe(
      'E_CONDITION_OPERATOR',
    );
  });

  it('비교 연산자에 기대값이 없으면 거부한다', () => {
    const issues = checkCondition({ id: 'c', path: '/a', op: 'equals' }, 0, 1);
    expect(issues.map((issue) => issue.code)).toContain('E_CONDITION_VALUE_REQUIRED');
  });

  it('단계 인덱스가 범위를 벗어나면 거부한다', () => {
    expect(checkCondition({ ...base, at: 3 }, 0, 2)[0]?.code).toBe('E_CONDITION_AT_RANGE');
  });

  it('거부 경로가 then 인덱스를 지목한다', () => {
    expect(checkCondition({ ...base, path: 'x' }, 2, 1)[0]?.path).toBe('/then/2/path');
  });
});

describe('조건 평가', () => {
  const after: JsonObject = { actor: { energy: 4 }, log: [1, 2] };
  const runs: Transition[] = [
    { ...transition(0, 'consume', ['/actor/energy']), after },
    { ...transition(1, 'append', ['/log/0', '/log/1']), after },
  ];

  it('실패한 조건이 전후 값을 함께 담는다', () => {
    const result = evaluateCondition({ id: 'c', path: '/actor/energy', op: 'equals', value: 10 }, given, runs);
    expect(result.passed).toBe(false);
    expect(result.before).toBe(10);
    expect(result.after).toBe(4);
  });

  it('그 값을 마지막으로 바꾼 단계를 지목한다', () => {
    const result = evaluateCondition({ id: 'c', path: '/actor/energy', op: 'equals', value: 4 }, given, runs);
    expect(result.blame).toEqual({ index: 0, step: 'consume' });
  });

  it('아무 단계도 바꾸지 않았으면 blame 이 없다', () => {
    expect(blameFor('/actor/posture', runs)).toBeNull();
  });

  it('자식 경로를 바꾼 단계도 부모 조건의 원인이다', () => {
    expect(blameFor('/log', runs)).toEqual({ index: 1, step: 'append' });
  });

  it('at: given 은 초기 상태를 본다', () => {
    const result = evaluateCondition(
      { id: 'c', path: '/actor/energy', op: 'equals', value: 10, at: 'given' },
      given,
      runs,
    );
    expect(result.passed).toBe(true);
  });

  it('at: 숫자는 그 단계 직후를 본다', () => {
    const result = evaluateCondition({ id: 'c', path: '/actor/energy', op: 'equals', value: 4, at: 0 }, given, runs);
    expect(result.passed).toBe(true);
  });

  it.each([
    ['lessThan', 5, true],
    ['lessThan', 4, false],
    ['atMost', 4, true],
    ['greaterThan', 3, true],
    ['atLeast', 4, true],
  ] as const)('%s %s → %s', (op, value, expected) => {
    expect(evaluateCondition({ id: 'c', path: '/actor/energy', op, value }, given, runs).passed).toBe(expected);
  });

  it('changed · unchanged 는 given 과 비교한다', () => {
    expect(evaluateCondition({ id: 'c', path: '/actor/energy', op: 'changed' }, given, runs).passed).toBe(true);
    expect(evaluateCondition({ id: 'c', path: '/actor/energy', op: 'unchanged' }, given, runs).passed).toBe(false);
  });

  it('present · absent 는 값의 유무를 본다', () => {
    expect(evaluateCondition({ id: 'c', path: '/actor/posture', op: 'absent' }, given, runs).passed).toBe(true);
    expect(evaluateCondition({ id: 'c', path: '/actor/energy', op: 'present' }, given, runs).passed).toBe(true);
  });

  it('length 는 배열·문자열 길이를 본다', () => {
    expect(evaluateCondition({ id: 'c', path: '/log', op: 'length', value: 2 }, given, runs).passed).toBe(true);
    expect(evaluateCondition({ id: 'c', path: '/actor/energy', op: 'length', value: 2 }, given, runs).passed).toBe(
      false,
    );
  });

  it('수가 아닌 값의 크기 비교는 통과하지 않는다', () => {
    const result = evaluateCondition({ id: 'c', path: '/log', op: 'lessThan', value: 5 }, given, runs);
    expect(result.passed).toBe(false);
  });
});
