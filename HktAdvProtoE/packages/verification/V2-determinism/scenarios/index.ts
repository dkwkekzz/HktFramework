import type {
  AssertionResult,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import { IdFactory } from '../src/id.js';
import { Rng } from '../src/rng.js';
import { TickClock } from '../src/clock.js';
import { deriveSeed, seedLabel } from '../src/seed.js';
import { executeV2, V2_PURPOSE, validateOutput } from '../src/module.js';
import type { V2Input, V2Output } from '../src/module.js';

interface LabRow {
  label: string;
  value: string;
}

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): V2Input;
  check(input: V2Input, output: V2Output, context: ModuleContext): AssertionResult[];
  /** Lab 「이유」 구획 — 이 장면이 무엇을 보여 주는지 */
  reasons(input: V2Input, output: V2Output): string[];
  /**
   * Lab 「후보」 구획을 장면에 맞게 바꾼다.
   * 기본은 뽑힌 자원 그대로지만, 비교가 핵심인 장면은 비교 대상을 표로 보여 준다.
   */
  candidates?(input: V2Input, output: V2Output): LabRow[];
}

function defineScene(spec: SceneSpec): VerificationScenario<V2Input, V2Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeV2(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      return {
        purpose: V2_PURPOSE,
        input: [
          { label: 'worldSeed', value: input.worldSeed },
          {
            label: '구성요소 (원문 29장)',
            value: `tick=${input.components?.tick ?? '-'} · subjectId=${
              input.components?.subjectId ?? '-'
            } · decisionCounter=${input.components?.decisionCounter ?? '-'} · situationId=${
              input.components?.situationId ?? '-'
            }`,
          },
          { label: '요청', value: `난수 ${input.draws} · id ${(input.idKinds ?? []).join(', ') || '없음'} · 틱 ${input.ticks ?? 0} · fork ${(input.forks ?? []).join(', ') || '없음'}` },
        ],
        candidates: spec.candidates?.(input, output) ?? [
          { label: '파생 시드', value: `0x${output.seed}` },
          { label: '난수 (앞 5개)', value: output.floats.slice(0, 5).map((value) => value.toFixed(6)).join(', ') || '없음' },
          { label: '정수 (앞 10개)', value: output.ints.slice(0, 10).join(', ') || '없음' },
          { label: 'ID', value: output.ids.join(', ') || '없음' },
          {
            label: '하위 스트림',
            value:
              output.forkSamples
                .map((sample) => `${sample.label}=0x${sample.seed}(${sample.firstFloat.toFixed(4)})`)
                .join(' · ') || '없음',
          },
          {
            label: '틱 → 시각',
            value:
              output.timeline.map((entry) => `${entry.tick}=${entry.timeMs}ms`).join(', ') || '없음',
          },
        ],
        result: output.digest,
        reasons: spec.reasons(input, output),
        before: `시드 구성 ${output.seedLabel}`,
        after: `난수 ${output.floats.length} · ID ${output.ids.length} · 틱 ${output.timeline.length} · digest ${output.digest.slice(0, 23)}…`,
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

const BASE_INPUT: V2Input = {
  worldSeed: '20260730',
  components: { tick: 12, subjectId: 'npc_hunter_01', decisionCounter: 3, situationId: 'sit_hunt' },
  draws: 8,
  idKinds: ['event', 'entity', 'event'],
  ticks: 4,
  forks: ['perception', 'deliberation'],
};

// ---------------------------------------------------------------------------
// 1. 같은 시드 100회 실행 → 같은 ID·난수열 (원문 「8」 V2 대표 검증)
// ---------------------------------------------------------------------------
const sameSeedRepeatsSequence = defineScene({
  id: 'same_seed_repeats_sequence',
  title: '같은 시드로 100회 실행해도 난수열·ID·틱이 모두 같다',
  seed: 21n,
  arrange: () => ({ ...BASE_INPUT }),
  check: (input, output) => {
    const digests = new Set<string>();
    for (let run = 0; run < 100; run += 1) digests.add(executeV2(input).digest);
    return [
      eq('unique_digests_over_100_runs', 1, digests.size, '리플레이 불일치 금지 (GI-12)'),
      eq('digest_matches_first_run', output.digest, [...digests][0]),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
      eq('draw_count', input.draws, output.floats.length),
    ];
  },
  reasons: (_input, output) => [
    `같은 입력을 100회 돌려 digest 가 하나였다: ${output.digest}`,
    'Math.random 을 쓰지 않으므로 실행 시각·순서와 무관하다 (원문 「23」).',
  ],
});

// ---------------------------------------------------------------------------
// 2. 구성요소 하나만 바뀌어도 열이 갈라진다
// ---------------------------------------------------------------------------
const differentSeedComponentDiverges = defineScene({
  id: 'different_seed_component_diverges',
  title: '구성요소를 하나만 바꿔도 시드와 난수열이 달라진다',
  seed: 22n,
  arrange: () => ({ ...BASE_INPUT }),
  check: (input, output) => {
    const variants = {
      worldSeed: executeV2({ ...input, worldSeed: '20260731' }),
      tick: executeV2({ ...input, components: { ...input.components, tick: 13 } }),
      subjectId: executeV2({ ...input, components: { ...input.components, subjectId: 'npc_hunter_02' } }),
      decisionCounter: executeV2({ ...input, components: { ...input.components, decisionCounter: 4 } }),
      situationId: executeV2({ ...input, components: { ...input.components, situationId: 'sit_flee' } }),
    };
    const changed = Object.entries(variants).filter(([, result]) => result.seed !== output.seed);
    const distinctSeeds = new Set([output.seed, ...Object.values(variants).map((v) => v.seed)]);

    return [
      eq('every_component_changes_seed', 5, changed.length, '원문 29장의 다섯 구성요소가 모두 시드에 들어간다'),
      eq('all_seeds_distinct', 6, distinctSeeds.size),
      ok(
        'sequences_differ',
        Object.values(variants).every((variant) => variant.digest !== output.digest),
        '모두 다른 digest',
        Object.values(variants).map((variant) => variant.digest.slice(7, 15)),
      ),
      ok(
        'ids_differ',
        Object.values(variants).every((variant) => variant.ids[0] !== output.ids[0]),
        '첫 id 가 모두 다르다',
        [output.ids[0], ...Object.values(variants).map((variant) => variant.ids[0])],
      ),
    ];
  },
  reasons: (_input, output) => [
    `기준 시드 0x${output.seed} — worldSeed·tick·subjectId·decisionCounter·situationId 를 하나씩 바꾼 5가지가 모두 다른 시드를 냈다.`,
    '어느 하나라도 시드에 반영되지 않으면 서로 다른 주체·틱이 같은 난수를 쓰게 된다.',
  ],
  candidates: (input, output) => {
    const variants: [string, V2Input][] = [
      ['worldSeed 20260730→20260731', { ...input, worldSeed: '20260731' }],
      ['tick 12→13', { ...input, components: { ...input.components, tick: 13 } }],
      ['subjectId …01→…02', { ...input, components: { ...input.components, subjectId: 'npc_hunter_02' } }],
      ['decisionCounter 3→4', { ...input, components: { ...input.components, decisionCounter: 4 } }],
      ['situationId hunt→flee', { ...input, components: { ...input.components, situationId: 'sit_flee' } }],
    ];
    return [
      {
        label: '기준',
        value: `시드 0x${output.seed} · 첫 난수 ${(output.floats[0] ?? 0).toFixed(6)} · 첫 id ${output.ids[0] ?? '-'}`,
      },
      ...variants.map(([label, variant]) => {
        const result = executeV2(variant);
        return {
          label,
          value: `시드 0x${result.seed} · 첫 난수 ${(result.floats[0] ?? 0).toFixed(6)} · 첫 id ${result.ids[0] ?? '-'}`,
        };
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// 3. 시드 조합이 원문 규칙을 따른다
// ---------------------------------------------------------------------------
const seedCompositionFollowsDesignRule = defineScene({
  id: 'seed_composition_follows_design_rule',
  title: '시드는 worldSeed + tick + subjectId + decisionCounter + situationId 로만 결정된다',
  seed: 23n,
  arrange: () => ({ ...BASE_INPUT }),
  check: (input, output) => {
    const components = { worldSeed: BigInt(input.worldSeed), ...input.components };
    const expectedSeed = deriveSeed(components).toString(16);

    // 요청량(난수 개수·틱 수 등)은 시드에 영향을 주지 않아야 한다
    const otherRequest = executeV2({ ...input, draws: 3, ticks: 1, idKinds: ['event'] });

    return [
      eq('seed_matches_rule', expectedSeed, output.seed),
      eq('seed_label_is_canonical', seedLabel(components), output.seedLabel),
      eq('request_size_does_not_change_seed', output.seed, otherRequest.seed, '요청량은 시드가 아니다'),
      eq(
        'prefix_of_sequence_is_stable',
        output.floats.slice(0, 3),
        otherRequest.floats.slice(0, 3),
        '같은 시드면 앞부분이 같다',
      ),
      eq(
        'missing_component_differs_from_empty_string',
        false,
        deriveSeed({ worldSeed: 1n }) === deriveSeed({ worldSeed: 1n, subjectId: '' }),
        '없음과 빈 문자열은 다른 시드다',
      ),
    ];
  },
  reasons: (_input, output) => [
    `시드 구성 표기: ${output.seedLabel}`,
    '난수를 몇 개 뽑을지는 시드에 들어가지 않는다 — 같은 상황이면 요청량과 무관하게 같은 열이 나와야 한다.',
  ],
});

// ---------------------------------------------------------------------------
// 4. 하위 스트림은 서로를 흔들지 않는다
// ---------------------------------------------------------------------------
const forkedStreamsAreIndependent = defineScene({
  id: 'forked_streams_are_independent',
  title: '소비자를 새로 추가해도 기존 소비자의 난수열이 바뀌지 않는다',
  seed: 24n,
  arrange: () => ({ ...BASE_INPUT }),
  check: (_input, output) => {
    const parent = new Rng(BigInt(`0x${output.seed}`));

    // 지각 스트림만 쓰던 세계
    const perceptionBefore = Array.from({ length: 5 }, () => parent.fork('perception').nextFloat());

    // 뒤늦게 숙고 스트림을 추가하고 마구 뽑아 쓴다
    const deliberation = parent.fork('deliberation');
    for (let draw = 0; draw < 50; draw += 1) deliberation.nextFloat();
    // 부모 스트림도 소비한다
    for (let draw = 0; draw < 17; draw += 1) parent.nextFloat();

    const perceptionAfter = Array.from({ length: 5 }, () => parent.fork('perception').nextFloat());

    return [
      eq('perception_stream_unchanged', perceptionBefore, perceptionAfter, '부모 소비량과 무관하다'),
      ok(
        'labels_give_distinct_streams',
        parent.fork('perception').seed !== parent.fork('deliberation').seed,
        '이름표가 다르면 시드도 다르다',
        [parent.fork('perception').seed.toString(16), parent.fork('deliberation').seed.toString(16)],
      ),
      eq(
        'same_label_same_stream',
        parent.fork('perception').seed.toString(16),
        parent.fork('perception').seed.toString(16),
      ),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.forkSamples
      .map((sample) => `${sample.label} → 0x${sample.seed} (첫 값 ${sample.firstFloat.toFixed(6)})`)
      .join(' · '),
    '하위 스트림은 부모의 *현재 상태*가 아니라 *생성 시드*에서 파생한다. 그래서 소비 순서가 결과를 바꾸지 않는다.',
  ],
  candidates: (_input, output) => {
    const parent = new Rng(BigInt(`0x${output.seed}`));
    const before = Array.from({ length: 3 }, () => parent.fork('perception').nextFloat());

    const deliberation = parent.fork('deliberation');
    for (let draw = 0; draw < 50; draw += 1) deliberation.nextFloat();
    for (let draw = 0; draw < 17; draw += 1) parent.nextFloat();

    const after = Array.from({ length: 3 }, () => parent.fork('perception').nextFloat());
    return [
      { label: '① 지각 스트림 (소비자 추가 전)', value: before.map((value) => value.toFixed(6)).join(', ') },
      { label: '② 숙고 스트림 50회 + 부모 17회 소비', value: '기존 스트림을 건드리지 않아야 한다' },
      { label: '③ 지각 스트림 (추가 후)', value: after.map((value) => value.toFixed(6)).join(', ') },
      {
        label: '판정',
        value: before.join(',') === after.join(',') ? '① = ③ — 흔들리지 않았다' : '① ≠ ③ — 리플레이가 깨진다',
      },
    ];
  },
});

// ---------------------------------------------------------------------------
// 5. 시계는 틱으로만 흐른다
// ---------------------------------------------------------------------------
const tickClockAdvancesWithoutWallClock = defineScene({
  id: 'tick_clock_advances_without_wall_clock',
  title: '시각은 벽시계가 아니라 틱에서 나온다',
  seed: 25n,
  arrange: () => ({ ...BASE_INPUT, ticks: 5, msPerTick: 100 }),
  check: (input, output) => {
    const clock = new TickClock({ msPerTick: input.msPerTick ?? 100 });
    const before = clock.tick;
    clock.advance(3);

    return [
      eq('timeline_is_derived_from_ticks', [0, 100, 200, 300, 400], output.timeline.map((entry) => entry.timeMs)),
      eq('ticks_are_monotonic', [0, 1, 2, 3, 4], output.timeline.map((entry) => entry.tick)),
      eq('advance_moves_forward', before + 3, clock.tick),
      ok('advance_rejects_backward', throws(() => clock.advance(-1)), 'RangeError', '뒤로 가지 않는다'),
      eq('same_tick_same_time', clock.timeAt(7), clock.timeAt(7), '몇 번을 물어도 같은 시각'),
      eq('output_invariants', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (input, output) => [
    `틱당 ${input.msPerTick ?? 100}ms — ${output.timeline.map((entry) => `t${entry.tick}=${entry.timeMs}ms`).join(', ')}`,
    'Date.now()·new Date() 를 읽지 않으므로 언제 재생해도 같은 시각이 나온다 (GI-12).',
  ],
});

// ---------------------------------------------------------------------------
// 6. ID 는 실행 안에서 유일하고 재실행에서 같다
// ---------------------------------------------------------------------------
const idsAreUniqueAndStable = defineScene({
  id: 'ids_are_unique_and_stable',
  title: 'ID 는 한 실행 안에서 유일하고, 다시 실행하면 같은 값이 나온다',
  seed: 26n,
  arrange: () => ({ ...BASE_INPUT, idKinds: ['event', 'event', 'entity', 'event', 'entity'] }),
  check: (input, output) => {
    const rerun = executeV2(input);
    const factory = new IdFactory(BigInt(`0x${output.seed}`));
    const bulk = Array.from({ length: 5000 }, () => factory.next('event'));

    // 종류를 새로 추가해도 기존 종류의 열이 밀리지 않는다
    const withNewKind = executeV2({ ...input, idKinds: ['event', 'event', 'ability', 'entity', 'event', 'entity'] });
    const eventIdsBefore = output.ids.filter((id) => id.startsWith('event_'));
    const eventIdsAfter = withNewKind.ids.filter((id) => id.startsWith('event_'));

    return [
      eq('ids_unique_within_run', output.ids.length, new Set(output.ids).size),
      eq('ids_stable_across_runs', output.ids, rerun.ids),
      eq('bulk_ids_unique', 5000, new Set(bulk).size, '5000개 발급에서 충돌 없음'),
      eq('new_kind_does_not_shift_others', eventIdsBefore, eventIdsAfter, '종류별로 순번을 센다'),
      ok(
        'id_format',
        output.ids.every((id) => /^[a-z][a-z0-9_]*_[0-9a-f]{12}$/.test(id)),
        '<종류>_<해시12>',
        output.ids,
      ),
    ];
  },
  reasons: (_input, output) => [
    `발급된 id: ${output.ids.join(', ')}`,
    'UUID v4 처럼 난수 기반이면 재생할 때마다 달라져 사건 로그를 대조할 수 없다. 시드+종류+순번을 해시한다.',
  ],
});

// ---------------------------------------------------------------------------
// 7. 스냅샷으로 중간부터 재생한다
// ---------------------------------------------------------------------------
const snapshotRestoresMidSequence = defineScene({
  id: 'snapshot_restores_mid_sequence',
  title: '중간 상태를 저장했다가 복원하면 그 뒤 열이 이어진다',
  seed: 27n,
  arrange: () => ({ ...BASE_INPUT }),
  check: (_input, output) => {
    const rng = new Rng(BigInt(`0x${output.seed}`));
    const firstHalf = Array.from({ length: 5 }, () => rng.nextFloat());
    const snapshot = rng.snapshot();
    const secondHalf = Array.from({ length: 5 }, () => rng.nextFloat());

    const restored = Rng.restore(snapshot);
    const replayed = Array.from({ length: 5 }, () => restored.nextFloat());

    const clock = new TickClock({ startTick: 3, msPerTick: 50 });
    clock.advance(4);
    const restoredClock = TickClock.restore(clock.snapshot());

    const factory = new IdFactory(BigInt(`0x${output.seed}`));
    factory.next('event');
    factory.next('event');
    const restoredFactory = IdFactory.restore(factory.snapshot());

    return [
      eq('rng_resumes_exactly', secondHalf, replayed),
      eq('snapshot_records_draw_count', 5, snapshot.drawn),
      ok('first_half_untouched', firstHalf.length === 5 && firstHalf.every((value) => value >= 0 && value < 1), '[0,1) 5개', firstHalf),
      eq('clock_restores', clock.tick, restoredClock.tick),
      eq('clock_keeps_step', clock.timeMs, restoredClock.timeMs),
      eq('id_factory_resumes', factory.next('event'), restoredFactory.next('event')),
    ];
  },
  reasons: (_input, output) => [
    `시드 0x${output.seed} 의 열을 5개 뽑은 지점에서 스냅샷 → 복원 후 6번째부터 같은 값이 이어졌다.`,
    'K3(event-replay)가 사건 로그의 중간 지점부터 재생할 때 쓰는 기능이다.',
  ],
  candidates: (_input, output) => {
    const rng = new Rng(BigInt(`0x${output.seed}`));
    const head = Array.from({ length: 5 }, () => rng.nextFloat());
    const snapshot = rng.snapshot();
    const tail = Array.from({ length: 5 }, () => rng.nextFloat());
    const restored = Rng.restore(snapshot);
    const replayed = Array.from({ length: 5 }, () => restored.nextFloat());
    return [
      { label: '1~5 (스냅샷 전)', value: head.map((value) => value.toFixed(6)).join(', ') },
      { label: '스냅샷', value: `state=0x${BigInt(snapshot.state).toString(16)} · drawn=${snapshot.drawn}` },
      { label: '6~10 (원본 계속)', value: tail.map((value) => value.toFixed(6)).join(', ') },
      { label: '6~10 (복원 후)', value: replayed.map((value) => value.toFixed(6)).join(', ') },
      {
        label: '판정',
        value: tail.join(',') === replayed.join(',') ? '두 열이 같다 — 중간부터 재생 가능' : '갈라졌다',
      },
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

export const v2Scenarios: VerificationScenario<V2Input, V2Output>[] = [
  sameSeedRepeatsSequence,
  differentSeedComponentDiverges,
  seedCompositionFollowsDesignRule,
  forkedStreamsAreIndependent,
  tickClockAdvancesWithoutWallClock,
  idsAreUniqueAndStable,
  snapshotRestoresMidSequence,
];
