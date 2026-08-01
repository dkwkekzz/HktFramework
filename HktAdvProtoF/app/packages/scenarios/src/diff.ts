// V2 상태 diff — "최초로 달라진 상태 경로" 를 찾는다 (원문 V2 실패 출력 요건).
// 해시가 다르다는 사실만으로는 고칠 수 없다. 어디서부터 갈라졌는지가 있어야 원인에 닿는다.

import { canonicalize, sameState } from '@hkt/core/v1';

/** 상태 경로 — `$`, `$.stock`, `$.events.3.action` 형태. */
export type StatePath = string;

/** 한 지점의 차이. */
export interface Divergence {
  readonly path: StatePath;
  readonly expected: unknown;
  readonly actual: unknown;
}

function joinPath(path: StatePath, key: string | number): StatePath {
  return `${path}.${String(key)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === null || prototype === Object.prototype;
}

function collect(
  expected: unknown,
  actual: unknown,
  path: StatePath,
  out: Divergence[],
  limit: number,
): void {
  if (out.length >= limit) return;
  if (sameState(expected, actual)) return;

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      out.push({ path: joinPath(path, 'length'), expected: expected.length, actual: actual.length });
    }
    const length = Math.min(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      collect(expected[index], actual[index], joinPath(path, index), out, limit);
      if (out.length >= limit) return;
    }
    return;
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    // 키 순서에 결과가 흔들리지 않도록 정렬된 합집합을 훑는다.
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      collect(expected[key], actual[key], joinPath(path, key), out, limit);
      if (out.length >= limit) return;
    }
    return;
  }

  // 더 내려갈 수 없는 지점 — 여기가 차이의 잎이다.
  out.push({ path, expected, actual });
}

/** 기대와 실제가 갈라진 지점들 (기본 최대 20개). 같으면 빈 배열. */
export function divergences(expected: unknown, actual: unknown, limit = 20): Divergence[] {
  const out: Divergence[] = [];
  collect(expected, actual, '$', out, limit);
  return out;
}

/** 최초로 달라진 상태 경로. 같거나 비교 불가면 null. */
export function firstDivergentPath(expected: unknown, actual: unknown): StatePath | null {
  try {
    return divergences(expected, actual, 1)[0]?.path ?? null;
  } catch {
    // 직렬화 불가능한 값이 섞이면 경로를 특정할 수 없다 — 그 사실 자체는 단언 실패로 이미 드러난다.
    return null;
  }
}

/** 값을 한 줄로 보여준다 — 리포트·Lab diff 뷰 공용. */
export function preview(value: unknown, maxLength = 120): string {
  let text: string;
  try {
    text = canonicalize(value);
  } catch {
    text = String(value);
  }
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}
