import { parsePointer, resolvePointer } from '@hkt/v1-schema';
import type { JsonObject, JsonValue, StateChange } from './types.js';

/** 깊은 복사 — 픽스처를 넘겨줄 때마다 새 값을 준다. JSON 값만 다루므로 구조적 복사로 충분하다. */
export function deepClone<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepClone(item)) as T;
  if (value !== null && typeof value === 'object') {
    const out: JsonObject = {};
    for (const key of Object.keys(value as JsonObject).sort()) {
      out[key] = deepClone((value as JsonObject)[key] as JsonValue);
    }
    return out as T;
  }
  return value;
}

/**
 * 깊은 동결.
 *
 * 단계가 받은 상태를 직접 고치면 "이 값을 누가 바꿨는가"를 추적할 수 없다.
 * 동결해 두면 위반이 조용히 지나가지 않고 그 자리에서 `TypeError` 로 드러난다
 * (모듈 코드는 항상 strict mode 다).
 */
export function deepFreeze<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else {
    for (const key of Object.keys(value as JsonObject)) {
      deepFreeze((value as JsonObject)[key] as JsonValue);
    }
  }
  return value;
}

/** 키 순서를 정렬한 JSON 문자열 — 같은 내용이면 언제나 같은 문자열이다. */
export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(deepClone(value));
}

/** 포인터가 가리키는 값. 없으면 `undefined`. */
export function readPath(root: JsonValue, pointer: string): JsonValue | undefined {
  return resolvePointer(root, pointer) as JsonValue | undefined;
}

/**
 * 포인터 위치에 값을 쓴 **새 상태**를 돌려준다. 원본은 건드리지 않는다.
 * 중간 경로가 없으면 만든다 — 다만 배열 인덱스는 이미 있는 자리에만 쓴다.
 */
export function writePath(root: JsonObject, pointer: string, value: JsonValue): JsonObject {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('루트에는 객체만 쓸 수 있다.');
    }
    return deepClone(value);
  }

  const next = deepClone(root);
  let cursor: JsonValue = next;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index] as string;
    if (Array.isArray(cursor)) {
      const position = Number(token);
      if (!Number.isInteger(position) || position < 0 || position >= cursor.length) {
        throw new RangeError(`배열 인덱스가 범위를 벗어났다: ${pointer} (${token})`);
      }
      cursor = cursor[position] as JsonValue;
      continue;
    }
    if (cursor === null || typeof cursor !== 'object') {
      throw new TypeError(`${pointer} 의 중간 경로가 객체가 아니다.`);
    }
    const record = cursor as JsonObject;
    if (!(token in record) || record[token] === null || typeof record[token] !== 'object') {
      record[token] = {};
    }
    cursor = record[token] as JsonValue;
  }

  const last = tokens[tokens.length - 1] as string;
  if (Array.isArray(cursor)) {
    const position = last === '-' ? cursor.length : Number(last);
    if (!Number.isInteger(position) || position < 0 || position > cursor.length) {
      throw new RangeError(`배열 인덱스가 범위를 벗어났다: ${pointer} (${last})`);
    }
    cursor[position] = value;
    return next;
  }
  if (cursor === null || typeof cursor !== 'object') {
    throw new TypeError(`${pointer} 의 부모가 객체가 아니다.`);
  }
  (cursor as JsonObject)[last] = value;
  return next;
}

/**
 * 두 상태의 차이를 잎 단위 경로로 모은다.
 *
 * 전후 비교를 "무엇이 달라졌는지"가 아니라 "**어느 경로가** 달라졌는지"로 내는 이유는,
 * 실패한 조건이 자기 경로를 마지막으로 바꾼 단계를 지목할 수 있어야 하기 때문이다 (인과 추적).
 */
export function diffStates(before: JsonValue, after: JsonValue, prefix = ''): StateChange[] {
  const changes: StateChange[] = [];
  collect(before, after, prefix, changes);
  return changes;
}

function collect(
  before: JsonValue | undefined,
  after: JsonValue | undefined,
  pointer: string,
  out: StateChange[],
): void {
  const beforeMissing = before === undefined;
  const afterMissing = after === undefined;
  if (beforeMissing && afterMissing) return;

  if (beforeMissing) {
    out.push({ path: pointer, kind: 'added', before: null, after: (after ?? null) as JsonValue });
    return;
  }
  if (afterMissing) {
    out.push({ path: pointer, kind: 'removed', before: before as JsonValue, after: null });
    return;
  }

  const bothObjects =
    before !== null &&
    after !== null &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    Array.isArray(before) === Array.isArray(after);

  if (!bothObjects) {
    if (canonicalJson(before) !== canonicalJson(after)) {
      out.push({ path: pointer, kind: 'changed', before, after });
    }
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      collect(before[index], after[index], `${pointer}/${index}`, out);
    }
    return;
  }

  const beforeRecord = before as JsonObject;
  const afterRecord = after as JsonObject;
  const keys = [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].sort();
  for (const key of keys) {
    collect(beforeRecord[key], afterRecord[key], `${pointer}/${escapeToken(key)}`, out);
  }
}

function escapeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** 사람이 읽는 값 표기 — Lab 표에 그대로 들어간다. */
export function showValue(value: JsonValue | undefined): string {
  if (value === undefined) return '없음';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
