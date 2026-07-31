import type { EntityStore } from '@hkt/k0-entity-state';
import { QueryRejection } from './errors.js';
import { PATH_PATTERN, QUERY_ISSUE, type BindingTable } from './types.js';

/** 경로 하나를 따라간 결과. 못 찾은 것과 `null` 을 구분한다. */
export interface Resolution {
  found: boolean;
  value: unknown;
  /** 실제로 닿은 위치 */
  at: string;
  /** 못 찾았을 때의 이유 */
  reason: string;
}

/**
 * 경로 해석기 (원문 「9」 K1 의 Path Resolver).
 *
 * 세 종류의 잘못을 다르게 다룬다.
 *
 * | 상황 | 처리 | 왜 |
 * |---|---|---|
 * | 문법에 맞지 않는 경로 · 모르는 결합 이름 · 미선언 컴포넌트 | **거부(예외)** | 세계에 대한 진술이 아니라 명세의 오타다 |
 * | 결합된 실체가 세계에 없음 · 그 실체에 그 컴포넌트가 없음 · 필드가 없음 | `found: false` | 세계의 사실이다 |
 *
 * 오타를 거짓으로 처리하면 조용히 통과하는 조건이 생긴다. `not(...)` 안에 들어가면 오타가
 * **참**이 되기까지 한다 — 그래서 반드시 거부한다.
 */
export function resolvePath(
  store: EntityStore,
  bindings: BindingTable,
  path: string,
  at: string,
): Resolution {
  if (typeof path !== 'string' || !PATH_PATTERN.test(path)) {
    throw new QueryRejection(
      QUERY_ISSUE.BAD_PATH,
      at,
      `경로는 \`<결합>.<컴포넌트>.<필드>\` 형태의 소문자 snake_case 여야 한다: ${JSON.stringify(path)}`,
    );
  }

  const [head, second, ...rest] = path.split('.') as [string, ...string[]];
  const entityId = bindings[head];
  if (entityId === undefined) {
    throw new QueryRejection(
      QUERY_ISSUE.UNKNOWN_BINDING,
      at,
      `모르는 결합 이름이다: ${head} (결합된 이름: ${Object.keys(bindings).sort().join(', ') || '없음'})`,
    );
  }

  const entity = store.get(entityId);
  if (!entity) {
    return { found: false, value: null, at: path, reason: `결합 ${head} 이 가리키는 실체 ${entityId} 가 세계에 없다.` };
  }

  if (second === undefined) {
    return { found: true, value: { id: entity.id, kind: entity.kind, tags: [...entity.tags] }, at: path, reason: '' };
  }

  // 실체 자체의 항목 — 컴포넌트가 아니다.
  if (second === 'id' || second === 'kind' || second === 'tags') {
    if (rest.length > 0) {
      throw new QueryRejection(QUERY_ISSUE.BAD_PATH, at, `\`${second}\` 아래로는 더 들어갈 수 없다: ${path}`);
    }
    return {
      found: true,
      value: second === 'tags' ? [...entity.tags] : entity[second],
      at: path,
      reason: '',
    };
  }

  if (!store.registry.has(second)) {
    throw new QueryRejection(
      QUERY_ISSUE.UNKNOWN_COMPONENT,
      at,
      `선언되지 않은 컴포넌트 종류다: ${second} (선언된 것: ${store.registry.types().join(', ') || '없음'})`,
    );
  }

  const component = entity.components[second];
  if (component === undefined) {
    return {
      found: false,
      value: null,
      at: `${head}.${second}`,
      reason: `${entityId} 에 \`${second}\` 컴포넌트가 없다.`,
    };
  }

  let cursor: unknown = component;
  const walked = [head, second];
  for (const key of rest) {
    walked.push(key);
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return {
        found: false,
        value: null,
        at: walked.join('.'),
        reason: `${walked.slice(0, -1).join('.')} 아래로 더 들어갈 수 없다.`,
      };
    }
    const next = (cursor as Record<string, unknown>)[key];
    if (next === undefined) {
      return { found: false, value: null, at: walked.join('.'), reason: `${walked.join('.')} 가 없다.` };
    }
    cursor = next;
  }

  return { found: true, value: cursor, at: path, reason: '' };
}

/** 결합 이름 하나를 실체로 바꾼다. `has_tag` · `within_distance` 가 쓴다. */
export function resolveBinding(
  store: EntityStore,
  bindings: BindingTable,
  name: string,
  at: string,
): Resolution {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new QueryRejection(QUERY_ISSUE.BAD_PATH, at, `결합 이름이 아니다: ${JSON.stringify(name)}`);
  }
  const entityId = bindings[name];
  if (entityId === undefined) {
    throw new QueryRejection(
      QUERY_ISSUE.UNKNOWN_BINDING,
      at,
      `모르는 결합 이름이다: ${name} (결합된 이름: ${Object.keys(bindings).sort().join(', ') || '없음'})`,
    );
  }
  const entity = store.get(entityId);
  if (!entity) {
    return { found: false, value: null, at: name, reason: `결합 ${name} 이 가리키는 실체 ${entityId} 가 세계에 없다.` };
  }
  return { found: true, value: entity, at: name, reason: '' };
}
