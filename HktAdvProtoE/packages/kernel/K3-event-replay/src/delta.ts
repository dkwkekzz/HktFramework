import type { EntityStore, JsonObject, JsonValue } from '@hkt/k0-entity-state';
import type { StateDelta } from '@hkt/k2-rule-transaction';
import { REPLAY_ISSUE } from './types.js';

/**
 * 사건에 적힌 변화를 세계에 되짚어 넣는다.
 *
 * **여기가 리플레이의 전부다.** 사건 로그의 `stateDelta` 만으로 현재 상태를 다시 만들 수 있다면
 * GI-01(사건 없는 상태 변경 금지)이 지켜진 것이고, 만들 수 없다면 어딘가에서 사건 없이 세계가
 * 바뀐 것이다. 규칙을 다시 돌리지 않고 **적힌 결과만** 넣는다는 점이 중요하다 — 규칙을 다시
 * 돌리면 "규칙이 바뀌어도 옛 로그가 재생된다"는 성질을 잃는다.
 */
export class DeltaError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = 'DeltaError';
    this.code = code;
    this.path = path;
  }
}

export function applyStateDelta(store: EntityStore, change: StateDelta): EntityStore {
  const tags = /^entity\/([a-z][a-z0-9_]*)\/tags$/.exec(change.path);
  if (tags) {
    const entityId = tags[1] as string;
    const before = store.get(entityId)?.tags ?? [];
    const after = Array.isArray(change.after) ? (change.after as string[]) : [];
    let next = store;
    for (const tag of before) if (!after.includes(tag)) next = next.removeTag(entityId, tag);
    for (const tag of after) if (!before.includes(tag)) next = next.attachTag(entityId, tag);
    return next;
  }

  const component = /^entity\/([a-z][a-z0-9_]*)\/components\/([a-z][a-z0-9_]*)(\/(.+))?$/.exec(change.path);
  if (!component) {
    throw new DeltaError(REPLAY_ISSUE.BAD_DELTA, change.path, `되짚을 수 없는 변화 경로다: ${change.path}`);
  }

  const entityId = component[1] as string;
  const type = component[2] as string;
  const field = component[4] === undefined ? [] : component[4].split('/');

  if (field.length === 0) {
    if (change.after === null || typeof change.after !== 'object' || Array.isArray(change.after)) {
      throw new DeltaError(REPLAY_ISSUE.BAD_DELTA, change.path, '컴포넌트 전체의 새 값이 객체가 아니다.');
    }
    return store.setComponent(entityId, type, change.after as JsonObject);
  }

  const current = store.component(entityId, type);
  if (current === null) {
    throw new DeltaError(
      REPLAY_ISSUE.BAD_DELTA,
      change.path,
      `${entityId} 에 \`${type}\` 컴포넌트가 없어 되짚을 수 없다.`,
    );
  }

  const next = JSON.parse(JSON.stringify(current)) as JsonObject;
  let cursor: JsonObject = next;
  for (const key of field.slice(0, -1)) {
    const child = cursor[key];
    if (child === null || typeof child !== 'object' || Array.isArray(child)) {
      throw new DeltaError(REPLAY_ISSUE.BAD_DELTA, change.path, '변화 경로 아래로 들어갈 수 없다.');
    }
    cursor = child as JsonObject;
  }
  cursor[field[field.length - 1] as string] = change.after as JsonValue;
  return store.setComponent(entityId, type, next);
}

export function applyStateDeltas(store: EntityStore, changes: readonly StateDelta[]): EntityStore {
  return changes.reduce(applyStateDelta, store);
}

/** 변화가 건드린 실체 id (오름차순, 중복 없음). */
export function affectedEntities(changes: readonly StateDelta[]): string[] {
  const ids = new Set<string>();
  for (const change of changes) {
    const match = /^entity\/([a-z][a-z0-9_]*)\//.exec(change.path);
    if (match) ids.add(match[1] as string);
  }
  return [...ids].sort();
}
