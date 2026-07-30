import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { ComponentRegistry } from '../src/components.js';
import { applyOperation } from '../src/operations.js';
import { EntityStore } from '../src/store.js';
import { executeK0, K0_PURPOSE, validateOutput } from '../src/module.js';
import type { K0Input, K0Output } from '../src/module.js';
import type { EntityState, StoreOperation } from '../src/types.js';
import { BORDER_CANYON, COMPONENT_DEFINITIONS } from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): K0Input;
  check(input: K0Input, output: K0Output, context: ModuleContext): AssertionResult[];
  reasons(input: K0Input, output: K0Output): string[];
  candidates?(input: K0Input, output: K0Output): LabRow[];
  result?(output: K0Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<K0Input, K0Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeK0(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      return {
        purpose: K0_PURPOSE,
        input: [
          { label: '선언된 컴포넌트', value: (input.components ?? []).map((c) => c.type).join(', ') || '없음' },
          { label: '연산', value: input.operations.map((op) => describeOperation(op)).join(' · ') },
          { label: '조회 요청', value: (input.reads ?? []).join(', ') || '없음' },
        ],
        candidates: spec.candidates?.(input, output) ?? [
          ...output.snapshot.entities.map((entity) => ({
            label: `${entity.id} (${entity.kind})`,
            value: describeEntity(entity),
          })),
          { label: '종류 인덱스', value: JSON.stringify(output.snapshot.byKind) },
          { label: '컴포넌트 인덱스', value: JSON.stringify(output.snapshot.byComponent) },
        ],
        result: spec.result?.(output) ?? `적용 ${output.applied} · 거부 ${output.rejected} · 실체 ${output.snapshot.entities.length}`,
        reasons: spec.reasons(input, output),
        before: `빈 저장소 (실체 0)`,
        after: `실체 ${output.snapshot.entities.length} · 해시 ${output.snapshot.hash.slice(0, 21)}…`,
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

const eq = (id: string, expected: unknown, actual: unknown, reason?: string): AssertionResult => ({
  id,
  passed: JSON.stringify(expected) === JSON.stringify(actual),
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

const ok = (
  id: string,
  passed: boolean,
  expected: unknown,
  actual: unknown,
  reason?: string,
): AssertionResult => ({
  id,
  passed,
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

function describeOperation(operation: StoreOperation): string {
  switch (operation.op) {
    case 'spawn':
      return `spawn ${operation.id}:${operation.kind}`;
    case 'despawn':
      return `despawn ${operation.id}`;
    case 'set_component':
      return `set ${operation.id}.${operation.type}=${JSON.stringify(operation.data)}`;
    case 'remove_component':
      return `remove ${operation.id}.${operation.type}`;
    case 'attach_tag':
      return `+tag ${operation.id}:${operation.tag}`;
    case 'remove_tag':
      return `-tag ${operation.id}:${operation.tag}`;
    default:
      return JSON.stringify(operation);
  }
}

function describeEntity(entity: EntityState): string {
  const parts = Object.entries(entity.components).map(([type, data]) => `${type}=${JSON.stringify(data)}`);
  return `태그[${entity.tags.join(', ')}] ${parts.join(' ')}`;
}

/** 대표 장면 대부분이 쓰는 무대. */
const canyon = (extra: StoreOperation[] = [], reads: string[] = []): K0Input => ({
  components: COMPONENT_DEFINITIONS,
  operations: [...BORDER_CANYON, ...extra],
  reads,
});

// ---------------------------------------------------------------------------
// 1. 대표 검증 — 두 실체의 체력·위치·소유권이 섞이지 않는다
// ---------------------------------------------------------------------------
const twoEntitiesDoNotBleed = defineScene({
  id: 'two_entities_do_not_bleed_into_each_other',
  title: '두 실체의 체력·위치·소유권이 섞이지 않고 독립적으로 조회된다',
  seed: 101n,
  arrange: () =>
    canyon(
      [
        // 한쪽만 다치게 한다. 다른 쪽이 함께 깎이면 저장소가 섞인 것이다.
        { op: 'set_component', id: 'hunter_a', type: 'health', data: { current: 12, max: 100 } },
        { op: 'set_component', id: 'hunter_a', type: 'position', data: { x: 7, y: 0, z: 0 } },
      ],
      ['hunter_a', 'hunter_b', 'relic_organ'],
    ),
  check: (_input, output) => {
    const read = (id: string): EntityState | null =>
      output.reads.find((entry) => entry.id === id)?.state ?? null;
    const a = read('hunter_a');
    const b = read('hunter_b');
    const organ = read('relic_organ');

    return [
      eq('a_health_changed', { current: 12, max: 100 }, a?.components['health']),
      eq('b_health_untouched', { current: 91, max: 100 }, b?.components['health'], '옆 실체는 그대로다'),
      eq('a_position_changed', { x: 7, y: 0, z: 0 }, a?.components['position']),
      eq('b_position_untouched', { x: 30, y: 0, z: 0 }, b?.components['position']),
      eq('owner_is_a_only', { ownerId: 'hunter_a' }, organ?.components['ownership']),
      ok('a_has_no_ownership', a?.components['ownership'] === undefined, undefined, a?.components['ownership'], '사람은 소유권 컴포넌트를 갖지 않는다'),
      eq('audit_is_clean', [], output.audit.map((issue) => issue.code)),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `hunter_a 의 체력만 42→12 로 바뀌었고 hunter_b 는 91 그대로다 (실체 ${output.snapshot.entities.length}개).`,
    '컴포넌트는 (실체 id, 종류) 두 열쇠로만 찾는다 — 한쪽을 고쳐도 다른 쪽의 열쇠에 닿지 않는다.',
  ],
  candidates: (_input, output) =>
    output.reads.map((entry) => ({
      label: entry.id,
      value: entry.state ? describeEntity(entry.state) : '없음',
    })),
  result: (output) =>
    output.reads
      .map((entry) => `${entry.id}:${JSON.stringify(entry.state?.components['health'] ?? entry.state?.components['ownership'] ?? null)}`)
      .join(' / '),
});

// ---------------------------------------------------------------------------
// 2. 거부된 연산은 저장소를 건드리지 않는다
// ---------------------------------------------------------------------------
const rejectedOperationLeavesStoreUntouched = defineScene({
  id: 'rejected_operation_leaves_store_untouched',
  title: '거부된 연산은 저장소를 한 글자도 바꾸지 않고, 원인을 코드와 위치로 지목한다',
  seed: 102n,
  arrange: () =>
    canyon(
      [
        { op: 'spawn', id: 'hunter_a', kind: 'person' }, // 중복 id
        { op: 'set_component', id: 'ghost', type: 'health', data: { current: 1, max: 2 } }, // 없는 실체
        { op: 'remove_component', id: 'hunter_b', type: 'ownership' }, // 없는 컴포넌트
        { op: 'set_component', id: 'hunter_b', type: 'mood', data: { value: 1 } }, // 미선언 종류
      ],
      ['hunter_a', 'hunter_b'],
    ),
  check: (input, output) => {
    // 거부 연산을 뺀 세계와 결과가 같아야 한다 — "거부는 아무 일도 없었던 것" 이라는 뜻이다.
    const clean = executeK0({ ...input, operations: BORDER_CANYON });
    const rejections = output.log.filter((entry) => !entry.applied);

    return [
      eq('four_rejections', 4, rejections.length),
      eq(
        'rejection_codes',
        ['E_DUPLICATE_ENTITY_ID', 'E_UNKNOWN_ENTITY', 'E_MISSING_COMPONENT', 'E_UNKNOWN_COMPONENT_TYPE'],
        rejections.map((entry) => entry.rejection?.code),
      ),
      eq(
        'rejection_paths_point_at_place',
        [
          'entity/hunter_a',
          'entity/ghost/components/health',
          'entity/hunter_b/components/ownership',
          'entity/hunter_b/components/mood',
        ],
        rejections.map((entry) => entry.rejection?.path),
        '거부는 저장소 안 좌표를 지목한다',
      ),
      eq('store_is_identical_to_clean_run', clean.snapshot.hash, output.snapshot.hash, '거부가 상태를 남기지 않았다'),
      eq('applied_count', 3, output.applied),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.log
      .filter((entry) => !entry.applied)
      .map((entry) => `#${entry.index} ${entry.rejection?.code} @ ${entry.rejection?.path}`)
      .join(' · '),
    '거부된 연산은 새 저장소를 만들지 않고 이전 저장소를 그대로 이어 쓴다 — 절반만 반영되는 경로가 없다.',
  ],
  candidates: (_input, output) =>
    output.log.map((entry) => ({
      label: `#${entry.index} ${describeOperation(entry.operation)}`,
      value: entry.applied ? '적용' : `거부 ${entry.rejection?.code} @ ${entry.rejection?.path}`,
    })),
});

// ---------------------------------------------------------------------------
// 3. 컴포넌트 값은 선언한 스키마를 지켜야 한다
// ---------------------------------------------------------------------------
const componentDataMustMatchSchema = defineScene({
  id: 'component_data_must_match_schema',
  title: '스키마를 어긴 컴포넌트는 어긴 경로와 함께 거부된다',
  seed: 103n,
  arrange: () =>
    canyon([
      { op: 'set_component', id: 'hunter_a', type: 'health', data: { current: -3, max: 100 } },
      { op: 'set_component', id: 'hunter_a', type: 'health', data: { current: 5 } },
      { op: 'set_component', id: 'hunter_a', type: 'position', data: { x: 1, y: 2, z: 3, w: 4 } },
      { op: 'set_component', id: 'hunter_a', type: 'health', data: { current: 5, max: 100 } },
    ]),
  check: (_input, output) => {
    const rejections = output.log.filter((entry) => !entry.applied);
    return [
      eq('three_rejections', 3, rejections.length),
      eq(
        'all_schema_rejections',
        ['E_COMPONENT_SCHEMA', 'E_COMPONENT_SCHEMA', 'E_COMPONENT_SCHEMA'],
        rejections.map((entry) => entry.rejection?.code),
      ),
      ok(
        'negative_health_points_at_field',
        rejections[0]?.rejection?.path === 'entity/hunter_a/components/health/current',
        'entity/hunter_a/components/health/current',
        rejections[0]?.rejection?.path,
        '음수 체력은 그 필드를 지목한다',
      ),
      eq(
        'last_valid_write_survives',
        { current: 5, max: 100 },
        output.snapshot.entities.find((entity) => entity.id === 'hunter_a')?.components['health'],
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.log
      .filter((entry) => !entry.applied)
      .map((entry) => `${entry.rejection?.path} — ${entry.rejection?.message}`)
      .join(' · '),
    '형식 판정은 V1 이 한다. K0 은 어느 실체·어느 종류에서 났는지를 경로 앞머리로 붙일 뿐이다.',
  ],
});

// ---------------------------------------------------------------------------
// 4. 타입별 인덱스
// ---------------------------------------------------------------------------
const typeIndexSelectsByKindAndComponent = defineScene({
  id: 'type_index_selects_by_kind_and_component',
  title: '종류·컴포넌트 인덱스가 전수 조회와 언제나 같은 답을 준다',
  seed: 104n,
  arrange: () =>
    canyon([
      { op: 'spawn', id: 'beast_ka', kind: 'giant_beast', tags: ['beast'], components: { health: { current: 900, max: 900 } } },
      // 생성 뒤에 붙인 컴포넌트도 인덱스에 들어와야 한다 — 여기가 인덱스가 가장 자주 갈라지는 자리다.
      { op: 'set_component', id: 'beast_ka', type: 'position', data: { x: 120, y: 0, z: 0 } },
      { op: 'remove_component', id: 'hunter_b', type: 'energy' },
      { op: 'despawn', id: 'relic_organ' },
    ]),
  check: (input, output) => {
    const registry = ComponentRegistry.of(input.components ?? []);
    let store = EntityStore.empty(registry);
    for (const operation of input.operations) {
      try {
        store = applyOperation(store, operation);
      } catch {
        /* 이 장면에는 거부가 없다 */
      }
    }
    const scan = (predicate: (entity: EntityState) => boolean): string[] =>
      store.list().filter(predicate).map((entity) => entity.id).sort();

    return [
      eq('person_index', ['hunter_a', 'hunter_b'], [...store.byKind('person')]),
      eq('person_index_matches_scan', scan((entity) => entity.kind === 'person'), [...store.byKind('person')]),
      eq('beast_index', ['beast_ka'], [...store.byKind('giant_beast')]),
      eq('energy_index_after_removal', ['hunter_a'], [...store.withComponent('energy')]),
      eq(
        'position_index_includes_late_write',
        ['beast_ka', 'hunter_a', 'hunter_b'],
        [...store.withComponent('position')],
        '생성 뒤에 붙인 컴포넌트도 인덱스에 들어온다',
      ),
      eq(
        'energy_index_matches_scan',
        scan((entity) => entity.components['energy'] !== undefined),
        [...store.withComponent('energy')],
      ),
      eq('despawned_entity_leaves_no_index', [], [...store.withComponent('ownership')], '삭제된 실체는 인덱스에서도 사라진다'),
      eq('audit_is_clean', [], store.audit().map((issue) => issue.code)),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `종류 인덱스 ${JSON.stringify(output.snapshot.byKind)}`,
    '인덱스는 쓰기마다 갱신되므로 갈라질 수 있다. 그래서 감사가 전수 재계산과 대조한다 — 갈라진 인덱스는 K1 의 질의를 조용히 틀리게 만든다.',
  ],
});

// ---------------------------------------------------------------------------
// 5. 읽기 결과는 떼어낸 동결 사본이다
// ---------------------------------------------------------------------------
const readResultIsDetachedAndFrozen = defineScene({
  id: 'read_result_is_detached_and_frozen',
  title: '읽어 간 상태를 밖에서 고쳐도 저장소는 흔들리지 않는다',
  seed: 105n,
  arrange: () => canyon([], ['hunter_a']),
  check: (input, output) => {
    const registry = ComponentRegistry.of(input.components ?? []);
    let store = EntityStore.empty(registry);
    for (const operation of BORDER_CANYON) store = applyOperation(store, operation);

    const before = store.hash();
    const read = store.get('hunter_a') as EntityState;
    const health = read.components['health'] as { current: number };

    // 밖에서 고쳐 본다. 동결되어 있으므로 조용히 무시되거나 예외가 난다 — 어느 쪽이든 저장소는 그대로다.
    let threw = false;
    try {
      (health as { current: number }).current = 999;
    } catch {
      threw = true;
    }

    // 넘겨준 입력을 나중에 고쳐도 저장소는 흔들리지 않아야 한다.
    const mutableInput = { current: 50, max: 100 };
    const stored = store.setComponent('hunter_b', 'health', mutableInput);
    mutableInput.current = 1;

    return [
      ok('entity_state_is_frozen', Object.isFrozen(read), true, Object.isFrozen(read)),
      ok('component_is_frozen', Object.isFrozen(health), true, Object.isFrozen(health)),
      ok('mutation_did_not_take', health.current === 42, 42, health.current, threw ? '예외로 막혔다' : '동결로 무시되었다'),
      eq('store_hash_unchanged', before, store.hash()),
      eq(
        'stored_copy_is_detached_from_input',
        { current: 50, max: 100 },
        stored.component('hunter_b', 'health'),
        '입력을 나중에 고쳐도 저장소는 그대로다',
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, _output) => [
    '읽기는 동결된 사본만 내보내고, 쓰기는 값을 복사해 넣는다 — 밖에서 잡을 수 있는 참조가 없다.',
    '원문 「9」 K0 의 금지 사항은 "다른 모듈이 내부 Map을 직접 수정하는 것" 이다. 규약이 아니라 구조로 막는다.',
  ],
});

// ---------------------------------------------------------------------------
// 6. 스냅샷 복원
// ---------------------------------------------------------------------------
const snapshotRestoresIdenticalStore = defineScene({
  id: 'snapshot_restores_identical_store',
  title: '스냅샷으로 되살린 저장소의 해시가 원본과 같다',
  seed: 106n,
  arrange: () => canyon(),
  check: (input, output) => {
    const registry = ComponentRegistry.of(input.components ?? []);
    let store = EntityStore.empty(registry);
    for (const operation of input.operations) store = applyOperation(store, operation);

    const restored = EntityStore.restore(store.snapshot(), registry);
    // 순서를 뒤집어 넣어도 같은 저장소가 나와야 한다 — 해시가 삽입 순서에 매달리면 재생이 깨진다.
    let reversed = EntityStore.empty(registry);
    for (const operation of [...BORDER_CANYON].reverse()) reversed = applyOperation(reversed, operation);

    return [
      eq('restored_hash_equals_original', store.hash(), restored.hash()),
      eq('restored_entities_equal', store.list(), restored.list()),
      eq('insertion_order_does_not_matter', store.hash(), reversed.hash()),
      eq('snapshot_hash_matches_output', output.snapshot.hash, store.hash()),
      eq('audit_is_clean', [], restored.audit().map((issue) => issue.code)),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `스냅샷 해시 ${output.snapshot.hash}`,
    'K3 이 이 스냅샷에서 중간부터 재생한다. 삽입 순서가 해시를 바꾸면 같은 세계가 다른 해시를 갖게 된다 (GI-12).',
  ],
});

// ---------------------------------------------------------------------------
// 7. GI-11 — 소유자는 하나뿐이다
// ---------------------------------------------------------------------------
const singleOwnerPerResource = defineScene({
  id: 'single_owner_per_resource',
  title: '소유권을 다시 쓰면 갈아치워질 뿐 둘이 되지 않고, 없는 소유자는 감사에 걸린다',
  seed: 107n,
  arrange: () =>
    canyon(
      [{ op: 'set_component', id: 'relic_organ', type: 'ownership', data: { ownerId: 'hunter_b' } }],
      ['relic_organ'],
    ),
  check: (input, output) => {
    const organ = output.reads.find((entry) => entry.id === 'relic_organ')?.state;

    // 세계에 없는 주체를 소유자로 적으면 감사에 걸린다.
    const registry = ComponentRegistry.of(input.components ?? []);
    let dangling = EntityStore.empty(registry);
    for (const operation of BORDER_CANYON) dangling = applyOperation(dangling, operation);
    dangling = dangling.setComponent('relic_organ', 'ownership', { ownerId: 'nobody' });

    return [
      eq('owner_replaced_not_added', { ownerId: 'hunter_b' }, organ?.components['ownership']),
      eq('exactly_one_ownership_component', 1, Object.keys(organ?.components ?? {}).filter((type) => type === 'ownership').length),
      eq('ownership_index_has_one_entry', ['relic_organ'], output.snapshot.byComponent['ownership']),
      eq('audit_is_clean', [], output.audit.map((issue) => issue.code)),
      eq(
        'dangling_owner_is_caught',
        ['E_INVARIANT_owned_entity_must_have_single_owner'],
        dangling.audit().map((issue) => issue.code),
        'GI-11 — 소유자는 실재해야 한다',
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, _output) => [
    '소유권은 (실체 id, "ownership") 한 칸에만 들어간다. 두 번째 소유자를 "추가" 할 자리 자체가 없다.',
    'GI-11(고유 자원의 중복 소유 금지)을 규칙이 아니라 저장 구조로 지킨다. 남는 위험은 "없는 소유자" 뿐이라 감사가 그것만 본다.',
  ],
});

export const k0Scenarios: VerificationScenario<K0Input, K0Output>[] = [
  twoEntitiesDoNotBleed,
  rejectedOperationLeavesStoreUntouched,
  componentDataMustMatchSchema,
  typeIndexSelectsByKindAndComponent,
  readResultIsDetachedAndFrozen,
  snapshotRestoresIdenticalStore,
  singleOwnerPerResource,
];
