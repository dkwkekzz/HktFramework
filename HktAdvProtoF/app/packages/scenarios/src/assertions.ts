// V2 단언 헬퍼 — 시나리오가 기대·실제·분기 경로를 빠짐없이 남기게 강제한다.

import { sameState, stateHash } from '@hkt/core/v1';

import { firstDivergentPath } from './diff.ts';
import type { Assertion } from './scenario.ts';

/** 기대 상태와 실제 상태가 같은가 (상태 해시 동일성 판정). */
export function expectState(label: string, expected: unknown, actual: unknown): Assertion {
  const passed = safeSameState(expected, actual);
  return {
    label,
    passed,
    expected,
    actual,
    firstDivergentPath: passed ? null : firstDivergentPath(expected, actual),
  };
}

/** 조건이 참인가. 기대는 항상 true 다. */
export function expectTrue(label: string, condition: boolean, actual: unknown = condition): Assertion {
  return { label, passed: condition, expected: true, actual, firstDivergentPath: null };
}

/** 두 상태가 서로 달라야 한다 (검출력 검증용). */
export function expectDifferent(label: string, left: unknown, right: unknown): Assertion {
  const different = !safeSameState(left, right);
  return {
    label,
    passed: different,
    expected: '서로 다른 상태',
    actual: different ? '서로 다름' : `동일 (${stateHash(left)})`,
    firstDivergentPath: different ? firstDivergentPath(left, right) : null,
  };
}

/** 호출이 거부되어야 한다. pattern 을 주면 메시지까지 확인한다. */
export function expectRejected(label: string, run: () => unknown, pattern?: RegExp): Assertion {
  try {
    const value = run();
    return {
      label,
      passed: false,
      expected: '거부(throw)',
      actual: `통과하여 값을 돌려줌: ${String(value)}`,
      firstDivergentPath: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const passed = pattern === undefined || pattern.test(message);
    return {
      label,
      passed,
      expected: pattern === undefined ? '거부(throw)' : `거부 + 메시지 ${pattern.source}`,
      actual: `거부: ${message}`,
      firstDivergentPath: null,
    };
  }
}

/** 같은 실행을 times 번 반복해도 결과가 하나로 모이는가 (V1 결정성 검사의 시나리오판). */
export function expectDeterministic(label: string, run: () => unknown, times = 100): Assertion {
  const hashes = new Set<string>();
  let first: unknown;
  let diverged: unknown;
  for (let index = 0; index < times; index += 1) {
    const value = run();
    if (index === 0) first = value;
    else if (diverged === undefined && !safeSameState(first, value)) diverged = value;
    hashes.add(stateHash(value));
  }
  const passed = hashes.size === 1;
  return {
    label,
    passed,
    expected: `${String(times)}회 실행 → 해시 1종`,
    actual: `해시 ${String(hashes.size)}종 (${[...hashes].slice(0, 3).join(', ')})`,
    // 갈라졌다면 최초로 달라진 실행과의 경로를 지목한다.
    firstDivergentPath: passed ? null : firstDivergentPath(first, diverged),
  };
}

function safeSameState(left: unknown, right: unknown): boolean {
  try {
    return sameState(left, right);
  } catch {
    // 직렬화 불가능한 값은 같다고 볼 수 없다 — 상태 원소 규칙 위반이므로 실패시킨다.
    return false;
  }
}
