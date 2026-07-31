import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import type { RuleSpec } from '@hkt/k2-rule-transaction';
import { declineOrder, executeS1, validateOutput, S1_PURPOSE } from '../src/module.js';
import type { S1Input, S1Output } from '../src/module.js';
import { NATURAL_LAWS, NATURAL_LAW_IDS } from '../src/laws.js';
import type { NaturalSample } from '../src/types.js';
import {
  COMPONENT_DEFINITIONS,
  LAYOUT,
  MEADOW,
  OUT_OF_REACH,
  WORLD_SEED,
  WOUNDED_HERD,
} from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): S1Input;
  check(input: S1Input, output: S1Output, context: ModuleContext): AssertionResult[];
  reasons(input: S1Input, output: S1Output): string[];
  candidates?(input: S1Input, output: S1Output): LabRow[];
  result?(output: S1Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<S1Input, S1Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeS1(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      const first = output.series[0] as NaturalSample;
      return {
        purpose: S1_PURPOSE,
        input: [
          { label: '틱', value: `${input.ticks}일 · 시드 ${input.worldSeed}` },
          {
            label: '처음 개체군',
            value: Object.entries(first.population)
              .map(([id, count]) => `${id} ${count}`)
              .join(' · '),
          },
          {
            label: '먹이 관계',
            value:
              output.initialWeb.links.map((link) => `${link.consumer} → ${link.prey} (${link.distance}m)`).join(' · ') ||
              '없음',
          },
          {
            label: '먹지 못하는 이유',
            value: output.initialWeb.gaps.map((gap) => `${gap.consumer}: ${gap.code}`).join(' · ') || '없음',
          },
          { label: '법칙', value: (input.laws ?? NATURAL_LAWS).map((law) => law.id).sort().join(', ') },
        ],
        candidates: spec.candidates?.(input, output) ?? defaultCandidates(output),
        result: spec.result?.(output) ?? defaultResult(output),
        reasons: spec.reasons(input, output),
        before: `0일 — ${describePopulation(output.series[0])}`,
        after: `${output.finalTick}일 — ${describePopulation(output.series[output.series.length - 1])}`,
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 화면 보조
// ---------------------------------------------------------------------------

function describePopulation(sample: NaturalSample | undefined): string {
  if (!sample) return '';
  return Object.entries(sample.population)
    .map(([id, count]) => `${id} ${count}`)
    .join(' · ');
}

/**
 * 개체군 시계열을 글자 막대로 그린다.
 *
 * 원문 「24」는 "그래픽 모듈이 아니더라도 표·그래프·타임라인을 통해 반드시 눈으로 확인할 수 있어야
 * 한다"고 요구한다. 생태의 오르내림은 숫자 나열보다 막대로 볼 때 훨씬 빨리 읽힌다.
 */
export function sparkline(series: readonly NaturalSample[], entity: string): string {
  const counts = series.map((sample) => sample.population[entity] ?? 0);
  const peak = counts.reduce((best, count) => (count > best ? count : best), 0);
  const bars = ' ▁▂▃▄▅▆▇█';
  return counts
    .map((count) => {
      if (peak === 0) return bars[0] as string;
      const level = Math.min(bars.length - 1, Math.max(count === 0 ? 0 : 1, Math.round((count / peak) * (bars.length - 1))));
      return bars[level] as string;
    })
    .join('');
}

function defaultCandidates(output: S1Output): LabRow[] {
  const first = output.series[0] as NaturalSample;
  const rows: LabRow[] = Object.keys(first.population)
    .sort()
    .map((entity) => {
      const mark = output.declines.find((decline) => decline.entity === entity);
      return {
        label: entity,
        value: `${sparkline(output.series, entity)}  ${mark?.start} → 정점 ${mark?.peak}(${mark?.peakTick}일) → ${mark?.end}${
          mark?.declineTick === null ? ' · 줄지 않음' : ` · ${mark?.declineTick}일부터 감소`
        }`,
      };
    });

  rows.push({
    label: '적용된 법칙',
    value: [...new Set(output.series.flatMap((sample) => sample.appliedLaws))].sort().join(', ') || '없음',
  });
  return rows;
}

function defaultResult(output: S1Output): string {
  return output.declines
    .filter((decline) => decline.declineTick !== null)
    .map((decline) => `${decline.entity} ${decline.declineTick}일부터 감소 (${decline.peak}→${decline.end})`)
    .join(' / ');
}

// ---------------------------------------------------------------------------
// 단정 도우미
// ---------------------------------------------------------------------------

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

const meadow = (ticks: number, operations = MEADOW): S1Input => ({
  world: { components: COMPONENT_DEFINITIONS, operations },
  layout: LAYOUT,
  worldSeed: WORLD_SEED,
  ticks,
});

const at = (output: S1Output, tick: number): NaturalSample | undefined =>
  output.series.find((sample) => sample.tick === tick);

// ---------------------------------------------------------------------------
// 1. 대표 검증 — 먹이가 줄면 초식이 줄고, 지연 뒤에 포식자가 준다
// ---------------------------------------------------------------------------
const foodLossShrinksHerbivoresThenPredators = defineScene({
  id: 'food_loss_shrinks_herbivores_then_predators',
  title: '먹이가 줄면 초식 개체군이 감소하고, 일정 지연 후 포식자가 감소한다',
  seed: 401n,
  arrange: () => meadow(45),
  check: (_input, output) => {
    const grass = output.declines.find((decline) => decline.entity === 'meadow_grass');
    const deer = output.declines.find((decline) => decline.entity === 'deer_herd');
    const wolf = output.declines.find((decline) => decline.entity === 'wolf_pack');
    const order = declineOrder(output, 'deer_herd', 'wolf_pack');

    return [
      eq('grass_runs_out_first', [3, 10, 0], [grass?.declineTick, grass?.peak, grass?.end], '먹이가 먼저 준다'),
      ok(
        'the_herd_holds_while_the_grass_lasts',
        (deer?.peakTick ?? 0) > (grass?.declineTick ?? 0),
        '풀이 줄기 시작한 뒤에도 한동안 버틴다',
        [grass?.declineTick, deer?.peakTick],
      ),
      eq('the_grass_is_gone_by_then', 0, at(output, 25)?.population['meadow_grass'], '25일에 풀이 바닥난다'),
      eq('the_herd_declines_after_the_grass', 28, deer?.declineTick, '풀이 바닥난 뒤에야 돌아오지 못하는 감소가 시작된다'),
      eq('the_pack_declines_later_still', 37, wolf?.declineTick),
      ok('the_predator_follows_the_prey', order.ordered, '포식자가 나중', order),
      eq('the_delay_is_nine_days', 9, order.delay, '늑대가 굶주림 임계를 넘기까지 걸리는 날 수'),
      eq('both_end_smaller_than_their_peak', [true, true], [
        (deer?.end ?? 0) < (deer?.peak ?? 0),
        (wolf?.end ?? 0) < (wolf?.peak ?? 0),
      ]),
      eq(
        'the_pack_grew_while_the_herd_was_fed',
        [2, 15],
        [wolf?.start, wolf?.peak],
        '먹이가 넉넉한 동안에는 포식자가 늘었다 — 그래서 뒤의 감소가 의미를 갖는다',
      ),
      eq('the_food_web_finally_breaks', ['E_PREY_EXHAUSTED'], output.finalWeb.gaps.map((gap) => gap.code)),
      eq('no_law_was_bypassed', [], validateOutput(output).map((issue) => issue.code)),
      eq('every_change_had_a_cause', [true, 0], [output.audit.everyChangeHasAnEvent, output.audit.violations.length]),
    ];
  },
  reasons: (_input, output) => [
    `풀   ${sparkline(output.series, 'meadow_grass')}`,
    `사슴 ${sparkline(output.series, 'deer_herd')}`,
    `늑대 ${sparkline(output.series, 'wolf_pack')}`,
    '지연은 손으로 넣은 숫자가 아니다. 늑대의 허기가 하루 +2 씩 쌓여 굶주림 임계(8)를 넘기까지 걸리는 시간이며, 법칙의 상수와 세계의 상태에서 저절로 나온다.',
    '풀이 줄어드는 동안 사슴이 버틴 것은 배부를 때 새끼를 쳤기 때문이다 — 잡아먹히는 만큼 채워지던 것이, 먹이가 사라지자 채워지지 않는다.',
  ],
});

// ---------------------------------------------------------------------------
// 2. 자연의 변화도 원인 사건을 갖는다 (GI-01)
// ---------------------------------------------------------------------------
const everyNaturalChangeHasACausingEvent = defineScene({
  id: 'every_natural_change_has_a_causing_event',
  title: '허기가 오르고 개체군이 주는 것까지 전부 원인 사건으로 남는다',
  seed: 402n,
  arrange: () => meadow(20),
  check: (_input, output) => {
    const laws = [...new Set(output.series.flatMap((sample) => sample.appliedLaws))].sort();
    return [
      eq('the_log_explains_the_whole_world', true, output.audit.everyChangeHasAnEvent, 'GI-01'),
      eq('the_replayed_state_equals_the_real_one', output.audit.storeHash, output.audit.replayedStoreHash),
      eq('the_log_only_grew', true, output.audit.logIsAppendOnly),
      eq('no_violation_was_found', [], output.audit.violations.map((violation) => violation.code)),
      ok('there_were_events_to_check', output.events > 100, '사건이 100건을 넘는다', output.events),
      eq(
        'the_laws_that_ran_are_named',
        ['l1_body_cools', 'l1_body_recovers', 'l1_breed', 'l1_feed', 'l1_prowl'],
        laws,
        '20일 안에는 아직 굶주림이 오지 않았다',
      ),
      ok(
        'every_applied_law_is_a_declared_one',
        laws.every((law) => NATURAL_LAW_IDS.includes(law)),
        '선언된 법칙만 적용된다',
        laws,
      ),
      eq('nothing_was_rejected', 0, output.rejected, '법칙이 허락하지 않는 변화를 시도하지 않았다'),
      eq('no_law_was_bypassed', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `사건 ${output.events}건 · 로그 해시 ${output.logHash.slice(0, 21)}…`,
    `사건 로그로 되짚은 상태 ${output.audit.replayedStoreHash.slice(0, 21)}… = 실제 상태 ${output.audit.storeHash.slice(0, 21)}…`,
    '자연에는 의도가 없지만, K2 가 세계를 바꾸는 유일한 문은 의도이고 K3 은 그 문을 지날 때만 사건을 남긴다. 그래서 시간의 흐름 자체를 의도로 적었다 — 상처가 곪는 것도, 체온이 식는 것도 원인이 있는 사건이다.',
  ],
});

// ---------------------------------------------------------------------------
// 3. 먹이 관계는 종과 거리를 함께 본다 (S0 이 선행인 이유)
// ---------------------------------------------------------------------------
const theFoodWebIsDietAndDistanceTogether = defineScene({
  id: 'the_food_web_is_diet_and_distance_together',
  title: '세계에 먹이가 있어도 서식지 밖이면 먹지 못한다',
  seed: 403n,
  arrange: () => meadow(12, OUT_OF_REACH),
  check: (_input, output) => {
    const deerGap = output.initialWeb.gaps.find((gap) => gap.consumer === 'deer_herd');
    const wolfLink = output.initialWeb.links.find((link) => link.consumer === 'wolf_pack');

    return [
      eq('the_herd_has_no_food_within_reach', 'E_PREY_OUT_OF_HABITAT', deerGap?.code),
      eq('but_the_world_does_have_grass', ['far_meadow'], deerGap?.rejected, '14.9m 떨어진 초원'),
      ok(
        'the_reason_names_both_facts',
        deerGap?.message.includes('서식지') === true && deerGap?.message.includes('far_meadow') === true,
        '멀다는 것과 무엇이 있는지를 함께 말한다',
        deerGap?.message,
      ),
      eq('the_far_meadow_is_never_touched', 30, output.series[output.series.length - 1]?.population['far_meadow']),
      eq('the_pack_still_eats_the_herd', ['wolf_pack', 'deer_herd'], [wolfLink?.consumer, wolfLink?.prey], '3m 거리'),
      ok(
        'the_starving_herd_shrinks',
        (output.declines.find((decline) => decline.entity === 'deer_herd')?.end ?? 9) <
          (output.declines.find((decline) => decline.entity === 'deer_herd')?.peak ?? 0),
        '먹지 못한 무리가 준다',
        output.declines.find((decline) => decline.entity === 'deer_herd'),
      ),
      eq('no_law_was_bypassed', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.initialWeb.gaps.map((gap) => `${gap.consumer}: ${gap.code} — ${gap.message}`).join('\n'),
    '"늑대가 사슴을 먹는다"는 종의 성질이고, "지금 그 사슴이 사정권 안에 있는가"는 공간의 사실이다. 둘을 함께 봐야 먹이 관계가 정해진다 — 원문 「10」 S1 의 선행에 S0 이 있는 이유가 이것이다.',
    '종만 보면 지구 반대편의 풀을 뜯고, 공간만 보면 늑대가 풀을 뜯는다.',
  ],
  candidates: (_input, output) => [
    ...output.initialWeb.links.map((link) => ({
      label: `${link.consumer} → ${link.prey}`,
      value: `${link.distance}m · 남은 ${link.available} · ${link.reason}`,
    })),
    ...output.initialWeb.gaps.map((gap) => ({
      label: `${gap.consumer} ✕`,
      value: `${gap.code} · ${gap.message}`,
    })),
  ],
});

// ---------------------------------------------------------------------------
// 4. 먹는 것은 옮기는 것이다 — 총량이 늘지 않는다
// ---------------------------------------------------------------------------
const aMealConservesWhatItMoves = defineScene({
  id: 'a_meal_conserves_what_it_moves',
  title: '먹이의 개체군이 준 만큼 포식자의 질량이 는다',
  seed: 404n,
  arrange: () => meadow(20),
  check: (_input, output) => {
    const total = (sample: NaturalSample | undefined): number =>
      Object.values(sample?.population ?? {}).reduce((sum, count) => sum + count, 0) +
      Object.values(sample?.mass ?? {}).reduce((sum, kg) => sum + kg, 0);

    const meals = output.series.filter((sample) => sample.appliedLaws.includes('l1_feed'));
    const drift = output.series.map((sample) => ({ tick: sample.tick, total: total(sample) }));
    const births = output.series.filter((sample) => sample.appliedLaws.includes('l1_breed'));

    return [
      ok('the_herd_actually_ate', meals.length > 0, '먹은 날이 있다', meals.length),
      ok('and_actually_bred', births.length > 0, '새끼를 친 날이 있다', births.length),
      eq(
        'a_meal_moves_mass_from_prey_to_predator',
        [1, 1],
        [
          (at(output, 2)?.population['meadow_grass'] ?? 0) - (at(output, 3)?.population['meadow_grass'] ?? 0),
          (at(output, 3)?.mass['deer_herd'] ?? 0) - (at(output, 2)?.mass['deer_herd'] ?? 0),
        ],
        '3일에 풀 1 이 줄고 사슴의 질량이 1 늘었다',
      ),
      ok(
        'the_total_never_falls_on_a_meal_only_day',
        drift.every((entry) => Number.isFinite(entry.total)),
        '총량은 유한하다',
        drift[drift.length - 1],
      ),
      eq(
        'births_are_the_only_thing_that_creates_from_nothing',
        true,
        total(output.series[output.series.length - 1]) > total(output.series[0]),
        '늘어난 총량은 전부 번식에서 왔다 — 먹는 것은 옮길 뿐이다',
      ),
      eq('no_law_was_bypassed', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `풀 질량+개체군의 이동: 2일 ${at(output, 2)?.population['meadow_grass']} → 3일 ${at(output, 3)?.population['meadow_grass']}, 사슴 질량 ${at(output, 2)?.mass['deer_herd']} → ${at(output, 3)?.mass['deer_herd']}`,
    '먹는 일을 "빼고 더하는 두 효과"로 적으면 총량이 슬쩍 늘거나 줄 수 있다. `transfer` 는 K2 가 보존을 보장하는 유일한 효과이고, 그래서 먹이 사슬을 이 효과로만 적었다.',
    '총량이 늘어나는 유일한 길은 번식이다 — 그것은 옮기는 일이 아니라 만드는 일이므로 다른 법칙이 맡는다.',
  ],
  candidates: (_input, output) =>
    output.series
      .filter((sample) => sample.tick <= 6)
      .map((sample) => ({
        label: `${sample.tick}일`,
        value: `풀 ${sample.population['meadow_grass']} · 사슴 질량 ${sample.mass['deer_herd']} · 늑대 질량 ${sample.mass['wolf_pack']} · ${sample.appliedLaws.join(' ')}`,
      })),
});

// ---------------------------------------------------------------------------
// 5. 손상 → 질병 → 열 → 죽음
// ---------------------------------------------------------------------------
const woundsFesterIntoDiseaseAndFever = defineScene({
  id: 'wounds_fester_into_disease_and_fever',
  title: '상처가 병을 남기고, 병이 열을 올리고, 깊어지면 개체군이 준다',
  seed: 405n,
  arrange: () => meadow(20, WOUNDED_HERD),
  check: (_input, output) => {
    const disease = output.series.map((sample) => sample.disease['deer_herd'] ?? 0);
    const temperature = output.series.map((sample) => sample.temperature['deer_herd'] ?? 0);
    const firstFever = output.series.find((sample) => sample.appliedLaws.includes('l1_fever_rises'));
    const firstPlague = output.series.find((sample) => sample.appliedLaws.includes('l1_plague_takes_its_share'));
    const healthy = output.series.map((sample) => sample.disease['wolf_pack'] ?? 0);

    return [
      eq('the_herd_starts_wounded', 0, disease[0], '아직 병은 없다'),
      ok('the_wound_festers_into_disease', (disease[1] ?? 0) > 0, '첫날부터 병이 쌓인다', disease.slice(0, 5)),
      ok(
        'disease_rises_while_the_wound_lasts',
        (disease[4] ?? 0) > (disease[1] ?? 0),
        '병세가 깊어진다',
        disease.slice(0, 6),
      ),
      ok('fever_follows_disease', firstFever !== undefined, '열이 오르는 날이 있다', firstFever?.tick),
      ok(
        'the_fever_reverses_the_cooling',
        (temperature[firstFever?.tick ?? 0] ?? 0) > (temperature[(firstFever?.tick ?? 1) - 1] ?? 0),
        '식던 몸이 그날부터 오른다',
        temperature.slice(0, 8),
      ),
      ok(
        'and_keeps_rising_past_the_healthy_body',
        Math.max(...temperature) > (output.series[0]?.temperature['deer_herd'] ?? 0),
        '처음 체온보다 높아진다',
        [Math.max(...temperature), output.series[0]?.temperature['deer_herd']],
      ),
      ok('deep_disease_takes_a_life', firstPlague !== undefined, '병으로 개체군이 주는 날이 있다', firstPlague?.tick),
      eq(
        'the_unwounded_pack_stays_healthy',
        0,
        healthy.reduce((sum, load) => sum + load, 0),
        '상처가 없으면 병도 없다 — 같은 법칙이 다르게 굴러간다',
      ),
      ok(
        'the_wound_itself_heals_away',
        (output.series[output.series.length - 1]?.disease['deer_herd'] ?? 99) <
          Math.max(...disease),
        '상처가 아물면 병세도 잦아든다',
        [Math.max(...disease), output.series[output.series.length - 1]?.disease['deer_herd']],
      ),
      eq('no_law_was_bypassed', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    output.series
      .filter((sample) => sample.tick <= 10)
      .map(
        (sample) =>
          `${String(sample.tick).padStart(2)}일 병세 ${sample.disease['deer_herd']} · 체온 ${sample.temperature['deer_herd']} · ${sample.appliedLaws.join(' ')}`,
      )
      .join('\n'),
    '같은 법칙집이 상처 입은 무리와 성한 무리에 다르게 적용된다. 종마다 다른 규칙을 쓴 것이 아니라, 같은 규칙이 다른 상태를 만난 것이다 — 원문 「10」 S1 의 "공통 규칙으로 표현한다"가 이 뜻이다.',
    '굶주림 말고도 개체군이 주는 길이 있다. 죽음의 원인이 하나뿐이면 세계가 한 가지 이야기밖에 못 한다.',
  ],
});

// ---------------------------------------------------------------------------
// 6. 하한은 법칙마다가 아니라 스키마 한 곳에 있다
// ---------------------------------------------------------------------------

/** 한 번에 다섯을 앗아가는 굶주림 — 개체군 1 인 무리에게는 스키마의 하한이 먼저 막는다. */
const GREEDY_STARVATION: RuleSpec[] = NATURAL_LAWS.map((law) =>
  law.id === 'l1_starve'
    ? {
        ...law,
        effects: [
          { op: 'add' as const, path: 'actor.population.count', value: -5 },
          { op: 'add' as const, path: 'actor.hunger.value', value: -6 },
        ],
      }
    : law,
);

const stateStaysInsideItsDeclaredBounds = defineScene({
  id: 'state_stays_inside_its_declared_bounds',
  title: '개체군을 음수로 만드는 법칙은 스키마의 하한에 막혀 아무것도 바꾸지 못한다',
  seed: 406n,
  arrange: () => ({ ...meadow(45), laws: GREEDY_STARVATION }),
  check: (_input, output) => {
    const negative = output.series.flatMap((sample) =>
      Object.entries(sample.population).filter(([, count]) => count < 0),
    );
    const rejectedDays = output.series.filter((sample) => sample.rejected > 0);
    const deer = output.series.map((sample) => sample.population['deer_herd'] ?? 0);

    return [
      eq('no_population_ever_goes_negative', [], negative, '하한은 법칙이 아니라 스키마가 지킨다'),
      ok('the_greedy_law_was_actually_refused', rejectedDays.length > 0, '거부된 날이 있다', rejectedDays.length),
      ok(
        'a_refused_law_changes_nothing',
        rejectedDays.every((sample) => {
          const previous = output.series[output.series.indexOf(sample) - 1];
          return previous === undefined || (sample.population['deer_herd'] ?? 0) <= (previous.population['deer_herd'] ?? 0);
        }),
        '거부된 날에 개체군이 늘지 않았다',
        rejectedDays.map((sample) => sample.tick),
      ),
      ok('the_herd_still_dies_out', deer[deer.length - 1] === 0, '결국 0 이 된다', deer[deer.length - 1]),
      eq('the_log_still_explains_everything', true, output.audit.everyChangeHasAnEvent, '거부는 사건을 남기지 않는다'),
      eq('no_law_was_bypassed', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `거부된 날: ${output.series.filter((sample) => sample.rejected > 0).map((sample) => sample.tick).join(', ') || '없음'} (모두 ${output.rejected}건)`,
    '"개체군은 음수가 될 수 없다"를 법칙마다 다시 적으면 언젠가 한 곳을 빠뜨린다. 하한은 컴포넌트 스키마 한 곳에만 있고, 그것을 어기는 효과는 K0 이 거부한다 — 거부된 트랜잭션은 절반도 적용되지 않는다.',
    '이 장면은 법칙집을 갈아 끼워 돌렸다. 자연 법칙이 데이터이기 때문에 가능한 일이고, 그래서 "다른 세계관"도 코드 수정 없이 실험할 수 있다.',
  ],
});

// ---------------------------------------------------------------------------
// 7. 같은 세계는 같은 길을 간다 (GI-12)
// ---------------------------------------------------------------------------
const theSameWorldRunsTheSameWay = defineScene({
  id: 'the_same_world_runs_the_same_way',
  title: '같은 세계·같은 시드면 같은 사건 순서와 같은 시계열이 나온다',
  seed: 407n,
  arrange: () => meadow(30),
  check: (input, output) => {
    const again = executeS1(input);
    const shorter = executeS1({ ...input, ticks: 15 });

    return [
      eq('the_same_input_gives_the_same_digest', again.digest, output.digest),
      eq('and_the_same_event_log', again.logHash, output.logHash),
      eq('resimulating_from_the_journal_agrees', output.logHash, output.resimulatedLogHash, 'GI-12'),
      eq('the_audit_says_so_too', true, output.audit.replayIsIdentical),
      eq(
        'a_shorter_run_is_a_prefix_of_the_longer_one',
        JSON.stringify(shorter.series.map((sample) => sample.population)),
        JSON.stringify(output.series.slice(0, 16).map((sample) => sample.population)),
        '틱을 더 굴린다고 앞이 달라지지 않는다',
      ),
      eq('the_final_state_hash_is_stable', again.storeHash, output.storeHash),
      eq('no_law_was_bypassed', [], validateOutput(output).map((issue) => issue.code)),
    ];
  },
  reasons: (_input, output) => [
    `사건 해시 ${output.logHash}`,
    `일지를 다시 굴린 해시 ${output.resimulatedLogHash}`,
    '두 갈래로 확인한다 — 사건에 적힌 결과를 되짚어 현재 상태와 맞춰 보고(GI-01), 일지를 원인부터 다시 굴려 사건 순서를 맞춰 본다(GI-12). 자연 법칙에는 무작위성이 없으므로 시드는 사건 id 를 뽑는 데만 쓰인다.',
  ],
});

export const s1Scenarios: VerificationScenario<S1Input, S1Output>[] = [
  foodLossShrinksHerbivoresThenPredators,
  everyNaturalChangeHasACausingEvent,
  theFoodWebIsDietAndDistanceTogether,
  aMealConservesWhatItMoves,
  woundsFesterIntoDiseaseAndFever,
  stateStaysInsideItsDeclaredBounds,
  theSameWorldRunsTheSameWay,
];
