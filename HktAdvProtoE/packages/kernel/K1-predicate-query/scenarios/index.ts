import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { buildWorld, executeK1, K1_PURPOSE, validateOutput } from '../src/module.js';
import type { K1Input, K1Output } from '../src/module.js';
import { evaluate } from '../src/evaluate.js';
import { runQuery, runQueryByFullScan } from '../src/plan.js';
import type { PredicateSpec, QuerySpec } from '../src/types.js';
import { COMPONENT_DEFINITIONS, ROOM } from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): K1Input;
  check(input: K1Input, output: K1Output, context: ModuleContext): AssertionResult[];
  reasons(input: K1Input, output: K1Output): string[];
  candidates?(input: K1Input, output: K1Output): LabRow[];
  result?(output: K1Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<K1Input, K1Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeK1(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      return {
        purpose: K1_PURPOSE,
        input: [
          { label: '세계', value: `실체 ${input.world.operations.length}개 · ${ROOM.map((op) => ('id' in op ? op.id : '')).join(', ')}` },
          ...(input.queries ?? []).map((entry) => ({
            label: `질의 ${entry.id}`,
            value: `as=${entry.spec.as} from=${JSON.stringify(entry.spec.from ?? {})} where=${describe(entry.spec.where)}`,
          })),
          ...(input.checks ?? []).map((entry) => ({
            label: `조건 ${entry.id}`,
            value: `${describe(entry.predicate)} · 결합 ${JSON.stringify(entry.bindings ?? {})}`,
          })),
        ],
        candidates:
          spec.candidates?.(input, output) ??
          (output.queries[0]?.report?.candidates ?? []).map((candidate) => ({
            label: `${candidate.passed ? '○' : '×'} ${candidate.id}`,
            value: candidate.passed
              ? '조건을 모두 만족한다'
              : candidate.causes.map((cause) => `${cause.at}: ${cause.reason}`).join(' · '),
          })),
        result:
          spec.result?.(output) ??
          output.queries.map((query) => `${query.id} → [${query.report?.matched.join(', ') ?? query.rejection?.code}]`).join(' / '),
        reasons: spec.reasons(input, output),
        before: `세계 해시 ${output.worldHashBefore.slice(0, 21)}…`,
        after: `세계 해시 ${output.worldHashAfter.slice(0, 21)}… (질의는 세계를 바꾸지 않는다)`,
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

/** 조건식을 사람이 읽는 한 줄로. Lab 화면에 그대로 나간다. */
export function describe(predicate: PredicateSpec): string {
  switch (predicate.op) {
    case 'eq':
      return `${predicate.path} = ${JSON.stringify(predicate.value)}`;
    case 'gt':
      return `${predicate.path} > ${predicate.value}`;
    case 'lt':
      return `${predicate.path} < ${predicate.value}`;
    case 'has_tag':
      return `${predicate.target} 에 태그 ${predicate.tag}`;
    case 'within_distance':
      return `거리(${predicate.a}, ${predicate.b}) ≤ ${predicate.max}`;
    case 'and':
      return `(${predicate.items.map(describe).join(' 그리고 ')})`;
    case 'or':
      return `(${predicate.items.map(describe).join(' 또는 ')})`;
    case 'not':
      return `아님(${describe(predicate.item)})`;
    default:
      return JSON.stringify(predicate);
  }
}

const world = { components: COMPONENT_DEFINITIONS, operations: ROOM };

/** “체력 50 이하” — `or[lt(50), eq(50)]`. 없는 값은 둘 다 거짓이므로 체력 없는 것이 새지 않는다. */
const healthAtMost50: PredicateSpec = {
  op: 'or',
  items: [
    { op: 'lt', path: 'subject.health.current', value: 50 },
    { op: 'eq', path: 'subject.health.current', value: 50 },
  ],
};

/**
 * 원문 「9」 K1 의 대표 검증 조건 그대로.
 *
 * 후보를 `from` 으로 미리 좁히지 않는다 — “만 정확히 선택”을 보이려면 **떨어져야 할 것들이 후보로
 * 올라온 뒤 각자의 이유로 떨어지는** 모습이 보여야 하기 때문이다. 인덱스 이야기는 3번 장면이 맡는다.
 */
const WEAK_HUMANS_NEARBY: QuerySpec = {
  as: 'subject',
  where: {
    op: 'and',
    items: [
      { op: 'has_tag', target: 'subject', tag: 'human' },
      healthAtMost50,
      { op: 'within_distance', a: 'subject', b: 'hero', max: 10 },
    ],
  },
  bindings: { hero: 'hero' },
};

// ---------------------------------------------------------------------------
// 1. 대표 검증
// ---------------------------------------------------------------------------
const weakHumansWithinTenMeters = defineScene({
  id: 'weak_humans_within_ten_meters',
  title: '“체력 50 이하이며 반경 10m 내에 있는 인간”만 정확히 선택된다',
  seed: 201n,
  arrange: () => ({ world, queries: [{ id: 'weak_humans_nearby', spec: WEAK_HUMANS_NEARBY }] }),
  check: (_input, output) => {
    const report = output.queries[0]?.report;
    const causeOf = (id: string): string[] =>
      report?.candidates.find((candidate) => candidate.id === id)?.causes.map((cause) => cause.at) ?? [];

    return [
      eq('matched_exactly', ['dying_healer', 'wounded_scout'], report?.matched),
      eq('every_entity_was_a_candidate', 8, report?.candidates.length, '떨어진 것도 후보로 올라와 이유를 남긴다'),
      eq('boundary_50_is_included', true, report?.matched.includes('dying_healer'), '“50 이하”는 50 을 포함한다'),
      eq('too_healthy_is_out', ['subject.health.current', 'subject.health.current'], causeOf('strong_guard'), '체력 88 — or 의 두 항목이 모두 어긋난다'),
      eq('too_far_is_out', ['subject↔hero'], causeOf('far_beggar')),
      eq('non_human_is_out', ['subject.tags'], causeOf('beast_ka')),
      eq('no_health_is_out', ['subject.health', 'subject.health'], causeOf('ghost_child'), '체력이 없는 인간도 빠진다'),
      eq('wall_is_out_for_two_reasons', ['subject.tags', 'subject.health', 'subject.health'], causeOf('stone_wall')),
      eq('plan_equals_full_scan', report?.matched, output.queries[0]?.fullScan),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => {
    const report = output.queries[0]?.report;
    return [
      `후보 ${report?.plan.scanned}/${report?.plan.total} — ${report?.plan.reason}`,
      `뽑힘: ${report?.matched.join(', ')}`,
      '떨어진 후보마다 어느 조건이 왜 어긋났는지가 남는다 — “왜 이 NPC 는 대상이 아닌가”를 화면에서 짚을 수 있다.',
    ];
  },
});

// ---------------------------------------------------------------------------
// 2. 실패 원인이 어긴 조건을 지목한다
// ---------------------------------------------------------------------------
const failureCausePointsAtTheFailingCondition = defineScene({
  id: 'failure_cause_points_at_the_failing_condition',
  title: '거짓의 원인은 접속사가 아니라 어긴 잎 조건을 지목한다',
  seed: 202n,
  arrange: () => ({
    world,
    checks: [
      {
        id: 'guard_is_weak_and_near',
        predicate: WEAK_HUMANS_NEARBY.where,
        bindings: { subject: 'strong_guard', hero: 'hero' },
      },
      {
        id: 'beggar_is_weak_and_near',
        predicate: WEAK_HUMANS_NEARBY.where,
        bindings: { subject: 'far_beggar', hero: 'hero' },
      },
      {
        id: 'scout_is_weak_and_near',
        predicate: WEAK_HUMANS_NEARBY.where,
        bindings: { subject: 'wounded_scout', hero: 'hero' },
      },
      {
        id: 'guard_is_not_a_beast',
        predicate: { op: 'not', item: { op: 'has_tag', target: 'subject', tag: 'guard' } },
        bindings: { subject: 'strong_guard' },
      },
    ],
  }),
  check: (_input, output) => {
    const check = (id: string): K1Output['checks'][number] | undefined =>
      output.checks.find((entry) => entry.id === id);

    return [
      eq('guard_fails_on_health', false, check('guard_is_weak_and_near')?.passed),
      eq(
        'guard_cause_is_health_not_and',
        ['subject.health.current', 'subject.health.current'],
        check('guard_is_weak_and_near')?.causes.map((cause) => cause.at),
        '`and` 가 거짓이라는 말에는 정보가 없다',
      ),
      eq('beggar_fails_on_distance', ['subject↔hero'], check('beggar_is_weak_and_near')?.causes.map((cause) => cause.at)),
      eq('scout_passes_with_no_cause', [true, 0], [check('scout_is_weak_and_near')?.passed, check('scout_is_weak_and_near')?.causes.length]),
      eq(
        'not_reports_the_inner_condition',
        ['subject.tags'],
        check('guard_is_not_a_beast')?.causes.map((cause) => cause.at),
        '`not` 은 참이 된 안쪽 조건을 지목한다',
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.checks
      .map((check) => `${check.id}: ${check.passed ? '참' : check.causes.map((cause) => `${cause.at} — ${cause.reason}`).join(' · ')}`)
      .join('\n'),
    '원인은 어긴 잎까지 내려간다. `or` 는 모든 항목이 거짓이므로 전부가 원인이고, `not` 은 참이 된 안쪽 조건이 원인이다.',
  ],
  candidates: (_input, output) =>
    output.checks.map((check) => ({
      label: `${check.passed ? '○' : '×'} ${check.id}`,
      value: check.causes.map((cause) => `${cause.at}: ${cause.reason}`).join(' · ') || '원인 없음 (참)',
    })),
  result: (output) => output.checks.map((check) => `${check.id}=${check.passed}`).join(' / '),
});

// ---------------------------------------------------------------------------
// 3. 계획은 성능만 바꾸고 답을 바꾸지 않는다
// ---------------------------------------------------------------------------
const planUsesIndexAndAgreesWithFullScan = defineScene({
  id: 'plan_uses_index_and_agrees_with_full_scan',
  title: '인덱스로 후보를 좁혀도 전수 조회와 답이 같다',
  seed: 203n,
  arrange: () => ({
    world,
    queries: [
      { id: 'by_kind', spec: { ...WEAK_HUMANS_NEARBY, from: { kind: 'person' } } },
      {
        id: 'by_component',
        spec: {
          as: 'subject',
          from: { withComponent: 'faction' },
          where: { op: 'eq', path: 'subject.kind', value: 'person' },
        },
      },
      {
        id: 'full_scan',
        spec: {
          as: 'subject',
          where: { op: 'has_tag', target: 'subject', tag: 'human' },
        },
      },
      {
        id: 'kind_hint_from_where',
        spec: {
          as: 'subject',
          where: {
            op: 'and',
            items: [
              { op: 'eq', path: 'subject.kind', value: 'giant_beast' },
              { op: 'lt', path: 'subject.health.current', value: 100 },
            ],
          },
        },
      },
    ],
  }),
  check: (_input, output) => {
    const report = (id: string): K1Output['queries'][number] | undefined =>
      output.queries.find((query) => query.id === id);

    return [
      eq('kind_plan', 'by_kind', report('by_kind')?.report?.plan.source),
      eq('kind_plan_narrows', [6, 8], [report('by_kind')?.report?.plan.scanned, report('by_kind')?.report?.plan.total]),
      eq('component_plan', 'by_component', report('by_component')?.report?.plan.source),
      eq('component_plan_finds_nothing', [], report('by_component')?.report?.matched, 'faction 컴포넌트를 가진 실체가 없다'),
      eq('tag_only_query_scans_everything', 'full_scan', report('full_scan')?.report?.plan.source),
      eq(
        'tag_only_query_is_still_right',
        ['dying_healer', 'far_beggar', 'ghost_child', 'hero', 'strong_guard', 'wounded_scout'],
        report('full_scan')?.report?.matched,
      ),
      eq('where_gives_the_hint', 'by_kind', report('kind_hint_from_where')?.report?.plan.source),
      eq('hint_query_result', ['beast_ka'], report('kind_hint_from_where')?.report?.matched),
      ok(
        'every_plan_equals_full_scan',
        output.queries.every((query) => JSON.stringify(query.report?.matched) === JSON.stringify(query.fullScan)),
        '계획 = 전수',
        output.queries.map((query) => [query.id, query.report?.matched, query.fullScan]),
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.queries
      .map((query) => `${query.id}: ${query.report?.plan.source} (${query.report?.plan.scanned}/${query.report?.plan.total}) — ${query.report?.plan.reason}`)
      .join('\n'),
    '계획기는 최상위 `and` 사슬에 직접 놓인 조건에서만 힌트를 뽑는다. `or`·`not` 안쪽으로 좁히면 답이 달라진다.',
  ],
  candidates: (_input, output) =>
    output.queries.map((query) => ({
      label: query.id,
      value: `계획 ${query.report?.plan.source} · 훑음 ${query.report?.plan.scanned}/${query.report?.plan.total} · 답 [${query.report?.matched.join(', ')}] · 전수 [${query.fullScan?.join(', ')}]`,
    })),
});

// ---------------------------------------------------------------------------
// 4. 불 대수 — 그리고 `not(gt)` 의 함정
// ---------------------------------------------------------------------------
const booleanAlgebraHolds = defineScene({
  id: 'boolean_algebra_holds',
  title: '드모르간이 성립하고, `not(gt)` 로 적은 “50 이하”가 체력 없는 것을 삼킨다',
  seed: 204n,
  arrange: () => ({
    world,
    queries: [
      { id: 'correct_at_most_50', spec: WEAK_HUMANS_NEARBY },
      {
        id: 'naive_not_gt_50',
        spec: {
          ...WEAK_HUMANS_NEARBY,
          where: {
            op: 'and',
            items: [
              { op: 'has_tag', target: 'subject', tag: 'human' },
              { op: 'not', item: { op: 'gt', path: 'subject.health.current', value: 50 } },
              { op: 'within_distance', a: 'subject', b: 'hero', max: 10 },
            ],
          },
        },
      },
    ],
  }),
  check: (input, output) => {
    const store = buildWorld(input.world);
    const bindings = { subject: 'strong_guard', hero: 'hero' };
    const a: PredicateSpec = { op: 'has_tag', target: 'subject', tag: 'human' };
    const b: PredicateSpec = { op: 'gt', path: 'subject.health.current', value: 50 };
    const value = (predicate: PredicateSpec): boolean => evaluate(store, predicate, bindings).passed;

    const correct = output.queries.find((query) => query.id === 'correct_at_most_50')?.report?.matched ?? [];
    const naive = output.queries.find((query) => query.id === 'naive_not_gt_50')?.report?.matched ?? [];

    return [
      eq(
        'de_morgan_not_and',
        value({ op: 'not', item: { op: 'and', items: [a, b] } }),
        value({ op: 'or', items: [{ op: 'not', item: a }, { op: 'not', item: b }] }),
        '¬(A∧B) = ¬A∨¬B',
      ),
      eq(
        'de_morgan_not_or',
        value({ op: 'not', item: { op: 'or', items: [a, b] } }),
        value({ op: 'and', items: [{ op: 'not', item: a }, { op: 'not', item: b }] }),
        '¬(A∨B) = ¬A∧¬B',
      ),
      eq('double_negation', value(a), value({ op: 'not', item: { op: 'not', item: a } })),
      eq('and_is_commutative', value({ op: 'and', items: [a, b] }), value({ op: 'and', items: [b, a] })),
      eq('correct_form_result', ['dying_healer', 'wounded_scout'], correct),
      eq('naive_form_swallows_the_missing', ['dying_healer', 'ghost_child', 'wounded_scout'], naive, '체력이 없는 ghost_child 가 새어 든다'),
      ok('the_two_forms_differ', JSON.stringify(correct) !== JSON.stringify(naive), '다르다', [correct, naive]),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, _output) => [
    '원문 「9」의 `PredicateSpec` 에는 `lte` 가 없다. “50 이하”를 `not(gt(50))` 으로 적고 싶어지지만, 없는 값은 `gt` 를 만족하지 못하므로 `not` 이 참이 된다 — 체력이라는 것이 없는 실체가 “약한 인간”으로 뽑힌다.',
    '`or[lt(50), eq(50)]` 로 적으면 없는 값은 두 항목 모두 거짓이라 새지 않는다. 연산자를 늘리는 대신 조건을 정확히 적었다 (원문 「23」 상위 계약 변경 금지).',
  ],
  candidates: (_input, output) =>
    output.queries.map((query) => ({
      label: query.id,
      value: `[${query.report?.matched.join(', ')}]`,
    })),
});

// ---------------------------------------------------------------------------
// 5. 오타는 거짓이 아니라 거부다
// ---------------------------------------------------------------------------
const unknownComponentIsRejected = defineScene({
  id: 'unknown_component_is_rejected',
  title: '선언되지 않은 컴포넌트·결합·경로는 거짓이 아니라 거부된다',
  seed: 205n,
  arrange: () => ({
    world,
    checks: [
      { id: 'typo_in_component', predicate: { op: 'gt', path: 'subject.healt.current', value: 50 }, bindings: { subject: 'hero' } },
      { id: 'unknown_binding', predicate: { op: 'has_tag', target: 'villain', tag: 'human' }, bindings: { subject: 'hero' } },
      { id: 'bad_path_shape', predicate: { op: 'eq', path: 'Subject.Health', value: 1 }, bindings: { subject: 'hero' } },
      { id: 'empty_and', predicate: { op: 'and', items: [] }, bindings: { subject: 'hero' } },
      {
        id: 'typo_hidden_under_not',
        predicate: { op: 'not', item: { op: 'gt', path: 'subject.healt.current', value: 50 } },
        bindings: { subject: 'hero' },
      },
    ],
  }),
  check: (_input, output) => {
    const check = (id: string): K1Output['checks'][number] | undefined =>
      output.checks.find((entry) => entry.id === id);

    return [
      eq('typo_is_rejected', 'E_UNKNOWN_COMPONENT', check('typo_in_component')?.rejection?.code),
      eq('typo_points_at_the_spec', 'checks/typo_in_component/path', check('typo_in_component')?.rejection?.path),
      eq('unknown_binding_is_rejected', 'E_UNKNOWN_BINDING', check('unknown_binding')?.rejection?.code),
      eq('bad_path_is_rejected', 'E_BAD_PATH', check('bad_path_shape')?.rejection?.code),
      eq('empty_and_is_rejected', 'E_BAD_PREDICATE', check('empty_and')?.rejection?.code, '빈 목록은 조용히 참이 되어 조건을 무력화한다'),
      eq(
        'typo_under_not_is_still_rejected',
        'E_UNKNOWN_COMPONENT',
        check('typo_hidden_under_not')?.rejection?.code,
        '거짓으로 처리했다면 not 이 뒤집어 참이 되었을 것이다',
      ),
      ok(
        'no_rejected_check_claims_to_pass',
        output.checks.filter((entry) => entry.rejection !== null).every((entry) => entry.passed === false),
        '거부된 조건은 참을 주장하지 않는다',
        output.checks.map((entry) => [entry.id, entry.passed]),
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.checks.map((check) => `${check.id}: ${check.rejection?.code} @ ${check.rejection?.path}`).join('\n'),
    '“healt” 는 세계에 대한 진술이 아니라 명세의 오타다. 거짓으로 처리하면 `not(...)` 안에서 **참**이 되어 조용히 통과하는 조건이 생긴다.',
  ],
  candidates: (_input, output) =>
    output.checks.map((check) => ({
      label: check.id,
      value: check.rejection ? `거부 ${check.rejection.code} @ ${check.rejection.path}` : `판정 ${check.passed}`,
    })),
  result: (output) => output.checks.map((check) => `${check.id}=${check.rejection?.code ?? check.passed}`).join(' / '),
});

// ---------------------------------------------------------------------------
// 6. 없는 값은 거짓이되 원인이 남는다
// ---------------------------------------------------------------------------
const missingValueIsFalseWithCause = defineScene({
  id: 'missing_value_is_false_with_cause',
  title: '세계에 그 값이 없으면 거짓이되, 왜 없는지가 원인으로 남는다',
  seed: 206n,
  arrange: () => ({
    world,
    checks: [
      { id: 'wall_health', predicate: { op: 'gt', path: 'subject.health.current', value: 0 }, bindings: { subject: 'stone_wall' } },
      { id: 'wall_position_distance', predicate: { op: 'within_distance', a: 'subject', b: 'nowhere', max: 5 }, bindings: { subject: 'stone_wall', nowhere: 'no_such_entity' } },
      { id: 'missing_field', predicate: { op: 'eq', path: 'subject.health.stamina', value: 1 }, bindings: { subject: 'hero' } },
      { id: 'not_comparable', predicate: { op: 'gt', path: 'subject.kind', value: 1 }, bindings: { subject: 'hero' } },
    ],
  }),
  check: (_input, output) => {
    const check = (id: string): K1Output['checks'][number] | undefined =>
      output.checks.find((entry) => entry.id === id);

    return [
      eq('all_false', [false, false, false, false], output.checks.map((entry) => entry.passed)),
      eq('none_rejected', [null, null, null, null], output.checks.map((entry) => entry.rejection)),
      eq('missing_component_is_named', 'subject.health', check('wall_health')?.causes[0]?.at),
      ok(
        'missing_component_reason_names_the_entity',
        check('wall_health')?.causes[0]?.reason.includes('stone_wall') === true,
        'stone_wall 을 지목한다',
        check('wall_health')?.causes[0]?.reason,
      ),
      ok(
        'missing_entity_is_named',
        check('wall_position_distance')?.causes[0]?.reason.includes('no_such_entity') === true,
        'no_such_entity 를 지목한다',
        check('wall_position_distance')?.causes[0]?.reason,
      ),
      eq('missing_field_is_named', 'subject.health.stamina', check('missing_field')?.causes[0]?.at),
      ok(
        'non_number_is_named_not_comparable',
        check('not_comparable')?.causes[0]?.reason.includes('E_NOT_COMPARABLE') === true,
        'E_NOT_COMPARABLE',
        check('not_comparable')?.causes[0]?.reason,
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.checks.map((check) => `${check.id}: ${check.causes.map((cause) => `${cause.at} — ${cause.reason}`).join(' · ')}`).join('\n'),
    '없는 컴포넌트·없는 실체·없는 필드는 모두 세계의 사실이다. 거짓이 맞지만, 왜 거짓인지 남기지 않으면 “아무도 조건에 맞지 않는다”가 버그인지 사실인지 알 수 없다.',
  ],
  candidates: (_input, output) =>
    output.checks.map((check) => ({
      label: check.id,
      value: check.causes.map((cause) => `${cause.at}: ${cause.reason}`).join(' · '),
    })),
  result: (output) =>
    output.checks.map((check) => `${check.id}=${check.passed} (${check.causes[0]?.at ?? '-'})`).join(' / '),
});

// ---------------------------------------------------------------------------
// 7. 질의는 세계를 바꾸지 않는다
// ---------------------------------------------------------------------------
const queryLeavesTheWorldUntouched = defineScene({
  id: 'query_leaves_the_world_untouched',
  title: '질의를 아무리 돌려도 세계 해시가 그대로다',
  seed: 207n,
  arrange: () => ({
    world,
    queries: [
      { id: 'weak_humans_nearby', spec: WEAK_HUMANS_NEARBY },
      { id: 'everyone', spec: { as: 'subject', where: { op: 'not', item: { op: 'has_tag', target: 'subject', tag: 'nonexistent_tag' } } } },
    ],
  }),
  check: (input, output) => {
    const store = buildWorld(input.world);
    const before = store.hash();
    for (let round = 0; round < 20; round += 1) {
      runQuery(store, WEAK_HUMANS_NEARBY);
      runQueryByFullScan(store, WEAK_HUMANS_NEARBY);
    }

    const first = runQuery(store, WEAK_HUMANS_NEARBY);
    const second = runQuery(store, WEAK_HUMANS_NEARBY);

    return [
      eq('world_hash_unchanged_in_output', output.worldHashBefore, output.worldHashAfter),
      eq('world_hash_unchanged_after_20_runs', before, store.hash()),
      eq('same_query_same_digest', first.digest, second.digest, 'GI-12 — 같은 세계·같은 질의면 같은 결과'),
      eq('rerun_output_is_identical', executeK1(input).digest, output.digest),
      eq('everyone_matches_all', 8, output.queries[1]?.report?.matched.length),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `질의 전 ${output.worldHashBefore}`,
    `질의 후 ${output.worldHashAfter}`,
    '질의는 K0 의 읽기만 부른다. K0 의 읽기는 동결 사본이므로 질의가 세계를 잡을 손잡이가 없다.',
  ],
});

export const k1Scenarios: VerificationScenario<K1Input, K1Output>[] = [
  weakHumansWithinTenMeters,
  failureCausePointsAtTheFailingCondition,
  planUsesIndexAndAgreesWithFullScan,
  booleanAlgebraHolds,
  unknownComponentIsRejected,
  missingValueIsFalseWithCause,
  queryLeavesTheWorldUntouched,
];
