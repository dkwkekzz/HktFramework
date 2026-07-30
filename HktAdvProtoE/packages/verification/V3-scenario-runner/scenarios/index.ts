import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { canonicalJson } from '@hkt/v1-schema';
import { FixtureLoader } from '../src/fixture.js';
import { ScenarioRunner } from '../src/runner.js';
import { checkOutputConsistency, executeV3, V3_PURPOSE } from '../src/module.js';
import type { V3Input, V3Output } from '../src/module.js';
import { showValue } from '../src/json.js';
import type { JsonObject, ScenarioReport, ScenarioSpec } from '../src/types.js';
import { actionPair, BASE_SEED, brokenScene, hunterScene, SCENE_STATE_SCHEMA } from './fixtures.js';

// ---------------------------------------------------------------------------
// 장면 정의 도구
// ---------------------------------------------------------------------------

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): V3Input;
  check(input: V3Input, output: V3Output, context: ModuleContext): AssertionResult[];
  reasons(input: V3Input, output: V3Output): string[];
  /** 「후보」 구획 — 기본은 단계별 전후 표다. */
  candidates?(input: V3Input, output: V3Output): LabRow[];
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

/** 단계별 전후 표 — 원문 「8」이 V3 에 요구한 "전후 상태가 한 화면에" 의 기본 형태다. */
function transitionRows(report: ScenarioReport): LabRow[] {
  if (report.issues.length > 0) {
    return report.issues.map((issue) => ({
      label: `거부 ${issue.path}`,
      value: `${issue.code} · ${issue.message}`,
    }));
  }
  return report.transitions.map((transition) => ({
    label: `${transition.index}. ${transition.step} (t${transition.tick})`,
    value:
      (transition.error
        ? `오류 ${transition.error.code} · ${transition.error.message}`
        : transition.rejection
          ? `거부 ${transition.rejection.code} · ${transition.rejection.message} → 상태 변화 없음`
          : transition.changes
              .map((change) => `${change.path}: ${showValue(change.before)} → ${showValue(change.after)}`)
              .join(' · ') || '변화 없음'),
  }));
}

function summarize(state: JsonObject): string {
  return canonicalJson(state);
}

function defineScene(spec: SceneSpec): VerificationScenario<V3Input, V3Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeV3(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      const first = output.reports[0] as ScenarioReport | undefined;
      return {
        purpose: V3_PURPOSE,
        input: [
          {
            label: 'Given',
            value: input.scenarios
              .map((scenario) =>
                'fixture' in scenario.given
                  ? `${scenario.id} ← 픽스처 ${scenario.given.fixture}`
                  : `${scenario.id} ← 직접 상태`,
              )
              .join(' · '),
          },
          {
            label: 'When',
            value:
              (input.scenarios[0]?.when ?? [])
                .map((call, index) => `${index}.${call.step}`)
                .join(' → ') || '단계 없음',
          },
          {
            label: 'Then',
            value: (input.scenarios[0]?.then ?? [])
              .map((condition) => `${condition.path} ${condition.op} ${showValue(condition.value ?? null)}`)
              .join(' · '),
          },
          {
            label: '초기 상태',
            value: first ? summarize(first.given) : '없음',
          },
        ],
        candidates: spec.candidates?.(input, output) ?? (first ? transitionRows(first) : []),
        result: first
          ? `${first.scenarioId}: ${first.passed ? '통과' : '실패'} · digest ${first.digest.slice(0, 23)}…`
          : '보고 없음',
        reasons: spec.reasons(input, output),
        before: first ? summarize(first.given) : '없음',
        after: first ? summarize(first.final) : '없음',
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

const withScene = (scenarios: ScenarioSpec[]): V3Input => ({
  schemas: [SCENE_STATE_SCHEMA],
  fixtures: [hunterScene],
  scenarios,
});

const report = (output: V3Output, id: string): ScenarioReport =>
  output.reports.find((item) => item.scenarioId === id) as ScenarioReport;

// ---------------------------------------------------------------------------
// 1. Given → When → Then 이 선언 순서대로 돈다
// ---------------------------------------------------------------------------
const givenWhenThenRunsInOrder = defineScene({
  id: 'given_when_then_runs_in_order',
  title: 'Given-When-Then 이 선언 순서대로 실행되고 단계마다 전후가 남는다',
  seed: 31n,
  arrange: () =>
    withScene([
      {
        id: 'two_actions',
        title: '행동 두 번 — 에너지 10 에서 3씩 두 번 소비',
        given: { fixture: 'hunter_scene' },
        when: [...actionPair('첫 행동'), ...actionPair('둘째 행동')],
        then: [
          { id: 'energy_after_two_actions', path: '/actor/energy', op: 'equals', value: 4 },
          { id: 'log_has_two_entries', path: '/log', op: 'length', value: 2 },
          { id: 'posture_untouched', path: '/actor/posture', op: 'unchanged' },
        ],
        seed: { ...BASE_SEED },
      },
    ]),
  check: (_input, output) => {
    const run = report(output, 'two_actions');
    return [
      eq('steps_run_in_declared_order', ['consume', 'record_event', 'consume', 'record_event'], run.transitions.map((t) => t.step)),
      eq('indices_are_contiguous', [0, 1, 2, 3], run.transitions.map((t) => t.index)),
      eq('clock_advances_one_tick_per_step', [0, 1, 2, 3], run.transitions.map((t) => t.tick), '시각은 V2 TickClock 에서만 나온다'),
      eq('every_condition_passed', [true, true, true], run.conditions.map((c) => c.passed)),
      eq('final_energy', 4, (run.final['actor'] as JsonObject)['energy']),
      eq('report_passed', true, run.passed),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => {
    const run = report(output, 'two_actions');
    return [
      `단계 ${run.transitions.length}개가 선언 순서대로 돌았고, 단계마다 before/after 를 통째로 남겼다.`,
      `사건 id 는 V2 IdFactory 가 발급했다: ${((run.final['log'] as JsonObject[]) ?? []).map((entry) => String(entry['id'])).join(', ')}`,
    ];
  },
});

// ---------------------------------------------------------------------------
// 2. 대표 검증 — 실패한 조건의 전후 상태가 한 화면에 (원문 「8」 V3)
// ---------------------------------------------------------------------------
const failedConditionShowsBeforeAndAfter = defineScene({
  id: 'failed_condition_shows_before_and_after',
  title: '실패한 조건이 전후 값과 그 값을 바꾼 단계를 함께 보고한다',
  seed: 32n,
  arrange: () =>
    withScene([
      {
        id: 'wrong_expectation',
        title: '에너지가 그대로 10 일 것이라는 (틀린) 기대',
        given: { fixture: 'hunter_scene' },
        when: [...actionPair('첫 행동'), ...actionPair('둘째 행동')],
        then: [
          {
            id: 'energy_must_be_10',
            path: '/actor/energy',
            op: 'equals',
            value: 10,
            reason: '일부러 틀린 기대 — 실패 보고가 무엇을 보여 주는지 확인한다',
          },
          { id: 'log_has_two_entries', path: '/log', op: 'length', value: 2 },
        ],
        seed: { ...BASE_SEED },
      },
    ]),
  check: (_input, output) => {
    const run = report(output, 'wrong_expectation');
    const failed = run.conditions.find((condition) => condition.id === 'energy_must_be_10');
    const passedOne = run.conditions.find((condition) => condition.id === 'log_has_two_entries');
    const blamed = failed?.blame ? run.transitions[failed.blame.index] : undefined;

    return [
      ok('condition_failed', failed?.passed === false, false, failed?.passed),
      eq('before_value_is_from_given', 10, failed?.before, '전 — Given 시점 값'),
      eq('after_value_is_from_final', 4, failed?.after, '후 — 평가 시점 값'),
      eq('blame_points_at_last_step_that_changed_it', { index: 2, step: 'consume' }, failed?.blame, '이 값을 마지막으로 바꾼 단계'),
      eq('blamed_transition_shows_its_own_before_after', [7, 4], [
        ((blamed?.before['actor'] as JsonObject) ?? {})['energy'],
        ((blamed?.after['actor'] as JsonObject) ?? {})['energy'],
      ]),
      ok('other_conditions_are_still_judged', passedOne?.passed === true, true, passedOne?.passed, '하나가 실패해도 나머지를 판정한다'),
      eq('report_is_not_passed', false, run.passed),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => {
    const run = report(output, 'wrong_expectation');
    const failed = run.conditions.find((condition) => condition.id === 'energy_must_be_10');
    return [
      `${failed?.path} 는 ${showValue(failed?.before ?? null)} 에서 ${showValue(failed?.after ?? null)} 로 바뀌었고, 기대값은 ${showValue(failed?.expected ?? null)} 였다.`,
      `마지막으로 이 값을 바꾼 단계는 ${failed?.blame?.index}번 \`${failed?.blame?.step}\` 이다 — 실패를 어디서부터 봐야 하는지가 보고에 들어 있다.`,
      '조건은 경로·연산자·값 세 조각의 데이터일 뿐이다. 표현식이나 함수를 두지 않는다 (원문 「23」).',
    ];
  },
  candidates: (_input, output) => {
    const run = report(output, 'wrong_expectation');
    return run.conditions.map((condition) => ({
      label: `${condition.passed ? '✓' : '✗'} ${condition.id}`,
      value:
        `${condition.path} ${condition.op} ${showValue(condition.expected)} · ` +
        `전 ${showValue(condition.before)} → 후 ${showValue(condition.after)} · ` +
        `원인 ${condition.blame ? `${condition.blame.index}번 ${condition.blame.step}` : '바꾼 단계 없음'}`,
    }));
  },
});

// ---------------------------------------------------------------------------
// 3. 픽스처는 실행 전에 검증된다
// ---------------------------------------------------------------------------
const fixtureIsValidatedBeforeRun = defineScene({
  id: 'fixture_is_validated_before_run',
  title: '스키마를 어긴 픽스처는 적재 단계에서 경로와 함께 거부된다',
  seed: 33n,
  arrange: () => ({
    schemas: [SCENE_STATE_SCHEMA],
    fixtures: [hunterScene, brokenScene],
    scenarios: [
      {
        id: 'uses_broken_fixture',
        title: '거부된 픽스처를 가리키는 시나리오',
        given: { fixture: 'broken_scene' },
        when: [{ step: 'consume', params: { path: '/actor/energy', amount: 3 } }],
        then: [{ id: 'never_evaluated', path: '/actor/energy', op: 'equals', value: 7 }],
        seed: { ...BASE_SEED },
      },
      {
        id: 'uses_good_fixture',
        title: '멀쩡한 픽스처를 쓰는 시나리오는 그대로 판정된다',
        given: { fixture: 'hunter_scene' },
        when: [{ step: 'consume', params: { path: '/actor/energy', amount: 3 } }],
        then: [{ id: 'energy_is_7', path: '/actor/energy', op: 'equals', value: 7 }],
        seed: { ...BASE_SEED },
      },
    ],
  }),
  check: (_input, output) => {
    const broken = report(output, 'uses_broken_fixture');
    const good = report(output, 'uses_good_fixture');
    return [
      eq(
        'fixture_rejected_with_pointer_path',
        ['/fixtures/broken_scene/state/actor/energy'],
        output.fixtureIssues.map((issue) => issue.path),
        '어디가 잘못됐는지를 경로로 지목한다',
      ),
      eq('fixture_rejection_code', ['E_TYPE'], output.fixtureIssues.map((issue) => issue.code)),
      eq('dependent_scenario_is_rejected', ['E_UNKNOWN_FIXTURE'], broken.issues.map((issue) => issue.code)),
      eq('rejected_scenario_runs_no_step', 0, broken.transitions.length, '잘못된 초기 상태로는 한 단계도 굴리지 않는다'),
      eq('other_scenario_is_unaffected', true, good.passed, '나머지 장면의 판정을 잃지 않는다'),
      eq('whole_run_is_not_passed', false, output.passed),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.fixtureIssues.map((issue) => `${issue.path} · ${issue.code} · ${issue.message}`).join('\n') ||
      '거부 없음',
    '픽스처 검증은 V1 이 한다 — V3 는 자기 몫(실행)만 하고, 형식 강제는 선행 모듈에 맡긴다.',
  ],
  candidates: (_input, output) =>
    output.reports.map((run) => ({
      label: run.scenarioId,
      value:
        run.issues.length > 0
          ? `거부 ${run.issues.map((issue) => `${issue.path} ${issue.code}`).join(', ')} · 단계 ${run.transitions.length}개 실행`
          : `실행 ${run.transitions.length}단계 · ${run.passed ? '통과' : '실패'}`,
    })),
});

// ---------------------------------------------------------------------------
// 4. 단계는 Given 상태를 바꾸지 못한다
// ---------------------------------------------------------------------------
const stepMustNotMutateGivenState = defineScene({
  id: 'step_must_not_mutate_given_state',
  title: '단계는 받은 상태를 직접 고칠 수 없다 (전후 비교가 거짓이 되지 않게)',
  seed: 34n,
  arrange: () =>
    withScene([
      {
        id: 'given_is_immutable',
        title: '두 번 행동해도 Given 시점 상태는 그대로다',
        given: { fixture: 'hunter_scene' },
        when: [...actionPair('첫 행동'), ...actionPair('둘째 행동')],
        then: [
          { id: 'given_energy_is_still_10', path: '/actor/energy', op: 'equals', value: 10, at: 'given' },
          { id: 'final_energy_is_4', path: '/actor/energy', op: 'equals', value: 4, at: 'final' },
        ],
        seed: { ...BASE_SEED },
      },
    ]),
  check: (_input, output) => {
    const run = report(output, 'given_is_immutable');

    // 상태를 직접 고치려는 단계를 실제로 등록해 본다 — 동결이 실효인지 확인한다.
    const loader = new FixtureLoader().addSchema(SCENE_STATE_SCHEMA).add(hunterScene);
    const rogueRunner = new ScenarioRunner({ fixtures: loader });
    rogueRunner.register({
      id: 'mutate_in_place',
      title: '받은 상태를 직접 고치려 든다',
      apply: (state) => {
        (state['actor'] as JsonObject)['energy'] = 0;
        return state;
      },
    });
    const rogue = rogueRunner.run({
      id: 'rogue',
      title: '상태를 직접 고치는 단계',
      given: { fixture: 'hunter_scene' },
      when: [{ step: 'mutate_in_place' }],
      then: [{ id: 'energy_untouched', path: '/actor/energy', op: 'equals', value: 10 }],
      seed: { ...BASE_SEED },
    });

    return [
      eq('given_snapshot_is_intact', 10, (run.given['actor'] as JsonObject)['energy']),
      eq('final_differs_from_given', 4, (run.final['actor'] as JsonObject)['energy']),
      ok('given_is_deeply_frozen', Object.isFrozen(run.given['actor']), true, Object.isFrozen(run.given['actor'])),
      ok('direct_mutation_throws', throws(() => {
        (run.given['actor'] as JsonObject)['energy'] = 0;
      }), 'TypeError', '동결된 상태는 조용히 바뀌지 않는다'),
      eq('rogue_step_is_reported_as_error', 'E_STEP_FAILED', rogue.transitions[0]?.error?.code),
      eq('rogue_run_stops_at_that_step', 0, rogue.stoppedAt),
      eq('rogue_state_unchanged', 10, (rogue.final['actor'] as JsonObject)['energy']),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: () => [
    'Given 상태와 단계마다의 before/after 는 모두 깊게 동결된다. 단계는 새 상태를 돌려주는 방식으로만 세계를 바꾼다.',
    '직접 고치는 단계는 조용히 통과하지 않고 그 자리에서 오류로 드러나 시나리오가 멈춘다 — 거부(규칙)와 오류(버그)를 구분한다.',
  ],
});

// ---------------------------------------------------------------------------
// 5. 모르는 단계·잘못된 params·잘못된 조건은 실행 전에 거부된다
// ---------------------------------------------------------------------------
const unknownStepIsRejectedWithPath = defineScene({
  id: 'unknown_step_is_rejected_with_path',
  title: '모르는 단계·잘못된 params·잘못된 조건은 한 단계도 굴리기 전에 거부된다',
  seed: 35n,
  arrange: () =>
    withScene([
      {
        id: 'bad_spec',
        title: '세 군데가 잘못된 명세',
        given: { fixture: 'hunter_scene' },
        when: [
          { step: 'teleport', params: { to: 'nowhere' } },
          { step: 'consume', params: { path: '/actor/energy', amount: -1 } },
        ],
        then: [{ id: 'unreachable', path: 'actor/energy', op: 'equals', value: 7 }],
        seed: { ...BASE_SEED },
      },
    ]),
  check: (_input, output) => {
    const run = report(output, 'bad_spec');
    const byPath = Object.fromEntries(run.issues.map((issue) => [issue.path, issue.code]));
    return [
      eq('unknown_step_points_at_when_index', 'E_UNKNOWN_STEP', byPath['/when/0/step']),
      eq('bad_params_point_at_the_field', 'E_EXCLUSIVE_MINIMUM', byPath['/when/1/params/amount'], 'params 검사는 V1 스키마가 한다'),
      eq('bad_condition_path_points_at_then_index', 'E_CONDITION_PATH', byPath['/then/0/path']),
      eq('nothing_was_executed', 0, run.transitions.length),
      eq('no_condition_was_judged', 0, run.conditions.length),
      eq('report_is_not_passed', false, run.passed),
      eq('issues_are_sorted_by_path', [...run.issues.map((issue) => issue.path)].sort(), run.issues.map((issue) => issue.path), '같은 명세면 같은 순서로 보고한다'),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    report(output, 'bad_spec')
      .issues.map((issue) => `${issue.path} · ${issue.code} · ${issue.message}`)
      .join('\n'),
    '절반쯤 굴러간 상태에서 나온 판정은 아무것도 증명하지 못한다. 그래서 거부는 실행 전에 한다.',
  ],
});

// ---------------------------------------------------------------------------
// 6. 거부된 단계는 상태를 전혀 바꾸지 않는다 (VS0 의 네 번째 행동)
// ---------------------------------------------------------------------------
const rejectedStepLeavesStateUnchanged = defineScene({
  id: 'rejected_step_leaves_state_unchanged',
  title: '자원이 모자란 행동은 거부되고 상태를 전혀 바꾸지 않는다',
  seed: 36n,
  arrange: () =>
    withScene([
      {
        id: 'four_actions_on_ten_energy',
        title: '에너지 10 · 행동마다 3 소비 · 네 번째는 실패 (원문 「20」 VS0 의 장면 형태)',
        given: { fixture: 'hunter_scene' },
        when: [
          { step: 'consume', params: { path: '/actor/energy', amount: 3 }, note: '첫 행동' },
          { step: 'consume', params: { path: '/actor/energy', amount: 3 }, note: '둘째 행동' },
          { step: 'consume', params: { path: '/actor/energy', amount: 3 }, note: '셋째 행동' },
          { step: 'consume', params: { path: '/actor/energy', amount: 3 }, note: '넷째 행동 — 에너지 1 뿐' },
        ],
        then: [
          { id: 'energy_result_is_1', path: '/actor/energy', op: 'equals', value: 1 },
          { id: 'energy_never_goes_negative', path: '/actor/energy', op: 'atLeast', value: 0 },
          { id: 'fourth_step_changed_nothing', path: '/actor/energy', op: 'equals', value: 1, at: 3 },
        ],
        seed: { ...BASE_SEED },
      },
    ]),
  check: (_input, output) => {
    const run = report(output, 'four_actions_on_ten_energy');
    const fourth = run.transitions[3];
    return [
      eq('energy_timeline', [7, 4, 1, 1], run.transitions.map((t) => (t.after['actor'] as JsonObject)['energy'])),
      eq('fourth_step_is_rejected', 'E_INSUFFICIENT', fourth?.rejection?.code),
      eq('rejection_points_at_the_resource', '/actor/energy', fourth?.rejection?.path),
      eq('fourth_step_changes_nothing', [], fourth?.changes),
      eq('before_equals_after_on_rejection', canonicalJson(fourth?.before), canonicalJson(fourth?.after)),
      eq('all_conditions_passed', [true, true, true], run.conditions.map((c) => c.passed)),
      eq('report_passed', true, run.passed, '거부는 세계의 정상적인 결과다 — 시나리오 실패가 아니다'),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => {
    const run = report(output, 'four_actions_on_ten_energy');
    return [
      `에너지 10 → ${run.transitions.map((t) => (t.after['actor'] as JsonObject)['energy']).join(' → ')} · 네 번째는 거부되어 그대로다.`,
      'VS0(원문 「20」)의 완료 조건 중 "에너지 결과가 1이다 / 네 번째 행동은 상태를 전혀 변경하지 않는다"의 **형태**를 실행기가 돌릴 수 있는지 확인한 것이다. VS0 자체는 K0~K3 의 세계 규칙으로 다시 통과시켜야 한다.',
    ];
  },
});

// ---------------------------------------------------------------------------
// 7. 같은 시드면 같은 보고가 나온다
// ---------------------------------------------------------------------------
const sameSeedReplaysIdentically = defineScene({
  id: 'same_seed_replays_identically',
  title: '같은 시드·같은 명세를 100회 다시 굴려도 보고가 같다',
  seed: 37n,
  arrange: () =>
    withScene([
      {
        id: 'rolls_and_records',
        title: '결정적 난수를 굴리고 사건을 기록한다',
        given: { fixture: 'hunter_scene' },
        when: [
          { step: 'roll', params: { path: '/actor/energy', min: 0, max: 100 } },
          { step: 'record_event', params: { path: '/log', kind: 'rolled', detail: null } },
          { step: 'roll', params: { path: '/actor/energy', min: 0, max: 100 } },
        ],
        then: [{ id: 'energy_is_present', path: '/actor/energy', op: 'present' }],
        seed: { ...BASE_SEED },
      },
    ]),
  check: (input, output) => {
    const digests = new Set<string>();
    for (let run = 0; run < 100; run += 1) digests.add(executeV3(input).digest);

    const spec = input.scenarios[0] as ScenarioSpec;
    const otherSubject = executeV3({
      ...input,
      scenarios: [{ ...spec, seed: { ...BASE_SEED, subjectId: 'npc_hunter_02' } }],
    });
    const run = report(output, 'rolls_and_records');

    return [
      eq('unique_digests_over_100_runs', 1, digests.size, '리플레이 불일치 금지 (GI-12)'),
      eq('digest_matches_first_run', output.digest, [...digests][0]),
      ok('different_subject_diverges', otherSubject.digest !== output.digest, '다른 digest', otherSubject.digest.slice(7, 15)),
      eq('event_ids_are_deterministic', ['rolled_'], ((run.final['log'] as JsonObject[]) ?? []).map((entry) => String(entry['id']).slice(0, 7))),
      ok(
        'rolls_are_in_range',
        run.transitions
          .filter((transition) => transition.step === 'roll')
          .every((transition) => {
            const value = (transition.after['actor'] as JsonObject)['energy'];
            return typeof value === 'number' && value >= 0 && value < 100;
          }),
        '[0,100)',
        run.transitions.filter((t) => t.step === 'roll').map((t) => (t.after['actor'] as JsonObject)['energy']),
      ),
      eq('output_invariants', [], checkOutputConsistency(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => {
    const run = report(output, 'rolls_and_records');
    return [
      `100회 재실행에서 digest 가 하나였다: ${output.digest}`,
      `난수는 단계별 하위 스트림에서 나온다 (\`roll#0\` · \`roll#1\`) — 뒤에 단계를 덧붙여도 앞 단계의 값이 밀리지 않는다.`,
      `시각·id 는 V2 가 준다: ${run.transitions.map((t) => `t${t.tick}=${t.timeMs}ms`).join(', ')}`,
    ];
  },
});

function throws(action: () => unknown): boolean {
  try {
    action();
    return false;
  } catch {
    return true;
  }
}

export const v3Scenarios: VerificationScenario<V3Input, V3Output>[] = [
  givenWhenThenRunsInOrder,
  failedConditionShowsBeforeAndAfter,
  fixtureIsValidatedBeforeRun,
  stepMustNotMutateGivenState,
  unknownStepIsRejectedWithPath,
  rejectedStepLeavesStateUnchanged,
  sameSeedReplaysIdentically,
];
