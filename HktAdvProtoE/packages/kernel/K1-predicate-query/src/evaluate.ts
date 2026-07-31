import type { EntityState, EntityStore } from '@hkt/k0-entity-state';
import { QueryRejection } from './errors.js';
import { resolveBinding, resolvePath } from './path.js';
import {
  POSITION_COMPONENT,
  QUERY_ISSUE,
  type BindingTable,
  type PredicateCause,
  type PredicateResult,
  type PredicateSpec,
  type PredicateTrace,
} from './types.js';

/**
 * 조건식 판정 (원문 「9」 K1).
 *
 * 판정은 **참·거짓 하나**가 아니라 판정 과정 전체(`trace`)를 남긴다. 원문 「9」 K1 의 출력에
 * "조건 실패 원인"이 있기 때문이다 — 왜 이 NPC 가 후보에서 빠졌는지 화면에서 보여야 한다.
 */
export function evaluate(
  store: EntityStore,
  predicate: PredicateSpec,
  bindings: BindingTable,
  at = 'where',
): PredicateResult {
  const trace = walk(store, predicate, bindings, at);
  return { passed: trace.passed, trace, causes: causesOf(trace) };
}

function node(
  op: PredicateTrace['op'],
  passed: boolean,
  at: string,
  expected: unknown,
  actual: unknown,
  reason: string,
  children: PredicateTrace[] = [],
): PredicateTrace {
  return { op, passed, at, expected, actual, reason, children };
}

function walk(
  store: EntityStore,
  predicate: PredicateSpec,
  bindings: BindingTable,
  at: string,
): PredicateTrace {
  if (predicate === null || typeof predicate !== 'object' || Array.isArray(predicate)) {
    throw new QueryRejection(QUERY_ISSUE.BAD_PREDICATE, at, '조건식은 객체여야 한다.');
  }

  switch (predicate.op) {
    case 'eq': {
      const resolution = resolvePath(store, bindings, predicate.path, `${at}/path`);
      if (!resolution.found) {
        return node('eq', false, resolution.at, predicate.value, null, resolution.reason);
      }
      const passed = deepEqual(resolution.value, predicate.value);
      return node(
        'eq',
        passed,
        resolution.at,
        predicate.value,
        resolution.value,
        passed ? '같다' : `${show(resolution.value)} ≠ ${show(predicate.value)}`,
      );
    }

    case 'gt':
    case 'lt': {
      requireNumber(predicate.value, `${at}/value`, predicate.op);
      const resolution = resolvePath(store, bindings, predicate.path, `${at}/path`);
      if (!resolution.found) {
        return node(predicate.op, false, resolution.at, predicate.value, null, resolution.reason);
      }
      if (typeof resolution.value !== 'number' || !Number.isFinite(resolution.value)) {
        return node(
          predicate.op,
          false,
          resolution.at,
          predicate.value,
          resolution.value,
          `${QUERY_ISSUE.NOT_COMPARABLE}: ${show(resolution.value)} 는 수가 아니라 비교할 수 없다.`,
        );
      }
      const passed =
        predicate.op === 'gt' ? resolution.value > predicate.value : resolution.value < predicate.value;
      return node(
        predicate.op,
        passed,
        resolution.at,
        predicate.value,
        resolution.value,
        `${resolution.value} ${predicate.op === 'gt' ? '>' : '<'} ${predicate.value} → ${passed}`,
      );
    }

    case 'has_tag': {
      if (typeof predicate.tag !== 'string' || predicate.tag === '') {
        throw new QueryRejection(QUERY_ISSUE.BAD_PREDICATE, `${at}/tag`, '태그는 비어 있지 않은 문자열이어야 한다.');
      }
      const resolution = resolveBinding(store, bindings, predicate.target, `${at}/target`);
      if (!resolution.found) {
        return node('has_tag', false, `${predicate.target}.tags`, predicate.tag, null, resolution.reason);
      }
      const tags = (resolution.value as EntityState).tags;
      const passed = tags.includes(predicate.tag);
      return node(
        'has_tag',
        passed,
        `${predicate.target}.tags`,
        predicate.tag,
        [...tags],
        passed ? `태그 ${predicate.tag} 를 가진다` : `태그 ${predicate.tag} 가 없다 (가진 것: ${tags.join(', ') || '없음'})`,
      );
    }

    case 'within_distance': {
      requireNumber(predicate.max, `${at}/max`, 'within_distance');
      if (predicate.max < 0) {
        throw new QueryRejection(QUERY_ISSUE.BAD_PREDICATE, `${at}/max`, '거리는 0 이상이어야 한다.');
      }
      const left = positionOf(store, bindings, predicate.a, `${at}/a`);
      const right = positionOf(store, bindings, predicate.b, `${at}/b`);
      const label = `${predicate.a}↔${predicate.b}`;
      if (!left.ok || !right.ok) {
        return node(
          'within_distance',
          false,
          label,
          predicate.max,
          null,
          `${QUERY_ISSUE.MISSING_POSITION}: ${[left.reason, right.reason].filter((part) => part !== '').join(' · ')}`,
        );
      }
      const distance = distanceBetween(left.value, right.value);
      const passed = distance <= predicate.max;
      return node(
        'within_distance',
        passed,
        label,
        predicate.max,
        Number(distance.toFixed(6)),
        `거리 ${distance.toFixed(3)}m ${passed ? '≤' : '>'} ${predicate.max}m`,
      );
    }

    case 'and':
    case 'or': {
      const items = predicate.items;
      if (!Array.isArray(items) || items.length === 0) {
        throw new QueryRejection(
          QUERY_ISSUE.BAD_PREDICATE,
          `${at}/items`,
          `\`${predicate.op}\` 의 항목은 비어 있지 않은 배열이어야 한다 — 빈 목록은 조용히 참·거짓이 되어 조건을 무력화한다.`,
        );
      }
      const children = items.map((item, index) => walk(store, item, bindings, `${at}/items/${index}`));
      const passed =
        predicate.op === 'and'
          ? children.every((child) => child.passed)
          : children.some((child) => child.passed);
      return node(
        predicate.op,
        passed,
        at,
        predicate.op === 'and' ? '모두 참' : '하나 이상 참',
        `${children.filter((child) => child.passed).length}/${children.length} 참`,
        passed ? '' : predicate.op === 'and' ? '어긴 항목이 있다' : '참인 항목이 없다',
        children,
      );
    }

    case 'not': {
      if (predicate.item === undefined) {
        throw new QueryRejection(QUERY_ISSUE.BAD_PREDICATE, `${at}/item`, '`not` 에는 항목이 하나 있어야 한다.');
      }
      const child = walk(store, predicate.item, bindings, `${at}/item`);
      return node('not', !child.passed, at, '거짓', child.passed, child.passed ? '안의 조건이 참이라 뒤집혀 거짓이다' : '', [
        child,
      ]);
    }

    default: {
      const unknown = predicate as { op?: unknown };
      throw new QueryRejection(
        QUERY_ISSUE.BAD_PREDICATE,
        `${at}/op`,
        `모르는 연산자다: ${JSON.stringify(unknown.op)}`,
      );
    }
  }
}

/**
 * 거짓의 원인을 모은다.
 *
 * 접속사는 원인이 아니다 — `and` 가 거짓이라는 말은 정보가 없다. **어긴 잎**까지 내려간다.
 * `or` 는 모든 항목이 거짓이므로 전부가 원인이고, `not` 은 참이 된 안쪽 조건이 원인이다.
 */
export function causesOf(trace: PredicateTrace): PredicateCause[] {
  if (trace.passed) return [];

  if (trace.op === 'and') {
    return trace.children.filter((child) => !child.passed).flatMap(causesOf);
  }
  if (trace.op === 'or') {
    return trace.children.flatMap(causesOf);
  }
  if (trace.op === 'not') {
    const child = trace.children[0];
    if (!child) return [toCause(trace)];
    return [
      {
        op: 'not',
        at: child.at,
        expected: `${child.op} 가 거짓`,
        actual: child.actual,
        reason: `${child.at} 에서 ${child.reason} — 참이 되어 not 이 거짓이다`,
      },
    ];
  }
  return [toCause(trace)];
}

function toCause(trace: PredicateTrace): PredicateCause {
  return {
    op: trace.op,
    at: trace.at,
    expected: trace.expected,
    actual: trace.actual,
    reason: trace.reason,
  };
}

function positionOf(
  store: EntityStore,
  bindings: BindingTable,
  name: string,
  at: string,
): { ok: true; value: [number, number, number]; reason: '' } | { ok: false; value: null; reason: string } {
  const resolution = resolveBinding(store, bindings, name, at);
  if (!resolution.found) return { ok: false, value: null, reason: resolution.reason };
  const entity = resolution.value as EntityState;
  const position = entity.components[POSITION_COMPONENT];
  if (position === undefined) {
    return { ok: false, value: null, reason: `${entity.id} 에 \`${POSITION_COMPONENT}\` 컴포넌트가 없다.` };
  }
  const axes = ['x', 'y', 'z'].map((axis) => (position as Record<string, unknown>)[axis]);
  if (!axes.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return { ok: false, value: null, reason: `${entity.id} 의 위치가 수가 아니다: ${show(position)}` };
  }
  return { ok: true, value: axes as [number, number, number], reason: '' };
}

function distanceBetween(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function requireNumber(value: unknown, at: string, op: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new QueryRejection(
      QUERY_ISSUE.BAD_PREDICATE,
      at,
      `\`${op}\` 의 비교값은 유한한 수여야 한다: ${JSON.stringify(value)}`,
    );
  }
}

/** 순서가 다른 객체도 같은 값으로 본다. 배열은 순서가 의미이므로 순서를 지킨다. */
export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (typeof left !== 'object') return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a).sort();
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}

function show(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
}
