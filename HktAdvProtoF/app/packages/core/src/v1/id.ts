// V1 Deterministic ID — 식별자는 카운터·시각·난수가 아니라 "무엇으로부터 생겼는가" 에서 나온다.
// 같은 유래(kind + parts)면 몇 번을 실행하든 같은 ID 가 되고, 리플레이가 성립한다.

import { stateHash } from './hash.ts';

/** 세계 안의 모든 식별자. `<kind>:<12자리 hex>` 형태. */
export type Id = string;

const KIND_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * 유래에서 결정적 ID 를 만든다.
 * @param kind  ID 의 종류 (kebab-case 소문자) — 로그에서 눈으로 읽히는 접두사가 된다.
 * @param parts ID 를 결정하는 재료. JSON 직렬화 가능한 값이어야 한다.
 */
export function deterministicId(kind: string, ...parts: readonly unknown[]): Id {
  if (!KIND_PATTERN.test(kind)) {
    throw new RangeError(`ID 종류는 kebab-case 소문자여야 한다: ${kind}`);
  }
  return `${kind}:${stateHash(parts).slice(0, 12)}`;
}

/** 부모 ID 아래의 하위 ID — 같은 부모·같은 라벨이면 항상 같다. */
export function childId(parentId: Id, kind: string, label: string): Id {
  return deterministicId(kind, parentId, label);
}

/** ID 의 종류 접두사. 형식이 아니면 null. */
export function idKind(id: Id): string | null {
  const index = id.indexOf(':');
  if (index <= 0) return null;
  const kind = id.slice(0, index);
  return KIND_PATTERN.test(kind) ? kind : null;
}
