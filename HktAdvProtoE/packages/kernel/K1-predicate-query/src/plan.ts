import { sha256Tagged } from '@hkt/v0-module-contract';
import type { EntityId, EntityStore } from '@hkt/k0-entity-state';
import { QueryRejection } from './errors.js';
import { causesOf, evaluate } from './evaluate.js';
import {
  QUERY_ISSUE,
  type BindingTable,
  type PredicateSpec,
  type QueryCandidate,
  type QueryPlan,
  type QueryReport,
  type QuerySpec,
} from './types.js';

/**
 * 질의 계획기 (원문 「9」 K1 의 Query Planner).
 *
 * 계획은 **성능의 문제일 뿐 판정의 문제가 아니다.** 인덱스로 후보를 좁히든 전수로 훑든 답이 같아야
 * 한다. 그래서 계획기가 좁혀도 되는 조건을 좁게 잡았다 — 최상위 `and` 사슬에 직접 놓인 조건만 본다.
 * `or` 나 `not` 안쪽의 조건으로 후보를 좁히면 답이 달라진다. 이 성질은
 * `planned_result_must_equal_full_scan` 불변조건과 속성 테스트가 지킨다.
 */
export function planQuery(store: EntityStore, spec: QuerySpec): { plan: QueryPlan; candidates: EntityId[] } {
  const total = store.size;
  const options: { source: QueryPlan['source']; key: string; ids: readonly EntityId[]; reason: string }[] = [];

  const from = spec.from ?? {};
  if (from.kind !== undefined) {
    options.push({
      source: 'by_kind',
      key: from.kind,
      ids: store.byKind(from.kind),
      reason: `from.kind=${from.kind} — 종류 인덱스`,
    });
  }
  if (from.withComponent !== undefined) {
    if (!store.registry.has(from.withComponent)) {
      throw new QueryRejection(
        QUERY_ISSUE.UNKNOWN_COMPONENT,
        'from/withComponent',
        `선언되지 않은 컴포넌트 종류다: ${from.withComponent}`,
      );
    }
    options.push({
      source: 'by_component',
      key: from.withComponent,
      ids: store.withComponent(from.withComponent),
      reason: `from.withComponent=${from.withComponent} — 컴포넌트 인덱스`,
    });
  }

  // 조건식의 최상위 `and` 사슬에서만 힌트를 뽑는다.
  for (const hint of conjunctiveHints(spec.where, spec.as)) {
    if (hint.kind === 'kind') {
      options.push({
        source: 'by_kind',
        key: hint.value,
        ids: store.byKind(hint.value),
        reason: `where 의 eq(${spec.as}.kind, ${hint.value}) — 종류 인덱스`,
      });
    } else if (store.registry.has(hint.value)) {
      options.push({
        source: 'by_component',
        key: hint.value,
        ids: store.withComponent(hint.value),
        reason: `where 가 ${spec.as}.${hint.value} 를 읽는다 — 컴포넌트 인덱스`,
      });
    }
  }

  // 가장 적게 훑는 계획을 고른다. 같으면 선언 순서 — 같은 세계면 언제나 같은 계획이 나와야 한다.
  let best: { source: QueryPlan['source']; key: string | null; ids: readonly EntityId[]; reason: string } = {
    source: 'full_scan',
    key: null,
    ids: store.ids(),
    reason: '좁힐 인덱스가 없다',
  };
  for (const option of options) {
    if (option.ids.length < best.ids.length || best.source === 'full_scan') best = option;
  }

  // 태그는 K0 에 인덱스가 없다. **어느 경로로 왔든** 마지막에 반드시 걸러 낸다 —
  // 인덱스가 잡힐 때만 거르면 전수 조회로 온 질의가 태그 조건을 통째로 잃는다.
  const tagFilter = from.tag;
  const candidates =
    tagFilter === undefined
      ? [...best.ids]
      : [...best.ids].filter((id) => store.get(id)?.tags.includes(tagFilter) === true);

  return {
    plan: {
      source: tagFilter === undefined ? best.source : 'by_tag',
      key: tagFilter === undefined ? best.key : tagFilter,
      reason:
        tagFilter === undefined
          ? best.reason
          : `${best.reason} + from.tag=${tagFilter} (태그는 인덱스 없이 거른다)`,
      scanned: candidates.length,
      total,
    },
    candidates,
  };
}

type Hint = { kind: 'kind'; value: string } | { kind: 'component'; value: string };

/** 최상위 `and` 사슬에 **직접** 놓인 조건에서만 힌트를 뽑는다. */
function conjunctiveHints(predicate: PredicateSpec, as: string): Hint[] {
  if (predicate === null || typeof predicate !== 'object') return [];
  if (predicate.op === 'and') {
    return (predicate.items ?? []).flatMap((item) => conjunctiveHints(item, as));
  }
  if (predicate.op === 'eq' && typeof predicate.path === 'string') {
    const [head, second, ...rest] = predicate.path.split('.');
    if (head !== as || second === undefined) return [];
    if (second === 'kind' && rest.length === 0 && typeof predicate.value === 'string') {
      return [{ kind: 'kind', value: predicate.value }];
    }
    if (second !== 'id' && second !== 'kind' && second !== 'tags') {
      return [{ kind: 'component', value: second }];
    }
    return [];
  }
  if (predicate.op === 'gt' || predicate.op === 'lt') {
    const [head, second, ...rest] = (predicate.path ?? '').split('.');
    if (head !== as || second === undefined) return [];
    // `gt`/`lt` 는 그 컴포넌트가 있어야만 참이 될 수 있으므로 컴포넌트 인덱스로 좁혀도 답이 같다.
    if (second !== 'id' && second !== 'kind' && second !== 'tags' && rest.length >= 0) {
      return [{ kind: 'component', value: second }];
    }
  }
  return [];
}

/** 질의 실행 — 계획으로 후보를 좁히고, 후보마다 조건식을 돌린다. */
export function runQuery(store: EntityStore, spec: QuerySpec): QueryReport {
  if (typeof spec.as !== 'string' || !/^[a-z][a-z0-9_]*$/.test(spec.as)) {
    throw new QueryRejection(QUERY_ISSUE.BAD_PATH, 'as', `\`as\` 는 소문자 snake_case 여야 한다: ${JSON.stringify(spec.as)}`);
  }
  if (spec.bindings && Object.hasOwn(spec.bindings, spec.as)) {
    // `as` 와 고정 결합의 이름이 부딪히면 어느 실체를 가리키는지 알 수 없다.
    throw new QueryRejection(
      QUERY_ISSUE.UNKNOWN_BINDING,
      'bindings',
      `고정 결합에 \`${spec.as}\` 가 이미 있다 — 후보 이름과 부딪힌다.`,
    );
  }

  const { plan, candidates } = planQuery(store, spec);
  const evaluated: QueryCandidate[] = candidates.map((id) => {
    const bindings: BindingTable = { ...(spec.bindings ?? {}), [spec.as]: id };
    const result = evaluate(store, spec.where, bindings, 'where');
    return { id, passed: result.passed, causes: result.causes };
  });

  const matched = evaluated.filter((entry) => entry.passed).map((entry) => entry.id).sort();
  return {
    matched,
    plan,
    candidates: evaluated,
    digest: sha256Tagged(JSON.stringify({ matched, candidates: evaluated })),
  };
}

/** 계획을 쓰지 않고 세계 전체를 훑는다. 계획의 답과 대조하는 기준선이다. */
export function runQueryByFullScan(store: EntityStore, spec: QuerySpec): EntityId[] {
  const from = spec.from ?? {};
  return store
    .ids()
    .filter((id) => {
      const entity = store.get(id);
      if (!entity) return false;
      if (from.kind !== undefined && entity.kind !== from.kind) return false;
      if (from.withComponent !== undefined && entity.components[from.withComponent] === undefined) return false;
      if (from.tag !== undefined && !entity.tags.includes(from.tag)) return false;
      return true;
    })
    .filter((id) => evaluate(store, spec.where, { ...(spec.bindings ?? {}), [spec.as]: id }, 'where').passed)
    .sort();
}

export { causesOf };
